import { describe, expect, it } from 'vitest';
import {
  assertComplexitySlope,
  assertMemoryBudget,
  randomInt,
  runDeterministicFuzz,
} from '../../test/function-quality';
import type { SleepEntry } from '../../models/schemas';
import {
  buildSleepTimelineSections,
  getSleepWeekStart,
} from '../timeline';

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function addDays(baseDate: Date, delta: number): Date {
  const next = new Date(baseDate);
  next.setDate(next.getDate() + delta);
  return next;
}

function formatDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function makeEntry(date: string, index: number): SleepEntry {
  return {
    id: `entry-${index}`,
    date,
    bedtime: `${date}T06:00:00.000Z`,
    sleep_onset_time: null,
    wake_time: `${date}T14:00:00.000Z`,
    duration_minutes: 360 + (index % 180),
    quality_rating: (index % 5) + 1,
    wake_count: index % 4,
    sleep_latency_minutes: null,
    alarm_time: null,
    snooze_count: 0,
    wake_feeling: ['refreshed', 'groggy', 'exhausted', 'energized'][
      index % 4
    ] as SleepEntry['wake_feeling'],
    notes_md: index % 2 === 0 ? `note-${index}` : null,
    created_at: `${date}T14:05:00.000Z`,
    updated_at: `${date}T14:05:00.000Z`,
  };
}

function makeEntries(count: number): SleepEntry[] {
  const baseDate = new Date(2026, 3, 20, 12, 0, 0, 0);
  return Array.from({ length: count }, (_, index) => {
    const date = formatDate(addDays(baseDate, -index));
    return makeEntry(date, index);
  });
}

describe('buildSleepTimelineSections function quality gate', () => {
  it('matches the grouping contract for sequential entries', () => {
    const entries = makeEntries(7);
    const result = buildSleepTimelineSections(
      entries,
      new Date(2026, 3, 20, 9, 0, 0, 0),
    );

    expect(result.map((section) => section.label)).toEqual([
      'This Week',
      'Last Week',
    ]);
    expect(result.flatMap((section) => section.entries)).toEqual(entries);
  });

  it('passes deterministic fuzz invariants', async () => {
    await runDeterministicFuzz({
      label: 'buildSleepTimelineSections fuzz',
      iterations: 180,
      seed: 42,
      makeCase: (rng, index) => {
        const size = randomInt(rng, 0, 180);
        const anchor = addDays(new Date(2026, 3, 20, 12, 0, 0, 0), -index);
        return Array.from({ length: size }, (_, entryIndex) =>
          makeEntry(
            formatDate(addDays(anchor, -entryIndex)),
            entryIndex,
          ),
        );
      },
      assertCase: async (entries) => {
        const result = buildSleepTimelineSections(
          entries,
          new Date(2026, 3, 20, 9, 0, 0, 0),
        );

        expect(result.flatMap((section) => section.entries)).toEqual(entries);
        expect(result.every((section) => section.entries.length > 0)).toBe(true);

        for (const section of result) {
          for (const entry of section.entries) {
            expect(getSleepWeekStart(entry.date)).toBe(section.weekStart);
          }
        }
      },
    });
  });

  it('stays within linear complexity slope budget', async () => {
    await assertComplexitySlope({
      label: 'buildSleepTimelineSections',
      sizes: [500, 1000, 2000],
      expected: 'linear',
      warmupRuns: 2,
      sampleRuns: 7,
      maxRatios: [4.0, 4.0],
      setup: (size) => makeEntries(size),
      run: async (input) => {
        for (let index = 0; index < 20; index += 1) {
          buildSleepTimelineSections(input);
        }
      },
    });
  }, 15_000);

  it('stays within memory budget under repeated calls', async () => {
    await assertMemoryBudget({
      label: 'buildSleepTimelineSections',
      repeats: 16,
      maxHeapDeltaBytes: 24 * 1024 * 1024,
      setup: () => makeEntries(500),
      run: async (input) => {
        buildSleepTimelineSections(input);
      },
    });
  });
});
