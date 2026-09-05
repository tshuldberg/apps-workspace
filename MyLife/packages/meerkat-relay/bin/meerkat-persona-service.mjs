#!/usr/bin/env node
/**
 * Meerkat PUBLIC-TIER PERSONA REGISTRY + ACCOUNTS SERVICE (Plan 39, P2/P3; operator admin
 * routes P12). The deployable that turns a humanity-verified public persona into a registered
 * alias account, issues short-lived session bearers, runs GDPR delete/export, and (when
 * MEERKAT_PERSONA_ADMIN_SECRET is set) serves the operator suspend/unsuspend/status admin
 * routes the moderation console calls. A SEPARATE image over the same codebase (it needs
 * @mylife/sync at runtime + a DATA_DIR volume for the durable pf_personas store), NOT the slim
 * ws+zod relay image.
 *
 * FAIL-CLOSED START + HONEST BOOT LOG. The service refuses to boot without a session secret,
 * and it NEVER fabricates a capability: if the humanity service is not wired, registration and
 * session issuance are honestly OFF (the routes return machine-readable not-configured codes),
 * and the ready log says so plainly.
 *
 *   - MEERKAT_PERSONA_SESSION_SECRET (required): HMAC secret that signs + verifies session
 *     bearers. Without it the service cannot mint/verify a session, so it refuses to boot.
 *   - HUMANITY_VERIFY_URL: the humanity verification service BASE url. This service POSTs
 *     registration sends { token, attemptId, requestDigest } and session issuance sends
 *     { token } to `${HUMANITY_VERIFY_URL}/humanity/redeem`. Wired into BOTH gates
 *     (Plan 39 P7: issuing a session spends one token). Unset => registration + issuance are
 *     OFF (500 humanity_not_configured); resolve + GDPR still serve.
 *   - HUMANITY_SERVICE_PUBLIC_KEY (64 hex): the pinned humanity service public key. The
 *     session-issuance guard verifies a token's signature LOCALLY against this key before
 *     spending it. Unset => session issuance stays OFF even if HUMANITY_VERIFY_URL is set.
 *   - MEERKAT_HUMANITY_ALLOW_INSECURE_HTTP: explicit `1` only for a trusted private
 *     service network. Public humanity endpoints must use HTTPS.
 *   - MEERKAT_PERSONA_ADMIN_SECRET: operator admin bearer for /persona/admin/* (P12). Unset =>
 *     those routes answer 503 admin_not_configured (fail closed).
 *   - MEERKAT_PERSONA_SESSION_TTL_MS: optional session lifetime override (clamped [60s, 24h]).
 *   - MEERKAT_DEPLOYMENT_PROFILE / MEERKAT_STORE_BACKEND: explicit durable-state authority.
 *     Self-host file mode uses DATA_DIR plus the community/hosted directories below. First-party
 *     mode requires PostgreSQL with verify-full TLS and never falls back to filesystem state.
 *     MEERKAT_STORE_BACKEND=shadow is the migration-window comparator (Plan 44 WP-3B): file is
 *     the PRIMARY authority (serves traffic) and PostgreSQL is the SHADOW (mirrored + deep-
 *     compared, emitting 'shadow_divergence' events, NEVER affecting behavior). It requires
 *     BOTH the file dirs AND full PostgreSQL config, and is forbidden in first-party mode.
 *   - PORT (default 8894) / HOST (default 0.0.0.0) / DATA_DIR (default ./.meerkat-persona).
 *     (8890 community node, 8892 humanity, 8893 hosted, 8894 persona -- all distinct locally.)
 *
 * The community node's SESSION_VERIFY_URL should point at THIS service's BASE url
 * (e.g. https://accounts.example): its verify client appends the absolute route and
 * POSTs {token} to {SESSION_VERIFY_URL}/persona/session/verify. (A trailing /persona
 * on that env is tolerated by the community node, but the base form is canonical.)
 *
 * Run from source with tsx (the monorepo resolves the TS entry):
 *
 *   PORT=8894 HOST=0.0.0.0 DATA_DIR=~/.meerkat/persona \
 *     MEERKAT_PERSONA_SESSION_SECRET=<hmac-secret> \
 *     HUMANITY_VERIFY_URL=https://humanity.example \
 *     HUMANITY_SERVICE_PUBLIC_KEY=<64-hex-pinned-key> \
 *     tsx bin/meerkat-persona-service.mjs
 *
 * Durability: self-host mode uses the complete file-backed persona, community, hosted, and
 * moderation path. First-party mode uses one verified PostgreSQL runtime for all of those
 * authorities. Region deploy (NAT/TLS at the edge, the always-on soak) is founder ops.
 */

import path from 'node:path';
import { publicPostNodeKeypairFromSeed } from '@mylife/sync';
import {
  PersonaRegistryService,
  FilePersonaRegistryStore,
  PostgresPersonaRegistryStore,
  startPersonaService,
  createHumanityRouteGuard,
  createHumanityRedeemClient,
  createMeerkatStoreRuntime,
  resolveMeerkatStoreRuntimeConfig,
  CommunityNode,
  FilePublicationStore,
  FileReportStore,
  FilePublicPostStore,
  PostgresPublicationStore,
  PostgresReportStore,
  PostgresPublicPostStore,
  PostgresKillStore,
  FileMeerkatBillingStore,
  PostgresMeerkatBillingStore,
  FileOperatorConsoleStore,
  OperatorConsoleService,
  GdprDeletionCoordinator,
  personaBindingHash,
  parseCorsAllowedOrigins,
  shadowedStore,
  personaRegistryStoreClassification,
  publicationStoreClassification,
  reportStoreClassification,
  publicPostStoreClassification,
  billingStoreClassification,
  operatorConsoleStoreClassification,
  redactForLog,
  redactErrorDetail,
  createHealthEndpoints,
  createMetricsRegistry,
  resolveMetricsListenerConfig,
  startMetricsListener,
  postgresReadyProbe,
  dataDirWritableProbe,
} from '../src/index.ts';
import { PostgresOperatorConsoleStore } from '../src/postgres/index.ts';
import { installOrphanWatchdog } from '../src/orphan-watchdog.ts';

// Every log event is deep-redacted before it reaches stdout (Plan 44 WP-4B): a
// denylisted key, a connection string with a password, or a bearer blob is
// scrubbed while counts, ids, urls, and public keys pass through. errorDetail()
// additionally scrubs the free-form error string on the fatal paths.
const out = (obj) => process.stdout.write(JSON.stringify({ at: new Date().toISOString(), ...redactForLog(obj) }) + '\n');
const errorDetail = (error) => redactErrorDetail(error instanceof Error ? error.message : String(error?.message ?? error));

const port = Number(process.env.PORT ?? 8894);
const host = process.env.HOST ?? '0.0.0.0';
const dataDir = process.env.DATA_DIR ?? './.meerkat-persona';
const communityDataDir = (process.env.MEERKAT_COMMUNITY_DATA_DIR ?? '').trim();
const hostedDataDir = (process.env.MEERKAT_HOSTED_DATA_DIR ?? '').trim();
const operatorSeed = (process.env.MEERKAT_OPERATOR_AUTHORITY_SEED ?? '').trim();
const corsAllowedOrigins = parseCorsAllowedOrigins(process.env.MEERKAT_ALLOWED_ORIGINS);

// The session secret is required: without it the service can neither mint nor verify a
// session bearer, so it would be a fake capability. Refuse to boot.
const sessionSecret = (process.env.MEERKAT_PERSONA_SESSION_SECRET ?? '').trim();
if (!sessionSecret) {
  out({
    event: 'fatal',
    reason: 'session_secret_missing',
    detail: 'MEERKAT_PERSONA_SESSION_SECRET is required; refusing to start (fail closed: no unverifiable bearers).',
  });
  process.exit(1);
}
if (!/^[0-9a-f]{64}$/iu.test(operatorSeed) || corsAllowedOrigins.length === 0) {
  out({
    event: 'fatal',
    reason: 'gdpr_dependencies_missing',
    detail: 'A 64-hex MEERKAT_OPERATOR_AUTHORITY_SEED and valid MEERKAT_ALLOWED_ORIGINS are required.',
  });
  process.exit(1);
}

const humanityVerifyUrl = (process.env.HUMANITY_VERIFY_URL ?? '').trim().replace(/\/+$/, '') || undefined;
const humanityServicePublicKey = (process.env.HUMANITY_SERVICE_PUBLIC_KEY ?? '').trim() || undefined;

// One redeem client, shared by both gates. Registration includes its deterministic attempt
// envelope for replay after response loss; session issuance keeps the legacy token-only body.
// Any unknown reply or network error is a refusal, never an admit.
let redeemHumanity;
let sessionHumanityGuard;
if (humanityVerifyUrl) {
  try {
    redeemHumanity = createHumanityRedeemClient(humanityVerifyUrl, {
      allowInsecureHttp: process.env.MEERKAT_HUMANITY_ALLOW_INSECURE_HTTP === '1',
    });
  } catch (error) {
    out({
      event: 'fatal',
      reason: 'humanity_verify_url_invalid',
      detail: error instanceof Error ? errorDetail(error) : 'Humanity verify URL is invalid',
    });
    process.exit(1);
  }
  if (humanityServicePublicKey) {
    // The issuance guard verifies the token LOCALLY against the pinned key before the redeem,
    // so a forged/expired token never reaches (or pollutes) the spent store.
    sessionHumanityGuard = createHumanityRouteGuard({
      policy: { required: true, servicePublicKeyHex: humanityServicePublicKey, redeem: redeemHumanity },
      log: (event, detail) => out({ event, ...detail }),
    });
  }
}

const adminSecret = (process.env.MEERKAT_PERSONA_ADMIN_SECRET ?? '').trim() || undefined;
const sessionTtlMs = Number(process.env.MEERKAT_PERSONA_SESSION_TTL_MS ?? NaN);

let runtimeConfig;
let storeRuntime;
let server;
let metricsListener = null;
let shuttingDown = false;

// Plan 44 WP-4A observability registry. A single shadow-divergence counter is
// incremented from the shadow sink below (shadow mode only); it carries a static
// store label class, never an identity or the diverging value.
const metricsRegistry = createMetricsRegistry();
const shadowDivergence = metricsRegistry.counter(
  'meerkat_shadow_events_total',
  'Shadow comparator events by store and kind (shadow mode only).',
);

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
    service: 'persona',
    env: { ...process.env, DATA_DIR: dataDir },
  });
  // File mode and shadow mode both need the file-backed community + hosted roots (shadow's
  // PRIMARY is the file path, so it requires everything file mode requires plus PostgreSQL).
  if (runtimeConfig.backend !== 'postgres' && (!communityDataDir || !hostedDataDir)) {
    throw new Error(
      'File and shadow modes require MEERKAT_COMMUNITY_DATA_DIR and MEERKAT_HOSTED_DATA_DIR',
    );
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
  const operator = publicPostNodeKeypairFromSeed(operatorSeed);
  let store;
  let publicationStore;
  let reportStore;
  let publicPostStore;
  let killStore;
  let billingStore;
  let operatorStore;

  // The file-backed primary set (self-host file mode AND the primary half of shadow mode).
  const buildFileStores = () => {
    if (!communityDataDir || !hostedDataDir) {
      throw new Error('File state backend directories did not initialize');
    }
    const fileDataDir = runtimeConfig.dataDir;
    if (!fileDataDir) throw new Error('File state backend directories did not initialize');
    return {
      store: new FilePersonaRegistryStore(fileDataDir),
      publicationStore: new FilePublicationStore(path.join(communityDataDir, 'publications')),
      reportStore: new FileReportStore(path.join(communityDataDir, 'reports')),
      publicPostStore: new FilePublicPostStore(path.join(communityDataDir, 'public-posts')),
      billingStore: new FileMeerkatBillingStore(hostedDataDir),
      operatorStore: new FileOperatorConsoleStore(path.join(communityDataDir, 'operator-console')),
    };
  };
  // The PostgreSQL set (postgres authority mode AND the shadow half of shadow mode).
  const buildPostgresStores = () => {
    const database = storeRuntime.database;
    if (!database) throw new Error('PostgreSQL state backend did not initialize');
    return {
      store: new PostgresPersonaRegistryStore(database),
      publicationStore: new PostgresPublicationStore(database),
      reportStore: new PostgresReportStore(database),
      publicPostStore: new PostgresPublicPostStore(database),
      killStore: new PostgresKillStore(database),
      billingStore: new PostgresMeerkatBillingStore(database),
      operatorStore: new PostgresOperatorConsoleStore(database),
    };
  };

  if (runtimeConfig.backend === 'file') {
    ({ store, publicationStore, reportStore, publicPostStore, billingStore, operatorStore } = buildFileStores());
  } else if (runtimeConfig.backend === 'postgres') {
    ({ store, publicationStore, reportStore, publicPostStore, killStore, billingStore, operatorStore } = buildPostgresStores());
  } else {
    // SHADOW mode (Plan 44 WP-3B): file is PRIMARY (authoritative, serves traffic),
    // PostgreSQL is SHADOW (mirrored, deep-compared). Every divergence/fault flows to the
    // NDJSON log as a 'shadow_divergence' event; the shadow NEVER affects behavior. killStore
    // has no file-mode counterpart in this bin, so it stays the file-mode value (undefined).
    const primary = buildFileStores();
    const shadow = buildPostgresStores();
    const sink = (event) => {
      // Count by static store name + event kind (agreement/divergence/shadow_fault).
      // The store name is a fixed deployment label, never a tenant/identity value.
      shadowDivergence.inc({ service: 'persona', store: event.store, kind: event.kind });
      out({ event: 'shadow_divergence', ...event });
    };
    const wrap = (name, primaryStore, shadowStore, classification) =>
      shadowedStore(primaryStore, shadowStore, { store: name, classification, sink });
    store = wrap('persona.records', primary.store, shadow.store, personaRegistryStoreClassification);
    publicationStore = wrap('community.publications', primary.publicationStore, shadow.publicationStore, publicationStoreClassification);
    reportStore = wrap('community.reports', primary.reportStore, shadow.reportStore, reportStoreClassification);
    publicPostStore = wrap('community.public-posts', primary.publicPostStore, shadow.publicPostStore, publicPostStoreClassification);
    billingStore = wrap('hosted.billing', primary.billingStore, shadow.billingStore, billingStoreClassification);
    operatorStore = wrap('moderation.operator-console', primary.operatorStore, shadow.operatorStore, operatorConsoleStoreClassification);
  }

  const service = new PersonaRegistryService({
    store,
    sessionSecret,
    redeemHumanity,
    humanityRequired: true, // registration is humanity-gated; no redeem => registration is OFF (500)
    ...(Number.isFinite(sessionTtlMs) ? { sessionTtlMs } : {}),
  });

  // Plan 44 WP-4A: bounded persona counts + (postgres) pool depth. The persona
  // store's own stats() is async; static `service` label only.
  metricsRegistry.collect('meerkat_persona_store', 'Bounded persona store counts by kind.', async () => {
    const s = await service.stats();
    return [
      { labels: { service: 'persona', kind: 'personas' }, value: s.personas },
      { labels: { service: 'persona', kind: 'tombstones' }, value: s.tombstones },
      { labels: { service: 'persona', kind: 'revoked' }, value: s.revoked },
    ];
  });
  const personaBackend = runtimeConfig.backend;
  if (personaBackend !== 'file') {
    metricsRegistry.collect('meerkat_postgres_pool_connections', 'PostgreSQL pool connection counts.', () => [
      { labels: { service: 'persona', state: 'total' }, value: storeRuntime.pool?.totalCount ?? 0 },
      { labels: { service: 'persona', state: 'idle' }, value: storeRuntime.pool?.idleCount ?? 0 },
      { labels: { service: 'persona', state: 'waiting' }, value: storeRuntime.pool?.waitingCount ?? 0 },
    ]);
  }
  // /readyz honestly probes this service's state authority. File and shadow modes
  // BOTH serve from the file path (shadow's primary is file), so the required probe
  // is a writable data dir; pure postgres requires a live pool.
  const personaChecks = personaBackend === 'postgres'
    ? [{ name: 'postgres', required: true, probe: postgresReadyProbe(storeRuntime.pool) }]
    : [{ name: 'data_dir', required: true, probe: dataDirWritableProbe(runtimeConfig.dataDir ?? dataDir) }];
  const healthEndpoints = createHealthEndpoints({ service: 'persona', checks: personaChecks });

  // Full account-rights composition over the same selected authority. PostgreSQL mode
  // deliberately shares one context across persona, community, billing, and moderation.
  const gdprNode = new CommunityNode({
    publicationStore,
    reportStore,
    publicPostStore,
    ...(killStore ? { killStore } : {}),
    trustedKillAuthorityDeviceId: operator.publicKeyHex,
  });
  const consoleService = new OperatorConsoleService({
    node: gdprNode,
    publications: publicationStore,
    reports: reportStore,
    posts: publicPostStore,
    store: operatorStore,
    operator,
  });
  const gdprCoordinator = new GdprDeletionCoordinator({
    registry: service,
    postArchive: gdprNode,
    operator,
    personaBindingHash,
    appUnlock: billingStore,
    consoleTriage: consoleService,
  });

  server = await startPersonaService({
    service,
    gdprCoordinator,
    corsAllowedOrigins,
    port,
    host,
    sessionHumanityGuard,
    sessionHumanityRequired: true, // issuance spends a humanity token; no guard => issuance OFF (500)
    ...(adminSecret ? { adminSecret } : {}),
    healthEndpoints,
    trustedProxyHops: Number(process.env.MEERKAT_TRUST_PROXY_HOPS ?? 0),
    log: (event, detail) => out({ event, ...detail }),
  });

  // Opt-in private metrics listener (127.0.0.1 by default; NEVER the public port).
  // Absent MEERKAT_METRICS_PORT => no listener, stated in the ready log.
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
  ...(storeRuntime.config.dataDir ? { dataDir: storeRuntime.config.dataDir } : {}),
  // Honest capability report: never claim a route works when its dependency is unset.
  registration: humanityVerifyUrl ? 'humanity-gated' : 'OFF (set HUMANITY_VERIFY_URL)',
  sessionIssuance: sessionHumanityGuard
    ? 'humanity-gated'
    : 'OFF (set HUMANITY_VERIFY_URL + HUMANITY_SERVICE_PUBLIC_KEY)',
  admin: adminSecret ? 'configured' : 'not_configured',
  gdpr: 'full',
  metrics: metricsListener
    ? `listening on ${metricsListener.host}:${metricsListener.port}`
    : 'disabled',
});
