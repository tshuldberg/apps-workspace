/**
 * MyNews account-deletion worker (plan 48 WP5, audit finding C08).
 *
 * Server-only backstop that carries a deletion request from the end of its
 * disclosed grace window to a terminal state. One pass per invocation:
 *
 *   1. claim due 'grace' rows (plus stalled 'processing' and 'failed' rows past
 *      their retry backoff) into 'processing',
 *   2. run the content disposition in ONE SQL transaction,
 *   3. delete the auth user through the store's admin seam,
 *   4. run the processor-cleanup seam,
 *   5. complete the request only when both side-effect states are terminal.
 *
 * Fail-closed invariants:
 *   - An unconfigured admin credential or processor rail records
 *     'skipped-unconfigured', which stays VISIBLE in the user's deletion status.
 *     Neither is ever recorded as 'done'.
 *   - Any failure marks the request 'failed' with a failure_detail and leaves it
 *     claimable, so the next pass retries it. A failure is never a silent
 *     completion, and a request is never completed while a side effect is
 *     'pending' or 'failed'.
 *   - One bad request never stops the batch.
 *
 * Server-only: deployed with verify_jwt = false (config.toml) and gated by the
 * X-MyNews-Worker-Secret header against MYNEWS_ACCOUNT_WORKER_SECRET. The
 * gateway default (verify_jwt = true) would 401 the pg_cron/pg_net call before
 * the secret check runs. Invoked by nw_run_account_worker (pg_cron) or an
 * operator; never by the app.
 */

import {
  createPostgrestMyNewsStore,
  type DeletionClaim,
  type MyNewsStore,
} from '../_shared/mynews-store.ts';
import {
  recordWorkerRun,
  tagLogOutcome,
  withRequestLog,
  type WorkerRunRecord,
} from '../_shared/mynews-observability.ts';
import {
  cleanUpProcessorAccount,
  type ProcessorCleanupResult,
} from './seams.ts';

declare const Deno:
  | {
      env: { get(key: string): string | undefined };
      serve?: (handler: (req: Request) => Response | Promise<Response>) => void;
    }
  | undefined;

const DEFAULT_BATCH_LIMIT = 25;
const MAX_BATCH_LIMIT = 200;

export interface AccountWorkerDeps {
  env: (key: string) => string | undefined;
  now: () => string;
  store: MyNewsStore;
  /** Processor-cleanup seam (injectable for tests). Defaults to the safe seam. */
  cleanUpProcessor?: (
    input: { requestId: string; userId: string; profileId: string | null },
    env: (key: string) => string | undefined,
  ) => Promise<ProcessorCleanupResult>;
  /**
   * Heartbeat sink (WP11). Wired to nw_worker_runs at the Deno.serve bootstrap;
   * left unset in unit tests so no test performs a network write. A heartbeat
   * failure never changes the worker's response: mynews-health reporting a stale
   * heartbeat is the honest outcome, and it must not turn a completed pass into a
   * failed one.
   */
  recordRun?: (record: WorkerRunRecord) => Promise<unknown>;
}

export interface AccountWorkerResult {
  ok: boolean;
  claimed: number;
  disposed: number;
  completed: number;
  authDeletionsDone: number;
  authDeletionsSkipped: number;
  processorCleanupsDone: number;
  processorCleanupsSkipped: number;
  failures: { requestId: string; error: string }[];
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

function expectedWorkerSecret(env: AccountWorkerDeps['env']): string | null {
  return stringOrNull(env('MYNEWS_ACCOUNT_WORKER_SECRET'));
}

function suppliedWorkerSecret(req: Request): string | null {
  const explicit = stringOrNull(req.headers.get('X-MyNews-Worker-Secret'));
  if (explicit) return explicit;
  const auth = req.headers.get('Authorization');
  const match = auth ? /^Bearer\s+(.+)$/i.exec(auth.trim()) : null;
  return match?.[1]?.trim() ?? null;
}

export async function runAccountWorker(
  deps: AccountWorkerDeps,
  limit: number = DEFAULT_BATCH_LIMIT,
): Promise<AccountWorkerResult> {
  const batch = Math.max(1, Math.min(MAX_BATCH_LIMIT, Math.floor(limit)));
  const cleanUpProcessor = deps.cleanUpProcessor ?? cleanUpProcessorAccount;

  const result: AccountWorkerResult = {
    ok: true,
    claimed: 0,
    disposed: 0,
    completed: 0,
    authDeletionsDone: 0,
    authDeletionsSkipped: 0,
    processorCleanupsDone: 0,
    processorCleanupsSkipped: 0,
    failures: [],
  };

  const claimed: DeletionClaim[] = await deps.store.claimDueAccountDeletions(deps.now(), batch);
  result.claimed = claimed.length;

  for (const claim of claimed) {
    try {
      // 1. Content disposition. One transaction; a non-'ok' outcome means the
      // row is not in a disposable state and must not proceed to side effects.
      const disposeOutcome = await deps.store.disposeAccountDeletion(claim.id);
      if (disposeOutcome !== 'ok') {
        await failRequest(deps, claim.id, `dispose -> ${disposeOutcome}`, result);
        continue;
      }
      result.disposed += 1;

      // 2. Auth user deletion. Disposition already detached the retained public
      // record from auth.users, so this cannot cascade it away.
      const authOutcome = await deps.store.deleteAuthUser(claim.userId);
      if (authOutcome === 'failed') {
        await recordState(deps, claim.id, 'auth_user_deletion_state', 'failed', 'admin API deletion failed');
        await failRequest(deps, claim.id, 'auth user deletion failed', result);
        continue;
      }
      await recordState(deps, claim.id, 'auth_user_deletion_state', authOutcome);
      if (authOutcome === 'done') result.authDeletionsDone += 1;
      else result.authDeletionsSkipped += 1;

      // 3. Processor cleanup. Unconfigured is an honest, visible skip.
      const processorOutcome = await cleanUpProcessor(
        { requestId: claim.id, userId: claim.userId, profileId: claim.profileId },
        deps.env,
      );
      if (processorOutcome.kind === 'error') {
        await recordState(
          deps,
          claim.id,
          'processor_cleanup_state',
          'failed',
          processorOutcome.detail,
        );
        await failRequest(deps, claim.id, processorOutcome.detail, result);
        continue;
      }
      const processorState =
        processorOutcome.kind === 'done' ? 'done' : 'skipped-unconfigured';
      await recordState(deps, claim.id, 'processor_cleanup_state', processorState);
      if (processorState === 'done') result.processorCleanupsDone += 1;
      else result.processorCleanupsSkipped += 1;

      // 4. Terminal success, only if the SQL agrees every precondition is met.
      const completeOutcome = await deps.store.completeAccountDeletion(claim.id);
      if (completeOutcome !== 'ok') {
        await failRequest(deps, claim.id, `complete -> ${completeOutcome}`, result);
        continue;
      }
      result.completed += 1;
    } catch (err) {
      // One bad request must not stop the batch, and it must not be left in
      // 'processing' with no explanation.
      await failRequest(deps, claim.id, errorMessage(err), result);
    }
  }

  if (result.failures.length > 0) result.ok = false;
  return result;
}

async function recordState(
  deps: AccountWorkerDeps,
  requestId: string,
  field: 'auth_user_deletion_state' | 'processor_cleanup_state',
  state: 'pending' | 'done' | 'skipped-unconfigured' | 'failed',
  detail?: string,
): Promise<void> {
  const outcome = await deps.store.recordAccountDeletionState({
    requestId,
    field,
    state,
    detail: detail ?? null,
  });
  if (outcome !== 'ok') {
    // A state we cannot record is a state we cannot trust; surface it by
    // throwing so the caller marks the request failed and retries.
    throw new Error(`record ${field} -> ${outcome}`);
  }
}

async function failRequest(
  deps: AccountWorkerDeps,
  requestId: string,
  detail: string,
  result: AccountWorkerResult,
): Promise<void> {
  result.failures.push({ requestId, error: detail });
  try {
    await deps.store.failAccountDeletion(requestId, detail);
  } catch (err) {
    // The row stays 'processing' and the stall reclaim in
    // nw_account_deletion_claim_due picks it up on a later pass.
    console.error('mynews account worker could not record a failure', errorMessage(err));
  }
}

export async function handleAccountWorkerRequest(
  req: Request,
  deps: AccountWorkerDeps,
): Promise<Response> {
  if (req.method !== 'POST') {
    return jsonError('method_not_allowed', 'POST only.', 405);
  }

  const expected = expectedWorkerSecret(deps.env);
  if (!expected) {
    return jsonError('config', 'MYNEWS_ACCOUNT_WORKER_SECRET is not configured.', 503);
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
    const result = await runAccountWorker(deps, limit);
    await heartbeat(deps, {
      worker: 'mynews-account-worker',
      ok: result.ok,
      startedAt,
      processed: result.completed,
      failures: result.failures.length,
      detail: result.ok
        ? `claimed ${result.claimed}, disposed ${result.disposed}, completed ${result.completed}`
        : `${result.failures.length} request failures in a pass that claimed ${result.claimed}`,
    });
    return jsonResponse(result as unknown as Record<string, unknown>, result.ok ? 200 : 207);
  } catch (err) {
    await heartbeat(deps, {
      worker: 'mynews-account-worker',
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
async function heartbeat(deps: AccountWorkerDeps, record: WorkerRunRecord): Promise<void> {
  if (!deps.recordRun) return;
  try {
    await deps.recordRun(record);
  } catch (err) {
    console.error('mynews account worker heartbeat failed', errorMessage(err));
  }
}

if (typeof Deno !== 'undefined' && typeof Deno.serve === 'function') {
  const env = (key: string) => Deno!.env.get(key);
  const now = () => new Date().toISOString();
  Deno.serve(
    withRequestLog(
      { fn: 'mynews-account-worker', action: 'run_pass' },
      async (req) => {
        let store: MyNewsStore;
        try {
          store = createPostgrestMyNewsStore(env, fetch);
        } catch (err) {
          return jsonError('config', errorMessage(err), 503);
        }
        return handleAccountWorkerRequest(req, {
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
