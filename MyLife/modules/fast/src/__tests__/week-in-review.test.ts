import { describe, it, expect } from 'vitest';
import { computeWeekInReview } from '../engines/week-in-review';
import type { Fast } from '../types';

function makeFast(overrides: Partial<Fast> = {}): Fast {
  return {
    id: 'f1',
    protocol: '16:8',
    targetHours: 16,
    startedAt: '2026-03-16T20:00:00Z',
    endedAt: '2026-03-17T12:00:00Z',
    durationSeconds: 57600, // 16 hours
    hitTarget: true,
    notes: null,
    createdAt: '2026-03-16T20:00:00Z',
    ...overrides,
  };
}

describe('computeWeekInReview', () => {
  it('computes summary for a week with fasts and hydration', () => {
    const result = computeWeekInReview({
      periodStart: '2026-03-16',
      periodEnd: '2026-03-22',
      fasts: [
        makeFast({ id: 'f1', durationSeconds: 57600, hitTarget: true }),
        makeFast({ id: 'f2', durationSeconds: 64800, hitTarget: true }), // 18h
        makeFast({ id: 'f3', durationSeconds: 57600, hitTarget: false }),
      ],
      dailyHydration: [
        { date: '2026-03-16', totalOz: 72 },
        { date: '2026-03-17', totalOz: 64 },
        { date: '2026-03-18', totalOz: 80 },
      ],
      dailyCaffeine: [
        { date: '2026-03-16', totalMg: 190 },
        { date: '2026-03-17', totalMg: 95 },
      ],
      weights: [
        { date: '2026-03-16', value: 175.0, unit: 'lbs' },
        { date: '2026-03-22', value: 174.2, unit: 'lbs' },
      ],
      hydrationTargetOz: 64, // 8 glasses
      caffeineCutoffTime: '14:00',
      currentStreak: 5,
    });

    expect(result.periodStart).toBe('2026-03-16');
    expect(result.periodEnd).toBe('2026-03-22');
    expect(result.totalFasts).toBe(3);
    expect(result.completedFasts).toBe(3);
    expect(result.totalFastingHours).toBe(50); // (57600 + 64800 + 57600) / 3600 = 50
    expect(result.avgDailyHydrationOz).toBe(72); // (72 + 64 + 80) / 3
    expect(result.avgCaffeineMg).toBe(143); // (190 + 95) / 2 rounded
    expect(result.weightDelta).toBe(-0.8);
    expect(result.streakAtEnd).toBe(5);
    expect(result.avgQualityScore).toBeGreaterThan(0);
    expect(result.bestDay).toBeTruthy();
  });

  it('handles empty week gracefully', () => {
    const result = computeWeekInReview({
      periodStart: '2026-03-16',
      periodEnd: '2026-03-22',
      fasts: [],
      dailyHydration: [],
      dailyCaffeine: [],
      weights: [],
      hydrationTargetOz: 64,
      caffeineCutoffTime: '14:00',
      currentStreak: 0,
    });

    expect(result.totalFasts).toBe(0);
    expect(result.completedFasts).toBe(0);
    expect(result.totalFastingHours).toBe(0);
    expect(result.avgDailyHydrationOz).toBe(0);
    expect(result.avgCaffeineMg).toBe(0);
    expect(result.weightDelta).toBeNull();
    expect(result.avgQualityScore).toBe(0);
    expect(result.bestDay).toBeNull();
  });

  it('handles incomplete fasts (no endedAt)', () => {
    const result = computeWeekInReview({
      periodStart: '2026-03-16',
      periodEnd: '2026-03-22',
      fasts: [
        makeFast({ endedAt: null, durationSeconds: null, hitTarget: null }),
      ],
      dailyHydration: [],
      dailyCaffeine: [],
      weights: [],
      hydrationTargetOz: 64,
      caffeineCutoffTime: '14:00',
      currentStreak: 0,
    });

    expect(result.totalFasts).toBe(1);
    expect(result.completedFasts).toBe(0);
    expect(result.totalFastingHours).toBe(0);
  });

  it('returns null weight delta with only one weight entry', () => {
    const result = computeWeekInReview({
      periodStart: '2026-03-16',
      periodEnd: '2026-03-22',
      fasts: [],
      dailyHydration: [],
      dailyCaffeine: [],
      weights: [{ date: '2026-03-16', value: 175.0, unit: 'lbs' }],
      hydrationTargetOz: 64,
      caffeineCutoffTime: '14:00',
      currentStreak: 0,
    });

    expect(result.weightDelta).toBeNull();
  });

  it('computes quality scores with hydration below target', () => {
    const result = computeWeekInReview({
      periodStart: '2026-03-16',
      periodEnd: '2026-03-22',
      fasts: [makeFast({ hitTarget: true })],
      dailyHydration: [{ date: '2026-03-16', totalOz: 32 }], // below 64oz target
      dailyCaffeine: [],
      weights: [],
      hydrationTargetOz: 64,
      caffeineCutoffTime: '14:00',
      currentStreak: 3,
    });

    // Target hit (40) + no hydration (0) + caffeine ok (20) + streak (10) = 70
    expect(result.avgQualityScore).toBe(70);
  });
});
