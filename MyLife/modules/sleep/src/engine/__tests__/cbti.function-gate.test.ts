import { describe, expect, it } from 'vitest';
import {
  assertComplexitySlope,
  assertMemoryBudget,
  randomInt,
  runDeterministicFuzz,
} from '../../test/function-quality';
import type { SleepEntry } from '../../models/schemas';
import {
  calculateSleepEfficiency,
  getSleepRestrictionWindow,
} from '../cbti';

function formatDate(index: number): string {
  return new Date(Date.UTC(2026, 0, index + 1, 12, 0, 0, 0))
    .toISOString()
    .slice(0, 10);
}

function shiftDate(date: string, days: number): string {
  const parsed = new Date(`${date}T12:00:00.000Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

function makeEntry(index: number, durationMinutes = 450): SleepEntry {
  const date = formatDate(index);
  const bedDate = shiftDate(date, -1);

  return {
    id: `entry-${index}`,
    date,
    bedtime: `${bedDate}T22:30:00.000Z`,
    sleep_onset_time: `${bedDate}T22:50:00.000Z`,
    wake_time: `${date}T06:30:00.000Z`,
    duration_minutes: durationMinutes,
    quality_rating: 4,
    wake_count: index % 4,
    sleep_latency_minutes: 20,
    alarm_time: null,
    snooze_count: 0,
    wake_feeling: 'refreshed',
    notes_md: null,
    created_at: `${date}T07:00:00.000Z`,
    updated_at: `${date}T07:00:00.000Z`,
  };
}

describe('calculateSleepEfficiency function quality gate', () => {
  it('matches CBT-I efficiency and restriction safety contracts', () => {
    expect(calculateSleepEfficiency(makeEntry(0, 450))).toBe(93.8);
    expect(
      getSleepRestrictionWindow(70, 85, {
        averageSleepMinutes: 240,
        currentTimeInBedMinutes: 480,
      }).recommendedTimeInBedMinutes,
    ).toBe(330);
  });

  it('passes deterministic fuzz invariants', async () => {
    await runDeterministicFuzz({
      label: 'calculateSleepEfficiency fuzz',
      iterations: 120,
      seed: 58,
      makeCase: (rng, index) =>
        makeEntry(index, randomInt(rng, 240, 480)),
      assertCase: async (entry) => {
        const result = calculateSleepEfficiency(entry);
        expect(result).toBeGreaterThanOrEqual(50);
        expect(result).toBeLessThanOrEqual(100);
        expect(Number.isFinite(result)).toBe(true);
      },
    });
  });

  it('stays within linear complexity for repeated efficiency calculation', async () => {
    await assertComplexitySlope({
      label: 'calculateSleepEfficiency repeated',
      sizes: [500, 1000, 2000],
      expected: 'linear',
      maxRatios: [4.5, 4.5],
      sampleRuns: 3,
      setup: (size) =>
        Array.from({ length: size }, (_, index) =>
          makeEntry(index, 300 + (index % 181)),
        ),
      run: async (entries) => {
        for (const entry of entries) {
          calculateSleepEfficiency(entry);
        }
      },
    });
  });

  it('stays within memory budget under repeated calls', async () => {
    await assertMemoryBudget({
      label: 'calculateSleepEfficiency memory',
      repeats: 40,
      maxHeapDeltaBytes: 8 * 1024 * 1024,
      setup: () => makeEntry(0, 450),
      run: async (entry) => {
        calculateSleepEfficiency(entry);
      },
    });
  });
});
