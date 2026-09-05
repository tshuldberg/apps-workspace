// MyNews review: the author decides. Accept and partial REQUIRE a new
// author-signed revision (the server never composes article text); reject is
// a status change with an optional note threaded onto the event. The C4 batch
// form accepts N same-article suggestions under ONE revision, atomically.
// Credibility awards are computed here from aggregates v2 plus the C7
// standing override and written with the decision.

import { jsonError, jsonOk, parseJwtSub, serveEnvelope } from '../_shared/mynews-http.ts';
import {
  EDGE_BOUNDS_ERROR,
  EDGE_MYNEWS_BOUNDS,
  checkBody,
  checkChangelogEntryCount,
  checkDek,
  checkHeadline,
  type BoundsResult,
} from '../_shared/mynews-bounds.ts';
import { EDGE_CURRENT_TERMS_VERSION } from '../_shared/mynews-terms.ts';
import {
  BASE_POINTS,
  authorStandingForTier,
  diversityMultiplier,
  standingMultiplier,
} from '../_shared/mynews-cred.ts';
import {
  canonicalRejectBytes,
  canonicalRevisionBytes,
  verifyEd25519,
  type WireRevision,
} from '../_shared/mynews-signing.ts';
import {
  createPostgrestMyNewsStore,
  type ArticleHead,
  type AwardInput,
  type MyNewsStore,
  type StoredSuggestion,
} from '../_shared/mynews-store.ts';
import { resolveSigningKey } from '../_shared/mynews-key-verify.ts';
import {
  recordScreeningAllowIfNeeded,
  runScreeningGate,
  screeningHoldDetail,
} from '../_shared/mynews-screening-gate.ts';
import type { ScreeningProvider } from '../_shared/mynews-screening.ts';
import { isCreatedAtInBounds } from '../_shared/mynews-time.ts';

export interface ReviewDeps {
  store: MyNewsStore;
  verify?: typeof verifyEd25519;
  now?: () => number;
  /**
   * Optional external screening vendor (plan 48 WP8). Undefined resolves from
   * the environment; explicit null forces local-only screening.
   */
  screeningProvider?: ScreeningProvider | null;
  env?: (key: string) => string | undefined;
}

interface ReviewBody {
  suggestionId?: string;
  suggestionIds?: string[];
  decision: 'accept' | 'reject' | 'partial';
  revision?: WireRevision;
  signatureHex?: string;
  note?: string;
}

// Canonical: CHANGELOG_NOTE_MAX_CHARS. This constant WAS the source of the
// canonical value, so the two are equal by construction (plan 48 WP4).
const MAX_NOTE_CHARS = EDGE_MYNEWS_BOUNDS.CHANGELOG_NOTE_MAX_CHARS;

/** First failing bound across the revision's text fields, or null. */
function revisionBoundsFailure(revision: WireRevision): string | null {
  const checks: BoundsResult[] = [
    checkHeadline(revision.headline),
    checkDek(revision.dek),
    checkBody(revision.bodyMd),
    checkChangelogEntryCount(revision.changelog),
  ];
  for (const check of checks) {
    if (!check.ok) return check.failure.detail;
  }
  return null;
}

function parseBody(raw: unknown): ReviewBody | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const b = raw as Record<string, unknown>;
  if (b.decision !== 'accept' && b.decision !== 'reject' && b.decision !== 'partial') return null;
  const hasSingle = typeof b.suggestionId === 'string';
  const hasBatch = b.suggestionIds !== undefined;
  // C4: exactly one of suggestionId / suggestionIds.
  if (hasSingle === hasBatch) return null;
  if (hasBatch) {
    const ids = b.suggestionIds;
    if (!Array.isArray(ids) || ids.length === 0 || !ids.every((id) => typeof id === 'string')) {
      return null;
    }
    if (new Set(ids).size !== ids.length) return null;
    // C4: the batch form is accept-only.
    if (b.decision !== 'accept') return null;
  }
  // C4: the note rides rejects only, capped at 2000 chars.
  if (b.note !== undefined) {
    if (b.decision !== 'reject' || typeof b.note !== 'string' || b.note.length > MAX_NOTE_CHARS) {
      return null;
    }
  }
  return raw as ReviewBody;
}

/**
 * C4 changelog credit validation: the revision's changelog must be exactly
 * the accepted set (no missing entries, no extras, no duplicates), each entry
 * carrying the suggestion's type and the editor's REGISTERED pubkey. Returns
 * a distinguishing detail string on mismatch, null when valid.
 */
function changelogMismatch(
  changelog: WireRevision['changelog'],
  suggestions: StoredSuggestion[],
  registeredPubkeys: Record<string, string>,
): string | null {
  if (changelog.length !== suggestions.length) {
    return 'changelog must credit exactly the accepted suggestions';
  }
  const byId = new Map(suggestions.map((s) => [s.id, s]));
  const seen = new Set<string>();
  for (const entry of changelog) {
    const suggestion = byId.get(entry.suggestionId);
    if (!suggestion || seen.has(entry.suggestionId)) {
      return `changelog entry ${entry.suggestionId} is not an accepted suggestion`;
    }
    seen.add(entry.suggestionId);
    if (entry.type !== suggestion.type) {
      return `changelog type mismatch for ${entry.suggestionId}`;
    }
    // The typeof guard keeps this fail-closed even when the editor has no
    // registered pubkey (undefined === undefined must never pass).
    if (
      typeof entry.editorKey !== 'string' ||
      entry.editorKey !== registeredPubkeys[suggestion.editorProfileId]
    ) {
      return `changelog editor key mismatch for ${entry.suggestionId}`;
    }
  }
  return null;
}

/**
 * Per-suggestion award (C7 + anti-gaming): base points by type, EXCEPT
 * self-edits (plan section 5.3: suggestions on your own articles earn zero;
 * the ledger row is still written for auditability); diversity from the
 * editor's aggregates v2; standing from the accepting author's journalist
 * tier (the aggregates RPC's 0.5 baseline is no longer used for awards).
 */
function buildAward(
  suggestion: StoredSuggestion,
  head: ArticleHead,
  distinctAuthors: number,
): AwardInput {
  return {
    editorProfileId: suggestion.editorProfileId,
    basePoints:
      suggestion.editorProfileId === head.authorProfileId
        ? 0
        : (BASE_POINTS[suggestion.type] ?? 1),
    diversityMult: diversityMultiplier(distinctAuthors),
    standingMult: standingMultiplier(authorStandingForTier(head.authorTier)),
  };
}

export async function handleReviewRequest(req: Request, deps: ReviewDeps): Promise<Response> {
  if (req.method !== 'POST') return jsonError('bad-payload', 405, 'POST only');
  const verify = deps.verify ?? verifyEd25519;

  const userId = parseJwtSub(req);
  if (!userId) return jsonError('not-author', 401, 'sign in to review');

  let body: ReviewBody | null = null;
  try {
    body = parseBody(await req.json());
  } catch {
    body = null;
  }
  if (!body) return jsonError('bad-payload', 400);
  const nowMs = deps.now?.() ?? Date.now();

  if (body.decision === 'reject') {
    // F3: a reject now REQUIRES an author signature over the reject envelope, so
    // authorization no longer depends only on an unverified JWT sub (a single
    // verify_jwt misconfiguration can no longer authorize silent rejects).
    if (typeof body.signatureHex !== 'string') {
      return jsonError('bad-payload', 400, 'reject requires an author signature');
    }
    // Suggestion and actor profile are dependency-free reads (improvement F);
    // errors still evaluate in the P1 order.
    const [suggestion, actorProfileId] = await Promise.all([
      deps.store.getSuggestion(body.suggestionId!),
      deps.store.getProfileIdByUserId(userId),
    ]);
    if (!suggestion) return jsonError('bad-payload', 404, 'unknown suggestion');
    if (suggestion.status !== 'open') return jsonError('not-open', 409);

    const head = await deps.store.getArticleHead(suggestion.articleId);
    if (!head) return jsonError('bad-payload', 404, 'unknown article');
    if (!actorProfileId || actorProfileId !== head.authorProfileId) {
      return jsonError('not-author', 403);
    }
    if (await deps.store.isProfileSuspended(actorProfileId, new Date(nowMs).toISOString())) {
      return jsonError('suspended', 403);
    }
    if (!(await deps.store.hasAcceptedTerms(userId, EDGE_CURRENT_TERMS_VERSION))) {
      return jsonError('terms-not-accepted', 403, EDGE_CURRENT_TERMS_VERSION);
    }

    // WP6: the head author key must still be LIVE on the chain before a reject
    // is authorized. A reject is a signed decision on someone else's work, so a
    // rotated or revoked key must not be able to make one.
    const rejectSignerKey = await resolveSigningKey(deps.store, head.authorPubkey);
    if (!rejectSignerKey.ok) return rejectSignerKey.response;
    if (rejectSignerKey.profileId !== head.authorProfileId) {
      return jsonError('not-author', 403);
    }

    // Verify the reject signature against the SAME head author key accept uses.
    // The note is inside the signed bytes, so it cannot be tampered in transit.
    const validSig = await verify(
      head.authorPubkey,
      canonicalRejectBytes({
        suggestionId: suggestion.id,
        articleId: suggestion.articleId,
        baseRev: suggestion.baseRev,
        note: body.note,
        signerPubkey: head.authorPubkey,
      }),
      body.signatureHex,
    );
    if (!validSig) return jsonError('bad-signature', 403);

    const res = await deps.store.rejectSuggestion(body.suggestionId!, actorProfileId, body.note);
    if (res === 'not-open') return jsonError('not-open', 409);
    return jsonOk({ suggestionId: body.suggestionId, decision: 'reject' });
  }

  // accept | partial, single or batch: a new author-signed revision is
  // mandatory; a single runs the same validation path as a one-element batch.
  const revision = body.revision;
  if (!revision || typeof body.signatureHex !== 'string') {
    return jsonError('bad-payload', 400, 'accept requires an author-signed revision');
  }
  // Bound the client-supplied, signed-but-otherwise-unvalidated createdAt (see
  // mynews-publish). Validation only; the signed bytes are unchanged.
  if (!isCreatedAtInBounds(revision.createdAt, nowMs)) {
    return jsonError('bad-payload', 400, 'createdAt out of bounds');
  }
  // Canonical size bounds (plan 48 WP4). Accept writes a NEW revision, so the
  // same headline, dek, body, and changelog ceilings publish enforces apply
  // here; without this an author could bypass the publish bounds by routing an
  // oversized revision through an accept.
  const outOfBounds = revisionBoundsFailure(revision);
  if (outOfBounds) return jsonError(EDGE_BOUNDS_ERROR, 400, outOfBounds);
  const suggestionIds = body.suggestionIds ?? [body.suggestionId!];

  // Author gate (unchanged): the JWT profile must be the head author and the
  // revision must be signed with the head author key. Head and actor profile
  // are dependency-free reads (improvement F).
  const [head, actorProfileId] = await Promise.all([
    deps.store.getArticleHead(revision.articleId),
    deps.store.getProfileIdByUserId(userId),
  ]);
  if (!head) return jsonError('bad-payload', 404, 'unknown article');
  if (!actorProfileId || actorProfileId !== head.authorProfileId) {
    return jsonError('not-author', 403);
  }
  if (await deps.store.isProfileSuspended(actorProfileId, new Date(nowMs).toISOString())) {
    return jsonError('suspended', 403);
  }
  if (!(await deps.store.hasAcceptedTerms(userId, EDGE_CURRENT_TERMS_VERSION))) {
    return jsonError('terms-not-accepted', 403, EDGE_CURRENT_TERMS_VERSION);
  }
  if (revision.signerPubkey !== head.authorPubkey) return jsonError('not-author', 403);

  // Load the accepted set (improvement F: Promise.all over ids): all must
  // exist, be open, and share one article that is the revision's article.
  const loaded = await Promise.all(suggestionIds.map((id) => deps.store.getSuggestion(id)));
  const suggestions: StoredSuggestion[] = [];
  for (const suggestion of loaded) {
    if (!suggestion) return jsonError('bad-payload', 404, 'unknown suggestion');
    suggestions.push(suggestion);
  }
  if (suggestions.some((s) => s.status !== 'open')) return jsonError('not-open', 409);
  if (new Set(suggestions.map((s) => s.articleId)).size > 1) {
    return jsonError('batch-mixed-articles', 409);
  }
  if (suggestions[0]!.articleId !== revision.articleId) {
    return jsonError('bad-payload', 400, 'revision article mismatch');
  }

  // C4: changelog credit validation runs BEFORE the rev and signature checks.
  const editorIds = [...new Set(suggestions.map((s) => s.editorProfileId))];
  const registeredPubkeys = await deps.store.getProfilePubkeys(editorIds);
  const mismatch = changelogMismatch(revision.changelog, suggestions, registeredPubkeys);
  if (mismatch) return jsonError('changelog-mismatch', 409, mismatch);

  if (revision.rev !== head.currentRev + 1) return jsonError('rev-conflict', 409);
  // WP6: the accepting author's key must still be LIVE on the chain. Accept
  // writes a NEW revision, so it needs exactly the guarantee publish needs.
  const acceptSignerKey = await resolveSigningKey(deps.store, revision.signerPubkey);
  if (!acceptSignerKey.ok) return acceptSignerKey.response;
  if (acceptSignerKey.profileId !== head.authorProfileId) return jsonError('not-author', 403);
  const validSig = await verify(
    revision.signerPubkey,
    canonicalRevisionBytes(revision),
    body.signatureHex,
  );
  if (!validSig) return jsonError('bad-signature', 403);

  // Aggregates once per DISTINCT editor in the batch (improvement F).
  const aggregatesList = await Promise.all(
    editorIds.map((id) => deps.store.getEditorAggregates(id)),
  );
  const distinctAuthorsByEditor = new Map(
    editorIds.map((id, i) => [id, aggregatesList[i]!.distinctAuthors]),
  );
  const awardFor = (s: StoredSuggestion) =>
    buildAward(s, head, distinctAuthorsByEditor.get(s.editorProfileId)!);

  const storedRevision = {
    articleId: revision.articleId,
    rev: revision.rev,
    headline: revision.headline,
    dek: revision.dek,
    bodyMd: revision.bodyMd,
    changelogJson: JSON.stringify(revision.changelog),
    createdAt: revision.createdAt,
    signature: body.signatureHex,
    signerPubkey: revision.signerPubkey,
  };

  // Pre-publication screening (plan 48 WP8). An accept writes a NEW revision
  // whose headline, dek, and body are client-supplied bytes, so it is a
  // publication path in its own right and cannot rely on the screening the
  // accepted suggestions already passed.
  //
  // Design note on why this path HOLDS rather than quarantines: review's
  // standing invariant is that the server never composes article text. Storing a
  // pending revision and releasing it later would make the server the author of
  // whatever it replayed, and the awards ride on live aggregates that would be
  // stale by then. So a flagged accept writes no content at all: the decision row
  // holds the exact refused envelope for the reviewer, and an approval issues a
  // content allowance so the author's identical resubmission goes straight
  // through. Nothing is published, nothing is lost, and the author has a
  // terminating path.
  const screening = await runScreeningGate({
    store: deps.store,
    kind: 'revision-proposal',
    authorProfileId: actorProfileId,
    text: revision.bodyMd,
    title: [revision.headline, revision.dek ?? ''].join(' '),
    env: deps.env,
    ...(deps.screeningProvider !== undefined ? { provider: deps.screeningProvider } : {}),
  });
  if (screening.decision === 'unavailable') {
    return jsonError('screening-unavailable', 503, screening.detail);
  }
  if (screening.decision === 'hold') {
    const held = await deps.store.holdRevisionProposal({
      articleId: revision.articleId,
      authorProfileId: actorProfileId,
      rev: revision.rev,
      payload: {
        suggestionIds,
        decision: body.decision,
        revision: {
          articleId: revision.articleId,
          rev: revision.rev,
          headline: revision.headline,
          dek: revision.dek,
          bodyMd: revision.bodyMd,
          changelog: revision.changelog,
          createdAt: revision.createdAt,
          signerPubkey: revision.signerPubkey,
        },
        signatureHex: body.signatureHex,
      },
      verdict: screening.verdict,
      contentSha256: screening.contentSha256,
    });
    if (!held.ok) {
      return jsonError('screening-unavailable', 503, 'screening is temporarily unavailable');
    }
    return jsonError(
      'screening-quarantined',
      202,
      `${screeningHoldDetail(screening.verdict)} The suggestions stay open, so you can resubmit this revision once it is approved. Reference: ${held.decisionId}`,
    );
  }

  if (body.suggestionIds) {
    const awards: Record<string, AwardInput> = {};
    for (const suggestion of suggestions) awards[suggestion.id] = awardFor(suggestion);
    const res = await deps.store.acceptSuggestionsBatch({
      suggestionIds: body.suggestionIds,
      actorProfileId,
      revision: storedRevision,
      awards,
    });
    if (res === 'mixed-articles') return jsonError('batch-mixed-articles', 409);
    if (res === 'not-open') return jsonError('not-open', 409);
    if (res === 'rev-conflict') return jsonError('rev-conflict', 409);
    // Unreachable when the handler built the awards; surfaced as a server bug.
    if (res === 'bad-award') return jsonError('bad-award', 500);
    await recordScreeningAllowIfNeeded({
      store: deps.store,
      kind: 'revision',
      contentId: revision.articleId,
      contentRev: revision.rev,
      authorProfileId: actorProfileId,
      contentSha256: screening.contentSha256,
      verdict: screening.verdict,
    });
    return jsonOk({ suggestionIds: body.suggestionIds, decision: 'accept', rev: revision.rev });
  }

  const res = await deps.store.acceptSuggestion({
    suggestionId: body.suggestionId!,
    decision: body.decision,
    actorProfileId,
    revision: storedRevision,
    award: awardFor(suggestions[0]!),
  });
  if (res === 'not-open') return jsonError('not-open', 409);
  if (res === 'rev-conflict') return jsonError('rev-conflict', 409);
  await recordScreeningAllowIfNeeded({
    store: deps.store,
    kind: 'revision',
    contentId: revision.articleId,
    contentRev: revision.rev,
    authorProfileId: actorProfileId,
    contentSha256: screening.contentSha256,
    verdict: screening.verdict,
  });
  return jsonOk({ suggestionId: body.suggestionId, decision: body.decision, rev: revision.rev });
}

declare const Deno:
  | { serve: (h: (req: Request) => Promise<Response>) => void; env: { get(k: string): string | undefined } }
  | undefined;

if (typeof Deno !== 'undefined' && Deno?.serve) {
  const env = (key: string) => Deno!.env.get(key);
  const store = createPostgrestMyNewsStore(env, fetch);
  Deno.serve(
    serveEnvelope((req) => handleReviewRequest(req, { store }), {
      fn: 'mynews-review',
      action: 'review',
    }),
  );
}
