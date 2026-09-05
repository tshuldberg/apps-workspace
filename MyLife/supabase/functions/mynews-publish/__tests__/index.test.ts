import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { SignableRevision } from '../../../../modules/mynews/src/signing/canonical';
import { signRevision } from '../../../../modules/mynews/src/signing/sign';
import { handlePublishRequest } from '../index.ts';
import {
  canonicalRevisionBytes,
  canonicalSuggestionBytes,
} from '../../_shared/mynews-signing.ts';
import { EDGE_MYNEWS_BOUNDS } from '../../_shared/mynews-bounds.ts';
import { createInMemoryMyNewsStore, type NewsroomRole } from '../../_shared/mynews-store.ts';
import { EDGE_CURRENT_TERMS_VERSION } from '../../_shared/mynews-terms.ts';

const vectors = JSON.parse(
  readFileSync(
    join(__dirname, '../../../../modules/mynews/src/signing/__fixtures__/signing-vectors.json'),
    'utf8',
  ),
);

const toHex = (bytes: Uint8Array) =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');

// The JWT subject used by post(); the terms gate keys on this auth user id.
const AUTHOR_USER_ID = 'auth-author-1';

function jwtFor(sub: string): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ sub })).toString('base64url');
  return `${header}.${payload}.sig`;
}

/** Default request carries a terms-accepted author; opts.sub=null signs out. */
function post(body: unknown, opts?: { sub?: string | null }): Request {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const sub = opts && 'sub' in opts ? opts.sub : AUTHOR_USER_ID;
  if (sub) headers.Authorization = `Bearer ${jwtFor(sub)}`;
  return new Request('http://local/mynews-publish', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

/** Terms-acceptance seed satisfying the gate for AUTHOR_USER_ID. */
const acceptedTerms = () => [{ userId: AUTHOR_USER_ID, version: EDGE_CURRENT_TERMS_VERSION }];

function seededStore() {
  const { store, state } = createInMemoryMyNewsStore({
    profiles: [{ id: 'profile-1', userId: AUTHOR_USER_ID, pubkey: vectors.publicKeyHex }],
    termsAcceptances: acceptedTerms(),
  });
  // The fixture revision is rev 2; seed the article at head rev 1.
  state.articles.set(vectors.revision.articleId, {
    id: vectors.revision.articleId,
    slug: 'owens-valley',
    kind: 'news',
    status: 'published',
    authorProfileId: 'profile-1',
    authorPubkey: vectors.publicKeyHex,
    currentRev: 1,
  });
  return { store, state };
}

describe('canonical twin parity (the cross-boundary guard)', () => {
  it('produces byte-identical revision and suggestion payloads to the module fixture', () => {
    expect(toHex(canonicalRevisionBytes(vectors.revision))).toBe(vectors.revisionCanonicalHex);
    expect(toHex(canonicalSuggestionBytes(vectors.suggestion))).toBe(
      vectors.suggestionCanonicalHex,
    );
  });
});

describe('handlePublishRequest', () => {
  const validBody = () => ({
    article: {
      id: vectors.revision.articleId,
      slug: 'owens-valley',
      kind: 'news',
      authorPubkey: vectors.publicKeyHex,
    },
    revision: vectors.revision,
    signatureHex: vectors.revisionSignatureHex,
  });

  it('verifies the fixture signature end to end and bumps the head', async () => {
    const { store, state } = seededStore();
    const res = await handlePublishRequest(post(validBody()), { store });
    expect(res.status).toBe(200);
    const payload = await res.json();
    expect(payload).toEqual({
      ok: true,
      data: { articleId: vectors.revision.articleId, rev: 2, slug: 'owens-valley' },
    });
    expect(state.articles.get(vectors.revision.articleId)?.currentRev).toBe(2);
    expect(state.revisions).toHaveLength(1);
  });

  it('blocks a suspended author (suspended 403)', async () => {
    const { store, state } = seededStore();
    await store.moderateSuspendProfile({
      profileId: 'profile-1',
      until: '2099-01-01T00:00:00.000Z',
      moderatorRef: 'mod@ops',
      note: 'abuse',
    });
    const res = await handlePublishRequest(post(validBody()), { store });
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe('suspended');
    // Head unchanged: no revision written.
    expect(state.articles.get(vectors.revision.articleId)?.currentRev).toBe(1);
    expect(state.revisions).toHaveLength(0);
  });

  it('publishes a brand-new article at rev 1', async () => {
    const { store } = createInMemoryMyNewsStore({
      profiles: [{ id: 'profile-1', userId: AUTHOR_USER_ID, pubkey: vectors.publicKeyHex }],
      termsAcceptances: acceptedTerms(),
    });
    // Re-sign a rev-1 payload is not possible in the test (no key ops here),
    // so use the fixture private key via the module is out of scope: instead
    // inject a verify stub for THIS case only; signature checks are covered
    // by the fixture path above and the tamper case below.
    const body = {
      ...validBody(),
      revision: { ...vectors.revision, rev: 1 },
    };
    const res = await handlePublishRequest(post(body), {
      store,
      verify: async () => true,
    });
    expect(res.status).toBe(200);
  });

  it('rejects tampered content with the real verifier', async () => {
    const { store } = seededStore();
    const body = validBody();
    body.revision = { ...body.revision, bodyMd: `${body.revision.bodyMd} (tampered)` };
    const res = await handlePublishRequest(post(body), { store });
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe('bad-signature');
  });

  it('rejects an author/signer mismatch before verifying', async () => {
    const { store } = seededStore();
    const body = validBody();
    body.article = { ...body.article, authorPubkey: 'someone-else' };
    const res = await handlePublishRequest(post(body), { store });
    expect((await res.json()).error).toBe('author-mismatch');
  });

  it('requires a registered profile', async () => {
    const { store } = createInMemoryMyNewsStore();
    const res = await handlePublishRequest(post(validBody()), {
      store,
      verify: async () => true,
    });
    expect((await res.json()).error).toBe('no-profile');
  });

  it('enforces the revision chain', async () => {
    const { store, state } = seededStore();
    state.articles.get(vectors.revision.articleId)!.currentRev = 5;
    const res = await handlePublishRequest(post(validBody()), {
      store,
      verify: async () => true,
    });
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe('rev-conflict');
  });

  it('bounds a client-supplied createdAt after the signature check', async () => {
    // The signed bytes are untouched; verify is stubbed so only the createdAt
    // gate decides. Post-dated beyond the skew window and implausibly old both
    // reject as bad-payload; the article stays unwritten.
    const nowMs = Date.parse('2026-07-03T12:00:00.000Z');
    for (const createdAt of ['2026-07-03T12:10:00.000Z', '2019-01-01T00:00:00.000Z', 'not-a-date']) {
      const { store, state } = seededStore();
      const body = { ...validBody(), revision: { ...vectors.revision, createdAt } };
      const res = await handlePublishRequest(post(body), {
        store,
        verify: async () => true,
        now: () => nowMs,
      });
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe('bad-payload');
      expect(state.revisions).toHaveLength(0);
    }
  });

  it('admits a createdAt inside the future skew window', async () => {
    const nowMs = Date.parse('2026-07-03T12:00:00.000Z');
    const { store } = seededStore();
    const body = {
      ...validBody(),
      revision: { ...vectors.revision, createdAt: '2026-07-03T12:04:00.000Z' },
    };
    const res = await handlePublishRequest(post(body), {
      store,
      verify: async () => true,
      now: () => nowMs,
    });
    expect(res.status).toBe(200);
  });

  it('rejects malformed payloads and slugs', async () => {
    const { store } = seededStore();
    expect((await (await handlePublishRequest(post({}), { store })).json()).error).toBe(
      'bad-payload',
    );
    const body = validBody();
    body.article = { ...body.article, slug: 'NO CAPS OR SPACES' };
    expect((await (await handlePublishRequest(post(body), { store })).json()).error).toBe(
      'bad-payload',
    );
  });
});

describe('terms-acceptance gate (publish, Plan 39 T11)', () => {
  const validBody = () => ({
    article: {
      id: vectors.revision.articleId,
      slug: 'owens-valley',
      kind: 'news',
      authorPubkey: vectors.publicKeyHex,
    },
    revision: vectors.revision,
    signatureHex: vectors.revisionSignatureHex,
  });

  it('rejects a signed-out request with 401', async () => {
    const { store } = seededStore();
    const res = await handlePublishRequest(post(validBody(), { sub: null }), { store });
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe('not-signed-in');
  });

  it('blocks an author who has not accepted the current terms', async () => {
    const { store, state } = createInMemoryMyNewsStore({
      profiles: [{ id: 'profile-1', userId: AUTHOR_USER_ID, pubkey: vectors.publicKeyHex }],
      // No terms acceptance seeded.
    });
    state.articles.set(vectors.revision.articleId, {
      id: vectors.revision.articleId,
      slug: 'owens-valley',
      kind: 'news',
      status: 'published',
      authorProfileId: 'profile-1',
      authorPubkey: vectors.publicKeyHex,
      currentRev: 1,
    });
    const res = await handlePublishRequest(post(validBody()), { store });
    expect(res.status).toBe(403);
    const payload = await res.json();
    expect(payload.error).toBe('terms-not-accepted');
    expect(payload.detail).toBe(EDGE_CURRENT_TERMS_VERSION);
    expect(state.revisions).toHaveLength(0);
  });

  it('re-gates after a version bump (a stale acceptance no longer satisfies)', async () => {
    const { store, state } = createInMemoryMyNewsStore({
      profiles: [{ id: 'profile-1', userId: AUTHOR_USER_ID, pubkey: vectors.publicKeyHex }],
      termsAcceptances: [{ userId: AUTHOR_USER_ID, version: '2000-01-01' }],
    });
    state.articles.set(vectors.revision.articleId, {
      id: vectors.revision.articleId,
      slug: 'owens-valley',
      kind: 'news',
      status: 'published',
      authorProfileId: 'profile-1',
      authorPubkey: vectors.publicKeyHex,
      currentRev: 1,
    });
    const res = await handlePublishRequest(post(validBody()), { store });
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe('terms-not-accepted');
  });

  it('admits the write once the current terms are accepted', async () => {
    const { store } = seededStore();
    const res = await handlePublishRequest(post(validBody()), { store });
    expect(res.status).toBe(200);
  });
});

describe('newsroom drafts (C4 publish v2)', () => {
  const NOW_ISO = '2026-07-03T13:00:00.000Z';

  function newsroomStore(role: NewsroomRole | null) {
    return createInMemoryMyNewsStore({
      profiles: [{ id: 'author-1', userId: 'user-author', pubkey: vectors.publicKeyHex }],
      newsroomMembers: role
        ? [{ newsroomId: 'room-1', profileId: 'author-1', role }]
        : [],
      // post() signs as AUTHOR_USER_ID; seed that user's acceptance so the
      // newsroom gate (not the terms gate) is what these tests exercise.
      termsAcceptances: acceptedTerms(),
    });
  }

  /** Fresh vectors via the module signer; the committed fixture is untouched. */
  function signedBody(over: {
    rev: number;
    draft?: boolean;
    newsroomId?: string | null;
  }): { article: Record<string, unknown>; revision: SignableRevision; signatureHex: string } {
    const revision: SignableRevision = {
      articleId: 'art-draft-1',
      rev: over.rev,
      headline: 'Embargoed newsroom story',
      dek: 'Held for review.',
      bodyMd: `Draft body at rev ${over.rev}.`,
      changelog: [],
      createdAt: '2026-07-03T12:45:00.000Z',
      signerPubkey: vectors.publicKeyHex,
    };
    return {
      article: {
        id: 'art-draft-1',
        slug: 'embargoed-newsroom-story',
        kind: 'news',
        authorPubkey: vectors.publicKeyHex,
        ...(over.draft !== undefined ? { draft: over.draft } : {}),
        ...(over.newsroomId !== undefined ? { newsroomId: over.newsroomId } : {}),
      },
      revision,
      signatureHex: signRevision(revision, vectors.privateKeyHex),
    };
  }

  it('requires a newsroom for draft publishes', async () => {
    const { store, state } = newsroomStore('owner');
    for (const newsroomId of [undefined, null] as const) {
      const res = await handlePublishRequest(
        post(signedBody({ rev: 1, draft: true, newsroomId })),
        { store },
      );
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe('bad-payload');
    }
    expect(state.articles.size).toBe(0);
  });

  it('rejects reviewers and non-members with not-newsroom-member', async () => {
    for (const role of ['reviewer', null] as const) {
      const { store, state } = newsroomStore(role);
      const res = await handlePublishRequest(
        post(signedBody({ rev: 1, draft: true, newsroomId: 'room-1' })),
        { store },
      );
      expect(res.status).toBe(403);
      expect((await res.json()).error).toBe('not-newsroom-member');
      expect(state.articles.size).toBe(0);
    }
  });

  it('lets a coauthor save a newsroom draft', async () => {
    const { store, state } = newsroomStore('coauthor');
    const res = await handlePublishRequest(
      post(signedBody({ rev: 1, draft: true, newsroomId: 'room-1' })),
      { store },
    );
    expect(res.status).toBe(200);
    expect(state.articles.get('art-draft-1')?.status).toBe('draft');
  });

  it('gates a newsroomId-omitting draft transition on CURRENT membership', async () => {
    // The author's membership was removed after the draft was saved; leaving
    // newsroomId out of the publish request must not bypass the gate.
    const { store, state } = newsroomStore(null);
    state.articles.set('art-draft-1', {
      id: 'art-draft-1',
      slug: 'embargoed-newsroom-story',
      kind: 'news',
      status: 'draft',
      authorProfileId: 'author-1',
      authorPubkey: vectors.publicKeyHex,
      currentRev: 1,
      newsroomId: 'room-1',
      publishedAt: null,
    });
    const res = await handlePublishRequest(post(signedBody({ rev: 2 })), { store });
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe('not-newsroom-member');
    expect(state.articles.get('art-draft-1')?.status).toBe('draft');
  });

  it('publishes a draft, then transitions it to published, end to end', async () => {
    const { store, state } = newsroomStore('owner');
    const now = () => Date.parse(NOW_ISO);

    const draftRes = await handlePublishRequest(
      post(signedBody({ rev: 1, draft: true, newsroomId: 'room-1' })),
      { store, now },
    );
    expect(draftRes.status).toBe(200);
    expect((await draftRes.json()).data).toEqual({
      articleId: 'art-draft-1',
      rev: 1,
      slug: 'embargoed-newsroom-story',
    });
    let art = state.articles.get('art-draft-1');
    expect(art?.status).toBe('draft');
    expect(art?.publishedAt).toBeNull();
    expect(art?.newsroomId).toBe('room-1');

    // Publish-the-draft: a fresh author-signed revision, no draft flag.
    const publishRes = await handlePublishRequest(
      post(signedBody({ rev: 2, newsroomId: 'room-1' })),
      { store, now },
    );
    expect(publishRes.status).toBe(200);
    art = state.articles.get('art-draft-1');
    expect(art?.status).toBe('published');
    expect(art?.publishedAt).toBe(NOW_ISO);
    expect(art?.currentRev).toBe(2);
    expect(state.revisions).toHaveLength(2);
  });

  it('still requires a fresh revision to publish the draft', async () => {
    const { store, state } = newsroomStore('owner');
    await handlePublishRequest(
      post(signedBody({ rev: 1, draft: true, newsroomId: 'room-1' })),
      { store },
    );
    const stale = await handlePublishRequest(post(signedBody({ rev: 1, newsroomId: 'room-1' })), {
      store,
    });
    expect(stale.status).toBe(409);
    expect((await stale.json()).error).toBe('rev-conflict');
    expect(state.articles.get('art-draft-1')?.status).toBe('draft');
  });

  it('rejects malformed draft and newsroomId field types', async () => {
    const { store } = newsroomStore('owner');
    const base = signedBody({ rev: 1 });
    for (const article of [
      { ...base.article, draft: 'yes' },
      { ...base.article, newsroomId: 42 },
    ]) {
      const res = await handlePublishRequest(post({ ...base, article }), { store });
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe('bad-payload');
    }
  });
});

// Plan 48 WP4. Bounds run before the Ed25519 verify, so these payloads carry
// the untouched fixture signature: the point is that an oversized field never
// reaches the verify, the store, or the SQL CHECKs in 20260730000003.
describe('handlePublishRequest canonical bounds', () => {
  const validBody = () => ({
    article: {
      id: vectors.revision.articleId,
      slug: 'owens-valley',
      kind: 'news',
      authorPubkey: vectors.publicKeyHex,
    },
    revision: vectors.revision,
    signatureHex: vectors.revisionSignatureHex,
  });

  const withRevision = (over: Record<string, unknown>) => {
    const body = validBody();
    return { ...body, revision: { ...body.revision, ...over } };
  };

  it('rejects an over-long headline, dek, body, and changelog', async () => {
    const cases: Array<[string, Record<string, unknown>, string]> = [
      [
        'headline',
        { headline: 'h'.repeat(EDGE_MYNEWS_BOUNDS.HEADLINE_MAX_CHARS + 1) },
        String(EDGE_MYNEWS_BOUNDS.HEADLINE_MAX_CHARS),
      ],
      [
        'dek',
        { dek: 'd'.repeat(EDGE_MYNEWS_BOUNDS.DEK_MAX_CHARS + 1) },
        String(EDGE_MYNEWS_BOUNDS.DEK_MAX_CHARS),
      ],
      [
        'bodyMd',
        { bodyMd: 'b'.repeat(EDGE_MYNEWS_BOUNDS.BODY_MAX_BYTES + 1) },
        String(EDGE_MYNEWS_BOUNDS.BODY_MAX_BYTES),
      ],
      [
        'changelog',
        {
          changelog: new Array(EDGE_MYNEWS_BOUNDS.CHANGELOG_MAX_ENTRIES + 1).fill({
            suggestionId: 's',
            editorKey: 'k',
            type: 'copyedit',
          }),
        },
        String(EDGE_MYNEWS_BOUNDS.CHANGELOG_MAX_ENTRIES),
      ],
    ];
    for (const [field, over, expectedInDetail] of cases) {
      const { store, state } = seededStore();
      const res = await handlePublishRequest(post(withRevision(over)), { store });
      expect(res.status, field).toBe(400);
      const payload = await res.json();
      expect(payload.error, field).toBe('bounds');
      expect(String(payload.detail), field).toContain(expectedInDetail);
      expect(state.revisions, field).toHaveLength(0);
    }
  });

  it('accepts text exactly at the ceiling (the bound is not off by one)', async () => {
    const { store } = seededStore();
    const res = await handlePublishRequest(
      post(
        withRevision({
          headline: 'h'.repeat(EDGE_MYNEWS_BOUNDS.HEADLINE_MAX_CHARS),
          dek: 'd'.repeat(EDGE_MYNEWS_BOUNDS.DEK_MAX_CHARS),
        }),
      ),
      { store },
    );
    // The mutated revision no longer matches the fixture signature, so the
    // request stops at the signature check, one gate PAST the bounds check.
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe('bad-signature');
  });

  it('measures the body in bytes, so non-Latin text is not penalised by count', async () => {
    const { store } = seededStore();
    // Well under BODY_MAX_BYTES as characters, well over it as UTF-8 bytes.
    const res = await handlePublishRequest(
      post(withRevision({ bodyMd: '水'.repeat(140000) })),
      { store },
    );
    expect(res.status).toBe(400);
    const payload = await res.json();
    expect(payload.error).toBe('bounds');
    expect(String(payload.detail)).toContain('bytes');
  });
});
