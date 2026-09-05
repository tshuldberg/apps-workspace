import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { HEALTH_MODULE } from '../../definition';
import {
  mapHKTypeToVitalType,
  mapVitalTypeToHK,
  bulkInsertVitals,
  bulkInsertSleep,
  getSyncLog,
  getAllSyncLogs,
  updateSyncAnchor,
  getLastSyncAnchor,
  deleteSyncedVitals,
  deleteSyncedSleep,
  deleteAllSyncedData,
  computeSyncStartDate,
} from '../sync';
import type { HealthKitSample } from '../types';
import { INITIAL_SYNC_DAYS } from '../types';

let db: DatabaseAdapter;
let closeDb: () => void;

beforeEach(() => {
  const testDb = createModuleTestDatabase('health', HEALTH_MODULE.migrations!);
  db = testDb.adapter;
  closeDb = testDb.close;
});

afterEach(() => {
  closeDb();
});

// ---------------------------------------------------------------------------
// Type mapping
// ---------------------------------------------------------------------------

describe('mapHKTypeToVitalType', () => {
  it('maps HKQuantityTypeIdentifierHeartRate to heart_rate', () => {
    expect(mapHKTypeToVitalType('HKQuantityTypeIdentifierHeartRate')).toBe('heart_rate');
  });

  it('maps all 10 supported types correctly', () => {
    const mappings: [string, string][] = [
      ['HKQuantityTypeIdentifierHeartRate', 'heart_rate'],
      ['HKQuantityTypeIdentifierRestingHeartRate', 'resting_heart_rate'],
      ['HKQuantityTypeIdentifierHeartRateVariabilitySDNN', 'hrv'],
      ['HKQuantityTypeIdentifierOxygenSaturation', 'blood_oxygen'],
      ['HKQuantityTypeIdentifierBloodPressureSystolic', 'blood_pressure'],
      ['HKQuantityTypeIdentifierBodyTemperature', 'body_temperature'],
      ['HKQuantityTypeIdentifierStepCount', 'steps'],
      ['HKQuantityTypeIdentifierActiveEnergyBurned', 'active_energy'],
      ['HKQuantityTypeIdentifierRespiratoryRate', 'respiratory_rate'],
      ['HKQuantityTypeIdentifierVO2Max', 'vo2_max'],
    ];
    for (const [hk, vital] of mappings) {
      expect(mapHKTypeToVitalType(hk)).toBe(vital);
    }
  });

  it('returns null for unknown type', () => {
    expect(mapHKTypeToVitalType('HKQuantityTypeIdentifierUnknown')).toBeNull();
  });
});

describe('mapVitalTypeToHK', () => {
  it('maps heart_rate back to HK identifier', () => {
    expect(mapVitalTypeToHK('heart_rate')).toBe('HKQuantityTypeIdentifierHeartRate');
  });
});

// ---------------------------------------------------------------------------
// Sync log
// ---------------------------------------------------------------------------

describe('sync log CRUD', () => {
  it('returns null for never-synced type', () => {
    expect(getSyncLog(db, 'heart_rate')).toBeNull();
    expect(getLastSyncAnchor(db, 'heart_rate')).toBeNull();
  });

  it('stores new anchor and timestamp', () => {
    updateSyncAnchor(db, 'heart_rate', '2026-03-20T10:00:00Z', 42);
    const log = getSyncLog(db, 'heart_rate');
    expect(log).not.toBeNull();
    expect(log!.data_type).toBe('heart_rate');
    expect(log!.last_anchor).toBe('2026-03-20T10:00:00Z');
    expect(log!.records_synced).toBe(42);
    expect(log!.error_message).toBeNull();
  });

  it('accumulates records_synced on upsert', () => {
    updateSyncAnchor(db, 'steps', '2026-03-20T10:00:00Z', 100);
    updateSyncAnchor(db, 'steps', '2026-03-21T10:00:00Z', 50);
    const log = getSyncLog(db, 'steps');
    expect(log!.records_synced).toBe(150);
    expect(log!.last_anchor).toBe('2026-03-21T10:00:00Z');
  });

  it('stores error message', () => {
    updateSyncAnchor(db, 'hrv', null, 0, 'Permission denied');
    const log = getSyncLog(db, 'hrv');
    expect(log!.error_message).toBe('Permission denied');
    expect(log!.records_synced).toBe(0);
  });

  it('getAllSyncLogs returns all entries', () => {
    updateSyncAnchor(db, 'heart_rate', 'a1', 10);
    updateSyncAnchor(db, 'steps', 'a2', 20);
    const logs = getAllSyncLogs(db);
    expect(logs.length).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Bulk insert vitals
// ---------------------------------------------------------------------------

describe('bulkInsertVitals', () => {
  function makeSample(overrides: Partial<HealthKitSample> = {}): HealthKitSample {
    return {
      uuid: `hk-${Math.random().toString(36).slice(2)}`,
      type: 'HKQuantityTypeIdentifierHeartRate',
      value: 72,
      unit: 'bpm',
      startDate: '2026-03-20T10:00:00Z',
      endDate: '2026-03-20T10:00:01Z',
      ...overrides,
    };
  }

  it('inserts batch of records correctly', () => {
    const samples = Array.from({ length: 100 }, (_, i) =>
      makeSample({
        startDate: `2026-03-20T${String(10 + Math.floor(i / 60)).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}:00Z`,
      }),
    );
    const inserted = bulkInsertVitals(db, samples);
    expect(inserted).toBe(100);

    const rows = db.query<{ id: string }>('SELECT id FROM hl_vitals');
    expect(rows.length).toBe(100);
  });

  it('skips duplicates (same recorded_at + vital_type + source)', () => {
    const sample = makeSample();
    bulkInsertVitals(db, [sample]);
    const insertedAgain = bulkInsertVitals(db, [sample]);
    expect(insertedAgain).toBe(0);

    const rows = db.query<{ id: string }>('SELECT id FROM hl_vitals');
    expect(rows.length).toBe(1);
  });

  it('skips samples with unknown HK types', () => {
    const sample = makeSample({ type: 'HKQuantityTypeIdentifierUnknown' });
    const inserted = bulkInsertVitals(db, [sample]);
    expect(inserted).toBe(0);
  });

  it('handles secondary values', () => {
    const sample = makeSample({
      type: 'HKQuantityTypeIdentifierBloodPressureSystolic',
      value: 120,
      valueSecondary: 80,
      unit: 'mmHg',
    });
    bulkInsertVitals(db, [sample]);
    const rows = db.query<{ value: number; value_secondary: number }>(
      'SELECT value, value_secondary FROM hl_vitals',
    );
    expect(rows[0].value).toBe(120);
    expect(rows[0].value_secondary).toBe(80);
  });
});

// ---------------------------------------------------------------------------
// Bulk insert sleep
// ---------------------------------------------------------------------------

describe('bulkInsertSleep', () => {
  it('inserts sleep sessions', () => {
    const sessions = [
      { startTime: '2026-03-20T22:00:00Z', endTime: '2026-03-21T06:00:00Z', durationMinutes: 480 },
      { startTime: '2026-03-21T23:00:00Z', endTime: '2026-03-22T07:00:00Z', durationMinutes: 480 },
    ];
    const inserted = bulkInsertSleep(db, sessions);
    expect(inserted).toBe(2);
  });

  it('skips duplicate sleep sessions', () => {
    const session = {
      startTime: '2026-03-20T22:00:00Z',
      endTime: '2026-03-21T06:00:00Z',
      durationMinutes: 480,
    };
    bulkInsertSleep(db, [session]);
    const again = bulkInsertSleep(db, [session]);
    expect(again).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Delete synced data
// ---------------------------------------------------------------------------

describe('deleteSyncedData', () => {
  it('removes only apple_health-sourced vitals', () => {
    db.execute(
      `INSERT INTO hl_vitals (id, vital_type, value, unit, source, recorded_at)
       VALUES ('manual-1', 'heart_rate', 70, 'bpm', 'manual', '2026-03-20T10:00:00Z')`,
    );
    db.execute(
      `INSERT INTO hl_vitals (id, vital_type, value, unit, source, recorded_at)
       VALUES ('hk-1', 'heart_rate', 72, 'bpm', 'apple_health', '2026-03-20T10:01:00Z')`,
    );
    db.execute(
      `INSERT INTO hl_vitals (id, vital_type, value, unit, source, recorded_at)
       VALUES ('hk-2', 'steps', 5000, 'count', 'apple_health', '2026-03-20T10:02:00Z')`,
    );

    const deleted = deleteSyncedVitals(db);
    expect(deleted).toBe(2);

    const remaining = db.query<{ id: string }>('SELECT id FROM hl_vitals');
    expect(remaining.length).toBe(1);
    expect(remaining[0].id).toBe('manual-1');
  });

  it('preserves manual sleep entries', () => {
    db.execute(
      `INSERT INTO hl_sleep_sessions (id, start_time, end_time, duration_minutes, source)
       VALUES ('manual-slp', '2026-03-20T22:00:00Z', '2026-03-21T06:00:00Z', 480, 'manual')`,
    );
    db.execute(
      `INSERT INTO hl_sleep_sessions (id, start_time, end_time, duration_minutes, source)
       VALUES ('hk-slp', '2026-03-21T22:00:00Z', '2026-03-22T06:00:00Z', 480, 'apple_health')`,
    );

    const deleted = deleteSyncedSleep(db);
    expect(deleted).toBe(1);

    const remaining = db.query<{ id: string }>('SELECT id FROM hl_sleep_sessions');
    expect(remaining.length).toBe(1);
    expect(remaining[0].id).toBe('manual-slp');
  });

  it('deleteAllSyncedData clears vitals, sleep, and sync log', () => {
    db.execute(
      `INSERT INTO hl_vitals (id, vital_type, value, unit, source, recorded_at)
       VALUES ('hk-v', 'steps', 1000, 'count', 'apple_health', '2026-03-20T10:00:00Z')`,
    );
    db.execute(
      `INSERT INTO hl_sleep_sessions (id, start_time, end_time, duration_minutes, source)
       VALUES ('hk-s', '2026-03-20T22:00:00Z', '2026-03-21T06:00:00Z', 480, 'apple_health')`,
    );
    updateSyncAnchor(db, 'steps', '2026-03-20T10:00:00Z', 1);

    const result = deleteAllSyncedData(db);
    expect(result.vitals).toBe(1);
    expect(result.sleep).toBe(1);
    expect(getSyncLog(db, 'steps')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Sync date computation
// ---------------------------------------------------------------------------

describe('computeSyncStartDate', () => {
  it('returns date INITIAL_SYNC_DAYS ago when no anchor', () => {
    const start = computeSyncStartDate(null);
    const expected = new Date();
    expected.setDate(expected.getDate() - INITIAL_SYNC_DAYS);
    expect(Math.abs(start.getTime() - expected.getTime())).toBeLessThan(1000);
  });

  it('returns anchor date when provided', () => {
    const anchor = '2026-03-15T10:00:00Z';
    const start = computeSyncStartDate(anchor);
    expect(start.toISOString()).toBe('2026-03-15T10:00:00.000Z');
  });
});
