import { describe, expect, it } from 'vitest';
import type { SleepAnalyticsEntry } from '../engine/analytics';
import {
  findOptimalBedtime,
  findOptimalDuration,
  getChronotypeEstimate,
} from '../engine/optimal-window';

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function makeEntry(
  index: number,
  bedtimeClock: string,
  wakeClock: string,
  durationMinutes: number,
  qualityRating: number | null,
): SleepAnalyticsEntry {
  const date = `2026-04-${pad(index + 1)}`;
  return {
    id: `entry-${index}`,
    date,
    bedtime: `${date}T${bedtimeClock}:00.000Z`,
    sleep_onset_time: null,
    wake_time: `${date}T${wakeClock}:00.000Z`,
    duration_minutes: durationMinutes,
    quality_rating: qualityRating,
    wake_count: 1,
    sleep_latency_minutes: null,
    alarm_time: null,
    snooze_count: 0,
    wake_feeling: 'refreshed',
    notes_md: null,
    created_at: `${date}T${wakeClock}:05.000Z`,
    updated_at: `${date}T${wakeClock}:05.000Z`,
  };
}

describe('optimal sleep window helpers', () => {
  it('detects the bedtime and duration buckets with the strongest quality', () => {
    const entries = Array.from({ length: 14 }, (_, index) =>
      index < 8
        ? makeEntry(index, '22:30', '07:00', 510, 5)
        : makeEntry(index, '00:30', '06:30', 390, 3),
    );

    expect(findOptimalBedtime(entries)).toEqual({
      recommendedTime: '22:30',
      windowStart: '22:30',
      windowEnd: '23:00',
      averageQualityRating: 5,
      sampleSize: 8,
      confidence: 'medium',
    });
    expect(findOptimalDuration(entries)).toEqual({
      recommendedDurationMinutes: 510,
      recommendedDurationHours: 8.5,
      windowStartMinutes: 510,
      windowEndMinutes: 540,
      averageQualityRating: 5,
      sampleSize: 8,
      confidence: 'medium',
    });
  });

  it('skips missing quality ratings and honors explicit date ranges', () => {
    const entries = [
      makeEntry(0, '21:30', '05:30', 480, 5),
      makeEntry(1, '21:30', '05:30', 480, null),
      makeEntry(2, '00:30', '08:30', 480, 2),
    ];

    expect(
      findOptimalBedtime(entries, {
        startDate: '2026-04-01',
        endDate: '2026-04-02',
      }),
    ).toMatchObject({
      recommendedTime: '21:30',
      averageQualityRating: 5,
      sampleSize: 1,
      confidence: 'low',
    });
  });

  it('estimates chronotype from natural bedtime and wake patterns', () => {
    const earlyBird = Array.from({ length: 5 }, (_, index) =>
      makeEntry(index, '22:15', '06:10', 475, 4),
    );
    const nightOwl = Array.from({ length: 5 }, (_, index) =>
      makeEntry(index, '01:00', '09:00', 480, 4),
    );
    const intermediate = Array.from({ length: 5 }, (_, index) =>
      makeEntry(index, '23:15', '07:15', 480, 4),
    );

    expect(getChronotypeEstimate(earlyBird)).toBe('early_bird');
    expect(getChronotypeEstimate(nightOwl)).toBe('night_owl');
    expect(getChronotypeEstimate(intermediate)).toBe('intermediate');
    expect(getChronotypeEstimate([])).toBe('intermediate');
  });
});
