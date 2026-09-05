/**
 * Incremental sync engine for HealthKit data.
 *
 * Uses anchor-based cursors stored in hl_sync_log to only import new data
 * on each sync. Writes to hl_vitals and hl_sleep_sessions with source='apple_health'.
 */

import type { DatabaseAdapter } from '@mylife/db';
import type { VitalType } from '../vitals/types';
import type { SyncLogEntry, HealthKitSample } from './types';
import {
  HK_TYPE_MAP,
  VITAL_TO_HK_MAP,
  VITAL_UNIT_MAP,
  SYNC_BATCH_SIZE,
  INITIAL_SYNC_DAYS,
} from './types';

// ---------------------------------------------------------------------------
// Sync log CRUD
// ---------------------------------------------------------------------------

export function getSyncLog(
  db: DatabaseAdapter,
  dataType: string,
): SyncLogEntry | null {
  const rows = db.query<SyncLogEntry>(
    'SELECT * FROM hl_sync_log WHERE data_type = ?',
    [dataType],
  );
  return rows[0] ?? null;
}

export function getAllSyncLogs(db: DatabaseAdapter): SyncLogEntry[] {
  return db.query<SyncLogEntry>(
    'SELECT * FROM hl_sync_log ORDER BY data_type ASC',
  );
}

export function updateSyncAnchor(
  db: DatabaseAdapter,
  dataType: string,
  anchor: string | null,
  recordsSynced: number,
  errorMessage: string | null = null,
): void {
  const now = new Date().toISOString();
  db.execute(
    `INSERT INTO hl_sync_log (data_type, last_sync_at, last_anchor, records_synced, error_message, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(data_type) DO UPDATE SET
       last_sync_at = excluded.last_sync_at,
       last_anchor = excluded.last_anchor,
       records_synced = hl_sync_log.records_synced + excluded.records_synced,
       error_message = excluded.error_message,
       updated_at = excluded.updated_at`,
    [dataType, now, anchor, recordsSynced, errorMessage, now],
  );
}

export function getLastSyncAnchor(
  db: DatabaseAdapter,
  dataType: string,
): string | null {
  const log = getSyncLog(db, dataType);
  return log?.last_anchor ?? null;
}

// ---------------------------------------------------------------------------
// Bulk insert with dedup
// ---------------------------------------------------------------------------

/**
 * Bulk insert vitals from HealthKit samples with duplicate detection.
 * Dedup key: recorded_at + vital_type + source.
 * Returns number of records actually inserted.
 */
export function bulkInsertVitals(
  db: DatabaseAdapter,
  samples: HealthKitSample[],
): number {
  let inserted = 0;

  for (let i = 0; i < samples.length; i += SYNC_BATCH_SIZE) {
    const batch = samples.slice(i, i + SYNC_BATCH_SIZE);

    db.execute('BEGIN TRANSACTION');
    try {
      for (const sample of batch) {
        const vitalType = mapHKTypeToVitalType(sample.type);
        if (!vitalType) continue;

        // Dedup check
        const existing = db.query<{ id: string }>(
          `SELECT id FROM hl_vitals
           WHERE vital_type = ? AND recorded_at = ? AND source = 'apple_health'
           LIMIT 1`,
          [vitalType, sample.startDate],
        );

        if (existing.length > 0) continue;

        const id = `hk_${vitalType}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        db.execute(
          `INSERT INTO hl_vitals (id, vital_type, value, value_secondary, unit, source, recorded_at)
           VALUES (?, ?, ?, ?, ?, 'apple_health', ?)`,
          [
            id,
            vitalType,
            sample.value,
            sample.valueSecondary ?? null,
            sample.unit || VITAL_UNIT_MAP[vitalType],
            sample.startDate,
          ],
        );
        inserted++;
      }
      db.execute('COMMIT');
    } catch (e) {
      db.execute('ROLLBACK');
      throw e;
    }
  }

  return inserted;
}

/**
 * Bulk insert sleep sessions from HealthKit with duplicate detection.
 * Dedup key: start_time + source.
 */
export function bulkInsertSleep(
  db: DatabaseAdapter,
  sessions: Array<{
    startTime: string;
    endTime: string;
    durationMinutes: number;
    deepMinutes?: number;
    remMinutes?: number;
    lightMinutes?: number;
    awakeMinutes?: number;
  }>,
): number {
  let inserted = 0;

  db.execute('BEGIN TRANSACTION');
  try {
    for (const session of sessions) {
      // Dedup check
      const existing = db.query<{ id: string }>(
        `SELECT id FROM hl_sleep_sessions
         WHERE start_time = ? AND source = 'apple_health'
         LIMIT 1`,
        [session.startTime],
      );

      if (existing.length > 0) continue;

      const id = `hk_slp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      db.execute(
        `INSERT INTO hl_sleep_sessions (id, start_time, end_time, duration_minutes, deep_minutes, rem_minutes, light_minutes, awake_minutes, quality_score, source, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, 'apple_health', NULL)`,
        [
          id,
          session.startTime,
          session.endTime,
          session.durationMinutes,
          session.deepMinutes ?? null,
          session.remMinutes ?? null,
          session.lightMinutes ?? null,
          session.awakeMinutes ?? null,
        ],
      );
      inserted++;
    }
    db.execute('COMMIT');
  } catch (e) {
    db.execute('ROLLBACK');
    throw e;
  }

  return inserted;
}

// ---------------------------------------------------------------------------
// Delete synced data
// ---------------------------------------------------------------------------

/**
 * Delete all HealthKit-sourced vitals data.
 */
export function deleteSyncedVitals(db: DatabaseAdapter): number {
  const before = db.query<{ c: number }>(
    `SELECT COUNT(*) as c FROM hl_vitals WHERE source = 'apple_health'`,
  );
  db.execute(`DELETE FROM hl_vitals WHERE source = 'apple_health'`);
  return before[0]?.c ?? 0;
}

/**
 * Delete all HealthKit-sourced sleep data.
 */
export function deleteSyncedSleep(db: DatabaseAdapter): number {
  const before = db.query<{ c: number }>(
    `SELECT COUNT(*) as c FROM hl_sleep_sessions WHERE source = 'apple_health'`,
  );
  db.execute(`DELETE FROM hl_sleep_sessions WHERE source = 'apple_health'`);
  return before[0]?.c ?? 0;
}

/**
 * Delete all synced data (vitals + sleep) and clear sync log.
 */
export function deleteAllSyncedData(db: DatabaseAdapter): { vitals: number; sleep: number } {
  const vitals = deleteSyncedVitals(db);
  const sleep = deleteSyncedSleep(db);
  db.execute('DELETE FROM hl_sync_log');
  return { vitals, sleep };
}

// ---------------------------------------------------------------------------
// Type mapping
// ---------------------------------------------------------------------------

/**
 * Map an HK quantity type identifier to a VitalType.
 * Returns null if the type is not supported.
 */
export function mapHKTypeToVitalType(hkType: string): VitalType | null {
  return HK_TYPE_MAP[hkType] ?? null;
}

/**
 * Map a VitalType to an HK quantity type identifier.
 */
export function mapVitalTypeToHK(vitalType: VitalType): string | null {
  return VITAL_TO_HK_MAP[vitalType] ?? null;
}

// ---------------------------------------------------------------------------
// Sync date computation
// ---------------------------------------------------------------------------

/**
 * Compute the start date for a sync operation.
 * Uses the last sync anchor if available, otherwise goes back INITIAL_SYNC_DAYS.
 */
export function computeSyncStartDate(lastAnchor: string | null): Date {
  if (lastAnchor) {
    return new Date(lastAnchor);
  }
  const d = new Date();
  d.setDate(d.getDate() - INITIAL_SYNC_DAYS);
  return d;
}
