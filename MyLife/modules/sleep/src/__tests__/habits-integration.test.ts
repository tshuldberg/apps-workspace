import {
  createHubTestDatabase,
  enableModule,
  runModuleMigrations,
  type InMemoryTestDatabase,
} from '@mylife/db';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SLEEP_MODULE } from '../definition';
import {
  buildHabitCompletionHints,
  getSleepHabitAdherence,
  suggestSleepHabits,
} from '../integrations/habits';

let testDb: InMemoryTestDatabase;

function setupDb(): void {
  testDb = createHubTestDatabase();
  runModuleMigrations(testDb.adapter, 'sleep', SLEEP_MODULE.migrations ?? []);
  testDb.adapter.execute(
    `CREATE TABLE hb_habits (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      time_of_day TEXT,
      habit_type TEXT,
      target_count INTEGER,
      is_archived INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0
    )`,
  );
  testDb.adapter.execute(
    `CREATE TABLE hb_completions (
      id TEXT PRIMARY KEY,
      habit_id TEXT NOT NULL,
      completed_at TEXT NOT NULL
    )`,
  );
}

function enableBridge(): void {
  enableModule(testDb.adapter, 'sleep');
  enableModule(testDb.adapter, 'habits');
}

function dateForIndex(index: number): string {
  return `2026-01-${String(index + 1).padStart(2, '0')}`;
}

function insertRoutineHabit(id: string, name = 'Wind down routine'): void {
  testDb.adapter.execute(
    `INSERT INTO hb_habits (
      id,
      name,
      time_of_day,
      habit_type,
      target_count,
      is_archived,
      sort_order
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, name, 'evening', 'standard', 1, 0, 0],
  );
}

function insertSleepEntry(index: number, qualityRating: number): string {
  const date = dateForIndex(index);
  const bedDate = index === 0 ? '2025-12-31' : dateForIndex(index - 1);
  const id = `sleep-${index}`;

  testDb.adapter.execute(
    `INSERT INTO sl_sleep_entries (
      id,
      date,
      bedtime,
      sleep_onset_time,
      wake_time,
      duration_minutes,
      quality_rating,
      wake_count,
      sleep_latency_minutes,
      alarm_time,
      snooze_count,
      wake_feeling,
      notes_md,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      date,
      `${bedDate}T22:30:00.000Z`,
      `${bedDate}T22:45:00.000Z`,
      `${date}T06:30:00.000Z`,
      qualityRating >= 4 ? 480 : 390,
      qualityRating,
      qualityRating >= 4 ? 1 : 3,
      15,
      null,
      0,
      qualityRating >= 4 ? 'refreshed' : 'groggy',
      null,
      `${date}T07:00:00.000Z`,
      `${date}T07:00:00.000Z`,
    ],
  );

  return id;
}

function insertRoutineCompletion(habitId: string, routineDate: string): void {
  testDb.adapter.execute(
    `INSERT INTO hb_completions (id, habit_id, completed_at)
     VALUES (?, ?, ?)`,
    [`completion-${habitId}-${routineDate}`, habitId, `${routineDate}T20:30:00.000Z`],
  );
}

function insertSleepFactor(entryId: string, date: string): void {
  testDb.adapter.execute(
    `INSERT INTO sl_factors (
      id,
      sleep_entry_id,
      date,
      last_caffeine_time,
      last_meal_time,
      alcohol_drinks,
      exercise_today,
      exercise_time,
      screen_cutoff_time,
      room_temp,
      room_light,
      room_noise,
      supplements,
      stress_level,
      pre_sleep_activities,
      notes,
      created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      'factor-1',
      entryId,
      date,
      '13:30',
      '18:00',
      0,
      1,
      '17:00',
      '21:00',
      'cool',
      'dark',
      'quiet',
      '[]',
      2,
      JSON.stringify(['reading', 'meditation']),
      null,
      `${date}T20:00:00.000Z`,
    ],
  );
}

describe('sleep habits integration', () => {
  beforeEach(() => {
    setupDb();
  });

  afterEach(() => {
    testDb.close();
  });

  it('summarizes bedtime routine adherence when both modules are enabled', () => {
    enableBridge();
    insertRoutineHabit('wind-down');

    for (let index = 0; index < 4; index += 1) {
      insertSleepEntry(index, 5);
      const routineDate = index === 0 ? '2025-12-31' : dateForIndex(index - 1);
      insertRoutineCompletion('wind-down', routineDate);
    }
    for (let index = 4; index < 8; index += 1) {
      insertSleepEntry(index, 2);
    }

    const result = getSleepHabitAdherence(testDb.adapter, {
      startDate: '2026-01-01',
      endDate: '2026-01-08',
    });

    expect(result).toMatchObject({
      status: 'reportable',
      sampleSize: 8,
      routineHabitCount: 1,
      completedRoutineDays: 4,
      adherenceRate: 50,
      averageQualityAfterRoutine: 5,
      averageQualityWithoutRoutine: 2,
      qualityDelta: 3,
    });
    expect(result.insight).toContain('After bedtime routine completions');
  });

  it('derives explicit habit completion hints without mutating Habits data', () => {
    enableBridge();
    const entryId = insertSleepEntry(0, 5);
    insertSleepFactor(entryId, '2026-01-01');

    const beforeCount = testDb.adapter.query<{ count: number }>(
      `SELECT COUNT(*) as count FROM hb_completions`,
    )[0]?.count ?? 0;
    const hints = buildHabitCompletionHints(testDb.adapter, entryId);
    const afterCount = testDb.adapter.query<{ count: number }>(
      `SELECT COUNT(*) as count FROM hb_completions`,
    )[0]?.count ?? 0;

    expect(hints.map((hint) => hint.suggestedHabitName)).toContain('Wind down routine');
    expect(hints.map((hint) => hint.suggestedHabitName)).toContain('No screens before bed');
    expect(hints.every((hint) => hint.completed)).toBe(true);
    expect(afterCount).toBe(beforeCount);
  });

  it('returns starter habit suggestions without creating habits', () => {
    const suggestions = suggestSleepHabits();

    expect(suggestions.map((suggestion) => suggestion.name)).toEqual(
      expect.arrayContaining([
        'Wind down routine',
        'No screens before bed',
        'Consistent bedtime',
      ]),
    );
    expect(suggestions.every((suggestion) => suggestion.timeOfDay === 'evening')).toBe(true);
  });

  it('gracefully disables the bridge when either module is not enabled', () => {
    insertRoutineHabit('wind-down');
    for (let index = 0; index < 8; index += 1) {
      insertSleepEntry(index, 5);
    }

    const result = getSleepHabitAdherence(testDb.adapter);

    expect(result).toMatchObject({
      status: 'disabled',
      sampleSize: 0,
      insight: '',
    });
    expect(buildHabitCompletionHints(testDb.adapter, 'sleep-0')).toEqual([]);
  });
});
