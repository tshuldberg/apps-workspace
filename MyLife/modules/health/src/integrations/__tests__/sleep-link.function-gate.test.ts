import type { DatabaseAdapter } from '@mylife/db';
import { describe, expect, it } from 'vitest';
import {
  assertComplexitySlope,
  assertMemoryBudget,
  randomInt,
  runDeterministicFuzz,
} from '../../test/function-quality';
import { getSleepJournalContext } from '../sleep-link';

interface SleepJournalRow {
  date: string;
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
      date: `2026-04-${day}`,
      duration_minutes: strong ? 480 : 390,
      quality_rating: strong ? 5 : 2,
      wake_count: strong ? 1 : 4,
      sleep_latency_minutes: strong ? 10 : 30,
      wake_feeling: strong ? 'energized' : 'exhausted',
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

describe('getSleepJournalContext function quality gate', () => {
  it('matches contract behavior for known cases', () => {
    const result = getSleepJournalContext(makeDb(makeRows(8)));

    expect(result?.status).toBe('ready');
    expect(result?.summary?.sampleSize).toBe(8);
    expect(result?.body).toContain('MySleep manual journal');
    expect(getSleepJournalContext(makeDb(makeRows(8), true, false))?.status).toBe(
      'needs_consent',
    );
    expect(getSleepJournalContext(makeDb(makeRows(8), false, true))).toBeNull();
    expect(getSleepJournalContext(makeDb([], true, true))?.status).toBe('no_data');
  });

  it('passes deterministic fuzz invariants', async () => {
    await runDeterministicFuzz({
      label: 'getSleepJournalContext fuzz',
      iterations: 200,
      seed: 42,
      makeCase: (rng) => makeDb(
        makeRows(randomInt(rng, 0, 120)),
        randomInt(rng, 0, 1) === 1,
        randomInt(rng, 0, 1) === 1,
      ),
      assertCase: async (db) => {
        const result = getSleepJournalContext(db);

        if (result) {
          expect(result.title.length).toBeGreaterThan(0);
          expect(result.bridgeStatus.settingKey).toBe('bridge.sleepJournal.enabled');
        }
        if (result?.status === 'ready') {
          expect(result.summary?.sampleSize).toBeGreaterThan(0);
        }
      },
    });
  });

  it('stays within linear complexity slope budget', async () => {
    await assertComplexitySlope({
      label: 'getSleepJournalContext',
      sizes: [120, 240, 360],
      expected: 'linear',
      setup: (size) => makeDb(makeRows(size)),
      run: async (db) => {
        getSleepJournalContext(db);
      },
    });
  });

  it('stays within memory budget under repeated calls', async () => {
    await assertMemoryBudget({
      label: 'getSleepJournalContext',
      repeats: 40,
      maxHeapDeltaBytes: 8 * 1024 * 1024,
      setup: () => makeDb(makeRows(500)),
      run: async (db) => {
        getSleepJournalContext(db);
      },
    });
  });
});
