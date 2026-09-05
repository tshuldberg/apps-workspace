import { describe, it, expect } from 'vitest';
import { calculateSpendingPulse } from '../engine/spending-pulse';

describe('calculateSpendingPulse', () => {
  it('returns positive remaining when under budget', () => {
    const result = calculateSpendingPulse({
      totalBudgetCents: 500000, // $5,000
      spentThisMonthCents: 315300, // $3,153
      spentLastMonthCents: null,
      today: '2026-03-15',
    });

    expect(result.remainingCents).toBe(184700);
    expect(result.spentCents).toBe(315300);
    expect(result.summary).toBe("You're $1847 ahead this month");
    expect(result.daysRemaining).toBe(16);
    expect(result.safeDailySpendCents).toBe(Math.round(184700 / 16));
  });

  it('returns negative remaining when over budget', () => {
    const result = calculateSpendingPulse({
      totalBudgetCents: 300000,
      spentThisMonthCents: 345000,
      spentLastMonthCents: null,
      today: '2026-03-20',
    });

    expect(result.remainingCents).toBe(-45000);
    expect(result.summary).toBe("You're $450 over budget this month");
    expect(result.safeDailySpendCents).toBe(0);
  });

  it('calculates month-over-month change', () => {
    const result = calculateSpendingPulse({
      totalBudgetCents: 400000,
      spentThisMonthCents: 200000,
      spentLastMonthCents: 250000,
      today: '2026-03-15',
    });

    // (200000 - 250000) / 250000 = -0.2
    expect(result.monthOverMonthChange).toBeCloseTo(-0.2);
  });

  it('returns null month-over-month when no prior data', () => {
    const result = calculateSpendingPulse({
      totalBudgetCents: 400000,
      spentThisMonthCents: 200000,
      spentLastMonthCents: null,
      today: '2026-03-15',
    });

    expect(result.monthOverMonthChange).toBeNull();
  });

  it('handles last day of month', () => {
    const result = calculateSpendingPulse({
      totalBudgetCents: 400000,
      spentThisMonthCents: 380000,
      spentLastMonthCents: null,
      today: '2026-03-31',
    });

    expect(result.daysRemaining).toBe(0);
    expect(result.safeDailySpendCents).toBe(0);
  });

  it('handles zero budget', () => {
    const result = calculateSpendingPulse({
      totalBudgetCents: 0,
      spentThisMonthCents: 10000,
      spentLastMonthCents: null,
      today: '2026-03-15',
    });

    expect(result.remainingPercent).toBe(0);
    expect(result.remainingCents).toBe(-10000);
  });
});
