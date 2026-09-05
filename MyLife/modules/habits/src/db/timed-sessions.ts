import type { DatabaseAdapter } from '@mylife/db';
import type { TimedSession } from '../types';

// ---------------------------------------------------------------------------
// Row mapper
// ---------------------------------------------------------------------------

function rowToTimedSession(row: Record<string, unknown>): TimedSession {
  return {
    id: row.id as string,
    habitId: row.habit_id as string,
    startedAt: row.started_at as string,
    durationSeconds: row.duration_seconds as number,
    targetSeconds: row.target_seconds as number,
    completed: !!(row.completed as number),
    createdAt: row.created_at as string,
  };
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export function startSession(
  db: DatabaseAdapter,
  id: string,
  habitId: string,
  targetSeconds: number,
): void {
  const now = new Date().toISOString();
  db.execute(
    `INSERT INTO hb_timed_sessions (id, habit_id, started_at, duration_seconds, target_seconds, completed, created_at)
     VALUES (?, ?, ?, 0, ?, 0, ?)`,
    [id, habitId, now, targetSeconds, now],
  );
}

export function endSession(
  db: DatabaseAdapter,
  id: string,
  durationSeconds: number,
): void {
  const completed = durationSeconds > 0 ? 1 : 0;
  db.execute(
    'UPDATE hb_timed_sessions SET duration_seconds = ?, completed = ? WHERE id = ?',
    [durationSeconds, completed, id],
  );
}

export function getSessionsForHabit(
  db: DatabaseAdapter,
  habitId: string,
  opts?: { from?: string; to?: string },
): TimedSession[] {
  let sql = 'SELECT * FROM hb_timed_sessions WHERE habit_id = ?';
  const params: unknown[] = [habitId];
  if (opts?.from) { sql += ' AND started_at >= ?'; params.push(opts.from); }
  if (opts?.to) { sql += ' AND started_at <= ?'; params.push(opts.to); }
  sql += ' ORDER BY started_at DESC';
  return db.query<Record<string, unknown>>(sql, params).map(rowToTimedSession);
}

export function getSessionsForDate(
  db: DatabaseAdapter,
  date: string,
): TimedSession[] {
  return db.query<Record<string, unknown>>(
    "SELECT * FROM hb_timed_sessions WHERE started_at LIKE ? ESCAPE '\\' ORDER BY started_at ASC",
    [`${escapeLike(date)}%`],
  ).map(rowToTimedSession);
}

function escapeLike(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

export function deleteSession(db: DatabaseAdapter, id: string): void {
  db.execute('DELETE FROM hb_timed_sessions WHERE id = ?', [id]);
}
