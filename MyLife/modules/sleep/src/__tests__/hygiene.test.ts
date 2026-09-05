import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createModuleTestDatabase,
  type InMemoryTestDatabase,
} from '@mylife/db';
import { SLEEP_MODULE } from '../definition';
import { createEntry, createFactor } from '../db/crud';
import {
  getHygieneChecksByDate,
  saveHygieneCheck,
} from '../db/crud/hygiene';
import {
  buildSleepHygieneChecklist,
  getEnabledHygienePracticeIds,
  getSleepHygieneDashboard,
  serializeEnabledHygienePracticeIds,
} from '../engine/hygiene';

let testDb: InMemoryTestDatabase;

beforeEach(() => {
  testDb = createModuleTestDatabase('sleep', SLEEP_MODULE.migrations ?? []);
});

afterEach(() => {
  testDb.close();
});

describe('sleep hygiene checklist', () => {
  it('auto-fills practices from factor and entry data', () => {
    const entry = createEntry(testDb.adapter, {
      bedtime: '2026-04-22T22:30:00.000Z',
      sleep_onset_time: '2026-04-22T22:45:00.000Z',
      wake_time: '2026-04-23T06:30:00.000Z',
      quality_rating: 5,
      wake_count: 0,
      wake_feeling: 'energized',
    });
    const factor = createFactor(testDb.adapter, {
      sleep_entry_id: entry.id,
      date: entry.date,
      last_caffeine_time: '13:30',
      last_meal_time: '19:30',
      alcohol_drinks: 0,
      exercise_today: true,
      exercise_time: '17:30',
      screen_cutoff_time: '21:00',
      room_temp: 'cool',
      room_light: 'dark',
      room_noise: 'quiet',
      supplements: [],
      stress_level: 2,
      pre_sleep_activities: ['reading', 'meditation'],
      notes: null,
    });

    const checklist = buildSleepHygieneChecklist(entry.date, {
      entries: [entry],
      factors: [factor],
      targetBedtime: '22:30',
    });

    expect(checklist.score).toBe(100);
    expect(checklist.items.every((item) => item.status === 'met')).toBe(true);
    expect(checklist.items.every((item) => item.autoFilled)).toBe(true);
  });

  it('lets manual check-offs override auto-filled misses', () => {
    const entry = createEntry(testDb.adapter, {
      bedtime: '2026-04-22T23:30:00.000Z',
      wake_time: '2026-04-23T06:30:00.000Z',
      quality_rating: 3,
      wake_count: 2,
      wake_feeling: 'groggy',
    });
    const check = saveHygieneCheck(testDb.adapter, {
      date: entry.date,
      practice_id: 'consistent_bedtime_30m',
      met: true,
      source: 'manual',
    });

    const checklist = buildSleepHygieneChecklist(entry.date, {
      entries: [entry],
      factors: [],
      checks: [check],
      targetBedtime: '22:30',
      enabledPracticeIds: ['consistent_bedtime_30m'],
    });

    expect(checklist.score).toBe(100);
    expect(checklist.items[0]).toMatchObject({
      status: 'met',
      source: 'manual',
      autoFilled: false,
    });
    expect(getHygieneChecksByDate(testDb.adapter, entry.date)).toHaveLength(1);
  });

  it('calculates weekly adherence and quality correlation', () => {
    const entries = Array.from({ length: 7 }, (_, index) => {
      const day = index + 1;
      return createEntry(testDb.adapter, {
        bedtime: `2026-04-${String(day).padStart(2, '0')}T22:30:00.000Z`,
        wake_time: `2026-04-${String(day + 1).padStart(2, '0')}T06:30:00.000Z`,
        quality_rating: index < 4 ? 5 : 2,
        wake_count: 0,
        wake_feeling: index < 4 ? 'refreshed' : 'groggy',
      });
    });
    const checks = entries.flatMap((entry, index) =>
      [
        saveHygieneCheck(testDb.adapter, {
          date: entry.date,
          practice_id: 'no_caffeine_after_2pm',
          met: index < 4,
          source: 'manual',
        }),
        saveHygieneCheck(testDb.adapter, {
          date: entry.date,
          practice_id: 'relaxation_routine',
          met: index < 4,
          source: 'manual',
        }),
      ],
    );

    const dashboard = getSleepHygieneDashboard({
      entries,
      factors: [],
      checks,
      referenceDate: '2026-04-08',
      enabledPracticeIds: ['no_caffeine_after_2pm', 'relaxation_routine'],
    });

    expect(dashboard.weeklyScore).toBe(57.1);
    expect(dashboard.correlation.status).toBe('reportable');
    expect(dashboard.correlation.direction).toBe('positive');
    expect(dashboard.correlation.qualityDelta).toBe(3);
  });

  it('normalizes enabled practice settings', () => {
    const serialized = serializeEnabledHygienePracticeIds([
      'relaxation_routine',
      'relaxation_routine',
      'no_screens_1h',
    ]);

    expect(getEnabledHygienePracticeIds(serialized)).toEqual([
      'relaxation_routine',
      'no_screens_1h',
    ]);
    expect(getEnabledHygienePracticeIds('not-json')).toContain(
      'no_caffeine_after_2pm',
    );
  });
});
