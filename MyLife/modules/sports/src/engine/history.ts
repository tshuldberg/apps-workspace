/**
 * Scores history engine for the five launch leagues (NFL / NBA / MLB / NHL / MLS).
 *
 * Pure TS -- no React Query, no RN-specific APIs, no expo imports. Mirrors
 * the `scores.ts` / `team-schedule.ts` / `game-tracker.ts` engine shape
 * exactly (AbortSignal propagation, injectable fetch, TTL LRU cache).
 *
 * ESPN endpoint (same scoreboard transport as `scores.ts`):
 *   `https://site.api.espn.com/apis/site/v2/sports/{sport}/{league}/scoreboard?dates=YYYYMMDD`
 *
 * Gap-fill contract: callers pre-compute a `coveredDates` set from the local
 * `sp_games` cache (via `computeCoveredDates`) and pass it in. `fetchHistorySlice`
 * enumerates the [since, until] UTC day-range, skips already-covered dates,
 * and fetches only the missing days -- chunked at 5 concurrent requests per
 * league to avoid ESPN rate-limit spikes. A per-day TTL LRU keyed by
 * `${league}:${ymd}` ensures a second query inside 24hr is a pure cache hit
 * (final scores never change).
 *
 * Fetch failures are swallowed -- the UI keeps whatever it read from cache
 * and can offer a retry. Dedupe happens on `Game.id` before return (two
 * followed teams sharing a rivalry game produce a single row).
 */
import type { Game, GameStatus, GameTeam, League, LeagueId } from '../types';
import { LAUNCH_LEAGUES, getLeagueById } from './leagues';

// ---------------------------------------------------------------------------
// ESPN scoreboard response shape (defensive subset; mirrors scores.ts)
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

export type HistoryFetch = (
  url: string,
  init: { signal?: AbortSignal },
) => Promise<EspnScoreboardResponse>;

const defaultFetch: HistoryFetch = async (url, init) => {
  const response = await fetch(url, { signal: init.signal });
  if (!response.ok) {
    throw new Error(`ESPN scoreboard request failed: ${response.status}`);
  }
  return (await response.json()) as EspnScoreboardResponse;
};

// ---------------------------------------------------------------------------
// Module-scoped TTL LRU cache keyed by `${league}:${ymd}`
// ---------------------------------------------------------------------------

export const HISTORY_SLICE_TTL_MS = 24 * 60 * 60 * 1_000;
const CACHE_LIMIT = 400;
const MAX_DAYS = 365;
/** Per-day fetch concurrency cap across all league/day tuples. */
export const HISTORY_FETCH_CONCURRENCY = 5;

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

const historyCache = new TtlLruCache(CACHE_LIMIT);

/** Test/debug helper -- clears the module-scoped history slice cache. */
export function clearHistoryCache(): void {
  historyCache.clear();
}

// ---------------------------------------------------------------------------
// Mapping helpers (mirrors scores.ts -- kept local to avoid import cycles)
// ---------------------------------------------------------------------------

const DAY_MS = 24 * 60 * 60 * 1_000;

/**
 * UTC `YYYY-MM-DD` for a given ms timestamp. This is the covered-dates key
 * shape -- the format ISO-slice uses on `new Date(ms).toISOString().slice(0, 10)`
 * but done without allocating a Date for hot paths.
 */
function ymdUtc(ms: number): string {
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** ESPN expects `YYYYMMDD` (no dashes). */
function espnDateKey(ymd: string): string {
  return ymd.replace(/-/g, '');
}

function floorUtcMidnight(ms: number): number {
  return Math.floor(ms / DAY_MS) * DAY_MS;
}

function buildScoreboardUrl(league: League, ymd: string): string {
  return `https://site.api.espn.com/apis/site/v2/sports/${league.espnSport}/${league.espnLeague}/scoreboard?dates=${espnDateKey(ymd)}`;
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
// Public helpers
// ---------------------------------------------------------------------------

/**
 * Compute the set of `YYYY-MM-DD` (UTC) keys for which at least one followed
 * team appears in the supplied `games` list. Used by the history surface to
 * avoid refetching days already present in the local cache.
 *
 * Empty `teamIds` produces an empty set -- we can't declare a day "covered"
 * if no team is followed.
 */
export function computeCoveredDates(
  games: readonly Game[],
  teamIds: readonly string[],
): Set<string> {
  const covered = new Set<string>();
  if (teamIds.length === 0 || games.length === 0) return covered;
  const teamSet = new Set(teamIds);
  for (const g of games) {
    const homeId = g.home.id ?? null;
    const awayId = g.away.id ?? null;
    const homeFollowed = homeId !== null && teamSet.has(homeId);
    const awayFollowed = awayId !== null && teamSet.has(awayId);
    if (homeFollowed || awayFollowed) {
      covered.add(ymdUtc(g.startAt));
    }
  }
  return covered;
}

/** Enumerate `YYYY-MM-DD` UTC dates inside `[since, until]`, bounded at 365. */
function enumerateDates(since: number, until: number): string[] {
  const start = floorUtcMidnight(Math.min(since, until));
  const end = floorUtcMidnight(Math.max(since, until));
  const dates: string[] = [];
  for (let t = start; t <= end && dates.length < MAX_DAYS; t += DAY_MS) {
    dates.push(ymdUtc(t));
  }
  return dates;
}

/** Split `items` into contiguous chunks of at most `size`. */
function chunk<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface FetchHistorySliceOptions {
  /** Followed team ids (compound `espn:{league}:{externalId}` or raw). */
  teamIds: readonly string[];
  /** Subset of launch leagues to fetch. Defaults to all launch leagues. */
  leagues?: LeagueId[];
  since: number;
  until: number;
  /** `YYYY-MM-DD` UTC keys the caller already has in the local cache. */
  coveredDates: Set<string>;
  signal?: AbortSignal;
  fetchImpl?: HistoryFetch;
  /** Override clock for tests. */
  now?: number;
}

/**
 * Fetch newly-needed days of scoreboard data for a history window.
 *
 * - Enumerates UTC days in `[since, until]`.
 * - Skips dates already in `coveredDates`.
 * - For each remaining (league, date) tuple, consults a 24hr TTL LRU first.
 * - Fans out cache-miss tuples at most 5-at-a-time to throttle ESPN.
 * - Filters returned games to the followed team ids before returning.
 * - Dedupes on `Game.id`.
 * - Swallows per-day fetch errors (`[]` on failure); never throws.
 */
export async function fetchHistorySlice(
  options: FetchHistorySliceOptions,
): Promise<Game[]> {
  const {
    signal,
    fetchImpl = defaultFetch,
    now = Date.now(),
    coveredDates,
    teamIds,
  } = options;
  if (teamIds.length === 0) return [];

  const leagueIds =
    options.leagues && options.leagues.length > 0
      ? options.leagues
      : LAUNCH_LEAGUES.map((l) => l.id);
  const leagues = leagueIds
    .map((id) => getLeagueById(id))
    .filter((l): l is League => Boolean(l));
  if (leagues.length === 0) return [];

  const dates = enumerateDates(options.since, options.until);
  const missing = dates.filter((d) => !coveredDates.has(d));
  if (missing.length === 0) return [];

  // Build the full (league, date) work list. Cache hits short-circuit and
  // don't count against the fan-out budget.
  const work: Array<{ league: League; ymd: string }> = [];
  const preCached: Game[] = [];
  for (const league of leagues) {
    for (const ymd of missing) {
      const cacheKey = `${league.id}:${ymd}`;
      const cached = historyCache.get(cacheKey, now);
      if (cached) {
        preCached.push(...cached);
      } else {
        work.push({ league, ymd });
      }
    }
  }

  const teamSet = new Set(teamIds);
  const byId = new Map<string, Game>();

  for (const g of preCached) {
    if (isFollowedGame(g, teamSet)) byId.set(g.id, g);
  }

  // Fan out the cache-miss list at most `HISTORY_FETCH_CONCURRENCY` at a time.
  const chunks = chunk(work, HISTORY_FETCH_CONCURRENCY);
  for (const group of chunks) {
    if (signal?.aborted) break;
    const results = await Promise.all(
      group.map(async ({ league, ymd }) => {
        const cacheKey = `${league.id}:${ymd}`;
        try {
          const url = buildScoreboardUrl(league, ymd);
          const json = await fetchImpl(url, { signal });
          const events = json.events ?? [];
          const games = events
            .map((e) => mapEvent(e, league, now))
            .filter((g): g is Game => g !== null);
          historyCache.set(cacheKey, games, now + HISTORY_SLICE_TTL_MS);
          return games;
        } catch {
          // Swallow per-day failure -- still mark an empty slice cached
          // for a short window? No: a transient failure should allow
          // retry on the next call, so we simply skip writing the cache.
          return [] as Game[];
        }
      }),
    );
    for (const games of results) {
      for (const g of games) {
        if (isFollowedGame(g, teamSet)) byId.set(g.id, g);
      }
    }
  }

  return Array.from(byId.values()).sort((a, b) => b.startAt - a.startAt);
}

function isFollowedGame(game: Game, teamSet: Set<string>): boolean {
  const homeId = game.home.id ?? null;
  const awayId = game.away.id ?? null;
  if (homeId !== null && teamSet.has(homeId)) return true;
  if (awayId !== null && teamSet.has(awayId)) return true;
  return false;
}
