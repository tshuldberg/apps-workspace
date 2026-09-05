import type { MetadataRoute } from 'next';
import { loadLatest } from '@/lib/cloud';
import { publicOrigin } from '@/lib/origin';
import { sitemapEntries } from '@/lib/sitemap-entries';

/**
 * Home, the editing explainer, plus one entry per latest published article.
 *
 * Plan 48 WP10, cache policy: dynamic and uncached. A sitemap is a claim about
 * which URLs exist, and serving a cached one during an outage would either shrink
 * the claim (a crawler reads a suddenly short sitemap as URLs having been
 * withdrawn) or publish URLs whose current state we did not read.
 *
 * During an outage the sitemap falls back to the static entries only, which are
 * the URLs we can vouch for without reading anything: real routes that render
 * regardless of the cloud. Nothing here is a guess.
 */
export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const result = await loadLatest(50);
  const items = result.state === 'ok' ? result.data : [];
  return sitemapEntries(items, publicOrigin());
}
