import {
  createModuleTestDatabase,
  enableModule,
  type InMemoryTestDatabase,
} from '@mylife/db';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createHabit, recordCompletion } from '../db/crud';
import { HABITS_MODULE } from '../definition';
import { getSleepRoutineContext } from '../integrations/sleep-link';

let testDb: InMemoryTestDatabase;

function setupDb(): void {
  testDb = createModuleTestDatabase('habits', HABITS_MODULE.migrations ?? []);
  testDb.adapter.execute(
    `CREATE TABLE sl_sleep_entries (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      bedtime TEXT,
      wake_time TEXT,
      duration_minutes INTEGER NOT NULL,
      quality_rating INTEGER NOT NULL,
      created_at TEXT NOT NULL
    )`,
  );
}

function enableBridge(): void {
  enableModule(testDb.adapter, 'sleep');
  enableModule(testDb.adapter, 'habits');
}

function insertSleepEntry(
  id: string,
  sleepDate: string,
  routineDate: string,
  durationMinutes: number,
  qualityRating: number,
): void {
  testDb.adapter.execute(
    `INSERT INTO sl_sleep_entries (
      id,
      date,
      bedtime,
      wake_time,
      duration_minutes,
      quality_rating,
      created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      sleepDate,
      `${routineDate}T22:30:00.000Z`,
      `${sleepDate}T06:30:00.000Z`,
      durationMinutes,
      qualityRating,
      `${sleepDate}T07:00:00.000Z`,
    ],
  );
}

describe('habits sleep-link integration', () => {
  beforeEach(() => {
    setupDb();
  });

  afterEach(() => {
    testDb.close();
  });

  it('summarizes last-night sleep with bedtime routine completion context', () => {
    enableBridge();
    createHabit(testDb.adapter, 'wind-down', {
      name: 'Wind down routine',
      timeOfDay: 'evening',
    });
    insertSleepEntry('sleep-1', '2026-01-06', '2026-01-05', 420, 4);
    recordCompletion(
      testDb.adapter,
      'completion-1',
      'wind-down',
      '2026-01-05T20:30:00.000Z',
      1,
    );

    const context = getSleepRoutineContext(testDb.adapter, {
      date: '2026-01-06',
    });

    expect(context).toMatchObject({
      sleepDate: '2026-01-06',
      routineDate: '2026-01-05',
      durationMinutes: 420,
      durationHours: 7,
      qualityRating: 4,
      routineHabitCount: 1,
      completedRoutineCount: 1,
      completionRate: 100,
      context: 'Sleep context: 7h, quality 4/5 after 1 of 1 bedtime routine habits.',
    });
  });

  it('returns null without throwing when the bridge is disabled', () => {
    createHabit(testDb.adapter, 'wind-down', {
      name: 'Wind down routine',
      timeOfDay: 'evening',
    });
    insertSleepEntry('sleep-1', '2026-01-06', '2026-01-05', 420, 4);

    expect(getSleepRoutineContext(testDb.adapter)).toBeNull();
  });

  it('returns null when there are no routine habits to connect', () => {
    enableBridge();
    insertSleepEntry('sleep-1', '2026-01-06', '2026-01-05', 420, 4);

    expect(getSleepRoutineContext(testDb.adapter)).toBeNull();
  });
});
