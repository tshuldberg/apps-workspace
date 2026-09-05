import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createModuleTestDatabase,
  type InMemoryTestDatabase,
} from '@mylife/db';
import { SLEEP_MODULE } from '../definition';
import {
  getStreakHistory,
  getStreaks,
  resetStreak,
  updateStreak,
} from '../db/crud';

let testDb: InMemoryTestDatabase;

beforeEach(() => {
  testDb = createModuleTestDatabase('sleep', SLEEP_MODULE.migrations ?? []);
});

afterEach(() => {
  testDb.close();
});

describe('sleep streaks', () => {
  it('creates default streak rows on first read', () => {
    const streaks = getStreaks(testDb.adapter);

    expect(streaks.map((streak) => streak.type)).toEqual([
      'quality_above_3',
      'on_time_bed',
      'target_hours',
      'no_snooze',
    ]);
    expect(streaks.every((streak) => streak.current_count === 0)).toBe(true);
  });

  it('increments consecutive streaks and keeps same-date updates idempotent', () => {
    const first = updateStreak(
      testDb.adapter,
      'quality_above_3',
      true,
      '2026-03-01',
    );
    const sameDay = updateStreak(
      testDb.adapter,
      'quality_above_3',
      true,
      '2026-03-01',
    );
    const second = updateStreak(
      testDb.adapter,
      'quality_above_3',
      true,
      '2026-03-02',
    );

    expect(first.current_count).toBe(1);
    expect(sameDay.current_count).toBe(1);
    expect(second.current_count).toBe(2);
    expect(second.longest_count).toBe(2);
  });

  it('resets on a miss while retaining longest count and history', () => {
    updateStreak(testDb.adapter, 'target_hours', true, '2026-03-01');
    updateStreak(testDb.adapter, 'target_hours', true, '2026-03-02');
    const reset = updateStreak(
      testDb.adapter,
      'target_hours',
      false,
      '2026-03-03',
    );

    expect(reset).toMatchObject({
      current_count: 0,
      longest_count: 2,
      last_date: '2026-03-03',
    });
    expect(getStreakHistory(testDb.adapter, 'target_hours')).toMatchObject([
      { date: '2026-03-01', met: true, current_count: 1 },
      { date: '2026-03-02', met: true, current_count: 2 },
      { date: '2026-03-03', met: false, current_count: 0 },
    ]);
  });

  it('supports manual resets without erasing records', () => {
    updateStreak(testDb.adapter, 'no_snooze', true, '2026-03-01');
    updateStreak(testDb.adapter, 'no_snooze', true, '2026-03-02');

    expect(resetStreak(testDb.adapter, 'no_snooze')).toMatchObject({
      current_count: 0,
      longest_count: 2,
      last_date: null,
    });
    expect(getStreaks(testDb.adapter).find((item) => item.type === 'no_snooze'))
      .toMatchObject({
        current_count: 0,
        longest_count: 2,
      });
  });
});
