import { describe, it, expect } from 'vitest';
import {
  getNoSpendStreak,
  getNoSpendDaysInMonth,
  calculateNoSpendStats,
} from '../engine/no-spend-streak';

describe('getNoSpendStreak', () => {
  it('returns 0 when today has spending', () => {
    const result = getNoSpendStreak(['2026-03-15'], '2026-03-15');
    expect(result).toBe(0);
  });

  it('counts consecutive no-spend days from today backward', () => {
    // Spent on the 12th, nothing on 13, 14, 15
    const result = getNoSpendStreak(['2026-03-12'], '2026-03-15');
    expect(result).toBe(3);
  });

  it('returns lookback limit when no spending found', () => {
    const result = getNoSpendStreak([], '2026-03-15', 5);
    expect(result).toBe(5);
  });

  it('handles multiple spend days correctly', () => {
    // Spent on 13 and 10. From 15: 15 no, 14 no, 13 yes -> streak = 2
    const result = getNoSpendStreak(['2026-03-13', '2026-03-10'], '2026-03-15');
    expect(result).toBe(2);
  });
});

describe('getNoSpendDaysInMonth', () => {
  it('counts no-spend days up to today', () => {
    // 5 days in March, spent on 2 of them
    const result = getNoSpendDaysInMonth(
      ['2026-03-02', '2026-03-04'],
      2026, 3,
      '2026-03-05',
    );
    expect(result).toBe(3); // days 1, 3, 5
  });

  it('returns all days when no spending', () => {
    const result = getNoSpendDaysInMonth([], 2026, 3, '2026-03-05');
    expect(result).toBe(5);
  });

  it('returns 0 when every day has spending', () => {
    const dates = ['2026-03-01', '2026-03-02', '2026-03-03'];
    const result = getNoSpendDaysInMonth(dates, 2026, 3, '2026-03-03');
    expect(result).toBe(0);
  });
});

describe('calculateNoSpendStats', () => {
  it('returns comprehensive stats', () => {
    const outflowDates = ['2026-03-02', '2026-03-05', '2026-03-08'];
    const result = calculateNoSpendStats(outflowDates, '2026-03-10');

    expect(result.daysElapsed).toBe(10);
    expect(result.noSpendDaysThisMonth).toBe(7); // 10 days - 3 spend days
    expect(result.noSpendPercent).toBe(70);
    expect(result.currentStreak).toBe(2); // 9, 10 are no-spend
    expect(result.longestStreak).toBeGreaterThanOrEqual(2);
  });

  it('handles first day of month', () => {
    const result = calculateNoSpendStats([], '2026-03-01');
    expect(result.daysElapsed).toBe(1);
    expect(result.noSpendDaysThisMonth).toBe(1);
    expect(result.noSpendPercent).toBe(100);
  });
});
