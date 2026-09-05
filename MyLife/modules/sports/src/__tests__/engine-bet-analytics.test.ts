import { describe, expect, it } from 'vitest';
import {
  americanToDecimal,
  americanToFractional,
  combineDecimalOdds,
  computeBetStats,
  computeStreak,
  computeUnitsPnL,
  decimalToAmerican,
  groupStatsBy,
} from '../engine/bet-analytics';
import type { Bet } from '../types';

function bet(overrides: Partial<Bet> = {}): Bet {
  const ts = 1_700_000_000_000;
  return {
    id: `bet_${Math.random().toString(36).slice(2, 8)}`,
    sport: 'football',
    league: 'nfl',
    game_id: null,
    team_id: null,
    bet_type: 'moneyline',
    description: 'Cowboys ML',
    sportsbook: 'FanDuel',
    odds_american: 150,
    stake_cents: 10_000,
    potential_payout_cents: 25_000,
    units: 1,
    result: 'pending',
    profit_loss_cents: 0,
    placed_at: ts,
    settled_at: null,
    notes_md: null,
    created_at: ts,
    updated_at: ts,
    ...overrides,
  };
}

describe('bet-analytics: odds conversions', () => {
  it('americanToDecimal handles favorites + underdogs', () => {
    expect(americanToDecimal(150)).toBeCloseTo(2.5, 10);
    expect(americanToDecimal(-110)).toBeCloseTo(1.909, 3);
    expect(americanToDecimal(100)).toBeCloseTo(2.0, 10);
    expect(americanToDecimal(-200)).toBeCloseTo(1.5, 10);
  });

  it('americanToDecimal rejects 0', () => {
    expect(() => americanToDecimal(0)).toThrow();
  });

  it('decimalToAmerican edge cases', () => {
    expect(decimalToAmerican(2.5)).toBe(150);
    expect(decimalToAmerican(2.0)).toBe(100);
    expect(decimalToAmerican(1.5)).toBe(-200);
    expect(decimalToAmerican(1.909)).toBe(-110);
    expect(() => decimalToAmerican(1)).toThrow();
    expect(() => decimalToAmerican(0.5)).toThrow();
  });

  it('round-trips american -> decimal -> american', () => {
    for (const odds of [150, -110, 100, -200, 300, -500]) {
      expect(decimalToAmerican(americanToDecimal(odds))).toBe(odds);
    }
  });

  it('americanToFractional reduces via GCD', () => {
    expect(americanToFractional(150)).toBe('3/2');
    expect(americanToFractional(200)).toBe('2/1');
    expect(americanToFractional(-200)).toBe('1/2');
    expect(americanToFractional(100)).toBe('1/1');
  });

  it('combineDecimalOdds multiplies legs', () => {
    expect(combineDecimalOdds([2.0, 3.0])).toBeCloseTo(6.0, 10);
    expect(combineDecimalOdds([1.5, 1.5, 1.5])).toBeCloseTo(3.375, 10);
    expect(combineDecimalOdds([])).toBe(1);
  });
});

describe('bet-analytics: computeBetStats', () => {
  it('returns null rates when nothing is settled', () => {
    const stats = computeBetStats([bet(), bet(), bet()]);
    expect(stats.totalBets).toBe(3);
    expect(stats.settledBets).toBe(0);
    expect(stats.pending).toBe(3);
    expect(stats.winRatePct).toBeNull();
    expect(stats.roiPct).not.toBeNull(); // total stake > 0 so roi computable
    expect(stats.avgOddsAmerican).toBe(150);
  });

  it('returns null winRatePct when only pushes/voids', () => {
    const stats = computeBetStats([
      bet({ result: 'push', settled_at: 1 }),
      bet({ result: 'void', settled_at: 1 }),
    ]);
    expect(stats.wins).toBe(0);
    expect(stats.losses).toBe(0);
    expect(stats.winRatePct).toBeNull();
    expect(stats.profitLossCents).toBe(0);
  });

  it('computes winRate + roi across mixed results', () => {
    const stats = computeBetStats([
      bet({
        result: 'won',
        profit_loss_cents: 15_000,
        stake_cents: 10_000,
        potential_payout_cents: 25_000,
        settled_at: 1,
      }),
      bet({
        result: 'lost',
        profit_loss_cents: -10_000,
        stake_cents: 10_000,
        settled_at: 2,
      }),
      bet({
        result: 'won',
        profit_loss_cents: 5_000,
        stake_cents: 10_000,
        potential_payout_cents: 15_000,
        settled_at: 3,
      }),
    ]);
    expect(stats.wins).toBe(2);
    expect(stats.losses).toBe(1);
    expect(stats.winRatePct).toBeCloseTo((2 / 3) * 100, 5);
    expect(stats.totalStakeCents).toBe(30_000);
    expect(stats.profitLossCents).toBe(10_000);
    expect(stats.roiPct).toBeCloseTo((10_000 / 30_000) * 100, 5);
  });

  it('handles empty input', () => {
    const stats = computeBetStats([]);
    expect(stats.totalBets).toBe(0);
    expect(stats.winRatePct).toBeNull();
    expect(stats.roiPct).toBeNull();
    expect(stats.avgOddsAmerican).toBeNull();
  });
});

describe('bet-analytics: groupStatsBy', () => {
  it('groups bets by sport and computes per-group stats', () => {
    const bets = [
      bet({ sport: 'football', result: 'won', profit_loss_cents: 15_000, settled_at: 1 }),
      bet({ sport: 'football', result: 'lost', profit_loss_cents: -10_000, settled_at: 2 }),
      bet({ sport: 'basketball', result: 'won', profit_loss_cents: 10_000, settled_at: 3 }),
    ];
    const grouped = groupStatsBy(bets, (b) => b.sport);
    expect(grouped.size).toBe(2);
    expect(grouped.get('football')?.totalBets).toBe(2);
    expect(grouped.get('basketball')?.totalBets).toBe(1);
    expect(grouped.get('football')?.profitLossCents).toBe(5_000);
  });
});

describe('bet-analytics: computeStreak', () => {
  it('tracks current streak + longest win/loss runs chronologically', () => {
    const bets = [
      bet({ result: 'won', settled_at: 1 }),
      bet({ result: 'won', settled_at: 2 }),
      bet({ result: 'lost', settled_at: 3 }),
      bet({ result: 'lost', settled_at: 4 }),
      bet({ result: 'lost', settled_at: 5 }),
      bet({ result: 'won', settled_at: 6 }),
    ];
    const streak = computeStreak(bets);
    expect(streak.longestWin).toBe(2);
    expect(streak.longestLoss).toBe(3);
    expect(streak.current).toEqual({ type: 'W', length: 1 });
  });

  it('pushes + voids break the streak without counting', () => {
    const bets = [
      bet({ result: 'won', settled_at: 1 }),
      bet({ result: 'won', settled_at: 2 }),
      bet({ result: 'push', settled_at: 3 }),
      bet({ result: 'won', settled_at: 4 }),
    ];
    const streak = computeStreak(bets);
    expect(streak.longestWin).toBe(2);
    expect(streak.current).toEqual({ type: 'W', length: 1 });
  });

  it('ignores pending bets and returns empty state on empty input', () => {
    expect(computeStreak([])).toEqual({
      current: { type: null, length: 0 },
      longestWin: 0,
      longestLoss: 0,
    });
    const streak = computeStreak([bet(), bet()]);
    expect(streak.current.type).toBeNull();
    expect(streak.longestWin).toBe(0);
  });
});

describe('bet-analytics: computeUnitsPnL', () => {
  it('scales profit/loss by unit size', () => {
    const bets = [
      bet({ result: 'won', profit_loss_cents: 15_000, settled_at: 1 }),
      bet({ result: 'lost', profit_loss_cents: -10_000, settled_at: 2 }),
    ];
    const pnl = computeUnitsPnL(bets, 1_000);
    expect(pnl.wonUnits).toBe(15);
    expect(pnl.lostUnits).toBe(10);
    expect(pnl.netUnits).toBe(5);
  });

  it('returns zeros when unit size is zero', () => {
    const bets = [
      bet({ result: 'won', profit_loss_cents: 15_000, settled_at: 1 }),
    ];
    expect(computeUnitsPnL(bets, 0)).toEqual({
      wonUnits: 0,
      lostUnits: 0,
      netUnits: 0,
    });
  });
});
