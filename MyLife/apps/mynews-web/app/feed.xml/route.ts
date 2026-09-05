import { loadLatest } from '@/lib/cloud';
import { feedStatus, RETRY_AFTER_SECONDS } from '@/lib/load-result';
import { publicOrigin } from '@/lib/origin';
import { buildRssFeed } from '@/lib/rss';

/**
 * RSS 2.0 of the newest published articles across the site.
 *
 * Cache policy: `s-maxage=300` on a good response. Five minutes is chosen against
 * the consumer, not the server. Feed readers poll on their own schedule anyway,
 * and a shared cache that short cannot hold a stale front page for long.
 *
 * Plan 48 WP10: a route handler CAN set a status, so an outage is a real 503 with
 * `Retry-After` and `no-store`. That matters more here than anywhere else on the
 * site: an aggregator that receives an empty 200 during an outage records that
 * MyNews published nothing, and some will drop the items they already held. A 503
 * tells them to come back. An unconfigured deployment still gets a valid, empty
 * 200 channel, because empty is the truth there rather than a failure.
 */
export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  const result = await loadLatest(50);
  const status = feedStatus(result);
  const items = result.state === 'ok' ? result.data : [];
  const xml = buildRssFeed(items, { origin: publicOrigin() });

  const headers: Record<string, string> = {
    'Content-Type': 'application/rss+xml; charset=utf-8',
    'Cache-Control':
      status === 503 ? 'no-store' : 'public, max-age=0, s-maxage=300, stale-while-revalidate=600',
  };
  if (status === 503) headers['Retry-After'] = String(RETRY_AFTER_SECONDS);

  return new Response(xml, { status, headers });
}
