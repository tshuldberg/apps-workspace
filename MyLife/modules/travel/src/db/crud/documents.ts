/**
 * Document CRUD for MyTravel logistics (passports, visas, insurance, etc.).
 *
 * Pure functions of (DatabaseAdapter, input). Rows mirror the SQLite columns.
 */

import type { DatabaseAdapter } from '@mylife/db';
import {
  DocumentInputSchema,
  DocumentUpdateSchema,
  type DocumentInput,
  type DocumentRow,
  type DocumentType,
  type DocumentUpdate,
} from '../../models/schemas';

// ── Update column whitelist ─────────────────────────────────────────

const UPDATE_COLUMNS = new Set([
  'type',
  'name',
  'number',
  'country',
  'issue_date',
  'expiry_date',
  'renewal_reminder_days',
  'notes_md',
  'photo_id',
]);

// ── Create ──────────────────────────────────────────────────────────

export function createDocument(
  db: DatabaseAdapter,
  input: DocumentInput,
): DocumentRow {
  const parsed = DocumentInputSchema.parse(input);
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const row: DocumentRow = {
    id,
    type: parsed.type,
    name: parsed.name,
    number: parsed.number ?? null,
    country: parsed.country ?? null,
    issue_date: parsed.issue_date ?? null,
    expiry_date: parsed.expiry_date ?? null,
    renewal_reminder_days: parsed.renewal_reminder_days ?? 90,
    notes_md: parsed.notes_md ?? null,
    photo_id: parsed.photo_id ?? null,
    created_at: now,
    updated_at: now,
  };

  db.execute(
    `INSERT INTO tv_documents (
       id, type, name, number, country, issue_date, expiry_date,
       renewal_reminder_days, notes_md, photo_id, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      row.id,
      row.type,
      row.name,
      row.number,
      row.country,
      row.issue_date,
      row.expiry_date,
      row.renewal_reminder_days,
      row.notes_md,
      row.photo_id,
      row.created_at,
      row.updated_at,
    ],
  );

  return row;
}

// ── Read ────────────────────────────────────────────────────────────

export function getDocument(
  db: DatabaseAdapter,
  id: string,
): DocumentRow | null {
  const rows = db.query<DocumentRow>(
    `SELECT * FROM tv_documents WHERE id = ?`,
    [id],
  );
  return rows[0] ?? null;
}

// ── Update ──────────────────────────────────────────────────────────

export function updateDocument(
  db: DatabaseAdapter,
  id: string,
  patch: DocumentUpdate,
): void {
  const parsed = DocumentUpdateSchema.parse(patch);
  const fields: string[] = [];
  const values: unknown[] = [];

  for (const [key, value] of Object.entries(parsed)) {
    if (value === undefined) continue;
    if (!UPDATE_COLUMNS.has(key)) continue;
    fields.push(`${key} = ?`);
    values.push(value);
  }

  if (fields.length === 0) return;

  fields.push('updated_at = ?');
  values.push(new Date().toISOString());
  values.push(id);

  db.execute(
    `UPDATE tv_documents SET ${fields.join(', ')} WHERE id = ?`,
    values,
  );
}

// ── Delete ──────────────────────────────────────────────────────────

export function deleteDocument(db: DatabaseAdapter, id: string): void {
  db.execute(`DELETE FROM tv_documents WHERE id = ?`, [id]);
}

// ── List ────────────────────────────────────────────────────────────

export interface ListDocumentsOptions {
  type?: DocumentType;
}

export function listDocuments(
  db: DatabaseAdapter,
  opts: ListDocumentsOptions = {},
): DocumentRow[] {
  const where: string[] = [];
  const params: unknown[] = [];

  if (opts.type) {
    where.push('type = ?');
    params.push(opts.type);
  }

  const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
  return db.query<DocumentRow>(
    `SELECT * FROM tv_documents ${whereClause} ORDER BY name ASC`,
    params,
  );
}

export function listDocumentsByType(
  db: DatabaseAdapter,
  type: DocumentType,
): DocumentRow[] {
  return listDocuments(db, { type });
}

// ── Expiring ────────────────────────────────────────────────────────

/**
 * Returns documents whose expiry_date falls within the next `withinDays`
 * days (inclusive of today through today + withinDays). Already-expired
 * documents are NOT included. Ordered by expiry_date ASC.
 */
export function getExpiring(
  db: DatabaseAdapter,
  withinDays: number,
): DocumentRow[] {
  const today = new Date();
  const todayIso = today.toISOString().slice(0, 10);
  const end = new Date(today);
  end.setUTCDate(end.getUTCDate() + withinDays);
  const endIso = end.toISOString().slice(0, 10);

  return db.query<DocumentRow>(
    `SELECT * FROM tv_documents
      WHERE expiry_date IS NOT NULL
        AND expiry_date >= ?
        AND expiry_date <= ?
      ORDER BY expiry_date ASC`,
    [todayIso, endIso],
  );
}

// ── Type helpers ────────────────────────────────────────────────────

export function getPassports(db: DatabaseAdapter): DocumentRow[] {
  return listDocumentsByType(db, 'passport');
}

export function getVisas(db: DatabaseAdapter): DocumentRow[] {
  return listDocumentsByType(db, 'visa');
}
