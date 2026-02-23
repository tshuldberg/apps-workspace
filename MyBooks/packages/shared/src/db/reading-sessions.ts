/**
 * Reading session CRUD operations.
 */

import type { DatabaseAdapter } from './migrations';
import type { ReadingSession, ReadingSessionInsert } from '../models/schemas';

export function createSession(
  db: DatabaseAdapter,
  id: string,
  input: ReadingSessionInsert,
): ReadingSession {
  const now = new Date().toISOString();
  const session: ReadingSession = {
    id,
    book_id: input.book_id,
    started_at: input.started_at ?? null,
    finished_at: input.finished_at ?? null,
    current_page: input.current_page ?? 0,
    status: input.status ?? 'want_to_read',
    dnf_reason: input.dnf_reason ?? null,
    created_at: now,
    updated_at: now,
  };

  db.execute(
    `INSERT INTO reading_sessions (id, book_id, started_at, finished_at, current_page, status, dnf_reason, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [session.id, session.book_id, session.started_at, session.finished_at,
     session.current_page, session.status, session.dnf_reason,
     session.created_at, session.updated_at],
  );

  return session;
}

export function getSession(db: DatabaseAdapter, id: string): ReadingSession | null {
  const rows = db.query<ReadingSession>(
    `SELECT * FROM reading_sessions WHERE id = ?`,
    [id],
  );
  return rows.length > 0 ? rows[0] : null;
}

export function getSessions(
  db: DatabaseAdapter,
  filters?: { status?: string; limit?: number },
): ReadingSession[] {
  let sql = 'SELECT * FROM reading_sessions';
  const params: unknown[] = [];

  if (filters?.status) {
    sql += ' WHERE status = ?';
    params.push(filters.status);
  }

  sql += ' ORDER BY updated_at DESC';

  if (filters?.limit) {
    sql += ' LIMIT ?';
    params.push(filters.limit);
  }

  return db.query<ReadingSession>(sql, params);
}

export function getSessionsForBook(db: DatabaseAdapter, bookId: string): ReadingSession[] {
  return db.query<ReadingSession>(
    `SELECT * FROM reading_sessions WHERE book_id = ? ORDER BY created_at DESC`,
    [bookId],
  );
}

export function updateSession(
  db: DatabaseAdapter,
  id: string,
  updates: Partial<Pick<ReadingSession, 'started_at' | 'finished_at' | 'current_page' | 'status' | 'dnf_reason'>>,
): void {
  const fields: string[] = [];
  const values: unknown[] = [];

  if (updates.started_at !== undefined) {
    fields.push('started_at = ?');
    values.push(updates.started_at);
  }
  if (updates.finished_at !== undefined) {
    fields.push('finished_at = ?');
    values.push(updates.finished_at);
  }
  if (updates.current_page !== undefined) {
    fields.push('current_page = ?');
    values.push(updates.current_page);
  }
  if (updates.status !== undefined) {
    fields.push('status = ?');
    values.push(updates.status);
  }
  if (updates.dnf_reason !== undefined) {
    fields.push('dnf_reason = ?');
    values.push(updates.dnf_reason);
  }

  if (fields.length === 0) return;

  fields.push('updated_at = ?');
  values.push(new Date().toISOString());
  values.push(id);

  db.execute(
    `UPDATE reading_sessions SET ${fields.join(', ')} WHERE id = ?`,
    values,
  );
}

/**
 * Start reading a book: set status to 'reading' and record started_at.
 */
export function startReading(db: DatabaseAdapter, sessionId: string): void {
  updateSession(db, sessionId, {
    status: 'reading',
    started_at: new Date().toISOString(),
  });
}

/**
 * Finish reading a book: set status to 'finished' and record finished_at.
 */
export function finishReading(db: DatabaseAdapter, sessionId: string): void {
  updateSession(db, sessionId, {
    status: 'finished',
    finished_at: new Date().toISOString(),
  });
}

/**
 * Mark a book as Did Not Finish.
 */
export function markDNF(db: DatabaseAdapter, sessionId: string, reason?: string): void {
  updateSession(db, sessionId, {
    status: 'dnf',
    dnf_reason: reason ?? null,
  });
}

/**
 * Get currently-reading sessions with book info.
 */
export function getCurrentlyReading(db: DatabaseAdapter): ReadingSession[] {
  return db.query<ReadingSession>(
    `SELECT * FROM reading_sessions WHERE status = 'reading' ORDER BY started_at DESC`,
  );
}
