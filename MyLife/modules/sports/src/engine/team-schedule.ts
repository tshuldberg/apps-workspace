/**
 * Team schedule engine for the five launch leagues (NFL / NBA / MLB / NHL / MLS).
 *
 * Pure TS -- no React Query, no RN-specific APIs. Mirrors the `scores.ts` and
 * `standings.ts` patterns exactly (Promise.all-friendly, AbortSignal
 * propagation, TTL LRU cache).
 *
 * ESPN endpoint:
 *   `https://site.api.espn.com/apis/site/v2/sports/{sport}/{league}/teams/{teamId}/schedule`
 *
 * The team schedule payload uses the same `events[].competitions[0].competitors[]`
 * shape as the scoreboard endpoint, so mapping is largely identical. Scores
 * live on the competitor rows, and status + period come from the competition's
 * status type (or the event's status when the competition omits it).
 */
import type { Game, GameStatus, GameTeam, League, LeagueId } from '../types';
import { getLeagueById } from './leagues';

// ---------------------------------------------------------------------------
// ESPN schedule response shape (defensive subset)
// ---------------------------------------------------------------------------

interface EspnCompetitor {
  id?: string;
  homeAway?: 'home' | 'away';
  score?: string | { value?: number; displayValue?: string };
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

interface EspnScheduleResponse {
  events?: EspnEvent[];
  /**
   * Some schedule endpoints nest events under `team.nextEvent` /
   * `team.previousEvents`. Callers should prefer the top-level `events`
   * array when present; we only consume it and treat those fallbacks as
   * a future-proofing concern.
   */
  team?: unknown;
}

// ---------------------------------------------------------------------------
// Fetch abstraction (injectable for tests)
// ---------------------------------------------------------------------------

export type TeamScheduleFetch = (
  url: string,
  init: { signal?: AbortSignal },
) => Promise<EspnScheduleResponse>;

const defaultFetch: TeamScheduleFetch = async (url, init) => {
  const response = await fetch(url, { signal: init.signal });
  if (!response.ok) {
    throw new Error(`ESPN team schedule request failed: ${response.status}`);
  }
  return (await response.json()) as EspnScheduleResponse;
};

// ---------------------------------------------------------------------------
// Module-scoped TTL LRU cache keyed by `${league}:${teamId}`
// ---------------------------------------------------------------------------

export const TEAM_SCHEDULE_TTL_MS = 10 * 60 * 1_000;
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

const scheduleCache = new TtlLruCache(CACHE_LIMIT);

/** Test/debug helper -- clears the module-scoped team-schedule cache. */
export function clearTeamScheduleCache(): void {
  scheduleCache.clear();
}

// ---------------------------------------------------------------------------
// Normalization helpers
// ---------------------------------------------------------------------------

function buildScheduleUrl(league: League, teamExternalId: string): string {
  return `https://site.api.espn.com/apis/site/v2/sports/${league.espnSport}/${league.espnLeague}/teams/${teamExternalId}/schedule`;
}

function mapStatus(type?: EspnStatusType): GameStatus {
  const state = type?.state;
  if (state === 'in') return 'live';
  if (state === 'post' || type?.completed) return 'final';
  return 'scheduled';
}

function parseScore(
  raw: EspnCompetitor['score'] | undefined,
): number | null {
  if (raw === undefined || raw === null) return null;
  if (typeof raw === 'string') {
    if (raw === '') return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }
  if (typeof raw === 'object') {
    if (typeof raw.value === 'number' && Number.isFinite(raw.value)) {
      return raw.value;
    }
    if (typeof raw.displayValue === 'string' && raw.displayValue !== '') {
      const n = Number(raw.displayValue);
      return Number.isFinite(n) ? n : null;
    }
  }
  return null;
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

function extractExternalTeamId(teamId: string): string | null {
  // Stored ids are `espn:{league}:{externalId}`. Accept either the compound
  // or the raw external id (tests may pass raw ESPN ids for brevity).
  const parts = teamId.split(':');
  if (parts.length === 3 && parts[0] === 'espn') return parts[2];
  if (parts.length === 1) return teamId;
  return null;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface FetchTeamScheduleOptions {
  /** `espn:{league}:{externalId}` compound OR a raw ESPN team id. */
  teamId: string;
  league: LeagueId;
  signal?: AbortSignal;
  fetchImpl?: TeamScheduleFetch;
  /** Override clock for tests. */
  now?: number;
}

/**
 * Fetch the full schedule for a single team (upcoming + recent).
 *
 * Results are normalized into the shared `Game` shape so hosts can pipe
 * them straight into `upsertGames(db, result)` for cache consistency with
 * the scoreboard engine. Returns `[]` for unknown leagues or malformed
 * payloads.
 */
export async function fetchTeamSchedule(
  options: FetchTeamScheduleOptions,
): Promise<Game[]> {
  const { signal, fetchImpl = defaultFetch, now = Date.now() } = options;
  const league = getLeagueById(options.league);
  if (!league) return [];
  const externalId = extractExternalTeamId(options.teamId);
  if (!externalId) return [];

  const cacheKey = `${league.id}:${externalId}`;
  const cached = scheduleCache.get(cacheKey, now);
  if (cached) return cached;

  const url = buildScheduleUrl(league, externalId);
  const json = await fetchImpl(url, { signal });
  const events = json.events ?? [];
  const games = events
    .map((event) => mapEvent(event, league, now))
    .filter((g): g is Game => g !== null)
    .sort((a, b) => a.startAt - b.startAt);

  scheduleCache.set(cacheKey, games, now + TEAM_SCHEDULE_TTL_MS);
  return games;
}
