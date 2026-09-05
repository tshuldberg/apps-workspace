/**
 * Play-by-play timeline engine for the five launch leagues.
 *
 * Pure TS -- no React Query, no RN-specific APIs, no expo imports. Mirrors
 * the `game-detail.ts` / `team-schedule.ts` / `scores.ts` engine shape
 * exactly (AbortSignal propagation, injectable fetch, TTL LRU cache).
 *
 * ESPN endpoint (same as game-detail):
 *   `https://site.api.espn.com/apis/site/v2/sports/{sport}/{league}/summary?event={gameId}`
 *
 * The ESPN summary response exposes plays in one of three shapes depending
 * on the league:
 *   - Top-level `plays[]` (NBA, MLB, NHL, MLS typical)
 *   - Nested under `drives.previous[].plays[]` + `drives.current.plays[]` (NFL)
 *   - As `scoringPlays[]` fallback (all leagues, scoring events only)
 *
 * We normalize all three into one generic `TimelineEvent` shape. Sport-specific
 * flavor (down + distance, inning half, minute, power play) lives in the
 * `description` string -- the UI never branches per sport.
 *
 * Sort order is canonicalized to **newest-first** (most recent event at
 * index 0) so UI can render without re-sorting and scroll-to-top shows
 * the freshest action.
 *
 * Cache TTL is dynamic:
 *   - live games: 10s (plays update more aggressively than box score)
 *   - final / scheduled games: 1hr
 */
import type { GameStatus, League, LeagueId } from '../types';
import { getLeagueById } from './leagues';

// ---------------------------------------------------------------------------
// ESPN summary response shape (plays subset -- defensive)
// ---------------------------------------------------------------------------

interface EspnPeriod {
  number?: number;
  type?: string;
  displayValue?: string;
}

interface EspnClock {
  displayValue?: string;
  value?: number;
}

interface EspnPlayTeam {
  id?: string;
}

interface EspnPlayType {
  id?: string;
  text?: string;
  abbreviation?: string;
}

interface EspnPlay {
  id?: string | number;
  sequenceNumber?: string | number;
  type?: EspnPlayType;
  text?: string;
  shortText?: string;
  alternativeText?: string;
  scoringPlay?: boolean;
  scoreValue?: number;
  period?: EspnPeriod;
  clock?: EspnClock;
  team?: EspnPlayTeam;
  homeScore?: number;
  awayScore?: number;
}

interface EspnDrive {
  plays?: EspnPlay[];
}

interface EspnDrivesBlock {
  previous?: EspnDrive[];
  current?: EspnDrive;
}

interface EspnCompetitorLite {
  id?: string;
  homeAway?: 'home' | 'away';
  team?: { id?: string; homeAway?: 'home' | 'away' };
}

interface EspnCompetitionLite {
  competitors?: EspnCompetitorLite[];
}

interface EspnHeaderLite {
  id?: string;
  competitions?: EspnCompetitionLite[];
}

interface EspnSummaryPlaysResponse {
  header?: EspnHeaderLite;
  plays?: EspnPlay[];
  drives?: EspnDrivesBlock;
  scoringPlays?: EspnPlay[];
}

// ---------------------------------------------------------------------------
// Public TimelineEvent shape (mirrored in `../types.ts` TimelineEventSchema)
// ---------------------------------------------------------------------------

export type TimelineEventType =
  | 'score'
  | 'big_play'
  | 'penalty'
  | 'substitution'
  | 'period_boundary'
  | 'timeout'
  | 'other';

// Re-exported from types.ts as authoritative. Kept here as a comment for
// reference; consumers should import from '../types'.

// ---------------------------------------------------------------------------
// Fetch abstraction (injectable for tests)
// ---------------------------------------------------------------------------

export type GameTimelineFetch = (
  url: string,
  init: { signal?: AbortSignal },
) => Promise<EspnSummaryPlaysResponse>;

const defaultFetch: GameTimelineFetch = async (url, init) => {
  const response = await fetch(url, { signal: init.signal });
  if (!response.ok) {
    throw new Error(`ESPN summary request failed: ${response.status}`);
  }
  return (await response.json()) as EspnSummaryPlaysResponse;
};

// ---------------------------------------------------------------------------
// Module-scoped TTL LRU cache keyed by the compound game id.
// ---------------------------------------------------------------------------

export const TIMELINE_LIVE_TTL_MS = 10 * 1_000;
export const TIMELINE_FINAL_TTL_MS = 60 * 60 * 1_000;
const CACHE_LIMIT = 50;

// TimelineEvent is imported from types.ts to keep the Zod schema + TS type
// in a single source of truth without introducing a circular import.
import type { TimelineEvent } from '../types';

interface CacheEntry {
  expiresAt: number;
  events: TimelineEvent[];
}

class TtlLruCache {
  private readonly map = new Map<string, CacheEntry>();

  constructor(private readonly limit: number) {}

  get(key: string, now: number): TimelineEvent[] | undefined {
    const entry = this.map.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= now) {
      this.map.delete(key);
      return undefined;
    }
    this.map.delete(key);
    this.map.set(key, entry);
    return entry.events;
  }

  set(key: string, events: TimelineEvent[], expiresAt: number): void {
    if (this.map.has(key)) {
      this.map.delete(key);
    } else if (this.map.size >= this.limit) {
      const oldest = this.map.keys().next().value as string | undefined;
      if (oldest !== undefined) this.map.delete(oldest);
    }
    this.map.set(key, { expiresAt, events });
  }

  clear(): void {
    this.map.clear();
  }

  get size(): number {
    return this.map.size;
  }
}

const timelineCache = new TtlLruCache(CACHE_LIMIT);

/** Test/debug helper -- clears the module-scoped timeline cache. */
export function clearGameTimelineCache(): void {
  timelineCache.clear();
}

/** Picks the right TTL window based on the game's current live/final state. */
export function pickTimelineTtl(status: GameStatus): number {
  return status === 'live' ? TIMELINE_LIVE_TTL_MS : TIMELINE_FINAL_TTL_MS;
}

// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------

function buildSummaryUrl(league: League, externalEventId: string): string {
  return `https://site.api.espn.com/apis/site/v2/sports/${league.espnSport}/${league.espnLeague}/summary?event=${externalEventId}`;
}

function extractExternalGameId(gameId: string): string | null {
  const parts = gameId.split(':');
  if (parts.length === 3 && parts[0] === 'espn') return parts[2];
  if (parts.length === 1) return gameId;
  return null;
}

function homeAwayIndex(
  header: EspnHeaderLite | undefined,
): { homeId: string | null; awayId: string | null } {
  const comps = header?.competitions?.[0]?.competitors ?? [];
  let homeId: string | null = null;
  let awayId: string | null = null;
  for (const c of comps) {
    const side = c.homeAway ?? c.team?.homeAway;
    const id = c.id ?? c.team?.id ?? null;
    if (side === 'home') homeId = id;
    if (side === 'away') awayId = id;
  }
  return { homeId, awayId };
}

function mapTeamSide(
  teamId: string | null | undefined,
  homeId: string | null,
  awayId: string | null,
): 'home' | 'away' | null {
  if (!teamId) return null;
  if (homeId && teamId === homeId) return 'home';
  if (awayId && teamId === awayId) return 'away';
  return null;
}

const BIG_PLAY_PATTERN =
  /\b(touchdown|home run|goal|slam dunk|grand slam|hat trick|intercept(?:ed|ion)?|fumble|safety)\b/i;
const PENALTY_PATTERN = /\b(penalty|foul|flagrant|technical|yellow card|red card|booking)\b/i;
const SUBSTITUTION_PATTERN = /\b(substitut|subbed|enters the game|line change)\b/i;
const TIMEOUT_PATTERN = /\btimeout\b/i;
const PERIOD_BOUNDARY_PATTERN =
  /\b(end of (?:the )?(?:1st|2nd|3rd|4th|first|second|third|fourth)|end of period|end of quarter|end of half|halftime|end of inning|end of regulation)\b/i;

function classifyPlay(play: EspnPlay): TimelineEventType {
  if (play.scoringPlay === true || typeof play.scoreValue === 'number') {
    return 'score';
  }
  const typeText = (play.type?.text ?? '').toLowerCase();
  const description = play.text ?? play.shortText ?? play.alternativeText ?? '';
  const joined = `${typeText} ${description}`.toLowerCase();

  if (PERIOD_BOUNDARY_PATTERN.test(joined)) return 'period_boundary';
  if (TIMEOUT_PATTERN.test(joined)) return 'timeout';
  if (PENALTY_PATTERN.test(joined)) return 'penalty';
  if (SUBSTITUTION_PATTERN.test(joined)) return 'substitution';
  if (BIG_PLAY_PATTERN.test(joined)) return 'big_play';
  return 'other';
}

function describePlay(play: EspnPlay): string {
  const base = play.text ?? play.alternativeText ?? play.shortText ?? '';
  if (base.trim().length > 0) return base.trim();
  // Last-resort label so the row is never empty.
  return play.type?.text ?? 'Play';
}

function periodLabel(period: EspnPeriod | undefined): number | string {
  if (period?.displayValue && period.displayValue.trim().length > 0) {
    return period.displayValue;
  }
  if (typeof period?.number === 'number' && Number.isFinite(period.number)) {
    return period.number;
  }
  return 0;
}

function clockLabel(clock: EspnClock | undefined): string | null {
  if (clock?.displayValue && clock.displayValue.trim().length > 0) {
    return clock.displayValue;
  }
  return null;
}

function playId(play: EspnPlay, fallbackIdx: number): string {
  if (play.id !== undefined && play.id !== null) return String(play.id);
  if (play.sequenceNumber !== undefined && play.sequenceNumber !== null) {
    return String(play.sequenceNumber);
  }
  return `play-${fallbackIdx}`;
}

function flattenPlays(json: EspnSummaryPlaysResponse): EspnPlay[] {
  if (Array.isArray(json.plays) && json.plays.length > 0) return json.plays;
  const collected: EspnPlay[] = [];
  const drives = json.drives;
  if (drives) {
    if (drives.previous) {
      for (const drive of drives.previous) {
        if (drive.plays) collected.push(...drive.plays);
      }
    }
    if (drives.current?.plays) collected.push(...drives.current.plays);
  }
  if (collected.length > 0) return collected;
  if (Array.isArray(json.scoringPlays) && json.scoringPlays.length > 0) {
    return json.scoringPlays;
  }
  return [];
}

function mapPlay(
  play: EspnPlay,
  idx: number,
  gameId: string,
  homeId: string | null,
  awayId: string | null,
): TimelineEvent | null {
  const id = playId(play, idx);
  const description = describePlay(play);
  if (!description) return null;
  const type = classifyPlay(play);
  const teamSide = mapTeamSide(play.team?.id ?? null, homeId, awayId);
  return {
    id,
    gameId,
    period: periodLabel(play.period),
    clock: clockLabel(play.clock),
    team: teamSide,
    type,
    scoreValue:
      typeof play.scoreValue === 'number' && Number.isFinite(play.scoreValue)
        ? play.scoreValue
        : null,
    description,
    isScoring: play.scoringPlay === true || typeof play.scoreValue === 'number',
    awayScoreAfter:
      typeof play.awayScore === 'number' && Number.isFinite(play.awayScore)
        ? play.awayScore
        : null,
    homeScoreAfter:
      typeof play.homeScore === 'number' && Number.isFinite(play.homeScore)
        ? play.homeScore
        : null,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface FetchGameTimelineOptions {
  /** `espn:{league}:{externalId}` compound OR a raw ESPN event id. */
  gameId: string;
  league: LeagueId;
  /**
   * Caller-provided status. Drives TTL selection (live=10s, else 1hr) so
   * the cache aligns with how aggressively the UI is polling.
   */
  status: GameStatus;
  signal?: AbortSignal;
  fetchImpl?: GameTimelineFetch;
  /** Override clock for tests. */
  now?: number;
}

/**
 * Fetch the play-by-play timeline for a single game.
 *
 * Returns a newest-first `TimelineEvent[]`. When the summary payload does
 * not expose plays in any of the three recognized shapes, returns `[]` so
 * the UI can show an empty-state without a crash.
 *
 * Cache key is the compound `espn:{league}:{externalId}` id. TTL is 10s for
 * live games, 1hr otherwise.
 */
export async function fetchGameTimeline(
  options: FetchGameTimelineOptions,
): Promise<TimelineEvent[]> {
  const { signal, fetchImpl = defaultFetch, now = Date.now() } = options;
  const league = getLeagueById(options.league);
  if (!league) return [];
  const externalId = extractExternalGameId(options.gameId);
  if (!externalId) return [];

  const compoundId = `espn:${league.id}:${externalId}`;
  const cached = timelineCache.get(compoundId, now);
  if (cached) return cached;

  const url = buildSummaryUrl(league, externalId);
  const json = await fetchImpl(url, { signal });
  const { homeId, awayId } = homeAwayIndex(json.header);

  const rawPlays = flattenPlays(json);
  const mapped: TimelineEvent[] = [];
  for (let i = 0; i < rawPlays.length; i++) {
    const ev = mapPlay(rawPlays[i]!, i, compoundId, homeId, awayId);
    if (ev) mapped.push(ev);
  }

  // Canonicalize to newest-first. ESPN returns NFL drives chronologically
  // and scoreboard-style plays reverse-chronologically; we force one order
  // so the UI never has to re-sort.
  const events = mapped.reverse();

  const ttl = pickTimelineTtl(options.status);
  timelineCache.set(compoundId, events, now + ttl);
  return events;
}
