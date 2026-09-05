// MyNews suggest: verify the editor signature, enforce the citation floor,
// gate drafts to newsroom members, collapse near-dupes into an endorsement of
// the original open suggestion, and enforce the open-suggestion cap from the
// real editor level (twins of the module engines + SQL CHECK), then insert as
// 'open'. Authors decide later via mynews-review.

import { jsonError, jsonOk, parseJwtSub, serveEnvelope } from '../_shared/mynews-http.ts';
import {
  EDGE_BOUNDS_ERROR,
  checkCitations,
  checkRationale,
  checkStructuredDiffJson,
} from '../_shared/mynews-bounds.ts';
import { EDGE_CURRENT_TERMS_VERSION } from '../_shared/mynews-terms.ts';
import {
  LEVEL_CAPS,
  MIN_POSSIBLE_CAP,
  editorStatsFromAggregates,
  effectiveCap,
  ledgerWeightedScore,
  levelFor,
} from '../_shared/mynews-cred.ts';
import {
  isNearDupe,
  suggestionSimilarity,
  type StructuredDiff,
} from '../_shared/mynews-dupes.ts';
import {
  canonicalSuggestionBytes,
  verifyEd25519,
  type WireSuggestion,
} from '../_shared/mynews-signing.ts';
import {
  createPostgrestMyNewsStore,
  type MyNewsStore,
} from '../_shared/mynews-store.ts';
import { resolveSigningKey } from '../_shared/mynews-key-verify.ts';
import {
  recordScreeningAllowIfNeeded,
  runScreeningGate,
  screeningHoldDetail,
} from '../_shared/mynews-screening-gate.ts';
import type { ScreeningProvider } from '../_shared/mynews-screening.ts';
import { normalizedAddedText } from '../_shared/mynews-dupes.ts';

export interface SuggestDeps {
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

const TYPES = new Set(['correction', 'context', 'translation', 'clarity', 'headline', 'copyedit']);
const CITATION_REQUIRED = new Set(['correction', 'context']);

// Pipeline throttle: the suggest path runs verify + several store reads (a
// 200-row near-dupe scan, aggregates, a 500-row ledger) before the cap can
// reject, so one valid profile+key can force the full pipeline repeatedly.
// A cheap count guard up front bounds that regardless of the cap outcome.
const THROTTLE_WINDOW_MS = 60_000;
const THROTTLE_MAX_IN_WINDOW = 20;

interface SuggestBody {
  suggestion: WireSuggestion & { id: string; createdAt: string };
  signatureHex: string;
}

function parseBody(raw: unknown): SuggestBody | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const b = raw as Record<string, unknown>;
  const s = b.suggestion as Record<string, unknown> | undefined;
  if (!s || typeof b.signatureHex !== 'string') return null;
  if (
    typeof s.id !== 'string' ||
    typeof s.articleId !== 'string' ||
    typeof s.baseRev !== 'number' ||
    !Number.isInteger(s.baseRev) ||
    s.baseRev < 1 ||
    typeof s.type !== 'string' ||
    typeof s.diffJson !== 'string' ||
    !Array.isArray(s.citations) ||
    !s.citations.every((c) => typeof c === 'string' && c.startsWith('https://')) ||
    typeof s.rationale !== 'string' ||
    s.rationale.trim().length === 0 ||
    typeof s.editorPubkey !== 'string' ||
    typeof s.createdAt !== 'string'
  ) {
    return null;
  }
  return raw as SuggestBody;
}

/**
 * Defensive StructuredDiff parse for STORED rows in the near-dupe scan. An
 * already-persisted row that is not diff-shaped (written before the WP4 shape
 * check landed) is skipped rather than failing the request: it just cannot
 * participate in dupe detection. Incoming diffs take the strict path
 * (checkStructuredDiffJson) and are rejected outright.
 */
function parseStructuredDiff(raw: string): StructuredDiff | null {
  const checked = checkStructuredDiffJson(raw);
  return checked.ok ? (checked.diff as unknown as StructuredDiff) : null;
}

export async function handleSuggestRequest(req: Request, deps: SuggestDeps): Promise<Response> {
  if (req.method !== 'POST') return jsonError('bad-payload', 405, 'POST only');
  const verify = deps.verify ?? verifyEd25519;

  let body: SuggestBody | null = null;
  try {
    body = parseBody(await req.json());
  } catch {
    body = null;
  }
  if (!body) return jsonError('bad-payload', 400);
  const { suggestion, signatureHex } = body;

  if (!TYPES.has(suggestion.type)) return jsonError('bad-payload', 400, 'unknown type');
  if (CITATION_REQUIRED.has(suggestion.type) && suggestion.citations.length === 0) {
    return jsonError('citation-floor', 400);
  }

  // Canonical size bounds (plan 48 WP4). The rationale and the citation list
  // had no ceiling, and diffJson was accepted as ANY parseable JSON, so a
  // client could store an arbitrarily large blob in nw_edit_suggestions
  // .diff_json. The diff is now a typed, bounded structured diff, checked
  // before the signature verify and before any store read.
  const rationaleBounds = checkRationale(suggestion.rationale);
  if (!rationaleBounds.ok) {
    return jsonError(EDGE_BOUNDS_ERROR, 400, rationaleBounds.failure.detail);
  }
  const citationBounds = checkCitations(suggestion.citations);
  if (!citationBounds.ok) {
    return jsonError(EDGE_BOUNDS_ERROR, 400, citationBounds.failure.detail);
  }
  const diffCheck = checkStructuredDiffJson(suggestion.diffJson);
  if (!diffCheck.ok) return jsonError('bad-diff', 400, diffCheck.failure.detail);

  const validSig = await verify(
    suggestion.editorPubkey,
    canonicalSuggestionBytes(suggestion),
    signatureHex,
  );
  if (!validSig) return jsonError('bad-signature', 403);

  // WP6: resolved through the key chain, so a co-active device key can suggest
  // and a rotated/revoked key is told 'key-revoked' instead of 'no-profile'.
  const signerKey = await resolveSigningKey(deps.store, suggestion.editorPubkey);
  if (!signerKey.ok) return signerKey.response;
  const editorProfileId = signerKey.profileId;

  // A suspended editor cannot suggest (enforcement teeth, Plan 39 T8).
  if (await deps.store.isProfileSuspended(editorProfileId, new Date(deps.now?.() ?? Date.now()).toISOString())) {
    return jsonError('suspended', 403);
  }

  // Terms gate (DSA + ToS, Plan 39 T11): the editor must have accepted the
  // CURRENT terms version before filing a suggestion. Keyed on the JWT subject.
  const userId = parseJwtSub(req);
  if (!userId) return jsonError('not-signed-in', 401);
  if (!(await deps.store.hasAcceptedTerms(userId, EDGE_CURRENT_TERMS_VERSION))) {
    return jsonError('terms-not-accepted', 403, EDGE_CURRENT_TERMS_VERSION);
  }

  // Early per-profile throttle, before the expensive scan/aggregates/ledger.
  // Fail closed (plan 48 fail-closed rule, aligned with the report and comment
  // throttles in Wave 1/2): a failed count is a retryable 503, never an empty
  // window. A store that cannot count recent suggestions cannot prove the
  // flood ceiling holds, so the submission does not proceed.
  try {
    const nowMs = deps.now?.() ?? Date.now();
    const sinceIso = new Date(nowMs - THROTTLE_WINDOW_MS).toISOString();
    const recent = await deps.store.countRecentSuggestions(editorProfileId, sinceIso);
    if (recent >= THROTTLE_MAX_IN_WINDOW) return jsonError('rate-limited', 429);
  } catch (error) {
    console.error('mynews suggest throttle count failed', error);
    return jsonError('suggest-unavailable', 503, 'suggesting is temporarily unavailable');
  }

  const head = await deps.store.getArticleHead(suggestion.articleId);
  if (!head) return jsonError('unknown-article', 404);

  // C4 draft-scope gate: drafts are newsroom-scoped, so the author or any
  // newsroom member may suggest; everyone else gets draft-access. A draft
  // without a newsroom is unreachable via the publish RPC; deny defensively.
  if (head.status === 'draft' && head.authorProfileId !== editorProfileId) {
    const role = head.newsroomId
      ? await deps.store.getNewsroomRole(head.newsroomId, editorProfileId)
      : null;
    if (role === null) return jsonError('draft-access', 403);
  }

  // Near-dupe collapse: scan open suggestions on the same article+baseRev
  // (oldest first, so the earliest match is the original). The dupe path
  // records an endorsement instead of a new row and skips the cap check;
  // an editor re-submitting their own open fix never self-endorses.
  // The incoming diff is already validated above, so the scan always runs.
  const newDiff = diffCheck.diff as unknown as StructuredDiff;
  const open = await deps.store.getOpenSuggestionsForArticle(
    suggestion.articleId,
    suggestion.baseRev,
  );
  for (const candidate of open) {
    const candidateDiff = parseStructuredDiff(candidate.diffJson);
    if (!candidateDiff || !isNearDupe(newDiff, candidateDiff)) continue;
    if (candidate.editorProfileId !== editorProfileId) {
      await deps.store.insertDupeEndorsement({
        originalId: candidate.id,
        endorserId: editorProfileId,
        similarity: suggestionSimilarity(newDiff, candidateDiff),
      });
    }
    return jsonOk({ suggestionId: candidate.id, collapsed: true });
  }

  // Cap check from the real level (aggregates v2 + public ledger, C7).
  // Carried review C: below MIN_POSSIBLE_CAP the cap can never trip, so the
  // ledger fetch and the level math are skipped entirely.
  const agg = await deps.store.getEditorAggregates(editorProfileId);
  if (agg.openCount >= MIN_POSSIBLE_CAP) {
    const ledger = await deps.store.getCredibilityLedger(editorProfileId);
    const stats = editorStatsFromAggregates(
      agg,
      ledgerWeightedScore(ledger, agg.distinctAuthors, Date.now()),
    );
    const cap = effectiveCap({
      openCount: agg.openCount,
      acceptanceRate: agg.acceptanceRate,
      decidedSampleSize: agg.decidedSampleSize,
      levelCap: LEVEL_CAPS[levelFor(stats)],
    });
    if (agg.openCount >= cap) return jsonError('cap-exceeded', 429);
  }

  const suggestionRecord = {
    id: suggestion.id,
    articleId: suggestion.articleId,
    baseRev: suggestion.baseRev,
    editorProfileId,
    type: suggestion.type,
    diffJson: suggestion.diffJson,
    citations: suggestion.citations,
    rationale: suggestion.rationale,
    signature: signatureHex,
    // WP6: record WHICH key signed, so the suggestion stays verifiable after
    // this editor rotates. The DB stamps verified_key_id from it.
    signerPubkey: suggestion.editorPubkey,
    createdAt: suggestion.createdAt,
  };

  // Pre-publication screening (plan 48 WP8). The screened text is the diff's
  // ADDED prose plus the rationale: the base blocks are already-published
  // article text that was screened when it was published, so screening them
  // again would hold an editor responsible for someone else's words. Citations
  // ride along as declared links, which is exactly where a scam link would hide.
  const screening = await runScreeningGate({
    store: deps.store,
    kind: 'suggestion',
    authorProfileId: editorProfileId,
    text: normalizedAddedText(newDiff),
    title: suggestion.rationale,
    links: suggestion.citations,
    env: deps.env,
    ...(deps.screeningProvider !== undefined ? { provider: deps.screeningProvider } : {}),
  });
  if (screening.decision === 'unavailable') {
    return jsonError('screening-unavailable', 503, screening.detail);
  }
  if (screening.decision === 'hold') {
    const held = await deps.store.quarantineSuggestion({
      suggestion: suggestionRecord,
      verdict: screening.verdict,
      contentSha256: screening.contentSha256,
    });
    if (!held.ok) {
      if (held.code === 'unknown-article') return jsonError('unknown-article', 404);
      return jsonError('screening-unavailable', 503, 'screening is temporarily unavailable');
    }
    return jsonError(
      'screening-quarantined',
      202,
      `${screeningHoldDetail(screening.verdict)} Reference: ${held.decisionId}`,
    );
  }

  const result = await deps.store.insertSuggestion(suggestionRecord);
  if (result === 'unknown-article') return jsonError('unknown-article', 404);

  await recordScreeningAllowIfNeeded({
    store: deps.store,
    kind: 'suggestion',
    contentId: suggestion.id,
    contentRev: null,
    authorProfileId: editorProfileId,
    contentSha256: screening.contentSha256,
    verdict: screening.verdict,
  });

  return jsonOk({ suggestionId: suggestion.id });
}

declare const Deno:
  | { serve: (h: (req: Request) => Promise<Response>) => void; env: { get(k: string): string | undefined } }
  | undefined;

if (typeof Deno !== 'undefined' && Deno?.serve) {
  const env = (key: string) => Deno!.env.get(key);
  const store = createPostgrestMyNewsStore(env, fetch);
  Deno.serve(
    serveEnvelope((req) => handleSuggestRequest(req, { store }), {
      fn: 'mynews-suggest',
      action: 'suggest',
    }),
  );
}
