import { describe, expect, it } from 'vitest';
import type { SleepAnalyticsEntry } from '../engine/analytics';
import {
  calculateConsistencyScore,
  getBedtimeVariance,
  getSleepConsistencySummary,
  getWakeTimeVariance,
} from '../engine/consistency';

function makeEntry(
  id: string,
  date: string,
  bedtime: string,
  wakeTime: string,
): SleepAnalyticsEntry {
  return {
    id,
    date,
    bedtime,
    sleep_onset_time: null,
    wake_time: wakeTime,
    duration_minutes: 480,
    quality_rating: 4,
    wake_count: 1,
    sleep_latency_minutes: null,
    alarm_time: null,
    snooze_count: 0,
    wake_feeling: 'refreshed',
    notes_md: null,
    created_at: `${date}T07:10:00.000Z`,
    updated_at: `${date}T07:10:00.000Z`,
  };
}

describe('sleep consistency helpers', () => {
  it('scores highly consistent bedtimes and wake times near 100', () => {
    const entries = [
      makeEntry('a', '2026-04-06', '2026-04-05T22:30:00.000Z', '2026-04-06T06:30:00.000Z'),
      makeEntry('b', '2026-04-07', '2026-04-06T22:35:00.000Z', '2026-04-07T06:35:00.000Z'),
      makeEntry('c', '2026-04-08', '2026-04-07T22:25:00.000Z', '2026-04-08T06:25:00.000Z'),
    ];

    expect(getBedtimeVariance(entries)).toBe(4.1);
    expect(getWakeTimeVariance(entries)).toBe(4.1);
    expect(calculateConsistencyScore(entries)).toBe(91.8);
  });

  it('normalizes cross-midnight bedtimes before calculating variance', () => {
    const entries = [
      makeEntry('a', '2026-04-06', '2026-04-05T23:45:00.000Z', '2026-04-06T07:30:00.000Z'),
      makeEntry('b', '2026-04-07', '2026-04-07T00:05:00.000Z', '2026-04-07T07:35:00.000Z'),
      makeEntry('c', '2026-04-08', '2026-04-08T00:15:00.000Z', '2026-04-08T07:20:00.000Z'),
    ];

    expect(getBedtimeVariance(entries)).toBe(12.5);
    expect(calculateConsistencyScore(entries)).toBeGreaterThan(70);
  });

  it('returns empty-data and single-night summaries explicitly', () => {
    expect(getSleepConsistencySummary([])).toEqual({
      score: 0,
      bedtimeVarianceMinutes: null,
      wakeTimeVarianceMinutes: null,
      averageVarianceMinutes: null,
      sampleSize: 0,
    });

    expect(
      getSleepConsistencySummary([
        makeEntry('a', '2026-04-06', '2026-04-05T23:00:00.000Z', '2026-04-06T07:00:00.000Z'),
      ]),
    ).toEqual({
      score: 100,
      bedtimeVarianceMinutes: 0,
      wakeTimeVarianceMinutes: 0,
      averageVarianceMinutes: 0,
      sampleSize: 1,
    });
  });

  it('honors explicit date ranges', () => {
    const entries = [
      makeEntry('a', '2026-04-06', '2026-04-05T22:30:00.000Z', '2026-04-06T06:30:00.000Z'),
      makeEntry('b', '2026-04-07', '2026-04-06T22:30:00.000Z', '2026-04-07T06:30:00.000Z'),
      makeEntry('late', '2026-04-08', '2026-04-08T02:30:00.000Z', '2026-04-08T10:30:00.000Z'),
    ];

    expect(
      calculateConsistencyScore(entries, {
        startDate: '2026-04-06',
        endDate: '2026-04-07',
      }),
    ).toBe(100);
  });
});
