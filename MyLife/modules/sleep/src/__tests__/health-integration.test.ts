import {
  createHubTestDatabase,
  enableModule,
  runModuleMigrations,
  type InMemoryTestDatabase,
} from '@mylife/db';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SLEEP_MODULE } from '../definition';
import {
  buildHealthSyncPreview,
  getHealthBridgeSummary,
} from '../integrations/health';

let testDb: InMemoryTestDatabase;

function setupDb(): void {
  testDb = createHubTestDatabase();
  runModuleMigrations(testDb.adapter, 'sleep', SLEEP_MODULE.migrations ?? []);
  testDb.adapter.execute(
    `CREATE TABLE hl_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )`,
  );
  testDb.adapter.execute(
    `CREATE TABLE hl_sleep_sessions (
      id TEXT PRIMARY KEY,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      duration_minutes INTEGER NOT NULL
    )`,
  );
}

function enableBridge(): void {
  enableModule(testDb.adapter, 'sleep');
  enableModule(testDb.adapter, 'health');
}

function setConsent(enabled: boolean): void {
  testDb.adapter.execute(
    `INSERT INTO hl_settings (key, value)
     VALUES ('bridge.sleepJournal.enabled', ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [enabled ? 'true' : 'false'],
  );
}

function insertSleepEntry(index: number, qualityRating: number): void {
  const day = String(index + 1).padStart(2, '0');
  const date = `2026-02-${day}`;
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
      `${date}T22:30:00.000Z`,
      `${date}T22:45:00.000Z`,
      `${date}T06:30:00.000Z`,
      qualityRating >= 4 ? 500 : 410,
      qualityRating,
      qualityRating >= 4 ? 1 : 3,
      qualityRating >= 4 ? 12 : 28,
      null,
      0,
      qualityRating >= 4 ? 'refreshed' : 'groggy',
      'private journal note',
      `${date}T07:00:00.000Z`,
      `${date}T07:00:00.000Z`,
    ],
  );
}

function insertSleepEntries(): void {
  for (let index = 0; index < 4; index += 1) {
    insertSleepEntry(index, 5);
  }
  for (let index = 4; index < 8; index += 1) {
    insertSleepEntry(index, 3);
  }
}

function healthSleepSessionCount(): number {
  return testDb.adapter.query<{ count: number }>(
    `SELECT COUNT(*) as count FROM hl_sleep_sessions`,
  )[0]?.count ?? 0;
}

describe('sleep health integration', () => {
  beforeEach(() => {
    setupDb();
  });

  afterEach(() => {
    testDb.close();
  });

  it('builds a preview before consent without copying rows into Health sleep tables', () => {
    enableBridge();
    insertSleepEntries();

    const beforeCount = healthSleepSessionCount();
    const preview = buildHealthSyncPreview(testDb.adapter, {
      startDate: '2026-02-01',
      endDate: '2026-02-08',
    });
    const afterCount = healthSleepSessionCount();

    expect(preview).toMatchObject({
      status: 'ready',
      consentRequired: true,
      destinationModule: 'health',
    });
    expect(preview.previewCopy).toContain('Raw journal rows');
    expect(preview.excludedFields).toContain('private notes');
    expect(preview.summary?.sampleSize).toBe(8);
    expect(afterCount).toBe(beforeCount);
  });

  it('does not expose the consumable summary until consent is enabled', () => {
    enableBridge();
    insertSleepEntries();

    const result = getHealthBridgeSummary(testDb.adapter);

    expect(result.status).toBe('needs_consent');
    expect(result.sampleSize).toBe(0);
  });

  it('returns an aggregate manual journal summary after explicit consent', () => {
    enableBridge();
    setConsent(true);
    insertSleepEntries();

    const result = getHealthBridgeSummary(testDb.adapter);

    expect(result).toMatchObject({
      status: 'reportable',
      sampleSize: 8,
      averageDurationHours: 7.6,
      averageQualityRating: 4,
      averageWakeCount: 2,
      averageSleepLatencyMinutes: 20,
      positiveWakeFeelingRate: 50,
      mostCommonWakeFeeling: 'refreshed',
    });
    expect(result.insight).toContain('summary only');
  });

  it('silently disables the bridge when Health is not enabled', () => {
    enableModule(testDb.adapter, 'sleep');
    insertSleepEntries();

    expect(getHealthBridgeSummary(testDb.adapter).status).toBe('disabled');
    expect(buildHealthSyncPreview(testDb.adapter).status).toBe('disabled');
  });
});
