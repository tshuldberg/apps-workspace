import { describe, expect, it } from 'vitest';
import { createModuleTestDatabase } from '@mylife/db';
import {
  assertComplexitySlope,
  assertMemoryBudget,
  randomInt,
  runDeterministicFuzz,
} from '../../../test/function-quality';
import { SLEEP_MODULE } from '../../../definition';
import { SleepGoalSchema, type SleepGoalCreateInput } from '../../../models/goal-schemas';
import { createGoal } from '../goals';

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

function makeGoalInput(index: number): SleepGoalCreateInput {
  const types: SleepGoalCreateInput['type'][] = [
    'duration',
    'bedtime',
    'wake_time',
    'consistency',
  ];
  const type = types[index % types.length];
  const target_value =
    type === 'duration'
      ? 7 + (index % 3)
      : type === 'consistency'
        ? 30
        : `${String(6 + (index % 17)).padStart(2, '0')}:30`;

  return {
    type,
    target_value,
    start_date: '2026-03-01',
    notes: `Goal ${index}`,
  };
}

describe('createGoal function quality gate', () => {
  it('matches contract behavior for known cases', async () => {
    await withSleepDb((db) => {
      const result = createGoal(db.adapter, {
        type: 'duration',
        target_value: 8,
        notes: '  Sleep target  ',
      });

      expect(SleepGoalSchema.parse(result)).toEqual(result);
      expect(result.target_value).toBe('8');
      expect(result.notes).toBe('Sleep target');
      expect(result.is_active).toBe(true);
    });
  });

  it('passes deterministic fuzz invariants', async () => {
    await runDeterministicFuzz({
      label: 'createGoal fuzz',
      iterations: 80,
      seed: 42,
      makeCase: (rng, index) => ({
        ...makeGoalInput(index),
        target_value:
          index % 4 === 0 ? randomInt(rng, 6, 10) : makeGoalInput(index).target_value,
      }),
      assertCase: async (input) => {
        await withSleepDb((db) => {
          const result = createGoal(db.adapter, input);
          expect(SleepGoalSchema.parse(result)).toEqual(result);
          expect(result.id).toBeTruthy();
          expect(result.created_at).toBeTruthy();
        });
      },
    });
  });

  it('stays within linear complexity slope budget', async () => {
    await assertComplexitySlope({
      label: 'createGoal repeated inserts',
      sizes: [10, 20, 40],
      expected: 'linear',
      maxRatios: [10, 10],
      sampleRuns: 3,
      setup: (size) => Array.from({ length: size }, (_, index) => makeGoalInput(index)),
      run: async (inputs) => {
        await withSleepDb((db) => {
          for (const input of inputs) {
            createGoal(db.adapter, input);
          }
        });
      },
    });
  });

  it('stays within memory budget under repeated calls', async () => {
    await assertMemoryBudget({
      label: 'createGoal memory',
      repeats: 20,
      maxHeapDeltaBytes: 8 * 1024 * 1024,
      setup: () => Array.from({ length: 20 }, (_, index) => makeGoalInput(index)),
      run: async (inputs) => {
        await withSleepDb((db) => {
          for (const input of inputs) {
            createGoal(db.adapter, input);
          }
        });
      },
    });
  });
});
