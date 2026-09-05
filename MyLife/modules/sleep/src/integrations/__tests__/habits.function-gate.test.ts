import type { DatabaseAdapter } from '@mylife/db';
import { describe, expect, it } from 'vitest';
import {
  assertComplexitySlope,
  assertMemoryBudget,
  randomInt,
  runDeterministicFuzz,
} from '../../test/function-quality';
import { getSleepHabitAdherence } from '../habits';

interface RoutineHabitRow {
  id: string;
  name: string;
  time_of_day: string;
  habit_type: string;
  target_count: number;
}

interface AdherenceRow {
  sleep_date: string;
  routine_date: string;
  sleep_quality: number;
  completed_habit_count: number;
}

function makeRoutineHabits(count: number): RoutineHabitRow[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `habit-${index}`,
    name: `Wind down ${index}`,
    time_of_day: 'evening',
    habit_type: 'standard',
    target_count: 1,
  }));
}

function makeAdherenceRows(size: number): AdherenceRow[] {
  return Array.from({ length: size }, (_, index) => {
    const strong = index % 2 === 0;
    const day = String((index % 28) + 1).padStart(2, '0');
    return {
      sleep_date: `2026-02-${day}`,
      routine_date: `2026-02-${day}`,
      sleep_quality: strong ? 5 : 2,
      completed_habit_count: strong ? 1 : 0,
    };
  });
}

function makeDb(
  rows: AdherenceRow[],
  enabled = true,
  routineHabitCount = 1,
): DatabaseAdapter {
  return {
    execute: () => {},
    query: <T,>(sql: string): T[] => {
      if (sql.includes('hub_enabled_modules')) {
        return [{ count: enabled ? 2 : 1 }] as T[];
      }
      if (sql.includes('FROM hb_habits')) {
        return makeRoutineHabits(routineHabitCount) as T[];
      }
      if (sql.includes('completed_habit_count')) {
        return rows as T[];
      }
      return [];
    },
    transaction: (fn) => {
      fn();
    },
  };
}

describe('getSleepHabitAdherence function quality gate', () => {
  it('matches contract behavior for known cases', () => {
    const result = getSleepHabitAdherence(makeDb(makeAdherenceRows(8)));

    expect(result.status).toBe('reportable');
    expect(result.sampleSize).toBe(8);
    expect(result.averageQualityAfterRoutine).toBe(5);
    expect(result.averageQualityWithoutRoutine).toBe(2);
    expect(result.insight).toContain('After bedtime routine completions');
    expect(getSleepHabitAdherence(makeDb(makeAdherenceRows(8), false)).status).toBe(
      'disabled',
    );
    expect(getSleepHabitAdherence(makeDb(makeAdherenceRows(8), true, 0)).status).toBe(
      'no_routine_habits',
    );
  });

  it('passes deterministic fuzz invariants', async () => {
    await runDeterministicFuzz({
      label: 'getSleepHabitAdherence fuzz',
      iterations: 200,
      seed: 42,
      makeCase: (rng) => {
        const size = randomInt(rng, 0, 120);
        const routineHabitCount = randomInt(rng, 0, 3);
        return makeDb(
          makeAdherenceRows(size),
          randomInt(rng, 0, 1) === 1,
          routineHabitCount,
        );
      },
      assertCase: async (db) => {
        const result = getSleepHabitAdherence(db);

        expect(result.sampleSize).toBeGreaterThanOrEqual(0);
        expect(result.completedRoutineDays).toBeGreaterThanOrEqual(0);
        if (result.status === 'reportable') {
          expect(result.sampleSize).toBeGreaterThanOrEqual(7);
          expect(result.insight.length).toBeGreaterThan(0);
        }
      },
    });
  });

  it('stays within linear complexity slope budget', async () => {
    await assertComplexitySlope({
      label: 'getSleepHabitAdherence',
      sizes: [240, 360, 540],
      expected: 'linear',
      setup: (size) => makeDb(makeAdherenceRows(size)),
      run: async (db) => {
        getSleepHabitAdherence(db);
      },
    });
  });

  it('stays within memory budget under repeated calls', async () => {
    await assertMemoryBudget({
      label: 'getSleepHabitAdherence',
      repeats: 40,
      maxHeapDeltaBytes: 8 * 1024 * 1024,
      setup: () => makeDb(makeAdherenceRows(1000)),
      run: async (db) => {
        getSleepHabitAdherence(db);
      },
    });
  });
});
