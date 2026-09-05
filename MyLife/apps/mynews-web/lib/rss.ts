import type { FeedItem } from '@mylife/mynews';

/**
 * Pure RSS 2.0 builder. Takes already-fetched feed items and returns a
 * well-formed XML string. Kept free of runtime imports (FeedItem is type-only)
 * so it is unit-testable in a plain node environment.
 */

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function toRfc822(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toUTCString();
}

export interface RssOptions {
  origin: string;
  title?: string;
  description?: string;
  buildDate?: Date;
}

const DEFAULT_TITLE = 'MyNews';
const DEFAULT_DESCRIPTION = 'Open journalism: published articles, newest first. No ads.';

export function buildRssFeed(items: FeedItem[], opts: RssOptions): string {
  const origin = opts.origin.replace(/\/+$/, '');
  const title = opts.title ?? DEFAULT_TITLE;
  const description = opts.description ?? DEFAULT_DESCRIPTION;
  const lastBuildDate = (opts.buildDate ?? new Date()).toUTCString();

  const channelHead = [
    `<title>${escapeXml(title)}</title>`,
    `<link>${escapeXml(origin)}</link>`,
    `<description>${escapeXml(description)}</description>`,
    `<lastBuildDate>${lastBuildDate}</lastBuildDate>`,
    `<atom:link href="${escapeXml(`${origin}/feed.xml`)}" rel="self" type="application/rss+xml" />`,
  ];

  const itemBlocks = items.map((item) => {
    const link = `${origin}/a/${encodeURIComponent(item.slug)}`;
    const parts = [
      `<title>${escapeXml(item.headline)}</title>`,
      `<link>${escapeXml(link)}</link>`,
      `<guid isPermaLink="true">${escapeXml(link)}</guid>`,
      `<dc:creator>${escapeXml(item.authorDisplayName)}</dc:creator>`,
      `<category>${escapeXml(item.kind)}</category>`,
    ];
    if (item.dek) parts.push(`<description>${escapeXml(item.dek)}</description>`);
    const pubDate = toRfc822(item.publishedAt);
    if (pubDate) parts.push(`<pubDate>${pubDate}</pubDate>`);
    return `    <item>\n      ${parts.join('\n      ')}\n    </item>`;
  });

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">',
    '  <channel>',
    `    ${channelHead.join('\n    ')}`,
    ...itemBlocks,
    '  </channel>',
    '</rss>',
    '',
  ].join('\n');
}
