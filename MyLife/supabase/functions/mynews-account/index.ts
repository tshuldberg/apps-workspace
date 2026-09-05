// MyNews account rights: deletion and full personal-data export (plan 48 WP5,
// audit finding C08). User-facing, so gateway JWT verification stays ON and the
// caller is resolved from the verified token's sub.
//
// Deletion is never an in-request wipe. initiate_deletion opens a 7-day grace
// row the user can cancel for the whole window; the mynews-account-worker
// performs the content disposition after it elapses. Both guards on initiate are
// mandatory:
//   * the typed confirmation string must match exactly, and
//   * the access token must be fresh (iat within 10 minutes).
// The freshness check is a fresh-session signal, not proof of a re-typed
// credential (a silent refresh also mints a fresh token), which is exactly why
// the cancellable grace window and the typed phrase both exist. The typed error
// 'reauth-required' tells the app to send the user through sign-in again.
//
// export_data runs synchronously: one consistent snapshot of every user-owned
// row is returned in the envelope and an nw_export_jobs audit row records the
// request. The bundle is bounded; over the bound the request fails with a typed
// error and a 'failed' audit row rather than returning a truncated export.
//
// Suspended users keep both paths. Deletion and export are rights, not
// privileges, so the suspension gate that guards publish/suggest does not apply.

import { jsonError, jsonOk, parseJwtClaims, serveEnvelope } from '../_shared/mynews-http.ts';
import { annotateRequestLog } from '../_shared/mynews-observability.ts';
import {
  createPostgrestMyNewsStore,
  type DeletionRequestRow,
  type MyNewsStore,
} from '../_shared/mynews-store.ts';

export interface AccountDeps {
  store: MyNewsStore;
  now?: () => number;
}

/** Exact phrase the user must type to open a deletion request. */
export const DELETION_CONFIRMATION_PHRASE = 'DELETE MY ACCOUNT';

/**
 * Disclosed grace window. Mirrors "interval '7 days'" in
 * supabase/migrations/20260730000006_mynews_account_lifecycle.sql; a drift test
 * pins the two together.
 */
export const MYNEWS_DELETION_GRACE_DAYS = 7;

/** Maximum access-token age accepted for a deletion request, in seconds. */
export const REAUTH_MAX_TOKEN_AGE_SECONDS = 10 * 60;

/**
 * Response bound for one export. Edge runtimes have hard memory and response
 * limits, so a bundle past this is refused with a typed error (and a 'failed'
 * audit row) instead of being silently truncated.
 */
export const MAX_EXPORT_BYTES = 8 * 1024 * 1024;

type AccountAction = 'initiate_deletion' | 'cancel_deletion' | 'deletion_status' | 'export_data';

const ACTIONS = new Set<AccountAction>([
  'initiate_deletion',
  'cancel_deletion',
  'deletion_status',
  'export_data',
]);

interface AccountBody {
  action: AccountAction;
  confirmation: string;
}

function parseBody(raw: unknown): AccountBody | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const b = raw as Record<string, unknown>;
  if (typeof b.action !== 'string' || !ACTIONS.has(b.action as AccountAction)) return null;
  if (b.confirmation != null && typeof b.confirmation !== 'string') return null;
  return {
    action: b.action as AccountAction,
    confirmation: typeof b.confirmation === 'string' ? b.confirmation : '',
  };
}

/** Status view sent to the client. Every side-effect state stays visible. */
export interface DeletionStatusView {
  requestId: string;
  status: DeletionRequestRow['status'];
  requestedAt: string;
  graceEndsAt: string;
  graceDays: number;
  cancellable: boolean;
  cancelledAt: string | null;
  completedAt: string | null;
  failureDetail: string | null;
  authUserDeletionState: DeletionRequestRow['authUserDeletionState'];
  processorCleanupState: DeletionRequestRow['processorCleanupState'];
}

export function toDeletionStatusView(row: DeletionRequestRow): DeletionStatusView {
  return {
    requestId: row.id,
    status: row.status,
    requestedAt: row.requestedAt,
    graceEndsAt: row.graceEndsAt,
    graceDays: MYNEWS_DELETION_GRACE_DAYS,
    // Only a grace-period request can still be called off; once disposition
    // starts there is nothing honest left to cancel.
    cancellable: row.status === 'grace',
    cancelledAt: row.cancelledAt,
    completedAt: row.completedAt,
    failureDetail: row.failureDetail,
    authUserDeletionState: row.authUserDeletionState,
    processorCleanupState: row.processorCleanupState,
  };
}

export async function handleAccountRequest(req: Request, deps: AccountDeps): Promise<Response> {
  if (req.method !== 'POST') return jsonError('bad-payload', 405, 'POST only');

  const claims = parseJwtClaims(req);
  if (!claims) return jsonError('not-signed-in', 401, 'sign in to manage your account');

  let body: AccountBody | null = null;
  try {
    body = parseBody(await req.json());
  } catch {
    body = null;
  }
  if (!body) return jsonError('bad-payload', 400);

  // Only a parsed, whitelisted action reaches the log line.
  annotateRequestLog(req, { action: body.action });

  const nowMs = (deps.now ?? Date.now)();

  // The profile may not exist (a reader who never registered one). Deletion and
  // export both still work: the auth user and its terms acceptances are real
  // data. A read failure fails the request closed.
  let profileId: string | null = null;
  try {
    profileId = await deps.store.getProfileIdByUserId(claims.sub);
  } catch (error) {
    console.error('mynews account profile resolution failed', error);
    return jsonError('account-unavailable', 503, 'account actions are temporarily unavailable');
  }

  switch (body.action) {
    case 'initiate_deletion':
      return initiateDeletion(deps, claims, profileId, body, nowMs);
    case 'cancel_deletion':
      return cancelDeletion(deps, claims.sub);
    case 'deletion_status':
      return deletionStatus(deps, claims.sub);
    case 'export_data':
      return exportData(deps, claims.sub, profileId);
    default:
      return jsonError('bad-payload', 400);
  }
}

async function initiateDeletion(
  deps: AccountDeps,
  claims: { sub: string; iat: number | null },
  profileId: string | null,
  body: AccountBody,
  nowMs: number,
): Promise<Response> {
  // Typed confirmation first: it is the cheapest guard and the clearest signal
  // of intent. Compared exactly, with no trimming or case folding.
  if (body.confirmation !== DELETION_CONFIRMATION_PHRASE) {
    return jsonError(
      'confirmation-mismatch',
      400,
      `type ${DELETION_CONFIRMATION_PHRASE} exactly to confirm`,
    );
  }

  // Fresh-session requirement. A token with no iat cannot be aged, so it fails
  // closed. A token issued in the future beyond a small clock-skew allowance is
  // also rejected.
  const ageSeconds = claims.iat === null ? null : Math.floor(nowMs / 1000) - claims.iat;
  if (ageSeconds === null || ageSeconds > REAUTH_MAX_TOKEN_AGE_SECONDS || ageSeconds < -60) {
    return jsonError('reauth-required', 401, 'sign in again, then confirm deletion');
  }

  try {
    const result = await deps.store.initiateAccountDeletion(claims.sub, profileId);
    if (result.outcome === 'created' || result.outcome === 'existing') {
      return jsonOk({
        created: result.outcome === 'created',
        request: toDeletionStatusView(result.request),
      });
    }
    console.error('mynews account deletion initiate outcome', result.outcome);
    return jsonError('deletion-unavailable', 503, 'could not open a deletion request');
  } catch (error) {
    console.error('mynews account deletion initiate failed', error);
    return jsonError('deletion-unavailable', 503, 'could not open a deletion request');
  }
}

async function cancelDeletion(deps: AccountDeps, userId: string): Promise<Response> {
  let outcome: Awaited<ReturnType<MyNewsStore['cancelAccountDeletion']>>;
  try {
    outcome = await deps.store.cancelAccountDeletion(userId);
  } catch (error) {
    console.error('mynews account deletion cancel failed', error);
    return jsonError('deletion-unavailable', 503, 'could not cancel the deletion request');
  }

  switch (outcome) {
    case 'ok':
      return jsonOk({ cancelled: true });
    case 'not-found':
      return jsonError('no-deletion-request', 404, 'no deletion request to cancel');
    case 'not-cancellable':
      return jsonError(
        'not-cancellable',
        409,
        'this deletion has already started and can no longer be cancelled',
      );
    default:
      console.error('mynews account deletion cancel unknown outcome', outcome);
      return jsonError('deletion-unavailable', 503);
  }
}

async function deletionStatus(deps: AccountDeps, userId: string): Promise<Response> {
  try {
    const row = await deps.store.getAccountDeletionStatus(userId);
    return jsonOk({ request: row ? toDeletionStatusView(row) : null });
  } catch (error) {
    console.error('mynews account deletion status read failed', error);
    return jsonError('deletion-unavailable', 503, 'could not read the deletion status');
  }
}

async function exportData(
  deps: AccountDeps,
  userId: string,
  profileId: string | null,
): Promise<Response> {
  let serialized: string;
  try {
    const bundle = await deps.store.exportAccountBundle(userId, profileId);
    serialized = JSON.stringify(bundle);
  } catch (error) {
    console.error('mynews account export read failed', error);
    // The audit row is best-effort: a failed export must never be reported as a
    // success, but a failed audit write must not mask the original failure.
    await recordExportSafely(deps, userId, profileId, 'failed', 0, 'export read failed');
    return jsonError('export-unavailable', 503, 'could not build your export');
  }

  const byteCount = new TextEncoder().encode(serialized).length;
  if (byteCount > MAX_EXPORT_BYTES) {
    await recordExportSafely(
      deps,
      userId,
      profileId,
      'failed',
      byteCount,
      `bundle of ${byteCount} bytes exceeds the ${MAX_EXPORT_BYTES} byte response bound`,
    );
    return jsonError(
      'export-too-large',
      413,
      'your export is too large to return in one response; contact the legal contact for a manual copy',
    );
  }

  await recordExportSafely(deps, userId, profileId, 'completed', byteCount);

  return jsonOk({
    byteCount,
    // Parsed back so the envelope carries real JSON rather than a JSON string.
    bundle: JSON.parse(serialized) as unknown,
  });
}

async function recordExportSafely(
  deps: AccountDeps,
  userId: string,
  profileId: string | null,
  status: 'completed' | 'failed',
  byteCount: number,
  detail?: string,
): Promise<void> {
  try {
    await deps.store.recordAccountExport({ userId, profileId, status, byteCount, detail });
  } catch (error) {
    console.error('mynews account export audit write failed', error);
  }
}

declare const Deno:
  | { serve: (h: (req: Request) => Promise<Response>) => void; env: { get(k: string): string | undefined } }
  | undefined;

if (typeof Deno !== 'undefined' && Deno?.serve) {
  const env = (key: string) => Deno!.env.get(key);
  const store = createPostgrestMyNewsStore(env, fetch);
  Deno.serve(
    serveEnvelope((req) => handleAccountRequest(req, { store }), {
      fn: 'mynews-account',
      action: 'account',
    }),
  );
}
