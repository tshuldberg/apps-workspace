import { describe, expect, it } from 'vitest';
import {
  assertComplexitySlope,
  assertMemoryBudget,
  randomInt,
  runDeterministicFuzz,
} from '../../test/function-quality';
import type { Dream } from '../../models/dream-schemas';
import type { Nap, SleepEntry } from '../../models/schemas';
import { generateYearReview } from '../year-review';

function shiftDate(date: string, days: number): string {
  const parsed = new Date(`${date}T12:00:00.000Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

function makeEntry(index: number, year = 2026): SleepEntry {
  const date = shiftDate(`${year}-01-01`, index % 365);
  const duration = 360 + ((index * 17) % 210);
  const quality = 1 + (index % 5);

  return {
    id: `entry-${year}-${index}`,
    date,
    bedtime: `${date}T22:30:00.000Z`,
    sleep_onset_time: `${date}T22:45:00.000Z`,
    wake_time: `${date}T06:45:00.000Z`,
    duration_minutes: duration,
    quality_rating: quality,
    wake_count: index % 3,
    sleep_latency_minutes: 15,
    alarm_time: null,
    snooze_count: index % 7 === 0 ? 1 : 0,
    wake_feeling: 'groggy',
    notes_md: null,
    created_at: `${date}T07:00:00.000Z`,
    updated_at: `${date}T07:00:00.000Z`,
  };
}

function makeDream(index: number, year = 2026): Dream {
  const date = shiftDate(`${year}-01-01`, index % 365);
  const themes = ['water', 'travel', 'work', 'family'];
  const emotions = ['calm', 'curious', 'tense'];

  return {
    id: `dream-${year}-${index}`,
    sleep_entry_id: null,
    date,
    content_md: `Dream ${index}`,
    type: index % 11 === 0 ? 'nightmare' : index % 7 === 0 ? 'lucid' : 'normal',
    themes: [themes[index % themes.length]],
    people: [],
    emotions: [emotions[index % emotions.length]],
    is_lucid: index % 7 === 0,
    is_recurring: false,
    recurring_group_id: null,
    sketch_photo_id: null,
    created_at: `${date}T07:30:00.000Z`,
  };
}

function makeNap(index: number, year = 2026): Nap {
  const date = shiftDate(`${year}-01-01`, index % 365);

  return {
    id: `nap-${year}-${index}`,
    date,
    start_time: `${date}T14:00:00.000Z`,
    duration_minutes: 20 + (index % 40),
    intentional: index % 3 !== 0,
    quality: 1 + (index % 5),
    notes: null,
    created_at: `${date}T14:30:00.000Z`,
  };
}

function makeCase(size: number) {
  return {
    entries: [
      ...Array.from({ length: size }, (_, index) => makeEntry(index, 2026)),
      ...Array.from({ length: Math.ceil(size / 4) }, (_, index) =>
        makeEntry(index, 2025),
      ),
    ],
    dreams: Array.from({ length: Math.ceil(size / 3) }, (_, index) =>
      makeDream(index, 2026),
    ),
    naps: Array.from({ length: Math.ceil(size / 5) }, (_, index) =>
      makeNap(index, 2026),
    ),
  };
}

describe('generateYearReview function quality gate', () => {
  it('matches contract behavior for known cases', () => {
    const result = generateYearReview(2026, makeCase(20));

    expect(result.year).toBe(2026);
    expect(result.totalNights).toBe(20);
    expect(result.monthlyStats).toHaveLength(12);
    expect(result.dreamStats.total).toBe(7);
    expect(result.totalNaps).toBe(4);
    expect(result.funFacts.length).toBeGreaterThan(0);
  });

  it('passes deterministic fuzz invariants', async () => {
    await runDeterministicFuzz({
      label: 'generateYearReview fuzz',
      iterations: 80,
      seed: 154,
      makeCase: (rng) => {
        const size = randomInt(rng, 0, 500);
        return makeCase(size);
      },
      assertCase: async (input) => {
        const result = generateYearReview(2026, input);
        expect(result.totalNights).toBeLessThanOrEqual(input.entries.length);
        expect(
          result.monthlyStats.reduce((sum, month) => sum + month.totalNights, 0),
        ).toBe(result.totalNights);
        expect(result.totalHoursSlept).toBeGreaterThanOrEqual(0);
        expect(result.dreamStats.total).toBeLessThanOrEqual(input.dreams.length);
        expect(result.totalNaps).toBeLessThanOrEqual(input.naps.length);
      },
    });
  });

  it('stays within nlogn complexity slope budget', async () => {
    await assertComplexitySlope({
      label: 'generateYearReview',
      sizes: [400, 800, 1600],
      expected: 'nlogn',
      maxRatios: [5.0, 5.0],
      sampleRuns: 3,
      setup: makeCase,
      run: async (input) => {
        generateYearReview(2026, input);
      },
    });
  });

  it('stays within memory budget under repeated calls', async () => {
    await assertMemoryBudget({
      label: 'generateYearReview',
      repeats: 40,
      maxHeapDeltaBytes: 24 * 1024 * 1024,
      setup: () => makeCase(500),
      run: async (input) => {
        generateYearReview(2026, input);
      },
    });
  });
});
