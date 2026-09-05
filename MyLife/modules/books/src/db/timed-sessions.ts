/**
 * Timed session CRUD operations.
 */

import type { DatabaseAdapter } from '@mylife/db';
import type { TimedSession, TimedSessionInsert } from '../models/schemas';

export function startTimedSession(
  db: DatabaseAdapter,
  id: string,
  input: TimedSessionInsert,
): TimedSession {
  const now = new Date().toISOString();
  const session: TimedSession = {
    id,
    session_id: input.session_id,
    book_id: input.book_id,
    started_at: input.started_at,
    ended_at: input.ended_at ?? null,
    duration_ms: input.duration_ms ?? null,
    start_page: input.start_page ?? null,
    end_page: input.end_page ?? null,
    pages_read: input.pages_read ?? null,
    pages_per_hour: input.pages_per_hour ?? null,
    created_at: now,
  };

  db.execute(
    `INSERT INTO bk_timed_sessions (id, session_id, book_id, started_at, ended_at, duration_ms, start_page, end_page, pages_read, pages_per_hour, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [session.id, session.session_id, session.book_id, session.started_at,
     session.ended_at, session.duration_ms, session.start_page, session.end_page,
     session.pages_read, session.pages_per_hour, session.created_at],
  );

  return session;
}

export function stopTimedSession(
  db: DatabaseAdapter,
  id: string,
  endPage?: number,
): TimedSession {
  const rows = db.query<TimedSession>(
    `SELECT * FROM bk_timed_sessions WHERE id = ?`,
    [id],
  );
  if (rows.length === 0) {
    throw new Error(`Timed session not found: ${id}`);
  }

  const session = rows[0];
  const endedAt = new Date().toISOString();
  const startedMs = new Date(session.started_at).getTime();
  const endedMs = new Date(endedAt).getTime();
  const durationMs = endedMs - startedMs;

  let pagesRead: number | null = null;
  let pagesPerHour: number | null = null;

  if (endPage != null && session.start_page != null) {
    pagesRead = endPage - session.start_page;
    if (durationMs > 0 && pagesRead > 0) {
      pagesPerHour = (pagesRead / durationMs) * 3_600_000;
    }
  }

  db.execute(
    `UPDATE bk_timed_sessions SET ended_at = ?, duration_ms = ?, end_page = ?, pages_read = ?, pages_per_hour = ? WHERE id = ?`,
    [endedAt, durationMs, endPage ?? null, pagesRead, pagesPerHour, id],
  );

  return {
    ...session,
    ended_at: endedAt,
    duration_ms: durationMs,
    end_page: endPage ?? null,
    pages_read: pagesRead,
    pages_per_hour: pagesPerHour,
  };
}

export function getTimedSession(
  db: DatabaseAdapter,
  id: string,
): TimedSession | null {
  const rows = db.query<TimedSession>(
    `SELECT * FROM bk_timed_sessions WHERE id = ?`,
    [id],
  );
  return rows.length > 0 ? rows[0] : null;
}

export function getTimedSessionsForBook(
  db: DatabaseAdapter,
  bookId: string,
): TimedSession[] {
  return db.query<TimedSession>(
    `SELECT * FROM bk_timed_sessions WHERE book_id = ? ORDER BY started_at DESC`,
    [bookId],
  );
}

export function getTimedSessionsForSession(
  db: DatabaseAdapter,
  sessionId: string,
): TimedSession[] {
  return db.query<TimedSession>(
    `SELECT * FROM bk_timed_sessions WHERE session_id = ? ORDER BY started_at DESC`,
    [sessionId],
  );
}

export function deleteTimedSession(db: DatabaseAdapter, id: string): void {
  db.execute(`DELETE FROM bk_timed_sessions WHERE id = ?`, [id]);
}
