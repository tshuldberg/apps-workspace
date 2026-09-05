// MyNews set-meta: provenance-critical article metadata (DOI, ORCID authors,
// license, rights route, embargo, dataset hashes, canonical URL) is now author-
// signed and verified server-side, exactly like revisions/suggestions/rejects.
// The client-write guard trigger (migration 20260705000004) forbids any client
// session from writing nw_article_meta directly, so this is the only path. The
// caller signs canonicalArticleMetaBytes over ALL fields; the server verifies
// the signature against the article's HEAD author pubkey and confirms the caller
// profile IS that head author, then upserts the whole row (plus signature +
// signer pubkey, so it stays offline re-verifiable) under the service role.

import { jsonError, jsonOk, parseJwtSub, serveEnvelope } from '../_shared/mynews-http.ts';
import {
  canonicalArticleMetaBytes,
  verifyEd25519,
  type WireArticleMeta,
} from '../_shared/mynews-signing.ts';
import {
  createPostgrestMyNewsStore,
  type MyNewsStore,
} from '../_shared/mynews-store.ts';
import { resolveSigningKey } from '../_shared/mynews-key-verify.ts';

export interface SetMetaDeps {
  store: MyNewsStore;
  verify?: typeof verifyEd25519;
}

interface SetMetaBody {
  meta: WireArticleMeta;
  signatureHex: string;
}

const RIGHTS_ROUTES = new Set(['', 'preprint', 'rights_retention', 'cc_by']);
const HTTPS_ONLY = /^https:\/\//;

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === 'string');
}

function parseBody(raw: unknown): SetMetaBody | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const b = raw as Record<string, unknown>;
  if (typeof b.signatureHex !== 'string') return null;
  if (typeof b.meta !== 'object' || b.meta === null) return null;
  const m = b.meta as Record<string, unknown>;
  if (typeof m.articleId !== 'string' || m.articleId === '') return null;
  if (typeof m.signerPubkey !== 'string' || m.signerPubkey === '') return null;
  if (!isStringArray(m.orcidAuthors) || !isStringArray(m.datasetHashes)) return null;
  if (typeof m.license !== 'string') return null;
  if (typeof m.rightsRoute !== 'string' || !RIGHTS_ROUTES.has(m.rightsRoute)) return null;
  if (m.doi != null && typeof m.doi !== 'string') return null;
  if (m.embargoUntil != null && typeof m.embargoUntil !== 'string') return null;
  if (m.canonicalUrl != null) {
    if (typeof m.canonicalUrl !== 'string') return null;
    // The DB column enforces https-only; reject early so a bad URL never even
    // reaches the signed-bytes verify with a scheme the store would refuse.
    if (m.canonicalUrl !== '' && !HTTPS_ONLY.test(m.canonicalUrl)) return null;
  }
  return {
    meta: {
      articleId: m.articleId,
      doi: (m.doi as string | null | undefined) ?? null,
      orcidAuthors: m.orcidAuthors,
      license: m.license,
      rightsRoute: m.rightsRoute,
      embargoUntil: (m.embargoUntil as string | null | undefined) ?? null,
      datasetHashes: m.datasetHashes,
      canonicalUrl: (m.canonicalUrl as string | null | undefined) ?? null,
      signerPubkey: m.signerPubkey,
    },
    signatureHex: b.signatureHex,
  };
}

export async function handleSetMetaRequest(req: Request, deps: SetMetaDeps): Promise<Response> {
  if (req.method !== 'POST') return jsonError('bad-payload', 405, 'POST only');
  const verify = deps.verify ?? verifyEd25519;

  const userId = parseJwtSub(req);
  if (!userId) return jsonError('not-author', 401, 'sign in to set metadata');

  let body: SetMetaBody | null = null;
  try {
    body = parseBody(await req.json());
  } catch {
    body = null;
  }
  if (!body) return jsonError('bad-payload', 400);

  // Head and actor profile are dependency-free reads (mirrors mynews-review).
  const [head, actorProfileId] = await Promise.all([
    deps.store.getArticleHead(body.meta.articleId),
    deps.store.getProfileIdByUserId(userId),
  ]);
  if (!head) return jsonError('bad-payload', 404, 'unknown article');
  if (!actorProfileId || actorProfileId !== head.authorProfileId) {
    return jsonError('not-author', 403);
  }
  // The signer pubkey in the signed bytes must be the head author key; a mismatch
  // is caught here before the crypto verify so a swapped-signer payload is a
  // not-author rejection, not a bad-signature one.
  if (body.meta.signerPubkey !== head.authorPubkey) return jsonError('not-author', 403);

  // WP6: the head author key must still be LIVE on the chain. Setting metadata
  // is a signed authorship assertion, so a rotated or revoked key must not be
  // able to make one, and the author gets 'key-revoked' rather than a confusing
  // 'bad-signature' on a signature that is cryptographically fine.
  const signerKey = await resolveSigningKey(deps.store, head.authorPubkey);
  if (!signerKey.ok) return signerKey.response;
  if (signerKey.profileId !== head.authorProfileId) return jsonError('not-author', 403);

  const validSig = await verify(
    head.authorPubkey,
    canonicalArticleMetaBytes(body.meta),
    body.signatureHex,
  );
  if (!validSig) return jsonError('bad-signature', 403);

  const res = await deps.store.upsertArticleMeta({
    articleId: body.meta.articleId,
    doi: body.meta.doi ?? null,
    orcidAuthors: body.meta.orcidAuthors,
    license: body.meta.license,
    rightsRoute: body.meta.rightsRoute,
    embargoUntil: body.meta.embargoUntil ?? null,
    datasetHashes: body.meta.datasetHashes,
    canonicalUrl: body.meta.canonicalUrl ?? null,
    signature: body.signatureHex,
    signerPubkey: body.meta.signerPubkey,
  });
  if (res === 'bad-payload') return jsonError('bad-payload', 400);
  return jsonOk({ articleId: body.meta.articleId });
}

declare const Deno:
  | { serve: (h: (req: Request) => Promise<Response>) => void; env: { get(k: string): string | undefined } }
  | undefined;

if (typeof Deno !== 'undefined' && Deno?.serve) {
  const env = (key: string) => Deno!.env.get(key);
  const store = createPostgrestMyNewsStore(env, fetch);
  Deno.serve(
    serveEnvelope((req) => handleSetMetaRequest(req, { store }), {
      fn: 'mynews-set-meta',
      action: 'set_meta',
    }),
  );
}
