import type { FeedItem } from '@mylife/mynews';
import { describe, expect, it } from 'vitest';
import { buildRssFeed, escapeXml, toRfc822 } from '../lib/rss';

function makeItem(over: Partial<FeedItem> = {}): FeedItem {
  return {
    articleId: 'a1',
    slug: 'first-story',
    headline: 'First story',
    dek: 'A short summary',
    kind: 'news',
    rev: 1,
    publishedAt: '2026-07-01T12:00:00.000Z',
    authorHandle: 'jane',
    authorDisplayName: 'Jane Doe',
    authorPubkey: 'pub-jane',
    authorTier: 'verified',
    ...over,
  };
}

describe('escapeXml', () => {
  it('escapes the five xml entities', () => {
    expect(escapeXml(`A & B < C > D " E ' F`)).toBe(
      'A &amp; B &lt; C &gt; D &quot; E &apos; F',
    );
  });
});

describe('toRfc822', () => {
  it('formats a valid iso date', () => {
    expect(toRfc822('2026-07-01T12:00:00.000Z')).toBe('Wed, 01 Jul 2026 12:00:00 GMT');
  });

  it('returns empty string for an invalid date', () => {
    expect(toRfc822('not-a-date')).toBe('');
  });
});

describe('buildRssFeed', () => {
  const buildDate = new Date('2026-07-02T00:00:00.000Z');

  it('emits a well-formed empty feed with channel metadata only', () => {
    const xml = buildRssFeed([], { origin: 'https://mynews.app', buildDate });
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain('<rss version="2.0"');
    expect(xml).toContain('<title>MyNews</title>');
    expect(xml).toContain('<link>https://mynews.app</link>');
    expect(xml).toContain('rel="self"');
    expect(xml).not.toContain('<item>');
    expect(xml.trimEnd().endsWith('</rss>')).toBe(true);
  });

  it('emits one item per feed entry with links and pubDate', () => {
    const xml = buildRssFeed([makeItem(), makeItem({ articleId: 'a2', slug: 'second' })], {
      origin: 'https://mynews.app',
      buildDate,
    });
    expect((xml.match(/<item>/g) ?? []).length).toBe(2);
    expect(xml).toContain('<link>https://mynews.app/a/first-story</link>');
    expect(xml).toContain('<guid isPermaLink="true">https://mynews.app/a/second</guid>');
    expect(xml).toContain('<pubDate>Wed, 01 Jul 2026 12:00:00 GMT</pubDate>');
    expect(xml).toContain('<dc:creator>Jane Doe</dc:creator>');
    expect(xml).toContain('<category>news</category>');
  });

  it('escapes xml entities in headlines and deks', () => {
    const xml = buildRssFeed(
      [makeItem({ headline: 'Steel & Iron < Gold', dek: 'a > b & c' })],
      { origin: 'https://mynews.app', buildDate },
    );
    expect(xml).toContain('<title>Steel &amp; Iron &lt; Gold</title>');
    expect(xml).toContain('<description>a &gt; b &amp; c</description>');
    expect(xml).not.toContain('Steel & Iron');
  });

  it('omits item description and pubDate when absent or invalid', () => {
    const xml = buildRssFeed(
      [makeItem({ dek: undefined, publishedAt: 'bad-date' })],
      { origin: 'https://mynews.app', buildDate },
    );
    const itemBlock = xml.slice(xml.indexOf('<item>'), xml.indexOf('</item>'));
    expect(itemBlock).toContain('<title>First story</title>');
    expect(itemBlock).not.toContain('<description>');
    expect(itemBlock).not.toContain('<pubDate>');
  });
});
