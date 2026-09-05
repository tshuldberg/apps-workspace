import type { League, LeagueId } from '../types';

/**
 * Static launch-league table. P1-A intentionally narrows scope to the
 * five leagues with the cleanest ESPN coverage and the most mainstream
 * team-following demand.
 *
 * Adding a league is a later-phase change -- do not expand this list
 * without a corresponding UIUX and release-state update.
 */
export const LAUNCH_LEAGUES: readonly League[] = [
  {
    id: 'nfl',
    label: 'NFL',
    sport: 'football',
    espnSport: 'football',
    espnLeague: 'nfl',
  },
  {
    id: 'nba',
    label: 'NBA',
    sport: 'basketball',
    espnSport: 'basketball',
    espnLeague: 'nba',
  },
  {
    id: 'mlb',
    label: 'MLB',
    sport: 'baseball',
    espnSport: 'baseball',
    espnLeague: 'mlb',
  },
  {
    id: 'nhl',
    label: 'NHL',
    sport: 'hockey',
    espnSport: 'hockey',
    espnLeague: 'nhl',
  },
  {
    id: 'mls',
    label: 'MLS',
    sport: 'soccer',
    espnSport: 'soccer',
    espnLeague: 'usa.1',
  },
] as const;

/** Fast lookup of league metadata by id. */
export function getLeagueById(id: LeagueId): League | undefined {
  return LAUNCH_LEAGUES.find((league) => league.id === id);
}

/** Build the ESPN team-index endpoint for a given league. */
export function buildTeamIndexUrl(league: League): string {
  return `https://site.api.espn.com/apis/site/v2/sports/${league.espnSport}/${league.espnLeague}/teams`;
}
