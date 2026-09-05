import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { signRevision } from '../../../../modules/mynews/src/signing/sign';
import { handlePublishRequest } from '../index.ts';
import { EDGE_CURRENT_TERMS_VERSION } from '../../_shared/mynews-terms.ts';
import { createInMemoryMyNewsStore, type MyNewsStore } from '../../_shared/mynews-store.ts';
import {
  canonicalScreeningPayload,
  sha256Hex,
} from '../../_shared/mynews-screening-gate.ts';

/**
 * Publish screening end to end (plan 48 WP8).
 *
 * The load-bearing property is the quarantine REPRESENTATION: a held first
 * revision leaves the article as a draft (which every existing public read path
 * already excludes) and a held later revision does not advance current_rev, so
 * readers keep the last cleared revision. Both are asserted on state, not on
 * status codes.
 */

const vectors = JSON.parse(
  readFileSync(
    join(__dirname, '../../../../modules/mynews/src/signing/__fixtures__/signing-vectors.json'),
    'utf8',
  ),
);

const AUTHOR_USER_ID = 'auth-author-1';
const PROFILE_ID = 'profile-1';
const NEW_ARTICLE_ID = 'a-fresh-1';
const NOW_MS = Date.parse('2026-07-30T12:00:00.000Z');

const HATE_BODY = 'you are nothing but a kike and everyone knows it, and that is the whole story';
const CLEAN_BODY = 'The valley faces a hard season.\n\nCounty filings show a 34% drop.';

function jwtFor(sub: string): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ sub })).toString('base64url');
  return `${header}.${payload}.sig`;
}

function post(body: unknown): Request {
  return new Request('http://local/mynews-publish', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${jwtFor(AUTHOR_USER_ID)}`,
    },
    body: JSON.stringify(body),
  });
}

/** A signed revision with a chosen body, so the signature stays valid. */
function signedRevision(over: { articleId?: string; rev?: number; bodyMd?: string }) {
  const revision = {
    ...vectors.revision,
    ...(over.articleId !== undefined ? { articleId: over.articleId } : {}),
    ...(over.rev !== undefined ? { rev: over.rev } : {}),
    ...(over.bodyMd !== undefined ? { bodyMd: over.bodyMd } : {}),
  };
  return {
    revision,
    signatureHex: signRevision(revision, vectors.privateKeyHex),
  };
}

function body(over: { articleId?: string; rev?: number; bodyMd?: string; slug?: string } = {}) {
  const articleId = over.articleId ?? vectors.revision.articleId;
  const signed = signedRevision({ articleId, rev: over.rev, bodyMd: over.bodyMd });
  return {
    article: {
      id: articleId,
      slug: over.slug ?? 'owens-valley',
      kind: 'news',
      authorPubkey: vectors.publicKeyHex,
    },
    revision: signed.revision,
    signatureHex: signed.signatureHex,
  };
}

function seededStore() {
  const built = createInMemoryMyNewsStore({
    // Pin the store clock to the same NOW_MS the handler deps use; without it
    // the allowance-expiry filter reads the REAL clock and the approved-bytes
    // tests detonate 24h after the fixture date (2026-08-01 CI failure).
    now: () => NOW_MS,
    profiles: [{ id: PROFILE_ID, userId: AUTHOR_USER_ID, pubkey: vectors.publicKeyHex }],
    termsAcceptances: [{ userId: AUTHOR_USER_ID, version: EDGE_CURRENT_TERMS_VERSION }],
  });
  // Existing published article at head rev 1; the fixture revision is rev 2.
  built.state.articles.set(vectors.revision.articleId, {
    id: vectors.revision.articleId,
    slug: 'owens-valley',
    kind: 'news',
    status: 'published',
    authorProfileId: PROFILE_ID,
    authorPubkey: vectors.publicKeyHex,
    currentRev: 1,
  });
  return built;
}

const deps = (store: MyNewsStore) => ({ store, now: () => NOW_MS, screeningProvider: null });

async function readJson(res: Response): Promise<Record<string, unknown>> {
  return (await res.json()) as Record<string, unknown>;
}

describe('publish screening: clean content', () => {
  it('publishes and bumps the head exactly as before', async () => {
    const { store, state } = seededStore();
    const res = await handlePublishRequest(post(body({ bodyMd: CLEAN_BODY })), deps(store));
    expect(res.status).toBe(200);
    expect(state.articles.get(vectors.revision.articleId)?.currentRev).toBe(2);
    expect(state.articles.get(vectors.revision.articleId)?.screeningStatus).toBeUndefined();
    expect(state.revisions).toHaveLength(1);
    expect(state.screeningDecisions).toHaveLength(0);
  });
});

describe('publish screening: held later revision', () => {
  it('does not advance the head, so readers keep the last cleared revision', async () => {
    const { store, state } = seededStore();
    const res = await handlePublishRequest(post(body({ bodyMd: HATE_BODY })), deps(store));
    expect(res.status).toBe(202);
    const payload = await readJson(res);
    expect(payload.error).toBe('screening-quarantined');

    const article = state.articles.get(vectors.revision.articleId)!;
    // The single most important assertion in this file.
    expect(article.currentRev).toBe(1);
    expect(article.status).toBe('published');
    // The revision exists and is marked held.
    expect(state.revisions).toHaveLength(1);
    expect(state.quarantinedRevisions).toEqual([
      { articleId: vectors.revision.articleId, rev: 2 },
    ]);
  });

  it('records the decision as a revision hold attributed to the author', async () => {
    const { store, state } = seededStore();
    await handlePublishRequest(post(body({ bodyMd: HATE_BODY })), deps(store));
    expect(state.screeningDecisions).toHaveLength(1);
    const decision = state.screeningDecisions[0]!;
    expect(decision.contentKind).toBe('revision');
    expect(decision.contentId).toBe(vectors.revision.articleId);
    expect(decision.contentRev).toBe(2);
    expect(decision.authorProfileId).toBe(PROFILE_ID);
    expect(decision.autoAction).toBe('quarantined');
    expect(decision.decision).toBe('pending');
  });

  it('a clean resubmission over a held revision unfreezes the article (finding A4)', async () => {
    const { store, state } = seededStore();
    // First submission is held at rev 2; current_rev stays 1.
    const held = await handlePublishRequest(post(body({ bodyMd: HATE_BODY })), deps(store));
    expect(held.status).toBe(202);
    expect(state.quarantinedRevisions).toEqual([
      { articleId: vectors.revision.articleId, rev: 2 },
    ]);

    // The author resubmits cleaned text at the SAME rev 2. Before the fix this
    // collided on the (article_id, rev) primary key and raised a 500, freezing
    // the article forever. Now it replaces the held revision and publishes.
    const clean = await handlePublishRequest(post(body({ bodyMd: CLEAN_BODY })), deps(store));
    expect(clean.status).toBe(200);
    const article = state.articles.get(vectors.revision.articleId)!;
    expect(article.currentRev).toBe(2);
    expect(article.screeningStatus).toBe('cleared');
    // The held revision was replaced, not stacked: exactly one revision at rev 2.
    expect(state.revisions.filter((r) => r.rev === 2)).toHaveLength(1);
    expect(state.quarantinedRevisions).toHaveLength(0);
  });
});

describe('publish screening: held first revision', () => {
  it('leaves a brand new article as a draft, which no public read returns', async () => {
    const { store, state } = seededStore();
    const res = await handlePublishRequest(
      post(body({ articleId: NEW_ARTICLE_ID, rev: 1, bodyMd: HATE_BODY, slug: 'fresh-piece' })),
      deps(store),
    );
    expect(res.status).toBe(202);
    const article = state.articles.get(NEW_ARTICLE_ID)!;
    // 'draft' is the representation: every existing policy filters on it.
    expect(article.status).toBe('draft');
    expect(article.screeningStatus).toBe('quarantined');
    expect(article.publishedAt).toBeNull();
    expect(state.screeningDecisions[0]!.contentKind).toBe('article');
  });

  it('refuses a slug that is already taken rather than holding it', async () => {
    const { store, state } = seededStore();
    const res = await handlePublishRequest(
      post(body({ articleId: NEW_ARTICLE_ID, rev: 1, bodyMd: HATE_BODY, slug: 'owens-valley' })),
      deps(store),
    );
    expect(res.status).toBe(409);
    expect(state.articles.has(NEW_ARTICLE_ID)).toBe(false);
    expect(state.screeningDecisions).toHaveLength(0);
  });

  it('refuses a rev conflict rather than holding it', async () => {
    const { store, state } = seededStore();
    const broken: MyNewsStore = {
      ...store,
      // Force the hold path to see a stale head by moving it after validation.
      quarantineArticle: async (input) => {
        state.articles.get(vectors.revision.articleId)!.currentRev = 5;
        return store.quarantineArticle(input);
      },
    };
    const res = await handlePublishRequest(post(body({ bodyMd: HATE_BODY })), deps(broken));
    expect(res.status).toBe(409);
    expect((await readJson(res)).error).toBe('rev-conflict');
  });
});

describe('publish screening: fail closed', () => {
  it('publishes nothing when screening cannot run', async () => {
    const { store, state } = seededStore();
    const broken: MyNewsStore = {
      ...store,
      screeningAllowanceExists: () => Promise.reject(new Error('db down')),
    };
    const res = await handlePublishRequest(post(body({ bodyMd: CLEAN_BODY })), deps(broken));
    expect(res.status).toBe(503);
    expect((await readJson(res)).error).toBe('screening-unavailable');
    expect(state.articles.get(vectors.revision.articleId)?.currentRev).toBe(1);
    expect(state.revisions).toHaveLength(0);
  });

  it('publishes nothing when the hold write fails', async () => {
    const { store, state } = seededStore();
    const broken: MyNewsStore = {
      ...store,
      quarantineArticle: async () => ({ ok: false, code: 'unavailable' }),
    };
    const res = await handlePublishRequest(post(body({ bodyMd: HATE_BODY })), deps(broken));
    expect(res.status).toBe(503);
    expect(state.articles.get(vectors.revision.articleId)?.currentRev).toBe(1);
    expect(state.revisions).toHaveLength(0);
  });

  it('never calls the normal publish path for held content', async () => {
    const { store } = seededStore();
    let publishCalls = 0;
    const watched: MyNewsStore = {
      ...store,
      publishArticle: async (record) => {
        publishCalls += 1;
        return store.publishArticle(record);
      },
    };
    await handlePublishRequest(post(body({ bodyMd: HATE_BODY })), deps(watched));
    expect(publishCalls).toBe(0);
  });
});

describe('publish screening: approved bytes go through', () => {
  it('publishes normally once the author holds an allowance for those bytes', async () => {
    const { store, state } = seededStore();
    const signed = signedRevision({ articleId: vectors.revision.articleId, bodyMd: HATE_BODY });
    const payload = canonicalScreeningPayload({
      kind: 'article',
      text: HATE_BODY,
      title: [signed.revision.headline, signed.revision.dek ?? ''].join(' '),
    });
    state.screeningAllowances.push({
      authorProfileId: PROFILE_ID,
      contentSha256: await sha256Hex(payload),
      expiresAt: new Date(NOW_MS + 86_400_000).toISOString(),
    });

    const res = await handlePublishRequest(post(body({ bodyMd: HATE_BODY })), deps(store));
    expect(res.status).toBe(200);
    expect(state.articles.get(vectors.revision.articleId)?.currentRev).toBe(2);
    expect(state.screeningDecisions).toHaveLength(0);
  });
});
