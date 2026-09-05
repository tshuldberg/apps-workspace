/**
 * Server-only cloud access for the public site.
 *
 * Marked `server-only` (plan 48 WP10): importing this from a client component
 * now fails the build instead of relying on reviewer discipline. The pure parts
 * live elsewhere so tests can still reach them: `lib/env.ts` (env parsing),
 * `lib/latest-fetch.ts` (the site-wide latest read), `lib/load-result.ts` (the
 * result vocabulary).
 *
 * Reads go through the module's fetch adapter (`createMyNewsCloudAdapter`) with
 * a bounded fetch injected, so no read can outlive its deadline. Every loader
 * returns a `LoadResult`, which separates the three things that used to be one
 * `null`: nothing configured, no such record, and backend unreachable. Pages map
 * the first two to 404 and the third to an outage notice. Never a placeholder,
 * never a fabricated feed.
 */
import 'server-only';

import { cache } from 'react';
import {
  createMyNewsCloudAdapter,
  type ArticleView,
  type EditorProfileView,
  type FeedItem,
  type JournalistView,
  type MyNewsCloudPort,
  type SuggestionEventView,
  type SuggestionView,
} from '@mylife/mynews/cloud-fetch';
import { readCloudEnv } from './env';
import { CLOUD_READ_TIMEOUT_MS, createBoundedFetch } from './http';
import { fetchLatest } from './latest-fetch';
import { loaded, MISSING, OUTAGE, UNCONFIGURED, type LoadResult } from './load-result';

export { isCloudConfigured } from './env';
export { fetchLatest } from './latest-fetch';

/** Every read on the SSR critical path shares one deadline. */
const boundedFetch = createBoundedFetch(CLOUD_READ_TIMEOUT_MS);

export function getPort(): MyNewsCloudPort | null {
  const env = readCloudEnv();
  if (!env) return null;
  return createMyNewsCloudAdapter({
    baseUrl: env.baseUrl,
    anonKey: env.anonKey,
    fetchImpl: boundedFetch,
  });
}

/**
 * Runs one adapter read and classifies the outcome.
 *
 * The adapter's contract is what makes the split honest: it resolves to null
 * when the backend answered and had no matching row, and it throws when the
 * request itself failed (non-ok status, network error, or our abort deadline).
 * So `null` really does mean missing, and a rejection really does mean the read
 * never happened.
 */
async function readOne<T>(
  read: (port: MyNewsCloudPort) => Promise<T | null>,
): Promise<LoadResult<T>> {
  const port = getPort();
  if (!port) return UNCONFIGURED;
  try {
    const value = await read(port);
    return value === null ? MISSING : loaded(value);
  } catch {
    return OUTAGE;
  }
}

/**
 * Runs one adapter list read. An empty list is a real answer (`ok` with `[]`),
 * not a missing record: an article with no suggestions is not a 404.
 */
async function readList<T>(
  read: (port: MyNewsCloudPort) => Promise<T[]>,
): Promise<LoadResult<T[]>> {
  const port = getPort();
  if (!port) return UNCONFIGURED;
  try {
    return loaded(await read(port));
  } catch {
    return OUTAGE;
  }
}

/**
 * Per-request memoized loaders.
 *
 * `cache()` dedupes the read between `generateMetadata` and the render, which
 * matters more now than it did: both have to agree on whether this request is an
 * outage, or a page could render outage copy under indexable metadata.
 */

export const loadLatest = cache(async (limit = 50): Promise<LoadResult<FeedItem[]>> => {
  const env = readCloudEnv();
  if (!env) return UNCONFIGURED;
  try {
    return loaded(await fetchLatest(env.baseUrl, env.anonKey, boundedFetch, limit));
  } catch {
    return OUTAGE;
  }
});

export const loadArticle = cache(
  (slug: string): Promise<LoadResult<ArticleView>> =>
    readOne((port) => port.getArticleBySlug(slug)),
);

export const loadJournalist = cache(
  (handle: string): Promise<LoadResult<JournalistView>> =>
    readOne((port) => port.getJournalistByHandle(handle)),
);

/** All suggestions on an article (public RLS read). */
export const loadSuggestions = cache(
  (articleId: string): Promise<LoadResult<SuggestionView[]>> =>
    readList((port) => port.getSuggestionsForArticle(articleId)),
);

/** One suggestion's thread events (comments + decision rows), oldest first. */
export const loadSuggestionEvents = cache(
  (suggestionId: string): Promise<LoadResult<SuggestionEventView[]>> =>
    readList((port) => port.getSuggestionEvents(suggestionId)),
);

/** Editor profile + public credibility ledger. */
export const loadEditorProfile = cache(
  (handle: string): Promise<LoadResult<EditorProfileView>> =>
    readOne((port) => port.getEditorProfile(handle)),
);
