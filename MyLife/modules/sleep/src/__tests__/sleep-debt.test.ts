import { describe, expect, it } from 'vitest';
import type { SleepAnalyticsEntry } from '../engine/analytics';
import {
  calculateSleepDebt,
  getDailyDebt,
  getDebtTrend,
  getRecoveryEstimate,
} from '../engine/sleep-debt';

function makeEntry(
  id: string,
  date: string,
  durationMinutes: number,
): SleepAnalyticsEntry {
  return {
    id,
    date,
    bedtime: `${date}T23:00:00.000Z`,
    sleep_onset_time: null,
    wake_time: `${date}T07:00:00.000Z`,
    duration_minutes: durationMinutes,
    quality_rating: 4,
    wake_count: 1,
    sleep_latency_minutes: null,
    alarm_time: null,
    snooze_count: 0,
    wake_feeling: 'refreshed',
    notes_md: null,
    created_at: `${date}T07:05:00.000Z`,
    updated_at: `${date}T07:05:00.000Z`,
  };
}

describe('sleep debt helpers', () => {
  it('calculates daily debt with negative values for surplus sleep', () => {
    const entries = [
      makeEntry('short', '2026-04-06', 420),
      makeEntry('long', '2026-04-07', 540),
    ];

    expect(getDailyDebt(entries, '2026-04-06', 8)).toBe(1);
    expect(getDailyDebt(entries, '2026-04-07', 8)).toBe(-1);
    expect(getDailyDebt(entries, '2026-04-08', 8)).toBeNull();
  });

  it('builds a cumulative trend without penalizing missing log days', () => {
    const entries = [
      makeEntry('short', '2026-04-06', 420),
      makeEntry('long', '2026-04-07', 540),
      makeEntry('very-short', '2026-04-09', 360),
    ];

    expect(
      getDebtTrend(
        entries,
        { startDate: '2026-04-06', endDate: '2026-04-09' },
        8,
      ),
    ).toEqual([
      {
        date: '2026-04-06',
        targetHours: 8,
        durationHours: 7,
        dailyDebtHours: 1,
        cumulativeDebtHours: 1,
      },
      {
        date: '2026-04-07',
        targetHours: 8,
        durationHours: 9,
        dailyDebtHours: -1,
        cumulativeDebtHours: 0,
      },
      {
        date: '2026-04-08',
        targetHours: 8,
        durationHours: null,
        dailyDebtHours: null,
        cumulativeDebtHours: 0,
      },
      {
        date: '2026-04-09',
        targetHours: 8,
        durationHours: 6,
        dailyDebtHours: 2,
        cumulativeDebtHours: 2,
      },
    ]);

    expect(
      calculateSleepDebt(
        entries,
        { startDate: '2026-04-06', endDate: '2026-04-09' },
        8,
      ),
    ).toBe(2);
  });

  it('uses the newest same-date entry and estimates recovery nights', () => {
    const entries = [
      makeEntry('old', '2026-04-06', 360),
      {
        ...makeEntry('new', '2026-04-06', 450),
        wake_time: '2026-04-06T08:00:00.000Z',
        created_at: '2026-04-06T08:05:00.000Z',
      },
    ];

    expect(getDailyDebt(entries, '2026-04-06', 8)).toBe(0.5);
    expect(getRecoveryEstimate(2.5, 0.75)).toEqual({
      currentDebtHours: 2.5,
      nightlySurplusHours: 0.75,
      nightsToRecover: 4,
    });
    expect(getRecoveryEstimate(-1)).toEqual({
      currentDebtHours: 0,
      nightlySurplusHours: 1,
      nightsToRecover: 0,
    });
  });
});
