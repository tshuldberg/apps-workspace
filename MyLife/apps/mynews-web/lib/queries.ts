/**
 * PostgREST query builder for the site-wide "latest" read.
 *
 * The module's `buildFeedUrl` filters by followed pubkeys (a personalized
 * feed); the public site needs the newest published articles across every
 * author, so this builds that query directly. Public profile and journalist
 * rows are loaded separately by the returned author ids and stitched in code.
 */

export const LATEST_SELECT =
  'id,author_id,slug,kind,current_rev,published_at,' +
  'nw_article_revisions(rev,headline,dek)';

export const LATEST_PROFILE_SELECT =
  'id,handle,display_name,pubkey_ed25519,kind,created_at';

export const LATEST_JOURNALIST_SELECT =
  'profile_id,tier,bio,beats,region,created_at';

function quotedIn(values: string[]): string {
  return `in.(${[...new Set(values)].map((value) => `"${value}"`).join(',')})`;
}

export function buildLatestUrl(baseUrl: string, limit = 50): string {
  const params = new URLSearchParams();
  params.set('select', LATEST_SELECT);
  params.set('status', 'eq.published');
  params.set('order', 'published_at.desc');
  params.set('limit', String(limit));
  params.set('nw_article_revisions.order', 'rev.desc');
  params.set('nw_article_revisions.limit', '1');
  return `${baseUrl}/rest/v1/nw_articles?${params.toString()}`;
}

export function buildLatestProfilesUrl(baseUrl: string, authorIds: string[]): string {
  const ids = [...new Set(authorIds)];
  const params = new URLSearchParams();
  params.set('select', LATEST_PROFILE_SELECT);
  params.set('id', quotedIn(ids));
  params.set('limit', String(ids.length));
  return `${baseUrl}/rest/v1/nw_public_profiles?${params.toString()}`;
}

export function buildLatestJournalistsUrl(baseUrl: string, authorIds: string[]): string {
  const ids = [...new Set(authorIds)];
  const params = new URLSearchParams();
  params.set('select', LATEST_JOURNALIST_SELECT);
  params.set('profile_id', quotedIn(ids));
  params.set('limit', String(ids.length));
  return `${baseUrl}/rest/v1/nw_public_journalists?${params.toString()}`;
}
