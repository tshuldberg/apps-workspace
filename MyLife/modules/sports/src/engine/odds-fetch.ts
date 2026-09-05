/**
 * The Odds API fetch engine for current game odds + futures outrights.
 *
 * Pure TS -- no React / RN imports. Mirrors `engine/scores.ts` in shape:
 * injectable fetch + now + signal, module-scoped LRU, defensive Zod
 * parsing, never throws to callers (returns `null` on any failure).
 *
 * Why in-memory LRU and not a V5 sp_odds_snapshots table:
 *   The Odds API free tier is 500 req/mo. We will stay well under that by
 *   (a) caching positive responses for 24h, and (b) negative-caching
 *   failures (missing key / 401 / 429 / 5xx / network) for 1h so the UI
 *   does not retry-storm. A SQLite table would be extra schema weight for
 *   a capped quota.
 *
 * Graceful degradation:
 *   - No API key => returns `null` immediately, negative-cached for 1h.
 *   - Non-2xx response => returns `null`, negative-cached for 1h.
 *   - Malformed payload (Zod fail) => returns `null`, negative-cached.
 *   - Network error / abort => propagates AbortError so callers can
 *     bail out cleanly; non-abort errors negative-cache + return null.
 */

import { z } from 'zod';
import type { LeagueId } from '../types';

// ---------------------------------------------------------------------------
// Public shape
// ---------------------------------------------------------------------------

export type OddsMarket = 'h2h' | 'spreads' | 'totals' | 'outrights';

export interface OddsSnapshot {
  league: LeagueId;
  event_id: string | null; // null for outrights
  market: OddsMarket;
  sportsbook: string; // normalized lowercase, e.g. 'draftkings'
  team: string;
  price_american: number;
  point?: number | null;
  fetched_at: number; // ms
}

// 24h positive cache; 1h negative cache.
export const ODDS_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
export const ODDS_NEGATIVE_TTL_MS = 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Sport-key map (Odds API vs. our LeagueId)
// ---------------------------------------------------------------------------

const SPORT_KEY: Record<LeagueId, string> = {
  nfl: 'americanfootball_nfl',
  nba: 'basketball_nba',
  mlb: 'baseball_mlb',
  nhl: 'icehockey_nhl',
  mls: 'soccer_usa_mls',
};

// ---------------------------------------------------------------------------
// Odds API response schemas (defensive subset)
// ---------------------------------------------------------------------------

const OutcomeSchema = z.object({
  name: z.string().min(1),
  price: z.number(),
  point: z.number().optional().nullable(),
});

const MarketSchema = z.object({
  key: z.string().min(1),
  outcomes: z.array(OutcomeSchema).optional().default([]),
});

const BookmakerSchema = z.object({
  key: z.string().min(1),
  markets: z.array(MarketSchema).optional().default([]),
});

const EventSchema = z.object({
  id: z.string().min(1),
  bookmakers: z.array(BookmakerSchema).optional().default([]),
});

const EventListSchema = z.array(EventSchema);

// ---------------------------------------------------------------------------
// LRU (positive + negative entries share the cap)
// ---------------------------------------------------------------------------

interface CacheEntry {
  at: number; // ms when stored
  data: OddsSnapshot[] | null; // null => negative cache
}

const CACHE_LIMIT = 200;
const cache = new Map<string, CacheEntry>();

function cacheKey(
  league: LeagueId,
  market: OddsMarket,
  sportsbook: string | undefined,
  isNegative: boolean,
): string {
  return `${league}|${market}|${sportsbook ?? 'all'}|${isNegative ? 'neg' : 'pos'}`;
}

function cacheGet(key: string, now: number): CacheEntry | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined;
  const ttl = entry.data === null ? ODDS_NEGATIVE_TTL_MS : ODDS_CACHE_TTL_MS;
  if (now - entry.at > ttl) {
    cache.delete(key);
    return undefined;
  }
  // Refresh LRU order.
  cache.delete(key);
  cache.set(key, entry);
  return entry;
}

function cacheSet(key: string, entry: CacheEntry): void {
  if (cache.has(key)) cache.delete(key);
  else if (cache.size >= CACHE_LIMIT) {
    const oldest = cache.keys().next().value as string | undefined;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, entry);
}

/** Test/debug helper -- clears the full LRU (positive + negative entries). */
export function clearOddsCache(): void {
  cache.clear();
}

// ---------------------------------------------------------------------------
// URL builders
// ---------------------------------------------------------------------------

function buildOddsUrl(
  league: LeagueId,
  market: Exclude<OddsMarket, 'outrights'>,
  apiKey: string,
): string {
  const sportKey = SPORT_KEY[league];
  return `https://api.the-odds-api.com/v4/sports/${sportKey}/odds/?regions=us&markets=${market}&apiKey=${encodeURIComponent(apiKey)}`;
}

function buildOutrightsUrl(league: LeagueId, apiKey: string): string {
  const sportKey = SPORT_KEY[league];
  return `https://api.the-odds-api.com/v4/sports/${sportKey}/odds/?markets=outrights&apiKey=${encodeURIComponent(apiKey)}`;
}

// ---------------------------------------------------------------------------
// Fetch + parse
// ---------------------------------------------------------------------------

type FetchImpl = typeof fetch;

interface FetchArgs {
  url: string;
  league: LeagueId;
  market: OddsMarket;
  sportsbook: string | undefined;
  signal: AbortSignal | undefined;
  fetchImpl: FetchImpl;
  now: number;
  eventIdMode: 'per-event' | 'null-for-outrights';
}

async function fetchAndParse(
  args: FetchArgs,
): Promise<OddsSnapshot[] | null> {
  const { url, league, market, sportsbook, signal, fetchImpl, now, eventIdMode } = args;
  let res: Response;
  try {
    res = await fetchImpl(url, { signal });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') throw err;
    return null;
  }
  if (!res.ok) {
    return null;
  }
  let json: unknown;
  try {
    json = await res.json();
  } catch {
    return null;
  }
  const parsed = EventListSchema.safeParse(json);
  if (!parsed.success) return null;
  const snapshots: OddsSnapshot[] = [];
  for (const event of parsed.data) {
    for (const book of event.bookmakers) {
      const bookKey = book.key.toLowerCase();
      if (sportsbook !== undefined && bookKey !== sportsbook.toLowerCase()) {
        continue;
      }
      for (const marketBlock of book.markets) {
        // We only keep outcomes matching the requested market.
        if (marketBlock.key !== market) continue;
        for (const outcome of marketBlock.outcomes) {
          snapshots.push({
            league,
            event_id: eventIdMode === 'null-for-outrights' ? null : event.id,
            market,
            sportsbook: bookKey,
            team: outcome.name,
            price_american: Math.round(outcome.price),
            point: outcome.point ?? null,
            fetched_at: now,
          });
        }
      }
    }
  }
  return snapshots;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface FetchCurrentOddsOptions {
  league: LeagueId;
  market: Exclude<OddsMarket, 'outrights'>;
  sportsbook?: string;
  apiKey: string | null | undefined;
  signal?: AbortSignal;
  fetchImpl?: FetchImpl;
  now?: () => number;
}

/**
 * Fetch current h2h / spreads / totals odds for a league.
 * Returns `null` on any degraded condition (missing key, non-2xx, malformed).
 * Aborts propagate as rejected promises.
 */
export async function fetchCurrentOdds(
  opts: FetchCurrentOddsOptions,
): Promise<OddsSnapshot[] | null> {
  const {
    league,
    market,
    sportsbook,
    apiKey,
    signal,
    fetchImpl = fetch,
    now: nowFn = Date.now,
  } = opts;
  const now = nowFn();
  const posKey = cacheKey(league, market, sportsbook, false);
  const negKey = cacheKey(league, market, sportsbook, true);

  const negHit = cacheGet(negKey, now);
  if (negHit) return null;
  const posHit = cacheGet(posKey, now);
  if (posHit) return posHit.data;

  if (!apiKey) {
    cacheSet(negKey, { at: now, data: null });
    return null;
  }

  const url = buildOddsUrl(league, market, apiKey);
  const result = await fetchAndParse({
    url,
    league,
    market,
    sportsbook,
    signal,
    fetchImpl,
    now,
    eventIdMode: 'per-event',
  });
  if (result === null) {
    cacheSet(negKey, { at: now, data: null });
    return null;
  }
  cacheSet(posKey, { at: now, data: result });
  return result;
}

export interface FetchFuturesOddsOptions {
  league: LeagueId;
  apiKey: string | null | undefined;
  signal?: AbortSignal;
  fetchImpl?: FetchImpl;
  now?: () => number;
}

/**
 * Fetch outrights (championship / division futures) for a league.
 * Returns `null` on any degraded condition. event_id is null for outrights.
 */
export async function fetchFuturesOdds(
  opts: FetchFuturesOddsOptions,
): Promise<OddsSnapshot[] | null> {
  const {
    league,
    apiKey,
    signal,
    fetchImpl = fetch,
    now: nowFn = Date.now,
  } = opts;
  const now = nowFn();
  const market: OddsMarket = 'outrights';
  const posKey = cacheKey(league, market, undefined, false);
  const negKey = cacheKey(league, market, undefined, true);

  const negHit = cacheGet(negKey, now);
  if (negHit) return null;
  const posHit = cacheGet(posKey, now);
  if (posHit) return posHit.data;

  if (!apiKey) {
    cacheSet(negKey, { at: now, data: null });
    return null;
  }

  const url = buildOutrightsUrl(league, apiKey);
  const result = await fetchAndParse({
    url,
    league,
    market,
    sportsbook: undefined,
    signal,
    fetchImpl,
    now,
    eventIdMode: 'null-for-outrights',
  });
  if (result === null) {
    cacheSet(negKey, { at: now, data: null });
    return null;
  }
  cacheSet(posKey, { at: now, data: result });
  return result;
}
