import type { DatabaseAdapter } from '@mylife/db';
import { describe, expect, it } from 'vitest';
import {
  assertComplexitySlope,
  assertMemoryBudget,
  randomInt,
  runDeterministicFuzz,
} from '../../test/function-quality';
import { getSleepRoutineContext } from '../sleep-link';

interface SleepRow {
  id: string;
  date: string;
  bedtime: string;
  wake_time: string;
  duration_minutes: number;
  quality_rating: number;
}

function makeSleepRow(index: number): SleepRow {
  const day = String((index % 28) + 1).padStart(2, '0');
  return {
    id: `sleep-${index}`,
    date: `2026-03-${day}`,
    bedtime: `2026-03-${day}T22:30:00.000Z`,
    wake_time: `2026-03-${day}T06:30:00.000Z`,
    duration_minutes: 360 + (index % 5) * 30,
    quality_rating: (index % 5) + 1,
  };
}

function makeDb(
  sleepRow: SleepRow | null,
  enabled = true,
  routineHabitCount = 1,
  completedRoutineCount = 1,
): DatabaseAdapter {
  return {
    execute: () => {},
    query: <T,>(sql: string): T[] => {
      if (sql.includes('hub_enabled_modules')) {
        return [{ count: enabled ? 2 : 1 }] as T[];
      }
      if (sql.includes('FROM hb_habits')) {
        return Array.from({ length: routineHabitCount }, (_, index) => ({
          id: `habit-${index}`,
        })) as T[];
      }
      if (sql.includes('FROM sl_sleep_entries')) {
        return (sleepRow ? [sleepRow] : []) as T[];
      }
      if (sql.includes('FROM hb_completions')) {
        return [{ count: completedRoutineCount }] as T[];
      }
      return [];
    },
    transaction: (fn) => {
      fn();
    },
  };
}

describe('getSleepRoutineContext function quality gate', () => {
  it('matches contract behavior for known cases', () => {
    const result = getSleepRoutineContext(makeDb({
      id: 'sleep-1',
      date: '2026-03-02',
      bedtime: '2026-03-01T22:30:00.000Z',
      wake_time: '2026-03-02T06:30:00.000Z',
      duration_minutes: 420,
      quality_rating: 4,
    }));

    expect(result?.context).toBe(
      'Sleep context: 7h, quality 4/5 after 1 of 1 bedtime routine habits.',
    );
    expect(getSleepRoutineContext(makeDb(null))).toBeNull();
    expect(getSleepRoutineContext(makeDb(makeSleepRow(0), false))).toBeNull();
    expect(getSleepRoutineContext(makeDb(makeSleepRow(0), true, 0))).toBeNull();
  });

  it('passes deterministic fuzz invariants', async () => {
    await runDeterministicFuzz({
      label: 'getSleepRoutineContext fuzz',
      iterations: 200,
      seed: 42,
      makeCase: (rng) => makeDb(
        randomInt(rng, 0, 1) === 0 ? null : makeSleepRow(randomInt(rng, 0, 100)),
        randomInt(rng, 0, 1) === 1,
        randomInt(rng, 0, 3),
        randomInt(rng, 0, 3),
      ),
      assertCase: async (db) => {
        const result = getSleepRoutineContext(db);

        if (result) {
          expect(result.durationMinutes).toBeGreaterThan(0);
          expect(result.qualityRating).toBeGreaterThanOrEqual(1);
          expect(result.qualityRating).toBeLessThanOrEqual(5);
          expect(result.context).toContain('Sleep context:');
        }
      },
    });
  });

  it('stays within linear complexity slope budget', async () => {
    await assertComplexitySlope({
      label: 'getSleepRoutineContext',
      sizes: [250, 500, 1000],
      expected: 'linear',
      setup: (size) => makeDb(makeSleepRow(size)),
      run: async (db) => {
        getSleepRoutineContext(db);
      },
    });
  });

  it('stays within memory budget under repeated calls', async () => {
    await assertMemoryBudget({
      label: 'getSleepRoutineContext',
      repeats: 40,
      maxHeapDeltaBytes: 8 * 1024 * 1024,
      setup: () => makeDb(makeSleepRow(1000)),
      run: async (db) => {
        getSleepRoutineContext(db);
      },
    });
  });
});
