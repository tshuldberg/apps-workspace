import {
  createModuleTestDatabase,
  enableModule,
  type InMemoryTestDatabase,
} from '@mylife/db';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MOOD_MODULE } from '../definition';
import { getLastNightSleep } from '../integrations/sleep-link';

let testDb: InMemoryTestDatabase;

function setupDb(): void {
  testDb = createModuleTestDatabase('mood', MOOD_MODULE.migrations ?? []);
  testDb.adapter.execute(
    `CREATE TABLE sl_sleep_entries (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      wake_time TEXT NOT NULL,
      duration_minutes INTEGER NOT NULL,
      quality_rating INTEGER NOT NULL,
      wake_feeling TEXT NOT NULL,
      created_at TEXT NOT NULL
    )`,
  );
}

function enableBridge(): void {
  enableModule(testDb.adapter, 'sleep');
  enableModule(testDb.adapter, 'mood');
}

function insertSleepEntry(
  id: string,
  date: string,
  durationMinutes: number,
  qualityRating: number,
): void {
  testDb.adapter.execute(
    `INSERT INTO sl_sleep_entries (
      id,
      date,
      wake_time,
      duration_minutes,
      quality_rating,
      wake_feeling,
      created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      date,
      `${date}T06:30:00.000Z`,
      durationMinutes,
      qualityRating,
      qualityRating >= 4 ? 'refreshed' : 'groggy',
      `${date}T07:00:00.000Z`,
    ],
  );
}

describe('mood sleep-link integration', () => {
  beforeEach(() => {
    setupDb();
  });

  afterEach(() => {
    testDb.close();
  });

  it('summarizes last night sleep for mood context when both modules are enabled', () => {
    enableBridge();
    insertSleepEntry('older', '2026-01-05', 390, 2);
    insertSleepEntry('latest', '2026-01-06', 420, 4);

    const summary = getLastNightSleep(testDb.adapter, {
      referenceDate: '2026-01-06',
    });

    expect(summary).toMatchObject({
      date: '2026-01-06',
      durationMinutes: 420,
      durationHours: 7,
      qualityRating: 4,
      context: 'Sleep context: 7h, quality 4/5',
    });
  });

  it('returns null without throwing when the bridge is disabled', () => {
    insertSleepEntry('latest', '2026-01-06', 420, 4);

    expect(getLastNightSleep(testDb.adapter)).toBeNull();
  });
});
