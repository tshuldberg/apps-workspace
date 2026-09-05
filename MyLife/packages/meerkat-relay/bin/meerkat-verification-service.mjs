#!/usr/bin/env node
/**
 * Meerkat HUMANITY VERIFICATION SERVICE (Plan 24, P1) -- the anonymous anti-bot token
 * issuer. A FOURTH deployable image over the SAME codebase as the slim relay, the
 * community node, and the public directory node. It runs the three-verb HTTP surface
 * (POST /humanity/challenge|issue|redeem + GET /healthz) and needs @mylife/sync at
 * runtime (Ed25519 token signing/verifying) plus a DATA_DIR volume for the DURABLE
 * spent-token set, so it is NOT built by the slim ws+zod-only relay image.
 *
 * FAIL-CLOSED START. The service refuses to boot unless it can actually verify humans:
 *   - HUMANITY_SIGNING_KEY (32-byte Ed25519 seed, 64 hex) is required.
 *   - At least one production-safe verifier must be configured. Turnstile (web + Expo Go
 *     + attestation-unavailable devices) needs only TURNSTILE_SECRET and is wired here.
 *     App Attest (iOS) + Play Integrity (Android) need founder-ops credentials (a vetted
 *     App Attest crypto verifier / a Google service-account token flow); wire them into
 *     this same service when provisioned. productionMode=true refuses any stub/non-safe
 *     verifier, mirroring how a Simulated* transport backend is barred from a live rung.
 *
 * Run from source with tsx (the monorepo resolves the TS entry):
 *
 *   PORT=8892 HOST=0.0.0.0 DATA_DIR=~/.meerkat/humanity \
 *     HUMANITY_SIGNING_KEY=<64-hex-seed> TURNSTILE_SECRET=<cf-secret> \
 *     tsx bin/meerkat-verification-service.mjs
 *
 * Durability: FileHumanityStore(DATA_DIR/spent) keeps spent tokens across restarts (the
 * one security-critical property, AC-2); challenges + issuance counts are in-memory.
 * The env caps (HUMANITY_*) are clamped by resolveHumanityLimits. Region deploy
 * (NAT/TLS at the edge, the always-on soak) is founder ops.
 */

import {
  HumanityService,
  FileHumanityStore,
  PostgresHumanityStore,
  createMeerkatStoreRuntime,
  resolveMeerkatStoreRuntimeConfig,
  TurnstileVerifier,
  startHumanityService,
  humanityServiceKeypairFromEnv,
  resolveHumanityLimits,
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

const port = Number(process.env.PORT ?? 8892);
const host = process.env.HOST ?? '0.0.0.0';
const dataDir = process.env.DATA_DIR ?? './.meerkat-humanity';

// Signing keypair is required; without it the service cannot mint or verify tokens.
let signingKeypair;
try {
  signingKeypair = humanityServiceKeypairFromEnv(process.env);
} catch (error) {
  out({ event: 'fatal', reason: 'missing_signing_key', detail: errorDetail(error) });
  process.exit(1);
}

// Register only FULLY-configured, production-safe verifiers. Refuse to start with none:
// a verification service that can verify nobody would be a fake capability.
const verifiers = [];
if (process.env.TURNSTILE_SECRET) {
  verifiers.push(new TurnstileVerifier({ secret: process.env.TURNSTILE_SECRET }));
}
if (verifiers.length === 0) {
  out({
    event: 'fatal',
    reason: 'no_verifier_configured',
    detail: 'Set TURNSTILE_SECRET (and/or provision App Attest / Play Integrity) so the service can actually verify humans.',
  });
  process.exit(1);
}

const limits = resolveHumanityLimits(process.env);
let storeRuntime;
let store;
try {
  const runtimeConfig = resolveMeerkatStoreRuntimeConfig({
    service: 'humanity',
    env: { ...process.env, DATA_DIR: dataDir },
  });
  storeRuntime = await createMeerkatStoreRuntime(runtimeConfig);
  if (runtimeConfig.backend === 'file') {
    if (!runtimeConfig.dataDir) throw new Error('File state backend is missing DATA_DIR');
    store = new FileHumanityStore(runtimeConfig.dataDir);
  } else {
    if (!storeRuntime.database) throw new Error('PostgreSQL state backend did not initialize');
    store = new PostgresHumanityStore(storeRuntime.database);
  }
} catch (error) {
  out({
    event: 'fatal',
    reason: 'state_authority_unavailable',
    detail: errorDetail(error),
  });
  process.exit(1);
}

let service;
try {
  service = new HumanityService({ signingKeypair, verifiers, store, limits, productionMode: true });
} catch (error) {
  // A non-production-safe verifier (or misconfiguration) is refused in productionMode.
  out({ event: 'fatal', reason: 'verifier_rejected', detail: errorDetail(error) });
  process.exit(1);
}

// Plan 44 WP-4A observability. /readyz honestly probes the ONE state authority this
// service depends on: a live PostgreSQL pool (postgres mode) or a writable DATA_DIR
// (file mode). Metrics export the bounded spent/issuance/challenge counts.
const backend = storeRuntime.config.backend;
const readinessChecks = backend === 'postgres'
  ? [{ name: 'postgres', required: true, probe: postgresReadyProbe(storeRuntime.pool) }]
  : [{ name: 'data_dir', required: true, probe: dataDirWritableProbe(storeRuntime.config.dataDir ?? dataDir) }];
const healthEndpoints = createHealthEndpoints({ service: 'humanity', checks: readinessChecks });

const metricsRegistry = createMetricsRegistry();
// Bounded, non-identifying spent/issuance/challenge counts (the same figures /healthz
// already returns). Static `service` label only; no token, IP, or identity.
metricsRegistry.collect('meerkat_humanity_store', 'Bounded humanity store counts by kind.', async () => {
  const s = await service.stats();
  return [
    { labels: { service: 'humanity', kind: 'spent' }, value: s.spent },
    { labels: { service: 'humanity', kind: 'issuance_keys' }, value: s.issuanceKeys },
    { labels: { service: 'humanity', kind: 'challenges' }, value: s.challenges },
  ];
});
if (backend === 'postgres') {
  metricsRegistry.collect('meerkat_postgres_pool_connections', 'PostgreSQL pool connection counts.', () => [
    { labels: { service: 'humanity', state: 'total' }, value: storeRuntime.pool?.totalCount ?? 0 },
    { labels: { service: 'humanity', state: 'idle' }, value: storeRuntime.pool?.idleCount ?? 0 },
    { labels: { service: 'humanity', state: 'waiting' }, value: storeRuntime.pool?.waitingCount ?? 0 },
  ]);
}

const server = await startHumanityService({
  service,
  port,
  host,
  healthEndpoints,
  trustedProxyHops: Number(process.env.MEERKAT_TRUST_PROXY_HOPS ?? 0),
  log: (event, detail) => out({ event, ...detail }),
});

// Opt-in private metrics listener (127.0.0.1 by default; NEVER the public port).
// Absent MEERKAT_METRICS_PORT => no listener at all, stated in the ready log.
let metricsListener = null;
const metricsConfig = resolveMetricsListenerConfig(process.env);
if (metricsConfig) {
  metricsListener = await startMetricsListener({
    registry: metricsRegistry,
    config: metricsConfig,
    health: healthEndpoints,
    log: (event, detail) => out({ event, ...detail }),
  });
}

out({
  event: 'ready',
  url: server.url,
  stateBackend: storeRuntime.config.backend,
  ...(storeRuntime.config.dataDir ? { dataDir: storeRuntime.config.dataDir } : {}),
  // Clients PIN this public key to verify tokens locally (owner-drain public-join, etc.).
  publicKey: service.publicKeyHex,
  verifiers: verifiers.map((v) => v.kind),
  metrics: metricsListener
    ? `listening on ${metricsListener.host}:${metricsListener.port}`
    : 'disabled',
});

let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  out({ event: 'shutdown', signal });
  try {
    if (metricsListener) await metricsListener.close();
    await server.close();
    await storeRuntime.close();
    process.exit(0);
  } catch (error) {
    out({ event: 'fatal', reason: 'shutdown_failed', detail: errorDetail(error) });
    process.exit(1);
  }
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
