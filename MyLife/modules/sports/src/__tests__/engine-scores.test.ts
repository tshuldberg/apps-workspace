import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  SCOREBOARD_TTL_MS,
  clearScoreboardCache,
  fetchLiveScores,
  type ScoresFetch,
} from '../engine/scores';
import type { LeagueId } from '../types';

// ---------------------------------------------------------------------------
// ESPN scoreboard fixtures. Shape mirrors the defensive subset we consume:
//   events: [{ id, date, competitions: [{ competitors, status, venue, broadcasts }] }]
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

function scoreboardFixture(events: FixtureEvent[]): unknown {
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
            type: {
              state: e.state,
              shortDetail: e.period,
            },
            displayClock: e.clock,
          },
          venue: e.venue ? { fullName: e.venue } : undefined,
          broadcasts: e.broadcasts
            ? [{ names: e.broadcasts }]
            : undefined,
        },
      ],
    })),
  };
}

function makeFetch(
  fixtures: Partial<Record<string, unknown>>,
): ScoresFetch {
  return vi.fn(async (url: string) => {
    for (const key of Object.keys(fixtures)) {
      if (url.includes(key)) {
        return fixtures[key] as Awaited<ReturnType<ScoresFetch>>;
      }
    }
    return { events: [] };
  });
}

const DATE = new Date('2026-04-21T12:00:00Z');

describe('fetchLiveScores', () => {
  afterEach(() => {
    clearScoreboardCache();
  });

  it('normalizes ESPN events into Game shape with status, scores, and startAt', async () => {
    const fetchImpl = makeFetch({
      '/football/nfl/scoreboard': scoreboardFixture([
        {
          id: '401',
          date: '2026-04-21T20:00:00Z',
          state: 'in',
          home: { id: '6', name: 'Dallas Cowboys', abbr: 'DAL', score: '17' },
          away: { id: '7', name: 'Philadelphia Eagles', abbr: 'PHI', score: '14' },
          period: '2nd Quarter',
          clock: '5:32',
          venue: 'AT&T Stadium',
          broadcasts: ['FOX'],
        },
      ]),
    });

    const games = await fetchLiveScores({
      leagues: ['nfl'],
      date: DATE,
      fetchImpl,
      now: 1_700_000_000_000,
    });

    expect(games).toHaveLength(1);
    const g = games[0];
    expect(g.id).toBe('espn:nfl:401');
    expect(g.league).toBe('nfl');
    expect(g.sport).toBe('football');
    expect(g.status).toBe('live');
    expect(g.home.name).toBe('Dallas Cowboys');
    expect(g.home.score).toBe(17);
    expect(g.away.score).toBe(14);
    expect(g.period).toBe('2nd Quarter');
    expect(g.clock).toBe('5:32');
    expect(g.venue).toBe('AT&T Stadium');
    expect(g.broadcast).toBe('FOX');
    expect(g.startAt).toBe(Date.parse('2026-04-21T20:00:00Z'));
    expect(g.updatedAt).toBe(1_700_000_000_000);
  });

  it('fans out across all five launch leagues when none are specified', async () => {
    const fetchImpl = makeFetch({});
    await fetchLiveScores({ date: DATE, fetchImpl });
    expect(fetchImpl).toHaveBeenCalledTimes(5);
    const calls = (fetchImpl as unknown as { mock: { calls: [string][] } }).mock.calls;
    const urls = calls.map((c) => c[0]).join('\n');
    expect(urls).toMatch(/\/football\/nfl\/scoreboard/);
    expect(urls).toMatch(/\/basketball\/nba\/scoreboard/);
    expect(urls).toMatch(/\/baseball\/mlb\/scoreboard/);
    expect(urls).toMatch(/\/hockey\/nhl\/scoreboard/);
    expect(urls).toMatch(/\/soccer\/usa\.1\/scoreboard/);
  });

  it('maps ESPN status.state into scheduled | live | final', async () => {
    const fetchImpl = makeFetch({
      '/basketball/nba/scoreboard': scoreboardFixture([
        {
          id: '1',
          date: '2026-04-21T23:00:00Z',
          state: 'pre',
          home: { id: 'a', name: 'Home A' },
          away: { id: 'b', name: 'Away A' },
        },
        {
          id: '2',
          date: '2026-04-21T19:00:00Z',
          state: 'in',
          home: { id: 'c', name: 'Home B', score: '88' },
          away: { id: 'd', name: 'Away B', score: '82' },
        },
        {
          id: '3',
          date: '2026-04-21T00:00:00Z',
          state: 'post',
          home: { id: 'e', name: 'Home C', score: '112' },
          away: { id: 'f', name: 'Away C', score: '104' },
        },
      ]),
    });
    const games = await fetchLiveScores({
      leagues: ['nba'],
      date: DATE,
      fetchImpl,
    });
    expect(games.map((g) => g.status)).toEqual(['scheduled', 'live', 'final']);
  });

  it('returns an empty list when an events array is empty', async () => {
    const fetchImpl = makeFetch({
      '/hockey/nhl/scoreboard': { events: [] },
    });
    const games = await fetchLiveScores({
      leagues: ['nhl'],
      date: DATE,
      fetchImpl,
    });
    expect(games).toEqual([]);
  });

  it('caches per `{league}:{date}` within the TTL and fetches again after it expires', async () => {
    const fetchImpl = makeFetch({
      '/football/nfl/scoreboard': scoreboardFixture([
        {
          id: '1',
          date: '2026-04-21T20:00:00Z',
          state: 'pre',
          home: { id: 'a', name: 'H' },
          away: { id: 'b', name: 'A' },
        },
      ]),
    });

    // First call: network hit.
    await fetchLiveScores({
      leagues: ['nfl'],
      date: DATE,
      fetchImpl,
      now: 1_000,
    });
    // Second call inside TTL: cache hit, no new network calls.
    await fetchLiveScores({
      leagues: ['nfl'],
      date: DATE,
      fetchImpl,
      now: 1_000 + SCOREBOARD_TTL_MS - 1,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    // Third call after TTL expiry: network hit again.
    await fetchLiveScores({
      leagues: ['nfl'],
      date: DATE,
      fetchImpl,
      now: 1_000 + SCOREBOARD_TTL_MS + 10,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('propagates AbortSignal to the fetch layer and rejects when aborted', async () => {
    const fetchImpl: ScoresFetch = (_url, init) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener('abort', () =>
          reject(new DOMException('aborted', 'AbortError')),
        );
      });
    const controller = new AbortController();
    const pending = fetchLiveScores({
      leagues: ['nfl'] as LeagueId[],
      date: DATE,
      fetchImpl,
      signal: controller.signal,
    });
    controller.abort();
    await expect(pending).rejects.toThrow(/abort/i);
  });

  it('skips events missing a competitor or a parseable date', async () => {
    const fetchImpl: ScoresFetch = vi.fn(async () => ({
      events: [
        {
          id: '1',
          date: 'not-a-date',
          competitions: [
            {
              competitors: [
                { homeAway: 'home' as const, team: { displayName: 'H' } },
                { homeAway: 'away' as const, team: { displayName: 'A' } },
              ],
              status: { type: { state: 'pre' as const } },
            },
          ],
        },
        {
          id: '2',
          date: '2026-04-21T20:00:00Z',
          competitions: [
            {
              competitors: [
                { homeAway: 'home' as const, team: { displayName: 'Only Home' } },
              ],
              status: { type: { state: 'pre' as const } },
            },
          ],
        },
      ],
    }));
    const games = await fetchLiveScores({
      leagues: ['nfl'],
      date: DATE,
      fetchImpl,
    });
    expect(games).toEqual([]);
  });
});
