import type { DatabaseAdapter } from '@mylife/db';

// ---------------------------------------------------------------------------
// Settings (key-value store)
// ---------------------------------------------------------------------------

export function getSetting(db: DatabaseAdapter, key: string): string | undefined {
  const rows = db.query<{ value: string }>('SELECT value FROM nu_settings WHERE key = ?', [key]);
  return rows.length > 0 ? rows[0].value : undefined;
}

export function setSetting(db: DatabaseAdapter, key: string, value: string): void {
  db.execute(
    `INSERT INTO nu_settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    [key, value],
  );
}

export function deleteSetting(db: DatabaseAdapter, key: string): void {
  db.execute('DELETE FROM nu_settings WHERE key = ?', [key]);
}

export function getAllSettings(db: DatabaseAdapter): Record<string, string> {
  const rows = db.query<{ key: string; value: string }>('SELECT key, value FROM nu_settings');
  const result: Record<string, string> = {};
  for (const row of rows) {
    result[row.key] = row.value;
  }
  return result;
}
