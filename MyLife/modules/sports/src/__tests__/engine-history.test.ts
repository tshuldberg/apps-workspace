import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  HISTORY_SLICE_TTL_MS,
  clearHistoryCache,
  computeCoveredDates,
  fetchHistorySlice,
  type HistoryFetch,
} from '../engine/history';
import type { Game } from '../types';

const DAY_MS = 24 * 60 * 60 * 1_000;
const APR_1 = Date.parse('2026-04-01T12:00:00.000Z');

interface FixtureEvent {
  id: string;
  date: string;
  state: 'pre' | 'in' | 'post';
  home: { id?: string; name: string; score?: string };
  away: { id?: string; name: string; score?: string };
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
              team: { id: e.home.id, displayName: e.home.name },
            },
            {
              homeAway: 'away',
              score: e.away.score,
              team: { id: e.away.id, displayName: e.away.name },
            },
          ],
          status: { type: { state: e.state } },
        },
      ],
    })),
  };
}

function sampleGame(overrides: Partial<Game> = {}): Game {
  return {
    id: 'espn:nfl:1',
    league: 'nfl',
    sport: 'football',
    home: { id: 'A', name: 'A', abbreviation: null, score: 21 },
    away: { id: 'B', name: 'B', abbreviation: null, score: 14 },
    status: 'final',
    period: null,
    clock: null,
    startAt: APR_1,
    venue: null,
    broadcast: null,
    updatedAt: APR_1,
    ...overrides,
  };
}

describe('computeCoveredDates', () => {
  it('returns empty set when teamIds is empty', () => {
    const g = sampleGame();
    expect(computeCoveredDates([g], []).size).toBe(0);
  });

  it('returns empty set when games list is empty', () => {
    expect(computeCoveredDates([], ['A']).size).toBe(0);
  });

  it('marks a day covered when at least one followed team appears', () => {
    const covered = computeCoveredDates(
      [
        sampleGame({ id: 'g1', startAt: Date.parse('2026-04-01T20:00:00Z') }),
        sampleGame({
          id: 'g2',
          startAt: Date.parse('2026-04-02T02:00:00Z'),
          home: { id: 'X', name: 'X', abbreviation: null, score: null },
          away: { id: 'Y', name: 'Y', abbreviation: null, score: null },
        }),
      ],
      ['A'],
    );
    expect(covered.has('2026-04-01')).toBe(true);
    // Day 2 has no followed team -- must NOT be marked covered.
    expect(covered.has('2026-04-02')).toBe(false);
  });

  it('uses UTC dates (ignores local TZ drift)', () => {
    const covered = computeCoveredDates(
      [sampleGame({ startAt: Date.parse('2026-04-01T23:30:00Z') })],
      ['A'],
    );
    expect(covered.has('2026-04-01')).toBe(true);
  });
});

describe('fetchHistorySlice', () => {
  afterEach(() => {
    clearHistoryCache();
    vi.restoreAllMocks();
  });

  it('returns [] when teamIds is empty without calling fetch', async () => {
    const fetchImpl = vi.fn(async () => ({ events: [] }));
    const games = await fetchHistorySlice({
      teamIds: [],
      since: APR_1,
      until: APR_1,
      coveredDates: new Set(),
      fetchImpl: fetchImpl as unknown as HistoryFetch,
    });
    expect(games).toEqual([]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('skips dates already in coveredDates', async () => {
    const fetchImpl = vi.fn(async () => scoreboardFixture([]));
    await fetchHistorySlice({
      teamIds: ['A'],
      leagues: ['nfl'],
      since: Date.parse('2026-04-01T00:00:00Z'),
      until: Date.parse('2026-04-03T00:00:00Z'),
      coveredDates: new Set(['2026-04-01', '2026-04-02', '2026-04-03']),
      fetchImpl: fetchImpl as unknown as HistoryFetch,
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('fetches one scoreboard per missing day per league and filters to followed teams', async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.includes('dates=20260401')) {
        return scoreboardFixture([
          {
            id: 'match',
            date: '2026-04-01T20:00:00Z',
            state: 'post',
            home: { id: 'A', name: 'A', score: '21' },
            away: { id: 'B', name: 'B', score: '14' },
          },
          {
            id: 'miss',
            date: '2026-04-01T21:00:00Z',
            state: 'post',
            home: { id: 'X', name: 'X', score: '10' },
            away: { id: 'Y', name: 'Y', score: '12' },
          },
        ]);
      }
      return { events: [] };
    });
    const games = await fetchHistorySlice({
      teamIds: ['A'],
      leagues: ['nfl'],
      since: Date.parse('2026-04-01T00:00:00Z'),
      until: Date.parse('2026-04-01T00:00:00Z'),
      coveredDates: new Set(),
      fetchImpl: fetchImpl as unknown as HistoryFetch,
    });
    expect(games).toHaveLength(1);
    expect(games[0].id).toBe('espn:nfl:match');
    // Exactly one fetch for the one missing day.
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('dedupes games by id when two followed teams share a rivalry game', async () => {
    const fetchImpl = vi.fn(async () =>
      scoreboardFixture([
        {
          id: 'rivalry',
          date: '2026-04-01T20:00:00Z',
          state: 'post',
          home: { id: 'A', name: 'A', score: '21' },
          away: { id: 'B', name: 'B', score: '14' },
        },
      ]),
    );
    const games = await fetchHistorySlice({
      teamIds: ['A', 'B'],
      leagues: ['nfl'],
      since: Date.parse('2026-04-01T00:00:00Z'),
      until: Date.parse('2026-04-01T00:00:00Z'),
      coveredDates: new Set(),
      fetchImpl: fetchImpl as unknown as HistoryFetch,
    });
    expect(games).toHaveLength(1);
    expect(games[0].id).toBe('espn:nfl:rivalry');
  });

  it('caches per {league, day} within TTL and refetches after expiry', async () => {
    const fetchImpl = vi.fn(async () =>
      scoreboardFixture([
        {
          id: 'cached',
          date: '2026-04-01T20:00:00Z',
          state: 'post',
          home: { id: 'A', name: 'A', score: '7' },
          away: { id: 'B', name: 'B', score: '3' },
        },
      ]),
    );
    await fetchHistorySlice({
      teamIds: ['A'],
      leagues: ['nfl'],
      since: Date.parse('2026-04-01T00:00:00Z'),
      until: Date.parse('2026-04-01T00:00:00Z'),
      coveredDates: new Set(),
      fetchImpl: fetchImpl as unknown as HistoryFetch,
      now: 1_000,
    });
    await fetchHistorySlice({
      teamIds: ['A'],
      leagues: ['nfl'],
      since: Date.parse('2026-04-01T00:00:00Z'),
      until: Date.parse('2026-04-01T00:00:00Z'),
      coveredDates: new Set(),
      fetchImpl: fetchImpl as unknown as HistoryFetch,
      now: 1_000 + HISTORY_SLICE_TTL_MS - 1,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    await fetchHistorySlice({
      teamIds: ['A'],
      leagues: ['nfl'],
      since: Date.parse('2026-04-01T00:00:00Z'),
      until: Date.parse('2026-04-01T00:00:00Z'),
      coveredDates: new Set(),
      fetchImpl: fetchImpl as unknown as HistoryFetch,
      now: 1_000 + HISTORY_SLICE_TTL_MS + 10,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('chunks parallelism at 5 concurrent requests', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const fetchImpl = (async () => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 5));
      inFlight--;
      return scoreboardFixture([]) as Awaited<ReturnType<HistoryFetch>>;
    }) as HistoryFetch;
    // 12 days across 1 league = 12 concurrent requests capped at 5.
    await fetchHistorySlice({
      teamIds: ['A'],
      leagues: ['nfl'],
      since: Date.parse('2026-04-01T00:00:00Z'),
      until: Date.parse('2026-04-12T00:00:00Z'),
      coveredDates: new Set(),
      fetchImpl,
    });
    expect(maxInFlight).toBeLessThanOrEqual(5);
    expect(maxInFlight).toBeGreaterThan(0);
  });

  it('swallows per-day fetch failures and returns [] without throwing', async () => {
    const fetchImpl: HistoryFetch = vi.fn(async () => {
      throw new Error('ESPN down');
    });
    const games = await fetchHistorySlice({
      teamIds: ['A'],
      leagues: ['nfl'],
      since: Date.parse('2026-04-01T00:00:00Z'),
      until: Date.parse('2026-04-02T00:00:00Z'),
      coveredDates: new Set(),
      fetchImpl,
    });
    expect(games).toEqual([]);
  });

  it('bails early when AbortSignal fires between chunks', async () => {
    const controller = new AbortController();
    let called = 0;
    const fetchImpl = (async () => {
      called++;
      if (called === 1) controller.abort();
      return scoreboardFixture([]) as Awaited<ReturnType<HistoryFetch>>;
    }) as HistoryFetch;
    await fetchHistorySlice({
      teamIds: ['A'],
      leagues: ['nfl'],
      // Span two chunks (12 days, 1 league, concurrency 5 = 3 chunks).
      since: Date.parse('2026-04-01T00:00:00Z'),
      until: Date.parse('2026-04-12T00:00:00Z'),
      coveredDates: new Set(),
      fetchImpl,
      signal: controller.signal,
    });
    // First chunk of 5 always flushes; subsequent chunks short-circuit.
    expect(called).toBeLessThanOrEqual(5);
  });

  it('returns newest-first sorted games', async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.includes('dates=20260401')) {
        return scoreboardFixture([
          {
            id: 'older',
            date: '2026-04-01T12:00:00Z',
            state: 'post',
            home: { id: 'A', name: 'A', score: '1' },
            away: { id: 'B', name: 'B', score: '0' },
          },
        ]) as Awaited<ReturnType<HistoryFetch>>;
      }
      if (url.includes('dates=20260405')) {
        return scoreboardFixture([
          {
            id: 'newer',
            date: '2026-04-05T12:00:00Z',
            state: 'post',
            home: { id: 'A', name: 'A', score: '3' },
            away: { id: 'C', name: 'C', score: '2' },
          },
        ]) as Awaited<ReturnType<HistoryFetch>>;
      }
      return { events: [] };
    }) as unknown as HistoryFetch;
    const games = await fetchHistorySlice({
      teamIds: ['A'],
      leagues: ['nfl'],
      since: Date.parse('2026-04-01T00:00:00Z'),
      until: Date.parse('2026-04-05T00:00:00Z'),
      coveredDates: new Set([
        '2026-04-02',
        '2026-04-03',
        '2026-04-04',
      ]),
      fetchImpl,
    });
    expect(games.map((g) => g.id)).toEqual([
      'espn:nfl:newer',
      'espn:nfl:older',
    ]);
  });
});
