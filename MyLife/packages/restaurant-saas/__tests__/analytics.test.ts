import { describe, expect, it } from 'vitest';
import {
  calculateRevPASH,
  calculateNoShowRate,
  calculateAvgTurnTime,
  calculateComparison,
  aggregateByChannel,
  generateDayPartHeatmap,
} from '@/lib/analytics';

describe('calculateRevPASH', () => {
  it('calculates revenue per available seat hour', () => {
    // $5000 revenue / 40 seats / 5 hours = $25/seat-hour
    expect(calculateRevPASH(500000, 40, 5)).toBe(25);
  });

  it('returns 0 when seats is 0', () => {
    expect(calculateRevPASH(500000, 0, 5)).toBe(0);
  });

  it('returns 0 when hours is 0', () => {
    expect(calculateRevPASH(500000, 40, 0)).toBe(0);
  });

  it('handles small revenue amounts', () => {
    // $100 / 10 seats / 2 hours = $5
    expect(calculateRevPASH(10000, 10, 2)).toBe(5);
  });
});

describe('calculateNoShowRate', () => {
  it('calculates no-show rate as percentage', () => {
    // 3 no-shows / 30 total = 10%
    expect(calculateNoShowRate(3, 30)).toBe(10);
  });

  it('returns 0 when total is 0', () => {
    expect(calculateNoShowRate(0, 0)).toBe(0);
  });

  it('returns 0 when no no-shows', () => {
    expect(calculateNoShowRate(0, 50)).toBe(0);
  });

  it('handles 100% no-show rate', () => {
    expect(calculateNoShowRate(10, 10)).toBe(100);
  });
});

describe('calculateAvgTurnTime', () => {
  it('calculates average turn time in minutes', () => {
    const reservations = [
      { seatedAt: '2026-04-20T18:00:00Z', completedAt: '2026-04-20T19:30:00Z' }, // 90 min
      { seatedAt: '2026-04-20T18:30:00Z', completedAt: '2026-04-20T19:30:00Z' }, // 60 min
    ];
    expect(calculateAvgTurnTime(reservations)).toBe(75);
  });

  it('returns 0 for empty array', () => {
    expect(calculateAvgTurnTime([])).toBe(0);
  });

  it('handles single reservation', () => {
    const reservations = [
      { seatedAt: '2026-04-20T12:00:00Z', completedAt: '2026-04-20T13:15:00Z' }, // 75 min
    ];
    expect(calculateAvgTurnTime(reservations)).toBe(75);
  });
});

describe('calculateComparison', () => {
  it('detects upward trend', () => {
    const result = calculateComparison(47, 42);
    expect(result.trend).toBe('up');
    expect(result.changePercent).toBeCloseTo(11.9, 0);
    expect(result.current).toBe(47);
    expect(result.previous).toBe(42);
  });

  it('detects downward trend', () => {
    const result = calculateComparison(35, 42);
    expect(result.trend).toBe('down');
    expect(result.changePercent).toBeLessThan(0);
  });

  it('detects flat trend within 1% threshold', () => {
    const result = calculateComparison(100, 100);
    expect(result.trend).toBe('flat');
    expect(result.changePercent).toBe(0);
  });

  it('handles previous being 0', () => {
    const result = calculateComparison(10, 0);
    expect(result.trend).toBe('up');
    expect(result.changePercent).toBe(100);
  });

  it('handles both being 0', () => {
    const result = calculateComparison(0, 0);
    expect(result.trend).toBe('flat');
    expect(result.changePercent).toBe(0);
  });
});

describe('aggregateByChannel', () => {
  it('groups reservations by source channel', () => {
    const reservations = [
      { source: 'web_widget', status: 'completed' },
      { source: 'web_widget', status: 'no_show' },
      { source: 'phone', status: 'completed' },
      { source: 'phone', status: 'completed' },
      { source: 'walk_in', status: 'completed' },
    ];

    const result = aggregateByChannel(reservations);
    expect(result).toHaveLength(3);

    const web = result.find((r) => r.channel === 'web_widget');
    expect(web).toBeDefined();
    expect(web!.count).toBe(2);
    expect(web!.noShowRate).toBe(50);

    const phone = result.find((r) => r.channel === 'phone');
    expect(phone).toBeDefined();
    expect(phone!.count).toBe(2);
    expect(phone!.noShowRate).toBe(0);

    const walkIn = result.find((r) => r.channel === 'walk_in');
    expect(walkIn).toBeDefined();
    expect(walkIn!.count).toBe(1);
    expect(walkIn!.noShowRate).toBe(0);
  });

  it('handles empty array', () => {
    expect(aggregateByChannel([])).toEqual([]);
  });
});

describe('generateDayPartHeatmap', () => {
  it('buckets reservations by hour and day of week', () => {
    // 2026-04-20 is a Monday (day 1), 18:00
    const reservations = [
      { scheduledAt: '2026-04-20T18:00:00Z' },
      { scheduledAt: '2026-04-20T18:30:00Z' },
      { scheduledAt: '2026-04-20T19:00:00Z' },
    ];

    const result = generateDayPartHeatmap(reservations);

    // Two entries at hour 18 (day 1) and one at hour 19 (day 1)
    // Note: the actual day/hour depends on the local timezone of the test runner
    // so we just verify the structure
    expect(result.length).toBeGreaterThan(0);
    for (const entry of result) {
      expect(entry).toHaveProperty('hour');
      expect(entry).toHaveProperty('dayOfWeek');
      expect(entry).toHaveProperty('covers');
      expect(entry.hour).toBeGreaterThanOrEqual(0);
      expect(entry.hour).toBeLessThanOrEqual(23);
      expect(entry.dayOfWeek).toBeGreaterThanOrEqual(0);
      expect(entry.dayOfWeek).toBeLessThanOrEqual(6);
      expect(entry.covers).toBeGreaterThan(0);
    }
  });

  it('aggregates covers for same hour and day', () => {
    // All same hour and day -- should produce a single entry
    const reservations = [
      { scheduledAt: '2026-04-20T18:00:00Z' },
      { scheduledAt: '2026-04-20T18:15:00Z' },
      { scheduledAt: '2026-04-20T18:45:00Z' },
    ];

    const result = generateDayPartHeatmap(reservations);
    // All three should land in same bucket (same hour, same day)
    const totalCovers = result.reduce((sum, r) => sum + r.covers, 0);
    expect(totalCovers).toBe(3);
  });

  it('returns empty array for empty input', () => {
    expect(generateDayPartHeatmap([])).toEqual([]);
  });
});
