import type { DatabaseAdapter } from '@mylife/db';
import type { ImportLog } from '../types';

function createId(): string {
  const c = globalThis.crypto as { randomUUID?: () => string } | undefined;
  if (typeof c?.randomUUID === 'function') return c.randomUUID();
  return `hl_imp_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function logImport(
  db: DatabaseAdapter,
  data: Omit<ImportLog, 'id' | 'started_at' | 'completed_at'> & { completed_at?: string },
): ImportLog {
  const id = createId();
  db.execute(
    `INSERT INTO hl_import_log (id, source_name, file_name, records_imported, records_skipped, records_conflicted, status, error_message, completed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, data.source_name, data.file_name ?? null, data.records_imported, data.records_skipped,
     data.records_conflicted, data.status, data.error_message ?? null, data.completed_at ?? new Date().toISOString()],
  );
  return getImportLogById(db, id)!;
}

export function getImportLogById(db: DatabaseAdapter, id: string): ImportLog | null {
  const rows = db.query<ImportLog>('SELECT * FROM hl_import_log WHERE id = ?', [id]);
  return rows[0] ?? null;
}

export function getImportLogs(db: DatabaseAdapter, limit = 50): ImportLog[] {
  return db.query<ImportLog>(
    'SELECT * FROM hl_import_log ORDER BY started_at DESC LIMIT ?',
    [limit],
  );
}

export function getSourceSummary(db: DatabaseAdapter): { source_name: string; total_records: number; last_import: string }[] {
  return db.query<{ source_name: string; total_records: number; last_import: string }>(
    `SELECT source_name, SUM(records_imported) as total_records, MAX(started_at) as last_import
     FROM hl_import_log WHERE status != 'failed' GROUP BY source_name ORDER BY last_import DESC`,
  );
}

export function deleteImportLog(db: DatabaseAdapter, id: string): void {
  db.execute('DELETE FROM hl_import_log WHERE id = ?', [id]);
}
