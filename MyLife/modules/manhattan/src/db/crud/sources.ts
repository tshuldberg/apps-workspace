import type { DatabaseAdapter } from '@mylife/db';
import { SourceInputSchema, type SourceInput, type SourceRow } from '../../types';

export function upsertSource(db: DatabaseAdapter, input: SourceInput): void {
  const data = SourceInputSchema.parse(input);
  db.execute(
    `INSERT INTO mh_sources (id, enabled, config_json)
     VALUES (?,?,?)
     ON CONFLICT(id) DO UPDATE SET
       enabled = excluded.enabled,
       config_json = excluded.config_json,
       updated_at = datetime('now')`,
    [data.id, data.enabled ? 1 : 0, data.configJson],
  );
}

export function ensureSource(db: DatabaseAdapter, id: string): void {
  db.execute(`INSERT OR IGNORE INTO mh_sources (id) VALUES (?)`, [id]);
}

export function getSources(db: DatabaseAdapter): SourceRow[] {
  return db.query<SourceRow>(`SELECT * FROM mh_sources ORDER BY id ASC`);
}

export function isSourceEnabled(db: DatabaseAdapter, id: string): boolean {
  const rows = db.query<{ enabled: number }>(`SELECT enabled FROM mh_sources WHERE id = ?`, [id]);
  return rows[0]?.enabled !== 0;
}

export function setSourceEnabled(db: DatabaseAdapter, id: string, enabled: boolean): void {
  ensureSource(db, id);
  db.execute(
    `UPDATE mh_sources SET enabled = ?, updated_at = datetime('now') WHERE id = ?`,
    [enabled ? 1 : 0, id],
  );
}

export function setSourceLastSynced(db: DatabaseAdapter, id: string, isoTimestamp: string): void {
  ensureSource(db, id);
  db.execute(
    `UPDATE mh_sources SET last_synced_at = ?, updated_at = datetime('now') WHERE id = ?`,
    [isoTimestamp, id],
  );
}
