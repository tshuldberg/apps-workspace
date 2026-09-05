import type { DatabaseAdapter } from '@mylife/db';

export function getSetting(
  db: DatabaseAdapter,
  key: string,
): string | null {
  const rows = db.query<{ value: string }>(
    'SELECT value FROM hm_settings WHERE key = ?',
    [key],
  );
  return rows.length > 0 ? rows[0].value : null;
}

export function setSetting(
  db: DatabaseAdapter,
  key: string,
  value: string,
): void {
  db.execute(
    `INSERT INTO hm_settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [key, value],
  );
}
