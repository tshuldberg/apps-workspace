import { describe, expect, it } from 'vitest';
import {
  assertComplexitySlope,
  assertMemoryBudget,
  randomInt,
  runDeterministicFuzz,
} from '../../test/function-quality';
import type { DatabaseAdapter } from '@mylife/db';
import { getLastNightSleep } from '../sleep-link';

type SleepRow = {
  date: string;
  duration_minutes: number;
  quality_rating: number;
  wake_feeling: string;
};

function makeDb(row: SleepRow | null, enabled = true): DatabaseAdapter {
  return {
    execute: () => {},
    query: <T,>(sql: string): T[] => {
      if (sql.includes('hub_enabled_modules')) {
        return [{ count: enabled ? 2 : 1 }] as T[];
      }
      if (sql.includes('sl_sleep_entries')) {
        return (row ? [row] : []) as T[];
      }
      return [];
    },
    transaction: (fn) => {
      fn();
    },
  };
}

function makeRow(index: number): SleepRow {
  return {
    date: `2026-02-${String((index % 28) + 1).padStart(2, '0')}`,
    duration_minutes: 360 + (index % 5) * 30,
    quality_rating: (index % 5) + 1,
    wake_feeling: index % 2 === 0 ? 'refreshed' : 'groggy',
  };
}

describe('getLastNightSleep function quality gate', () => {
  it('matches contract behavior for known cases', () => {
    const result = getLastNightSleep(makeDb({
      date: '2026-02-01',
      duration_minutes: 420,
      quality_rating: 4,
      wake_feeling: 'refreshed',
    }));

    expect(result?.context).toBe('Sleep context: 7h, quality 4/5');
    expect(getLastNightSleep(makeDb(null))).toBeNull();
    expect(getLastNightSleep(makeDb(makeRow(0), false))).toBeNull();
  });

  it('passes deterministic fuzz invariants', async () => {
    await runDeterministicFuzz({
      label: 'getLastNightSleep fuzz',
      iterations: 200,
      seed: 42,
      makeCase: (rng) => {
        const row = randomInt(rng, 0, 1) === 0 ? null : makeRow(randomInt(rng, 0, 100));
        return makeDb(row, randomInt(rng, 0, 1) === 1);
      },
      assertCase: async (db) => {
        const result = getLastNightSleep(db);

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
      label: 'getLastNightSleep',
      sizes: [250, 500, 1000],
      expected: 'linear',
      setup: (size) => makeDb(makeRow(size)),
      run: async (db) => {
        getLastNightSleep(db);
      },
    });
  });

  it('stays within memory budget under repeated calls', async () => {
    await assertMemoryBudget({
      label: 'getLastNightSleep',
      repeats: 40,
      maxHeapDeltaBytes: 8 * 1024 * 1024,
      setup: () => makeDb(makeRow(1000)),
      run: async (db) => {
        getLastNightSleep(db);
      },
    });
  });
});
