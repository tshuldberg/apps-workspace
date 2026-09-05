import type { DatabaseAdapter } from '@mylife/db';

interface SettingRow {
  key: string;
  value: string;
}

/**
 * Get a health setting by key.
 * Reads from hl_settings (the consolidated health settings table).
 */
export function getHealthSetting(db: DatabaseAdapter, key: string): string | null {
  const rows = db.query<SettingRow>(
    'SELECT value FROM hl_settings WHERE key = ?',
    [key],
  );
  return rows[0]?.value ?? null;
}

/**
 * Set a health setting. Creates or updates the key-value pair.
 */
export function setHealthSetting(
  db: DatabaseAdapter,
  key: string,
  value: string,
): void {
  db.execute(
    `INSERT INTO hl_settings (key, value, updated_at)
     VALUES (?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    [key, value],
  );
}

/**
 * Get all health settings as a key-value record.
 */
export function getAllHealthSettings(db: DatabaseAdapter): Record<string, string> {
  const rows = db.query<SettingRow>('SELECT key, value FROM hl_settings');
  const result: Record<string, string> = {};
  for (const row of rows) {
    result[row.key] = row.value;
  }
  return result;
}

/**
 * Get health sync toggle state for a specific data type.
 */
export function isHealthSyncEnabled(db: DatabaseAdapter, dataType: string): boolean {
  const key = `healthSync.${dataType}`;
  const value = getHealthSetting(db, key);
  return value === 'true';
}

/**
 * Toggle health sync for a specific data type.
 */
export function setHealthSyncToggle(
  db: DatabaseAdapter,
  dataType: string,
  enabled: boolean,
): void {
  setHealthSetting(db, `healthSync.${dataType}`, enabled ? 'true' : 'false');
}
