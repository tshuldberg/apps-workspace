import { describe, expect, it } from 'vitest';
import {
  assertComplexitySlope,
  assertMemoryBudget,
  randomInt,
  runDeterministicFuzz,
} from '../../test/function-quality';
import type { SleepAnalyticsEntry } from '../analytics';
import { calculateConsistencyScore } from '../consistency';

function formatDate(index: number): string {
  return new Date(Date.UTC(2026, 1, index + 1, 12, 0, 0, 0))
    .toISOString()
    .slice(0, 10);
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function formatClock(totalMinutes: number): string {
  const minutes = ((totalMinutes % 1440) + 1440) % 1440;
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}

function makeEntry(index: number, bedtimeMinutes = 23 * 60): SleepAnalyticsEntry {
  const date = formatDate(index);
  const wakeMinutes = 7 * 60 + (index % 4);

  return {
    id: `entry-${index}`,
    date,
    bedtime: `${date}T${formatClock(bedtimeMinutes + (index % 5))}:00.000Z`,
    sleep_onset_time: null,
    wake_time: `${date}T${formatClock(wakeMinutes)}:00.000Z`,
    duration_minutes: 480,
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

describe('calculateConsistencyScore function quality gate', () => {
  it('matches the consistency score contract for known cases', () => {
    expect([
      calculateConsistencyScore([]),
      calculateConsistencyScore([makeEntry(0)]),
    ]).toEqual([0, 100]);
  });

  it('passes deterministic fuzz invariants', async () => {
    await runDeterministicFuzz({
      label: 'calculateConsistencyScore fuzz',
      iterations: 100,
      seed: 42,
      makeCase: (rng) => {
        const size = randomInt(rng, 0, 160);
        const bedtimeBase = randomInt(rng, 21 * 60, 25 * 60);
        return Array.from({ length: size }, (_, index) =>
          makeEntry(index, bedtimeBase + randomInt(rng, -45, 45)),
        );
      },
      assertCase: async (entries) => {
        const score = calculateConsistencyScore(entries);
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(100);
        if (entries.length === 1) {
          expect(score).toBe(100);
        }
      },
    });
  });

  it('stays within linear complexity slope', async () => {
    await assertComplexitySlope({
      label: 'calculateConsistencyScore',
      sizes: [250, 500, 1000],
      expected: 'linear',
      maxRatios: [3.2, 3.2],
      sampleRuns: 3,
      setup: (size) => Array.from({ length: size }, (_, index) => makeEntry(index)),
      run: async (entries) => {
        calculateConsistencyScore(entries);
      },
    });
  });

  it('stays within memory budget under repeated calls', async () => {
    await assertMemoryBudget({
      label: 'calculateConsistencyScore memory',
      repeats: 40,
      maxHeapDeltaBytes: 8 * 1024 * 1024,
      setup: () => Array.from({ length: 600 }, (_, index) => makeEntry(index)),
      run: async (entries) => {
        calculateConsistencyScore(entries);
      },
    });
  });
});
