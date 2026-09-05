import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  GAME_DETAIL_IDLE_TTL_MS,
  GAME_DETAIL_LIVE_TTL_MS,
  clearGameDetailCache,
  fetchGameDetail,
  pickGameDetailTtl,
  type GameDetailFetch,
} from '../engine/game-detail';

// ---------------------------------------------------------------------------
// Fixture builders. The summary payload's `header.competitions[0]` mirrors
// the scoreboard competitor shape; box-score leaders live under
// `boxscore.players[]` keyed by team id/homeAway.
// ---------------------------------------------------------------------------

interface FixtureLinescore {
  home: number;
  away: number;
}

interface FixtureLeader {
  side: 'home' | 'away';
  category: string;
  displayValue: string;
  athleteName?: string;
}

interface SummaryFixtureInput {
  gameId: string;
  state: 'pre' | 'in' | 'post';
  home: { id: string; name: string; abbr?: string; score?: string };
  away: { id: string; name: string; abbr?: string; score?: string };
  period?: string;
  clock?: string;
  venue?: string;
  broadcasts?: string[];
  linescores?: FixtureLinescore[];
  leaders?: FixtureLeader[];
  weather?: string;
}

function summaryFixture(input: SummaryFixtureInput): unknown {
  const homeLines = (input.linescores ?? []).map((l) => ({ value: l.home }));
  const awayLines = (input.linescores ?? []).map((l) => ({ value: l.away }));

  const leaderBlocks: Record<'home' | 'away', FixtureLeader[]> = {
    home: (input.leaders ?? []).filter((l) => l.side === 'home'),
    away: (input.leaders ?? []).filter((l) => l.side === 'away'),
  };

  const boxscorePlayers = (['home', 'away'] as const).map((side) => ({
    team: {
      id: side === 'home' ? input.home.id : input.away.id,
      homeAway: side,
    },
    leaders: leaderBlocks[side].map((l) => ({
      name: l.category,
      displayName: l.category,
      leaders: [
        {
          displayValue: l.displayValue,
          athlete: l.athleteName ? { displayName: l.athleteName } : undefined,
        },
      ],
    })),
  }));

  return {
    header: {
      id: input.gameId,
      competitions: [
        {
          competitors: [
            {
              homeAway: 'home',
              score: input.home.score,
              linescores: homeLines,
              team: {
                id: input.home.id,
                displayName: input.home.name,
                abbreviation: input.home.abbr,
              },
            },
            {
              homeAway: 'away',
              score: input.away.score,
              linescores: awayLines,
              team: {
                id: input.away.id,
                displayName: input.away.name,
                abbreviation: input.away.abbr,
              },
            },
          ],
          status: {
            type: { state: input.state, shortDetail: input.period },
            displayClock: input.clock,
          },
          venue: input.venue ? { fullName: input.venue } : undefined,
          broadcasts: input.broadcasts
            ? [{ names: input.broadcasts }]
            : undefined,
        },
      ],
    },
    boxscore: { players: boxscorePlayers },
    gameInfo: input.weather
      ? { weather: { displayValue: input.weather } }
      : undefined,
  };
}

function makeFetch(
  fixtures: Partial<Record<string, unknown>>,
): GameDetailFetch {
  return vi.fn(async (url: string) => {
    for (const key of Object.keys(fixtures)) {
      if (url.includes(`event=${key}`)) {
        return fixtures[key] as Awaited<ReturnType<GameDetailFetch>>;
      }
    }
    return {};
  });
}

describe('pickGameDetailTtl', () => {
  it('uses a short TTL for live games', () => {
    expect(pickGameDetailTtl('live')).toBe(GAME_DETAIL_LIVE_TTL_MS);
  });

  it('uses the idle TTL for scheduled and final games', () => {
    expect(pickGameDetailTtl('scheduled')).toBe(GAME_DETAIL_IDLE_TTL_MS);
    expect(pickGameDetailTtl('final')).toBe(GAME_DETAIL_IDLE_TTL_MS);
  });
});

describe('fetchGameDetail', () => {
  afterEach(() => {
    clearGameDetailCache();
  });

  it('normalizes header + periods + leaders into a GameDetail', async () => {
    const fetchImpl = makeFetch({
      '401': summaryFixture({
        gameId: '401',
        state: 'post',
        home: { id: '6', name: 'Dallas Cowboys', abbr: 'DAL', score: '27' },
        away: { id: '7', name: 'Philadelphia Eagles', abbr: 'PHI', score: '20' },
        period: 'Final',
        venue: 'AT&T Stadium',
        broadcasts: ['FOX'],
        linescores: [
          { home: 7, away: 3 },
          { home: 10, away: 7 },
          { home: 3, away: 7 },
          { home: 7, away: 3 },
        ],
        leaders: [
          {
            side: 'home',
            category: 'Passing',
            displayValue: '320 yds, 3 TD',
            athleteName: 'Dak Prescott',
          },
          {
            side: 'away',
            category: 'Passing',
            displayValue: '280 yds, 2 TD',
            athleteName: 'Jalen Hurts',
          },
        ],
        weather: 'Clear 58°',
      }),
    });
    const detail = await fetchGameDetail({
      gameId: 'espn:nfl:401',
      league: 'nfl',
      fetchImpl,
    });
    expect(detail).not.toBeNull();
    if (!detail) return;
    expect(detail.id).toBe('espn:nfl:401');
    expect(detail.status).toBe('final');
    expect(detail.home.score).toBe(27);
    expect(detail.away.score).toBe(20);
    expect(detail.periods).toHaveLength(4);
    expect(detail.periods[0]).toEqual({
      period: 1,
      homeScore: 7,
      awayScore: 3,
    });
    expect(detail.periods[3]).toEqual({
      period: 4,
      homeScore: 7,
      awayScore: 3,
    });
    expect(detail.leaders).toHaveLength(2);
    expect(detail.leaders?.[0]).toMatchObject({
      teamSide: 'home',
      displayValue: '320 yds, 3 TD',
      athleteName: 'Dak Prescott',
    });
    expect(detail.weather).toBe('Clear 58°');
    expect(detail.venue).toBe('AT&T Stadium');
    expect(detail.broadcast).toBe('FOX');
  });

  it('accepts a raw ESPN event id and builds the right URL', async () => {
    const fetchImpl = makeFetch({
      '900': summaryFixture({
        gameId: '900',
        state: 'in',
        home: { id: '13', name: 'Lakers', score: '55' },
        away: { id: '14', name: 'Clippers', score: '60' },
        period: '3rd Qtr',
        clock: '4:12',
        linescores: [
          { home: 20, away: 22 },
          { home: 18, away: 20 },
          { home: 17, away: 18 },
        ],
      }),
    });
    const detail = await fetchGameDetail({
      gameId: '900',
      league: 'nba',
      fetchImpl,
    });
    expect(detail?.status).toBe('live');
    expect(detail?.clock).toBe('4:12');
    expect(detail?.periods).toHaveLength(3);
    const [url] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0] as [string];
    expect(url).toContain('/basketball/nba/summary?event=900');
  });

  it('caches with the short TTL for live games', async () => {
    const fetchImpl = makeFetch({
      '500': summaryFixture({
        gameId: '500',
        state: 'in',
        home: { id: '6', name: 'Home', score: '10' },
        away: { id: '7', name: 'Away', score: '7' },
      }),
    });
    await fetchGameDetail({
      gameId: 'espn:nfl:500',
      league: 'nfl',
      fetchImpl,
      now: 1_000,
    });
    await fetchGameDetail({
      gameId: 'espn:nfl:500',
      league: 'nfl',
      fetchImpl,
      now: 1_000 + GAME_DETAIL_LIVE_TTL_MS - 1,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    await fetchGameDetail({
      gameId: 'espn:nfl:500',
      league: 'nfl',
      fetchImpl,
      now: 1_000 + GAME_DETAIL_LIVE_TTL_MS + 10,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('caches with the idle TTL for final games (and survives past the live TTL)', async () => {
    const fetchImpl = makeFetch({
      '600': summaryFixture({
        gameId: '600',
        state: 'post',
        home: { id: '6', name: 'Home', score: '21' },
        away: { id: '7', name: 'Away', score: '14' },
      }),
    });
    await fetchGameDetail({
      gameId: 'espn:nfl:600',
      league: 'nfl',
      fetchImpl,
      now: 10_000,
    });
    // Past the live TTL but inside idle TTL -- still cached.
    await fetchGameDetail({
      gameId: 'espn:nfl:600',
      league: 'nfl',
      fetchImpl,
      now: 10_000 + GAME_DETAIL_LIVE_TTL_MS + 1_000,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    // Past idle TTL -- refetches.
    await fetchGameDetail({
      gameId: 'espn:nfl:600',
      league: 'nfl',
      fetchImpl,
      now: 10_000 + GAME_DETAIL_IDLE_TTL_MS + 1_000,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('propagates AbortSignal and rejects when aborted', async () => {
    const fetchImpl: GameDetailFetch = (_url, init) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener('abort', () =>
          reject(new DOMException('aborted', 'AbortError')),
        );
      });
    const controller = new AbortController();
    const pending = fetchGameDetail({
      gameId: 'espn:nfl:400',
      league: 'nfl',
      fetchImpl,
      signal: controller.signal,
    });
    controller.abort();
    await expect(pending).rejects.toThrow(/abort/i);
  });

  it('returns null when the header is missing', async () => {
    const fetchImpl: GameDetailFetch = vi.fn(async () => ({}));
    const detail = await fetchGameDetail({
      gameId: 'espn:nfl:unknown',
      league: 'nfl',
      fetchImpl,
    });
    expect(detail).toBeNull();
  });

  it('returns null for an unknown league without calling fetch', async () => {
    const fetchImpl = vi.fn(async () => ({}));
    const detail = await fetchGameDetail({
      gameId: 'espn:xfl:1',
      league: 'xfl' as never,
      fetchImpl: fetchImpl as unknown as GameDetailFetch,
    });
    expect(detail).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('returns null when a competitor is missing a display name', async () => {
    const payload = {
      header: {
        id: 'broken',
        competitions: [
          {
            competitors: [
              { homeAway: 'home', team: { id: '6' } },
              { homeAway: 'away', team: { id: '7', displayName: 'Giants' } },
            ],
            status: { type: { state: 'post' } },
          },
        ],
      },
    };
    const fetchImpl: GameDetailFetch = vi.fn(
      async () => payload as unknown as Awaited<ReturnType<GameDetailFetch>>,
    );
    const detail = await fetchGameDetail({
      gameId: 'espn:nfl:broken',
      league: 'nfl',
      fetchImpl,
    });
    expect(detail).toBeNull();
  });
});
