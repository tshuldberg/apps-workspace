#!/usr/bin/env node
/**
 * Meerkat NCMEC FILING WORKER (Plan 43 WP-43C) -- the deployable that drives a queued CSAM report
 * to a provider-confirmed `filed` state through the CyberTipline filing seam, or to a durable
 * `escalated` dead-letter on a permanent validation defect. It claims due queued records under the
 * NCMEC queue store's FENCED lease, validates the required evidence, files ONCE through the
 * NcmecFilingClient, and commits the terminal resolution with the store's fenced completeFiling.
 *
 * A SEPARATE image over the same codebase (it needs @mylife/sync at runtime for the moderation
 * store graph); NOT the slim ws+zod relay image. It owns NO public listener -- a pure background
 * drain worker over the meerkat_moderation role. It never scans or reports private mesh content:
 * only public-tier CSAM evidence references that already reached the durable queue.
 *
 * FAIL-CLOSED START + HONEST BOOT LOG. Without a real CyberTipline gateway (founder-ops vendor
 * onboarding) a self-host worker binds UnavailableNcmecFilingClient: every attempt reports a transient
 * `client_unavailable`, so records stay `queued` forever and NO record is ever marked `filed`. The
 * ready log states the rail is fail-closed. Marking `filed` requires a real provider confirmation.
 *
 *   - MEERKAT_DEPLOYMENT_PROFILE / MEERKAT_STORE_BACKEND: explicit durable-state authority. Self-
 *     host file mode uses DATA_DIR (the file NCMEC queue). First-party mode requires the moderation
 *     PostgreSQL context (verify-full TLS) and never falls back to file.
 *   - DATA_DIR (self-host, default ./.meerkat-ncmec-filing): the ncmec-queue file volume root.
 *   - MEERKAT_MODERATION_POSTGRES_URL (first-party): the meerkat_moderation role URL, matching the
 *     community node's moderation context. Required in postgres mode.
 *   - MEERKAT_NCMEC_WORKER_ID (default ncmec-filer-<pid>): the fenced lease owner id.
 *   - MEERKAT_NCMEC_FILING_ENDPOINT + _API_TOKEN_FILE: HTTPS filing gateway and mounted bearer.
 *     First-party mode requires both and proves gateway readiness before claiming work.
 *   - MEERKAT_NCMEC_CLAIM_LIMIT / _LEASE_MS / _BASE_RETRY_MS / _MAX_RETRY_MS / _MAX_ATTEMPTS: drain
 *     + backoff tuning.
 *   - MEERKAT_METRICS_PORT/HOST: opt-in private Prometheus /metrics (never a public surface); the
 *     queue counts (queued/filed/escalated) are exported as identity-free gauges.
 *
 * Vendor onboarding and credentials remain founder-ops. The typed HTTPS adapter marks a report
 * filed only after the gateway returns a real provider reference.
 *
 * Run from source with tsx:
 *
 *   DATA_DIR=~/.meerkat/ncmec-filing \
 *     MEERKAT_DEPLOYMENT_PROFILE=self-host MEERKAT_STORE_BACKEND=file \
 *     tsx bin/meerkat-ncmec-filing-worker.mjs
 */

import { promises as fs } from 'node:fs';
import {
  createMeerkatStoreRuntime,
  resolveMeerkatStoreRuntimeConfig,
  FileNcmecReportQueueStore,
  PostgresNcmecReportQueueStore,
  NcmecFilingWorker,
  UnavailableNcmecFilingClient,
  HttpNcmecFilingClient,
  createMetricsRegistry,
  resolveMetricsListenerConfig,
  startMetricsListener,
  redactForLog,
  redactErrorDetail,
  createHealthEndpoints,
  postgresReadyProbe,
  dataDirWritableProbe,
} from '../src/index.ts';
import { installOrphanWatchdog } from '../src/orphan-watchdog.ts';

const out = (obj) => process.stdout.write(JSON.stringify({ at: new Date().toISOString(), ...redactForLog(obj) }) + '\n');
const errorDetail = (error) => redactErrorDetail(error instanceof Error ? error.message : String(error?.message ?? error));

function positiveIntEnv(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') return fallback;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return value;
}

const dataDir = process.env.DATA_DIR ?? './.meerkat-ncmec-filing';

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
  // The filing worker holds the MODERATION context. In postgres mode it reads its role URL from
  // MEERKAT_MODERATION_POSTGRES_URL so it is the same least-privilege credential the community node
  // uses for the NCMEC queue; file mode uses the DATA_DIR volume.
  const moderationUrl = (process.env.MEERKAT_MODERATION_POSTGRES_URL ?? '').trim();
  const runtimeConfig = resolveMeerkatStoreRuntimeConfig({
    service: 'moderation',
    env: {
      ...process.env,
      DATA_DIR: dataDir,
      ...(moderationUrl ? { MEERKAT_POSTGRES_URL: moderationUrl } : {}),
    },
  });
  storeRuntime = await createMeerkatStoreRuntime(runtimeConfig);

  let ncmecStore;
  if (runtimeConfig.backend === 'file') {
    if (!runtimeConfig.dataDir) throw new Error('File state backend is missing DATA_DIR');
    ncmecStore = new FileNcmecReportQueueStore(runtimeConfig.dataDir);
  } else {
    if (!storeRuntime.database) throw new Error('PostgreSQL state backend did not initialize');
    ncmecStore = new PostgresNcmecReportQueueStore(storeRuntime.database);
  }

  // The filing seam. First-party requires the mounted HTTPS gateway credential and proves the
  // gateway before claiming work. Self-host remains honestly unavailable when no gateway is set.
  const filingEndpoint = (process.env.MEERKAT_NCMEC_FILING_ENDPOINT ?? '').trim();
  const filingTokenFile = (process.env.MEERKAT_NCMEC_FILING_API_TOKEN_FILE ?? '').trim();
  if (runtimeConfig.profile === 'first-party' && (!filingEndpoint || !filingTokenFile)) {
    throw new Error('First-party NCMEC worker requires filing endpoint and API token file');
  }
  let client;
  if (filingEndpoint && filingTokenFile) {
    const apiToken = (await fs.readFile(filingTokenFile, 'utf8')).trim();
    client = new HttpNcmecFilingClient({
      endpoint: filingEndpoint,
      apiToken,
      timeoutMs: positiveIntEnv('MEERKAT_NCMEC_FILING_TIMEOUT_MS', 30_000),
      allowInsecureHttp: /^(1|true|yes)$/iu.test(process.env.MEERKAT_NCMEC_ALLOW_INSECURE_HTTP ?? ''),
    });
    await client.verifyReady();
  } else {
    client = new UnavailableNcmecFilingClient();
  }

  const workerId = process.env.MEERKAT_NCMEC_WORKER_ID ?? `ncmec-filer-${process.pid}`;
  const worker = new NcmecFilingWorker({
    workerId,
    store: ncmecStore,
    client,
    claimLimit: positiveIntEnv('MEERKAT_NCMEC_CLAIM_LIMIT', 8),
    leaseMs: positiveIntEnv('MEERKAT_NCMEC_LEASE_MS', 5 * 60 * 1000),
    baseRetryMs: positiveIntEnv('MEERKAT_NCMEC_BASE_RETRY_MS', 60 * 1000),
    maxRetryMs: positiveIntEnv('MEERKAT_NCMEC_MAX_RETRY_MS', 60 * 60 * 1000),
    maxAttempts: positiveIntEnv('MEERKAT_NCMEC_MAX_ATTEMPTS', 8),
  });

  const metricsRegistry = createMetricsRegistry();
  const health = createHealthEndpoints({
    service: 'ncmec-filing-worker',
    checks: [
      runtimeConfig.backend === 'file'
        ? { name: 'data_dir', required: true, probe: dataDirWritableProbe(runtimeConfig.dataDir) }
        : { name: 'postgres', required: true, probe: postgresReadyProbe(storeRuntime.pool) },
      {
        name: 'filing_gateway',
        required: runtimeConfig.profile === 'first-party',
        probe: async () => {
          if (client.state !== 'configured') return { ok: false, detailClass: 'not_configured' };
          try {
            await client.verifyReady();
            return { ok: true, detailClass: 'ok' };
          } catch {
            return { ok: false, detailClass: 'unavailable' };
          }
        },
      },
    ],
  });
  // Identity-free queue gauges (counts only, NC-P6). A per-report metric would leak evidence, so
  // only the aggregate status counts are exported.
  metricsRegistry.collect('meerkat_ncmec_queue', 'Bounded NCMEC queue counts by status.', async () => {
    const counts = await ncmecStore.counts();
    return [
      { labels: { status: 'queued' }, value: counts.queued },
      { labels: { status: 'exported' }, value: counts.exported },
      { labels: { status: 'filed' }, value: counts.filed },
      { labels: { status: 'escalated' }, value: counts.escalated },
    ];
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

  // Bounded, self-rescheduling drain loop. A pass that moved work loops promptly; an idle pass backs
  // off. Every filing outcome is a fenced completeFiling, so a stale worker can never double-file.
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
        // Log the decision + code only. `detail` on a filed decision is the provider ref (already a
        // non-identifying vendor id); escalate/retry carry an error code. No evidence is logged.
        out({ event: 'ncmec_filing_decision', reportId: outcome.id, decision: outcome.decision, code: outcome.detail });
      }
    } catch (error) {
      out({ event: 'ncmec_filing_error', detail: errorDetail(error) });
    }
    scheduleDrain(claimed > 0 ? 50 : 5_000);
  };
  scheduleDrain(250);

  out({
    event: 'ready',
    role: 'ncmec-filing-worker',
    workerId,
    stateBackend: runtimeConfig.backend,
    ...(runtimeConfig.dataDir ? { dataDir: runtimeConfig.dataDir } : {}),
    filingRail: client.state === 'configured'
      ? 'configured'
      : 'FAIL-CLOSED (no CyberTipline client; records stay queued until a real filing client is wired)',
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
