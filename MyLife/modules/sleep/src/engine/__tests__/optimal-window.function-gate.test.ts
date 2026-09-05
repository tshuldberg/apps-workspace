import { describe, expect, it } from 'vitest';
import {
  assertComplexitySlope,
  assertMemoryBudget,
  randomInt,
  runDeterministicFuzz,
} from '../../test/function-quality';
import type { SleepAnalyticsEntry } from '../analytics';
import {
  findOptimalBedtime,
  getChronotypeEstimate,
} from '../optimal-window';

function formatDate(index: number): string {
  return new Date(Date.UTC(2026, 3, index + 1, 12, 0, 0, 0))
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
  const quality = 1 + (index % 5);

  return {
    id: `entry-${index}`,
    date,
    bedtime: `${date}T${formatClock(bedtimeMinutes)}:00.000Z`,
    sleep_onset_time: null,
    wake_time: `${date}T07:00:00.000Z`,
    duration_minutes: 420 + ((index % 5) * 30),
    quality_rating: quality,
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

describe('optimal window function quality gate', () => {
  it('matches optimal-window contracts for known cases', () => {
    const entries = Array.from({ length: 14 }, (_, index) =>
      index < 7 ? makeEntry(index, 22 * 60) : makeEntry(index, 25 * 60),
    );

    expect(findOptimalBedtime(entries).recommendedTime).toBe('01:00');
    expect(getChronotypeEstimate(entries)).toBe('intermediate');
  });

  it('passes deterministic fuzz invariants', async () => {
    await runDeterministicFuzz({
      label: 'findOptimalBedtime fuzz',
      iterations: 100,
      seed: 42,
      makeCase: (rng) => {
        const size = randomInt(rng, 0, 160);
        return Array.from({ length: size }, (_, index) =>
          makeEntry(index, randomInt(rng, 20 * 60, 26 * 60)),
        );
      },
      assertCase: async (entries) => {
        const bedtime = findOptimalBedtime(entries);
        expect(bedtime.sampleSize).toBeGreaterThanOrEqual(0);
        expect(['low', 'medium', 'high']).toContain(bedtime.confidence);
        expect(['early_bird', 'night_owl', 'intermediate']).toContain(
          getChronotypeEstimate(entries),
        );
      },
    });
  });

  it('stays within linear complexity slope', async () => {
    await assertComplexitySlope({
      label: 'findOptimalBedtime',
      sizes: [1000, 2000, 4000],
      expected: 'linear',
      maxRatios: [7.0, 7.0],
      sampleRuns: 3,
      setup: (size) => Array.from({ length: size }, (_, index) => makeEntry(index)),
      run: async (entries) => {
        findOptimalBedtime(entries);
      },
    });
  });

  it('stays within memory budget under repeated calls', async () => {
    await assertMemoryBudget({
      label: 'findOptimalBedtime memory',
      repeats: 40,
      maxHeapDeltaBytes: 8 * 1024 * 1024,
      setup: () => Array.from({ length: 600 }, (_, index) => makeEntry(index)),
      run: async (entries) => {
        findOptimalBedtime(entries);
      },
    });
  });
});
