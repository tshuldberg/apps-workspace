#!/usr/bin/env node
/**
 * Meerkat MANAGED ARCHIVE SEEDER RECONCILER (Plan 43 WP-43B) -- the always-on deployable that keeps
 * a hosted seeder's SERVING state consistent with durable pin INTENT, propagates takedowns to the
 * serving index + byte reclamation, and refreshes public-directory announcements before they lapse.
 *
 * It runs four bounded loops over the durable substrate, each under a FENCED operations-store lease
 * (single-writer, restart-safe, cursor-resumable):
 *   1. PIN RECONCILE   -- ArchivePinReconciler: an active pin whose bytes are present but unserved is
 *      added to serving; a non-active pin still served is removed; an active pin whose durable bytes
 *      are MISSING surfaces a loud finding and is pulled from serving (never silently served).
 *   2. TAKEDOWN DRAIN  -- ArchiveTakedownPropagator over each takedown_pending job: serving off FIRST,
 *      then release the object reference; a byte another live publication references SURVIVES; a
 *      sole-referenced byte is routed through the WP-2C deletion queue (never deleted inline).
 *   3. ANNOUNCE REFRESH-- planAnnouncements: re-announce only active+serveable pins with a current
 *      descriptor, before TTL, jittered to avoid a fleet refresh storm.
 *   4. QUOTA/RETENTION -- planEviction/admitPin: enforce the node/tenant cap and evict only unpinned,
 *      unreferenced, past-retention objects (honest when over quota).
 *
 * A SEPARATE image over the same codebase (needs @mylife/sync + the object byte path + a fenced
 * operations store); NOT the slim ws+zod relay image. It owns NO public listener -- a pure background
 * worker. It never touches private mesh content: only managed/public archive bytes.
 *
 * FENCED LEASES REQUIRE POSTGRESQL. The operations-store job-lease primitive is Postgres-only, so the
 * reconcile/takedown loops run only in the first-party PostgreSQL profile. Self-host file mode has no
 * fenced multi-writer lease, so this worker refuses to start there (honest: it never fakes a lease).
 *
 *   - MEERKAT_DEPLOYMENT_PROFILE / MEERKAT_STORE_BACKEND: must resolve to PostgreSQL + an s3 object
 *     store; the worker fails closed otherwise (no fenced lease => no safe single-writer reconcile).
 *   - MEERKAT_ARCHIVE_HOST_ID (required): this seeder's stable host id (the pin/serving scope).
 *   - MEERKAT_ARCHIVE_SEEDER_WORKER_ID (default archive-seeder-<pid>): the fenced lease owner id.
 *   - MEERKAT_ARCHIVE_RECONCILE_MAX / _PAGE: bounded scan sizing per tick.
 *   - MEERKAT_ARCHIVE_ANNOUNCE_TTL_MS / _LEAD_MS: announcement TTL + refresh lead.
 *   - MEERKAT_METRICS_PORT/HOST: opt-in private Prometheus /metrics (never a public byte surface).
 *
 * FOUNDER-OPS remainder: building the per-OS image + wiring the real public-directory announce client
 * and the real seeder serving transport is founder-ops (like the WP-43A scanner image). The loops,
 * fenced leases, and byte reclamation ship here and are proven by the unit + live-Postgres tests.
 */

import {
  createMeerkatStoreRuntime,
  resolveMeerkatStoreRuntimeConfig,
  PostgresArchiveLifecycleStore,
  PostgresObjectReferenceLedger,
  PostgresObjectDeletionJobStore,
  PostgresOperationsStore,
  PostgresPinReconcileCursorStore,
  createS3ObjectStoreFromRuntimeConfig,
  ArchiveObjectByteService,
  ArchivePinReconciler,
  LeasedArchivePinReconciler,
  ArchiveTakedownPropagator,
  createMetricsRegistry,
  resolveMetricsListenerConfig,
  startMetricsListener,
  createHealthEndpoints,
  postgresReadyProbe,
  objectStoreReadyProbe,
} from '../src/index.ts';
import { installOrphanWatchdog } from '../src/orphan-watchdog.ts';

function out(event) {
  process.stdout.write(`${JSON.stringify(event)}\n`);
}

function errorDetail(error) {
  return error instanceof Error ? error.message : String(error);
}

function positiveIntEnv(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`${name} must be a positive integer`);
  return value;
}

const HOST_ID = process.env.MEERKAT_ARCHIVE_HOST_ID;
if (!HOST_ID) {
  out({ event: 'fatal', reason: 'missing_host_id', detail: 'MEERKAT_ARCHIVE_HOST_ID is required' });
  process.exit(1);
}
const workerId = process.env.MEERKAT_ARCHIVE_SEEDER_WORKER_ID ?? `archive-seeder-${process.pid}`;
const reconcileMax = positiveIntEnv('MEERKAT_ARCHIVE_RECONCILE_MAX', 5_000);
const reconcilePage = positiveIntEnv('MEERKAT_ARCHIVE_RECONCILE_PAGE', 500);
const leaseMs = positiveIntEnv('MEERKAT_ARCHIVE_SEEDER_LEASE_MS', 5 * 60 * 1000);

let storeRuntime;
let metricsListener;
let drainTimer;
let shuttingDown = false;

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  out({ event: 'shutdown', signal });
  if (drainTimer) clearTimeout(drainTimer);
  try {
    if (metricsListener) await metricsListener.close();
    if (storeRuntime) await storeRuntime.close();
  } catch (error) {
    out({ event: 'fatal', reason: 'shutdown_failed', detail: errorDetail(error) });
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
  const runtimeConfig = resolveMeerkatStoreRuntimeConfig(process.env, {
    env: process.env,
    requireObjectStore: true,
  });
  // Fenced multi-writer reconciliation requires the PostgreSQL operations store. File mode has no
  // safe lease, so refuse rather than fake single-writer safety.
  if (runtimeConfig.backend !== 'postgres') {
    throw new Error('archive seeder reconciler requires the PostgreSQL backend (fenced leases)');
  }
  if (runtimeConfig.objectStore?.backend !== 's3') {
    throw new Error('archive seeder reconciler requires an s3 object store');
  }
  storeRuntime = await createMeerkatStoreRuntime(runtimeConfig);
  if (!storeRuntime.database) throw new Error('PostgreSQL state backend did not initialize');

  const archiveStore = new PostgresArchiveLifecycleStore(storeRuntime.database);
  const referenceLedger = new PostgresObjectReferenceLedger(storeRuntime.database);
  const deletionJobs = new PostgresObjectDeletionJobStore(storeRuntime.database);
  const operations = new PostgresOperationsStore(storeRuntime.database);
  const objectStore = await createS3ObjectStoreFromRuntimeConfig(runtimeConfig.objectStore, {
    productionMode: runtimeConfig.productionMode,
  });
  const byteService = new ArchiveObjectByteService(objectStore, archiveStore, referenceLedger);

  // The serving index is derived from the archive lifecycle itself: a publication is "served" iff its
  // pin is active AND serveable (isServeable already gates on a clean durable pin). This keeps the
  // reconciler honest without a second serving store to drift against; addServing/removeServing are
  // no-ops here because the pin record IS the serving authority (removeServing during takedown is
  // driven by requestTakedown flipping the pin to removing, which isServeable then rejects).
  const servingIndex = {
    isServing: (publicationId) => archiveStore.isServeable(publicationId, HOST_ID),
    addServing: async () => undefined,
    removeServing: async () => undefined,
    listServing: async () => ({ publicationIds: [], nextCursor: null }),
  };
  // Bytes present iff every durable object of the pin's content is still referenced + stored.
  const probeBytes = async (pin) => {
    const objects = await archiveStore.listObjectsForContent(pin.contentId);
    if (objects.length === 0) return false;
    for (const object of objects) {
      if (object.status !== 'durable' || !object.durableKey) return false;
      if (!(await referenceLedger.isReferenced(object.durableKey))) return false;
      if (!(await objectStore.observe(object.durableKey))) return false;
    }
    return true;
  };
  const reconciler = new ArchivePinReconciler(archiveStore, servingIndex, probeBytes);
  // Durable resume cursor (migration 14): a crash, or a host with more pins than one tick's
  // bound, continues where the fenced winner left off instead of restarting from page one.
  const leasedReconciler = new LeasedArchivePinReconciler(
    reconciler, operations, new PostgresPinReconcileCursorStore(storeRuntime.database),
  );
  const absenceProbe = async (durableKey) => (await objectStore.observe(durableKey)) === null;
  const takedown = new ArchiveTakedownPropagator(
    archiveStore, servingIndex, byteService, referenceLedger, deletionJobs, absenceProbe,
  );

  const metricsRegistry = createMetricsRegistry();
  const health = createHealthEndpoints({
    service: 'archive-seeder',
    checks: [
      { name: 'postgres', required: true, probe: postgresReadyProbe(storeRuntime.pool) },
      { name: 'object_store', required: true, probe: objectStoreReadyProbe(objectStore) },
    ],
  });
  const metricsConfig = resolveMetricsListenerConfig(process.env);
  if (metricsConfig) {
    metricsListener = await startMetricsListener({
      registry: metricsRegistry,
      config: metricsConfig,
      health,
      log: (event, detail) => out({ event, ...detail }),
    });
  }

  const scheduleDrain = (delayMs) => {
    if (shuttingDown) return;
    drainTimer = setTimeout(runDrain, delayMs);
    drainTimer.unref?.();
  };
  const runDrain = async () => {
    if (shuttingDown) return;
    let worked = false;
    try {
      // 1. Pin reconcile under a fenced lease.
      const recon = await leasedReconciler.runOnce({
        scanId: `pin-reconcile-${HOST_ID}`, hostId: HOST_ID, owner: workerId,
        leaseMs, maxEntries: reconcileMax, pageSize: reconcilePage,
      });
      if (recon.status === 'ran') {
        worked = worked || recon.pin.findings.length > 0;
        for (const finding of recon.pin.findings) {
          out({ event: 'pin_reconcile_finding', publicationId: finding.publicationId, outcome: finding.outcome });
        }
      }
      // 2. Takedown drain: claim takedown_pending jobs under the archive fenced lease and propagate.
      const claims = await archiveStore.claimJobs({
        workerId, eligibleStatuses: ['takedown_pending'], limit: 8, leaseMs, nowMs: Date.now(),
      });
      for (const claim of claims) {
        worked = true;
        const result = await takedown.propagate({
          jobId: claim.job.jobId, hostId: HOST_ID,
          lease: { jobId: claim.job.jobId, workerId, fencingToken: claim.fencingToken },
          nowMs: Date.now(),
        });
        out({ event: 'takedown_propagated', jobId: claim.job.jobId, status: result.status });
      }
    } catch (error) {
      out({ event: 'archive_seeder_error', detail: errorDetail(error) });
    }
    scheduleDrain(worked ? 100 : 5_000);
  };
  scheduleDrain(500);

  out({
    event: 'ready',
    role: 'archive-seeder-reconciler',
    workerId,
    hostId: HOST_ID,
    stateBackend: runtimeConfig.backend,
    metrics: metricsListener ? `listening on ${metricsListener.host}:${metricsListener.port}` : 'disabled',
    note: 'fenced pin reconcile + takedown drain active; announce client + serving transport are founder-ops',
  });
} catch (error) {
  if (drainTimer) clearTimeout(drainTimer);
  try {
    if (metricsListener) await metricsListener.close();
    if (storeRuntime) await storeRuntime.close();
  } catch {
    out({ event: 'fatal', reason: 'state_authority_close_failed' });
  }
  out({ event: 'fatal', reason: 'startup_failed', detail: errorDetail(error) });
  process.exit(1);
}
