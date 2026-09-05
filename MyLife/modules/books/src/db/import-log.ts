/**
 * Import log operations.
 */

import type { DatabaseAdapter } from '@mylife/db';
import type { ImportLog, ImportLogInsert } from '../models/schemas';

export function logImport(
  db: DatabaseAdapter,
  id: string,
  input: ImportLogInsert,
): ImportLog {
  const now = new Date().toISOString();
  const entry: ImportLog = {
    id,
    source: input.source,
    filename: input.filename,
    books_imported: input.books_imported ?? 0,
    books_skipped: input.books_skipped ?? 0,
    errors: input.errors ?? null,
    imported_at: now,
  };

  db.execute(
    `INSERT INTO bk_import_log (id, source, filename, books_imported, books_skipped, errors, imported_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [entry.id, entry.source, entry.filename, entry.books_imported,
     entry.books_skipped, entry.errors, entry.imported_at],
  );

  return entry;
}

export function getImportHistory(db: DatabaseAdapter): ImportLog[] {
  return db.query<ImportLog>(
    `SELECT * FROM bk_import_log ORDER BY imported_at DESC`,
  );
}
