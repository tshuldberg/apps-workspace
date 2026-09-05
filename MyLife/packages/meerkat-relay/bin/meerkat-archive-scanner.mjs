#!/usr/bin/env node
/**
 * Meerkat MANAGED ARCHIVE SCANNER WORKER (Plan 43 WP-43A) -- the deployable that turns a
 * QUARANTINED archive job into a durable scan DECISION. It claims quarantined jobs under the
 * archive lifecycle store's FENCED lease (moving them to `scanning`), reads each object's
 * quarantined bytes from the object store, runs the malware/AV rail and the abuse-hash rail, and
 * records the decision with the store's fenced completeScan. Only a clean scan makes a job
 * `approved` (the sole path to a pin); a malware or abuse-hash hit rejects it; ANY scanner outage
 * fails closed (the job stays quarantined and retries, never approved).
 *
 * A SEPARATE image over the same codebase (it needs @mylife/sync at runtime for the store graph +
 * object byte path); NOT the slim ws+zod relay image. It owns NO public listener -- it is a pure
 * background drain worker. It never scans private mesh content: only managed/public archive bytes.
 *
 * FAIL-CLOSED START + HONEST BOOT LOG. Without a reachable AV daemon the malware rail is the
 * UnavailableMalwareScanner: it is honestly `not_configured`, every job it touches fails closed,
 * and the ready log says so. It never fabricates a clean verdict.
 *
 *   - MEERKAT_DEPLOYMENT_PROFILE / MEERKAT_STORE_BACKEND: explicit durable-state authority.
 *     Self-host file mode uses DATA_DIR (file archive store + file object byte path). First-party
 *     mode requires PostgreSQL (verify-full TLS) + an s3 object store; it never falls back to file.
 *   - DATA_DIR (self-host, default ./.meerkat-archive-scanner): archive lifecycle ledger + object
 *     byte store volume.
 *   - MEERKAT_ARCHIVE_ABUSE_HASH_FILE (optional): newline-delimited known-bad hash set for the
 *     abuse-hash rail. Absent => the rail is honestly empty (matches nothing); the REAL industry
 *     hash DB is founder-ops (a real matcher replaces the file source without touching this bin).
 *   - MEERKAT_ARCHIVE_CLAMD_HOST / _PORT: private ClamD endpoint. First-party mode requires it.
 *   - MEERKAT_ARCHIVE_MALWARE_VERSION / _DEFINITIONS: pinned provenance. Startup verifies the
 *     daemon reports both exact values before any job is claimed.
 *   - MEERKAT_ARCHIVE_WORKER_ID (default archive-scanner-<pid>): the fenced lease owner id.
 *   - MEERKAT_ARCHIVE_CLAIM_LIMIT / _LEASE_MS / _RETRY_MS: drain tuning.
 *   - MEERKAT_ARCHIVE_MAX_SCAN_OBJECT_BYTES (default 128 MiB): per-object scan-memory bound;
 *     an over-cap object is terminally flagged for review, never loaded whole.
 *   - MEERKAT_METRICS_PORT/HOST: opt-in private Prometheus /metrics (never a public byte surface).
 *
 * Run from source with tsx:
 *
 *   DATA_DIR=~/.meerkat/archive-scanner \
 *     MEERKAT_DEPLOYMENT_PROFILE=self-host MEERKAT_STORE_BACKEND=file \
 *     MEERKAT_ARCHIVE_ABUSE_HASH_FILE=/run/secrets/abuse-hashes.txt \
 *     tsx bin/meerkat-archive-scanner.mjs
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import {
  createMeerkatStoreRuntime,
  resolveMeerkatStoreRuntimeConfig,
  FileArchiveLifecycleStore,
  PostgresArchiveLifecycleStore,
  FileObjectStore,
  createS3ObjectStoreFromRuntimeConfig,
  HashSetAbuseScanner,
  UnavailableMalwareScanner,
  ClamDScanner,
  ArchiveScannerWorker,
  InMemoryNcmecReportQueueStore,
  FileNcmecReportQueueStore,
  PostgresNcmecReportQueueStore,
  NcmecReportQueue,
  createMetricsRegistry,
  resolveMetricsListenerConfig,
  startMetricsListener,
  createHealthEndpoints,
  postgresReadyProbe,
  dataDirWritableProbe,
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
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return value;
}

const dataDir = process.env.DATA_DIR ?? './.meerkat-archive-scanner';

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
    env: { ...process.env, DATA_DIR: dataDir },
    // The scanner owns a byte-read path, so it opts into the typed object-store block. First-party
    // mode fails closed here if s3 was selected but incomplete.
    requireObjectStore: true,
  });
  storeRuntime = await createMeerkatStoreRuntime(runtimeConfig);

  // Durable archive lifecycle store (the moderation decision authority) + object byte source.
  let archiveStore;
  let readQuarantineBytes;
  let ncmecStore;
  let objectStore;
  if (runtimeConfig.backend === 'file') {
    if (!runtimeConfig.dataDir) throw new Error('File state backend is missing DATA_DIR');
    archiveStore = new FileArchiveLifecycleStore(runtimeConfig.dataDir);
    objectStore = new FileObjectStore(path.join(runtimeConfig.dataDir, 'objects'));
    readQuarantineBytes = async ({ quarantineKey }) => {
      const read = await objectStore.read(quarantineKey);
      return read ? read.bytes : null;
    };
    ncmecStore = new FileNcmecReportQueueStore(runtimeConfig.dataDir);
  } else {
    if (!storeRuntime.database) throw new Error('PostgreSQL state backend did not initialize');
    archiveStore = new PostgresArchiveLifecycleStore(storeRuntime.database);
    if (runtimeConfig.objectStore?.backend !== 's3') {
      throw new Error('First-party archive scanner requires an s3 object store');
    }
    objectStore = await createS3ObjectStoreFromRuntimeConfig(runtimeConfig.objectStore, {
      productionMode: runtimeConfig.productionMode,
    });
    readQuarantineBytes = async ({ quarantineKey }) => {
      const read = await objectStore.read(quarantineKey);
      return read ? read.bytes : null;
    };
    ncmecStore = new PostgresNcmecReportQueueStore(storeRuntime.database);
  }

  // Abuse-hash rail: optional local known-bad set (the real industry DB is founder-ops).
  const abuseHashFile = process.env.MEERKAT_ARCHIVE_ABUSE_HASH_FILE;
  let knownBadHashes = [];
  if (abuseHashFile) {
    const contents = await fs.readFile(abuseHashFile, 'utf8');
    knownBadHashes = contents.split(/\r?\n/u).map((line) => line.trim()).filter(Boolean);
  }
  const abuseScanner = new HashSetAbuseScanner(knownBadHashes);

  // Malware/AV rail. A configured daemon is probed before the drain loop starts and its reported
  // version/signature set must match the pinned operator values. First-party mode refuses to start
  // without it; self-host mode retains the explicit fail-closed unavailable posture.
  const clamdHost = (process.env.MEERKAT_ARCHIVE_CLAMD_HOST ?? '').trim();
  const malwareVersion = (process.env.MEERKAT_ARCHIVE_MALWARE_VERSION ?? '').trim();
  const malwareDefinitions = (process.env.MEERKAT_ARCHIVE_MALWARE_DEFINITIONS ?? '').trim();
  if (runtimeConfig.profile === 'first-party' && (!clamdHost || !malwareVersion || !malwareDefinitions)) {
    throw new Error('First-party archive scanner requires ClamD host plus pinned malware version and definitions');
  }
  let malwareScanner;
  if (clamdHost && malwareVersion && malwareDefinitions) {
    malwareScanner = new ClamDScanner({
      host: clamdHost,
      port: positiveIntEnv('MEERKAT_ARCHIVE_CLAMD_PORT', 3310),
      timeoutMs: positiveIntEnv('MEERKAT_ARCHIVE_CLAMD_TIMEOUT_MS', 15_000),
      engineVersion: malwareVersion,
      definitionsVersion: malwareDefinitions,
    });
    await malwareScanner.verifyReady();
  } else {
    malwareScanner = new UnavailableMalwareScanner();
  }

  const ncmecQueue = new NcmecReportQueue(ncmecStore ?? new InMemoryNcmecReportQueueStore());
  const workerId = process.env.MEERKAT_ARCHIVE_WORKER_ID ?? `archive-scanner-${process.pid}`;
  const worker = new ArchiveScannerWorker({
    workerId,
    store: archiveStore,
    malwareScanner,
    abuseScanner,
    readQuarantineBytes,
    ncmecQueue,
    claimLimit: positiveIntEnv('MEERKAT_ARCHIVE_CLAIM_LIMIT', 8),
    leaseMs: positiveIntEnv('MEERKAT_ARCHIVE_LEASE_MS', 5 * 60 * 1000),
    retryMs: positiveIntEnv('MEERKAT_ARCHIVE_RETRY_MS', 60 * 1000),
    maxScanObjectBytes: positiveIntEnv('MEERKAT_ARCHIVE_MAX_SCAN_OBJECT_BYTES', 128 * 1024 * 1024),
  });

  const metricsRegistry = createMetricsRegistry();
  const health = createHealthEndpoints({
    service: 'archive-scanner',
    checks: [
      runtimeConfig.backend === 'file'
        ? { name: 'data_dir', required: true, probe: dataDirWritableProbe(runtimeConfig.dataDir) }
        : { name: 'postgres', required: true, probe: postgresReadyProbe(storeRuntime.pool) },
      { name: 'object_store', required: true, probe: objectStoreReadyProbe(objectStore) },
      {
        name: 'malware_scanner',
        required: runtimeConfig.profile === 'first-party',
        probe: async () => {
          if (malwareScanner.state !== 'configured') return { ok: false, detailClass: 'not_configured' };
          try {
            await malwareScanner.verifyReady();
            return { ok: true, detailClass: 'ok' };
          } catch {
            return { ok: false, detailClass: 'unavailable' };
          }
        },
      },
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

  // Bounded, self-rescheduling drain loop. A pass that moved work loops promptly; an idle pass
  // backs off. Every decision is a fenced completeScan, so a stale worker can never double-decide.
  const scheduleDrain = (delayMs) => {
    if (shuttingDown) return;
    drainTimer = setTimeout(runDrain, delayMs);
    drainTimer.unref?.();
  };
  const runDrain = async () => {
    if (shuttingDown) return;
    let claimed = 0;
    try {
      const tick = await worker.runOnce();
      claimed = tick.claimed;
      for (const outcome of tick.outcomes) {
        out({ event: 'archive_scan_decision', jobId: outcome.jobId, decision: outcome.decision });
      }
    } catch (error) {
      out({ event: 'archive_scan_error', detail: errorDetail(error) });
    }
    scheduleDrain(claimed > 0 ? 50 : 1_000);
  };
  scheduleDrain(250);

  out({
    event: 'ready',
    role: 'archive-scanner',
    workerId,
    stateBackend: runtimeConfig.backend,
    ...(runtimeConfig.dataDir ? { dataDir: runtimeConfig.dataDir } : {}),
    malwareRail: malwareScanner.state === 'configured'
      ? `${malwareScanner.engine.engine} ${malwareScanner.engine.engineVersion}`
      : 'FAIL-CLOSED (no AV image; jobs stay quarantined until a real scanner is wired)',
    abuseHashRail: knownBadHashes.length > 0
      ? `${knownBadHashes.length} known-bad hashes loaded`
      : 'empty (real industry hash DB is founder-ops)',
    readiness: worker.readinessState(),
    metrics: metricsListener
      ? `listening on ${metricsListener.host}:${metricsListener.port}`
      : 'disabled',
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
