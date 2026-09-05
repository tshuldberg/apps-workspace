import { describe, expect, it } from 'vitest';
import { MYNEWS_BOUNDS } from './bounds';
import {
  InMemoryCloudAdapter,
  type ArticleView,
  type LedgerRowView,
  type ProfileView,
  type SeededNewsroomDraft,
  type ModerationNoticeView,
  type SeededSuggestion,
  type SuggestionEventView,
} from './cloud';

/** A statement-of-reasons row with the WP9 appeal fields defaulted. */
function noticeFixture(
  over: Partial<ModerationNoticeView> & { ownerUserId: string },
): ModerationNoticeView & { ownerUserId: string } {
  return {
    targetKind: 'article',
    targetId: 'a1',
    machineReason: 'hide_article',
    note: '',
    createdAt: '2026-07-01T00:00:00.000Z',
    actionId: 'act-1',
    appealState: 'none',
    appealReason: '',
    appealDecisionReason: '',
    appealReversalOutcome: null,
    appealDecidedAt: null,
    ...over,
  };
}

function article(over: Partial<ArticleView>): ArticleView {
  return {
    articleId: 'a1',
    slug: 'owens-valley',
    headline: 'Owens Valley water dispute deepens',
    dek: 'Filings show a 34% drop.',
    kind: 'news',
    rev: 2,
    publishedAt: '2026-07-03T10:00:00.000Z',
    authorHandle: 'rosamarin',
    authorDisplayName: 'Rosa Marín',
    authorPubkey: 'pub-rosa',
    authorTier: 'verified',
    status: 'published',
    bodyMd: 'The valley faces a hard season.',
    signature: 'sig',
    signerPubkey: 'pub-rosa',
    createdAt: '2026-07-03T09:00:00.000Z',
    revisionSummaries: [{ rev: 1, createdAt: '2026-07-03T09:00:00.000Z', changelog: [] }],
    ...over,
  };
}

describe('InMemoryCloudAdapter', () => {
  it('feeds only followed, published authors, newest first, with pagination', async () => {
    const port = new InMemoryCloudAdapter();
    port.articles = [
      article({ articleId: 'a1', slug: 's1', publishedAt: '2026-07-01T00:00:00.000Z' }),
      article({ articleId: 'a2', slug: 's2', publishedAt: '2026-07-03T00:00:00.000Z' }),
      article({ articleId: 'a3', slug: 's3', authorPubkey: 'pub-other' }),
      article({ articleId: 'a4', slug: 's4', status: 'retracted' }),
    ];
    const feed = await port.getFeed({ followedPubkeys: ['pub-rosa'] });
    expect(feed.map((f) => f.articleId)).toEqual(['a2', 'a1']);
    expect(feed[0]).not.toHaveProperty('bodyMd');

    const page2 = await port.getFeed({
      followedPubkeys: ['pub-rosa'],
      beforePublishedAt: '2026-07-03T00:00:00.000Z',
    });
    expect(page2.map((f) => f.articleId)).toEqual(['a1']);
  });

  it('getLatest browses newest published articles across all authors with a limit', async () => {
    const port = new InMemoryCloudAdapter();
    port.articles = [
      article({ articleId: 'a1', slug: 's1', publishedAt: '2026-07-01T00:00:00.000Z' }),
      article({
        articleId: 'a2',
        slug: 's2',
        authorPubkey: 'pub-other',
        publishedAt: '2026-07-03T00:00:00.000Z',
      }),
      article({ articleId: 'a3', slug: 's3', publishedAt: '2026-07-02T00:00:00.000Z' }),
      article({ articleId: 'a4', slug: 's4', status: 'draft' }),
      article({ articleId: 'a5', slug: 's5', status: 'retracted' }),
    ];
    const latest = await port.getLatest();
    expect(latest.map((f) => f.articleId)).toEqual(['a2', 'a3', 'a1']);
    expect(latest[0]).not.toHaveProperty('bodyMd');
    expect((await port.getLatest(2)).map((f) => f.articleId)).toEqual(['a2', 'a3']);
  });

  it('resolves articles by slug and journalists by handle', async () => {
    const port = new InMemoryCloudAdapter();
    port.articles = [article({})];
    port.journalists = [
      {
        handle: 'rosamarin',
        displayName: 'Rosa Marín',
        tier: 'verified',
        bio: 'Water and land.',
        beats: ['water'],
        pubkey: 'pub-rosa',
        articles: [],
      },
    ];
    expect((await port.getArticleBySlug('owens-valley'))?.headline).toContain('Owens Valley');
    expect(await port.getArticleBySlug('missing')).toBeNull();
    expect((await port.getJournalistByHandle('rosamarin'))?.tier).toBe('verified');
  });

  it('searches headlines, bodies, and journalist names', async () => {
    const port = new InMemoryCloudAdapter();
    port.articles = [article({})];
    port.journalists = [
      {
        handle: 'rosamarin',
        displayName: 'Rosa Marín',
        tier: 'verified',
        bio: 'Water and land.',
        beats: [],
        pubkey: 'pub-rosa',
        articles: [],
      },
    ];
    const hits = await port.search('valley');
    expect(hits[0]?.kind).toBe('article');
    const jHits = await port.search('rosa');
    expect(jHits.some((h) => h.kind === 'journalist')).toBe(true);
  });
});

function profile(over: Partial<ProfileView>): ProfileView {
  return {
    id: 'p1',
    userId: 'u1',
    handle: 'rosamarin',
    displayName: 'Rosa Marín',
    pubkeyEd25519: 'pub-rosa',
    kind: 'journalist',
    ...over,
  };
}

function suggestion(over: Partial<SeededSuggestion>): SeededSuggestion {
  return {
    id: 's1',
    articleId: 'a1',
    articleSlug: 'owens-valley',
    articleHeadline: 'Owens Valley water dispute deepens',
    baseRev: 2,
    editorId: 'ed1',
    editorHandle: 'sam',
    editorDisplayName: 'Sam Lee',
    editorPubkey: 'pub-sam',
    type: 'copyedit',
    diff: { baseHash: 'h1', ops: [] },
    citations: [],
    rationale: 'Fixes a typo.',
    status: 'open',
    createdAt: '2026-07-01T00:00:00.000Z',
    endorsements: 0,
    articleAuthorId: 'p1',
    ...over,
  };
}

function event(over: Partial<SuggestionEventView>): SuggestionEventView {
  return {
    id: 'e1',
    suggestionId: 's1',
    actorId: 'p1',
    actorHandle: 'rosamarin',
    action: 'comment',
    payload: {},
    createdAt: '2026-07-01T01:00:00.000Z',
    ...over,
  };
}

function ledgerRow(over: Partial<LedgerRowView>): LedgerRowView {
  return {
    id: 'l1',
    editorId: 'ed1',
    suggestionId: 's1',
    basePoints: 10,
    diversityMult: 0.42,
    standingMult: 0.85,
    awardedAt: '2026-07-02T00:00:00.000Z',
    type: 'correction',
    authorId: 'p1',
    ...over,
  };
}

describe('InMemoryCloudAdapter profiles', () => {
  it('getMyProfile returns null when signed out and the session row when signed in', async () => {
    const port = new InMemoryCloudAdapter();
    port.profiles = [profile({})];
    expect(await port.getMyProfile()).toBeNull();
    port.sessionUserId = 'u1';
    expect((await port.getMyProfile())?.handle).toBe('rosamarin');
    port.sessionUserId = 'u-unknown';
    expect(await port.getMyProfile()).toBeNull();
  });

  it('isHandleAvailable checks the seeded profiles', async () => {
    const port = new InMemoryCloudAdapter();
    port.profiles = [profile({})];
    expect(await port.isHandleAvailable('rosamarin')).toBe(false);
    expect(await port.isHandleAvailable('newcomer')).toBe(true);
  });

  it('registerProfile requires a session and rejects taken handles', async () => {
    const port = new InMemoryCloudAdapter();
    port.profiles = [profile({})];
    const input = { userId: 'u2', handle: 'sam', displayName: 'Sam Lee' };
    expect(await port.registerProfile(input)).toEqual({ ok: false, error: 'not-signed-in' });
    expect(port.profiles).toHaveLength(1);

    port.sessionUserId = 'u2';
    expect(await port.registerProfile({ ...input, handle: 'rosamarin' })).toEqual({
      ok: false,
      error: 'handle-taken',
    });

    const res = await port.registerProfile(input);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.profile.kind).toBe('reader');
      expect(res.profile.handle).toBe('sam');
      // The key is bound in a separate proof-of-possession step; a fresh
      // profile carries the empty-key default until registerKey succeeds.
      expect(res.profile.pubkeyEd25519).toBe('');
    }
    expect((await port.getMyProfile())?.handle).toBe('sam');
  });

  it('registerKey binds the device key with set-once and conflict semantics', async () => {
    const port = new InMemoryCloudAdapter();
    port.sessionUserId = 'u2';
    const created = await port.registerProfile({ userId: 'u2', handle: 'sam', displayName: 'Sam' });
    expect(created.ok).toBe(true);

    // No proof for a phantom uid.
    expect(await port.registerKey({ userId: 'ghost', pubkeyHex: 'k1', signatureHex: 's' })).toEqual({
      ok: false,
      error: 'no-profile',
    });

    expect(await port.registerKey({ userId: 'u2', pubkeyHex: 'k1', signatureHex: 's' })).toEqual({
      ok: true,
    });
    expect((await port.getMyProfile())?.pubkeyEd25519).toBe('k1');

    // Set-once: no silent rotation.
    expect(await port.registerKey({ userId: 'u2', pubkeyHex: 'k2', signatureHex: 's' })).toEqual({
      ok: false,
      error: 'already-set',
    });

    // A second account cannot claim a key another profile already holds.
    port.profiles.push({
      id: 'p3',
      userId: 'u3',
      handle: 'other',
      displayName: 'Other',
      pubkeyEd25519: '',
      kind: 'reader',
    });
    expect(await port.registerKey({ userId: 'u3', pubkeyHex: 'k1', signatureHex: 's' })).toEqual({
      ok: false,
      error: 'pubkey-conflict',
    });
  });

  it('becomeJournalist requires a session and a known profile', async () => {
    const port = new InMemoryCloudAdapter();
    port.profiles = [profile({})];
    const input = { profileId: 'p1', bio: 'Water and land.', beats: ['water'], region: 'CA' };
    expect(await port.becomeJournalist(input)).toEqual({ ok: false, error: 'not-signed-in' });
    port.sessionUserId = 'u1';
    expect(await port.becomeJournalist({ ...input, profileId: 'missing' })).toEqual({
      ok: false,
      error: 'unknown-profile',
    });
    expect(await port.becomeJournalist(input)).toEqual({ ok: true });
  });
});

describe('InMemoryCloudAdapter suggestions', () => {
  function seeded(): InMemoryCloudAdapter {
    const port = new InMemoryCloudAdapter();
    port.suggestions = [
      suggestion({ id: 's1', createdAt: '2026-07-01T00:00:00.000Z' }),
      suggestion({ id: 's2', status: 'accepted', createdAt: '2026-07-02T00:00:00.000Z' }),
      suggestion({ id: 's3', articleId: 'a2', articleAuthorId: 'p2', editorId: 'ed2', createdAt: '2026-07-03T00:00:00.000Z' }),
      suggestion({ id: 's4', articleId: 'a2', articleAuthorId: 'p2', createdAt: '2026-06-30T00:00:00.000Z' }),
    ];
    return port;
  }

  it('getSuggestionsForArticle filters by article and optional status, oldest first', async () => {
    const port = seeded();
    const all = await port.getSuggestionsForArticle('a1');
    expect(all.map((s) => s.id)).toEqual(['s1', 's2']);
    expect(all[0]).not.toHaveProperty('articleAuthorId');
    const open = await port.getSuggestionsForArticle('a1', { status: 'open' });
    expect(open.map((s) => s.id)).toEqual(['s1']);
  });

  it('getSuggestion resolves by id', async () => {
    const port = seeded();
    expect((await port.getSuggestion('s2'))?.status).toBe('accepted');
    expect(await port.getSuggestion('missing')).toBeNull();
  });

  it('getMySuggestions lists the editor newest first', async () => {
    const port = seeded();
    const mine = await port.getMySuggestions('ed1');
    expect(mine.map((s) => s.id)).toEqual(['s2', 's1', 's4']);
    expect(mine[0]).not.toHaveProperty('articleAuthorId');
  });

  it('getReviewQueue lists open suggestions on my articles, oldest first', async () => {
    const port = seeded();
    const queue = await port.getReviewQueue('p2');
    expect(queue.map((s) => s.id)).toEqual(['s4', 's3']);
    expect(queue.every((s) => s.status === 'open')).toBe(true);
  });
});

describe('InMemoryCloudAdapter threads', () => {
  it('getSuggestionEvents filters and sorts oldest first', async () => {
    const port = new InMemoryCloudAdapter();
    port.suggestionEvents = [
      event({ id: 'e2', createdAt: '2026-07-01T02:00:00.000Z' }),
      event({ id: 'e1', createdAt: '2026-07-01T01:00:00.000Z' }),
      event({ id: 'e3', suggestionId: 's9' }),
    ];
    const events = await port.getSuggestionEvents('s1');
    expect(events.map((e) => e.id)).toEqual(['e1', 'e2']);
  });

  it('postSuggestionComment requires a session and appends a comment event', async () => {
    const port = new InMemoryCloudAdapter();
    port.profiles = [profile({})];
    port.suggestions = [suggestion({})];
    port.now = () => '2026-07-03T00:00:00.000Z';
    const input = { suggestionId: 's1', actorProfileId: 'p1', body: 'Nice catch.' };
    expect(await port.postSuggestionComment(input)).toEqual({ ok: false, error: 'not-signed-in' });
    expect(port.suggestionEvents).toHaveLength(0);

    port.sessionUserId = 'u1';
    expect(await port.postSuggestionComment(input)).toEqual({ ok: true });
    expect(port.suggestionEvents).toHaveLength(1);
    const posted = port.suggestionEvents[0];
    expect(posted?.action).toBe('comment');
    expect(posted?.actorHandle).toBe('rosamarin');
    expect(posted?.payload).toEqual({ body: 'Nice catch.' });
    expect(posted?.createdAt).toBe('2026-07-03T00:00:00.000Z');
  });

  it('postSuggestionComment bounds the body and needs a real thread (WP4)', async () => {
    const port = new InMemoryCloudAdapter();
    port.profiles = [profile({})];
    port.suggestions = [suggestion({})];
    port.sessionUserId = 'u1';

    expect(
      await port.postSuggestionComment({ suggestionId: 's1', actorProfileId: 'p1', body: '   ' }),
    ).toEqual({ ok: false, error: 'bounds' });
    expect(
      await port.postSuggestionComment({
        suggestionId: 's1',
        actorProfileId: 'p1',
        body: 'x'.repeat(MYNEWS_BOUNDS.COMMENT_MAX_CHARS + 1),
      }),
    ).toEqual({ ok: false, error: 'bounds' });
    expect(
      await port.postSuggestionComment({
        suggestionId: 'nope',
        actorProfileId: 'p1',
        body: 'Nice catch.',
      }),
    ).toEqual({ ok: false, error: 'unknown-suggestion' });
    expect(port.suggestionEvents).toHaveLength(0);
  });
});

describe('InMemoryCloudAdapter editor profiles', () => {
  it('returns null for unknown handles', async () => {
    const port = new InMemoryCloudAdapter();
    expect(await port.getEditorProfile('missing')).toBeNull();
  });

  it('returns the ledger and aggregates derived from the editor suggestions', async () => {
    const port = new InMemoryCloudAdapter();
    port.profiles = [profile({ id: 'ed1', userId: 'u2', handle: 'sam', displayName: 'Sam Lee', kind: 'editor' })];
    port.ledger = [ledgerRow({ id: 'l1' }), ledgerRow({ id: 'l2', editorId: 'other' })];
    port.suggestions = [
      suggestion({ id: 's1', status: 'open' }),
      suggestion({ id: 's2', status: 'accepted', articleAuthorId: 'p1' }),
      suggestion({ id: 's3', status: 'partial', articleAuthorId: 'p2' }),
      suggestion({ id: 's4', status: 'rejected', articleAuthorId: 'p3' }),
      suggestion({ id: 's5', status: 'stale' }),
      suggestion({ id: 's6', status: 'accepted', editorId: 'other' }),
    ];
    const view = await port.getEditorProfile('sam');
    expect(view?.profile).toEqual({ id: 'ed1', handle: 'sam', displayName: 'Sam Lee', kind: 'editor' });
    expect(view?.ledger.map((l) => l.id)).toEqual(['l1']);
    expect(view?.aggregates).toEqual({
      openCount: 1,
      decidedSampleSize: 3,
      acceptanceRate: 2 / 3,
      distinctAuthors: 2,
    });
  });
});

describe('InMemoryCloudAdapter newsrooms', () => {
  function seeded(): InMemoryCloudAdapter {
    const port = new InMemoryCloudAdapter();
    port.profiles = [
      profile({}),
      profile({ id: 'p2', userId: 'u2', handle: 'sam', displayName: 'Sam Lee', kind: 'editor' }),
    ];
    port.newsrooms = [{ id: 'n1', ownerId: 'p1', name: 'Valley Desk', createdAt: '2026-07-01T00:00:00.000Z' }];
    port.newsroomMembers = [
      { newsroomId: 'n1', profileId: 'p1', handle: 'rosamarin', displayName: 'Rosa Marín', role: 'owner' },
    ];
    const draft: SeededNewsroomDraft = {
      newsroomId: 'n1',
      articleId: 'a9',
      slug: 'draft-piece',
      headline: 'Draft piece',
      rev: 1,
      updatedAt: '2026-07-02T00:00:00.000Z',
      embargoUntil: null,
      authorHandle: 'rosamarin',
    };
    port.newsroomDrafts = [draft];
    port.sessionUserId = 'u1';
    return port;
  }

  it('listMyNewsrooms requires a session and follows memberships', async () => {
    const port = seeded();
    port.sessionUserId = null;
    expect(await port.listMyNewsrooms('p1')).toEqual([]);
    port.sessionUserId = 'u1';
    expect((await port.listMyNewsrooms('p1')).map((n) => n.id)).toEqual(['n1']);
    expect(await port.listMyNewsrooms('p2')).toEqual([]);
  });

  it('createNewsroom requires a session and seeds the owner membership', async () => {
    const port = seeded();
    port.sessionUserId = null;
    expect(await port.createNewsroom({ ownerId: 'p2', name: 'Night Desk' })).toEqual({
      ok: false,
      error: 'not-signed-in',
    });
    port.sessionUserId = 'u2';
    const res = await port.createNewsroom({ ownerId: 'p2', name: 'Night Desk' });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.newsroom.name).toBe('Night Desk');
      const members = port.newsroomMembers.filter((m) => m.newsroomId === res.newsroom.id);
      expect(members).toEqual([
        { newsroomId: res.newsroom.id, profileId: 'p2', handle: 'sam', displayName: 'Sam Lee', role: 'owner' },
      ]);
    }
  });

  it('getNewsroom requires a session and returns members plus drafts', async () => {
    const port = seeded();
    port.sessionUserId = null;
    expect(await port.getNewsroom('n1')).toBeNull();
    port.sessionUserId = 'u1';
    expect(await port.getNewsroom('missing')).toBeNull();
    const view = await port.getNewsroom('n1');
    expect(view?.newsroom.name).toBe('Valley Desk');
    expect(view?.members.map((m) => m.role)).toEqual(['owner']);
    expect(view?.drafts.map((d) => d.slug)).toEqual(['draft-piece']);
    expect(view?.drafts[0]).not.toHaveProperty('newsroomId');
  });

  it('addNewsroomMember resolves handles and removeNewsroomMember deletes the row', async () => {
    const port = seeded();
    const add = { newsroomId: 'n1', handle: 'sam', role: 'reviewer' as const, invitedBy: 'p1' };
    port.sessionUserId = null;
    expect(await port.addNewsroomMember(add)).toEqual({ ok: false, error: 'not-signed-in' });
    port.sessionUserId = 'u1';
    expect(await port.addNewsroomMember({ ...add, handle: 'ghost' })).toEqual({
      ok: false,
      error: 'unknown-handle',
    });
    expect(await port.addNewsroomMember(add)).toEqual({ ok: true });
    expect(port.newsroomMembers).toContainEqual({
      newsroomId: 'n1',
      profileId: 'p2',
      handle: 'sam',
      displayName: 'Sam Lee',
      role: 'reviewer',
    });

    expect(await port.removeNewsroomMember({ newsroomId: 'n1', profileId: 'p2' })).toEqual({ ok: true });
    expect(port.newsroomMembers.some((m) => m.profileId === 'p2')).toBe(false);
  });

  it('getDraftArticle requires a session and resolves drafts by id', async () => {
    const port = seeded();
    port.draftArticles = [article({ articleId: 'a9', slug: 'draft-piece' })];
    port.sessionUserId = null;
    expect(await port.getDraftArticle('a9')).toBeNull();
    port.sessionUserId = 'u1';
    // Mirrors the fetch adapter: draft rows map with status 'draft' and no publish time.
    expect(await port.getDraftArticle('a9')).toMatchObject({
      slug: 'draft-piece',
      status: 'draft',
      publishedAt: '',
    });
    expect(await port.getDraftArticle('missing')).toBeNull();
  });

  const metaInput = (over: Partial<Parameters<InMemoryCloudAdapter['setArticleMeta']>[0]['meta']> = {}) => ({
    meta: {
      articleId: 'a9',
      doi: '10.1234/x',
      orcidAuthors: ['0000-0002-1825-0097'],
      license: 'CC-BY-4.0',
      rightsRoute: 'cc_by',
      embargoUntil: '2026-08-01T00:00:00.000Z',
      datasetHashes: ['sha256:abc'],
      canonicalUrl: 'https://example.org/a9',
      signerPubkey: 'pub-rosa',
      ...over,
    },
    signatureHex: 'ab'.repeat(32),
  });

  it('setArticleMeta requires a session and a signature, then upserts in place', async () => {
    const port = seeded();
    port.sessionUserId = null;
    expect(await port.setArticleMeta(metaInput())).toEqual({ ok: false, error: 'not-signed-in' });
    expect(port.articleMeta).toEqual([]);

    port.sessionUserId = 'u1';
    expect(await port.setArticleMeta({ ...metaInput(), signatureHex: '' })).toEqual({
      ok: false,
      error: 'bad-signature',
    });

    expect(await port.setArticleMeta(metaInput())).toEqual({ ok: true });
    expect(port.articleMeta).toHaveLength(1);
    expect(port.articleMeta[0]).toMatchObject({
      articleId: 'a9',
      doi: '10.1234/x',
      embargoUntil: '2026-08-01T00:00:00.000Z',
      signature: 'ab'.repeat(32),
      signerPubkey: 'pub-rosa',
    });
    // Upsert semantics: a second write updates in place, never appends.
    expect(await port.setArticleMeta(metaInput({ embargoUntil: null }))).toEqual({ ok: true });
    expect(port.articleMeta).toHaveLength(1);
    expect(port.articleMeta[0]?.embargoUntil).toBeNull();
  });

  it('setArticleMeta enforces the head-author key when the article is known', async () => {
    const port = seeded();
    port.draftArticles = [article({ articleId: 'a9', slug: 'draft-piece', signerPubkey: 'pub-rosa' })];
    // A signer key that is not the head author key is rejected.
    expect(await port.setArticleMeta(metaInput({ signerPubkey: 'pub-impostor' }))).toEqual({
      ok: false,
      error: 'not-author',
    });
    expect(port.articleMeta).toEqual([]);
  });

  it('getArticleMeta returns the stored meta and setArticleMeta mirrors the draft embargo', async () => {
    const port = seeded();
    expect(await port.getArticleMeta('a9')).toBeNull();
    await port.setArticleMeta(metaInput());
    expect((await port.getArticleMeta('a9'))?.doi).toBe('10.1234/x');
    expect((await port.getNewsroom('n1'))?.drafts[0]?.embargoUntil).toBe(
      '2026-08-01T00:00:00.000Z',
    );
  });
});

describe('InMemoryCloudAdapter blocks', () => {
  function profile(over: Partial<ProfileView>): ProfileView {
    return {
      id: 'p-me',
      userId: 'u-me',
      handle: 'me',
      displayName: 'Me',
      pubkeyEd25519: 'pub-me',
      kind: 'reader',
      ...over,
    };
  }

  function seeded(): InMemoryCloudAdapter {
    const port = new InMemoryCloudAdapter();
    port.profiles = [
      profile({}),
      profile({ id: 'p-troll', userId: 'u-troll', handle: 'troll', displayName: 'Troll', pubkeyEd25519: 'pub-troll' }),
    ];
    port.sessionUserId = 'u-me';
    return port;
  }

  it('setBlock/listBlocks/removeBlock round-trip for the blocker, keyed by pubkey and id', async () => {
    const port = seeded();
    expect(await port.listBlocks()).toEqual([]);

    expect(await port.setBlock('p-troll', 'block')).toEqual({ ok: true });
    const list = await port.listBlocks();
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({
      blockedProfileId: 'p-troll',
      blockedPubkey: 'pub-troll',
      blockedHandle: 'troll',
      mode: 'block',
    });

    // Re-blocking switches the mode in place (idempotent on the unique pair).
    expect(await port.setBlock('p-troll', 'mute')).toEqual({ ok: true });
    const muted = await port.listBlocks();
    expect(muted).toHaveLength(1);
    expect(muted[0]?.mode).toBe('mute');

    expect(await port.removeBlock('p-troll')).toEqual({ ok: true });
    expect(await port.listBlocks()).toEqual([]);
  });

  it('requires a session and a profile, and refuses blocking yourself', async () => {
    const signedOut = seeded();
    signedOut.sessionUserId = null;
    expect(await signedOut.setBlock('p-troll', 'block')).toEqual({ ok: false, error: 'not-signed-in' });
    expect(await signedOut.listBlocks()).toEqual([]);

    const port = seeded();
    expect(await port.setBlock('p-me', 'block')).toEqual({ ok: false, error: 'cannot-block-self' });
  });

  it('is account-scoped: another blocker never sees my rows', async () => {
    const port = seeded();
    await port.setBlock('p-troll', 'block');
    // Switch the session to the troll: they must not read who blocked them.
    port.sessionUserId = 'u-troll';
    expect(await port.listBlocks()).toEqual([]);
  });
});

describe('InMemoryCloudAdapter terms + notices (Plan 39 T11)', () => {
  it('acceptTerms requires a session and is idempotent per version', async () => {
    const port = new InMemoryCloudAdapter();
    expect(await port.acceptTerms('2026-07-05')).toEqual({ ok: false, error: 'not-signed-in' });
    expect(await port.getAcceptedTermsVersions()).toEqual([]);

    port.sessionUserId = 'u1';
    expect(await port.acceptTerms('2026-07-05')).toEqual({ ok: true });
    // Idempotent: a second accept does not duplicate the row.
    expect(await port.acceptTerms('2026-07-05')).toEqual({ ok: true });
    expect(await port.getAcceptedTermsVersions()).toEqual(['2026-07-05']);
  });

  it('getAcceptedTermsVersions is scoped to the signed-in user', async () => {
    const port = new InMemoryCloudAdapter();
    port.termsAcceptances = [
      { userId: 'u1', version: '2026-07-05' },
      { userId: 'u2', version: '2026-07-05' },
    ];
    port.sessionUserId = 'u1';
    expect(await port.getAcceptedTermsVersions()).toEqual(['2026-07-05']);
    port.sessionUserId = 'u2';
    expect(await port.getAcceptedTermsVersions()).toEqual(['2026-07-05']);
    port.sessionUserId = null;
    expect(await port.getAcceptedTermsVersions()).toEqual([]);
  });

  it('getMyModerationNotices returns only the caller-owned notices, newest first', async () => {
    const port = new InMemoryCloudAdapter();
    port.moderationNotices = [
      noticeFixture({ ownerUserId: 'u1', targetId: 'a1', note: 'older', actionId: 'act-1',
        createdAt: '2026-07-01T00:00:00.000Z' }),
      noticeFixture({ ownerUserId: 'u1', targetId: 'a2', note: 'newer', actionId: 'act-2',
        createdAt: '2026-07-02T00:00:00.000Z' }),
      noticeFixture({ ownerUserId: 'u2', targetId: 'a3', note: 'not mine', actionId: 'act-3',
        createdAt: '2026-07-03T00:00:00.000Z' }),
    ];
    expect(await port.getMyModerationNotices()).toEqual([]);
    port.sessionUserId = 'u1';
    const notices = await port.getMyModerationNotices();
    expect(notices.map((n) => n.note)).toEqual(['newer', 'older']);
    expect(notices.every((n) => 'ownerUserId' in n)).toBe(false);
  });
});
