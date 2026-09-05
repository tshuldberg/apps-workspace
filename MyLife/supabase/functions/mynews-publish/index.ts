// MyNews publish: verify-then-insert. The server is canonical but cannot
// forge: every revision must carry a valid author signature over the
// canonical bytes, and the author pubkey must match a registered profile.
// C4 v2: draft publishes land newsroom-scoped ('draft' status, null
// published_at) and publishing an existing draft flips status atomically,
// always behind the CURRENT owner/coauthor membership gate; when the request
// omits newsroomId on a draft transition, the head's newsroom still gates it.

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
  canonicalRevisionBytes,
  verifyEd25519,
  type WireRevision,
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
import { isCreatedAtInBounds } from '../_shared/mynews-time.ts';

export interface PublishDeps {
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

interface PublishBody {
  article: {
    id: string;
    slug: string;
    kind: string;
    authorPubkey: string;
    /** C4 v2: newsroom scope; required when draft is true. */
    newsroomId?: string | null;
    /** C4 v2: true inserts status 'draft' with null published_at. */
    draft?: boolean;
  };
  revision: WireRevision;
  signatureHex: string;
}

// Bounded by SLUG_MIN_CHARS/SLUG_MAX_CHARS; the character class and the length
// range must stay identical to the nw_articles.slug CHECK in the bootstrap
// migration, which is where these numbers come from.
const SLUG_RE = new RegExp(
  `^[a-z0-9-]{${EDGE_MYNEWS_BOUNDS.SLUG_MIN_CHARS},${EDGE_MYNEWS_BOUNDS.SLUG_MAX_CHARS}}$`,
);
const KINDS = new Set(['news', 'preprint']);

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

function parseBody(raw: unknown): PublishBody | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const b = raw as Record<string, unknown>;
  const article = b.article as Record<string, unknown> | undefined;
  const revision = b.revision as Record<string, unknown> | undefined;
  if (!article || !revision || typeof b.signatureHex !== 'string') return null;
  if (
    typeof article.id !== 'string' ||
    typeof article.slug !== 'string' ||
    typeof article.kind !== 'string' ||
    typeof article.authorPubkey !== 'string'
  ) {
    return null;
  }
  if (
    article.newsroomId !== undefined &&
    article.newsroomId !== null &&
    typeof article.newsroomId !== 'string'
  ) {
    return null;
  }
  if (article.draft !== undefined && typeof article.draft !== 'boolean') return null;
  if (
    typeof revision.articleId !== 'string' ||
    typeof revision.rev !== 'number' ||
    !Number.isInteger(revision.rev) ||
    revision.rev < 1 ||
    typeof revision.headline !== 'string' ||
    revision.headline.trim().length === 0 ||
    typeof revision.bodyMd !== 'string' ||
    revision.bodyMd.trim().length === 0 ||
    typeof revision.createdAt !== 'string' ||
    typeof revision.signerPubkey !== 'string' ||
    !Array.isArray(revision.changelog)
  ) {
    return null;
  }
  return raw as PublishBody;
}

export async function handlePublishRequest(req: Request, deps: PublishDeps): Promise<Response> {
  if (req.method !== 'POST') return jsonError('bad-payload', 405, 'POST only');
  const verify = deps.verify ?? verifyEd25519;

  let body: PublishBody | null = null;
  try {
    body = parseBody(await req.json());
  } catch {
    body = null;
  }
  if (!body) return jsonError('bad-payload', 400);

  const { article, revision, signatureHex } = body;
  if (!SLUG_RE.test(article.slug)) return jsonError('bad-payload', 400, 'invalid slug');
  if (!KINDS.has(article.kind)) return jsonError('bad-payload', 400, 'invalid kind');
  if (article.id !== revision.articleId) return jsonError('bad-payload', 400, 'article id mismatch');
  // C4: a draft always lives in a newsroom.
  if (article.draft === true && !article.newsroomId) {
    return jsonError('bad-payload', 400, 'draft requires a newsroom');
  }
  if (article.authorPubkey !== revision.signerPubkey) {
    return jsonError('author-mismatch', 403);
  }

  // Canonical size bounds (plan 48 WP4) before the signature verify: an
  // oversized headline, dek, body, or changelog is rejected without spending
  // an Ed25519 verification on it, and can never reach the SQL CHECKs in
  // 20260730000003 as a surprise constraint violation.
  const outOfBounds = revisionBoundsFailure(revision);
  if (outOfBounds) return jsonError(EDGE_BOUNDS_ERROR, 400, outOfBounds);

  const validSig = await verify(revision.signerPubkey, canonicalRevisionBytes(revision), signatureHex);
  if (!validSig) return jsonError('bad-signature', 403);

  // Bound the client-supplied, signed-but-otherwise-unvalidated createdAt: a
  // hijacked client can back/post-date. Validation only; the signed bytes and
  // the stored createdAt are unchanged.
  if (!isCreatedAtInBounds(revision.createdAt, deps.now?.() ?? Date.now())) {
    return jsonError('bad-payload', 400, 'createdAt out of bounds');
  }

  // Key resolution and head are dependency-free reads (improvement F); errors
  // still evaluate the signer first, then the head checks. WP6: the signer is
  // resolved through the KEY CHAIN, not the head pubkey column, so co-active
  // device keys work and a rotated/revoked key gets 'key-revoked' rather than a
  // misleading 'no-profile'.
  const [signerKey, head] = await Promise.all([
    resolveSigningKey(deps.store, article.authorPubkey, 'register a profile before publishing'),
    deps.store.getArticleHead(article.id),
  ]);
  if (!signerKey.ok) return signerKey.response;
  const authorProfileId = signerKey.profileId;

  // A suspended author cannot publish (enforcement teeth, Plan 39 T8).
  if (await deps.store.isProfileSuspended(authorProfileId, new Date(deps.now?.() ?? Date.now()).toISOString())) {
    return jsonError('suspended', 403);
  }

  // Terms gate (DSA + ToS, Plan 39 T11): the actor must have accepted the
  // CURRENT terms version. Keyed on the JWT subject (auth user id), which is
  // exactly what nw_terms_acceptance stores. A version bump re-gates everyone.
  const userId = parseJwtSub(req);
  if (!userId) return jsonError('not-signed-in', 401);
  if (!(await deps.store.hasAcceptedTerms(userId, EDGE_CURRENT_TERMS_VERSION))) {
    return jsonError('terms-not-accepted', 403, EDGE_CURRENT_TERMS_VERSION);
  }

  // C4 newsroom gate: writing under a newsroom (draft or publish-of-draft)
  // requires CURRENT owner or coauthor membership; reviewers read and
  // suggest, never publish. A draft transition that omits newsroomId falls
  // back to the head's newsroom, so omission never bypasses the gate. P1
  // non-newsroom paths stay byte-identical: their head.newsroomId is null.
  const newsroomScope =
    article.newsroomId ?? (head?.status === 'draft' ? head.newsroomId : null);
  if (newsroomScope) {
    const role = await deps.store.getNewsroomRole(newsroomScope, authorProfileId);
    if (role !== 'owner' && role !== 'coauthor') {
      return jsonError('not-newsroom-member', 403);
    }
  }

  if (head) {
    if (head.authorPubkey !== article.authorPubkey) return jsonError('author-mismatch', 403);
    if (revision.rev !== head.currentRev + 1) return jsonError('rev-conflict', 409);
  } else if (revision.rev !== 1) {
    return jsonError('rev-conflict', 409, 'first revision must be rev 1');
  }

  const articleRecord = {
    id: article.id,
    slug: article.slug,
    kind: article.kind,
    authorProfileId,
    ...(article.draft !== undefined ? { draft: article.draft } : {}),
    ...(article.newsroomId !== undefined ? { newsroomId: article.newsroomId } : {}),
  };
  const revisionRecord = {
    articleId: revision.articleId,
    rev: revision.rev,
    headline: revision.headline,
    dek: revision.dek,
    bodyMd: revision.bodyMd,
    changelogJson: JSON.stringify(revision.changelog),
    createdAt: revision.createdAt,
    signature: signatureHex,
    signerPubkey: revision.signerPubkey,
  };

  // Pre-publication screening (plan 48 WP8). Last gate before the store write:
  // everything above has already established that this is a well-formed,
  // in-bounds, correctly signed revision from a permitted author, so a hold here
  // is about the CONTENT rather than the request. A high-risk verdict stores the
  // revision non-public with its decision row in one transaction and tells the
  // author honestly; a screening failure is a retryable 503 and writes nothing.
  const screening = await runScreeningGate({
    store: deps.store,
    kind: 'article',
    authorProfileId,
    text: revision.bodyMd,
    title: [revision.headline, revision.dek ?? ''].join(' '),
    env: deps.env,
    ...(deps.screeningProvider !== undefined ? { provider: deps.screeningProvider } : {}),
  });
  if (screening.decision === 'unavailable') {
    return jsonError('screening-unavailable', 503, screening.detail);
  }
  if (screening.decision === 'hold') {
    const held = await deps.store.quarantineArticle({
      article: articleRecord,
      revision: revisionRecord,
      verdict: screening.verdict,
      contentSha256: screening.contentSha256,
    });
    if (!held.ok) {
      if (held.code === 'rev-conflict') return jsonError('rev-conflict', 409);
      if (held.code === 'slug-conflict') {
        return jsonError('bad-payload', 409, 'slug already taken');
      }
      // The hold could not be stored, so nothing was held and nothing was
      // published. Retryable, never a silent publish.
      return jsonError('screening-unavailable', 503, 'screening is temporarily unavailable');
    }
    // 202: the submission was accepted for review, not published. The envelope
    // stays ok:false so no client can read this as a successful publish.
    return jsonError(
      'screening-quarantined',
      202,
      `${screeningHoldDetail(screening.verdict)} Reference: ${held.decisionId}`,
    );
  }

  const result = await deps.store.publishArticle({
    article: articleRecord,
    revision: revisionRecord,
    publishedAtIso: new Date(deps.now?.() ?? Date.now()).toISOString(),
  });

  if (result === 'rev-conflict') return jsonError('rev-conflict', 409);
  if (result === 'slug-conflict') return jsonError('bad-payload', 409, 'slug already taken');
  // Defensive mirror of the RPC's draft-without-newsroom guard (checked above).
  if (result === 'bad-payload') return jsonError('bad-payload', 400);

  // Below-threshold flag on published content: recorded for false-negative
  // measurement only. Never blocks a legitimate publish.
  await recordScreeningAllowIfNeeded({
    store: deps.store,
    kind: 'article',
    contentId: article.id,
    contentRev: revision.rev,
    authorProfileId,
    contentSha256: screening.contentSha256,
    verdict: screening.verdict,
  });

  return jsonOk({ articleId: article.id, rev: revision.rev, slug: article.slug });
}

declare const Deno:
  | { serve: (h: (req: Request) => Promise<Response>) => void; env: { get(k: string): string | undefined } }
  | undefined;

if (typeof Deno !== 'undefined' && Deno?.serve) {
  const env = (key: string) => Deno!.env.get(key);
  const store = createPostgrestMyNewsStore(env, fetch);
  Deno.serve(
    serveEnvelope((req) => handlePublishRequest(req, { store }), {
      fn: 'mynews-publish',
      action: 'publish',
    }),
  );
}
