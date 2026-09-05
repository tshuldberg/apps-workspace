#!/usr/bin/env node
/**
 * Meerkat HOSTED BILLING SERVICE (Plan 22 Phase 2, TC-3) -- the runnable server that
 * INSTANTIATES the hosted billing/entitlement API with concrete injection points:
 *   - StripeMeerkatBillingClient  (real Stripe REST over fetch)
 *   - File/PostgreSQL billing store (durable subscriptions + app purchases + link codes)
 *   - createDeviceSignedAuthorizer (Ed25519 device-signed bearer -> subject)
 *   - HostedNodeService           (real per-subject server-space usage meter)
 *
 * It composes the hosted-api handler (checkout/portal/webhook/entitlements/usage +
 * the one-time app-unlock rail + cross-rail Link) and a bounded GET /healthz. Like
 * the community node and verification service, this is a SEPARATE deployable over the
 * same codebase (needs @mylife/sync + a DATA_DIR byte-storage volume); it is NOT the slim
 * ws+zod-only relay image.
 *
 * FAIL-CLOSED START. It refuses to boot unless it can actually take money and issue
 * real entitlements: ENTITLEMENT_SECRET, WEBHOOK_SECRET, STRIPE_SECRET_KEY,
 * STRIPE_MONTHLY_PRICE_ID, and STRIPE_APP_UNLOCK_PRICE_ID are all required. Store
 * receipt validation for cross-rail linking is fail-closed until Apple/Google
 * credentials are provisioned (founder-ops); it never fakes an unlock.
 *
 *   PORT=8893 HOST=0.0.0.0 DATA_DIR=~/.meerkat/hosted \
 *     MEERKAT_DEPLOYMENT_PROFILE=self-host MEERKAT_STORE_BACKEND=file \
 *     ENTITLEMENT_SECRET=<secret> WEBHOOK_SECRET=<whsec> \
 *     STRIPE_SECRET_KEY=<sk_...> STRIPE_MONTHLY_PRICE_ID=<price_...> \
 *     STRIPE_APP_UNLOCK_PRICE_ID=<price_...> \
 *     tsx bin/meerkat-hosted-service.mjs
 */

import http from 'node:http';
import path from 'node:path';
import { createHash } from 'node:crypto';
import {
  HostedNodeService,
  FileSeederPieceStore,
  createMeerkatHostedApiHandler,
  createDeviceSignedAuthorizer,
  StripeMeerkatBillingClient,
  FileMeerkatBillingStore,
  PostgresMeerkatBillingStore,
  createMeerkatStoreRuntime,
  resolveMeerkatStoreRuntimeConfig,
  createRevenueCatStoreReceiptValidator,
  parseCorsAllowedOrigins,
  HostedRequestLimiter,
  createHostedStorageApiHandler,
  createStorageCapabilityHttpHandler,
  createStorageIngestHandler,
  isHostedStorageApiPath,
  isStorageCapabilityPath,
  loadStorageOperatorKeyFromFile,
  StorageDescriptorService,
  FileStorageIngestStore,
  ObjectStoreStorageIngestStore,
  PostgresHostedStorageMetadataStore,
  PostgresOAuthBrokerStore,
  PostgresObjectDeletionJobStore,
  FileOAuthBrokerStore,
  createFetchOAuthProviderTransport,
  createOAuthBrokerHandler,
  deleteOAuthBrokerAccountAudited,
  isOAuthBrokerApiPath,
  loadMountedSecretKmsFromFile,
  loadOAuthProviderRegistryFromEnv,
  createS3ObjectStoreFromRuntimeConfig,
  storageCapMbForTier,
  redactForLog,
  redactErrorDetail,
  createHealthEndpoints,
  createMetricsRegistry,
  resolveMetricsListenerConfig,
  startMetricsListener,
  postgresReadyProbe,
  objectStoreReadyProbe,
  dataDirWritableProbe,
} from '../src/index.ts';
import { installOrphanWatchdog } from '../src/orphan-watchdog.ts';

// Every log event is deep-redacted before it reaches stdout (Plan 44 WP-4B): a
// denylisted key, a connection string with a password, a Stripe/RevenueCat api
// key, or a bearer blob is scrubbed while counts, ids, and urls pass through.
// errorDetail() additionally scrubs the free-form error string on the fatal paths.
const out = (obj) => process.stdout.write(JSON.stringify({ at: new Date().toISOString(), ...redactForLog(obj) }) + '\n');
const errorDetail = (error) => redactErrorDetail(String(error?.message ?? error));

const port = Number(process.env.PORT ?? 8893);
const host = process.env.HOST ?? '0.0.0.0';
const dataDir = process.env.DATA_DIR ?? './.meerkat-hosted';

const REQUIRED = [
  'ENTITLEMENT_SECRET',
  'WEBHOOK_SECRET',
  'STRIPE_SECRET_KEY',
  'STRIPE_MONTHLY_PRICE_ID',
  'STRIPE_APP_UNLOCK_PRICE_ID',
  'REVENUECAT_REST_API_KEY',
  'MEERKAT_ALLOWED_ORIGINS',
];
const missing = REQUIRED.filter((key) => !process.env[key]?.trim());
if (missing.length > 0) {
  out({
    event: 'fatal',
    reason: 'missing_env',
    detail: `Set ${missing.join(', ')} so the service can take real payments and issue real entitlements (fail closed).`,
  });
  process.exit(1);
}
const corsAllowedOrigins = parseCorsAllowedOrigins(process.env.MEERKAT_ALLOWED_ORIGINS);
if (corsAllowedOrigins.length === 0) {
  out({ event: 'fatal', reason: 'allowed_origins_invalid' });
  process.exit(1);
}

let runtimeConfig;
let storeRuntime;
let store;
let objectStore;
let server;
let storageApiHandler = null;
let storageCapabilityHandler = null;
let storageDescriptor = null;
let oauthBrokerHandler = null;
let oauthBrokerOptions = null;
let oauthBrokerState = 'unavailable';
let metricsListener = null;
let shuttingDown = false;

async function closeServer() {
  if (!server?.listening) return;
  await new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
}

async function closeRuntimeResources() {
  return Promise.allSettled([
    closeServer(),
    metricsListener?.close() ?? Promise.resolve(),
    storeRuntime?.close() ?? Promise.resolve(),
    // Release the S3 client's sockets on shutdown/fatal, mirroring the pool close. File mode
    // never constructs one, so this is a no-op there.
    Promise.resolve().then(() => objectStore?.destroy()),
  ]);
}

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  out({ event: 'shutdown', signal });
  const results = await closeRuntimeResources();
  if (results.some((result) => result.status === 'rejected')) {
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
    service: 'hosted',
    env: { ...process.env, DATA_DIR: dataDir },
    // The hosted service owns a byte path, so it opts into the typed object-store block. This is
    // what makes first-party mode fail closed (before any server opens) if s3 is not fully
    // configured, and what keeps self-host on the file byte path.
    requireObjectStore: true,
  });
  storeRuntime = await createMeerkatStoreRuntime(runtimeConfig);
  if (runtimeConfig.backend === 'file') {
    if (!runtimeConfig.dataDir) throw new Error('File state backend is missing DATA_DIR');
    store = new FileMeerkatBillingStore(runtimeConfig.dataDir);
  } else {
    if (!storeRuntime.database) throw new Error('PostgreSQL state backend did not initialize');
    store = new PostgresMeerkatBillingStore(storeRuntime.database);
  }
  // First-party mode composes the REAL object store for the hosted byte path: bytes land on the
  // MeerkatObjectStore (S3 in production) instead of a local file volume. The runtime config
  // already failed closed above if s3 was selected but incomplete; here we read the mounted
  // credential secret files and build the client. Self-host keeps the file byte path (backend
  // 'file' => no object store constructed).
  if (runtimeConfig.objectStore?.backend === 's3') {
    objectStore = await createS3ObjectStoreFromRuntimeConfig(runtimeConfig.objectStore, {
      productionMode: runtimeConfig.productionMode,
    });
  }
} catch (error) {
  if (storeRuntime) {
    const results = await closeRuntimeResources();
    if (results.some((result) => result.status === 'rejected')) {
      out({ event: 'fatal', reason: 'state_authority_close_failed' });
    }
  }
  out({
    event: 'fatal',
    reason: 'state_authority_unavailable',
    detail: errorDetail(error),
  });
  process.exit(1);
}

try {
const billing = new StripeMeerkatBillingClient({
  secretKey: process.env.STRIPE_SECRET_KEY,
  monthlyPriceId: process.env.STRIPE_MONTHLY_PRICE_ID,
  appUnlockPriceId: process.env.STRIPE_APP_UNLOCK_PRICE_ID,
  // The billing portal needs the subject's Stripe customer id from the real row.
  getCustomerId: async (subjectId) => (await store.getSubscription(subjectId))?.customerId ?? null,
});

// Real per-subject server-space usage. Each tenant gets an isolated opaque
// FileSeederPieceStore under the DATA_DIR volume; an unprovisioned subject yields
// null => the meter honestly shows "Not connected", never a fabricated 0 of N.
//
// BYTE PATH: in first-party mode the tenant's ingest bytes land on the composed object store
// (S3) under a tenant-unique key prefix; the file piece store stays only as the server-space
// usage meter's substrate. In self-host file mode the ingest bytes ARE the file piece store,
// exactly as before. The selection is by whether an object store was composed, nothing else.
const tenantCapBytes = storageCapMbForTier('starter') * 1024 * 1024;
const ingestStores = new Map();
const hostedNodes = new HostedNodeService({
  makePieceStore: (tenantId) => {
    const tenantDir = path.join(dataDir, 'tenants', tenantId);
    const pieces = new FileSeederPieceStore(tenantDir);
    ingestStores.set(tenantId, objectStore
      ? new ObjectStoreStorageIngestStore({
          store: objectStore,
          capBytes: tenantCapBytes,
          keyPrefix: `tenants/${tenantId}`,
        })
      : new FileStorageIngestStore(tenantDir, pieces, tenantCapBytes));
    return pieces;
  },
});
const authorize = createDeviceSignedAuthorizer();
const requestLimiter = new HostedRequestLimiter({
  trustedProxyHops: Number(process.env.MEERKAT_TRUST_PROXY_HOPS ?? 0),
});
const storageOperatorKeyFile = (process.env.MEERKAT_STORAGE_OPERATOR_KEY_FILE ?? '').trim();
const storagePublicEndpoint = (process.env.MEERKAT_STORAGE_PUBLIC_ENDPOINT ?? '').trim();
if (Boolean(storageOperatorKeyFile) !== Boolean(storagePublicEndpoint)) {
  throw new Error('MEERKAT_STORAGE_OPERATOR_KEY_FILE and MEERKAT_STORAGE_PUBLIC_ENDPOINT must be configured together');
}
if (storageOperatorKeyFile && storagePublicEndpoint) {
  const operator = await loadStorageOperatorKeyFromFile(storageOperatorKeyFile);
  storageDescriptor = new StorageDescriptorService({
    endpoint: storagePublicEndpoint,
    operatorPrivateKeyHex: operator.operatorPrivateKeyHex,
    maximumObjectBytes: tenantCapBytes,
    quotaBytes: tenantCapBytes,
    retention: 'rolling30',
    ...(process.env.MEERKAT_STORAGE_DESCRIPTOR_TTL_MS
      ? { descriptorTtlMs: Number(process.env.MEERKAT_STORAGE_DESCRIPTOR_TTL_MS) }
      : {}),
    ...(process.env.MEERKAT_STORAGE_CHALLENGE_TTL_MS
      ? { challengeTtlMs: Number(process.env.MEERKAT_STORAGE_CHALLENGE_TTL_MS) }
      : {}),
  });
  storageCapabilityHandler = createStorageCapabilityHttpHandler({
    service: storageDescriptor,
    corsAllowedOrigins,
    requestLimiter,
    log: (event, detail) => out({ event, ...detail }),
  });
}
const storageMetadata = storeRuntime.database
  ? new PostgresHostedStorageMetadataStore(storeRuntime.database)
  : null;
const storageDeletionJobs = storeRuntime.database
  ? new PostgresObjectDeletionJobStore(storeRuntime.database)
  : null;
const oauthStore = storeRuntime.database
  ? new PostgresOAuthBrokerStore(storeRuntime.database)
  : new FileOAuthBrokerStore();
const oauthProviders = await loadOAuthProviderRegistryFromEnv();
const oauthKmsFile = (process.env.MEERKAT_OAUTH_KMS_KEY_FILE ?? '').trim();
const oauthKms = oauthKmsFile
  ? await loadMountedSecretKmsFromFile(oauthKmsFile)
  : undefined;
oauthBrokerOptions = {
  store: oauthStore,
  providers: oauthProviders,
  kms: oauthKms,
  providerTransport: createFetchOAuthProviderTransport(),
  authorize,
  corsAllowedOrigins,
  requestLimiter,
  log: (event, detail) => out({ event, ...detail }),
};
oauthBrokerHandler = createOAuthBrokerHandler(oauthBrokerOptions);
const configuredOAuthProviders = oauthProviders.ids();
oauthBrokerState = !oauthStore.available || !oauthKms
  ? 'unavailable'
  : configuredOAuthProviders.length === 0
    ? 'provider_not_configured'
    : `configured:${configuredOAuthProviders.join(',')}`;

const handler = createMeerkatHostedApiHandler({
  entitlementSecret: process.env.ENTITLEMENT_SECRET,
  webhookSecret: process.env.WEBHOOK_SECRET,
  billing,
  store,
  usage: hostedNodes,
  authorize,
  corsAllowedOrigins,
  log: (event, detail) => out({ event, ...detail }),
  requestLimiter,
  // Plan 39 P6: shared HMAC secret for persona-bound app-unlock PROOF tokens
  // (the community node's public submit gate verifies against the same value,
  // its MEERKAT_APP_UNLOCK_TOKEN_SECRET). Unset => the mint route answers 501
  // fail-closed and public posting stays locked; set BOTH to enable it.
  appUnlockTokenSecret: (process.env.MEERKAT_APP_UNLOCK_TOKEN_SECRET ?? '').trim() || undefined,
  appUnlock: {
    billing,
    store,
    // RevenueCat already validates StoreKit and Play receipts for the native SDK.
    // The server re-reads that provider record and ties its app user id to the
    // device-signed hosted subject before minting a cross-rail link code.
    receiptValidator: createRevenueCatStoreReceiptValidator({
      apiKey: process.env.REVENUECAT_REST_API_KEY,
    }),
  },
});

const resolveStorageStore = async (subjectId) => {
  const subscription = await store.getSubscription(subjectId);
  const active = subscription
    && (subscription.status === 'active' || subscription.status === 'trialing')
    && (!subscription.currentPeriodEnd || Date.parse(subscription.currentPeriodEnd) > Date.now());
  if (!active) return null;
  if (!hostedNodes.hasTenant(subjectId)) {
    hostedNodes.provisionForTier({ subjectId, tier: 'starter', retentionTier: 'rolling30' });
  }
  return ingestStores.get(subjectId) ?? null;
};

const resolveDeletionStore = async (subjectId) => {
  const tenant = await storageMetadata?.getTenant(subjectId);
  if (!tenant) return null;
  const existing = ingestStores.get(subjectId);
  if (existing) return existing;
  const tenantDir = path.join(dataDir, 'tenants', subjectId);
  const deletionStore = objectStore
    ? new ObjectStoreStorageIngestStore({
        store: objectStore,
        capBytes: tenantCapBytes,
        keyPrefix: `tenants/${subjectId}`,
      })
    : new FileStorageIngestStore(
        tenantDir,
        new FileSeederPieceStore(tenantDir),
        tenantCapBytes,
      );
  ingestStores.set(subjectId, deletionStore);
  return deletionStore;
};

const legacyStorageHandler = createStorageIngestHandler({
  entitlementSecret: process.env.ENTITLEMENT_SECRET,
  authorize,
  corsAllowedOrigins,
  requestLimiter,
  log: (event, detail) => out({ event, ...detail }),
  hash: async (bytes) => createHash('sha256').update(bytes).digest('hex'),
  resolveStore: resolveStorageStore,
});

storageApiHandler = storageMetadata
  ? createHostedStorageApiHandler({
      entitlementSecret: process.env.ENTITLEMENT_SECRET,
      authorize,
      resolveStore: resolveStorageStore,
      resolveDeletionStore,
      provisionTenant: async (subjectId) => {
        const storage = await resolveStorageStore(subjectId);
        if (!storage) return false;
        const result = await storageMetadata.provisionTenant({
          subjectId,
          capBytes: storage.capBytes(),
          policy: {
            policyVersion: 1,
            maxObjectBytes: storage.capBytes(),
            maxObjectCount: 100_000,
            maxConcurrentReservations: 64,
            reservationTtlSeconds: 3_600,
            retentionDays: 30,
          },
        });
        return result.status === 'created'
          || result.status === 'updated'
          || result.status === 'replayed';
      },
      metadata: storageMetadata,
      deletionJobs: storageDeletionJobs ?? undefined,
      deleteOAuthAccount: oauthStore.available
        ? (subjectId) => deleteOAuthBrokerAccountAudited(subjectId, oauthBrokerOptions)
        : undefined,
      corsAllowedOrigins,
      requestLimiter,
      storageDescriptor: storageDescriptor ?? undefined,
      log: (event, detail) => out({ event, ...detail }),
      hash: async (bytes) => createHash('sha256').update(bytes).digest('hex'),
    })
  : null;

// Plan 44 WP-4A observability. /readyz honestly probes this service's state
// authority AND, in first-party mode, the object byte store (the hosted byte path
// depends on it). File mode requires a writable data dir. Metrics export pool depth
// and whether the S3 byte store is composed.
const hostedBackend = runtimeConfig.backend;
const metricsRegistry = createMetricsRegistry();
if (hostedBackend !== 'file') {
  metricsRegistry.collect('meerkat_postgres_pool_connections', 'PostgreSQL pool connection counts.', () => [
    { labels: { service: 'hosted', state: 'total' }, value: storeRuntime.pool?.totalCount ?? 0 },
    { labels: { service: 'hosted', state: 'idle' }, value: storeRuntime.pool?.idleCount ?? 0 },
    { labels: { service: 'hosted', state: 'waiting' }, value: storeRuntime.pool?.waitingCount ?? 0 },
  ]);
}
metricsRegistry.collect('meerkat_object_store_composed', 'Whether the S3 byte store is composed (1) or file byte path (0).', () => [
  { labels: { service: 'hosted' }, value: objectStore ? 1 : 0 },
]);
const hostedChecks = [
  hostedBackend === 'file'
    ? { name: 'data_dir', required: true, probe: dataDirWritableProbe(runtimeConfig.dataDir ?? dataDir) }
    : { name: 'postgres', required: true, probe: postgresReadyProbe(storeRuntime.pool) },
];
if (objectStore) {
  hostedChecks.push({ name: 'object_store', required: true, probe: objectStoreReadyProbe(objectStore) });
}
const healthEndpoints = createHealthEndpoints({ service: 'hosted', checks: hostedChecks });

server = http.createServer((req, res) => {
  const pathname = (req.url ?? '/').split('?')[0];
  // Plan 44 WP-4A infra liveness/readiness (before the bounded /healthz + routing).
  if (healthEndpoints.handle(req, res)) return;
  // Bounded liveness only; never expose billing state on healthz.
  if (req.method === 'GET' && pathname === '/healthz') {
    const body = JSON.stringify({ ok: true });
    res.writeHead(200, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) });
    res.end(body);
    return;
  }
  if (oauthBrokerHandler && isOAuthBrokerApiPath(pathname)) {
    oauthBrokerHandler(req, res);
    return;
  }
  if (storageCapabilityHandler && isStorageCapabilityPath(pathname)) {
    storageCapabilityHandler(req, res);
    return;
  }
  if (storageApiHandler && isHostedStorageApiPath(pathname)) {
    storageApiHandler(req, res);
    return;
  }
  if (pathname === '/api/storage/upload') {
    legacyStorageHandler(req, res);
    return;
  }
  if (pathname.startsWith('/api/storage/v')) {
    const requestedVersion = /^\/api\/storage\/(v[^/]+)(?:\/|$)/u.exec(pathname)?.[1];
    const unsupported = requestedVersion && requestedVersion !== 'v1';
    const body = JSON.stringify(unsupported
      ? {
          error: 'unsupported_storage_api_version',
          requestedVersion,
          supportedVersions: ['v1'],
        }
      : { error: 'storage_metadata_unavailable' });
    res.writeHead(unsupported ? 404 : 503, {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
    });
    res.end(body);
    return;
  }
  handler(req, res);
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
  const results = await closeRuntimeResources();
  if (results.some((result) => result.status === 'rejected')) {
    out({ event: 'fatal', reason: 'state_authority_close_failed' });
  }
  out({
    event: 'fatal',
    reason: 'startup_failed',
    detail: errorDetail(error),
  });
  process.exit(1);
}

const address = server.address();
const readyPort = typeof address === 'object' && address ? address.port : port;
const readyHost = host === '0.0.0.0' ? '127.0.0.1' : host;
server.on('error', (error) => {
  out({ event: 'fatal', reason: 'runtime_failed', detail: errorDetail(error) });
  void shutdown('server_error');
});
out({
  event: 'ready',
  url: `http://${readyHost}:${readyPort}`,
  stateBackend: storeRuntime.config.backend,
  billingStateBackend: storeRuntime.config.backend,
  byteStorageBackend: objectStore ? 's3' : 'file',
  storageApi: storageApiHandler ? 'v1' : 'legacy-only',
  storageDescriptor: storageDescriptor ? 'storage:v1' : 'not_configured',
  oauthBroker: oauthBrokerState,
  dataDir,
  receiptValidation: 'revenuecat',
  metrics: metricsListener
    ? `listening on ${metricsListener.host}:${metricsListener.port}`
    : 'disabled',
});
