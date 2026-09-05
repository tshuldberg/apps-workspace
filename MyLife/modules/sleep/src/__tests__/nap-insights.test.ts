import { describe, expect, it } from 'vitest';
import type { NapRecord, SleepEntryRecord } from '../index';
import {
  getNapDurationTrend,
  getNapImpactInsight,
  getNapSummary,
} from '../engine/naps';

function nap(
  date: string,
  duration: number,
  intentional = true,
  quality: number | null = 4,
): NapRecord {
  return {
    id: `nap-${date}-${duration}`,
    date,
    start_time: `${date}T14:00:00.000Z`,
    duration_minutes: duration,
    intentional,
    quality,
    notes: null,
    created_at: `${date}T14:00:00.000Z`,
  };
}

function entry(date: string, quality: number): SleepEntryRecord {
  return {
    id: `entry-${date}`,
    date,
    bedtime: `${date}T22:30:00.000Z`,
    sleep_onset_time: null,
    wake_time: `${date}T06:30:00.000Z`,
    duration_minutes: 480,
    quality_rating: quality,
    wake_count: 0,
    sleep_latency_minutes: null,
    alarm_time: null,
    snooze_count: 0,
    wake_feeling: quality >= 4 ? 'refreshed' : 'groggy',
    notes_md: null,
    created_at: `${date}T06:30:00.000Z`,
    updated_at: `${date}T06:30:00.000Z`,
  };
}

describe('nap insights', () => {
  it('summarizes nap totals and duration trends', () => {
    const naps = [
      nap('2026-04-20', 20),
      nap('2026-04-20', 40, false, 3),
      nap('2026-04-21', 30),
    ];

    expect(getNapDurationTrend(naps)).toEqual([
      {
        date: '2026-04-20',
        count: 2,
        totalMinutes: 60,
        averageDuration: 30,
      },
      {
        date: '2026-04-21',
        count: 1,
        totalMinutes: 30,
        averageDuration: 30,
      },
    ]);

    expect(getNapSummary(naps, [])).toMatchObject({
      totalNaps: 3,
      totalMinutes: 90,
      averageDuration: 30,
      averageQuality: 3.7,
      intentionalCount: 2,
      accidentalCount: 1,
    });
  });

  it('compares next-night sleep quality after nap days', () => {
    const naps = [
      nap('2026-04-01', 20),
      nap('2026-04-02', 25),
      nap('2026-04-03', 30),
    ];
    const entries = [
      entry('2026-04-02', 3),
      entry('2026-04-03', 3),
      entry('2026-04-04', 2),
      entry('2026-04-05', 5),
      entry('2026-04-06', 4),
      entry('2026-04-07', 5),
    ];

    const insight = getNapImpactInsight(naps, entries);

    expect(insight.status).toBe('reportable');
    expect(insight.direction).toBe('negative');
    expect(insight.napNightSampleSize).toBe(3);
    expect(insight.noNapNightSampleSize).toBe(3);
    expect(insight.qualityDelta).toBe(-2);
  });

  it('returns an insufficient insight until both groups have samples', () => {
    const insight = getNapImpactInsight(
      [nap('2026-04-01', 20)],
      [entry('2026-04-02', 4)],
    );

    expect(insight.status).toBe('insufficient_data');
    expect(insight.direction).toBe('neutral');
  });
});
