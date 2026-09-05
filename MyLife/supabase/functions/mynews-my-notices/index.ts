// MyNews my-notices: DSA Art 17 statement-of-reasons read for the caller, plus
// the appeal path against those actions (plan 48 WP9).
//
// nw_moderation_actions is service-role-only (migration 20260705000007): no
// client can read the audit trail. The EU Digital Services Act Art 17 still
// requires that a user whose content was moderated can see WHY, and Art 20
// requires an internal complaint-handling route against those decisions. This
// function is the sanctioned path for both: verify_jwt is ON, so the caller is
// resolved from the JWT sub, and the service-role store calls
// nw_get_my_moderation_notices_v2 and nw_moderation_appeal_request (both
// SECURITY DEFINER, migrations 20260705000010 and 20260730000010), which scope
// every row and every write to content the caller OWNS.
//
// The appeal is a POST carrying an explicit action, so the plain read stays
// exactly as it was and nothing about the existing read path changes.

import { jsonError, jsonOk, parseJwtSub, serveEnvelope } from '../_shared/mynews-http.ts';
import { annotateRequestLog } from '../_shared/mynews-observability.ts';
import {
  createPostgrestMyNewsStore,
  type MyNewsStore,
} from '../_shared/mynews-store.ts';

export interface MyNoticesDeps {
  store: MyNewsStore;
}

export const APPEAL_REASON_MAX_CHARS = 2000;

interface AppealRequest {
  action: 'appeal';
  actionId: string;
  reason: string;
}

/**
 * Parse an appeal body. Returns null for anything that is not a well-formed
 * appeal, which the caller reports as a validation failure rather than guessing.
 */
export function parseAppealBody(body: unknown): AppealRequest | null {
  if (!body || typeof body !== 'object') return null;
  const candidate = body as Record<string, unknown>;
  if (candidate.action !== 'appeal') return null;
  const actionId = typeof candidate.actionId === 'string' ? candidate.actionId.trim() : '';
  const reason = typeof candidate.reason === 'string' ? candidate.reason.trim() : '';
  if (actionId === '') return null;
  if (reason === '' || reason.length > APPEAL_REASON_MAX_CHARS) return null;
  return { action: 'appeal', actionId, reason };
}

export async function handleMyNoticesRequest(req: Request, deps: MyNoticesDeps): Promise<Response> {
  // GET (or POST) both work for the read. DMCA status lookup uses query
  // parameters so that request stays idempotent and does not weaken the JWT gate.
  if (req.method !== 'GET' && req.method !== 'POST') {
    return jsonError('bad-payload', 405, 'GET or POST only');
  }

  const userId = parseJwtSub(req);
  if (!userId) return jsonError('not-signed-in', 401, 'sign in to view your notices');

  if (req.method === 'POST') {
    let body: unknown = null;
    try {
      body = await req.json();
    } catch {
      body = null;
    }
    // A POST that carries an action is an appeal; a POST with no action is the
    // read, which is how this endpoint behaved before appeals existed.
    if (body && typeof body === 'object' && 'action' in (body as Record<string, unknown>)) {
      // Static label, not the caller's string: the only action this branch
      // serves is the appeal, and an unparsed body must not reach the log line.
      annotateRequestLog(req, { action: 'appeal' });
      return handleAppeal(userId, body, deps);
    }
  }

  const notices = await deps.store.getMyModerationNotices(userId);
  const url = new URL(req.url);
  const noticeId = url.searchParams.get('noticeId')?.trim() ?? '';
  const email = url.searchParams.get('email')?.trim() ?? '';
  const kind = url.searchParams.get('kind')?.trim() ?? '';
  const wantsDmcaStatus = noticeId.length > 0 || email.length > 0 || kind.length > 0;
  if (wantsDmcaStatus && (!noticeId || !email || (kind !== 'takedown' && kind !== 'counter'))) {
    return jsonError('validation', 400, 'kind, noticeId, and email are required together');
  }

  const dmcaSubmission = wantsDmcaStatus
    ? await deps.store.getMyDmcaSubmissionStatus({
        userId,
        kind: kind as 'takedown' | 'counter',
        noticeId,
        email,
      })
    : null;
  return jsonOk({ notices, dmcaSubmission });
}

/**
 * File an appeal against one moderation action on the caller's own content.
 *
 * Fail closed: a store error is a retryable 503 and NOT a recorded appeal, so a
 * user is never told their appeal is in the queue when nothing was written. A
 * suspended author keeps this path, exactly as they keep the screening appeal
 * path, because the appeal may be against the suspension itself.
 */
async function handleAppeal(
  userId: string,
  body: unknown,
  deps: MyNoticesDeps,
): Promise<Response> {
  const parsed = parseAppealBody(body);
  if (!parsed) return jsonError('bad-payload', 400, 'an appeal needs an actionId and a reason');

  const profileId = await deps.store.getProfileIdByUserId(userId);
  if (!profileId) return jsonError('no-profile', 403, 'create a profile before appealing');

  let outcome: Awaited<ReturnType<MyNewsStore['appealModerationAction']>>;
  try {
    outcome = await deps.store.appealModerationAction({
      appellantProfileId: profileId,
      actionId: parsed.actionId,
      reason: parsed.reason,
    });
  } catch (error) {
    console.error('mynews moderation appeal failed', error);
    return jsonError('appeals-unavailable', 503, 'could not record the appeal, try again');
  }

  switch (outcome) {
    case 'ok':
      return jsonOk({
        appealState: 'requested',
        message: 'Your appeal is in the review queue. You will see the decision here.',
      });
    case 'not-found':
      // A missing action and someone else's action answer identically, so this
      // cannot be used to probe which action ids exist.
      return jsonError('not-found', 404, 'no action of yours matches that reference');
    case 'not-appealable':
      return jsonError(
        'not-appealable',
        409,
        'that record is not an adverse action, so there is nothing to appeal',
      );
    case 'already-appealed':
      return jsonError('already-appealed', 409, 'you have already appealed this action');
    case 'bad-reason':
      return jsonError('bad-payload', 400, 'an appeal needs a reason');
    default:
      return jsonError('appeals-unavailable', 503, 'could not record the appeal, try again');
  }
}

declare const Deno:
  | { serve: (h: (req: Request) => Promise<Response>) => void; env: { get(k: string): string | undefined } }
  | undefined;

if (typeof Deno !== 'undefined' && Deno?.serve) {
  const env = (key: string) => Deno!.env.get(key);
  const store = createPostgrestMyNewsStore(env, fetch);
  Deno.serve(
    serveEnvelope((req) => handleMyNoticesRequest(req, { store }), {
      fn: 'mynews-my-notices',
      action: 'list_notices',
    }),
  );
}
