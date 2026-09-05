import { describe, expect, it } from 'vitest';
import type {
  Nap as NapRecord,
  SleepEntry as SleepEntryRecord,
} from '../../models/schemas';
import {
  assertComplexitySlope,
  assertMemoryBudget,
  randomInt,
  runDeterministicFuzz,
} from '../../test/function-quality';
import { getNapSummary } from '../naps';

interface NapCase {
  naps: NapRecord[];
  entries: SleepEntryRecord[];
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function dateForIndex(index: number): string {
  return `2026-03-${pad((index % 28) + 1)}`;
}

function nap(index: number, duration = 25): NapRecord {
  const date = dateForIndex(index);
  return {
    id: `nap-${index}`,
    date,
    start_time: `${date}T14:00:00.000Z`,
    duration_minutes: duration,
    intentional: index % 3 !== 0,
    quality: (index % 5) + 1,
    notes: null,
    created_at: `${date}T14:00:00.000Z`,
  };
}

function entry(index: number): SleepEntryRecord {
  const date = dateForIndex(index + 1);
  return {
    id: `entry-${index}`,
    date,
    bedtime: `${date}T22:30:00.000Z`,
    sleep_onset_time: null,
    wake_time: `${date}T06:30:00.000Z`,
    duration_minutes: 480,
    quality_rating: (index % 5) + 1,
    wake_count: index % 3,
    sleep_latency_minutes: null,
    alarm_time: null,
    snooze_count: 0,
    wake_feeling: index % 2 === 0 ? 'refreshed' : 'groggy',
    notes_md: null,
    created_at: `${date}T06:30:00.000Z`,
    updated_at: `${date}T06:30:00.000Z`,
  };
}

function makeCase(size: number): NapCase {
  return {
    naps: Array.from({ length: size }, (_, index) =>
      nap(index, (index % 90) + 1),
    ),
    entries: Array.from({ length: size }, (_, index) => entry(index)),
  };
}

describe('getNapSummary function quality gate', () => {
  it('matches contract behavior for known cases', () => {
    const result = getNapSummary([nap(0, 20), nap(1, 40)], [entry(0)]);

    expect(result.totalNaps).toBe(2);
    expect(result.totalMinutes).toBe(60);
    expect(result.averageDuration).toBe(30);
    expect(result.intentionalCount + result.accidentalCount).toBe(2);
    expect(result.durationTrend.length).toBeGreaterThan(0);
  });

  it('passes deterministic fuzz invariants', async () => {
    await runDeterministicFuzz({
      label: 'getNapSummary fuzz',
      iterations: 200,
      seed: 42,
      makeCase: (rng) => makeCase(randomInt(rng, 0, 80)),
      assertCase: async ({ naps, entries }) => {
        const result = getNapSummary(naps, entries);

        expect(result.totalNaps).toBe(naps.length);
        expect(result.totalMinutes).toBe(
          naps.reduce((sum, item) => sum + item.duration_minutes, 0),
        );
        expect(result.intentionalCount + result.accidentalCount).toBe(
          naps.length,
        );
        expect(
          result.durationTrend.reduce((sum, point) => sum + point.count, 0),
        ).toBe(naps.length);
      },
    });
  });

  it('stays within linear complexity slope budget', async () => {
    await assertComplexitySlope({
      label: 'getNapSummary',
      sizes: [500, 1000, 2000],
      expected: 'linear',
      warmupRuns: 2,
      sampleRuns: 7,
      maxRatios: [4.0, 4.0],
      setup: makeCase,
      run: async ({ naps, entries }) => {
        for (let index = 0; index < 20; index += 1) {
          getNapSummary(naps, entries);
        }
      },
    });
  });

  it('stays within memory budget under repeated calls', async () => {
    await assertMemoryBudget({
      label: 'getNapSummary',
      repeats: 40,
      maxHeapDeltaBytes: 8 * 1024 * 1024,
      setup: () => makeCase(1000),
      run: async ({ naps, entries }) => {
        getNapSummary(naps, entries);
      },
    });
  });
});
