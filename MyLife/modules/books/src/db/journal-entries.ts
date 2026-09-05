/**
 * Journal entry CRUD operations (hub variant with bk_ prefix).
 */

import type { DatabaseAdapter } from '@mylife/db';
import type { JournalEntry, JournalEntryInsert } from '../models/schemas';

export interface JournalFilters {
  dateFrom?: string;
  dateTo?: string;
  mood?: string;
  isFavorite?: boolean;
  limit?: number;
  offset?: number;
}

export function createJournalEntry(
  db: DatabaseAdapter,
  id: string,
  input: JournalEntryInsert,
): JournalEntry {
  const now = new Date().toISOString();
  const entry: JournalEntry = {
    id,
    title: input.title ?? null,
    content: input.content,
    content_encrypted: input.content_encrypted ?? 0,
    encryption_salt: input.encryption_salt ?? null,
    encryption_iv: input.encryption_iv ?? null,
    word_count: input.word_count ?? 0,
    mood: input.mood ?? null,
    is_favorite: input.is_favorite ?? 0,
    created_at: now,
    updated_at: now,
  };

  db.execute(
    `INSERT INTO bk_journal_entries (id, title, content, content_encrypted,
      encryption_salt, encryption_iv, word_count, mood, is_favorite,
      created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      entry.id, entry.title, entry.content, entry.content_encrypted,
      entry.encryption_salt, entry.encryption_iv, entry.word_count,
      entry.mood, entry.is_favorite, entry.created_at, entry.updated_at,
    ],
  );

  return entry;
}

export function getJournalEntry(
  db: DatabaseAdapter,
  id: string,
): JournalEntry | null {
  const rows = db.query<JournalEntry>(
    `SELECT * FROM bk_journal_entries WHERE id = ?`,
    [id],
  );
  return rows.length > 0 ? rows[0] : null;
}

export function getJournalEntries(
  db: DatabaseAdapter,
  filters?: JournalFilters,
): JournalEntry[] {
  let sql = 'SELECT * FROM bk_journal_entries';
  const where: string[] = [];
  const params: unknown[] = [];

  if (filters?.dateFrom) {
    where.push('created_at >= ?');
    params.push(filters.dateFrom);
  }

  if (filters?.dateTo) {
    where.push('created_at <= ?');
    params.push(filters.dateTo);
  }

  if (filters?.mood) {
    where.push('mood = ?');
    params.push(filters.mood);
  }

  if (filters?.isFavorite !== undefined) {
    where.push('is_favorite = ?');
    params.push(filters.isFavorite ? 1 : 0);
  }

  if (where.length > 0) {
    sql += ' WHERE ' + where.join(' AND ');
  }

  sql += ' ORDER BY created_at DESC';

  const limit = filters?.limit ?? 200;
  sql += ' LIMIT ?';
  params.push(limit);
  if (filters?.offset) {
    sql += ' OFFSET ?';
    params.push(filters.offset);
  }

  return db.query<JournalEntry>(sql, params);
}

const JOURNAL_UPDATE_COLUMNS = new Set([
  'title', 'content', 'content_encrypted', 'encryption_salt',
  'encryption_iv', 'word_count', 'mood', 'is_favorite',
]);

export function updateJournalEntry(
  db: DatabaseAdapter,
  id: string,
  updates: Partial<JournalEntryInsert>,
): void {
  const fields: string[] = [];
  const values: unknown[] = [];

  for (const [key, value] of Object.entries(updates)) {
    if (!JOURNAL_UPDATE_COLUMNS.has(key)) continue;
    fields.push(`${key} = ?`);
    values.push(value);
  }

  if (fields.length === 0) return;

  fields.push('updated_at = ?');
  values.push(new Date().toISOString());
  values.push(id);

  db.execute(
    `UPDATE bk_journal_entries SET ${fields.join(', ')} WHERE id = ?`,
    values,
  );
}

export function deleteJournalEntry(
  db: DatabaseAdapter,
  id: string,
): void {
  db.execute(`DELETE FROM bk_journal_entries WHERE id = ?`, [id]);
}

function sanitizeFtsQuery(raw: string): string {
  const cleaned = raw.replace(/['"*(){}[\]:^~!@#$%&\\]/g, ' ').trim();
  if (cleaned.length === 0) return '""';
  return cleaned
    .split(/\s+/)
    .filter((t) => t.length > 0)
    .map((t) => `"${t}"`)
    .join(' ');
}

export function searchJournalEntries(
  db: DatabaseAdapter,
  query: string,
  limit = 50,
): JournalEntry[] {
  const ftsQuery = sanitizeFtsQuery(query);
  return db.query<JournalEntry>(
    `SELECT e.* FROM bk_journal_entries e
     INNER JOIN bk_journal_fts fts ON e.rowid = fts.rowid
     WHERE bk_journal_fts MATCH ?
       AND e.content_encrypted = 0
     ORDER BY rank
     LIMIT ?`,
    [ftsQuery, limit],
  );
}

export function getJournalEntryCount(db: DatabaseAdapter): number {
  const rows = db.query<{ count: number }>(
    `SELECT COUNT(*) as count FROM bk_journal_entries`,
  );
  return rows[0]?.count ?? 0;
}
