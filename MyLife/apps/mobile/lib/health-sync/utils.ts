import type { DatabaseAdapter } from '@mylife/db';
import type { SyncLogEntry } from './types';

export function createId(prefix: string): string {
  const maybeCrypto = globalThis.crypto as { randomUUID?: () => string } | undefined;
  if (typeof maybeCrypto?.randomUUID === 'function') {
    return maybeCrypto.randomUUID();
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function normalizeError(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return 'Health sync failed due to an unknown error.';
}

export function callbackToPromise<T>(
  invoke: (callback: (error: unknown, result: T) => void) => void,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    invoke((error, result) => {
      if (error) {
        reject(new Error(String(error)));
        return;
      }
      resolve(result);
    });
  });
}

// --- Cursor management via hl_sync_log ---

const DEFAULT_LOOKBACK_DAYS = 120;

/**
 * Get the most recent sync cursor for a data type.
 * Falls back to a lookback window if no prior sync exists.
 */
export function getSyncCursor(db: DatabaseAdapter, dataType: string): string {
  const rows = db.query<SyncLogEntry>(
    `SELECT cursor FROM hl_sync_log
     WHERE data_type = ? AND cursor IS NOT NULL
     ORDER BY synced_at DESC LIMIT 1`,
    [dataType],
  );
  if (rows[0]?.cursor) return rows[0].cursor;
  const start = new Date(Date.now() - DEFAULT_LOOKBACK_DAYS * 24 * 3600 * 1000);
  return start.toISOString();
}

/**
 * Record a sync event in hl_sync_log.
 */
export function recordSyncEvent(
  db: DatabaseAdapter,
  dataType: string,
  direction: 'read' | 'write',
  recordsSynced: number,
  cursor: string | null,
  error: string | null = null,
): void {
  db.execute(
    `INSERT INTO hl_sync_log (id, data_type, direction, records_synced, cursor, error)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [createId('sync'), dataType, direction, recordsSynced, cursor, error],
  );
}

/**
 * Check if a data type's sync is enabled via hl_settings.
 */
export function isSyncEnabled(db: DatabaseAdapter, dataTypeKey: string): boolean {
  const rows = db.query<{ value: string }>(
    `SELECT value FROM hl_settings WHERE key = ?`,
    [`healthSync.${dataTypeKey}`],
  );
  return rows[0]?.value === 'true';
}

// --- Legacy ft_settings helpers (for weight import / fast export backward compat) ---

export function getLegacySetting(db: DatabaseAdapter, key: string): string | null {
  const rows = db.query<{ value: string }>(`SELECT value FROM ft_settings WHERE key = ?`, [key]);
  return rows[0]?.value ?? null;
}

export function setLegacySetting(db: DatabaseAdapter, key: string, value: string): void {
  db.execute(`INSERT OR REPLACE INTO ft_settings (key, value) VALUES (?, ?)`, [key, value]);
}

export function getWeightUnit(db: DatabaseAdapter): 'lbs' | 'kg' {
  const value = getLegacySetting(db, 'weightUnit');
  return value === 'kg' ? 'kg' : 'lbs';
}

/**
 * Insert a vital record into hl_vitals, deduplicating by type + timestamp
 * within a 1-minute tolerance window.
 */
export function insertVitalIfMissing(
  db: DatabaseAdapter,
  vitalType: string,
  value: number,
  unit: string,
  recordedAt: string,
  source: string = 'health_sync',
  valueSecondary: number | null = null,
): boolean {
  const parsed = new Date(recordedAt);
  if (Number.isNaN(parsed.getTime())) return false;
  const iso = parsed.toISOString();

  // Deduplicate: same type within 60 seconds and value within 0.5
  const windowStart = new Date(parsed.getTime() - 60000).toISOString();
  const windowEnd = new Date(parsed.getTime() + 60000).toISOString();

  const exists = db.query<{ count: number }>(
    `SELECT COUNT(*) as count FROM hl_vitals
     WHERE vital_type = ? AND recorded_at >= ? AND recorded_at <= ?
     AND ABS(value - ?) < 0.5`,
    [vitalType, windowStart, windowEnd, value],
  );

  if ((exists[0]?.count ?? 0) > 0) return false;

  db.execute(
    `INSERT INTO hl_vitals (id, vital_type, value, value_secondary, unit, source, recorded_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [createId('vital'), vitalType, value, valueSecondary, unit, source, iso],
  );
  return true;
}

/**
 * Insert a sleep session into hl_sleep_sessions, deduplicating by start_time.
 */
export function insertSleepIfMissing(
  db: DatabaseAdapter,
  startTime: string,
  endTime: string,
  deepMinutes: number | null,
  remMinutes: number | null,
  lightMinutes: number | null,
  awakeMinutes: number | null,
  source: string = 'health_sync',
): boolean {
  const parsedStart = new Date(startTime);
  const parsedEnd = new Date(endTime);
  if (Number.isNaN(parsedStart.getTime()) || Number.isNaN(parsedEnd.getTime())) return false;

  // Deduplicate: sessions within 30 minutes of the same start
  const windowStart = new Date(parsedStart.getTime() - 30 * 60000).toISOString();
  const windowEnd = new Date(parsedStart.getTime() + 30 * 60000).toISOString();

  const exists = db.query<{ count: number }>(
    `SELECT COUNT(*) as count FROM hl_sleep_sessions
     WHERE start_time >= ? AND start_time <= ?`,
    [windowStart, windowEnd],
  );
  if ((exists[0]?.count ?? 0) > 0) return false;

  const durationMinutes = Math.round((parsedEnd.getTime() - parsedStart.getTime()) / 60000);
  if (durationMinutes <= 0) return false;

  // Import computeQualityScore from the health module
  // For sync, we compute a basic score or null if no stage data
  const { computeQualityScore } = require('@mylife/health');
  const qualityScore = computeQualityScore(durationMinutes, deepMinutes, remMinutes, awakeMinutes);

  db.execute(
    `INSERT INTO hl_sleep_sessions (id, start_time, end_time, duration_minutes, deep_minutes, rem_minutes, light_minutes, awake_minutes, quality_score, source)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      createId('slp'),
      parsedStart.toISOString(),
      parsedEnd.toISOString(),
      durationMinutes,
      deepMinutes,
      remMinutes,
      lightMinutes,
      awakeMinutes,
      qualityScore,
      source,
    ],
  );
  return true;
}

/**
 * Insert a weight entry into ft_weight_entries, deduplicating.
 * Preserves the original fast-health-sync behavior exactly.
 */
export function insertWeightIfMissing(
  db: DatabaseAdapter,
  value: number,
  unit: 'lbs' | 'kg',
  recordedAt: string,
): boolean {
  const parsedDate = new Date(recordedAt);
  if (Number.isNaN(parsedDate.getTime())) return false;

  const date = parsedDate.toISOString().slice(0, 10);
  const rounded = Math.round(value * 1000) / 1000;

  const exists = db.query<{ count: number }>(
    `SELECT COUNT(*) as count
     FROM ft_weight_entries
     WHERE date = ? AND unit = ? AND ABS(weight_value - ?) < 0.001`,
    [date, unit, rounded],
  );

  if ((exists[0]?.count ?? 0) > 0) return false;

  db.execute(
    `INSERT INTO ft_weight_entries (id, weight_value, unit, date, notes, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [createId('weight'), rounded, unit, date, 'Imported from health platform', new Date().toISOString()],
  );
  return true;
}
