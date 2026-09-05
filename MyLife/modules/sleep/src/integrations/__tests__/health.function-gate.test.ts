import type { DatabaseAdapter } from '@mylife/db';
import { describe, expect, it } from 'vitest';
import {
  assertComplexitySlope,
  assertMemoryBudget,
  randomInt,
  runDeterministicFuzz,
} from '../../test/function-quality';
import { getHealthBridgeSummary } from '../health';

interface SleepJournalRow {
  id: string;
  date: string;
  bedtime: string;
  wake_time: string;
  duration_minutes: number;
  quality_rating: number;
  wake_count: number;
  sleep_latency_minutes: number;
  wake_feeling: string;
}

function makeRows(size: number): SleepJournalRow[] {
  return Array.from({ length: size }, (_, index) => {
    const strong = index % 2 === 0;
    const day = String((index % 28) + 1).padStart(2, '0');
    return {
      id: `sleep-${index}`,
      date: `2026-04-${day}`,
      bedtime: `2026-04-${day}T22:30:00.000Z`,
      wake_time: `2026-04-${day}T06:30:00.000Z`,
      duration_minutes: strong ? 500 : 410,
      quality_rating: strong ? 5 : 3,
      wake_count: strong ? 1 : 3,
      sleep_latency_minutes: strong ? 12 : 28,
      wake_feeling: strong ? 'refreshed' : 'groggy',
    };
  });
}

function makeDb(
  rows: SleepJournalRow[],
  enabled = true,
  consent = true,
): DatabaseAdapter {
  return {
    execute: () => {},
    query: <T,>(sql: string): T[] => {
      if (sql.includes('hub_enabled_modules')) {
        return [{ count: enabled ? 2 : 1 }] as T[];
      }
      if (sql.includes('FROM hl_settings')) {
        return consent ? [{ value: 'true' }] as T[] : [];
      }
      if (sql.includes('FROM sl_settings')) {
        return [];
      }
      if (sql.includes('FROM sl_sleep_entries')) {
        return rows as T[];
      }
      return [];
    },
    transaction: (fn) => {
      fn();
    },
  };
}

describe('getHealthBridgeSummary function quality gate', () => {
  it('matches contract behavior for known cases', () => {
    const result = getHealthBridgeSummary(makeDb(makeRows(8)));

    expect(result.status).toBe('reportable');
    expect(result.sampleSize).toBe(8);
    expect(result.averageQualityRating).toBe(4);
    expect(result.averageDurationHours).toBe(7.6);
    expect(result.insight).toContain('summary only');
    expect(getHealthBridgeSummary(makeDb(makeRows(8), true, false)).status).toBe(
      'needs_consent',
    );
    expect(getHealthBridgeSummary(makeDb(makeRows(8), false, true)).status).toBe(
      'disabled',
    );
  });

  it('passes deterministic fuzz invariants', async () => {
    await runDeterministicFuzz({
      label: 'getHealthBridgeSummary fuzz',
      iterations: 200,
      seed: 42,
      makeCase: (rng) => ({
        db: makeDb(
          makeRows(randomInt(rng, 0, 120)),
          randomInt(rng, 0, 1) === 1,
          randomInt(rng, 0, 1) === 1,
        ),
      }),
      assertCase: async ({ db }) => {
        const result = getHealthBridgeSummary(db);

        expect(result.sampleSize).toBeGreaterThanOrEqual(0);
        expect(result.sharedFields.length).toBeGreaterThan(0);
        if (result.status === 'reportable') {
          expect(result.insight.length).toBeGreaterThan(0);
          expect(result.latestNight).not.toBeNull();
        }
      },
    });
  });

  it('stays within linear complexity slope budget', async () => {
    await assertComplexitySlope({
      label: 'getHealthBridgeSummary',
      sizes: [500, 1000, 2000],
      expected: 'linear',
      warmupRuns: 2,
      sampleRuns: 7,
      maxRatios: [4.0, 4.0],
      setup: (size) => makeDb(makeRows(size)),
      run: async (db) => {
        for (let index = 0; index < 20; index += 1) {
          getHealthBridgeSummary(db);
        }
      },
    });
  });

  it('stays within memory budget under repeated calls', async () => {
    await assertMemoryBudget({
      label: 'getHealthBridgeSummary',
      repeats: 40,
      maxHeapDeltaBytes: 24 * 1024 * 1024,
      setup: () => makeDb(makeRows(500)),
      run: async (db) => {
        getHealthBridgeSummary(db);
      },
    });
  });
});
