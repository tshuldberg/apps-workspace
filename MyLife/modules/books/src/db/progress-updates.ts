/**
 * Progress update CRUD operations.
 */

import type { DatabaseAdapter } from '@mylife/db';
import type { ProgressUpdate, ProgressUpdateInsert } from '../models/schemas';

export function createProgressUpdate(
  db: DatabaseAdapter,
  id: string,
  input: ProgressUpdateInsert,
): ProgressUpdate {
  const now = new Date().toISOString();
  const update: ProgressUpdate = {
    id,
    session_id: input.session_id,
    book_id: input.book_id,
    page_number: input.page_number ?? null,
    percent_complete: input.percent_complete ?? null,
    note: input.note ?? null,
    created_at: now,
  };

  db.execute(
    `INSERT INTO bk_progress_updates (id, session_id, book_id, page_number, percent_complete, note, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [update.id, update.session_id, update.book_id, update.page_number,
     update.percent_complete, update.note, update.created_at],
  );

  return update;
}

export function getProgressHistory(
  db: DatabaseAdapter,
  bookId: string,
  sessionId?: string,
): ProgressUpdate[] {
  if (sessionId) {
    return db.query<ProgressUpdate>(
      `SELECT * FROM bk_progress_updates WHERE book_id = ? AND session_id = ? ORDER BY created_at ASC`,
      [bookId, sessionId],
    );
  }
  return db.query<ProgressUpdate>(
    `SELECT * FROM bk_progress_updates WHERE book_id = ? ORDER BY created_at ASC`,
    [bookId],
  );
}

export function getLatestProgress(
  db: DatabaseAdapter,
  bookId: string,
): ProgressUpdate | null {
  const rows = db.query<ProgressUpdate>(
    `SELECT * FROM bk_progress_updates WHERE book_id = ? ORDER BY created_at DESC LIMIT 1`,
    [bookId],
  );
  return rows.length > 0 ? rows[0] : null;
}

export function deleteProgressUpdate(db: DatabaseAdapter, id: string): void {
  db.execute(`DELETE FROM bk_progress_updates WHERE id = ?`, [id]);
}
