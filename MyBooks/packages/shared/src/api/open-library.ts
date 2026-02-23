/// <reference lib="dom" />

import {
  OLSearchResponseSchema,
  OLBookEditionSchema,
  OLWorkSchema,
  OLAuthorSchema,
} from './types';
import type {
  OLSearchResponse,
  OLBookEdition,
  OLWork,
  OLAuthor,
  CoverSize,
} from './types';

const BASE_URL = 'https://openlibrary.org';
const COVERS_BASE_URL = 'https://covers.openlibrary.org';

/** Polite delay between requests (ms). Open Library asks for ~100 req/min max. */
const RATE_LIMIT_MS = 650;

let lastRequestTime = 0;

async function politeDelay(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < RATE_LIMIT_MS) {
    await new Promise<void>((resolve) => setTimeout(resolve, RATE_LIMIT_MS - elapsed));
  }
  lastRequestTime = Date.now();
}

async function fetchJSON(url: string): Promise<unknown> {
  await politeDelay();
  const response = await fetch(url, {
    headers: { 'User-Agent': 'MyBooks/1.0 (https://github.com/mybooks)' },
  });
  if (!response.ok) {
    throw new Error(`Open Library request failed: ${response.status} ${response.statusText} — ${url}`);
  }
  return response.json();
}

/**
 * Search Open Library for books by title, author, or general query.
 * Returns parsed and validated search results.
 */
export async function searchBooks(
  query: string,
  limit: number = 20,
): Promise<OLSearchResponse> {
  const url = `${BASE_URL}/search.json?q=${encodeURIComponent(query)}&limit=${limit}`;
  const data = await fetchJSON(url);
  return OLSearchResponseSchema.parse(data);
}

/**
 * Fetch book edition data by ISBN (10 or 13).
 * Returns the edition record with metadata.
 */
export async function getBookByISBN(isbn: string): Promise<OLBookEdition> {
  const url = `${BASE_URL}/isbn/${encodeURIComponent(isbn)}.json`;
  const data = await fetchJSON(url);
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
