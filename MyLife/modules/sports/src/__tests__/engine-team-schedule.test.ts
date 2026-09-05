import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  TEAM_SCHEDULE_TTL_MS,
  clearTeamScheduleCache,
  fetchTeamSchedule,
  type TeamScheduleFetch,
} from '../engine/team-schedule';

// ---------------------------------------------------------------------------
// Fixture builder. Mirrors the scoreboard payload shape but lives on the
// team-schedule endpoint. Scores + status live on the competition.
// ---------------------------------------------------------------------------

interface FixtureEvent {
  id: string;
  date: string;
  state: 'pre' | 'in' | 'post';
  home: { id?: string; name: string; abbr?: string; score?: string };
  away: { id?: string; name: string; abbr?: string; score?: string };
  period?: string;
  clock?: string;
  venue?: string;
  broadcasts?: string[];
}

function scheduleFixture(events: FixtureEvent[]): unknown {
  return {
    events: events.map((e) => ({
      id: e.id,
      date: e.date,
      status: { type: { state: e.state } },
      competitions: [
        {
          competitors: [
            {
              homeAway: 'home',
              score: e.home.score,
              team: {
                id: e.home.id,
                displayName: e.home.name,
                abbreviation: e.home.abbr,
              },
            },
            {
              homeAway: 'away',
              score: e.away.score,
              team: {
                id: e.away.id,
                displayName: e.away.name,
                abbreviation: e.away.abbr,
              },
            },
          ],
          status: {
            type: { state: e.state, shortDetail: e.period },
            displayClock: e.clock,
          },
          venue: e.venue ? { fullName: e.venue } : undefined,
          broadcasts: e.broadcasts ? [{ names: e.broadcasts }] : undefined,
        },
      ],
    })),
  };
}

function makeFetch(
  fixtures: Partial<Record<string, unknown>>,
): TeamScheduleFetch {
  return vi.fn(async (url: string) => {
    for (const key of Object.keys(fixtures)) {
      if (url.includes(key)) {
        return fixtures[key] as Awaited<ReturnType<TeamScheduleFetch>>;
      }
    }
    return { events: [] };
  });
}

describe('fetchTeamSchedule', () => {
  afterEach(() => {
    clearTeamScheduleCache();
  });

  it('builds the correct ESPN URL from league + team id and normalizes events into Game[]', async () => {
    const fetchImpl = makeFetch({
      '/football/nfl/teams/6/schedule': scheduleFixture([
        {
          id: '401',
          date: '2026-04-28T20:00:00Z',
          state: 'pre',
          home: { id: '6', name: 'Dallas Cowboys', abbr: 'DAL' },
          away: { id: '7', name: 'Philadelphia Eagles', abbr: 'PHI' },
          venue: 'AT&T Stadium',
          broadcasts: ['FOX'],
        },
        {
          id: '400',
          date: '2026-04-14T17:00:00Z',
          state: 'post',
          home: { id: '6', name: 'Dallas Cowboys', score: '21' },
          away: { id: '8', name: 'New York Giants', score: '14' },
          period: 'Final',
        },
      ]),
    });
    const games = await fetchTeamSchedule({
      teamId: 'espn:nfl:6',
      league: 'nfl',
      fetchImpl,
    });
    // Called exactly once with the correct URL.
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0] as [string];
    expect(url).toContain('/football/nfl/teams/6/schedule');
    // Sorted ascending by startAt (recent past game, then upcoming).
    expect(games).toHaveLength(2);
    expect(games[0].id).toBe('espn:nfl:400');
    expect(games[0].status).toBe('final');
    expect(games[0].home.score).toBe(21);
    expect(games[0].away.score).toBe(14);
    expect(games[1].id).toBe('espn:nfl:401');
    expect(games[1].status).toBe('scheduled');
    expect(games[1].venue).toBe('AT&T Stadium');
    expect(games[1].broadcast).toBe('FOX');
  });

  it('accepts a raw ESPN team id and still builds the right URL', async () => {
    const fetchImpl = makeFetch({
      '/basketball/nba/teams/13/schedule': scheduleFixture([
        {
          id: '900',
          date: '2026-04-22T02:30:00Z',
          state: 'in',
          home: { id: '13', name: 'Los Angeles Lakers', score: '55' },
          away: { id: '14', name: 'Los Angeles Clippers', score: '60' },
          period: '3rd Qtr',
          clock: '4:12',
        },
      ]),
    });
    const games = await fetchTeamSchedule({
      teamId: '13',
      league: 'nba',
      fetchImpl,
    });
    expect(games).toHaveLength(1);
    expect(games[0].status).toBe('live');
    expect(games[0].clock).toBe('4:12');
    expect(games[0].period).toBe('3rd Qtr');
    expect(games[0].home.score).toBe(55);
    expect(games[0].away.score).toBe(60);
  });

  it('caches per {league, teamId} within TTL and refetches after expiry', async () => {
    const fetchImpl = makeFetch({
      '/football/nfl/teams/6/schedule': scheduleFixture([
        {
          id: '1',
          date: '2026-04-14T17:00:00Z',
          state: 'post',
          home: { id: '6', name: 'Dallas Cowboys', score: '21' },
          away: { id: '8', name: 'New York Giants', score: '14' },
        },
      ]),
    });
    await fetchTeamSchedule({
      teamId: 'espn:nfl:6',
      league: 'nfl',
      fetchImpl,
      now: 1_000,
    });
    await fetchTeamSchedule({
      teamId: 'espn:nfl:6',
      league: 'nfl',
      fetchImpl,
      now: 1_000 + TEAM_SCHEDULE_TTL_MS - 1,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    await fetchTeamSchedule({
      teamId: 'espn:nfl:6',
      league: 'nfl',
      fetchImpl,
      now: 1_000 + TEAM_SCHEDULE_TTL_MS + 10,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('cache is keyed per team -- different team ids do not collide', async () => {
    const fetchImpl = makeFetch({
      '/football/nfl/teams/6/schedule': scheduleFixture([
        {
          id: '1',
          date: '2026-04-14T17:00:00Z',
          state: 'post',
          home: { id: '6', name: 'Dallas Cowboys', score: '21' },
          away: { id: '8', name: 'New York Giants', score: '14' },
        },
      ]),
      '/football/nfl/teams/17/schedule': scheduleFixture([
        {
          id: '2',
          date: '2026-04-14T20:00:00Z',
          state: 'post',
          home: { id: '17', name: 'New England Patriots', score: '28' },
          away: { id: '2', name: 'Buffalo Bills', score: '24' },
        },
      ]),
    });
    await fetchTeamSchedule({ teamId: 'espn:nfl:6', league: 'nfl', fetchImpl });
    await fetchTeamSchedule({ teamId: 'espn:nfl:17', league: 'nfl', fetchImpl });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('propagates AbortSignal and rejects when aborted', async () => {
    const fetchImpl: TeamScheduleFetch = (_url, init) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener('abort', () =>
          reject(new DOMException('aborted', 'AbortError')),
        );
      });
    const controller = new AbortController();
    const pending = fetchTeamSchedule({
      teamId: 'espn:nfl:6',
      league: 'nfl',
      fetchImpl,
      signal: controller.signal,
    });
    controller.abort();
    await expect(pending).rejects.toThrow(/abort/i);
  });

  it('returns [] for an unknown league without calling fetch', async () => {
    const fetchImpl = vi.fn(async () => ({ events: [] }));
    const games = await fetchTeamSchedule({
      teamId: 'espn:xfl:1',
      league: 'xfl' as never,
      fetchImpl: fetchImpl as unknown as TeamScheduleFetch,
    });
    expect(games).toEqual([]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('returns [] when the payload has no events', async () => {
    const fetchImpl: TeamScheduleFetch = vi.fn(async () => ({}));
    const games = await fetchTeamSchedule({
      teamId: 'espn:nhl:10',
      league: 'nhl',
      fetchImpl,
    });
    expect(games).toEqual([]);
  });

  it('skips events missing an id, a date, or a competitor display name', async () => {
    const payload = {
      events: [
        // Missing id
        {
          date: '2026-04-22T20:00:00Z',
          status: { type: { state: 'pre' } },
          competitions: [
            {
              competitors: [
                { homeAway: 'home', team: { id: '6', displayName: 'A' } },
                { homeAway: 'away', team: { id: '7', displayName: 'B' } },
              ],
            },
          ],
        },
        // Missing date
        {
          id: 'no-date',
          status: { type: { state: 'pre' } },
          competitions: [
            {
              competitors: [
                { homeAway: 'home', team: { id: '6', displayName: 'A' } },
                { homeAway: 'away', team: { id: '7', displayName: 'B' } },
              ],
            },
          ],
        },
        // Missing away competitor display name
        {
          id: 'no-name',
          date: '2026-04-22T20:00:00Z',
          status: { type: { state: 'pre' } },
          competitions: [
            {
              competitors: [
                { homeAway: 'home', team: { id: '6', displayName: 'A' } },
                { homeAway: 'away', team: { id: '7' } },
              ],
            },
          ],
        },
        // Good row
        {
          id: 'good',
          date: '2026-04-22T20:00:00Z',
          status: { type: { state: 'pre' } },
          competitions: [
            {
              competitors: [
                { homeAway: 'home', team: { id: '6', displayName: 'A' } },
                { homeAway: 'away', team: { id: '7', displayName: 'B' } },
              ],
            },
          ],
        },
      ],
    };
    const fetchImpl: TeamScheduleFetch = vi.fn(
      async () => payload as unknown as Awaited<ReturnType<TeamScheduleFetch>>,
    );
    const games = await fetchTeamSchedule({
      teamId: 'espn:nfl:6',
      league: 'nfl',
      fetchImpl,
    });
    expect(games).toHaveLength(1);
    expect(games[0].id).toBe('espn:nfl:good');
  });
});
