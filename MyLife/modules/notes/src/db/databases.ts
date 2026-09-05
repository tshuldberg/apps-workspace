import type { DatabaseAdapter } from '@mylife/db';
import type { NoteDatabase, NoteDbColumn, NoteDbRow, NoteDbCell } from '../types';

function rowToDatabase(row: Record<string, unknown>): NoteDatabase {
  return {
    id: row.id as string,
    title: row.title as string,
    description: (row.description as string) ?? '',
    folderId: (row.folder_id as string) ?? null,
    defaultView: row.default_view as NoteDatabase['defaultView'],
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function rowToColumn(row: Record<string, unknown>): NoteDbColumn {
  return {
    id: row.id as string,
    databaseId: row.database_id as string,
    name: row.name as string,
    columnType: row.column_type as NoteDbColumn['columnType'],
    optionsJson: (row.options_json as string) ?? '{}',
    sortOrder: row.sort_order as number,
    isPrimary: (row.is_primary as number) === 1,
    createdAt: row.created_at as string,
  };
}

function rowToRow(row: Record<string, unknown>): NoteDbRow {
  return {
    id: row.id as string,
    databaseId: row.database_id as string,
    sortOrder: row.sort_order as number,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function rowToCell(row: Record<string, unknown>): NoteDbCell {
  return {
    id: row.id as string,
    rowId: row.row_id as string,
    columnId: row.column_id as string,
    valueText: (row.value_text as string) ?? null,
    valueNumber: (row.value_number as number) ?? null,
    valueJson: (row.value_json as string) ?? null,
  };
}

// ── Database CRUD ─────────────────────────────────────────────────────

export function createDatabase(
  db: DatabaseAdapter,
  id: string,
  input: { title?: string; description?: string; folderId?: string | null; defaultView?: string },
): NoteDatabase {
  const now = new Date().toISOString();
  db.execute(
    `INSERT INTO nt_databases (id, title, description, folder_id, default_view, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, input.title ?? 'Untitled Database', input.description ?? '', input.folderId ?? null, input.defaultView ?? 'table', now, now],
  );
  return { id, title: input.title ?? 'Untitled Database', description: input.description ?? '', folderId: input.folderId ?? null, defaultView: (input.defaultView ?? 'table') as NoteDatabase['defaultView'], createdAt: now, updatedAt: now };
}

export function getDatabases(db: DatabaseAdapter, limit = 200): NoteDatabase[] {
  return db.query<Record<string, unknown>>(`SELECT * FROM nt_databases ORDER BY updated_at DESC LIMIT ?`, [limit]).map(rowToDatabase);
}

export function getDatabaseById(db: DatabaseAdapter, id: string): NoteDatabase | null {
  const rows = db.query<Record<string, unknown>>(`SELECT * FROM nt_databases WHERE id = ?`, [id]);
  return rows.length > 0 ? rowToDatabase(rows[0]) : null;
}

export function deleteDatabase(db: DatabaseAdapter, id: string): boolean {
  db.execute(`DELETE FROM nt_databases WHERE id = ?`, [id]);
  return true;
}

// ── Column CRUD ───────────────────────────────────────────────────────

export function createDbColumn(
  db: DatabaseAdapter,
  id: string,
  input: { databaseId: string; name: string; columnType?: string; isPrimary?: boolean; sortOrder?: number },
): NoteDbColumn {
  const now = new Date().toISOString();
  db.execute(
    `INSERT INTO nt_db_columns (id, database_id, name, column_type, sort_order, is_primary, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, input.databaseId, input.name, input.columnType ?? 'text', input.sortOrder ?? 0, input.isPrimary ? 1 : 0, now],
  );
  return { id, databaseId: input.databaseId, name: input.name, columnType: (input.columnType ?? 'text') as NoteDbColumn['columnType'], optionsJson: '{}', sortOrder: input.sortOrder ?? 0, isPrimary: input.isPrimary ?? false, createdAt: now };
}

export function getColumnsForDatabase(db: DatabaseAdapter, databaseId: string, limit = 200): NoteDbColumn[] {
  return db.query<Record<string, unknown>>(`SELECT * FROM nt_db_columns WHERE database_id = ? ORDER BY sort_order ASC LIMIT ?`, [databaseId, limit]).map(rowToColumn);
}

export function deleteDbColumn(db: DatabaseAdapter, id: string): boolean {
  db.execute(`DELETE FROM nt_db_columns WHERE id = ?`, [id]);
  return true;
}

// ── Row CRUD ──────────────────────────────────────────────────────────

export function createDbRow(
  db: DatabaseAdapter,
  id: string,
  databaseId: string,
  sortOrder = 0,
): NoteDbRow {
  const now = new Date().toISOString();
  db.execute(
    `INSERT INTO nt_db_rows (id, database_id, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
    [id, databaseId, sortOrder, now, now],
  );
  return { id, databaseId, sortOrder, createdAt: now, updatedAt: now };
}

export function getRowsForDatabase(db: DatabaseAdapter, databaseId: string, limit = 1000): NoteDbRow[] {
  return db.query<Record<string, unknown>>(`SELECT * FROM nt_db_rows WHERE database_id = ? ORDER BY sort_order ASC LIMIT ?`, [databaseId, limit]).map(rowToRow);
}

export function deleteDbRow(db: DatabaseAdapter, id: string): boolean {
  db.execute(`DELETE FROM nt_db_rows WHERE id = ?`, [id]);
  return true;
}

// ── Cell CRUD ─────────────────────────────────────────────────────────

export function setCellValue(
  db: DatabaseAdapter,
  id: string,
  rowId: string,
  columnId: string,
  value: { text?: string | null; number?: number | null; json?: string | null },
): NoteDbCell {
  db.execute(
    `INSERT INTO nt_db_cells (id, row_id, column_id, value_text, value_number, value_json) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(row_id, column_id) DO UPDATE SET value_text = excluded.value_text, value_number = excluded.value_number, value_json = excluded.value_json`,
    [id, rowId, columnId, value.text ?? null, value.number ?? null, value.json ?? null],
  );
  return { id, rowId, columnId, valueText: value.text ?? null, valueNumber: value.number ?? null, valueJson: value.json ?? null };
}

export function getCellsForRow(db: DatabaseAdapter, rowId: string): NoteDbCell[] {
  return db.query<Record<string, unknown>>(`SELECT * FROM nt_db_cells WHERE row_id = ?`, [rowId]).map(rowToCell);
}

export function getCellValue(db: DatabaseAdapter, rowId: string, columnId: string): NoteDbCell | null {
  const rows = db.query<Record<string, unknown>>(`SELECT * FROM nt_db_cells WHERE row_id = ? AND column_id = ?`, [rowId, columnId]);
  return rows.length > 0 ? rowToCell(rows[0]) : null;
}
