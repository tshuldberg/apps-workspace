/**
 * Search query engine.
 *
 * Provides FTS5-powered search with LIKE fallback, recency-boosted ranking,
 * snippet extraction with match highlighting, module filtering, LRU caching,
 * grouped results by module, and performance logging.
 */

import type { DatabaseAdapter } from '@mylife/db';

/** A single search result from the unified index. */
export interface SearchResult {
  moduleId: string;
  itemId: string;
  itemType: string;
  title: string;
  snippet: string;
  updatedAt: string;
  rank: number;
}

/** Options for search queries. */
export interface SearchOptions {
  /** Limit to specific module IDs. */
  moduleIds?: string[];
  /** Maximum number of results. Default: 20. */
  limit?: number;
  /** Offset for pagination. Default: 0. */
  offset?: number;
}

/** Module metadata needed for grouped search results. */
export interface SearchModuleMeta {
  id: string;
  name: string;
  icon: string;
  accentColor: string;
}

/** A group of search results for a single module. */
export interface SearchResultGroup {
  moduleId: string;
  moduleName: string;
  icon: string;
  accentColor: string;
  results: SearchResult[];
}

/** Maximum words in a search query to prevent FTS5 performance issues. */
const MAX_QUERY_WORDS = 10;

/** Characters of context shown on each side of a match in snippets. */
const SNIPPET_CONTEXT = 40;

/** Maximum length of a snippet when no match is found in content. */
const SNIPPET_FALLBACK_LENGTH = 80;

// ---------------------------------------------------------------------------
// LRU Cache
// ---------------------------------------------------------------------------

const CACHE_MAX_ENTRIES = 50;
const CACHE_TTL_MS = 30_000;

interface CacheEntry {
  results: SearchResult[];
  timestamp: number;
}

const queryCache = new Map<string, CacheEntry>();

function cacheKey(query: string, options?: SearchOptions): string {
  const mods = options?.moduleIds ? options.moduleIds.slice().sort().join(',') : '';
  return `${query}|${mods}|${options?.limit ?? 20}|${options?.offset ?? 0}`;
}

function cacheGet(key: string): SearchResult[] | null {
  const entry = queryCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    queryCache.delete(key);
    return null;
  }
  // Move to end (most recently used)
  queryCache.delete(key);
  queryCache.set(key, entry);
  return entry.results;
}

function cacheSet(key: string, results: SearchResult[]): void {
  // Evict oldest entries if at capacity
  if (queryCache.size >= CACHE_MAX_ENTRIES) {
    const oldest = queryCache.keys().next().value;
    if (oldest !== undefined) queryCache.delete(oldest);
  }
  queryCache.set(key, { results, timestamp: Date.now() });
}

/** Clear the query cache. Useful after index updates. */
export function clearSearchCache(): void {
  queryCache.clear();
}

/** Exposed for testing only. */
export function _getCacheSize(): number {
  return queryCache.size;
}

// ---------------------------------------------------------------------------
// Performance logging
// ---------------------------------------------------------------------------

const PERF_THRESHOLD_MS = 200;

export type SearchPerfLogger = (message: string, durationMs: number, query: string) => void;

let perfLogger: SearchPerfLogger | null = null;

/** Set a callback for search performance warnings (queries > 200ms). */
export function setSearchPerfLogger(logger: SearchPerfLogger | null): void {
  perfLogger = logger;
}

function logSlowQuery(label: string, startMs: number, query: string): void {
  const duration = Date.now() - startMs;
  if (duration > PERF_THRESHOLD_MS && perfLogger) {
    perfLogger(`Slow search (${label}): ${duration}ms`, duration, query);
  }
}

/**
 * Sanitize a user query for FTS5.
 * Strips special characters, truncates to MAX_QUERY_WORDS, and appends
 * prefix wildcards for partial matching.
 */
function sanitizeFtsQuery(raw: string): string {
  const cleaned = raw.replace(/[^\w\s]/g, '').trim();
  if (!cleaned) return '';
  return cleaned
    .split(/\s+/)
    .slice(0, MAX_QUERY_WORDS)
    .map((word) => `${word}*`)
    .join(' ');
}

/**
 * Extract lowercase query terms for snippet highlighting.
 */
function getQueryTerms(raw: string): string[] {
  return raw
    .replace(/[^\w\s]/g, '')
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, MAX_QUERY_WORDS);
}

/**
 * Extract a snippet from content with match highlighting.
 * Shows SNIPPET_CONTEXT chars of context on each side of the first match,
 * with **match** markers for UI rendering.
 */
function extractSnippet(content: string, queryTerms: string[]): string {
  if (!content) return '';

  const lower = content.toLowerCase();

  // Find the earliest matching term position
  let bestPos = -1;
  let bestLen = 0;
  for (const term of queryTerms) {
    const pos = lower.indexOf(term);
    if (pos !== -1 && (bestPos === -1 || pos < bestPos)) {
      bestPos = pos;
      bestLen = term.length;
    }
  }

  // No match in content: return truncated beginning
  if (bestPos === -1) {
    if (content.length <= SNIPPET_FALLBACK_LENGTH) return content;
    return content.slice(0, SNIPPET_FALLBACK_LENGTH) + '...';
  }

  // Extract window around the match
  const start = Math.max(0, bestPos - SNIPPET_CONTEXT);
  const end = Math.min(content.length, bestPos + bestLen + SNIPPET_CONTEXT);

  const before = content.slice(start, bestPos);
  const match = content.slice(bestPos, bestPos + bestLen);
  const after = content.slice(bestPos + bestLen, end);

  const prefix = start > 0 ? '...' : '';
  const suffix = end < content.length ? '...' : '';

  return `${prefix}${before}**${match}**${after}${suffix}`;
}

/**
 * SQL recency boost expression.
 * Subtracts a bonus from rank for recently updated items
 * (more negative rank = higher relevance in FTS5).
 */
const RECENCY_BOOST = `- CASE
  WHEN updated_at >= datetime('now', '-1 day') THEN 5.0
  WHEN updated_at >= datetime('now', '-7 days') THEN 2.0
  WHEN updated_at >= datetime('now', '-30 days') THEN 0.5
  ELSE 0.0
END`;

/**
 * Search the unified index using FTS5 with LIKE fallback.
 *
 * Returns results ranked by FTS5 relevance with recency boost.
 * Empty queries return the most recent items across all modules.
 * Falls back to LIKE-based search if FTS5 fails.
 * Uses LRU cache (50 entries, 30s TTL) to hit the 200ms target.
 */
export function search(
  db: DatabaseAdapter,
  query: string,
  options?: SearchOptions,
): SearchResult[] {
  const limit = options?.limit ?? 20;
  const offset = options?.offset ?? 0;
  const moduleIds = options?.moduleIds;

  const ftsQuery = sanitizeFtsQuery(query);

  // Empty query: return recent items (not cached)
  if (!ftsQuery) return searchRecent(db, options);

  // Check LRU cache
  const key = cacheKey(query, options);
  const cached = cacheGet(key);
  if (cached) return cached;

  const startMs = Date.now();
  const queryTerms = getQueryTerms(query);

  // Build optional module filter clause
  const moduleFilter = moduleIds && moduleIds.length > 0
    ? `AND module_id IN (${moduleIds.map(() => '?').join(',')})`
    : '';
  const moduleParams = moduleIds && moduleIds.length > 0 ? moduleIds : [];

  // Try FTS5 with recency boost
  try {
    const rows = db.query<Record<string, unknown>>(
      `SELECT module_id, item_id, item_type, title, content, updated_at,
              rank ${RECENCY_BOOST} as boosted_rank
       FROM hub_search_index
       WHERE hub_search_index MATCH ?
       ${moduleFilter}
       ORDER BY boosted_rank
       LIMIT ? OFFSET ?`,
      [ftsQuery, ...moduleParams, limit, offset],
    );

    if (rows.length > 0) {
      const results = rows.map((row) => rowToResult(row, queryTerms));
      logSlowQuery('FTS5', startMs, query);
      cacheSet(key, results);
      return results;
    }
  } catch {
    // FTS5 query failed, fall through to LIKE
  }

  // Fallback: LIKE search on title and content
  const pattern = `%${query.trim()}%`;
  const rows = db.query<Record<string, unknown>>(
    `SELECT module_id, item_id, item_type, title, content, updated_at, 0 as boosted_rank
     FROM hub_search_index
     WHERE (title LIKE ? OR content LIKE ?)
     ${moduleFilter}
     ORDER BY updated_at DESC
     LIMIT ? OFFSET ?`,
    [pattern, pattern, ...moduleParams, limit, offset],
  );

  const results = rows.map((row) => rowToResult(row, queryTerms));
  logSlowQuery('LIKE fallback', startMs, query);
  cacheSet(key, results);
  return results;
}

/**
 * Return the most recent items across all (or filtered) modules.
 * Used for empty queries and Cmd+K initial state.
 */
export function searchRecent(
  db: DatabaseAdapter,
  options?: SearchOptions,
): SearchResult[] {
  const limit = options?.limit ?? 20;
  const offset = options?.offset ?? 0;
  const moduleIds = options?.moduleIds;

  const moduleFilter = moduleIds && moduleIds.length > 0
    ? `WHERE module_id IN (${moduleIds.map(() => '?').join(',')})`
    : '';
  const moduleParams = moduleIds && moduleIds.length > 0 ? moduleIds : [];

  const rows = db.query<Record<string, unknown>>(
    `SELECT module_id, item_id, item_type, title, content, updated_at, 0 as boosted_rank
     FROM hub_search_index
     ${moduleFilter}
     ORDER BY updated_at DESC
     LIMIT ? OFFSET ?`,
    [...moduleParams, limit, offset],
  );

  return rows.map((row) => rowToResult(row, []));
}

/**
 * Count total results for a query (for pagination).
 * Returns total item count for empty queries.
 */
export function searchCount(
  db: DatabaseAdapter,
  query: string,
  moduleIds?: string[],
): number {
  const ftsQuery = sanitizeFtsQuery(query);

  // Empty query: count all items
  if (!ftsQuery) {
    const whereClause = moduleIds && moduleIds.length > 0
      ? `WHERE module_id IN (${moduleIds.map(() => '?').join(',')})`
      : '';
    const params = moduleIds && moduleIds.length > 0 ? moduleIds : [];
    const rows = db.query<Record<string, unknown>>(
      `SELECT count(*) as cnt FROM hub_search_index ${whereClause}`,
      params,
    );
    return Number(rows[0]?.cnt ?? 0);
  }

  const moduleFilter = moduleIds && moduleIds.length > 0
    ? `AND module_id IN (${moduleIds.map(() => '?').join(',')})`
    : '';
  const moduleParams = moduleIds && moduleIds.length > 0 ? moduleIds : [];

  try {
    const rows = db.query<Record<string, unknown>>(
      `SELECT count(*) as cnt
       FROM hub_search_index
       WHERE hub_search_index MATCH ?
       ${moduleFilter}`,
      [ftsQuery, ...moduleParams],
    );
    return Number(rows[0]?.cnt ?? 0);
  } catch {
    const pattern = `%${query.trim()}%`;
    const rows = db.query<Record<string, unknown>>(
      `SELECT count(*) as cnt
       FROM hub_search_index
       WHERE (title LIKE ? OR content LIKE ?)
       ${moduleFilter}`,
      [pattern, pattern, ...moduleParams],
    );
    return Number(rows[0]?.cnt ?? 0);
  }
}

function rowToResult(row: Record<string, unknown>, queryTerms: string[]): SearchResult {
  const content = String(row.content ?? '');
  return {
    moduleId: String(row.module_id),
    itemId: String(row.item_id),
    itemType: String(row.item_type),
    title: String(row.title),
    snippet: queryTerms.length > 0
      ? extractSnippet(content, queryTerms)
      : content.length > SNIPPET_FALLBACK_LENGTH
        ? content.slice(0, SNIPPET_FALLBACK_LENGTH) + '...'
        : content,
    updatedAt: String(row.updated_at),
    rank: Number(row.boosted_rank ?? row.rank ?? 0),
  };
}

// ---------------------------------------------------------------------------
// Grouped search results (R23.2)
// ---------------------------------------------------------------------------

/**
 * Search and group results by module with accent color and icon.
 * Falls back to ungrouped results if no module metadata provided.
 */
export function searchGrouped(
  db: DatabaseAdapter,
  query: string,
  moduleMeta: SearchModuleMeta[],
  options?: SearchOptions,
): SearchResultGroup[] {
  const results = search(db, query, options);
  return groupResultsByModule(results, moduleMeta);
}

/**
 * Group flat search results by module, attaching metadata.
 * Preserves the ranking order within each group.
 * Groups are ordered by the best-ranked result in each group.
 */
export function groupResultsByModule(
  results: SearchResult[],
  moduleMeta: SearchModuleMeta[],
): SearchResultGroup[] {
  const metaMap = new Map(moduleMeta.map((m) => [m.id, m]));
  const groupMap = new Map<string, SearchResult[]>();

  for (const result of results) {
    const existing = groupMap.get(result.moduleId);
    if (existing) {
      existing.push(result);
    } else {
      groupMap.set(result.moduleId, [result]);
    }
  }

  const groups: SearchResultGroup[] = [];
  for (const [moduleId, groupResults] of groupMap) {
    const meta = metaMap.get(moduleId);
    groups.push({
      moduleId,
      moduleName: meta?.name ?? moduleId,
      icon: meta?.icon ?? '',
      accentColor: meta?.accentColor ?? '#888888',
      results: groupResults,
    });
  }

  return groups;
}

// ---------------------------------------------------------------------------
// Recent cross-module actions (R23.5)
// ---------------------------------------------------------------------------

/** Default number of recent actions for empty search state. */
const RECENT_ACTIONS_LIMIT = 15;

/**
 * Get the most recent cross-module actions for the empty search state.
 * Returns the 15 most recent items from the search index.
 */
export function getRecentActions(
  db: DatabaseAdapter,
  moduleMeta?: SearchModuleMeta[],
): SearchResultGroup[] | SearchResult[] {
  const results = searchRecent(db, { limit: RECENT_ACTIONS_LIMIT });
  if (moduleMeta) {
    return groupResultsByModule(results, moduleMeta);
  }
  return results;
}
