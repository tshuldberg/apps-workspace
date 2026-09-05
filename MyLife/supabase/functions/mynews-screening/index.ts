// MyNews author-facing screening reads and appeals (plan 48 WP8).
//
// When pre-publication screening holds a submission, the author needs two
// things the write edges cannot give them: a list of what is held and a way to
// contest it. This function is that surface.
//
// What it deliberately does NOT return: class scores, signal codes, thresholds,
// or the lexicon that matched. An author is owed an honest reason and a route to
// a person; handing back the detector's internals would turn the appeal screen
// into an evasion oracle. The curated shape comes from
// nw_get_my_screening_decisions, which omits those columns at the SQL layer, so
// this restraint is enforced in the database rather than by this handler
// remembering to strip fields.
//
// verify_jwt stays ON; every read and appeal is scoped to the JWT subject.

import { jsonError, jsonOk, parseJwtSub, serveEnvelope } from '../_shared/mynews-http.ts';
import { annotateRequestLog } from '../_shared/mynews-observability.ts';
import {
  createPostgrestMyNewsStore,
  type MyNewsStore,
} from '../_shared/mynews-store.ts';

export interface ScreeningDeps {
  store: MyNewsStore;
  now?: () => number;
}

export const APPEAL_REASON_MAX_CHARS = 2000;

interface ListBody {
  action: 'list';
}

interface AppealBody {
  action: 'appeal';
  decisionId: string;
  reason: string;
}

type ScreeningBody = ListBody | AppealBody;

function parseBody(raw: unknown): ScreeningBody | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const b = raw as Record<string, unknown>;
  if (b.action === 'list') return { action: 'list' };
  if (b.action !== 'appeal') return null;
  if (typeof b.decisionId !== 'string' || b.decisionId.trim() === '') return null;
  if (typeof b.reason !== 'string') return null;
  const reason = b.reason.trim();
  if (reason === '' || reason.length > APPEAL_REASON_MAX_CHARS) return null;
  return { action: 'appeal', decisionId: b.decisionId, reason };
}

export async function handleScreeningRequest(
  req: Request,
  deps: ScreeningDeps,
): Promise<Response> {
  if (req.method !== 'POST') return jsonError('bad-payload', 405, 'POST only');

  const userId = parseJwtSub(req);
  if (!userId) return jsonError('not-signed-in', 401, 'sign in to see held submissions');

  let body: ScreeningBody | null = null;
  try {
    body = parseBody(await req.json());
  } catch {
    body = null;
  }
  if (!body) return jsonError('bad-payload', 400);

  // Only a parsed, whitelisted action reaches the log line.
  annotateRequestLog(req, { action: body.action });

  if (body.action === 'list') {
    try {
      const decisions = await deps.store.getMyScreeningDecisions(userId);
      return jsonOk({ decisions });
    } catch (error) {
      console.error('mynews screening decision read failed', error);
      return jsonError('screening-unavailable', 503, 'screening review is temporarily unavailable');
    }
  }

  const profileId = await deps.store.getProfileIdByUserId(userId);
  if (!profileId) return jsonError('no-profile', 403);

  // A suspended author keeps the appeal path, exactly as a suspended reporter
  // keeps the report path: contesting an enforcement decision is not a
  // privilege that enforcement should be able to remove.
  let outcome: Awaited<ReturnType<MyNewsStore['appealScreeningDecision']>>;
  try {
    outcome = await deps.store.appealScreeningDecision({
      decisionId: body.decisionId,
      authorProfileId: profileId,
      reason: body.reason,
    });
  } catch (error) {
    console.error('mynews screening appeal failed', error);
    return jsonError('screening-unavailable', 503, 'screening review is temporarily unavailable');
  }

  switch (outcome) {
    case 'ok':
      return jsonOk({
        decisionId: body.decisionId,
        appealState: 'requested',
        message: 'Your appeal is in the review queue. You will see the decision here.',
      });
    case 'not-found':
      // Same response for a missing decision and for someone else's decision, so
      // this endpoint cannot be used to probe which decision ids exist.
      return jsonError('not-found', 404, 'that submission could not be found');
    case 'not-author':
      return jsonError('not-found', 404, 'that submission could not be found');
    case 'not-appealable':
      return jsonError('not-appealable', 409, 'that submission was not held, so there is nothing to appeal');
    case 'already-appealed':
      return jsonError('already-appealed', 409, 'you have already appealed this decision');
    case 'bad-reason':
      return jsonError('bad-payload', 400, 'an appeal needs a reason');
    default:
      return jsonError('screening-unavailable', 503, 'screening review is temporarily unavailable');
  }
}

declare const Deno:
  | { serve: (h: (req: Request) => Promise<Response>) => void; env: { get(k: string): string | undefined } }
  | undefined;

if (typeof Deno !== 'undefined' && Deno?.serve) {
  const env = (key: string) => Deno!.env.get(key);
  const store = createPostgrestMyNewsStore(env, fetch);
  Deno.serve(
    serveEnvelope((req) => handleScreeningRequest(req, { store }), {
      fn: 'mynews-screening',
      action: 'screening',
    }),
  );
}
