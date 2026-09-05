// MyNews comment: the last unguarded public mutation moves behind a server
// boundary (plan 48 WP4). Comments used to be a direct PostgREST insert into
// nw_suggestion_events under an RLS policy: no suspension check, no current-
// Terms check, no rate limit, and no length limit. Migration 20260730000003
// drops that policy and adds a client-write guard trigger, so this function is
// now the only way a comment reaches the table.
//
// verify_jwt stays ON (gateway-verified, like publish and suggest); the actor
// is resolved from the JWT sub, so every comment is attributable. Any throttle
// read failure returns a retryable 503 rather than letting a failed count read
// as an empty window.

import { jsonError, jsonOk, parseJwtSub, serveEnvelope } from '../_shared/mynews-http.ts';
import { EDGE_BOUNDS_ERROR, checkCommentBody } from '../_shared/mynews-bounds.ts';
import { EDGE_CURRENT_TERMS_VERSION } from '../_shared/mynews-terms.ts';
import {
  createPostgrestMyNewsStore,
  type MyNewsStore,
} from '../_shared/mynews-store.ts';
import {
  recordScreeningAllowIfNeeded,
  runScreeningGate,
  screeningHoldDetail,
} from '../_shared/mynews-screening-gate.ts';
import type { ScreeningProvider } from '../_shared/mynews-screening.ts';

export interface CommentDeps {
  store: MyNewsStore;
  now?: () => number;
  /**
   * Optional external screening vendor (plan 48 WP8). Undefined resolves from
   * the environment; explicit null forces local-only screening.
   */
  screeningProvider?: ScreeningProvider | null;
  env?: (key: string) => string | undefined;
}

// Durable per-profile throttle. Counted over the real nw_suggestion_events
// comment rows (not in-process state), so it survives restarts and holds
// across every edge instance.
const RATE_WINDOW_MS = 60_000;
const RATE_MAX_IN_WINDOW = 10;

interface CommentBody {
  suggestionId: string;
  body: string;
}

function parseBody(raw: unknown): CommentBody | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const b = raw as Record<string, unknown>;
  if (typeof b.suggestionId !== 'string' || b.suggestionId.trim() === '') return null;
  if (typeof b.body !== 'string') return null;
  return { suggestionId: b.suggestionId, body: b.body };
}

export async function handleCommentRequest(req: Request, deps: CommentDeps): Promise<Response> {
  if (req.method !== 'POST') return jsonError('bad-payload', 405, 'POST only');

  // Commenting requires a session: attributable comments are the anti-flood bar.
  const userId = parseJwtSub(req);
  if (!userId) return jsonError('not-signed-in', 401, 'sign in to comment');

  const actorProfileId = await deps.store.getProfileIdByUserId(userId);
  if (!actorProfileId) return jsonError('no-profile', 403);

  const nowMs = (deps.now ?? Date.now)();

  // A suspended account cannot comment (enforcement teeth, Plan 39 T8). Unlike
  // reporting, commenting is not a safety path, so suspension is a hard stop.
  if (await deps.store.isProfileSuspended(actorProfileId, new Date(nowMs).toISOString())) {
    return jsonError('suspended', 403);
  }

  // Throttle before the terms read, the body work, and the thread reads: the
  // cheap count is what bounds a flood regardless of what follows. A failed
  // count is never a bypass, so the whole request fails closed and retryable.
  try {
    const sinceIso = new Date(nowMs - RATE_WINDOW_MS).toISOString();
    const recent = await deps.store.countRecentSuggestionComments(actorProfileId, sinceIso);
    if (recent >= RATE_MAX_IN_WINDOW) return jsonError('rate-limited', 429);
  } catch (error) {
    console.error('mynews comment throttle count failed', error);
    return jsonError('comment-unavailable', 503, 'commenting is temporarily unavailable');
  }

  // Terms gate (DSA + ToS, Plan 39 T11): the actor must have accepted the
  // CURRENT terms version, exactly as publish, suggest, and review require.
  if (!(await deps.store.hasAcceptedTerms(userId, EDGE_CURRENT_TERMS_VERSION))) {
    return jsonError('terms-not-accepted', 403, EDGE_CURRENT_TERMS_VERSION);
  }

  let body: CommentBody | null = null;
  try {
    body = parseBody(await req.json());
  } catch {
    body = null;
  }
  if (!body) return jsonError('bad-payload', 400);

  const bounded = checkCommentBody(body.body);
  if (!bounded.ok) return jsonError(EDGE_BOUNDS_ERROR, 400, bounded.failure.detail);

  const suggestion = await deps.store.getSuggestion(body.suggestionId);
  if (!suggestion) return jsonError('unknown-suggestion', 404);

  const head = await deps.store.getArticleHead(suggestion.articleId);
  if (!head) return jsonError('unknown-article', 404);

  // Visibility mirrors the mynews-suggest draft-scope gate exactly: a thread on
  // a published or retracted article is public, and a thread on a draft is
  // visible only to the author and the draft's newsroom members. A draft with
  // no newsroom is unreachable through the publish RPC; deny defensively.
  if (head.status === 'draft' && head.authorProfileId !== actorProfileId) {
    const role = head.newsroomId
      ? await deps.store.getNewsroomRole(head.newsroomId, actorProfileId)
      : null;
    if (role === null) return jsonError('draft-access', 403);
  }

  // Pre-publication screening (plan 48 WP8). Comments are the highest-volume
  // and lowest-friction write path, so they run the same engine the article path
  // runs: a held comment is stored non-public with its decision row and never
  // appears in the thread, not even to newsroom members.
  const screening = await runScreeningGate({
    store: deps.store,
    kind: 'comment',
    authorProfileId: actorProfileId,
    text: body.body,
    env: deps.env,
    ...(deps.screeningProvider !== undefined ? { provider: deps.screeningProvider } : {}),
  });
  if (screening.decision === 'unavailable') {
    return jsonError('screening-unavailable', 503, screening.detail);
  }
  if (screening.decision === 'hold') {
    const held = await deps.store.quarantineComment({
      suggestionId: body.suggestionId,
      actorProfileId,
      body: body.body,
      verdict: screening.verdict,
      contentSha256: screening.contentSha256,
    });
    if (!held.ok) {
      if (held.code === 'unknown-suggestion') return jsonError('unknown-suggestion', 404);
      if (held.code === 'unknown-actor') return jsonError('no-profile', 403);
      return jsonError('screening-unavailable', 503, 'screening is temporarily unavailable');
    }
    return jsonError(
      'screening-quarantined',
      202,
      `${screeningHoldDetail(screening.verdict)} Reference: ${held.decisionId}`,
    );
  }

  const result = await deps.store.insertSuggestionComment({
    suggestionId: body.suggestionId,
    actorProfileId,
    body: body.body,
  });
  if (result === 'unknown-suggestion') return jsonError('unknown-suggestion', 404);
  if (result === 'unknown-actor') return jsonError('no-profile', 403);
  if (result !== 'ok') {
    // The RPC re-validated the bounds this handler already checked; a mismatch
    // is a server bug, not a client error, and must not read as success.
    console.error('mynews comment insert rejected by the RPC', result);
    return jsonError('comment-unavailable', 503, 'commenting is temporarily unavailable');
  }

  // The event id is minted inside the insert RPC, so a recorded allow for a
  // comment is keyed on the thread it landed in. That is enough for
  // false-negative measurement, which aggregates by class and author.
  await recordScreeningAllowIfNeeded({
    store: deps.store,
    kind: 'comment',
    contentId: body.suggestionId,
    contentRev: null,
    authorProfileId: actorProfileId,
    contentSha256: screening.contentSha256,
    verdict: screening.verdict,
  });

  return jsonOk({ suggestionId: body.suggestionId });
}

declare const Deno:
  | { serve: (h: (req: Request) => Promise<Response>) => void; env: { get(k: string): string | undefined } }
  | undefined;

if (typeof Deno !== 'undefined' && Deno?.serve) {
  const env = (key: string) => Deno!.env.get(key);
  const store = createPostgrestMyNewsStore(env, fetch);
  Deno.serve(
    serveEnvelope((req) => handleCommentRequest(req, { store }), {
      fn: 'mynews-comment',
      action: 'comment',
    }),
  );
}
