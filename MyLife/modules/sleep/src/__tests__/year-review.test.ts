import { describe, expect, it } from 'vitest';
import type { Dream } from '../models/dream-schemas';
import type { Nap, SleepEntry } from '../models/schemas';
import { generateYearReview } from '../engine/year-review';

function makeEntry(
  id: string,
  date: string,
  quality: number,
  durationMinutes: number,
  overrides: Partial<SleepEntry> = {},
): SleepEntry {
  return {
    id,
    date,
    bedtime: `${date}T22:30:00.000Z`,
    sleep_onset_time: `${date}T22:45:00.000Z`,
    wake_time: `${date}T06:45:00.000Z`,
    duration_minutes: durationMinutes,
    quality_rating: quality,
    wake_count: 1,
    sleep_latency_minutes: 15,
    alarm_time: null,
    snooze_count: 0,
    wake_feeling: 'refreshed',
    notes_md: null,
    created_at: `${date}T07:00:00.000Z`,
    updated_at: `${date}T07:00:00.000Z`,
    ...overrides,
  };
}

function makeDream(
  id: string,
  date: string,
  overrides: Partial<Dream> = {},
): Dream {
  return {
    id,
    sleep_entry_id: null,
    date,
    content_md: `Dream ${id}`,
    type: 'normal',
    themes: [],
    people: [],
    emotions: [],
    is_lucid: false,
    is_recurring: false,
    recurring_group_id: null,
    sketch_photo_id: null,
    created_at: `${date}T07:30:00.000Z`,
    ...overrides,
  };
}

function makeNap(id: string, date: string): Nap {
  return {
    id,
    date,
    start_time: `${date}T14:00:00.000Z`,
    duration_minutes: 25,
    intentional: true,
    quality: 4,
    notes: null,
    created_at: `${date}T14:30:00.000Z`,
  };
}

function shiftDate(date: string, days: number): string {
  const parsed = new Date(`${date}T12:00:00.000Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

describe('year review engine', () => {
  it('aggregates yearly sleep, dreams, naps, and highlights', () => {
    const entries: SleepEntry[] = [
      makeEntry('jan-1', '2026-01-01', 4, 480),
      makeEntry('jan-2', '2026-01-02', 4, 510),
      makeEntry('jan-3', '2026-01-03', 5, 530),
      makeEntry('feb-1', '2026-02-01', 2, 420),
      makeEntry('feb-2', '2026-02-02', 2, 420),
      makeEntry('ignored-prior', '2025-01-01', 5, 600),
    ];
    const dreams = [
      makeDream('lucid', '2026-01-02', {
        type: 'lucid',
        is_lucid: true,
        themes: ['water', 'flying'],
        emotions: ['calm'],
      }),
      makeDream('nightmare', '2026-02-02', {
        type: 'nightmare',
        themes: ['water'],
        emotions: ['fear'],
      }),
      makeDream('ignored', '2025-01-02', { type: 'nightmare' }),
    ];
    const naps = [
      makeNap('nap-1', '2026-01-01'),
      makeNap('nap-2', '2026-02-02'),
      makeNap('ignored-nap', '2025-01-01'),
    ];

    const review = generateYearReview(2026, {
      entries,
      dreams,
      naps,
      targetHours: 8,
    });

    expect(review.totalNights).toBe(5);
    expect(review.totalHoursSlept).toBe(39.3);
    expect(review.averageDuration).toBe(7.87);
    expect(review.averageQuality).toBe(3.4);
    expect(review.bestMonth).toMatchObject({
      month: 1,
      label: 'January',
      avgQuality: 4.33,
    });
    expect(review.worstMonth).toMatchObject({
      month: 2,
      label: 'February',
      avgQuality: 2,
    });
    expect(review.longestStreak).toMatchObject({
      type: 'no_snooze',
      count: 3,
      startDate: '2026-01-01',
      endDate: '2026-01-03',
    });
    expect(review.dreamStats).toMatchObject({
      total: 2,
      lucidCount: 1,
      nightmareCount: 1,
      mostCommonEmotion: 'calm',
    });
    expect(review.dreamStats.topThemes[0]).toEqual({ theme: 'water', count: 2 });
    expect(review.totalNaps).toBe(2);
    expect(review.improvementMetric).toMatchObject({
      startQuality: 4,
      endQuality: 2,
      trend: 'declined',
    });
    expect(review.funFacts.join(' ')).not.toContain('Dream lucid');
  });

  it('works with empty and partial-year data', () => {
    const empty = generateYearReview(2026);

    expect(empty.totalNights).toBe(0);
    expect(empty.averageDuration).toBeNull();
    expect(empty.bestMonth.month).toBeNull();
    expect(empty.longestStreak).toMatchObject({
      type: 'none',
      count: 0,
    });
    expect(empty.funFacts).toHaveLength(2);

    const partial = generateYearReview(2026, {
      entries: [makeEntry('only', '2026-04-24', 5, 540)],
    });

    expect(partial.totalNights).toBe(1);
    expect(partial.bestMonth.month).toBe(4);
    expect(partial.monthlyStats.filter((month) => month.totalNights > 0))
      .toHaveLength(1);
  });

  it('compares to the prior year only when enough data exists', () => {
    const current = Array.from({ length: 15 }, (_, index) =>
      makeEntry(
        `current-${index}`,
        shiftDate('2026-01-01', index),
        4,
        480,
      ),
    );
    const prior = Array.from({ length: 15 }, (_, index) =>
      makeEntry(
        `prior-${index}`,
        shiftDate('2025-01-01', index),
        3,
        420,
      ),
    );

    const review = generateYearReview(2026, {
      entries: [...current, ...prior],
    });

    expect(review.comparison).toMatchObject({
      priorYear: 2025,
      sampleSize: 15,
      totalNightsDelta: 0,
      averageDurationDelta: 1,
      averageQualityDelta: 1,
      trend: 'improved',
    });

    const insufficientPrior = generateYearReview(2026, {
      entries: [...current, ...prior.slice(0, 13)],
    });

    expect(insufficientPrior.comparison).toBeNull();
  });

  it('rejects invalid years', () => {
    expect(() => generateYearReview(0)).toThrow(/year/);
    expect(() => generateYearReview(2026.5)).toThrow(/year/);
  });
});
