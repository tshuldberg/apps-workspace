import {
  createHubTestDatabase,
  enableModule,
  runModuleMigrations,
  type InMemoryTestDatabase,
} from '@mylife/db';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { HEALTH_MODULE } from '../definition';
import {
  getManualSleepBridgeStatus,
  getSleepJournalContext,
  setManualSleepBridgeEnabled,
} from '../integrations/sleep-link';

let testDb: InMemoryTestDatabase;

function setupDb(): void {
  testDb = createHubTestDatabase();
  runModuleMigrations(testDb.adapter, 'health', HEALTH_MODULE.migrations ?? []);
  testDb.adapter.execute(
    `CREATE TABLE sl_settings (
      key TEXT PRIMARY KEY,
      value TEXT
    )`,
  );
  testDb.adapter.execute(
    `CREATE TABLE sl_sleep_entries (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      bedtime TEXT,
      wake_time TEXT,
      duration_minutes INTEGER,
      quality_rating INTEGER,
      wake_count INTEGER,
      sleep_latency_minutes INTEGER,
      wake_feeling TEXT,
      created_at TEXT
    )`,
  );
}

function enableBridge(): void {
  enableModule(testDb.adapter, 'health');
  enableModule(testDb.adapter, 'sleep');
}

function insertSleepEntry(index: number, qualityRating: number): void {
  const date = `2026-03-${String(index + 1).padStart(2, '0')}`;
  testDb.adapter.execute(
    `INSERT INTO sl_sleep_entries (
      id,
      date,
      bedtime,
      wake_time,
      duration_minutes,
      quality_rating,
      wake_count,
      sleep_latency_minutes,
      wake_feeling,
      created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      `sleep-${index}`,
      date,
      `${date}T22:15:00.000Z`,
      `${date}T06:15:00.000Z`,
      qualityRating >= 4 ? 480 : 390,
      qualityRating,
      qualityRating >= 4 ? 1 : 4,
      qualityRating >= 4 ? 10 : 30,
      qualityRating >= 4 ? 'energized' : 'exhausted',
      `${date}T07:00:00.000Z`,
    ],
  );
}

function insertSleepEntries(): void {
  for (let index = 0; index < 3; index += 1) {
    insertSleepEntry(index, 5);
  }
  for (let index = 3; index < 6; index += 1) {
    insertSleepEntry(index, 2);
  }
}

function healthSleepSessionCount(): number {
  return testDb.adapter.query<{ count: number }>(
    `SELECT COUNT(*) as count FROM hl_sleep_sessions`,
  )[0]?.count ?? 0;
}

describe('health sleep-link integration', () => {
  beforeEach(() => {
    setupDb();
  });

  afterEach(() => {
    testDb.close();
  });

  it('returns a consent CTA before exposing MySleep journal data', () => {
    enableBridge();
    insertSleepEntries();

    const context = getSleepJournalContext(testDb.adapter);

    expect(context).toMatchObject({
      status: 'needs_consent',
      title: 'Connect MySleep journal',
      summary: null,
    });
    expect(context?.body).toContain('Review the MySleep preview');
  });

  it('returns manual journal context after explicit opt-in', () => {
    enableBridge();
    insertSleepEntries();
    setManualSleepBridgeEnabled(testDb.adapter, true);

    const beforeCount = healthSleepSessionCount();
    const status = getManualSleepBridgeStatus(testDb.adapter);
    const context = getSleepJournalContext(testDb.adapter);
    const afterCount = healthSleepSessionCount();

    expect(status).toMatchObject({ state: 'enabled', enabled: true });
    expect(context).toMatchObject({
      status: 'ready',
      title: 'Manual sleep journal',
    });
    expect(context?.summary).toMatchObject({
      sampleSize: 6,
      averageDurationHours: 7.3,
      averageQualityRating: 3.5,
      averageWakeCount: 2.5,
      averageSleepLatencyMinutes: 20,
      positiveWakeFeelingRate: 50,
    });
    expect(afterCount).toBe(beforeCount);
  });

  it('returns no context when the paired module is disabled', () => {
    enableModule(testDb.adapter, 'health');
    insertSleepEntries();

    expect(getSleepJournalContext(testDb.adapter)).toBeNull();
  });

  it('returns no-data context after consent when MySleep has no journal rows', () => {
    enableBridge();
    setManualSleepBridgeEnabled(testDb.adapter, true);

    const context = getSleepJournalContext(testDb.adapter);

    expect(context).toMatchObject({
      status: 'no_data',
      summary: null,
    });
  });
});
