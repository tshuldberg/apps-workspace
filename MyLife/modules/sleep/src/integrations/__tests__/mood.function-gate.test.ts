import { describe, expect, it } from 'vitest';
import {
  assertComplexitySlope,
  assertMemoryBudget,
  randomInt,
  runDeterministicFuzz,
} from '../../test/function-quality';
import type { DatabaseAdapter } from '@mylife/db';
import { getSleepMoodCorrelation } from '../mood';

type PairRow = {
  date: string;
  sleep_quality: number;
  mood_score: number;
  sleep_entry_count: number;
  mood_entry_count: number;
};

function makeDate(index: number): string {
  return `2026-02-${String((index % 28) + 1).padStart(2, '0')}`;
}

function makeRows(size: number): PairRow[] {
  return Array.from({ length: size }, (_, index) => {
    const strong = index % 2 === 0;
    return {
      date: makeDate(index),
      sleep_quality: strong ? 5 : 2,
      mood_score: strong ? 8 : 3,
      sleep_entry_count: 1,
      mood_entry_count: 1,
    };
  });
}

function makeDb(rows: PairRow[], enabled = true): DatabaseAdapter {
  return {
    execute: () => {},
    query: <T,>(sql: string): T[] => {
      if (sql.includes('hub_enabled_modules')) {
        return [{ count: enabled ? 2 : 1 }] as T[];
      }
      if (sql.includes('sleep_daily')) {
        return rows as T[];
      }
      return [];
    },
    transaction: (fn) => {
      fn();
    },
  };
}

describe('getSleepMoodCorrelation function quality gate', () => {
  it('matches contract behavior for known cases', () => {
    const result = getSleepMoodCorrelation(makeDb(makeRows(8)));

    expect(result.status).toBe('reportable');
    expect(result.sampleSize).toBe(8);
    expect(result.correlation).toBeGreaterThan(0.9);
    expect(result.insight).toContain('Your mood averages 8.0/10');
    expect(getSleepMoodCorrelation(makeDb(makeRows(8), false)).status).toBe(
      'disabled',
    );
  });

  it('passes deterministic fuzz invariants', async () => {
    await runDeterministicFuzz({
      label: 'getSleepMoodCorrelation fuzz',
      iterations: 200,
      seed: 42,
      makeCase: (rng) => {
        const size = randomInt(rng, 0, 120);
        return makeDb(makeRows(size), randomInt(rng, 0, 1) === 1);
      },
      assertCase: async (db) => {
        const result = getSleepMoodCorrelation(db);

        expect(result.sampleSize).toBeGreaterThanOrEqual(0);
        expect(result.correlation).toBeGreaterThanOrEqual(-1);
        expect(result.correlation).toBeLessThanOrEqual(1);
        if (result.status === 'reportable') {
          expect(result.insight.length).toBeGreaterThan(0);
          expect(result.sampleSize).toBeGreaterThanOrEqual(7);
        }
      },
    });
  });

  it('stays within linear complexity slope budget', async () => {
    await assertComplexitySlope({
      label: 'getSleepMoodCorrelation',
      sizes: [250, 500, 1000],
      expected: 'linear',
      setup: (size) => makeDb(makeRows(size)),
      run: async (db) => {
        getSleepMoodCorrelation(db);
      },
    });
  });

  it('stays within memory budget under repeated calls', async () => {
    await assertMemoryBudget({
      label: 'getSleepMoodCorrelation',
      repeats: 40,
      maxHeapDeltaBytes: 8 * 1024 * 1024,
      setup: () => makeDb(makeRows(1000)),
      run: async (db) => {
        getSleepMoodCorrelation(db);
      },
    });
  });
});
