import { describe, expect, it } from 'vitest';
import {
  assertComplexitySlope,
  assertMemoryBudget,
  randomInt,
  runDeterministicFuzz,
} from '../../test/function-quality';
import type { SleepAnalyticsEntry } from '../analytics';
import {
  calculateSleepDebt,
  getDebtTrend,
  getRecoveryEstimate,
} from '../sleep-debt';

function formatDate(index: number): string {
  return new Date(Date.UTC(2026, 2, index + 1, 12, 0, 0, 0))
    .toISOString()
    .slice(0, 10);
}

function makeEntry(index: number, durationMinutes = 480): SleepAnalyticsEntry {
  const date = formatDate(index);
  return {
    id: `entry-${index}`,
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

describe('sleep debt function quality gate', () => {
  it('matches debt trend and recovery contracts for known cases', () => {
    const entries = [makeEntry(0, 420), makeEntry(1, 540)];
    expect(calculateSleepDebt(entries, {
      startDate: formatDate(0),
      endDate: formatDate(1),
    })).toBe(0);
    expect(getRecoveryEstimate(2.2, 1)).toEqual({
      currentDebtHours: 2.2,
      nightlySurplusHours: 1,
      nightsToRecover: 3,
    });
  });

  it('passes deterministic fuzz invariants', async () => {
    await runDeterministicFuzz({
      label: 'getDebtTrend fuzz',
      iterations: 100,
      seed: 42,
      makeCase: (rng) => {
        const size = randomInt(rng, 0, 150);
        return Array.from({ length: size }, (_, index) =>
          makeEntry(index, randomInt(rng, 300, 600)),
        );
      },
      assertCase: async (entries) => {
        const trend = getDebtTrend(entries, {
          startDate: formatDate(0),
          endDate: formatDate(Math.max(0, entries.length - 1)),
        });
        expect(trend.every((point) => point.cumulativeDebtHours >= 0)).toBe(true);
        expect(calculateSleepDebt(entries)).toBeGreaterThanOrEqual(0);
      },
    });
  });

  it('stays within linear complexity slope', async () => {
    await assertComplexitySlope({
      label: 'getDebtTrend',
      sizes: [1000, 2000, 4000],
      expected: 'linear',
      maxRatios: [4.2, 4.2],
      sampleRuns: 3,
      setup: (size) => Array.from({ length: size }, (_, index) => makeEntry(index)),
      run: async (entries) => {
        getDebtTrend(entries, {
          startDate: formatDate(0),
          endDate: formatDate(entries.length - 1),
        });
      },
    });
  });

  it('stays within memory budget under repeated calls', async () => {
    await assertMemoryBudget({
      label: 'getDebtTrend memory',
      repeats: 30,
      maxHeapDeltaBytes: 12 * 1024 * 1024,
      setup: () => Array.from({ length: 500 }, (_, index) => makeEntry(index)),
      run: async (entries) => {
        getDebtTrend(entries, {
          startDate: formatDate(0),
          endDate: formatDate(entries.length - 1),
        });
      },
    });
  });
});
