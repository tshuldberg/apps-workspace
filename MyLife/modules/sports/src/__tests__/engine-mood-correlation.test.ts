import { describe, expect, it } from 'vitest';
import {
  computeMoodCorrelation,
  type DailyMoodEntry,
} from '../engine/mood-correlation';
import type { Game, GameStatus } from '../types';

let idSeq = 0;
function game(overrides: {
  homeId: string | null;
  awayId: string | null;
  homeScore: number | null;
  awayScore: number | null;
  status: GameStatus;
  startAt: number;
  id?: string;
}): Game {
  idSeq += 1;
  return {
    id: overrides.id ?? `g_${idSeq}`,
    league: 'nfl',
    sport: 'football',
    home: {
      id: overrides.homeId,
      name: 'Home',
      abbreviation: null,
      score: overrides.homeScore,
    },
    away: {
      id: overrides.awayId,
      name: 'Away',
      abbreviation: null,
      score: overrides.awayScore,
    },
    status: overrides.status,
    period: null,
    clock: null,
    startAt: overrides.startAt,
    venue: null,
    broadcast: null,
    updatedAt: overrides.startAt,
  };
}

// A day's worth of ms. startAt values are arbitrary but chosen so UTC
// dateKey derivation is unambiguous.
const DAY = 86_400_000;
// 2026-01-02T00:00:00Z -> dateKey '2026-01-02'
const JAN_02_UTC = Date.UTC(2026, 0, 2, 0, 0, 0);

function mood(dateKey: string, moodScore: number): DailyMoodEntry {
  return { dateKey, moodScore };
}

describe('computeMoodCorrelation', () => {
  it('empty input returns null averages and sampleSize 0', () => {
    const result = computeMoodCorrelation({
      teamId: 't1',
      games: [],
      moodByDate: [],
    });
    expect(result).toEqual({
      teamId: 't1',
      sampleSize: 0,
      winDayAvg: null,
      lossDayAvg: null,
      tieDayAvg: null,
      nonGameDayAvg: null,
      deltaWinVsLoss: null,
      perGame: [],
    });
  });

  it('skips games not involving teamId entirely', () => {
    const games = [
      game({
        homeId: 'other_a',
        awayId: 'other_b',
        homeScore: 10,
        awayScore: 7,
        status: 'final',
        startAt: JAN_02_UTC,
      }),
    ];
    const result = computeMoodCorrelation({
      teamId: 't1',
      games,
      moodByDate: [mood('2026-01-02', 4)],
    });
    expect(result.perGame).toEqual([]);
    expect(result.sampleSize).toBe(0);
    // Mood on that date now counts as non-game-day since no t1 final game exists.
    expect(result.nonGameDayAvg).toBe(4);
  });

  it('pending games land in perGame with outcome pending and moodScore null when no entry', () => {
    const games = [
      game({
        homeId: 't1',
        awayId: 'opp',
        homeScore: null,
        awayScore: null,
        status: 'scheduled',
        startAt: JAN_02_UTC,
      }),
      game({
        homeId: 'opp',
        awayId: 't1',
        homeScore: 3,
        awayScore: 3,
        status: 'live',
        startAt: JAN_02_UTC + DAY,
      }),
    ];
    const result = computeMoodCorrelation({
      teamId: 't1',
      games,
      moodByDate: [],
    });
    expect(result.sampleSize).toBe(0);
    expect(result.winDayAvg).toBeNull();
    expect(result.lossDayAvg).toBeNull();
    expect(result.perGame).toEqual([
      {
        gameId: games[0]!.id,
        dateKey: '2026-01-02',
        outcome: 'pending',
        moodScore: null,
      },
      {
        gameId: games[1]!.id,
        dateKey: '2026-01-03',
        outcome: 'pending',
        moodScore: null,
      },
    ]);
  });

  it('computes win/loss/tie averages correctly and delta', () => {
    const games = [
      // win as home
      game({
        homeId: 't1',
        awayId: 'opp',
        homeScore: 21,
        awayScore: 10,
        status: 'final',
        startAt: JAN_02_UTC,
      }),
      // loss as away
      game({
        homeId: 'opp',
        awayId: 't1',
        homeScore: 14,
        awayScore: 3,
        status: 'final',
        startAt: JAN_02_UTC + DAY,
      }),
      // win as away
      game({
        homeId: 'opp',
        awayId: 't1',
        homeScore: 7,
        awayScore: 24,
        status: 'final',
        startAt: JAN_02_UTC + 2 * DAY,
      }),
      // tie
      game({
        homeId: 't1',
        awayId: 'opp',
        homeScore: 17,
        awayScore: 17,
        status: 'final',
        startAt: JAN_02_UTC + 3 * DAY,
      }),
    ];
    const result = computeMoodCorrelation({
      teamId: 't1',
      games,
      moodByDate: [
        mood('2026-01-02', 8), // win
        mood('2026-01-03', 3), // loss
        mood('2026-01-04', 9), // win
        mood('2026-01-05', 6), // tie
      ],
    });
    expect(result.winDayAvg).toBe(8.5); // (8+9)/2
    expect(result.lossDayAvg).toBe(3);
    expect(result.tieDayAvg).toBe(6);
    expect(result.deltaWinVsLoss).toBe(5.5);
    expect(result.sampleSize).toBe(4);
    expect(result.nonGameDayAvg).toBeNull();
  });

  it('nonGameDayAvg excludes dates matching any final game for this team', () => {
    const games = [
      game({
        homeId: 't1',
        awayId: 'opp',
        homeScore: 10,
        awayScore: 0,
        status: 'final',
        startAt: JAN_02_UTC,
      }),
      // Pending game on 2026-01-03 should NOT exclude that mood from non-game avg.
      game({
        homeId: 't1',
        awayId: 'opp',
        homeScore: null,
        awayScore: null,
        status: 'scheduled',
        startAt: JAN_02_UTC + DAY,
      }),
    ];
    const result = computeMoodCorrelation({
      teamId: 't1',
      games,
      moodByDate: [
        mood('2026-01-02', 9), // coincides with final -> win slice
        mood('2026-01-03', 5), // pending game date -> still counts as non-game-day
        mood('2026-01-10', 4), // unrelated -> non-game-day
      ],
    });
    expect(result.winDayAvg).toBe(9);
    expect(result.nonGameDayAvg).toBe(4.5); // (5+4)/2
  });

  it('deltaWinVsLoss is null when one side has no data', () => {
    const games = [
      game({
        homeId: 't1',
        awayId: 'opp',
        homeScore: 21,
        awayScore: 10,
        status: 'final',
        startAt: JAN_02_UTC,
      }),
    ];
    const result = computeMoodCorrelation({
      teamId: 't1',
      games,
      moodByDate: [mood('2026-01-02', 7)],
    });
    expect(result.winDayAvg).toBe(7);
    expect(result.lossDayAvg).toBeNull();
    expect(result.deltaWinVsLoss).toBeNull();
  });

  it('dateKey derivation uses UTC even when start_at crosses local midnight', () => {
    // 2026-06-15T23:30:00Z -> UTC date '2026-06-15' regardless of local TZ.
    const startAt = Date.UTC(2026, 5, 15, 23, 30, 0);
    const games = [
      game({
        homeId: 't1',
        awayId: 'opp',
        homeScore: 2,
        awayScore: 1,
        status: 'final',
        startAt,
      }),
    ];
    const result = computeMoodCorrelation({
      teamId: 't1',
      games,
      moodByDate: [mood('2026-06-15', 8)],
    });
    expect(result.perGame[0]!.dateKey).toBe('2026-06-15');
    expect(result.winDayAvg).toBe(8);
    expect(result.sampleSize).toBe(1);
  });

  it('rounds averages to 2 decimal places', () => {
    const games = [
      game({
        homeId: 't1',
        awayId: 'opp',
        homeScore: 1,
        awayScore: 0,
        status: 'final',
        startAt: JAN_02_UTC,
      }),
      game({
        homeId: 't1',
        awayId: 'opp',
        homeScore: 1,
        awayScore: 0,
        status: 'final',
        startAt: JAN_02_UTC + DAY,
      }),
      game({
        homeId: 't1',
        awayId: 'opp',
        homeScore: 1,
        awayScore: 0,
        status: 'final',
        startAt: JAN_02_UTC + 2 * DAY,
      }),
    ];
    // 1 + 2 + 2 = 5, /3 = 1.6666... -> 1.67
    const result = computeMoodCorrelation({
      teamId: 't1',
      games,
      moodByDate: [
        mood('2026-01-02', 1),
        mood('2026-01-03', 2),
        mood('2026-01-04', 2),
      ],
    });
    expect(result.winDayAvg).toBe(1.67);
  });

  it('perGame is sorted ascending by startAt and includes pending rows', () => {
    const later = game({
      homeId: 't1',
      awayId: 'opp',
      homeScore: 5,
      awayScore: 3,
      status: 'final',
      startAt: JAN_02_UTC + 2 * DAY,
      id: 'g_later',
    });
    const earlier = game({
      homeId: 't1',
      awayId: 'opp',
      homeScore: null,
      awayScore: null,
      status: 'scheduled',
      startAt: JAN_02_UTC,
      id: 'g_earlier',
    });
    const result = computeMoodCorrelation({
      teamId: 't1',
      games: [later, earlier],
      moodByDate: [],
    });
    expect(result.perGame.map((r) => r.gameId)).toEqual([
      'g_earlier',
      'g_later',
    ]);
    expect(result.perGame[0]!.outcome).toBe('pending');
    expect(result.perGame[1]!.outcome).toBe('W');
  });
});
