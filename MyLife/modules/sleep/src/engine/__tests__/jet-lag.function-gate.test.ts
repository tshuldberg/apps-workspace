import { describe, expect, it } from 'vitest';
import type { SleepEntry } from '../../models/schemas';
import {
  assertComplexitySlope,
  assertMemoryBudget,
  randomInt,
  runDeterministicFuzz,
} from '../../test/function-quality';
import {
  createJetLagTracker,
  getAdjustmentProgress,
  getRecommendation,
  getRecommendedSleepTime,
} from '../jet-lag';

const TIME_ZONES = [
  'America/Los_Angeles',
  'America/New_York',
  'Europe/London',
  'Europe/Paris',
  'Asia/Tokyo',
  'Australia/Sydney',
];

function shiftDate(date: string, days: number): string {
  const parsed = new Date(`${date}T12:00:00.000Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

function makeEntry(index: number, bedtime = '23:00'): SleepEntry {
  const date = shiftDate('2026-04-24', index);

  return {
    id: `entry-${index}`,
    date,
    bedtime: `${date}T${bedtime}:00.000Z`,
    sleep_onset_time: `${date}T${bedtime}:00.000Z`,
    wake_time: `${shiftDate(date, 1)}T07:00:00.000Z`,
    duration_minutes: 480,
    quality_rating: 4,
    wake_count: index % 3,
    sleep_latency_minutes: 15,
    alarm_time: null,
    snooze_count: 0,
    wake_feeling: 'refreshed',
    notes_md: null,
    created_at: `${date}T07:00:00.000Z`,
    updated_at: `${date}T07:00:00.000Z`,
  };
}

function makeEntries(size: number): SleepEntry[] {
  return Array.from({ length: size }, (_, index) =>
    makeEntry(index, index % 2 === 0 ? '23:00' : '00:30'),
  );
}

describe('jet lag function quality gate', () => {
  it('matches tracker and recommendation contracts for known cases', () => {
    const tracker = createJetLagTracker(
      'America/Los_Angeles',
      'America/New_York',
      '2026-04-24',
    );

    expect(tracker.direction).toBe('eastward');
    expect(getRecommendedSleepTime(tracker, 1)).toBe('01:00');
    expect(getRecommendation(tracker, 3)).toContain('23:00');
  });

  it('passes deterministic fuzz invariants', async () => {
    await runDeterministicFuzz({
      label: 'createJetLagTracker fuzz',
      iterations: 80,
      seed: 87,
      makeCase: (rng) => ({
        origin: TIME_ZONES[randomInt(rng, 0, TIME_ZONES.length - 1)],
        destination: TIME_ZONES[randomInt(rng, 0, TIME_ZONES.length - 1)],
        day: randomInt(rng, 0, 8),
      }),
      assertCase: async ({ origin, destination, day }) => {
        const tracker = createJetLagTracker(origin, destination, '2026-04-24');
        expect(tracker.timeZoneDifferenceHours).toBeGreaterThanOrEqual(-11);
        expect(tracker.timeZoneDifferenceHours).toBeLessThanOrEqual(12);
        expect(getRecommendedSleepTime(tracker, day)).toMatch(/^\d{2}:\d{2}$/);
        expect(getAdjustmentProgress(tracker, makeEntries(4))).toBeGreaterThanOrEqual(0);
        expect(getAdjustmentProgress(tracker, makeEntries(4))).toBeLessThanOrEqual(100);
      },
    });
  });

  it('stays within nlogn complexity for adjustment progress', async () => {
    const tracker = createJetLagTracker(
      'America/Los_Angeles',
      'America/New_York',
      '2026-04-24',
    );

    await assertComplexitySlope({
      label: 'getAdjustmentProgress',
      sizes: [500, 1000, 2000],
      expected: 'nlogn',
      maxRatios: [4.0, 4.0],
      sampleRuns: 3,
      setup: makeEntries,
      run: async (entries) => {
        getAdjustmentProgress(tracker, entries);
      },
    });
  });

  it('stays within memory budget under repeated progress checks', async () => {
    const tracker = createJetLagTracker(
      'America/Los_Angeles',
      'America/New_York',
      '2026-04-24',
    );

    await assertMemoryBudget({
      label: 'getAdjustmentProgress memory',
      repeats: 20,
      maxHeapDeltaBytes: 8 * 1024 * 1024,
      setup: () => makeEntries(500),
      run: async (entries) => {
        getAdjustmentProgress(tracker, entries);
      },
    });
  });
});
