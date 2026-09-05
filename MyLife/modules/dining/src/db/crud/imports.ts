/**
 * Import CRUD operations.
 */

import type { DatabaseAdapter } from '@mylife/db';
import { CreateImportSchema } from '../../models/schemas';
import type { ImportRecord, CreateImportInput } from '../../models/schemas';

const IMPORT_COLUMNS = [
  'id',
  'source',
  'raw_text',
  'parsed_data',
  'status',
  'reservation_id',
  'created_at',
].join(', ');

export function createImport(
  db: DatabaseAdapter,
  id: string,
  input: CreateImportInput,
): ImportRecord {
  const parsed = CreateImportSchema.parse(input);
  const now = new Date().toISOString();

  const record: ImportRecord = {
    id,
    source: parsed.source,
    raw_text: parsed.raw_text,
    parsed_data: parsed.parsed_data ?? null,
    status: 'pending',
    reservation_id: null,
    created_at: now,
  };

  db.execute(
    `INSERT INTO dn_imports (${IMPORT_COLUMNS})
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      record.id,
      record.source,
      record.raw_text,
      record.parsed_data,
      record.status,
      record.reservation_id,
      record.created_at,
    ],
  );

  return record;
}

export function getImport(
  db: DatabaseAdapter,
  id: string,
): ImportRecord | null {
  const rows = db.query<ImportRecord>(
    `SELECT ${IMPORT_COLUMNS} FROM dn_imports WHERE id = ?`,
    [id],
  );
  if (rows.length === 0) return null;
  return rows[0];
}

export function confirmImport(
  db: DatabaseAdapter,
  id: string,
  reservationId: string,
): void {
  db.execute(
    `UPDATE dn_imports SET status = 'confirmed', reservation_id = ? WHERE id = ?`,
    [reservationId, id],
  );
}

export function rejectImport(db: DatabaseAdapter, id: string): void {
  db.execute(
    `UPDATE dn_imports SET status = 'rejected' WHERE id = ?`,
    [id],
  );
}

export function listPendingImports(db: DatabaseAdapter): ImportRecord[] {
  return db.query<ImportRecord>(
    `SELECT ${IMPORT_COLUMNS} FROM dn_imports
     WHERE status = 'pending'
     ORDER BY created_at DESC`,
    [],
  );
}
