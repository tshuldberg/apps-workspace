/**
 * Standings engine for the five launch leagues (NFL / NBA / MLB / NHL / MLS).
 *
 * Pure TS -- no React Query, no RN-specific APIs. Mirrors the `scores.ts`
 * pattern exactly (Promise.all fan-out, AbortSignal propagation, TTL LRU).
 * No new migration: standings are small, slow-moving, and cheap to re-fetch,
 * so we cache in memory with a 1 hour TTL.
 *
 * ESPN endpoint: `https://site.api.espn.com/apis/v2/sports/{sport}/{league}/standings?level=3`
 * At level=3 every launch league returns a top-level `children` array:
 *   - NFL/NBA/MLB/NHL: conference -> division -> entries
 *   - MLS:             conference -> entries (no divisions)
 */
import type { LeagueId, League, StandingGroup, StandingRow } from '../types';
import { LAUNCH_LEAGUES, getLeagueById } from './leagues';

export type { StandingGroup, StandingRow } from '../types';

// ---------------------------------------------------------------------------
// ESPN standings response shape (defensive subset)
// ---------------------------------------------------------------------------

interface EspnStat {
  name?: string;
  value?: number;
  displayValue?: string;
}

interface EspnEntryTeam {
  id?: string;
  displayName?: string;
  shortDisplayName?: string;
  name?: string;
  abbreviation?: string;
}

interface EspnEntry {
  team?: EspnEntryTeam;
  stats?: EspnStat[];
}

interface EspnStandingsBlock {
  entries?: EspnEntry[];
}

interface EspnGroup {
  name?: string;
  abbreviation?: string;
  children?: EspnGroup[];
  standings?: EspnStandingsBlock;
}

interface EspnStandingsResponse {
  name?: string;
  children?: EspnGroup[];
}

// ---------------------------------------------------------------------------
// Fetch abstraction (injectable for tests)
// ---------------------------------------------------------------------------

export type StandingsFetch = (
  url: string,
  init: { signal?: AbortSignal },
) => Promise<EspnStandingsResponse>;

const defaultFetch: StandingsFetch = async (url, init) => {
  const response = await fetch(url, { signal: init.signal });
  if (!response.ok) {
    throw new Error(`ESPN standings request failed: ${response.status}`);
  }
  return (await response.json()) as EspnStandingsResponse;
};

// ---------------------------------------------------------------------------
// Module-scoped TTL LRU cache keyed by `${league}`
// ---------------------------------------------------------------------------

export const STANDINGS_TTL_MS = 60 * 60 * 1_000;
const CACHE_LIMIT = 10;

interface CacheEntry {
  expiresAt: number;
  groups: StandingGroup[];
}

class TtlLruCache {
  private readonly map = new Map<string, CacheEntry>();

  constructor(private readonly limit: number) {}

  get(key: string, now: number): StandingGroup[] | undefined {
    const entry = this.map.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= now) {
      this.map.delete(key);
      return undefined;
    }
    this.map.delete(key);
    this.map.set(key, entry);
    return entry.groups;
  }

  set(key: string, groups: StandingGroup[], expiresAt: number): void {
    if (this.map.has(key)) {
      this.map.delete(key);
    } else if (this.map.size >= this.limit) {
      const oldest = this.map.keys().next().value as string | undefined;
      if (oldest !== undefined) this.map.delete(oldest);
    }
    this.map.set(key, { expiresAt, groups });
  }

  clear(): void {
    this.map.clear();
  }

  get size(): number {
    return this.map.size;
  }
}

const standingsCache = new TtlLruCache(CACHE_LIMIT);

/** Test/debug helper -- clears the module-scoped standings cache. */
export function clearStandingsCache(): void {
  standingsCache.clear();
}

// ---------------------------------------------------------------------------
// Normalization helpers
// ---------------------------------------------------------------------------

function buildStandingsUrl(league: League): string {
  return `https://site.api.espn.com/apis/v2/sports/${league.espnSport}/${league.espnLeague}/standings?level=3`;
}

function pickStat(stats: EspnStat[] | undefined, name: string): EspnStat | undefined {
  if (!stats) return undefined;
  return stats.find((s) => s.name === name);
}

function statNumber(stats: EspnStat[] | undefined, name: string): number {
  const s = pickStat(stats, name);
  const v = s?.value;
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

function statNumberNullable(
  stats: EspnStat[] | undefined,
  name: string,
): number | null {
  const s = pickStat(stats, name);
  const v = s?.value;
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function statDisplayNullable(
  stats: EspnStat[] | undefined,
  name: string,
): string | null {
  const s = pickStat(stats, name);
  const d = s?.displayValue;
  return typeof d === 'string' && d.length > 0 ? d : null;
}

function mapEntry(entry: EspnEntry, league: LeagueId): StandingRow | null {
  const team = entry.team;
  const externalId = team?.id;
  const name =
    team?.displayName ?? team?.shortDisplayName ?? team?.name ?? team?.abbreviation;
  if (!externalId || !name) return null;

  const wins = statNumber(entry.stats, 'wins');
  const losses = statNumber(entry.stats, 'losses');
  const ties = statNumber(entry.stats, 'ties');
  const winPct =
    statNumberNullable(entry.stats, 'winPercent') ??
    (wins + losses + ties > 0 ? wins / (wins + losses + ties) : 0);

  return {
    teamId: `espn:${league}:${externalId}`,
    teamName: name,
    teamAbbreviation: team?.abbreviation ?? null,
    wins,
    losses,
    ties,
    winPct,
    gamesBack: statNumberNullable(entry.stats, 'gamesBehind'),
    streak: statDisplayNullable(entry.stats, 'streak'),
    pointsFor: statNumberNullable(entry.stats, 'pointsFor'),
    pointsAgainst: statNumberNullable(entry.stats, 'pointsAgainst'),
  };
}

function sortRows(rows: StandingRow[]): StandingRow[] {
  return [...rows].sort((a, b) => {
    if (b.winPct !== a.winPct) return b.winPct - a.winPct;
    return b.wins - a.wins;
  });
}

function collectGroups(
  league: LeagueId,
  conferences: EspnGroup[] | undefined,
): StandingGroup[] {
  if (!conferences || conferences.length === 0) return [];
  const out: StandingGroup[] = [];
  for (const conf of conferences) {
    const confName = conf.name ?? null;
    const divisions = conf.children;
    if (divisions && divisions.length > 0) {
      // Conference -> divisions -> entries (NFL/NBA/MLB/NHL at level=3).
      for (const div of divisions) {
        const entries = div.standings?.entries ?? [];
        const rows = entries
          .map((e) => mapEntry(e, league))
          .filter((r): r is StandingRow => r !== null);
        if (rows.length === 0) continue;
        out.push({
          league,
          conference: confName,
          division: div.name ?? null,
          rows: sortRows(rows),
        });
      }
    } else {
      // Conference -> entries (MLS, or any league without division groupings).
      const entries = conf.standings?.entries ?? [];
      const rows = entries
        .map((e) => mapEntry(e, league))
        .filter((r): r is StandingRow => r !== null);
      if (rows.length === 0) continue;
      out.push({
        league,
        conference: confName,
        division: null,
        rows: sortRows(rows),
      });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface FetchStandingsOptions {
  league: LeagueId;
  signal?: AbortSignal;
  fetchImpl?: StandingsFetch;
  /** Override clock for tests. */
  now?: number;
}

/**
 * Fetch standings for a single league. Cached per league with a 1hr TTL.
 */
export async function fetchStandings(
  options: FetchStandingsOptions,
): Promise<StandingGroup[]> {
  const { signal, fetchImpl = defaultFetch, now = Date.now() } = options;
  const league = getLeagueById(options.league);
  if (!league) return [];

  const key = league.id;
  const cached = standingsCache.get(key, now);
  if (cached) return cached;

  const url = buildStandingsUrl(league);
  const json = await fetchImpl(url, { signal });
  const groups = collectGroups(league.id, json.children);
  standingsCache.set(key, groups, now + STANDINGS_TTL_MS);
  return groups;
}

export interface FetchStandingsForLeaguesOptions {
  leagues?: LeagueId[];
  signal?: AbortSignal;
  fetchImpl?: StandingsFetch;
  now?: number;
}

/**
 * Fetch standings for multiple leagues in parallel. Returns a map keyed by
 * league id. Convenience wrapper for the "My Season Records" strip which
 * spans the unique set of leagues the user follows.
 */
export async function fetchStandingsForLeagues(
  options: FetchStandingsForLeaguesOptions = {},
): Promise<Record<string, StandingGroup[]>> {
  const leagueIds =
    options.leagues && options.leagues.length > 0
      ? options.leagues
      : LAUNCH_LEAGUES.map((l) => l.id);
  const entries = await Promise.all(
    leagueIds.map(async (id) => {
      const groups = await fetchStandings({
        league: id,
        signal: options.signal,
        fetchImpl: options.fetchImpl,
        now: options.now,
      });
      return [id, groups] as const;
    }),
  );
  const out: Record<string, StandingGroup[]> = {};
  for (const [id, groups] of entries) out[id] = groups;
  return out;
}

/**
 * Find the standing row for a specific team across a set of groups. Returns
 * null when the team isn't present in the supplied standings.
 */
export function findTeamRecord(
  groups: readonly StandingGroup[],
  teamId: string,
): StandingRow | null {
  for (const group of groups) {
    for (const row of group.rows) {
      if (row.teamId === teamId) return row;
    }
  }
  return null;
}
