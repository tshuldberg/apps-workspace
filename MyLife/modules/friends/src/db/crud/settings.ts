/**
 * Settings CRUD for MyFriends module.
 *
 * Uses fn_settings table (key TEXT PRIMARY KEY, value TEXT).
 * Known keys:
 * - biometric_lock_enabled
 * - nudge_enabled
 * - drift_detection_enabled
 * - default_nudge_days
 * - effort_balance_visible
 */

import type { DatabaseAdapter } from '@mylife/db';

// ── Known keys (type-safe) ─────────────────────────────────────────

export type FriendsSettingKey =
  | 'biometric_lock_enabled'
  | 'nudge_enabled'
  | 'drift_detection_enabled'
  | 'default_nudge_days'
  | 'effort_balance_visible';

// ── CRUD ────────────────────────────────────────────────────────────

/**
 * Get a single setting value by key. Returns null if not set.
 */
export function getSetting(
  db: DatabaseAdapter,
  key: FriendsSettingKey,
): string | null {
  const rows = db.query<{ value: string }>(
    `SELECT value FROM fn_settings WHERE key = ?`,
    [key],
  );
  return rows.length > 0 ? rows[0].value : null;
}

/**
 * Set (upsert) a setting value.
 */
export function setSetting(
  db: DatabaseAdapter,
  key: FriendsSettingKey,
  value: string,
): void {
  db.execute(
    `INSERT INTO fn_settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [key, value],
  );
}

/**
 * Get all settings as a key-value record.
 */
export function getSettings(db: DatabaseAdapter): Record<string, string> {
  const rows = db.query<{ key: string; value: string }>(
    `SELECT key, value FROM fn_settings`,
  );
  const result: Record<string, string> = {};
  for (const row of rows) {
    result[row.key] = row.value;
  }
  return result;
}

/**
 * Delete a setting by key.
 */
export function deleteSetting(
  db: DatabaseAdapter,
  key: FriendsSettingKey,
): void {
  db.execute(`DELETE FROM fn_settings WHERE key = ?`, [key]);
}
