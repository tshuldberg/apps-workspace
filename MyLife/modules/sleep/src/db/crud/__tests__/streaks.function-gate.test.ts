import { describe, expect, it } from 'vitest';
import { createModuleTestDatabase } from '@mylife/db';
import {
  assertComplexitySlope,
  assertMemoryBudget,
  randomInt,
  runDeterministicFuzz,
} from '../../../test/function-quality';
import { SLEEP_MODULE } from '../../../definition';
import { type SleepStreakType } from '../../../models/goal-schemas';
import { updateStreak } from '../streaks';

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

function dateFor(index: number): string {
  return new Date(Date.UTC(2026, 0, index + 1, 12, 0, 0, 0))
    .toISOString()
    .slice(0, 10);
}

describe('updateStreak function quality gate', () => {
  it('matches contract behavior for known cases', async () => {
    await withSleepDb((db) => {
      const first = updateStreak(db.adapter, 'no_snooze', true, '2026-03-01');
      const second = updateStreak(db.adapter, 'no_snooze', true, '2026-03-02');
      const miss = updateStreak(db.adapter, 'no_snooze', false, '2026-03-03');

      expect(first.current_count).toBe(1);
      expect(second.current_count).toBe(2);
      expect(miss.current_count).toBe(0);
      expect(miss.longest_count).toBe(2);
    });
  });

  it('passes deterministic fuzz invariants', async () => {
    await runDeterministicFuzz({
      label: 'updateStreak fuzz',
      iterations: 60,
      seed: 42,
      makeCase: (rng) => ({
        type: ['quality_above_3', 'on_time_bed', 'target_hours', 'no_snooze'][
          randomInt(rng, 0, 3)
        ] as SleepStreakType,
        metFlags: Array.from({ length: 8 }, () => rng() > 0.3),
      }),
      assertCase: async ({ type, metFlags }) => {
        await withSleepDb((db) => {
          let longest = 0;
          let current = 0;
          for (let index = 0; index < metFlags.length; index += 1) {
            const streak = updateStreak(db.adapter, type, metFlags[index], dateFor(index));
            current = metFlags[index] ? current + 1 : 0;
            longest = Math.max(longest, current);
            expect(streak.current_count).toBe(current);
            expect(streak.longest_count).toBe(longest);
          }
        });
      },
    });
  });

  it('stays within linear complexity slope budget', async () => {
    await assertComplexitySlope({
      label: 'updateStreak repeated updates',
      sizes: [10, 20, 40],
      expected: 'linear',
      maxRatios: [4.5, 4.5],
      sampleRuns: 3,
      setup: (size) => Array.from({ length: size }, (_, index) => index),
      run: async (indexes) => {
        await withSleepDb((db) => {
          for (const index of indexes) {
            updateStreak(db.adapter, 'target_hours', index % 5 !== 0, dateFor(index));
          }
        });
      },
    });
  });

  it('stays within memory budget under repeated calls', async () => {
    await assertMemoryBudget({
      label: 'updateStreak memory',
      repeats: 20,
      maxHeapDeltaBytes: 8 * 1024 * 1024,
      setup: () => Array.from({ length: 30 }, (_, index) => index),
      run: async (indexes) => {
        await withSleepDb((db) => {
          for (const index of indexes) {
            updateStreak(db.adapter, 'target_hours', index % 4 !== 0, dateFor(index));
          }
        });
      },
    });
  });
});
