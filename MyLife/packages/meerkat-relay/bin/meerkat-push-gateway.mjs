#!/usr/bin/env node
/**
 * Meerkat PUSH GATEWAY SERVICE (Plan 42 P4) -- the deployable that turns an opaque,
 * end-to-end-encrypted wake capability into a real APNs / FCM / Web Push wake. It drives
 * the Phase 1/44 push stores (registration, encrypted provider token, capability,
 * attempt) and the provider adapters through one PushGatewayService, serving the
 * `/v1/push/*` HTTP surface and running the fenced attempt-drain loop.
 *
 * A SEPARATE image over the same codebase (it needs @mylife/sync at runtime for the
 * store graph); NOT the slim ws+zod relay image.
 *
 * FAIL-CLOSED START + HONEST BOOT LOG. The gateway refuses to boot without a usable
 * token-encryption keyring, and it NEVER fabricates a capability: a provider with no
 * mounted credential is honestly absent (its wakes return wake_unavailable), and the
 * ready log names exactly which providers are live.
 *
 *   - MEERKAT_DEPLOYMENT_PROFILE / MEERKAT_STORE_BACKEND: explicit durable-state authority.
 *     Self-host file mode uses DATA_DIR. First-party mode requires PostgreSQL (verify-full
 *     TLS) and never falls back to the filesystem.
 *   - MEERKAT_PUSH_TOKEN_KEYS_DIR (required): directory of <version>.key files (32 raw
 *     bytes or 64 hex chars each). The provider-token envelope cipher keys off this.
 *   - MEERKAT_PUSH_TOKEN_ACTIVE_VERSION (required): the integer key version new tokens
 *     seal under. Rotation adds a higher-numbered key file and bumps this; old tokens keep
 *     decrypting by the version embedded in their envelope. A managed KMS can replace this
 *     cipher behind the same PushTokenCipher interface as founder-ops hardening.
 *   - APNs (optional): MEERKAT_PUSH_APNS_KEY_FILE (mounted .p8), MEERKAT_PUSH_APNS_KEY_ID,
 *     MEERKAT_PUSH_APNS_TEAM_ID, MEERKAT_PUSH_APNS_TOPIC, MEERKAT_PUSH_APNS_BASE_URL.
 *   - FCM (optional): MEERKAT_PUSH_FCM_SERVICE_ACCOUNT_FILE (mounted service-account JSON).
 *   - Web Push (optional): MEERKAT_PUSH_VAPID_PRIVATE_KEY_FILE (mounted PEM),
 *     MEERKAT_PUSH_VAPID_PUBLIC_KEY (base64url), MEERKAT_PUSH_VAPID_SUBJECT (mailto:/https:).
 *   - MEERKAT_ALLOWED_ORIGINS: browser CORS allowlist for the web push client.
 *   - PORT (default 8895) / HOST (default 0.0.0.0) / DATA_DIR (default ./.meerkat-push).
 *   - MEERKAT_METRICS_PORT/HOST: opt-in private Prometheus /metrics (never the public port).
 *
 * Run from source with tsx:
 *
 *   PORT=8895 HOST=0.0.0.0 DATA_DIR=~/.meerkat/push \
 *     MEERKAT_DEPLOYMENT_PROFILE=self-host MEERKAT_STORE_BACKEND=file \
 *     MEERKAT_PUSH_TOKEN_KEYS_DIR=/run/secrets/push-keys \
 *     MEERKAT_PUSH_TOKEN_ACTIVE_VERSION=1 \
 *     MEERKAT_ALLOWED_ORIGINS=https://app.example \
 *     tsx bin/meerkat-push-gateway.mjs
 */

import http from 'node:http';
import { promises as fs } from 'node:fs';
import {
  createMeerkatStoreRuntime,
  resolveMeerkatStoreRuntimeConfig,
  FilePushRegistrationStore,
  FilePushAttemptStore,
  PostgresPushRegistrationStore,
  PostgresPushAttemptStore,
  PushGatewayService,
  loadAesGcmPushTokenCipherFromDir,
  ApnsProviderAdapter,
  FcmProviderAdapter,
  WebPushProviderAdapter,
  createPushGatewayHttpHandler,
  isPushGatewayPath,
  parseCorsAllowedOrigins,
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

const out = (obj) => process.stdout.write(JSON.stringify({ at: new Date().toISOString(), ...redactForLog(obj) }) + '\n');
const errorDetail = (error) => redactErrorDetail(error instanceof Error ? error.message : String(error?.message ?? error));

const port = Number(process.env.PORT ?? 8895);
const host = process.env.HOST ?? '0.0.0.0';
const dataDir = process.env.DATA_DIR ?? './.meerkat-push';
const corsAllowedOrigins = parseCorsAllowedOrigins(process.env.MEERKAT_ALLOWED_ORIGINS);

const keysDir = (process.env.MEERKAT_PUSH_TOKEN_KEYS_DIR ?? '').trim();
const activeVersion = Number(process.env.MEERKAT_PUSH_TOKEN_ACTIVE_VERSION ?? NaN);
if (!keysDir || !Number.isInteger(activeVersion) || activeVersion <= 0) {
  out({
    event: 'fatal',
    reason: 'token_cipher_config_missing',
    detail: 'MEERKAT_PUSH_TOKEN_KEYS_DIR and a positive MEERKAT_PUSH_TOKEN_ACTIVE_VERSION are required (fail closed: no unencryptable tokens).',
  });
  process.exit(1);
}

async function readSecretFile(envName) {
  const filePath = (process.env[envName] ?? '').trim();
  if (!filePath) return null;
  return fs.readFile(filePath, 'utf8');
}

let runtimeConfig;
let storeRuntime;
let cipher;
let server;
let metricsListener = null;
let drainTimer = null;
let shuttingDown = false;
const adapters = {};

async function closeAdapters() {
  await Promise.allSettled(Object.values(adapters).map((adapter) => adapter.close()));
}

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  out({ event: 'shutdown', signal });
  if (drainTimer) clearTimeout(drainTimer);
  let failed = false;
  const closeSafely = async (fn) => {
    try {
      await fn();
    } catch {
      failed = true;
    }
  };
  if (metricsListener) await closeSafely(() => metricsListener.close());
  if (server) await closeSafely(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));
  await closeAdapters();
  if (storeRuntime) await closeSafely(() => storeRuntime.close());
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

// State authority: file self-host OR first-party PostgreSQL (fail closed on partial config).
try {
  runtimeConfig = resolveMeerkatStoreRuntimeConfig({
    service: 'push',
    env: { ...process.env, DATA_DIR: dataDir },
  });
  if (runtimeConfig.backend === 'shadow') {
    throw new Error('The push gateway does not support shadow mode; use file or postgres');
  }
  storeRuntime = await createMeerkatStoreRuntime(runtimeConfig);
} catch (error) {
  out({ event: 'fatal', reason: 'state_authority_unavailable', detail: errorDetail(error) });
  process.exit(1);
}

// Token-encryption keyring. A missing/short/duplicate key is a fatal boot before any listener.
try {
  cipher = await loadAesGcmPushTokenCipherFromDir({ directory: keysDir, activeVersion });
  const readiness = await cipher.readiness();
  if (!readiness.ready) throw new Error('push token cipher is not ready');
} catch (error) {
  try {
    await storeRuntime.close();
  } catch {
    out({ event: 'fatal', reason: 'state_authority_close_failed' });
  }
  out({ event: 'fatal', reason: 'token_cipher_unavailable', detail: errorDetail(error) });
  process.exit(1);
}

try {
  // Compose provider adapters from MOUNTED SECRET files. A provider with no mounted
  // credential is honestly absent; its wakes answer wake_unavailable, stated in ready.
  const apnsKeyPem = await readSecretFile('MEERKAT_PUSH_APNS_KEY_FILE');
  if (apnsKeyPem) {
    adapters.apns = new ApnsProviderAdapter({
      signingKeyPem: apnsKeyPem,
      keyId: (process.env.MEERKAT_PUSH_APNS_KEY_ID ?? '').trim(),
      teamId: (process.env.MEERKAT_PUSH_APNS_TEAM_ID ?? '').trim(),
      topic: (process.env.MEERKAT_PUSH_APNS_TOPIC ?? '').trim(),
      baseUrl: (process.env.MEERKAT_PUSH_APNS_BASE_URL ?? 'https://api.push.apple.com').trim(),
    });
  }
  const fcmServiceAccountJson = await readSecretFile('MEERKAT_PUSH_FCM_SERVICE_ACCOUNT_FILE');
  if (fcmServiceAccountJson) {
    const parsed = JSON.parse(fcmServiceAccountJson);
    adapters.fcm = new FcmProviderAdapter({
      serviceAccount: {
        projectId: String(parsed.project_id ?? ''),
        clientEmail: String(parsed.client_email ?? ''),
        privateKeyPem: String(parsed.private_key ?? ''),
        ...(parsed.token_uri ? { tokenUri: String(parsed.token_uri) } : {}),
      },
    });
  }
  const vapidPrivatePem = await readSecretFile('MEERKAT_PUSH_VAPID_PRIVATE_KEY_FILE');
  if (vapidPrivatePem) {
    adapters.webpush = new WebPushProviderAdapter({
      privateKeyPem: vapidPrivatePem,
      publicKey: (process.env.MEERKAT_PUSH_VAPID_PUBLIC_KEY ?? '').trim(),
      subject: (process.env.MEERKAT_PUSH_VAPID_SUBJECT ?? '').trim(),
    });
  }

  const backend = runtimeConfig.backend;
  let registrations;
  let attempts;
  if (backend === 'file') {
    if (!runtimeConfig.dataDir) throw new Error('File state backend is missing DATA_DIR');
    registrations = new FilePushRegistrationStore(runtimeConfig.dataDir);
    attempts = new FilePushAttemptStore(runtimeConfig.dataDir);
  } else {
    if (!storeRuntime.database) throw new Error('PostgreSQL state backend did not initialize');
    registrations = new PostgresPushRegistrationStore(storeRuntime.database);
    attempts = new PostgresPushAttemptStore(storeRuntime.database);
  }

  // Plan 44 WP-4A observability: static-label attempt counter + bounded queue depth.
  const metricsRegistry = createMetricsRegistry();
  const attemptCounter = metricsRegistry.counter(
    'meerkat_push_attempts_total',
    'Push delivery attempt outcomes by provider and outcome class.',
  );
  metricsRegistry.collect('meerkat_push_attempt_queue', 'Bounded push attempt queue depth by state.', async () => {
    const stats = await attempts.stats(Date.now());
    return [
      { labels: { service: 'push', state: 'queued' }, value: stats.queued },
      { labels: { service: 'push', state: 'leased' }, value: stats.leased },
      { labels: { service: 'push', state: 'retryable' }, value: stats.retryable },
      { labels: { service: 'push', state: 'due' }, value: stats.due },
    ];
  });
  if (backend !== 'file') {
    metricsRegistry.collect('meerkat_postgres_pool_connections', 'PostgreSQL pool connection counts.', () => [
      { labels: { service: 'push', state: 'total' }, value: storeRuntime.pool?.totalCount ?? 0 },
      { labels: { service: 'push', state: 'idle' }, value: storeRuntime.pool?.idleCount ?? 0 },
      { labels: { service: 'push', state: 'waiting' }, value: storeRuntime.pool?.waitingCount ?? 0 },
    ]);
  }

  const gateway = new PushGatewayService({
    registrations,
    attempts,
    cipher,
    adapters,
    observers: {
      onAttemptOutcome: (provider, outcome) => attemptCounter.inc({ provider, outcome }),
      log: (event, detail) => out({ event, ...detail }),
    },
  });

  // /readyz: state authority AND cipher readiness are REQUIRED (a dead cipher cannot seal
  // a new token, so the gateway is not ready to register installs).
  const stateCheck = backend === 'postgres'
    ? { name: 'postgres', required: true, probe: postgresReadyProbe(storeRuntime.pool) }
    : { name: 'data_dir', required: true, probe: dataDirWritableProbe(runtimeConfig.dataDir ?? dataDir) };
  const cipherCheck = {
    name: 'token_cipher',
    required: true,
    probe: async () => {
      const readiness = await cipher.readiness();
      return readiness.ready
        ? { ok: true, detailClass: 'ok' }
        : { ok: false, detailClass: 'unavailable' };
    },
  };
  const healthEndpoints = createHealthEndpoints({ service: 'push', checks: [stateCheck, cipherCheck] });

  const pushHandler = createPushGatewayHttpHandler({
    service: gateway,
    corsAllowedOrigins,
    log: (event, detail) => out({ event, ...detail }),
  });

  server = http.createServer((req, res) => {
    const pathname = (req.url ?? '/').split('?')[0];
    if (healthEndpoints.handle(req, res)) return;
    if (req.method === 'GET' && pathname === '/healthz') {
      const body = JSON.stringify({ ok: true });
      res.writeHead(200, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) });
      res.end(body);
      return;
    }
    if (isPushGatewayPath(pathname)) {
      pushHandler(req, res);
      return;
    }
    res.writeHead(404, { 'Content-Length': '0' });
    res.end();
  });

  await new Promise((resolve, reject) => {
    const onError = (error) => {
      server.off('listening', onListening);
      reject(error);
    };
    const onListening = () => {
      server.off('error', onError);
      resolve();
    };
    server.once('error', onError);
    server.once('listening', onListening);
    server.listen(port, host);
  });

  // Bounded, self-rescheduling drain loop. Each pass claims due attempts under a fenced
  // lease, delivers via the provider adapter, and completes/reschedules/poisons. When a
  // pass moves work it loops promptly; an idle pass backs off.
  const scheduleDrain = (delayMs) => {
    if (shuttingDown) return;
    drainTimer = setTimeout(runDrain, delayMs);
    drainTimer.unref?.();
  };
  const runDrain = async () => {
    if (shuttingDown) return;
    let processed = 0;
    try {
      processed = await gateway.drainOnce();
    } catch (error) {
      out({ event: 'push_drain_error', detail: errorDetail(error) });
    }
    scheduleDrain(processed > 0 ? 50 : 1_000);
  };
  scheduleDrain(250);

  const metricsConfig = resolveMetricsListenerConfig(process.env);
  if (metricsConfig) {
    metricsListener = await startMetricsListener({
      registry: metricsRegistry,
      config: metricsConfig,
      health: healthEndpoints,
      log: (event, detail) => out({ event, ...detail }),
    });
  }

  const address = server.address();
  const readyPort = typeof address === 'object' && address ? address.port : port;
  const readyHost = host === '0.0.0.0' ? '127.0.0.1' : host;
  out({
    event: 'ready',
    url: `http://${readyHost}:${readyPort}`,
    stateBackend: storeRuntime.config.backend,
    ...(storeRuntime.config.dataDir ? { dataDir: storeRuntime.config.dataDir } : {}),
    cipher: `aes-256-gcm keyring (active v${activeVersion}, ${cipher.loadedVersionCount()} loaded)`,
    providers: {
      apns: adapters.apns ? 'live' : 'OFF (set MEERKAT_PUSH_APNS_KEY_FILE)',
      fcm: adapters.fcm ? 'live' : 'OFF (set MEERKAT_PUSH_FCM_SERVICE_ACCOUNT_FILE)',
      webpush: adapters.webpush ? 'live' : 'OFF (set MEERKAT_PUSH_VAPID_PRIVATE_KEY_FILE)',
    },
    metrics: metricsListener
      ? `listening on ${metricsListener.host}:${metricsListener.port}`
      : 'disabled',
  });
} catch (error) {
  if (drainTimer) clearTimeout(drainTimer);
  await closeAdapters();
  try {
    await storeRuntime.close();
  } catch {
    out({ event: 'fatal', reason: 'state_authority_close_failed' });
  }
  out({ event: 'fatal', reason: 'startup_failed', detail: errorDetail(error) });
  process.exit(1);
}
