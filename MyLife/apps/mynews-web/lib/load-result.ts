/**
 * Loader result vocabulary for the public site (plan 48 WP10).
 *
 * The site used to collapse every failure into `null`, so a reader hitting an
 * article during a Supabase outage got the same 404 as a reader hitting a slug
 * that never existed. Those need different answers: a 404 tells a crawler the
 * URL is gone, and repeating it across a whole outage window is how a live
 * article silently leaves the index.
 *
 * Four states, and the page decides what each one means:
 *
 *  - `ok`           the record was read.
 *  - `missing`      the backend answered and has no such record. A real 404.
 *  - `unconfigured`  this deployment has no cloud wired. Also a 404 (there is
 *                    nothing to serve and nothing to retry), never a
 *                    placeholder.
 *  - `outage`       the backend was unreachable, timed out, or errored. The
 *                    URL is not known to be wrong, so the page must not claim
 *                    it is: it renders the outage notice and asks crawlers not
 *                    to index that response.
 *
 * Pure and dependency-free so the mapping is unit-tested rather than inferred
 * from reading page components.
 */

export type LoadResult<T> =
  | { readonly state: 'ok'; readonly data: T }
  | { readonly state: 'missing' }
  | { readonly state: 'unconfigured' }
  | { readonly state: 'outage' };

export function loaded<T>(data: T): LoadResult<T> {
  return { state: 'ok', data };
}

export const MISSING = { state: 'missing' } as const;
export const UNCONFIGURED = { state: 'unconfigured' } as const;
export const OUTAGE = { state: 'outage' } as const;

/**
 * What a detail page (`/a/[slug]`, `/j/[handle]`, `/e/[handle]`) does with a
 * result. `notFound()` for both no-record cases, the outage notice for an
 * unreachable backend.
 */
export type PageDisposition = 'render' | 'not-found' | 'outage';

export function pageDisposition(result: { state: LoadResult<unknown>['state'] }): PageDisposition {
  switch (result.state) {
    case 'ok':
      return 'render';
    case 'outage':
      return 'outage';
    case 'missing':
    case 'unconfigured':
      return 'not-found';
  }
}

/**
 * HTTP status for the routes that CAN set one (route handlers: `/feed.xml`,
 * `/sitemap.xml`, `/api/*`).
 *
 * `unconfigured` is 200: a deployment with no cloud is not broken, it is empty,
 * and a valid empty feed is the honest answer. `outage` is 503 with a
 * `Retry-After` so aggregators and crawlers come back instead of recording that
 * the feed is now empty.
 *
 * App Router PAGES cannot set a status code (Next exposes no API for it), so
 * page-level outages are expressed as an outage body plus `robots: noindex`.
 * See `OutageNotice`.
 */
export function feedStatus(result: { state: LoadResult<unknown>['state'] }): number {
  return result.state === 'outage' ? 503 : 200;
}

/** Seconds a client should wait before retrying an outage response. */
export const RETRY_AFTER_SECONDS = 60;
