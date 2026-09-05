/**
 * Game detail engine for the five launch leagues (NFL / NBA / MLB / NHL / MLS).
 *
 * Pure TS -- no React Query, no RN-specific APIs. Mirrors the scoreboard /
 * standings / team-schedule engines (AbortSignal propagation, TTL LRU cache).
 *
 * ESPN endpoint:
 *   `https://site.api.espn.com/apis/site/v2/sports/{sport}/{league}/summary?event={gameId}`
 *
 * The `summary` response exposes a `header.competitions[0]` block that mirrors
 * the scoreboard shape (competitors, status, broadcast, venue) plus
 * `boxscore.players[]` leaders and `linescores[]` per-period breakdowns.
 *
 * Cache TTL is dynamic: 30s while the game is live, 1hr otherwise.
 */
import type {
  Game,
  GameDetail,
  GameLeader,
  GameStatus,
  GameTeam,
  League,
  LeagueId,
  PeriodScore,
} from '../types';
import { getLeagueById } from './leagues';

// ---------------------------------------------------------------------------
// ESPN summary response shape (defensive subset)
// ---------------------------------------------------------------------------

interface EspnLinescore {
  value?: number;
  displayValue?: string;
}

interface EspnScoreObject {
  value?: number;
  displayValue?: string;
}

interface EspnCompetitor {
  id?: string;
  homeAway?: 'home' | 'away';
  score?: string | EspnScoreObject;
  linescores?: EspnLinescore[];
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

interface EspnHeader {
  id?: string;
  season?: { year?: number };
  competitions?: EspnCompetition[];
}

interface EspnAthlete {
  displayName?: string;
  shortName?: string;
}

interface EspnLeaderRow {
  displayValue?: string;
  value?: number;
  athlete?: EspnAthlete;
}

interface EspnLeaderCategory {
  name?: string;
  displayName?: string;
  shortDisplayName?: string;
  leaders?: EspnLeaderRow[];
}

interface EspnBoxscorePlayerTeam {
  team?: { id?: string; homeAway?: 'home' | 'away' };
  leaders?: EspnLeaderCategory[];
}

interface EspnLeadersBlock {
  team?: { id?: string; homeAway?: 'home' | 'away' };
  leaders?: EspnLeaderCategory[];
}

interface EspnWeather {
  displayValue?: string;
  temperature?: number;
  conditionId?: string;
}

interface EspnSummaryResponse {
  header?: EspnHeader;
  boxscore?: { players?: EspnBoxscorePlayerTeam[] };
  leaders?: EspnLeadersBlock[];
  gameInfo?: { weather?: EspnWeather; venue?: EspnVenue };
  venue?: EspnVenue;
  weather?: EspnWeather;
}

// ---------------------------------------------------------------------------
// Fetch abstraction (injectable for tests)
// ---------------------------------------------------------------------------

export type GameDetailFetch = (
  url: string,
  init: { signal?: AbortSignal },
) => Promise<EspnSummaryResponse>;

const defaultFetch: GameDetailFetch = async (url, init) => {
  const response = await fetch(url, { signal: init.signal });
  if (!response.ok) {
    throw new Error(`ESPN summary request failed: ${response.status}`);
  }
  return (await response.json()) as EspnSummaryResponse;
};

// ---------------------------------------------------------------------------
// Module-scoped TTL LRU cache keyed by the compound game id.
// TTL is dynamic: live games refresh aggressively, final/scheduled games sit.
// ---------------------------------------------------------------------------

export const GAME_DETAIL_LIVE_TTL_MS = 30 * 1_000;
export const GAME_DETAIL_IDLE_TTL_MS = 60 * 60 * 1_000;
const CACHE_LIMIT = 50;

interface CacheEntry {
  expiresAt: number;
  detail: GameDetail;
}

class TtlLruCache {
  private readonly map = new Map<string, CacheEntry>();

  constructor(private readonly limit: number) {}

  get(key: string, now: number): GameDetail | undefined {
    const entry = this.map.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= now) {
      this.map.delete(key);
      return undefined;
    }
    this.map.delete(key);
    this.map.set(key, entry);
    return entry.detail;
  }

  set(key: string, detail: GameDetail, expiresAt: number): void {
    if (this.map.has(key)) {
      this.map.delete(key);
    } else if (this.map.size >= this.limit) {
      const oldest = this.map.keys().next().value as string | undefined;
      if (oldest !== undefined) this.map.delete(oldest);
    }
    this.map.set(key, { expiresAt, detail });
  }

  clear(): void {
    this.map.clear();
  }

  get size(): number {
    return this.map.size;
  }
}

const detailCache = new TtlLruCache(CACHE_LIMIT);

/** Test/debug helper -- clears the module-scoped game-detail cache. */
export function clearGameDetailCache(): void {
  detailCache.clear();
}

/** Picks the right TTL window based on the game's current live/final state. */
export function pickGameDetailTtl(status: GameStatus): number {
  return status === 'live' ? GAME_DETAIL_LIVE_TTL_MS : GAME_DETAIL_IDLE_TTL_MS;
}

// ---------------------------------------------------------------------------
// Normalization helpers
// ---------------------------------------------------------------------------

function buildSummaryUrl(league: League, externalEventId: string): string {
  return `https://site.api.espn.com/apis/site/v2/sports/${league.espnSport}/${league.espnLeague}/summary?event=${externalEventId}`;
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

function mapLinescores(
  home: EspnCompetitor | undefined,
  away: EspnCompetitor | undefined,
): PeriodScore[] {
  const homeLines = home?.linescores ?? [];
  const awayLines = away?.linescores ?? [];
  const len = Math.max(homeLines.length, awayLines.length);
  const out: PeriodScore[] = [];
  for (let i = 0; i < len; i++) {
    const h = homeLines[i];
    const a = awayLines[i];
    const hScore =
      typeof h?.value === 'number' && Number.isFinite(h.value) ? h.value : 0;
    const aScore =
      typeof a?.value === 'number' && Number.isFinite(a.value) ? a.value : 0;
    out.push({ period: i + 1, homeScore: hScore, awayScore: aScore });
  }
  return out;
}

function categoryLabel(cat: EspnLeaderCategory): string {
  return (
    cat.displayName ??
    cat.shortDisplayName ??
    cat.name ??
    'Leader'
  );
}

function firstLeader(cat: EspnLeaderCategory): EspnLeaderRow | undefined {
  return cat.leaders?.[0];
}

function resolveTeamSide(
  block: { team?: { id?: string; homeAway?: 'home' | 'away' } },
  homeId: string | null,
  awayId: string | null,
): 'home' | 'away' | null {
  const side = block.team?.homeAway;
  if (side === 'home' || side === 'away') return side;
  const id = block.team?.id;
  if (!id) return null;
  if (homeId && id === homeId) return 'home';
  if (awayId && id === awayId) return 'away';
  return null;
}

function mapLeaders(
  summary: EspnSummaryResponse,
  homeCompetitor: EspnCompetitor | undefined,
  awayCompetitor: EspnCompetitor | undefined,
): GameLeader[] {
  const homeId = homeCompetitor?.team?.id ?? null;
  const awayId = awayCompetitor?.team?.id ?? null;
  const out: GameLeader[] = [];

  const blocks: Array<{
    team?: { id?: string; homeAway?: 'home' | 'away' };
    leaders?: EspnLeaderCategory[];
  }> = [];
  if (summary.leaders) blocks.push(...summary.leaders);
  if (summary.boxscore?.players) blocks.push(...summary.boxscore.players);

  for (const block of blocks) {
    const side = resolveTeamSide(block, homeId, awayId);
    if (!side) continue;
    for (const cat of block.leaders ?? []) {
      const leader = firstLeader(cat);
      if (!leader) continue;
      const displayValue = leader.displayValue ?? null;
      if (!displayValue) continue;
      out.push({
        teamSide: side,
        category: categoryLabel(cat),
        displayValue,
        athleteName:
          leader.athlete?.displayName ?? leader.athlete?.shortName ?? null,
      });
    }
  }
  return out;
}

function mapWeather(summary: EspnSummaryResponse): string | null {
  const w = summary.gameInfo?.weather ?? summary.weather;
  if (!w) return null;
  if (w.displayValue && w.displayValue.trim().length > 0) return w.displayValue;
  if (typeof w.temperature === 'number') {
    return `${w.temperature}\u00b0`;
  }
  return null;
}

function extractExternalGameId(gameId: string): string | null {
  // Stored ids are `espn:{league}:{externalId}`. Accept either the compound
  // or the raw external id.
  const parts = gameId.split(':');
  if (parts.length === 3 && parts[0] === 'espn') return parts[2];
  if (parts.length === 1) return gameId;
  return null;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface FetchGameDetailOptions {
  /** `espn:{league}:{externalId}` compound OR a raw ESPN event id. */
  gameId: string;
  league: LeagueId;
  signal?: AbortSignal;
  fetchImpl?: GameDetailFetch;
  /** Override clock for tests. */
  now?: number;
}

/**
 * Fetch detailed box-score data for a single game. Returns `null` when the
 * payload is missing a usable header (malformed response or unknown id).
 * On live games the cache entry expires after 30s; otherwise it sits for 1hr.
 */
export async function fetchGameDetail(
  options: FetchGameDetailOptions,
): Promise<GameDetail | null> {
  const { signal, fetchImpl = defaultFetch, now = Date.now() } = options;
  const league = getLeagueById(options.league);
  if (!league) return null;
  const externalId = extractExternalGameId(options.gameId);
  if (!externalId) return null;

  const compoundId = `espn:${league.id}:${externalId}`;
  const cached = detailCache.get(compoundId, now);
  if (cached) return cached;

  const url = buildSummaryUrl(league, externalId);
  const json = await fetchImpl(url, { signal });
  const header = json.header;
  const competition = header?.competitions?.[0];
  if (!header?.id || !competition) return null;

  const homeComp = pickByHomeAway(competition.competitors, 'home');
  const awayComp = pickByHomeAway(competition.competitors, 'away');
  const home = mapCompetitor(homeComp);
  const away = mapCompetitor(awayComp);
  if (!home || !away) return null;

  const status = mapStatus(competition.status?.type);
  const periods = mapLinescores(homeComp, awayComp);
  const leaders = mapLeaders(json, homeComp, awayComp);
  const venue =
    competition.venue?.fullName ??
    json.gameInfo?.venue?.fullName ??
    json.venue?.fullName ??
    null;

  const base: Game = {
    id: compoundId,
    league: league.id,
    sport: league.sport,
    home,
    away,
    status,
    period:
      competition.status?.type?.shortDetail ??
      competition.status?.type?.description ??
      null,
    clock: competition.status?.displayClock ?? null,
    // Summary rarely echoes a startAt; fall back to now so the row is
    // write-safe if ever piped into upsertGames. UI should never read this
    // field from GameDetail -- the scoreboard/schedule fetches own it.
    startAt: now,
    venue,
    broadcast: mapBroadcast(competition.broadcasts),
    updatedAt: now,
  };

  const detail: GameDetail = {
    ...base,
    periods,
    leaders: leaders.length > 0 ? leaders : null,
    weather: mapWeather(json),
  };

  const ttl = pickGameDetailTtl(detail.status);
  detailCache.set(compoundId, detail, now + ttl);
  return detail;
}
