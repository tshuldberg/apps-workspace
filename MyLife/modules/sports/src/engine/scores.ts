/**
 * Live scores engine for the five launch leagues (NFL / NBA / MLB / NHL / MLS).
 *
 * Pure TS -- no React Query, no RN-specific APIs. The UI layer decides
 * how often to call this (see `pickInterval` in `./polling.ts`). Fans out
 * across the requested leagues in parallel via `Promise.all`, caches per
 * `{league}:{dateKey}` with a 20s TTL, and normalizes ESPN payloads into
 * the shared `Game` shape.
 */

import type { Game, GameStatus, GameTeam, League, LeagueId } from '../types';
import { LAUNCH_LEAGUES, getLeagueById } from './leagues';

// ---------------------------------------------------------------------------
// ESPN scoreboard response shape (defensive subset)
// ---------------------------------------------------------------------------

interface EspnCompetitor {
  id?: string;
  homeAway?: 'home' | 'away';
  score?: string;
  team?: {
    id?: string;
    displayName?: string;
    shortDisplayName?: string;
    name?: string;
    abbreviation?: string;
  };
}

interface EspnStatusType {
  state?: 'pre' | 'in' | 'post';
  completed?: boolean;
  shortDetail?: string;
  description?: string;
}

interface EspnStatus {
  type?: EspnStatusType;
  period?: number;
  displayClock?: string;
}

interface EspnBroadcast {
  names?: string[];
}

interface EspnVenue {
  fullName?: string;
}

interface EspnCompetition {
  competitors?: EspnCompetitor[];
  status?: EspnStatus;
  broadcasts?: EspnBroadcast[];
  venue?: EspnVenue;
}

interface EspnEvent {
  id?: string;
  date?: string;
  status?: EspnStatus;
  competitions?: EspnCompetition[];
}

interface EspnScoreboardResponse {
  events?: EspnEvent[];
}

// ---------------------------------------------------------------------------
// Fetch abstraction (injectable for tests)
// ---------------------------------------------------------------------------

export type ScoresFetch = (
  url: string,
  init: { signal?: AbortSignal },
) => Promise<EspnScoreboardResponse>;

const defaultFetch: ScoresFetch = async (url, init) => {
  const response = await fetch(url, { signal: init.signal });
  if (!response.ok) {
    throw new Error(`ESPN scoreboard request failed: ${response.status}`);
  }
  return (await response.json()) as EspnScoreboardResponse;
};

// ---------------------------------------------------------------------------
// Module-scoped TTL LRU cache keyed by `${league}:${dateKey}`
// ---------------------------------------------------------------------------

export const SCOREBOARD_TTL_MS = 20_000;
const CACHE_LIMIT = 40;

interface CacheEntry {
  expiresAt: number;
  games: Game[];
}

class TtlLruCache {
  private readonly map = new Map<string, CacheEntry>();

  constructor(private readonly limit: number) {}

  get(key: string, now: number): Game[] | undefined {
    const entry = this.map.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= now) {
      this.map.delete(key);
      return undefined;
    }
    // Refresh LRU order.
    this.map.delete(key);
    this.map.set(key, entry);
    return entry.games;
  }

  set(key: string, games: Game[], expiresAt: number): void {
    if (this.map.has(key)) {
      this.map.delete(key);
    } else if (this.map.size >= this.limit) {
      const oldest = this.map.keys().next().value as string | undefined;
      if (oldest !== undefined) this.map.delete(oldest);
    }
    this.map.set(key, { expiresAt, games });
  }

  clear(): void {
    this.map.clear();
  }

  get size(): number {
    return this.map.size;
  }
}

const scoreboardCache = new TtlLruCache(CACHE_LIMIT);

/** Test/debug helper -- clears the module-scoped scoreboard cache. */
export function clearScoreboardCache(): void {
  scoreboardCache.clear();
}

// ---------------------------------------------------------------------------
// Mapping helpers
// ---------------------------------------------------------------------------

function dateKey(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

function buildScoreboardUrl(league: League, key: string): string {
  return `https://site.api.espn.com/apis/site/v2/sports/${league.espnSport}/${league.espnLeague}/scoreboard?dates=${key}`;
}

function mapStatus(type?: EspnStatusType): GameStatus {
  const state = type?.state;
  if (state === 'in') return 'live';
  if (state === 'post' || type?.completed) return 'final';
  return 'scheduled';
}

function parseScore(raw: string | undefined): number | null {
  if (raw === undefined || raw === null || raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function mapCompetitor(c: EspnCompetitor | undefined): GameTeam | null {
  if (!c) return null;
  const name =
    c.team?.displayName ??
    c.team?.shortDisplayName ??
    c.team?.name ??
    c.team?.abbreviation;
  if (!name) return null;
  return {
    id: c.team?.id ?? null,
    name,
    abbreviation: c.team?.abbreviation ?? null,
    score: parseScore(c.score),
  };
}

function pickByHomeAway(
  comps: EspnCompetitor[] | undefined,
  which: 'home' | 'away',
): EspnCompetitor | undefined {
  return comps?.find((c) => c.homeAway === which);
}

function mapBroadcast(broadcasts: EspnBroadcast[] | undefined): string | null {
  if (!broadcasts || broadcasts.length === 0) return null;
  const names = broadcasts.flatMap((b) => b.names ?? []);
  return names.length > 0 ? names.join(', ') : null;
}

function mapEvent(event: EspnEvent, league: League, now: number): Game | null {
  if (!event.id) return null;
  const competition = event.competitions?.[0];
  const home = mapCompetitor(pickByHomeAway(competition?.competitors, 'home'));
  const away = mapCompetitor(pickByHomeAway(competition?.competitors, 'away'));
  if (!home || !away) return null;

  const status = mapStatus(competition?.status?.type ?? event.status?.type);
  const startAt = event.date ? Date.parse(event.date) : NaN;
  if (!Number.isFinite(startAt)) return null;

  return {
    id: `espn:${league.id}:${event.id}`,
    league: league.id,
    sport: league.sport,
    home,
    away,
    status,
    period:
      competition?.status?.type?.shortDetail ??
      competition?.status?.type?.description ??
      null,
    clock: competition?.status?.displayClock ?? null,
    startAt,
    venue: competition?.venue?.fullName ?? null,
    broadcast: mapBroadcast(competition?.broadcasts),
    updatedAt: now,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface FetchLiveScoresOptions {
  leagues?: LeagueId[];
  /** Defaults to "today" (UTC date key). */
  date?: Date;
  signal?: AbortSignal;
  fetchImpl?: ScoresFetch;
  /** Override clock for tests. */
  now?: number;
}

/**
 * Fetch scoreboard games for the supplied leagues on the supplied date.
 *
 * Fans out with `Promise.all` across leagues. Each `{league}:{dateKey}`
 * tuple is cached with a 20s TTL so repeat polls inside a live window
 * don't hammer ESPN.
 *
 * Passing an `AbortSignal` cancels all in-flight requests.
 */
export async function fetchLiveScores(
  options: FetchLiveScoresOptions = {},
): Promise<Game[]> {
  const {
    signal,
    fetchImpl = defaultFetch,
    date = new Date(),
    now = Date.now(),
  } = options;
  const leaguesIds =
    options.leagues && options.leagues.length > 0
      ? options.leagues
      : LAUNCH_LEAGUES.map((l) => l.id);
  const leagues = leaguesIds
    .map((id) => getLeagueById(id))
    .filter((l): l is League => Boolean(l));

  const key = dateKey(date);

  const perLeague = await Promise.all(
    leagues.map(async (league) => {
      const cacheKey = `${league.id}:${key}`;
      const cached = scoreboardCache.get(cacheKey, now);
      if (cached) return cached;

      const url = buildScoreboardUrl(league, key);
      const json = await fetchImpl(url, { signal });
      const events = json.events ?? [];
      const games = events
        .map((event) => mapEvent(event, league, now))
        .filter((g): g is Game => g !== null);
      scoreboardCache.set(cacheKey, games, now + SCOREBOARD_TTL_MS);
      return games;
    }),
  );

  return perLeague.flat();
}
