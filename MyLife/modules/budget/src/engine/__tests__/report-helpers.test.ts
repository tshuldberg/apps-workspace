import { describe, it, expect } from 'vitest';
import {
  assignChartColors,
  bucketizeCategories,
  calculateSavingsRate,
  formatCentsAsDollars,
  getDateRangePreset,
  CHART_COLORS,
} from '../report-helpers';
import type { BucketizedCategory } from '../report-helpers';

describe('assignChartColors', () => {
  it('maps categories to fixed palette positions', () => {
    const categories = [
      { categoryId: 'a' },
      { categoryId: 'b' },
      { categoryId: 'c' },
    ];
    const colors = assignChartColors(categories);
    expect(colors.get('a')).toBe(CHART_COLORS[0]);
    expect(colors.get('b')).toBe(CHART_COLORS[1]);
    expect(colors.get('c')).toBe(CHART_COLORS[2]);
  });

  it('wraps around palette for more than 8 categories', () => {
    const categories = Array.from({ length: 10 }, (_, i) => ({
      categoryId: `cat-${i}`,
    }));
    const colors = assignChartColors(categories);
    expect(colors.get('cat-8')).toBe(CHART_COLORS[0]);
    expect(colors.get('cat-9')).toBe(CHART_COLORS[1]);
  });
});

describe('bucketizeCategories', () => {
  const makeCategory = (id: string, amount: number): BucketizedCategory => ({
    categoryId: id,
    categoryName: `Cat ${id}`,
    amount,
    percentage: 0,
    transactionCount: 1,
  });

  it('returns categories as-is when <= maxCategories', () => {
    const cats = [makeCategory('a', 500), makeCategory('b', 300)];
    const result = bucketizeCategories(cats, 7);
    expect(result).toHaveLength(2);
  });

  it('groups categories beyond top 7 into Other', () => {
    const cats = Array.from({ length: 10 }, (_, i) =>
      makeCategory(`cat-${i}`, (10 - i) * 100),
    );
    const result = bucketizeCategories(cats, 7);
    expect(result).toHaveLength(8); // 7 + Other
    expect(result[7].categoryName).toBe('Other');
    expect(result[7].amount).toBe(100 + 200 + 300); // last 3 categories
  });
});

describe('calculateSavingsRate', () => {
  it('returns correct percentage for income > 0', () => {
    expect(calculateSavingsRate(100000, 80000)).toBe(20);
  });

  it('returns 0 for zero income', () => {
    expect(calculateSavingsRate(0, 5000)).toBe(0);
  });

  it('returns negative savings rate when expenses > income', () => {
    expect(calculateSavingsRate(50000, 75000)).toBe(-50);
  });

  it('returns 100% when no expenses', () => {
    expect(calculateSavingsRate(100000, 0)).toBe(100);
  });
});

describe('getDateRangePreset', () => {
  const today = '2026-03-15';

  it('returns correct range for thisMonth', () => {
    const range = getDateRangePreset('thisMonth', today);
    expect(range.start).toBe('2026-03-01');
    expect(range.end).toBe('2026-03-15');
  });

  it('returns correct range for lastMonth', () => {
    const range = getDateRangePreset('lastMonth', today);
    expect(range.start).toBe('2026-02-01');
    expect(range.end).toBe('2026-02-28');
  });

  it('returns correct range for last3Months', () => {
    const range = getDateRangePreset('last3Months', today);
    expect(range.start).toBe('2026-01-01');
    expect(range.end).toBe('2026-03-15');
  });

  it('returns correct range for thisYear', () => {
    const range = getDateRangePreset('thisYear', today);
    expect(range.start).toBe('2026-01-01');
    expect(range.end).toBe('2026-03-15');
  });

  it('returns correct range for lastYear', () => {
    const range = getDateRangePreset('lastYear', today);
    expect(range.start).toBe('2025-01-01');
    expect(range.end).toBe('2025-12-31');
  });

  it('returns correct range for allTime with earliest date', () => {
    const range = getDateRangePreset('allTime', today, '2024-06-01');
    expect(range.start).toBe('2024-06-01');
    expect(range.end).toBe('2026-03-15');
  });

  it('returns fallback range for allTime without earliest date', () => {
    const range = getDateRangePreset('allTime', today);
    expect(range.start).toBe('2016-01-01');
    expect(range.end).toBe('2026-03-15');
  });
});

describe('formatCentsAsDollars', () => {
  it('formats positive amounts', () => {
    expect(formatCentsAsDollars(150000)).toBe('$1,500.00');
  });

  it('formats negative amounts', () => {
    expect(formatCentsAsDollars(-50000)).toBe('-$500.00');
  });

  it('formats zero', () => {
    expect(formatCentsAsDollars(0)).toBe('$0.00');
  });

  it('formats large values', () => {
    expect(formatCentsAsDollars(100000000)).toBe('$1,000,000.00');
  });

  it('formats amounts with cents', () => {
    expect(formatCentsAsDollars(1050)).toBe('$10.50');
  });
});
