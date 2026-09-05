import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { SignableArticleMeta } from '../../../../modules/mynews/src/signing/canonical';
import { signArticleMeta } from '../../../../modules/mynews/src/signing/sign';
import { handleSetMetaRequest } from '../index.ts';
import { canonicalArticleMetaBytes } from '../../_shared/mynews-signing.ts';
import { createInMemoryMyNewsStore } from '../../_shared/mynews-store.ts';

const vectors = JSON.parse(
  readFileSync(
    join(__dirname, '../../../../modules/mynews/src/signing/__fixtures__/signing-vectors.json'),
    'utf8',
  ),
);

const AUTHOR_USER_ID = 'auth-author-1';
const AUTHOR_PROFILE_ID = 'profile-author-1';
const ARTICLE_ID = '11111111-1111-1111-1111-111111111111';

const toHex = (bytes: Uint8Array) =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');

function jwtFor(sub: string): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ sub })).toString('base64url');
  return `${header}.${payload}.sig`;
}

function post(body: unknown, sub: string | null): Request {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (sub) headers.Authorization = `Bearer ${jwtFor(sub)}`;
  return new Request('http://local/mynews-set-meta', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

/** A store seeded with one published article whose head author holds the fixture key. */
function seededStore() {
  const built = createInMemoryMyNewsStore({
    profiles: [{ id: AUTHOR_PROFILE_ID, userId: AUTHOR_USER_ID, pubkey: vectors.publicKeyHex }],
  });
  built.state.articles.set(ARTICLE_ID, {
    id: ARTICLE_ID,
    slug: 'owens-valley',
    kind: 'preprint',
    status: 'draft',
    authorProfileId: AUTHOR_PROFILE_ID,
    authorPubkey: vectors.publicKeyHex,
    currentRev: 1,
    newsroomId: 'room-1',
    publishedAt: null,
  });
  return built;
}

function metaFor(signerPubkey: string): SignableArticleMeta {
  return {
    articleId: ARTICLE_ID,
    doi: '10.1234/owens.2026.034',
    orcidAuthors: ['0000-0002-1825-0097'],
    license: 'CC-BY-4.0',
    rightsRoute: 'cc_by',
    embargoUntil: '2026-08-01T00:00:00.000Z',
    datasetHashes: ['sha256:9f2c1a', 'sha256:44de77'],
    canonicalUrl: 'https://inyowater.org/records/2026-034',
    signerPubkey,
  };
}

/** Wire shape sent by the client: the meta object minus nothing, plus signature. */
function bodyFor(meta: SignableArticleMeta, privateKeyHex = vectors.privateKeyHex) {
  return { meta, signatureHex: signArticleMeta(meta, privateKeyHex) };
}

async function readJson(res: Response): Promise<Record<string, unknown>> {
  return (await res.json()) as Record<string, unknown>;
}

describe('canonical article-meta twin parity', () => {
  it('produces byte-identical bytes to the module builder committed vector', () => {
    expect(toHex(canonicalArticleMetaBytes(vectors.articleMeta))).toBe(
      vectors.articleMetaCanonicalHex,
    );
  });
});

describe('handleSetMetaRequest', () => {
  it('rejects non-POST', async () => {
    const { store } = seededStore();
    const res = await handleSetMetaRequest(
      new Request('http://local/mynews-set-meta', { method: 'GET' }),
      { store },
    );
    expect(res.status).toBe(405);
  });

  it('rejects a missing session', async () => {
    const { store } = seededStore();
    const res = await handleSetMetaRequest(post(bodyFor(metaFor(vectors.publicKeyHex)), null), {
      store,
    });
    expect(res.status).toBe(401);
    expect((await readJson(res)).error).toBe('not-author');
  });

  it('upserts a valid author-signed meta and persists the signature', async () => {
    const { store, state } = seededStore();
    const meta = metaFor(vectors.publicKeyHex);
    const res = await handleSetMetaRequest(post(bodyFor(meta), AUTHOR_USER_ID), { store });
    expect(res.status).toBe(200);
    expect((await readJson(res)).ok).toBe(true);
    const stored = state.articleMeta.get(ARTICLE_ID);
    expect(stored?.doi).toBe('10.1234/owens.2026.034');
    expect(stored?.datasetHashes).toEqual(['sha256:9f2c1a', 'sha256:44de77']);
    expect(stored?.canonicalUrl).toBe('https://inyowater.org/records/2026-034');
    expect(stored?.signerPubkey).toBe(vectors.publicKeyHex);
    expect(stored?.signature).toBe(signArticleMeta(meta, vectors.privateKeyHex));
    expect((stored?.signature ?? '').length).toBeGreaterThan(0);
  });

  it('rejects a signature made with the wrong key', async () => {
    const { store, state } = seededStore();
    const meta = metaFor(vectors.publicKeyHex);
    const res = await handleSetMetaRequest(
      post({ meta, signatureHex: 'de'.repeat(64) }, AUTHOR_USER_ID),
      { store },
    );
    expect(res.status).toBe(403);
    expect((await readJson(res)).error).toBe('bad-signature');
    expect(state.articleMeta.get(ARTICLE_ID)).toBeUndefined();
  });

  it('rejects a tampered field: sign one doi, send another', async () => {
    const { store, state } = seededStore();
    const signed = metaFor(vectors.publicKeyHex);
    const signatureHex = signArticleMeta(signed, vectors.privateKeyHex);
    // The wire meta carries a DIFFERENT doi than the one that was signed.
    const tampered = { ...signed, doi: '10.9999/forged' };
    const res = await handleSetMetaRequest(
      post({ meta: tampered, signatureHex }, AUTHOR_USER_ID),
      { store },
    );
    expect(res.status).toBe(403);
    expect((await readJson(res)).error).toBe('bad-signature');
    expect(state.articleMeta.get(ARTICLE_ID)).toBeUndefined();
  });

  it('rejects a tampered dataset hash', async () => {
    const { store } = seededStore();
    const signed = metaFor(vectors.publicKeyHex);
    const signatureHex = signArticleMeta(signed, vectors.privateKeyHex);
    const tampered = { ...signed, datasetHashes: ['sha256:evil'] };
    const res = await handleSetMetaRequest(
      post({ meta: tampered, signatureHex }, AUTHOR_USER_ID),
      { store },
    );
    expect(res.status).toBe(403);
    expect((await readJson(res)).error).toBe('bad-signature');
  });

  it('rejects a non-author caller (valid signature, wrong session)', async () => {
    const { store, state } = seededStore();
    // A second profile with its OWN key holds a valid signature over the meta,
    // but is not the head author of the article.
    state.profiles.set('profile-2', {
      id: 'profile-2',
      userId: 'auth-user-2',
      pubkey: vectors.publicKeyHex,
    });
    const meta = metaFor(vectors.publicKeyHex);
    const res = await handleSetMetaRequest(post(bodyFor(meta), 'auth-user-2'), { store });
    expect(res.status).toBe(403);
    expect((await readJson(res)).error).toBe('not-author');
    expect(state.articleMeta.get(ARTICLE_ID)).toBeUndefined();
  });

  it('rejects a signer pubkey that is not the head author key', async () => {
    const { store } = seededStore();
    // The author signs with a DIFFERENT key than the one bound to their profile.
    // signerPubkey mismatches head.authorPubkey, so this is a not-author reject
    // before the crypto verify runs.
    const meta = { ...metaFor('ab'.repeat(32)) };
    const res = await handleSetMetaRequest(post(bodyFor(meta), AUTHOR_USER_ID), { store });
    expect(res.status).toBe(403);
    expect((await readJson(res)).error).toBe('not-author');
  });

  it('rejects an unknown article', async () => {
    const { store } = seededStore();
    const meta = { ...metaFor(vectors.publicKeyHex), articleId: '99999999-9999-9999-9999-999999999999' };
    const res = await handleSetMetaRequest(post(bodyFor(meta), AUTHOR_USER_ID), { store });
    expect(res.status).toBe(404);
    expect((await readJson(res)).error).toBe('bad-payload');
  });

  it('rejects a malformed rights route', async () => {
    const { store } = seededStore();
    const meta = { ...metaFor(vectors.publicKeyHex), rightsRoute: 'made-up' };
    const res = await handleSetMetaRequest(post(bodyFor(meta), AUTHOR_USER_ID), { store });
    expect(res.status).toBe(400);
    expect((await readJson(res)).error).toBe('bad-payload');
  });

  it('rejects a non-https canonical url', async () => {
    const { store } = seededStore();
    const meta = { ...metaFor(vectors.publicKeyHex), canonicalUrl: 'http://insecure.example' };
    const res = await handleSetMetaRequest(post(bodyFor(meta), AUTHOR_USER_ID), { store });
    expect(res.status).toBe(400);
    expect((await readJson(res)).error).toBe('bad-payload');
  });
});
