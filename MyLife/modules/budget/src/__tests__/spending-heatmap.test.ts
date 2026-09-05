import { describe, it, expect } from 'vitest';
import { getSpendingHeatmap } from '../engine/spending-heatmap';

describe('getSpendingHeatmap', () => {
  it('builds heatmap with correct intensity scaling', () => {
    const dailySpending = [
      { date: '2026-03-01', totalCents: 5000, transactionCount: 2 },
      { date: '2026-03-02', totalCents: 10000, transactionCount: 3 },
      { date: '2026-03-03', totalCents: 2500, transactionCount: 1 },
    ];

    const result = getSpendingHeatmap(dailySpending, 2026, 3, '2026-03-05');

    expect(result.year).toBe(2026);
    expect(result.month).toBe(3);
    expect(result.days).toHaveLength(5); // 5 days up to today
    expect(result.maxDailyCents).toBe(10000);
    expect(result.monthTotalCents).toBe(17500);

    // Day with max spending should have intensity 1.0
    const maxDay = result.days.find((d) => d.date === '2026-03-02');
    expect(maxDay?.intensity).toBe(1.0);

    // Day with half max should have intensity 0.5
    const halfDay = result.days.find((d) => d.date === '2026-03-01');
    expect(halfDay?.intensity).toBe(0.5);

    // Zero-spend day should have intensity 0
    const zeroDay = result.days.find((d) => d.date === '2026-03-04');
    expect(zeroDay?.totalCents).toBe(0);
    expect(zeroDay?.intensity).toBe(0);
  });

  it('does not include future days', () => {
    const result = getSpendingHeatmap([], 2026, 3, '2026-03-10');
    expect(result.days).toHaveLength(10);
    expect(result.days[result.days.length - 1].date).toBe('2026-03-10');
  });

  it('handles empty month', () => {
    const result = getSpendingHeatmap([], 2026, 3, '2026-03-05');
    expect(result.maxDailyCents).toBe(0);
    expect(result.monthTotalCents).toBe(0);
    expect(result.averageDailyCents).toBe(0);
    expect(result.days.every((d) => d.intensity === 0)).toBe(true);
  });

  it('calculates average daily spend', () => {
    const dailySpending = [
      { date: '2026-03-01', totalCents: 3000, transactionCount: 1 },
      { date: '2026-03-02', totalCents: 7000, transactionCount: 2 },
    ];

    const result = getSpendingHeatmap(dailySpending, 2026, 3, '2026-03-02');
    expect(result.averageDailyCents).toBe(5000); // (3000 + 7000) / 2
  });
});
