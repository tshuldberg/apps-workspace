import { describe, expect, it } from 'vitest';
import { createModuleTestDatabase } from '@mylife/db';
import {
  assertComplexitySlope,
  assertMemoryBudget,
  randomInt,
  runDeterministicFuzz,
} from '../../../test/function-quality';
import { SLEEP_MODULE } from '../../../definition';
import {
  SleepEntryCreateSchema,
  SleepEntrySchema,
  type SleepEntryCreateInput,
} from '../../../models/schemas';
import { calculateDuration, calculateSleepLatency } from '../../../engine/duration';
import { createEntry } from '../entries';

function pad(day: number): string {
  return String(day).padStart(2, '0');
}

function makeEntryInput(
  rng: () => number,
  index: number,
): SleepEntryCreateInput {
  const day = 1 + (index % 20);
  const bedtimeHour = randomInt(rng, 21, 23);
  const bedtimeMinute = randomInt(rng, 0, 5) * 10;
  const wakeHour = randomInt(rng, 5, 9);
  const wakeMinute = randomInt(rng, 0, 5) * 10;
  const latency = randomInt(rng, 0, 6) * 5;
  const nextDay = day + 1;
  const bedtime = `2026-03-${pad(day)}T${String(bedtimeHour).padStart(2, '0')}:${String(bedtimeMinute).padStart(2, '0')}:00Z`;
  const wake_time = `2026-03-${pad(nextDay)}T${String(wakeHour).padStart(2, '0')}:${String(wakeMinute).padStart(2, '0')}:00Z`;
  const includeSleepOnset = rng() >= 0.35;

  return {
    bedtime,
    sleep_onset_time: includeSleepOnset
      ? `2026-03-${pad(day)}T${String(bedtimeHour).padStart(2, '0')}:${String(
          Math.min(59, bedtimeMinute + latency),
        ).padStart(2, '0')}:00Z`
      : undefined,
    wake_time,
    quality_rating: randomInt(rng, 1, 5),
    wake_count: randomInt(rng, 0, 4),
    sleep_latency_minutes: includeSleepOnset ? undefined : latency,
    snooze_count: randomInt(rng, 0, 2),
    wake_feeling: ['refreshed', 'groggy', 'exhausted', 'energized'][
      randomInt(rng, 0, 3)
    ] as SleepEntryCreateInput['wake_feeling'],
    notes_md: rng() >= 0.5 ? `Night ${index}` : undefined,
  };
}

async function withSleepDb<T>(
  run: (
    db: ReturnType<typeof createModuleTestDatabase>,
  ) => Promise<T> | T,
): Promise<T> {
  const db = createModuleTestDatabase('sleep', SLEEP_MODULE.migrations ?? []);
  try {
    return await run(db);
  } finally {
    db.close();
  }
}

describe('createEntry function quality gate', () => {
  it('matches contract behavior for known cases', async () => {
    await withSleepDb((db) => {
      const result = createEntry(db.adapter, {
        bedtime: '2026-03-01T23:00:00Z',
        sleep_onset_time: '2026-03-01T23:20:00Z',
        wake_time: '2026-03-02T07:00:00Z',
        quality_rating: 4,
        wake_count: 1,
        snooze_count: 1,
        wake_feeling: 'groggy',
        notes_md: 'Woke up once',
      });

      expect(SleepEntrySchema.parse(result)).toEqual(result);
      expect(result.date).toBe('2026-03-02');
      expect(result.duration_minutes).toBe(480);
      expect(result.sleep_latency_minutes).toBe(20);
      expect(result.notes_md).toBe('Woke up once');
    });
  });

  it('passes deterministic fuzz invariants', async () => {
    await runDeterministicFuzz({
      label: 'createEntry fuzz',
      iterations: 120,
      seed: 42,
      makeCase: (rng, index) => makeEntryInput(rng, index),
      assertCase: async (input) => {
        await withSleepDb((db) => {
          const parsed = SleepEntryCreateSchema.parse(input);
          const result = createEntry(db.adapter, parsed);

          expect(SleepEntrySchema.parse(result)).toEqual(result);
          expect(result.date).toBe(parsed.wake_time.slice(0, 10));
          expect(result.duration_minutes).toBe(
            calculateDuration(parsed.bedtime, parsed.wake_time),
          );
          expect(result.quality_rating).toBe(parsed.quality_rating);
          expect(result.wake_count).toBe(parsed.wake_count);

          if (parsed.sleep_onset_time) {
            expect(result.sleep_latency_minutes).toBe(
              calculateSleepLatency(parsed.bedtime, parsed.sleep_onset_time),
            );
          } else {
            expect(result.sleep_latency_minutes).toBe(
              parsed.sleep_latency_minutes ?? null,
            );
          }
        });
      },
    });
  });

  it('stays within linear complexity slope budget for repeated inserts', async () => {
    await assertComplexitySlope({
      label: 'createEntry repeated inserts',
      sizes: [10, 20, 40],
      expected: 'linear',
      sampleRuns: 3,
      setup: (size) => {
        let index = 0;
        return Array.from({ length: size }, () =>
          makeEntryInput(() => ((index += 1), (index % 10) / 10), index),
        );
      },
      run: async (inputs) => {
        await withSleepDb((db) => {
          for (const input of inputs) {
            createEntry(db.adapter, input);
          }
        });
      },
    });
  });

  it('stays within memory budget under repeated inserts', async () => {
    await assertMemoryBudget({
      label: 'createEntry repeated inserts',
      repeats: 12,
      maxHeapDeltaBytes: 16 * 1024 * 1024,
      setup: () => {
        let index = 0;
        return Array.from({ length: 30 }, () =>
          makeEntryInput(() => ((index += 1), (index % 10) / 10), index),
        );
      },
      run: async (inputs) => {
        await withSleepDb((db) => {
          for (const input of inputs) {
            createEntry(db.adapter, input);
          }
        });
      },
    });
  });
});
