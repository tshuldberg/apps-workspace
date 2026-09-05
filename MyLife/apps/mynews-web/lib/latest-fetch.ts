/**
 * Site-wide "latest published articles" read.
 *
 * Split out of `lib/cloud.ts` so it stays importable from a unit test: the
 * loader layer is marked `server-only`, which by design throws when imported
 * outside a server bundle. This function takes its base URL, key, and fetch
 * implementation as arguments and touches no environment, so it is testable
 * against a stub fetch.
 */
import {
  mapFeedRow,
  stitchArticleAuthors,
  type FeedItem,
} from '@mylife/mynews/cloud-fetch';
import {
  buildLatestJournalistsUrl,
  buildLatestProfilesUrl,
  buildLatestUrl,
} from './queries';

/**
 * Direct PostgREST read of the newest published articles across the whole site.
 * Article, public-profile, and journalist rows are separate reads because
 * PostgREST cannot be assumed to infer relationships through public views.
 *
 * Throws on any non-ok response so the caller can distinguish an unreachable
 * backend (outage) from an empty result (no published articles). Callers pass a
 * bounded fetch; this function does not impose its own deadline.
 */
export async function fetchLatest(
  baseUrl: string,
  anonKey: string,
  fetchImpl: typeof fetch = fetch,
  limit = 50,
): Promise<FeedItem[]> {
  const init = {
    headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
    cache: 'no-store' as const,
  };
  const articleRes = await fetchImpl(buildLatestUrl(baseUrl, limit), init);
  if (!articleRes.ok) throw new Error(`mynews latest read failed: ${articleRes.status}`);
  const rows = (await articleRes.json()) as Parameters<typeof stitchArticleAuthors>[0];
  if (rows.length === 0) return [];

  const authorIds = [...new Set(rows.map((row) => row.author_id))];
  const [profileRes, journalistRes] = await Promise.all([
    fetchImpl(buildLatestProfilesUrl(baseUrl, authorIds), init),
    fetchImpl(buildLatestJournalistsUrl(baseUrl, authorIds), init),
  ]);
  if (!profileRes.ok) throw new Error(`mynews latest profile read failed: ${profileRes.status}`);
  if (!journalistRes.ok) {
    throw new Error(`mynews latest journalist read failed: ${journalistRes.status}`);
  }

  const profiles = (await profileRes.json()) as Parameters<typeof stitchArticleAuthors>[1];
  const journalists = (await journalistRes.json()) as Parameters<typeof stitchArticleAuthors>[2];
  return stitchArticleAuthors(rows, profiles, journalists)
    .map(mapFeedRow)
    .filter((row): row is FeedItem => row !== null);
}
