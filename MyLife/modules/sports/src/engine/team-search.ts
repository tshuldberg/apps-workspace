import type { League, LeagueId, TeamSearchResult } from '../types';
import { LAUNCH_LEAGUES, buildTeamIndexUrl, getLeagueById } from './leagues';

// ---------------------------------------------------------------------------
// ESPN response shape
//
// The ESPN teams endpoint returns:
//   { sports: [{ leagues: [{ teams: [{ team: {...} }, ...] }] }] }
// Each `team` has at minimum { id, displayName, abbreviation, logos[], color,
// alternateColor } and optionally { groups: { parent: { name }, name } } where
// `parent.name` is the conference and `name` is the division. Shape varies
// per league; map defensively.
// ---------------------------------------------------------------------------

interface EspnLogo {
  href?: string;
}

interface EspnGroup {
  name?: string;
  parent?: { name?: string };
}

interface EspnTeam {
  id?: string;
  displayName?: string;
  name?: string;
  abbreviation?: string;
  color?: string;
  alternateColor?: string;
  logos?: EspnLogo[];
  groups?: EspnGroup;
}

interface EspnTeamEntry {
  team?: EspnTeam;
}

interface EspnLeagueBlock {
  teams?: EspnTeamEntry[];
}

interface EspnSportBlock {
  leagues?: EspnLeagueBlock[];
}

interface EspnResponse {
  sports?: EspnSportBlock[];
}

// ---------------------------------------------------------------------------
// Fetch abstraction (injectable for tests)
// ---------------------------------------------------------------------------

export type TeamSearchFetch = (
  url: string,
  init: { signal?: AbortSignal },
) => Promise<EspnResponse>;

const defaultFetch: TeamSearchFetch = async (url, init) => {
  const response = await fetch(url, { signal: init.signal });
  if (!response.ok) {
    throw new Error(`ESPN request failed: ${response.status}`);
  }
  return (await response.json()) as EspnResponse;
};

// ---------------------------------------------------------------------------
// LRU cache (size-capped Map). Key: `${league}::${normalizedQuery}`. Value:
// the filtered result set so repeat queries are instant and cheap.
// ---------------------------------------------------------------------------

const CACHE_LIMIT = 50;

class LruCache<K, V> {
  private readonly map = new Map<K, V>();

  constructor(private readonly limit: number) {}

  get(key: K): V | undefined {
    if (!this.map.has(key)) return undefined;
    const value = this.map.get(key) as V;
    this.map.delete(key);
    this.map.set(key, value);
    return value;
  }

  set(key: K, value: V): void {
    if (this.map.has(key)) {
      this.map.delete(key);
    } else if (this.map.size >= this.limit) {
      const oldest = this.map.keys().next().value as K | undefined;
      if (oldest !== undefined) this.map.delete(oldest);
    }
    this.map.set(key, value);
  }

  clear(): void {
    this.map.clear();
  }

  get size(): number {
    return this.map.size;
  }
}

const searchCache = new LruCache<string, TeamSearchResult[]>(CACHE_LIMIT);

/** Test/debug helper -- clears the module-scoped search cache. */
export function clearTeamSearchCache(): void {
  searchCache.clear();
}

// ---------------------------------------------------------------------------
// Mapping helpers
// ---------------------------------------------------------------------------

function normalizeQuery(raw: string): string {
  return raw.trim().toLowerCase();
}

function extractTeams(json: EspnResponse): EspnTeam[] {
  const sports = json.sports ?? [];
  const out: EspnTeam[] = [];
  for (const sport of sports) {
    for (const league of sport.leagues ?? []) {
      for (const entry of league.teams ?? []) {
        if (entry.team) out.push(entry.team);
      }
    }
  }
  return out;
}

function mapTeam(raw: EspnTeam, league: League): TeamSearchResult | null {
  if (!raw.id) return null;
  const name = raw.displayName ?? raw.name;
  if (!name) return null;
  const logoUrl = raw.logos?.[0]?.href ?? null;
  const conference = raw.groups?.parent?.name ?? null;
  const division = raw.groups?.name ?? null;
  return {
    id: `espn:${league.id}:${raw.id}`,
    name,
    abbreviation: raw.abbreviation ?? null,
    league: league.id,
    sport: league.sport,
    conference,
    division,
    logoUrl,
    primaryColor: raw.color ? `#${raw.color}` : null,
    secondaryColor: raw.alternateColor ? `#${raw.alternateColor}` : null,
  };
}

function matchesQuery(team: TeamSearchResult, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  return (
    team.name.toLowerCase().includes(q) ||
    (team.abbreviation?.toLowerCase().includes(q) ?? false)
  );
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface SearchTeamsOptions {
  query: string;
  leagues?: LeagueId[];
  signal?: AbortSignal;
  fetchImpl?: TeamSearchFetch;
}

/**
 * Search for teams across the launch-league set. Fires one ESPN request
 * per league in parallel via `Promise.all`, caches per-league results in
 * an LRU map (size 50), and filters locally by the normalized query.
 *
 * Passing an `AbortSignal` cancels any in-flight request; the returned
 * promise rejects with the abort reason. Callers (UI) should supply a
 * fresh controller per keystroke and abort the previous one.
 */
export async function searchTeams(
  options: SearchTeamsOptions,
): Promise<TeamSearchResult[]> {
  const { query, signal, fetchImpl = defaultFetch } = options;
  const leaguesIds = options.leagues && options.leagues.length > 0
    ? options.leagues
    : LAUNCH_LEAGUES.map((l) => l.id);
  const leagues = leaguesIds
    .map((id) => getLeagueById(id))
    .filter((l): l is League => Boolean(l));

  const normalized = normalizeQuery(query);

  // Early-exit for very short queries to keep the initial search from
  // returning 150+ teams all at once and hammering ESPN on the first key.
  if (normalized.length < 2) return [];

  const perLeague = await Promise.all(
    leagues.map(async (league) => {
      const cacheKey = `${league.id}::all`;
      let teams = searchCache.get(cacheKey);
      if (!teams) {
        const url = buildTeamIndexUrl(league);
        const json = await fetchImpl(url, { signal });
        teams = extractTeams(json)
          .map((raw) => mapTeam(raw, league))
          .filter((t): t is TeamSearchResult => t !== null);
        searchCache.set(cacheKey, teams);
      }
      return teams;
    }),
  );

  const flat = perLeague.flat();
  return flat.filter((team) => matchesQuery(team, normalized));
}
