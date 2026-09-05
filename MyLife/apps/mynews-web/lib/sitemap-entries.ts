import type { FeedItem } from '@mylife/mynews';

/**
 * Pure sitemap entry builder. Returns the home URL, the static
 * how-editing-works explainer, the legal hub, the DMCA page, the appeals
 * explainer, plus one entry per published article. The shape is compatible with Next's
 * `MetadataRoute.Sitemap`. Kept runtime-import free (FeedItem is type-only) for
 * plain-node unit testing.
 */

export interface SitemapEntry {
  url: string;
  lastModified?: string;
}

export function sitemapEntries(items: FeedItem[], origin: string): SitemapEntry[] {
  const base = origin.replace(/\/+$/, '');
  const entries: SitemapEntry[] = [
    { url: `${base}/` },
    { url: `${base}/about/editing` },
    { url: `${base}/legal` },
    { url: `${base}/legal/dmca` },
    // Plan 48 WP9: the appeals explainer is a real route that renders without
    // reading anything, so it belongs in the static set.
    { url: `${base}/legal/appeals` },
  ];
  for (const item of items) {
    entries.push({
      url: `${base}/a/${encodeURIComponent(item.slug)}`,
      lastModified: item.publishedAt || undefined,
    });
  }
  return entries;
}
