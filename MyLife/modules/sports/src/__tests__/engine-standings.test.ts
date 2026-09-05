import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  STANDINGS_TTL_MS,
  clearStandingsCache,
  fetchStandings,
  fetchStandingsForLeagues,
  findTeamRecord,
  type StandingsFetch,
} from '../engine/standings';
import type { StandingGroup } from '../types';

// ---------------------------------------------------------------------------
// ESPN standings fixture builder. At level=3 every launch league returns:
//   children: [{ name, children?: [{ name, standings: { entries } }], standings? }]
// NFL/NBA/MLB/NHL use conference -> division -> entries.
// MLS uses conference -> entries (no divisions).
// ---------------------------------------------------------------------------

interface FixtureEntry {
  teamId: string;
  name: string;
  abbr?: string;
  wins: number;
  losses: number;
  ties?: number;
  winPct?: number;
  gamesBack?: number;
  streak?: string;
  pointsFor?: number;
  pointsAgainst?: number;
}

interface FixtureDivision {
  name: string;
  entries: FixtureEntry[];
}

interface FixtureConference {
  name: string;
  divisions?: FixtureDivision[];
  entries?: FixtureEntry[];
}

function makeEntry(e: FixtureEntry): unknown {
  const pct =
    e.winPct ??
    (e.wins + e.losses + (e.ties ?? 0) > 0
      ? e.wins / (e.wins + e.losses + (e.ties ?? 0))
      : 0);
  const stats: Array<{ name: string; value?: number; displayValue?: string }> = [
    { name: 'wins', value: e.wins, displayValue: String(e.wins) },
    { name: 'losses', value: e.losses, displayValue: String(e.losses) },
    { name: 'ties', value: e.ties ?? 0, displayValue: String(e.ties ?? 0) },
    { name: 'winPercent', value: pct, displayValue: pct.toFixed(3) },
  ];
  if (e.gamesBack !== undefined) {
    stats.push({ name: 'gamesBehind', value: e.gamesBack, displayValue: String(e.gamesBack) });
  }
  if (e.streak !== undefined) {
    stats.push({ name: 'streak', value: 0, displayValue: e.streak });
  }
  if (e.pointsFor !== undefined) {
    stats.push({ name: 'pointsFor', value: e.pointsFor, displayValue: String(e.pointsFor) });
  }
  if (e.pointsAgainst !== undefined) {
    stats.push({
      name: 'pointsAgainst',
      value: e.pointsAgainst,
      displayValue: String(e.pointsAgainst),
    });
  }
  return {
    team: {
      id: e.teamId,
      displayName: e.name,
      abbreviation: e.abbr,
    },
    stats,
  };
}

function standingsFixture(conferences: FixtureConference[]): unknown {
  return {
    name: 'Fixture League',
    children: conferences.map((conf) => {
      if (conf.divisions && conf.divisions.length > 0) {
        return {
          name: conf.name,
          children: conf.divisions.map((d) => ({
            name: d.name,
            standings: { entries: d.entries.map(makeEntry) },
          })),
        };
      }
      return {
        name: conf.name,
        standings: { entries: (conf.entries ?? []).map(makeEntry) },
      };
    }),
  };
}

function makeFetch(
  fixtures: Partial<Record<string, unknown>>,
): StandingsFetch {
  return vi.fn(async (url: string) => {
    for (const key of Object.keys(fixtures)) {
      if (url.includes(key)) {
        return fixtures[key] as Awaited<ReturnType<StandingsFetch>>;
      }
    }
    return { children: [] };
  });
}

describe('fetchStandings', () => {
  afterEach(() => {
    clearStandingsCache();
  });

  it('normalizes NFL conference -> division -> entries into StandingGroup[]', async () => {
    const fetchImpl = makeFetch({
      '/football/nfl/standings': standingsFixture([
        {
          name: 'American Football Conference',
          divisions: [
            {
              name: 'AFC East',
              entries: [
                {
                  teamId: '17',
                  name: 'New England Patriots',
                  abbr: 'NE',
                  wins: 14,
                  losses: 3,
                  ties: 0,
                  winPct: 0.8235294,
                  streak: 'W3',
                  pointsFor: 490,
                  pointsAgainst: 320,
                },
                {
                  teamId: '2',
                  name: 'Buffalo Bills',
                  abbr: 'BUF',
                  wins: 10,
                  losses: 7,
                  ties: 0,
                  winPct: 0.588,
                  streak: 'L1',
                },
              ],
            },
          ],
        },
      ]),
    });
    const groups = await fetchStandings({ league: 'nfl', fetchImpl });
    expect(groups).toHaveLength(1);
    const g = groups[0];
    expect(g.league).toBe('nfl');
    expect(g.conference).toBe('American Football Conference');
    expect(g.division).toBe('AFC East');
    expect(g.rows).toHaveLength(2);
    expect(g.rows[0].teamId).toBe('espn:nfl:17');
    expect(g.rows[0].teamName).toBe('New England Patriots');
    expect(g.rows[0].teamAbbreviation).toBe('NE');
    expect(g.rows[0].wins).toBe(14);
    expect(g.rows[0].losses).toBe(3);
    expect(g.rows[0].ties).toBe(0);
    expect(g.rows[0].winPct).toBeCloseTo(0.8235294);
    expect(g.rows[0].streak).toBe('W3');
    expect(g.rows[0].pointsFor).toBe(490);
    expect(g.rows[0].pointsAgainst).toBe(320);
  });

  it('normalizes NBA conference -> division -> entries', async () => {
    const fetchImpl = makeFetch({
      '/basketball/nba/standings': standingsFixture([
        {
          name: 'Eastern Conference',
          divisions: [
            {
              name: 'Atlantic',
              entries: [
                { teamId: '2', name: 'Boston Celtics', abbr: 'BOS', wins: 50, losses: 20, winPct: 0.714 },
                { teamId: '18', name: 'New York Knicks', abbr: 'NYK', wins: 45, losses: 25, winPct: 0.643 },
              ],
            },
          ],
        },
      ]),
    });
    const groups = await fetchStandings({ league: 'nba', fetchImpl });
    expect(groups).toHaveLength(1);
    expect(groups[0].division).toBe('Atlantic');
    expect(groups[0].rows[0].teamId).toBe('espn:nba:2');
    expect(groups[0].rows[0].wins).toBe(50);
  });

  it('handles MLS shape (conference -> entries, no divisions)', async () => {
    const fetchImpl = makeFetch({
      '/soccer/usa.1/standings': standingsFixture([
        {
          name: 'Eastern Conference',
          entries: [
            { teamId: '101', name: 'Inter Miami CF', abbr: 'MIA', wins: 18, losses: 7, ties: 9, winPct: 0.647 },
            { teamId: '102', name: 'FC Cincinnati', abbr: 'CIN', wins: 17, losses: 8, ties: 9, winPct: 0.618 },
          ],
        },
        {
          name: 'Western Conference',
          entries: [
            { teamId: '201', name: 'LAFC', abbr: 'LAFC', wins: 19, losses: 9, ties: 6, winPct: 0.676 },
          ],
        },
      ]),
    });
    const groups = await fetchStandings({ league: 'mls', fetchImpl });
    expect(groups).toHaveLength(2);
    expect(groups[0].conference).toBe('Eastern Conference');
    expect(groups[0].division).toBeNull();
    expect(groups[0].rows).toHaveLength(2);
    expect(groups[1].conference).toBe('Western Conference');
  });

  it('sorts rows by winPct desc, tiebreak by wins desc', async () => {
    const fetchImpl = makeFetch({
      '/hockey/nhl/standings': standingsFixture([
        {
          name: 'Eastern Conference',
          divisions: [
            {
              name: 'Atlantic',
              entries: [
                { teamId: 'c', name: 'Third', wins: 10, losses: 10, winPct: 0.5 },
                { teamId: 'a', name: 'First', wins: 15, losses: 5, winPct: 0.75 },
                { teamId: 'b', name: 'Second', wins: 14, losses: 6, winPct: 0.7 },
              ],
            },
          ],
        },
      ]),
    });
    const groups = await fetchStandings({ league: 'nhl', fetchImpl });
    expect(groups[0].rows.map((r) => r.teamId)).toEqual([
      'espn:nhl:a',
      'espn:nhl:b',
      'espn:nhl:c',
    ]);
  });

  it('caches per league within the TTL and refetches after expiry', async () => {
    const fetchImpl = makeFetch({
      '/football/nfl/standings': standingsFixture([
        { name: 'AFC', divisions: [{ name: 'East', entries: [{ teamId: '1', name: 'T', wins: 1, losses: 0 }] }] },
      ]),
    });
    await fetchStandings({ league: 'nfl', fetchImpl, now: 1_000 });
    await fetchStandings({
      league: 'nfl',
      fetchImpl,
      now: 1_000 + STANDINGS_TTL_MS - 1,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    await fetchStandings({
      league: 'nfl',
      fetchImpl,
      now: 1_000 + STANDINGS_TTL_MS + 10,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('propagates AbortSignal to the fetch layer and rejects when aborted', async () => {
    const fetchImpl: StandingsFetch = (_url, init) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener('abort', () =>
          reject(new DOMException('aborted', 'AbortError')),
        );
      });
    const controller = new AbortController();
    const pending = fetchStandings({
      league: 'nfl',
      fetchImpl,
      signal: controller.signal,
    });
    controller.abort();
    await expect(pending).rejects.toThrow(/abort/i);
  });

  it('skips entries missing a team id or a display name', async () => {
    const fetchImpl: StandingsFetch = vi.fn(async () => ({
      children: [
        {
          name: 'Conf',
          children: [
            {
              name: 'Div',
              standings: {
                entries: [
                  { team: { displayName: 'Missing Id' }, stats: [] },
                  { team: { id: '99' }, stats: [] }, // missing name
                  {
                    team: { id: '10', displayName: 'Ok Team', abbreviation: 'OK' },
                    stats: [
                      { name: 'wins', value: 5 },
                      { name: 'losses', value: 5 },
                      { name: 'winPercent', value: 0.5 },
                    ],
                  },
                ],
              },
            },
          ],
        },
      ],
    }));
    const groups = await fetchStandings({ league: 'nfl', fetchImpl });
    expect(groups).toHaveLength(1);
    expect(groups[0].rows).toHaveLength(1);
    expect(groups[0].rows[0].teamId).toBe('espn:nfl:10');
  });

  it('returns an empty list when children is empty', async () => {
    const fetchImpl: StandingsFetch = vi.fn(async () => ({ children: [] }));
    const groups = await fetchStandings({ league: 'mlb', fetchImpl });
    expect(groups).toEqual([]);
  });
});

describe('fetchStandingsForLeagues', () => {
  afterEach(() => clearStandingsCache());

  it('fans out across the requested leagues in parallel and returns a map keyed by league id', async () => {
    const fetchImpl = makeFetch({
      '/football/nfl/standings': standingsFixture([
        { name: 'AFC', divisions: [{ name: 'East', entries: [{ teamId: '1', name: 'A', wins: 1, losses: 0 }] }] },
      ]),
      '/basketball/nba/standings': standingsFixture([
        { name: 'East', divisions: [{ name: 'Atlantic', entries: [{ teamId: '2', name: 'B', wins: 1, losses: 0 }] }] },
      ]),
    });
    const out = await fetchStandingsForLeagues({
      leagues: ['nfl', 'nba'],
      fetchImpl,
    });
    expect(Object.keys(out).sort()).toEqual(['nba', 'nfl']);
    expect(out.nfl[0]?.rows[0]?.teamId).toBe('espn:nfl:1');
    expect(out.nba[0]?.rows[0]?.teamId).toBe('espn:nba:2');
  });

  it('defaults to all five launch leagues when no leagues are specified', async () => {
    const fetchImpl = makeFetch({});
    await fetchStandingsForLeagues({ fetchImpl });
    expect(fetchImpl).toHaveBeenCalledTimes(5);
  });
});

describe('findTeamRecord', () => {
  const groups: StandingGroup[] = [
    {
      league: 'nfl',
      conference: 'AFC',
      division: 'East',
      rows: [
        {
          teamId: 'espn:nfl:17',
          teamName: 'New England Patriots',
          teamAbbreviation: 'NE',
          wins: 14,
          losses: 3,
          ties: 0,
          winPct: 0.824,
          gamesBack: null,
          streak: 'W3',
          pointsFor: 490,
          pointsAgainst: 320,
        },
      ],
    },
  ];

  it('returns the matching row when the team id is present', () => {
    const row = findTeamRecord(groups, 'espn:nfl:17');
    expect(row?.wins).toBe(14);
    expect(row?.teamAbbreviation).toBe('NE');
  });

  it('returns null for an unknown team id', () => {
    expect(findTeamRecord(groups, 'espn:nfl:99')).toBeNull();
  });
});
