import { describe, expect, it } from 'vitest';
import type { Factor } from '../models/factor-schemas';
import type { SleepAnalyticsEntry } from '../engine/analytics';
import {
  getBestNights,
  getMonthlyAverage,
  getTrendData,
  getWeeklyAverage,
  getWeekendVsWeekday,
  getWorstNights,
} from '../engine/analytics';

function makeEntry(
  id: string,
  date: string,
  durationMinutes: number,
  qualityRating: number | null,
  overrides: Partial<SleepAnalyticsEntry> = {},
): SleepAnalyticsEntry {
  return {
    id,
    date,
    bedtime: `${date}T23:00:00.000Z`,
    sleep_onset_time: null,
    wake_time: `${date}T07:00:00.000Z`,
    duration_minutes: durationMinutes,
    quality_rating: qualityRating,
    wake_count: 1,
    sleep_latency_minutes: 15,
    alarm_time: null,
    snooze_count: 0,
    wake_feeling: 'refreshed',
    notes_md: null,
    created_at: `${date}T07:05:00.000Z`,
    updated_at: `${date}T07:05:00.000Z`,
    ...overrides,
  };
}

function makeFactor(
  id: string,
  entryId: string,
  date: string,
): Factor {
  return {
    id,
    sleep_entry_id: entryId,
    date,
    last_caffeine_time: '16:30',
    last_meal_time: '19:45',
    alcohol_drinks: 0,
    exercise_today: true,
    exercise_time: '17:30',
    screen_cutoff_time: '21:45',
    room_temp: 'cool',
    room_light: 'dark',
    room_noise: 'quiet',
    supplements: ['magnesium'],
    stress_level: 2,
    pre_sleep_activities: ['reading'],
    notes: null,
    created_at: `${date}T07:10:00.000Z`,
  };
}

describe('sleep analytics helpers', () => {
  it('calculates weekly and monthly averages while skipping missing quality', () => {
    const entries = [
      makeEntry('a', '2026-04-06', 480, 4),
      makeEntry('b', '2026-04-07', 420, 3),
      makeEntry('c', '2026-04-08', 510, 5),
      makeEntry('d', '2026-04-09', 450, null),
      makeEntry('outside', '2026-04-13', 600, 5),
    ];

    expect(getWeeklyAverage(entries, '2026-04-06')).toMatchObject({
      startDate: '2026-04-06',
      endDate: '2026-04-12',
      avgDurationMinutes: 465,
      avgDurationHours: 7.75,
      avgQualityRating: 4,
      totalNights: 4,
      ratedNights: 3,
      onTargetNights: 2,
    });

    expect(getMonthlyAverage(entries, 4, 2026)).toMatchObject({
      startDate: '2026-04-01',
      endDate: '2026-04-30',
      totalNights: 5,
      avgDurationMinutes: 492,
      avgQualityRating: 4.25,
    });
  });

  it('builds explicit trend buckets for partial ranges and empty days', () => {
    const entries = [
      makeEntry('a', '2026-04-06', 480, 4),
      makeEntry('b', '2026-04-08', 420, 3),
    ];

    expect(
      getTrendData(
        entries,
        { startDate: '2026-04-06', endDate: '2026-04-09' },
        'day',
      ).map((point) => ({
        date: point.periodStart,
        totalNights: point.totalNights,
        avgDurationMinutes: point.avgDurationMinutes,
      })),
    ).toEqual([
      { date: '2026-04-06', totalNights: 1, avgDurationMinutes: 480 },
      { date: '2026-04-07', totalNights: 0, avgDurationMinutes: null },
      { date: '2026-04-08', totalNights: 1, avgDurationMinutes: 420 },
      { date: '2026-04-09', totalNights: 0, avgDurationMinutes: null },
    ]);

    expect(
      getTrendData(
        entries,
        { startDate: '2026-04-07', endDate: '2026-04-15' },
        'week',
      ).map((point) => ({
        bucketStart: point.bucketStart,
        periodStart: point.periodStart,
        periodEnd: point.periodEnd,
        totalNights: point.totalNights,
      })),
    ).toEqual([
      {
        bucketStart: '2026-04-06',
        periodStart: '2026-04-07',
        periodEnd: '2026-04-12',
        totalNights: 1,
      },
      {
        bucketStart: '2026-04-13',
        periodStart: '2026-04-13',
        periodEnd: '2026-04-15',
        totalNights: 0,
      },
    ]);
  });

  it('returns deterministic best and worst nights with factor conditions', () => {
    const best = makeEntry('best', '2026-04-09', 520, 5, {
      wake_count: 0,
    });
    const entries = [
      makeEntry('missing', '2026-04-06', 600, null),
      makeEntry('worst', '2026-04-07', 360, 2, {
        wake_count: 4,
      }),
      makeEntry('tie', '2026-04-08', 480, 5, {
        wake_count: 1,
      }),
      best,
    ];
    const factors = [makeFactor('factor-best', best.id, best.date)];

    const bestNights = getBestNights(entries, factors, 2);
    expect(bestNights.map((night) => night.entry.id)).toEqual(['best', 'tie']);
    expect(bestNights[0]?.conditions).toMatchObject({
      preSleepActivities: ['reading'],
      supplements: ['magnesium'],
      stressLevel: 2,
      roomTemp: 'cool',
    });

    expect(getWorstNights(entries, factors, 2).map((night) => night.entry.id))
      .toEqual(['worst', 'tie']);
  });

  it('compares weekend and weekday nights by wake-date buckets', () => {
    const entries = [
      makeEntry('mon', '2026-04-06', 480, 4),
      makeEntry('tue', '2026-04-07', 420, 3),
      makeEntry('sat', '2026-04-11', 540, 5),
      makeEntry('sun', '2026-04-12', 480, 4),
    ];

    expect(
      getWeekendVsWeekday(entries, {
        startDate: '2026-04-06',
        endDate: '2026-04-12',
      }),
    ).toMatchObject({
      weekdayAvg: {
        totalNights: 2,
        avgDurationMinutes: 450,
        avgQualityRating: 3.5,
      },
      weekendAvg: {
        totalNights: 2,
        avgDurationMinutes: 510,
        avgQualityRating: 4.5,
      },
      difference: {
        durationMinutes: 60,
        qualityRating: 1,
      },
    });
  });
});
