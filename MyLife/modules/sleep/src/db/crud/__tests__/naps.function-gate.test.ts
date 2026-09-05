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
  NapCreateSchema,
  NapSchema,
  type NapCreateInput,
} from '../../../models/schemas';
import { createNap } from '../naps';

function pad(day: number): string {
  return String(day).padStart(2, '0');
}

function makeNapInput(rng: () => number, index: number): NapCreateInput {
  const day = 1 + (index % 20);
  const hour = randomInt(rng, 11, 17);
  const minute = randomInt(rng, 0, 5) * 10;

  return {
    date: `2026-03-${pad(day)}`,
    start_time: `2026-03-${pad(day)}T${String(hour).padStart(2, '0')}:${String(
      minute,
    ).padStart(2, '0')}:00Z`,
    duration_minutes: randomInt(rng, 10, 90),
    intentional: rng() >= 0.35,
    quality: rng() >= 0.25 ? randomInt(rng, 1, 5) : undefined,
    notes: rng() >= 0.6 ? `Nap ${index}` : undefined,
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

describe('createNap function quality gate', () => {
  it('matches contract behavior for known cases', async () => {
    await withSleepDb((db) => {
      const result = createNap(db.adapter, {
        date: '2026-03-02',
        start_time: '2026-03-02T14:15:00Z',
        duration_minutes: 25,
        intentional: false,
        quality: 4,
        notes: 'Unexpected couch nap',
      });

      expect(NapSchema.parse(result)).toEqual(result);
      expect(result.intentional).toBe(false);
      expect(result.duration_minutes).toBe(25);
      expect(result.quality).toBe(4);
    });
  });

  it('passes deterministic fuzz invariants', async () => {
    await runDeterministicFuzz({
      label: 'createNap fuzz',
      iterations: 120,
      seed: 42,
      makeCase: (rng, index) => makeNapInput(rng, index),
      assertCase: async (input) => {
        await withSleepDb((db) => {
          const parsed = NapCreateSchema.parse(input);
          const result = createNap(db.adapter, parsed);

          expect(NapSchema.parse(result)).toEqual(result);
          expect(result.date).toBe(parsed.date);
          expect(result.start_time.slice(0, 10)).toBe(parsed.date);
          expect(result.duration_minutes).toBe(parsed.duration_minutes);
          expect(result.intentional).toBe(parsed.intentional);
          expect(result.quality).toBe(parsed.quality ?? null);
        });
      },
    });
  });

  it('stays within linear complexity slope budget for repeated inserts', async () => {
    await assertComplexitySlope({
      label: 'createNap repeated inserts',
      sizes: [40, 80, 160],
      expected: 'linear',
      maxRatios: [5.5, 4.5],
      warmupRuns: 2,
      sampleRuns: 3,
      setup: (size) => {
        let index = 0;
        return Array.from({ length: size }, () =>
          makeNapInput(() => ((index += 1), (index % 10) / 10), index),
        );
      },
      run: async (inputs) => {
        await withSleepDb((db) => {
          for (const input of inputs) {
            createNap(db.adapter, input);
          }
        });
      },
    });
  });

  it('stays within memory budget under repeated inserts', async () => {
    await assertMemoryBudget({
      label: 'createNap repeated inserts',
      repeats: 12,
      maxHeapDeltaBytes: 12 * 1024 * 1024,
      setup: () => {
        let index = 0;
        return Array.from({ length: 30 }, () =>
          makeNapInput(() => ((index += 1), (index % 10) / 10), index),
        );
      },
      run: async (inputs) => {
        await withSleepDb((db) => {
          for (const input of inputs) {
            createNap(db.adapter, input);
          }
        });
      },
    });
  });
});
