import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  clearTeamSearchCache,
  searchTeams,
  type TeamSearchFetch,
} from '../engine/team-search';
import type { LeagueId } from '../types';

// ---------------------------------------------------------------------------
// ESPN response fixtures. Shape mirrors:
//   {
//     sports: [{
//       leagues: [{
//         teams: [{
//           team: { id, displayName, abbreviation, color, alternateColor,
//                   logos: [{ href }], groups: { name, parent: { name } } }
//         }]
//       }]
//     }]
//   }
// ---------------------------------------------------------------------------

function espnFixture(
  league: LeagueId,
  teams: Array<{
    id: string;
    displayName: string;
    abbreviation?: string;
    color?: string;
    alternateColor?: string;
    logo?: string;
    conference?: string;
    division?: string;
  }>,
): unknown {
  return {
    sports: [
      {
        leagues: [
          {
            name: league,
            teams: teams.map((t) => ({
              team: {
                id: t.id,
                displayName: t.displayName,
                abbreviation: t.abbreviation,
                color: t.color,
                alternateColor: t.alternateColor,
                logos: t.logo ? [{ href: t.logo }] : [],
                groups: t.division
                  ? { name: t.division, parent: { name: t.conference } }
                  : undefined,
              },
            })),
          },
        ],
      },
    ],
  };
}

function makeFetch(
  fixtures: Partial<Record<string, unknown>>,
): TeamSearchFetch {
  return vi.fn(async (url: string) => {
    for (const key of Object.keys(fixtures)) {
      if (url.includes(key)) {
        return fixtures[key] as Awaited<ReturnType<TeamSearchFetch>>;
      }
    }
    return { sports: [] };
  });
}

describe('searchTeams', () => {
  afterEach(() => {
    clearTeamSearchCache();
  });

  it('returns [] for queries shorter than two characters', async () => {
    const result = await searchTeams({ query: 'a', fetchImpl: vi.fn() });
    expect(result).toEqual([]);
  });

  it('fans out across the five leagues in parallel and filters by name', async () => {
    const fetchImpl = makeFetch({
      '/football/nfl/teams': espnFixture('nfl', [
        {
          id: '6',
          displayName: 'Dallas Cowboys',
          abbreviation: 'DAL',
          color: '041E42',
          alternateColor: '869397',
          logo: 'https://a.espncdn.com/i/teamlogos/nfl/500/dal.png',
          conference: 'NFC',
          division: 'NFC East',
        },
      ]),
      '/basketball/nba/teams': espnFixture('nba', [
        { id: '6', displayName: 'Dallas Mavericks', abbreviation: 'DAL' },
        { id: '11', displayName: 'Indiana Pacers', abbreviation: 'IND' },
      ]),
      '/baseball/mlb/teams': espnFixture('mlb', []),
      '/hockey/nhl/teams': espnFixture('nhl', [
        { id: '25', displayName: 'Dallas Stars', abbreviation: 'DAL' },
      ]),
      '/soccer/usa.1/teams': espnFixture('mls', []),
    });

    const result = await searchTeams({ query: 'dallas', fetchImpl });
    const ids = result.map((t) => t.id).sort();
    expect(ids).toEqual(['espn:nba:6', 'espn:nfl:6', 'espn:nhl:25']);
    expect(fetchImpl).toHaveBeenCalledTimes(5);
  });

  it('maps ESPN fields into the TeamSearchResult shape', async () => {
    const fetchImpl = makeFetch({
      '/football/nfl/teams': espnFixture('nfl', [
        {
          id: '6',
          displayName: 'Dallas Cowboys',
          abbreviation: 'DAL',
          color: '041E42',
          alternateColor: '869397',
          logo: 'https://a.espncdn.com/i/teamlogos/nfl/500/dal.png',
          conference: 'NFC',
          division: 'NFC East',
        },
      ]),
    });
    const [team] = await searchTeams({
      query: 'cowboys',
      leagues: ['nfl'],
      fetchImpl,
    });
    expect(team).toEqual({
      id: 'espn:nfl:6',
      name: 'Dallas Cowboys',
      abbreviation: 'DAL',
      league: 'nfl',
      sport: 'football',
      conference: 'NFC',
      division: 'NFC East',
      logoUrl: 'https://a.espncdn.com/i/teamlogos/nfl/500/dal.png',
      primaryColor: '#041E42',
      secondaryColor: '#869397',
    });
  });

  it('is defensive about missing conference/division/logo/color fields', async () => {
    const fetchImpl = makeFetch({
      '/soccer/usa.1/teams': espnFixture('mls', [
        { id: '189', displayName: 'Los Angeles FC' },
      ]),
    });
    const [team] = await searchTeams({
      query: 'angeles',
      leagues: ['mls'],
      fetchImpl,
    });
    expect(team.conference).toBeNull();
    expect(team.division).toBeNull();
    expect(team.logoUrl).toBeNull();
    expect(team.primaryColor).toBeNull();
    expect(team.secondaryColor).toBeNull();
  });

  it('caches per-league results so repeat queries skip the network', async () => {
    const fetchImpl = makeFetch({
      '/basketball/nba/teams': espnFixture('nba', [
        { id: '13', displayName: 'Los Angeles Lakers', abbreviation: 'LAL' },
      ]),
    });
    await searchTeams({ query: 'lakers', leagues: ['nba'], fetchImpl });
    await searchTeams({ query: 'angeles', leagues: ['nba'], fetchImpl });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('rejects when the AbortSignal fires', async () => {
    const fetchImpl: TeamSearchFetch = (_url, init) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener('abort', () =>
          reject(new DOMException('aborted', 'AbortError')),
        );
      });
    const controller = new AbortController();
    const pending = searchTeams({
      query: 'cowboys',
      leagues: ['nfl'],
      fetchImpl,
      signal: controller.signal,
    });
    controller.abort();
    await expect(pending).rejects.toThrow(/abort/i);
  });
});
