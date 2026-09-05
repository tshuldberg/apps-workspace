import { describe, expect, it } from 'vitest';
import { InMemoryCloudAdapter, type ArticleView } from '@mylife/mynews';
import { dedupeFollowedPubkeys, loadFeed } from '../(root)/lib/feed';

function article(over: Partial<ArticleView>): ArticleView {
  return {
    articleId: 'a1',
    slug: 'a-slug',
    headline: 'Headline',
    kind: 'news',
    rev: 1,
    publishedAt: '2026-07-01T00:00:00.000Z',
    authorHandle: 'reporter',
    authorDisplayName: 'A Reporter',
    authorPubkey: 'pk-1',
    authorTier: 'open',
    status: 'published',
    bodyMd: 'Body',
    signature: 'sig',
    signerPubkey: 'pk-1',
    createdAt: '2026-07-01T00:00:00.000Z',
    revisionSummaries: [],
    ...over,
  };
}

describe('dedupeFollowedPubkeys', () => {
  it('drops duplicates and empty keys', () => {
    expect(dedupeFollowedPubkeys(['pk-1', 'pk-1', '', 'pk-2'])).toEqual(['pk-1', 'pk-2']);
  });
});

describe('loadFeed', () => {
  it('is not-configured when the port is missing', async () => {
    const state = await loadFeed({ configured: false, port: null, followedPubkeys: ['pk-1'] });
    expect(state.status).toBe('not-configured');
  });

  it('is no-follows when no journalists are followed', async () => {
    const port = new InMemoryCloudAdapter();
    const state = await loadFeed({ configured: true, port, followedPubkeys: [] });
    expect(state.status).toBe('no-follows');
  });

  it('is empty when followed journalists have not published', async () => {
    const port = new InMemoryCloudAdapter();
    const state = await loadFeed({ configured: true, port, followedPubkeys: ['pk-unknown'] });
    expect(state.status).toBe('empty');
  });

  it('returns loaded items for followed journalists', async () => {
    const port = new InMemoryCloudAdapter();
    port.articles = [article({ authorPubkey: 'pk-1' })];
    const state = await loadFeed({ configured: true, port, followedPubkeys: ['pk-1'] });
    expect(state.status).toBe('loaded');
    if (state.status === 'loaded') {
      expect(state.items).toHaveLength(1);
      expect(state.items[0]?.authorPubkey).toBe('pk-1');
    }
  });

  it('surfaces an error state when the port throws', async () => {
    const port = new InMemoryCloudAdapter();
    port.getFeed = async () => {
      throw new Error('offline');
    };
    const state = await loadFeed({ configured: true, port, followedPubkeys: ['pk-1'] });
    expect(state.status).toBe('error');
    if (state.status === 'error') expect(state.message).toBe('offline');
  });

  it('hides a blocked author from the feed and unblock (empty blocks) restores them', async () => {
    const port = new InMemoryCloudAdapter();
    port.articles = [
      article({ articleId: 'a1', slug: 's1', authorPubkey: 'pk-1' }),
      article({ articleId: 'a2', slug: 's2', authorPubkey: 'pk-troll' }),
    ];
    const blocks = [
      {
        id: 'b1',
        blockedProfileId: 'p-troll',
        blockedPubkey: 'pk-troll',
        blockedHandle: 'troll',
        blockedDisplayName: 'Troll',
        mode: 'block' as const,
        createdAt: '2026-07-05T00:00:00.000Z',
      },
    ];
    const blocked = await loadFeed({
      configured: true,
      port,
      followedPubkeys: ['pk-1', 'pk-troll'],
      blocks,
    });
    expect(blocked.status).toBe('loaded');
    if (blocked.status === 'loaded') {
      expect(blocked.items.map((i) => i.articleId)).toEqual(['a1']);
    }

    const restored = await loadFeed({
      configured: true,
      port,
      followedPubkeys: ['pk-1', 'pk-troll'],
      blocks: [],
    });
    expect(restored.status).toBe('loaded');
    if (restored.status === 'loaded') {
      expect(restored.items.map((i) => i.articleId).sort()).toEqual(['a1', 'a2']);
    }
  });

  it('mute also removes the author from the primary feed', async () => {
    const port = new InMemoryCloudAdapter();
    port.articles = [article({ articleId: 'a2', slug: 's2', authorPubkey: 'pk-troll' })];
    const state = await loadFeed({
      configured: true,
      port,
      followedPubkeys: ['pk-troll'],
      blocks: [
        {
          id: 'b1',
          blockedProfileId: 'p-troll',
          blockedPubkey: 'pk-troll',
          blockedHandle: 'troll',
          blockedDisplayName: 'Troll',
          mode: 'mute' as const,
          createdAt: '2026-07-05T00:00:00.000Z',
        },
      ],
    });
    // Both follows resolved but the only followed author is muted, so empty.
    expect(state.status).toBe('empty');
  });
});
