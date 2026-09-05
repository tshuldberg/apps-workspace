import { describe, expect, it } from 'vitest';
import {
  assertComplexitySlope,
  assertMemoryBudget,
  randomInt,
  runDeterministicFuzz,
} from '../../test/function-quality';
import {
  getBestNights,
  getTrendData,
  type SleepAnalyticsEntry,
} from '../analytics';

function formatDate(index: number): string {
  return new Date(Date.UTC(2026, 0, index + 1, 12, 0, 0, 0))
    .toISOString()
    .slice(0, 10);
}

function makeEntry(index: number): SleepAnalyticsEntry {
  const date = formatDate(index);
  const duration = 360 + ((index % 6) * 30);
  const quality = (index % 9) === 0 ? null : 1 + (index % 5);

  return {
    id: `entry-${index}`,
    date,
    bedtime: `${date}T23:00:00.000Z`,
    sleep_onset_time: null,
    wake_time: `${date}T07:00:00.000Z`,
    duration_minutes: duration,
    quality_rating: quality,
    wake_count: index % 4,
    sleep_latency_minutes: index % 30,
    alarm_time: null,
    snooze_count: 0,
    wake_feeling: 'refreshed',
    notes_md: null,
    created_at: `${date}T07:05:00.000Z`,
    updated_at: `${date}T07:05:00.000Z`,
  };
}

describe('sleep analytics function quality gate', () => {
  it('matches trend and ranking contracts for known cases', () => {
    const entries = [makeEntry(0), makeEntry(1), makeEntry(2)];
    const trend = getTrendData(
      entries,
      { startDate: formatDate(0), endDate: formatDate(2) },
      'day',
    );

    expect(trend).toHaveLength(3);
    expect(trend.every((point) => point.totalNights === 1)).toBe(true);
    expect(getBestNights(entries, [], 1)[0]?.entry.id).toBe('entry-2');
  });

  it('passes deterministic fuzz invariants', async () => {
    await runDeterministicFuzz({
      label: 'getTrendData fuzz',
      iterations: 80,
      seed: 42,
      makeCase: (rng) => {
        const size = randomInt(rng, 0, 120);
        const entries = Array.from({ length: size }, (_, index) =>
          makeEntry(index),
        );
        return {
          entries,
          endDate: formatDate(Math.max(0, size - 1)),
        };
      },
      assertCase: async ({ entries, endDate }) => {
        const trend = getTrendData(
          entries,
          { startDate: formatDate(0), endDate },
          'day',
        );
        const totalNights = trend.reduce(
          (sum, point) => sum + point.totalNights,
          0,
        );
        expect(totalNights).toBe(entries.length);
        expect(getBestNights(entries, [], 5).length).toBeLessThanOrEqual(5);
      },
    });
  });

  it('stays within linear complexity for daily trend generation', async () => {
    await assertComplexitySlope({
      label: 'getTrendData daily',
      sizes: [250, 500, 1000],
      expected: 'linear',
      maxRatios: [4.2, 4.2],
      sampleRuns: 3,
      setup: (size) => Array.from({ length: size }, (_, index) => makeEntry(index)),
      run: async (entries) => {
        getTrendData(
          entries,
          { startDate: formatDate(0), endDate: formatDate(entries.length - 1) },
          'day',
        );
      },
    });
  });

  it('stays within memory budget under repeated calls', async () => {
    await assertMemoryBudget({
      label: 'getTrendData memory',
      repeats: 30,
      maxHeapDeltaBytes: 24 * 1024 * 1024,
      setup: () => Array.from({ length: 500 }, (_, index) => makeEntry(index)),
      run: async (entries) => {
        getTrendData(
          entries,
          { startDate: formatDate(0), endDate: formatDate(entries.length - 1) },
          'week',
        );
      },
    });
  });
});
