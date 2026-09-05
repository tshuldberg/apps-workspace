import type { FeedItem } from '@mylife/mynews';
import { describe, expect, it } from 'vitest';
import { sitemapEntries } from '../lib/sitemap-entries';

function makeItem(over: Partial<FeedItem> = {}): FeedItem {
  return {
    articleId: 'a1',
    slug: 'first-story',
    headline: 'First story',
    kind: 'news',
    rev: 1,
    publishedAt: '2026-07-01T12:00:00.000Z',
    authorHandle: 'jane',
    authorDisplayName: 'Jane Doe',
    authorPubkey: 'pub-jane',
    authorTier: 'open',
    ...over,
  };
}

describe('sitemapEntries', () => {
  it('always includes the home url first and the static legal + editing pages', () => {
    const entries = sitemapEntries([], 'https://mynews.app');
    expect(entries).toEqual([
      { url: 'https://mynews.app/' },
      { url: 'https://mynews.app/about/editing' },
      { url: 'https://mynews.app/legal' },
      { url: 'https://mynews.app/legal/dmca' },
      { url: 'https://mynews.app/legal/appeals' },
    ]);
  });

  it('strips a trailing slash from the origin', () => {
    const entries = sitemapEntries([], 'https://mynews.app/');
    expect(entries[0].url).toBe('https://mynews.app/');
    expect(entries[1].url).toBe('https://mynews.app/about/editing');
    expect(entries[2].url).toBe('https://mynews.app/legal');
    expect(entries[3].url).toBe('https://mynews.app/legal/dmca');
    expect(entries[4].url).toBe('https://mynews.app/legal/appeals');
  });

  it('adds one entry per article with lastModified after the static pages', () => {
    const entries = sitemapEntries(
      [makeItem(), makeItem({ articleId: 'a2', slug: 'second', publishedAt: '2026-06-30T00:00:00.000Z' })],
      'https://mynews.app',
    );
    expect(entries).toHaveLength(7);
    expect(entries[5]).toEqual({
      url: 'https://mynews.app/a/first-story',
      lastModified: '2026-07-01T12:00:00.000Z',
    });
    expect(entries[6].url).toBe('https://mynews.app/a/second');
  });

  it('drops lastModified when publishedAt is empty', () => {
    const entries = sitemapEntries([makeItem({ publishedAt: '' })], 'https://mynews.app');
    expect(entries[5]).toEqual({ url: 'https://mynews.app/a/first-story' });
  });
});
