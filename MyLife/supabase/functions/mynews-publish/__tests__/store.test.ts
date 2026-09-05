// In-memory store contract for publish v2 (newsroom drafts and the
// draft-to-published transition) plus the getArticleHead authorTier join.
// Mirrors nw_publish_article in
// supabase/migrations/20260703000003_mynews_editing_desk.sql.

import { describe, expect, it } from 'vitest';
import { createInMemoryMyNewsStore } from '../../_shared/mynews-store.ts';

const revision = (articleId: string, rev: number) => ({
  articleId,
  rev,
  headline: 'headline',
  dek: undefined,
  bodyMd: 'body',
  changelogJson: '[]',
  createdAt: '2026-07-03T12:00:00.000Z',
  signature: 'sig',
  signerPubkey: 'author-pub',
});

const record = (over: {
  rev: number;
  draft?: boolean;
  newsroomId?: string | null;
  id?: string;
  slug?: string;
}) => ({
  article: {
    id: over.id ?? 'art-1',
    slug: over.slug ?? 'art-1',
    kind: 'news',
    authorProfileId: 'author-1',
    ...(over.draft !== undefined ? { draft: over.draft } : {}),
    ...(over.newsroomId !== undefined ? { newsroomId: over.newsroomId } : {}),
  },
  revision: revision(over.id ?? 'art-1', over.rev),
  publishedAtIso: `2026-07-03T12:00:0${over.rev}.000Z`,
});

function fresh() {
  return createInMemoryMyNewsStore({
    profiles: [{ id: 'author-1', userId: 'user-author', pubkey: 'author-pub' }],
  });
}

describe('publishArticle v2', () => {
  it('rejects a draft insert without a newsroom (bad-payload, nothing written)', async () => {
    const { store, state } = fresh();
    expect(await store.publishArticle(record({ rev: 1, draft: true }))).toBe('bad-payload');
    expect(await store.publishArticle(record({ rev: 1, draft: true, newsroomId: null }))).toBe(
      'bad-payload',
    );
    expect(state.articles.size).toBe(0);
    expect(state.revisions).toHaveLength(0);
  });

  it('checks rev before payload and payload before slug (SQL check order)', async () => {
    const { store } = fresh();
    // rev-conflict wins over the missing newsroom.
    expect(await store.publishArticle(record({ rev: 2, draft: true }))).toBe('rev-conflict');
    // Take the slug, then a draft insert missing its newsroom on the same
    // slug reports bad-payload, not slug-conflict.
    expect(await store.publishArticle(record({ rev: 1 }))).toBe('ok');
    expect(await store.publishArticle(record({ rev: 1, draft: true, id: 'art-2' }))).toBe(
      'bad-payload',
    );
    expect(
      await store.publishArticle(record({ rev: 1, draft: true, newsroomId: 'room-1', id: 'art-2' })),
    ).toBe('slug-conflict');
  });

  it('runs the full draft lifecycle: insert, draft revision, publish transition', async () => {
    const { store, state } = fresh();
    expect(
      await store.publishArticle(record({ rev: 1, draft: true, newsroomId: 'room-1' })),
    ).toBe('ok');
    let art = state.articles.get('art-1');
    expect(art?.status).toBe('draft');
    expect(art?.publishedAt).toBeNull();
    expect(art?.newsroomId).toBe('room-1');
    expect(art?.currentRev).toBe(1);

    // A further draft revision inside the newsroom keeps the embargo.
    expect(
      await store.publishArticle(record({ rev: 2, draft: true, newsroomId: 'room-1' })),
    ).toBe('ok');
    art = state.articles.get('art-1');
    expect(art?.status).toBe('draft');
    expect(art?.publishedAt).toBeNull();
    expect(art?.currentRev).toBe(2);

    // Publishing the draft requires a fresh revision; a stale rev conflicts.
    expect(await store.publishArticle(record({ rev: 2 }))).toBe('rev-conflict');
    expect(state.articles.get('art-1')?.status).toBe('draft');

    // The transition flips status and stamps published_at with the head bump.
    expect(await store.publishArticle(record({ rev: 3 }))).toBe('ok');
    art = state.articles.get('art-1');
    expect(art?.status).toBe('published');
    expect(art?.publishedAt).toBe('2026-07-03T12:00:03.000Z');
    expect(art?.currentRev).toBe(3);
    expect(state.revisions).toHaveLength(3);
  });

  it('never demotes a published article back to draft', async () => {
    const { store, state } = fresh();
    expect(await store.publishArticle(record({ rev: 1 }))).toBe('ok');
    expect(state.articles.get('art-1')?.publishedAt).toBe('2026-07-03T12:00:01.000Z');
    expect(
      await store.publishArticle(record({ rev: 2, draft: true, newsroomId: 'room-1' })),
    ).toBe('ok');
    const art = state.articles.get('art-1');
    expect(art?.status).toBe('published');
    expect(art?.currentRev).toBe(2);
    expect(art?.publishedAt).toBe('2026-07-03T12:00:01.000Z');
  });
});

describe('getArticleHead authorTier', () => {
  it("defaults to 'open' and reads a seeded journalist tier", async () => {
    const { store, state } = createInMemoryMyNewsStore({
      profiles: [
        { id: 'author-1', pubkey: 'k1' },
        { id: 'author-2', pubkey: 'k2' },
      ],
      journalists: [{ profileId: 'author-2', tier: 'verified' }],
    });
    for (const [id, authorProfileId] of [
      ['art-1', 'author-1'],
      ['art-2', 'author-2'],
    ] as const) {
      state.articles.set(id, {
        id,
        slug: id,
        kind: 'news',
        status: 'published',
        authorProfileId,
        authorPubkey: 'pub',
        currentRev: 1,
      });
    }
    expect((await store.getArticleHead('art-1'))?.authorTier).toBe('open');
    expect((await store.getArticleHead('art-2'))?.authorTier).toBe('verified');
    expect(await store.getArticleHead('art-x')).toBeNull();
  });
});
