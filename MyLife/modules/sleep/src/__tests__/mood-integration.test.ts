import {
  createHubTestDatabase,
  enableModule,
  runModuleMigrations,
  type InMemoryTestDatabase,
} from '@mylife/db';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SLEEP_MODULE } from '../definition';
import { getSleepMoodCorrelation } from '../integrations/mood';

let testDb: InMemoryTestDatabase;

function setupDb(): void {
  testDb = createHubTestDatabase();
  runModuleMigrations(testDb.adapter, 'sleep', SLEEP_MODULE.migrations ?? []);
  testDb.adapter.execute(
    `CREATE TABLE mo_entries (
      id TEXT PRIMARY KEY,
      score INTEGER NOT NULL,
      note TEXT,
      logged_at TEXT NOT NULL,
      date TEXT NOT NULL,
      created_at TEXT NOT NULL
    )`,
  );
}

function enableBridge(): void {
  enableModule(testDb.adapter, 'sleep');
  enableModule(testDb.adapter, 'mood');
}

function dateForIndex(index: number): string {
  return `2026-01-${String(index + 1).padStart(2, '0')}`;
}

function insertPair(index: number, qualityRating: number, moodScore: number): void {
  const date = dateForIndex(index);
  const bedDate = index === 0 ? '2025-12-31' : dateForIndex(index - 1);
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
      `sleep-${index}`,
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
  testDb.adapter.execute(
    `INSERT INTO mo_entries (id, score, note, logged_at, date, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      `mood-${index}`,
      moodScore,
      null,
      `${date}T09:00:00.000Z`,
      date,
      `${date}T09:00:00.000Z`,
    ],
  );
}

describe('sleep mood integration', () => {
  beforeEach(() => {
    setupDb();
  });

  afterEach(() => {
    testDb.close();
  });

  it('correlates sleep quality with same-day mood after both modules are enabled', () => {
    enableBridge();
    for (let index = 0; index < 4; index += 1) {
      insertPair(index, 5, 8);
    }
    for (let index = 4; index < 8; index += 1) {
      insertPair(index, 2, 3);
    }

    const result = getSleepMoodCorrelation(testDb.adapter, {
      startDate: '2026-01-01',
      endDate: '2026-01-08',
    });

    expect(result).toMatchObject({
      status: 'reportable',
      sampleSize: 8,
      goodSleepAverageMood: 8,
      lowerQualitySleepAverageMood: 3,
      insight: 'Your mood averages 8.0/10 after nights with quality 4+, vs 3.0/10 after lower-quality sleep.',
    });
    expect(result.correlation).toBeGreaterThan(0.9);
  });

  it('does not expose a card-ready correlation before seven paired days', () => {
    enableBridge();
    for (let index = 0; index < 6; index += 1) {
      insertPair(index, index % 2 === 0 ? 5 : 2, index % 2 === 0 ? 8 : 3);
    }

    const result = getSleepMoodCorrelation(testDb.adapter);

    expect(result.status).toBe('insufficient_data');
    expect(result.sampleSize).toBe(6);
    expect(result.insight).toBe('');
  });

  it('gracefully disables the bridge when either module is not enabled', () => {
    for (let index = 0; index < 8; index += 1) {
      insertPair(index, 5, 8);
    }

    const result = getSleepMoodCorrelation(testDb.adapter);

    expect(result).toMatchObject({
      status: 'disabled',
      sampleSize: 0,
      insight: '',
    });
  });
});
