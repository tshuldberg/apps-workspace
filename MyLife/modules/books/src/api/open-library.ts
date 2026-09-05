/// <reference lib="dom" />

import {
  OLSearchResponseSchema,
  OLBookEditionSchema,
  OLWorkSchema,
  OLAuthorSchema,
} from './types';
import type {
  OLSearchResponse,
  OLSearchDoc,
  OLBookEdition,
  OLWork,
  OLAuthor,
  OLSubjectResponse,
  CoverSize,
} from './types';
import { OLSubjectResponseSchema } from './types';

const BASE_URL = 'https://openlibrary.org';
const COVERS_BASE_URL = 'https://covers.openlibrary.org';

// --- Concurrent Request Queue ---
// 3 slots at 220ms interval each = ~13.6 req/s max burst, well under Open Library's 100 req/min.

const QUEUE_CONCURRENCY = 3;
const SLOT_INTERVAL_MS = 220;
const FETCH_TIMEOUT_MS = 15_000;
const MAX_RETRIES = 3;

interface QueueEntry {
  execute: () => void;
}

const slotLastUsed: number[] = Array.from({ length: QUEUE_CONCURRENCY }, () => 0);
let activeCount = 0;
const pending: QueueEntry[] = [];

function findBestSlot(): { index: number; waitMs: number } {
  const now = Date.now();
  let bestIndex = 0;
  let bestReady = slotLastUsed[0] + SLOT_INTERVAL_MS;
  for (let i = 1; i < QUEUE_CONCURRENCY; i++) {
    const ready = slotLastUsed[i] + SLOT_INTERVAL_MS;
    if (ready < bestReady) {
      bestReady = ready;
      bestIndex = i;
    }
  }
  return { index: bestIndex, waitMs: Math.max(0, bestReady - now) };
}

function drainQueue(): void {
  while (pending.length > 0 && activeCount < QUEUE_CONCURRENCY) {
    const entry = pending.shift()!;
    activeCount++;
    entry.execute();
  }
}

function acquireSlot(): Promise<number> {
  return new Promise<number>((resolve) => {
    const execute = (): void => {
      const { index, waitMs } = findBestSlot();
      if (waitMs <= 0) {
        slotLastUsed[index] = Date.now();
        resolve(index);
      } else {
        setTimeout(() => {
          slotLastUsed[index] = Date.now();
          resolve(index);
        }, waitMs);
      }
    };

    if (activeCount < QUEUE_CONCURRENCY) {
      activeCount++;
      execute();
    } else {
      pending.push({ execute });
    }
  });
}

function releaseSlot(): void {
  activeCount--;
  drainQueue();
}

// --- In-memory Cache ---

const SEARCH_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const ISBN_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

interface CacheEntry<T> {
  data: T;
  expires: number;
}

const searchCache = new Map<string, CacheEntry<unknown>>();
const isbnCache = new Map<string, CacheEntry<unknown>>();

function getCached<T>(cache: Map<string, CacheEntry<T>>, key: string): T | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expires) {
    cache.delete(key);
    return undefined;
  }
  return entry.data;
}

function setCache<T>(cache: Map<string, CacheEntry<T>>, key: string, data: T, ttlMs: number): void {
  cache.set(key, { data, expires: Date.now() + ttlMs });
}

// --- Fetch with Retry + Backoff ---

async function fetchJSON(url: string): Promise<unknown> {
  await acquireSlot();
  try {
    return await fetchWithRetry(url, MAX_RETRIES);
  } finally {
    releaseSlot();
  }
}

async function fetchWithRetry(url: string, retriesLeft: number): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, {
      headers: { 'User-Agent': 'MyBooks/1.0 (https://github.com/mybooks)' },
      signal: controller.signal,
    });
  } catch (error: unknown) {
    clearTimeout(timeout);
    // Network error or abort: retry once after 1s
    if (retriesLeft > 0) {
      await delay(1000);
      return fetchWithRetry(url, retriesLeft - 1);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  if (response.status === 429 && retriesLeft > 0) {
    const retryAfter = response.headers.get('Retry-After');
    const waitMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : 1000 * 2 ** (MAX_RETRIES - retriesLeft);
    await delay(waitMs);
    return fetchWithRetry(url, retriesLeft - 1);
  }

  if (response.status >= 500 && retriesLeft > 0) {
    await delay(500);
    return fetchWithRetry(url, retriesLeft - 1);
  }

  if (!response.ok) {
    throw new Error(`Open Library request failed: ${response.status} ${response.statusText} — ${url}`);
  }
  return response.json();
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Detect if a query looks like a title search vs ISBN vs "Title by Author".
 * Returns the modified query with appropriate search prefix for better relevance.
 */
export function buildSearchQuery(rawQuery: string): string {
  const trimmed = rawQuery.trim();

  // ISBN pattern: 10 or 13 digits (possibly with dashes)
  if (/^[\d-]{10,17}$/.test(trimmed.replace(/-/g, ''))) {
    return `isbn:${trimmed.replace(/-/g, '')}`;
  }

  // If query contains " by " it's likely "Title by Author" -- use as-is
  if (/ by /i.test(trimmed)) {
    return trimmed;
  }

  // Default: wrap in title search for better relevance
  return `title:${trimmed}`;
}

/**
 * Score a search result by relevance to the original query.
 * Higher score = more relevant.
 */
export function relevanceScore(doc: OLSearchDoc, query: string): number {
  const q = query.toLowerCase().trim();
  const title = doc.title.toLowerCase();

  // Exact title match
  if (title === q) return 100;

  // Title starts with query
  if (title.startsWith(q)) return 80;

  // Title contains query as a substring
  if (title.includes(q)) return 60;

  // Word overlap: count how many query words appear in the title
  const queryWords = q.split(/\s+/).filter(w => w.length > 2);
  const titleWords = new Set(title.split(/\s+/));
  let overlap = 0;
  for (const word of queryWords) {
    if (titleWords.has(word)) overlap++;
  }
  if (queryWords.length > 0) {
    const overlapRatio = overlap / queryWords.length;
    if (overlapRatio > 0) return 20 + overlapRatio * 30;
  }

  // No meaningful overlap -- low relevance
  return 0;
}

/**
 * Search Open Library for books by title, author, or general query.
 * Returns parsed and validated search results. Cached for 5 minutes.
 */
export async function searchBooks(
  query: string,
  limit: number = 20,
): Promise<OLSearchResponse> {
  const cacheKey = `${query}::${limit}`;
  const cached = getCached<unknown>(searchCache, cacheKey);
  if (cached !== undefined) {
    const cachedResult = OLSearchResponseSchema.safeParse(cached);
    if (cachedResult.success) return cachedResult.data;
    searchCache.delete(cacheKey); // Evict invalid cache entry
  }

  const searchQuery = buildSearchQuery(query);
  const fields = 'key,title,author_name,author_key,first_publish_year,isbn,cover_edition_key,number_of_pages_median,subject,publisher,cover_i,edition_key,subtitle,language,edition_count';
  const url = `${BASE_URL}/search.json?q=${encodeURIComponent(searchQuery)}&limit=${limit}&fields=${fields}`;
  const data = await fetchJSON(url);
  const result = OLSearchResponseSchema.safeParse(data);
  if (!result.success) {
    throw new Error(`Open Library returned unexpected response format`);
  }
  setCache(searchCache, cacheKey, data, SEARCH_CACHE_TTL_MS);
  return result.data;
}

/**
 * Search Open Library and return results ranked by title relevance.
 */
export async function searchBooksRanked(
  query: string,
  limit: number = 20,
): Promise<OLSearchResponse> {
  const response = await searchBooks(query, limit);

  // Sort docs by relevance to the original query
  const ranked = [...response.docs].sort(
    (a, b) => relevanceScore(b, query) - relevanceScore(a, query),
  );

  return { ...response, docs: ranked };
}

/**
 * Fetch book edition data by ISBN (10 or 13).
 * Returns the edition record with metadata. Cached for 30 minutes.
 */
export async function getBookByISBN(isbn: string): Promise<OLBookEdition> {
  const cached = getCached<unknown>(isbnCache, isbn);
  if (cached !== undefined) return OLBookEditionSchema.parse(cached);

  const url = `${BASE_URL}/isbn/${encodeURIComponent(isbn)}.json`;
  const data = await fetchJSON(url);
  setCache(isbnCache, isbn, data, ISBN_CACHE_TTL_MS);
  return OLBookEditionSchema.parse(data);
}

/**
 * Fetch a work record by its Open Library ID (e.g. "OL45804W").
 * Works represent a logical book across all its editions.
 */
export async function getWork(olid: string): Promise<OLWork> {
  const url = `${BASE_URL}/works/${encodeURIComponent(olid)}.json`;
  const data = await fetchJSON(url);
  return OLWorkSchema.parse(data);
}

/**
 * Fetch an author record by their Open Library ID (e.g. "OL34184A").
 */
export async function getAuthor(olid: string): Promise<OLAuthor> {
  const url = `${BASE_URL}/authors/${encodeURIComponent(olid)}.json`;
  const data = await fetchJSON(url);
  return OLAuthorSchema.parse(data);
}

/**
 * Fetch books by subject from Open Library's subjects API.
 * Returns a list of book works in the given subject category.
 */
export async function getBooksBySubject(
  subject: string,
  limit: number = 10,
): Promise<OLSubjectResponse> {
  const cacheKey = `subject:${subject}:${limit}`;
  const cached = getCached<unknown>(searchCache, cacheKey);
  if (cached !== undefined) {
    const result = OLSubjectResponseSchema.safeParse(cached);
    if (result.success) return result.data;
    searchCache.delete(cacheKey);
  }

  const url = `${BASE_URL}/subjects/${encodeURIComponent(subject.toLowerCase().replace(/ /g, '_'))}.json?limit=${limit}`;
  const data = await fetchJSON(url);
  const result = OLSubjectResponseSchema.safeParse(data);
  if (!result.success) {
    throw new Error('Open Library subjects API returned unexpected format');
  }
  setCache(searchCache, cacheKey, data, SEARCH_CACHE_TTL_MS);
  return result.data;
}

/**
 * Construct a cover image URL by ISBN.
 * Does not make a network request — returns the URL string.
 */
export function getCoverUrl(isbn: string, size: CoverSize = 'L'): string {
  return `${COVERS_BASE_URL}/b/isbn/${encodeURIComponent(isbn)}-${size}.jpg`;
}

/**
 * Construct a cover image URL by Open Library edition OLID.
 * Does not make a network request — returns the URL string.
 */
export function getCoverUrlByOLID(olid: string, size: CoverSize = 'L'): string {
  return `${COVERS_BASE_URL}/b/olid/${encodeURIComponent(olid)}-${size}.jpg`;
}
