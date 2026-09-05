#!/usr/bin/env node
/**
 * Meerkat PUBLIC DIRECTORY NODE -- the public-social discovery service (Plan 19
 * P3b, design §5.4). A THIRD deployable image over the SAME codebase as the slim
 * relay and the community node: it stores the signed publication records the P2
 * client announces under category/search rids (the SAME relay `ann`/`lk` verbs, so
 * a P2 client pointed here works unchanged) and serves browse / search / a ranked
 * `trend` feed. It needs @mylife/sync at runtime and a DATA_DIR volume, so it is
 * NOT built by the slim ws+zod-only relay image.
 *
 * Honest trending: ranked by the REAL distinct announcing-host count first, recency
 * (owner-signed updatedAt) second. No eventCount / view / like scoring.
 *
 * Run from source with tsx (the monorepo resolves the TS entry):
 *
 *   PORT=8891 HOST=0.0.0.0 DATA_DIR=~/.meerkat/directory \
 *     TRUST_AND_SAFETY_AUTHORITY_DEVICE_ID=<pubkey> \
 *     tsx bin/meerkat-public-directory-node.mjs
 *
 * State authority + hardening:
 *  - MEERKAT_DEPLOYMENT_PROFILE / MEERKAT_STORE_BACKEND select file or PostgreSQL explicitly.
 *    First-party mode requires PostgreSQL with verify-full TLS and never falls back to files.
 *  - MEERKAT_DIRECTORY_ANNOUNCER_HMAC_KEY is required in PostgreSQL mode. It is exactly 64
 *    hexadecimal characters, decoded to one shared 32-byte key on every replica.
 *  - FilePublicationDirectoryStore(DATA_DIR/publications)  restart-safe signed records
 *  - FileKillStore(DATA_DIR/kills)                         restart-safe T&S takedowns
 *  - PostgreSQL mode shares publications, kills, and keyed host freshness across replicas.
 *  - per-owner + global publication caps, per-content-rid host caps, per-IP limiter.
 *
 * Optional Trust & Safety authority: set TRUST_AND_SAFETY_AUTHORITY_DEVICE_ID to the
 * authority pubkey to honor that authority's signed DescriptorKill takedowns
 * (durably). Without it the node serves discovery but accepts no takedowns. Region
 * deploy (NAT/TLS at the edge, the always-on soak) is founder ops.
 */

import path from 'node:path';
import {
  PublicDirectoryNode,
  FilePublicationDirectoryStore,
  FileKillStore,
  PostgresPublicDirectoryRepository,
  PostgresDirectoryHostAnnouncementStore,
  createMeerkatStoreRuntime,
  resolveMeerkatStoreRuntimeConfig,
  startPublicDirectoryNode,
  redactForLog,
  redactErrorDetail,
  createHealthEndpoints,
  createMetricsRegistry,
  resolveMetricsListenerConfig,
  startMetricsListener,
  postgresReadyProbe,
  dataDirWritableProbe,
} from '../src/index.ts';
import { installOrphanWatchdog } from '../src/orphan-watchdog.ts';

// Every log event is deep-redacted before it reaches stdout (Plan 44 WP-4B): a
// denylisted key, a connection string with a password, or a bearer blob is
// scrubbed while counts, ids, urls, and public keys pass through. errorDetail()
// additionally scrubs the free-form error string on the fatal paths.
const out = (obj) => process.stdout.write(JSON.stringify({ at: new Date().toISOString(), ...redactForLog(obj) }) + '\n');
const errorDetail = (error) => redactErrorDetail(String(error?.message ?? error));

const port = Number(process.env.PORT ?? 8891);
const host = process.env.HOST ?? '0.0.0.0';
const dataDir = process.env.DATA_DIR ?? './.meerkat-directory';
const publicationsDir = path.join(dataDir, 'publications');
const killsDir = path.join(dataDir, 'kills');
// Optional Trust & Safety authority pubkey: when set, the node honors that
// authority's signed DescriptorKill takedowns (durably, via FileKillStore).
const trustedKillAuthorityDeviceId = process.env.TRUST_AND_SAFETY_AUTHORITY_DEVICE_ID || undefined;

let runtimeConfig;
let storeRuntime;
let announcerHmacKey;
let server;
let metricsListener = null;
let shuttingDown = false;

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  out({ event: 'shutdown', signal });
  let failed = false;
  if (metricsListener) {
    try {
      await metricsListener.close();
    } catch {
      failed = true;
    }
  }
  if (server) {
    try {
      await server.close();
    } catch {
      failed = true;
    }
  }
  if (storeRuntime) {
    try {
      await storeRuntime.close();
    } catch {
      failed = true;
    }
  }
  if (failed) {
    out({ event: 'fatal', reason: 'shutdown_failed' });
    process.exit(1);
  }
  process.exit(0);
}
process.on('SIGINT', () => { void shutdown('SIGINT'); });
process.on('SIGTERM', () => { void shutdown('SIGTERM'); });

// Process guards (audit 2026-09-01, R4). Node terminates on an unhandled
// rejection by default, so any request path that leaks one is a one-request
// restart of this service. Log a structured, id-free line and keep serving; an
// uncaught synchronous exception still exits (state may be inconsistent) so the
// supervisor restarts cleanly.
process.on('unhandledRejection', (reason) => {
  const error = reason instanceof Error ? reason : null;
  console.error(JSON.stringify({ event: 'unhandled_rejection', name: error?.name ?? typeof reason, message: String(error?.message ?? reason).slice(0, 200) }));
});
process.on('uncaughtException', (error) => {
  console.error(JSON.stringify({ event: 'uncaught_exception', name: error?.name ?? 'Error', message: String(error?.message ?? error).slice(0, 200) }));
  process.exit(1);
});

// Orphan watchdog (2026-09-02 memory exhaustion incident). When the process that
// spawned this service dies abnormally, leave through the SIGTERM path above
// rather than surviving forever re-parented to init. Never arms in production: a
// container PID 1, or a service adopted by systemd or an init shim, has no
// supervising parent whose death could orphan it.
installOrphanWatchdog({ log: (event) => console.error(JSON.stringify(event)) });

try {
  runtimeConfig = resolveMeerkatStoreRuntimeConfig({
    service: 'directory',
    env: { ...process.env, DATA_DIR: dataDir },
  });
  if (runtimeConfig.backend === 'postgres') {
    const encoded = (process.env.MEERKAT_DIRECTORY_ANNOUNCER_HMAC_KEY ?? '').trim();
    if (!/^[0-9a-f]{64}$/iu.test(encoded)) {
      throw new Error(
        'PostgreSQL directory mode requires a 64-hex MEERKAT_DIRECTORY_ANNOUNCER_HMAC_KEY',
      );
    }
    announcerHmacKey = Buffer.from(encoded, 'hex');
    if (announcerHmacKey.byteLength !== 32) {
      throw new Error('Directory announcer HMAC key must decode to exactly 32 bytes');
    }
  }
  storeRuntime = await createMeerkatStoreRuntime(runtimeConfig);
} catch (error) {
  out({
    event: 'fatal',
    reason: 'state_authority_unavailable',
    detail: errorDetail(error),
  });
  process.exit(1);
}

try {
  let node;
  if (runtimeConfig.backend === 'file') {
    node = new PublicDirectoryNode({
      publicationStore: new FilePublicationDirectoryStore(publicationsDir),
      killStore: new FileKillStore(killsDir),
      trustedKillAuthorityDeviceId,
    });
  } else {
    const database = storeRuntime.database;
    if (!database || !announcerHmacKey) {
      throw new Error('PostgreSQL directory state backend did not initialize');
    }
    node = new PublicDirectoryNode({
      repository: new PostgresPublicDirectoryRepository(database),
      hostAnnouncementStore: new PostgresDirectoryHostAnnouncementStore(database, {
        announcerHmacKey,
      }),
      trustedKillAuthorityDeviceId,
    });
  }

  // Plan 44 WP-4A: bounded directory counts (the same figures /healthz returns) plus
  // (postgres) pool depth, and honest /readyz. node.stats() is async.
  const backend = runtimeConfig.backend;
  const metricsRegistry = createMetricsRegistry();
  metricsRegistry.collect('meerkat_directory_records', 'Bounded directory record counts by kind.', async () => {
    const s = await node.stats();
    return [
      { labels: { service: 'directory', kind: 'publications' }, value: s.publications },
      { labels: { service: 'directory', kind: 'host_rids' }, value: s.hostRids },
    ];
  });
  if (backend === 'postgres') {
    metricsRegistry.collect('meerkat_postgres_pool_connections', 'PostgreSQL pool connection counts.', () => [
      { labels: { service: 'directory', state: 'total' }, value: storeRuntime.pool?.totalCount ?? 0 },
      { labels: { service: 'directory', state: 'idle' }, value: storeRuntime.pool?.idleCount ?? 0 },
      { labels: { service: 'directory', state: 'waiting' }, value: storeRuntime.pool?.waitingCount ?? 0 },
    ]);
  }
  const directoryChecks = backend === 'postgres'
    ? [{ name: 'postgres', required: true, probe: postgresReadyProbe(storeRuntime.pool) }]
    : [{ name: 'data_dir', required: true, probe: dataDirWritableProbe(runtimeConfig.dataDir ?? dataDir) }];
  const healthEndpoints = createHealthEndpoints({ service: 'directory', checks: directoryChecks });

  server = await startPublicDirectoryNode({
    node,
    port,
    host,
    healthEndpoints,
    trustedProxyHops: Number(process.env.MEERKAT_TRUST_PROXY_HOPS ?? 0),
    log: (event, detail) => out({ event, ...detail }),
  });

  // Opt-in private metrics listener (loopback by default; NEVER the public port).
  const metricsConfig = resolveMetricsListenerConfig(process.env);
  if (metricsConfig) {
    metricsListener = await startMetricsListener({
      registry: metricsRegistry,
      config: metricsConfig,
      health: healthEndpoints,
      log: (event, detail) => out({ event, ...detail }),
    });
  }
} catch (error) {
  try {
    await storeRuntime.close();
  } catch {
    out({ event: 'fatal', reason: 'state_authority_close_failed' });
  }
  out({
    event: 'fatal',
    reason: 'startup_failed',
    detail: errorDetail(error),
  });
  process.exit(1);
}
out({
  event: 'ready',
  url: server.url,
  stateBackend: storeRuntime.config.backend,
  ...(storeRuntime.config.backend === 'file'
    ? { dataDir: storeRuntime.config.dataDir, publicationsDir, killsDir }
    : {}),
  takedowns: trustedKillAuthorityDeviceId ? 'enabled' : 'disabled',
  metrics: metricsListener
    ? `listening on ${metricsListener.host}:${metricsListener.port}`
    : 'disabled',
});
