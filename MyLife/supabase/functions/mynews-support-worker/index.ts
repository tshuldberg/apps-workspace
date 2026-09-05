/**
 * MyNews support-ledger reconciliation worker (Plan 48 WP7 G2).
 *
 * `reconcileSupportLedger` checks the accounting invariants of the append-only
 * support ledger (charge/fee conservation, refunds within charges, fee
 * reversals within fees, dispute releases within holds, non-negative pair
 * balances). Until now nothing in production ran it, so a webhook bug could
 * silently corrupt the ledger with no signal. This worker runs the pass on a
 * schedule, writes a durable `nw_support_reconciliation_runs` row (ok/mismatch
 * counts plus bounded findings), and surfaces mismatches to the moderator
 * console.
 *
 * Honesty invariant: the worker only reports. It never "repairs" the ledger
 * (the ledger is append-only by trigger) and it never records a passing run it
 * did not actually complete. A read failure, or a failure to write the run row,
 * makes the whole pass NOT ok.
 *
 * Server-only: deployed with verify_jwt = false (config.toml) and gated by the
 * X-MyNews-Worker-Secret header against MYNEWS_SUPPORT_WORKER_SECRET. The
 * gateway default (verify_jwt = true) would 401 the pg_cron/pg_net call before
 * the secret check runs. Invoked by cron or an operator; never by the app.
 */

import {
  createPostgrestMyNewsPaymentsStore,
  type MyNewsPaymentsStore,
} from '../_shared/mynews-payments-store.ts';
import {
  recordWorkerRun,
  tagLogOutcome,
  withRequestLog,
  type WorkerRunRecord,
} from '../_shared/mynews-observability.ts';
import { reconcileSupportLedger } from '../_shared/mynews-support-reconcile.ts';

declare const Deno:
  | {
      env: { get(key: string): string | undefined };
      serve?: (handler: (req: Request) => Response | Promise<Response>) => void;
    }
  | undefined;

const WORKER_REF = 'support-reconcile-auto';
const DEFAULT_LEDGER_LIMIT = 5_000;
const MAX_LEDGER_LIMIT = 20_000;
/** Matches the jsonb_array_length check on nw_support_reconciliation_runs. */
export const MAX_RECORDED_FINDINGS = 100;

export interface SupportWorkerDeps {
  env: (key: string) => string | undefined;
  now: () => string;
  store: MyNewsPaymentsStore;
  /**
   * Heartbeat sink (WP11). The reconciliation run row is domain output; this is
   * the uniform liveness signal mynews-health reads for all three workers.
   * Wired at the Deno.serve bootstrap and unset in unit tests, so no test
   * performs a network write. A heartbeat failure never changes the response.
   */
  recordRun?: (record: WorkerRunRecord) => Promise<unknown>;
}

export interface SupportWorkerResult {
  ok: boolean;
  startedAt: string;
  finishedAt: string;
  ledgerRows: number;
  pairCount: number;
  /** Total invariant violations found, even when findings were truncated. */
  mismatchCount: number;
  /** Up to MAX_RECORDED_FINDINGS violation descriptions. */
  findings: string[];
  /** True only when the durable run row was written. */
  recorded: boolean;
  failures: string[];
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

function expectedWorkerSecret(env: SupportWorkerDeps['env']): string | null {
  return stringOrNull(env('MYNEWS_SUPPORT_WORKER_SECRET'));
}

function suppliedWorkerSecret(req: Request): string | null {
  const explicit = stringOrNull(req.headers.get('X-MyNews-Worker-Secret'));
  if (explicit) return explicit;
  const auth = req.headers.get('Authorization');
  const match = auth ? /^Bearer\s+(.+)$/i.exec(auth.trim()) : null;
  return match?.[1]?.trim() ?? null;
}

export function boundedFindings(issues: readonly string[]): string[] {
  return issues.slice(0, MAX_RECORDED_FINDINGS).map((issue) => issue.slice(0, 500));
}

export async function runSupportReconciliation(
  deps: SupportWorkerDeps,
  limit: number = DEFAULT_LEDGER_LIMIT,
): Promise<SupportWorkerResult> {
  const rowLimit = Math.max(1, Math.min(MAX_LEDGER_LIMIT, Math.floor(limit)));
  const startedAt = deps.now();
  const failures: string[] = [];

  let rows: Awaited<ReturnType<MyNewsPaymentsStore['listSupportLedgerRows']>> = [];
  try {
    rows = await deps.store.listSupportLedgerRows(rowLimit);
  } catch (err) {
    // A read failure is not a clean ledger. Report it and record nothing: an
    // absent run row is honest, a passing run row would be a lie.
    return {
      ok: false,
      startedAt,
      finishedAt: deps.now(),
      ledgerRows: 0,
      pairCount: 0,
      mismatchCount: 0,
      findings: [],
      recorded: false,
      failures: [`ledger-read: ${errorMessage(err)}`],
    };
  }

  const result = reconcileSupportLedger(
    rows.map((row) => ({
      id: row.id,
      supporterProfileId: row.supporterProfileId,
      journalistProfileId: row.journalistProfileId,
      kind: row.kind,
      amountCents: row.amountCents,
      currency: row.currency,
      state: row.state,
    })),
  );

  const findings = boundedFindings(result.issues);
  const finishedAt = deps.now();
  let recorded = false;
  try {
    await deps.store.recordSupportReconciliationRun({
      workerRef: WORKER_REF,
      startedAt,
      finishedAt,
      ledgerRows: rows.length,
      pairCount: result.pairs.length,
      ok: result.ok,
      mismatchCount: result.issues.length,
      findings,
    });
    recorded = true;
  } catch (err) {
    failures.push(`run-record: ${errorMessage(err)}`);
  }

  return {
    ok: result.ok && recorded && failures.length === 0,
    startedAt,
    finishedAt,
    ledgerRows: rows.length,
    pairCount: result.pairs.length,
    mismatchCount: result.issues.length,
    findings,
    recorded,
    failures,
  };
}

export async function handleSupportWorkerRequest(
  req: Request,
  deps: SupportWorkerDeps,
): Promise<Response> {
  if (req.method !== 'POST') {
    return jsonError('method_not_allowed', 'POST only.', 405);
  }

  const expected = expectedWorkerSecret(deps.env);
  if (!expected) {
    return jsonError('config', 'MYNEWS_SUPPORT_WORKER_SECRET is not configured.', 503);
  }
  if (suppliedWorkerSecret(req) !== expected) {
    return jsonError('auth', 'Missing or invalid worker secret.', 401);
  }

  let limit = DEFAULT_LEDGER_LIMIT;
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
    const result = await runSupportReconciliation(deps, limit);
    await heartbeat(deps, {
      worker: 'mynews-support-worker',
      ok: result.ok,
      startedAt: result.startedAt,
      processed: result.ledgerRows,
      failures: result.mismatchCount,
      detail: result.recorded
        ? `${result.pairCount} pairs over ${result.ledgerRows} ledger rows, ${result.mismatchCount} mismatches`
        : 'reconciliation run row was NOT written; the pass is not trustworthy',
    });
    return jsonResponse(result as unknown as Record<string, unknown>, result.ok ? 200 : 207);
  } catch (err) {
    await heartbeat(deps, {
      worker: 'mynews-support-worker',
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
async function heartbeat(deps: SupportWorkerDeps, record: WorkerRunRecord): Promise<void> {
  if (!deps.recordRun) return;
  try {
    await deps.recordRun(record);
  } catch (err) {
    console.error('mynews support worker heartbeat failed', errorMessage(err));
  }
}

if (typeof Deno !== 'undefined' && typeof Deno.serve === 'function') {
  const env = (key: string) => Deno!.env.get(key);
  const now = () => new Date().toISOString();
  Deno.serve(
    withRequestLog(
      { fn: 'mynews-support-worker', action: 'run_pass' },
      async (req) => {
        let store: MyNewsPaymentsStore;
        try {
          store = createPostgrestMyNewsPaymentsStore(env, fetch);
        } catch (err) {
          return jsonError('config', errorMessage(err), 503);
        }
        return handleSupportWorkerRequest(req, {
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
