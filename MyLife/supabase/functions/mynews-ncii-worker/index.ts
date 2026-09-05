/**
 * MyNews NCII / TAKE IT DOWN 48-hour SLA worker (Plan 39 T10, Track 1 P5).
 *
 * The TAKE IT DOWN Act requires removal of non-consensual intimate imagery
 * within 48 hours of a valid request. Atomic intake takes the target down and
 * opens its case in one transaction. This worker first repairs legacy orphaned
 * NCII reports, then scans unresolved cases at or over the deadline, ensures the
 * content is provably removed, escalates ambiguity, and records vendor seam
 * outputs. Reconciled deadlines remain anchored to the original report time.
 *
 * Fail-closed invariant: on any ambiguity the worker REMOVES/escalates; it never
 * clears a case (only a human, in the console, clears). The hash-match vendor
 * and NCMEC CyberTipline are unimplemented seams with safe defaults: no external
 * call configured -> 'pending' (human review), never an auto-clear or a
 * fabricated match/report.
 *
 * Server-only: deployed with verify_jwt = false (config.toml) and gated by the
 * X-MyNews-Worker-Secret header against MYNEWS_NCII_WORKER_SECRET. The gateway
 * default (verify_jwt = true) would 401 the pg_cron/pg_net call before the
 * secret check runs. Invoked by nw_run_ncii_worker (pg_cron) or an operator;
 * never by the app.
 */

import {
  createPostgrestMyNewsStore,
  type MyNewsStore,
  type NciiCase,
  type NciiEnforceOutcome,
  type NciiHashStatus,
} from '../_shared/mynews-store.ts';
import {
  recordWorkerRun,
  tagLogOutcome,
  withRequestLog,
  type WorkerRunRecord,
} from '../_shared/mynews-observability.ts';
import {
  matchNciiHash,
  reportCsamToNcmec,
  type NciiHashVerdict,
} from './seams.ts';

declare const Deno:
  | {
      env: { get(key: string): string | undefined };
      serve?: (handler: (req: Request) => Response | Promise<Response>) => void;
    }
  | undefined;

const WORKER_REF = 'ncii-auto';
const DEFAULT_BATCH_LIMIT = 50;
const MAX_BATCH_LIMIT = 200;

export interface NciiWorkerDeps {
  env: (key: string) => string | undefined;
  now: () => string;
  store: MyNewsStore;
  /** Hash-match vendor seam (injectable for tests). Defaults to the safe seam. */
  matchHash?: (caseRow: NciiCase, env: (key: string) => string | undefined) => Promise<NciiHashVerdict>;
  /** NCMEC CyberTipline seam (injectable for tests). Defaults to the safe seam. */
  reportCsam?: (
    caseRow: NciiCase,
    env: (key: string) => string | undefined,
  ) => Promise<{ ncmecRef: string | null }>;
  /**
   * Heartbeat sink (WP11). Wired to nw_worker_runs at the Deno.serve bootstrap;
   * unset in unit tests so no test performs a network write. A heartbeat failure
   * never changes the worker's response.
   */
  recordRun?: (record: WorkerRunRecord) => Promise<unknown>;
}

export interface NciiWorkerResult {
  ok: boolean;
  reconciled: number;
  reconciledIds: string[];
  scanned: number;
  removed: number;
  escalated: number;
  ncmecReported: number;
  failures: { caseId: string; error: string }[];
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function jsonResponse(body: Record<string, unknown>, status: number): Response {
  // The outcome tag is a non-enumerable Symbol property; the serialized bytes,
  // status, and headers are unchanged by it (WP11 structured logging).
  return tagLogOutcome(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
    status < 400 ? 'ok' : 'error',
  );
}

function jsonError(code: string, message: string, status: number): Response {
  return tagLogOutcome(jsonResponse({ ok: false, error: code, message }, status), code);
}

function expectedWorkerSecret(env: NciiWorkerDeps['env']): string | null {
  return stringOrNull(env('MYNEWS_NCII_WORKER_SECRET'));
}

function suppliedWorkerSecret(req: Request): string | null {
  const explicit = stringOrNull(req.headers.get('X-MyNews-Worker-Secret'));
  if (explicit) return explicit;
  const auth = req.headers.get('Authorization');
  const match = auth ? /^Bearer\s+(.+)$/i.exec(auth.trim()) : null;
  return match?.[1]?.trim() ?? null;
}

function hashVerdictToStatus(verdict: NciiHashVerdict): NciiHashStatus {
  switch (verdict.kind) {
    case 'match':
      return 'match';
    case 'no_match':
      return 'no_match';
    case 'error':
      return 'error';
    case 'unconfigured':
    default:
      // No vendor wired: stays 'pending' (human review). Never auto-clears.
      return 'pending';
  }
}

export async function runNciiWorker(
  deps: NciiWorkerDeps,
  limit: number = DEFAULT_BATCH_LIMIT,
): Promise<NciiWorkerResult> {
  const batch = Math.max(1, Math.min(MAX_BATCH_LIMIT, Math.floor(limit)));
  const matchHash = deps.matchHash ?? matchNciiHash;
  const reportCsam = deps.reportCsam ?? reportCsamToNcmec;

  const result: NciiWorkerResult = {
    ok: true,
    reconciled: 0,
    reconciledIds: [],
    scanned: 0,
    removed: 0,
    escalated: 0,
    ncmecReported: 0,
    failures: [],
  };

  let orphanedReportIds: string[] = [];
  try {
    orphanedReportIds = (await deps.store.findOrphanedNciiReports()).slice(0, batch);
  } catch (err) {
    result.failures.push({ caseId: 'orphan-scan', error: errorMessage(err) });
  }

  for (const reportId of orphanedReportIds) {
    try {
      const outcome = await deps.store.reconcileNciiCase(reportId);
      if (outcome === 'ok') {
        result.reconciled += 1;
        result.reconciledIds.push(reportId);
      } else if (outcome !== 'exists') {
        result.failures.push({ caseId: reportId, error: `reconcile -> ${outcome}` });
      }
    } catch (err) {
      result.failures.push({ caseId: reportId, error: `reconcile: ${errorMessage(err)}` });
    }
  }

  const dueCases = await deps.store.getDueNciiCases(deps.now(), batch);
  result.scanned = dueCases.length;

  for (const caseRow of dueCases) {
    try {
      // Hash-match vendor seam. Safe default (unconfigured) -> 'pending'; a
      // 'match' NEVER auto-clears, it only strengthens the case.
      const verdict = await matchHash(caseRow, deps.env);
      const hashStatus = hashVerdictToStatus(verdict);

      // NCMEC CyberTipline seam for a confirmed-CSAM (hash 'match') case. The
      // default seam is unconfigured (returns ncmecRef null); founder-ops wires
      // the real creds. Only record a ref when the seam produced one; never
      // fabricate one.
      let ncmecRef: string | null = null;
      if (verdict.kind === 'match') {
        const reported = await reportCsam(caseRow, deps.env);
        ncmecRef = reported.ncmecRef;
        if (ncmecRef) result.ncmecReported += 1;
      }

      const notes = [`SLA backstop at deadline ${caseRow.deadlineAt}`];
      if (verdict.kind === 'unconfigured') {
        notes.push(
          '[vendor-unconfigured] NCII hash matching is not configured; human review is required.',
        );
      } else if (verdict.kind === 'error') {
        notes.push(`[vendor-unconfigured] NCII hash matching is unavailable: ${verdict.detail}`);
      }
      if (verdict.kind === 'match' && !ncmecRef) {
        notes.push(
          '[vendor-unconfigured] NCMEC reporting is unconfigured or unavailable; operator filing is required.',
        );
      }

      // Fail-closed enforcement. ensure_removed drives a content case to
      // provable removal; a profile/media case (no content row) or any ambiguity
      // escalates. The case is at/over its 48h SLA, so it always escalates into
      // the human queue too when it cannot be auto-removed.
      const outcome: NciiEnforceOutcome = await deps.store.enforceNciiCase({
        caseId: caseRow.id,
        action: 'ensure_removed',
        moderatorRef: WORKER_REF,
        note: notes.join(' '),
        hashStatus,
        ncmecRef,
      });

      if (outcome === 'removed') result.removed += 1;
      else if (outcome === 'escalated') result.escalated += 1;
      else {
        // Any non-terminal-safe outcome (not-found, bad-*, clear-not-allowed) is
        // a failure worth surfacing; the case stays for the next pass.
        result.failures.push({ caseId: caseRow.id, error: `enforce -> ${outcome}` });
      }
    } catch (err) {
      // One bad case must not stop the batch; the case stays due and the next
      // run retries it (fail-closed: it is never assumed resolved).
      result.failures.push({ caseId: caseRow.id, error: errorMessage(err) });
    }
  }

  if (result.failures.length > 0) result.ok = false;
  return result;
}

export async function handleNciiWorkerRequest(
  req: Request,
  deps: NciiWorkerDeps,
): Promise<Response> {
  if (req.method !== 'POST') {
    return jsonError('method_not_allowed', 'POST only.', 405);
  }

  const expected = expectedWorkerSecret(deps.env);
  if (!expected) {
    return jsonError('config', 'MYNEWS_NCII_WORKER_SECRET is not configured.', 503);
  }
  if (suppliedWorkerSecret(req) !== expected) {
    return jsonError('auth', 'Missing or invalid worker secret.', 401);
  }

  let limit = DEFAULT_BATCH_LIMIT;
  try {
    if (req.body) {
      const text = await req.text();
      if (text.trim()) {
        const body = JSON.parse(text) as { limit?: unknown };
        if (typeof body.limit === 'number' && Number.isFinite(body.limit)) {
          limit = body.limit;
        }
      }
    }
  } catch {
    return jsonError('invalid_body', 'Body must be JSON.', 400);
  }

  const startedAt = deps.now();
  try {
    const result = await runNciiWorker(deps, limit);
    await heartbeat(deps, {
      worker: 'mynews-ncii-worker',
      ok: result.ok,
      startedAt,
      processed: result.scanned,
      failures: result.failures.length,
      detail: result.ok
        ? `scanned ${result.scanned}, removed ${result.removed}, escalated ${result.escalated}, reconciled ${result.reconciled}`
        : `${result.failures.length} case failures in a pass that scanned ${result.scanned}`,
    });
    return jsonResponse(result as unknown as Record<string, unknown>, result.ok ? 200 : 207);
  } catch (err) {
    await heartbeat(deps, {
      worker: 'mynews-ncii-worker',
      ok: false,
      startedAt,
      processed: 0,
      failures: 1,
      detail: 'pass threw before completing',
    });
    return jsonError('worker_failed', errorMessage(err), 500);
  }
}

/** Best-effort heartbeat write. Never throws into the worker's response path. */
async function heartbeat(deps: NciiWorkerDeps, record: WorkerRunRecord): Promise<void> {
  if (!deps.recordRun) return;
  try {
    await deps.recordRun(record);
  } catch (err) {
    console.error('mynews ncii worker heartbeat failed', errorMessage(err));
  }
}

if (typeof Deno !== 'undefined' && typeof Deno.serve === 'function') {
  const env = (key: string) => Deno!.env.get(key);
  const now = () => new Date().toISOString();
  Deno.serve(
    withRequestLog(
      { fn: 'mynews-ncii-worker', action: 'run_pass' },
      async (req) => {
        let store: MyNewsStore;
        try {
          store = createPostgrestMyNewsStore(env, fetch);
        } catch (err) {
          return jsonError('config', errorMessage(err), 503);
        }
        return handleNciiWorkerRequest(req, {
          env,
          now,
          store,
          recordRun: (record) => recordWorkerRun(record, env, fetch),
        });
      },
      // Worker callers are pg_cron or an operator, not a signed-in user.
      { hashSubject: false },
    ),
  );
}
