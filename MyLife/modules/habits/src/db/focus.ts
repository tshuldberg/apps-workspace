import type { DatabaseAdapter } from '@mylife/db';
import type { FocusSession, FocusSessionStatus } from '../types';

// ── Row mapper ──────────────────────────────────────────────────────────

function rowToFocusSession(row: Record<string, unknown>): FocusSession {
  return {
    id: row.id as string,
    habitId: row.habit_id as string,
    workDuration: row.work_duration as number,
    breakDuration: row.break_duration as number,
    roundsTarget: row.rounds_target as number,
    roundsCompleted: row.rounds_completed as number,
    totalFocusSeconds: row.total_focus_seconds as number,
    totalBreakSeconds: row.total_break_seconds as number,
    status: row.status as FocusSessionStatus,
    startedAt: row.started_at as string,
    completedAt: (row.completed_at as string) ?? null,
    createdAt: row.created_at as string,
  };
}

// ── CRUD ────────────────────────────────────────────────────────────────

export interface CreateFocusSessionInput {
  habitId: string;
  workDuration: number;
  breakDuration: number;
  roundsTarget: number;
}

export function createFocusSession(
  db: DatabaseAdapter,
  id: string,
  input: CreateFocusSessionInput,
): void {
  const now = new Date().toISOString();
  db.execute(
    `INSERT INTO hb_focus_sessions (id, habit_id, work_duration, break_duration, rounds_target, started_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, input.habitId, input.workDuration, input.breakDuration, input.roundsTarget, now, now],
  );
}

export function completeFocusSession(
  db: DatabaseAdapter,
  id: string,
  roundsCompleted: number,
  totalFocusSeconds: number,
  totalBreakSeconds: number,
  status: 'completed' | 'abandoned',
): void {
  db.execute(
    `UPDATE hb_focus_sessions
     SET rounds_completed = ?, total_focus_seconds = ?, total_break_seconds = ?,
         status = ?, completed_at = datetime('now')
     WHERE id = ?`,
    [roundsCompleted, totalFocusSeconds, totalBreakSeconds, status, id],
  );
}

export function getFocusSessionsForHabit(
  db: DatabaseAdapter,
  habitId: string,
  opts?: { from?: string; to?: string; limit?: number },
): FocusSession[] {
  let sql = 'SELECT * FROM hb_focus_sessions WHERE habit_id = ?';
  const params: unknown[] = [habitId];
  if (opts?.from) { sql += ' AND started_at >= ?'; params.push(opts.from); }
  if (opts?.to) { sql += ' AND started_at <= ?'; params.push(opts.to); }
  sql += ' ORDER BY started_at DESC';
  if (opts?.limit) { sql += ' LIMIT ?'; params.push(opts.limit); }
  return db.query<Record<string, unknown>>(sql, params).map(rowToFocusSession);
}

export function getAllFocusSessions(
  db: DatabaseAdapter,
  opts?: { from?: string; limit?: number },
): FocusSession[] {
  let sql = 'SELECT * FROM hb_focus_sessions';
  const params: unknown[] = [];
  if (opts?.from) { sql += ' WHERE started_at >= ?'; params.push(opts.from); }
  sql += ' ORDER BY started_at DESC';
  if (opts?.limit) { sql += ' LIMIT ?'; params.push(opts.limit); }
  return db.query<Record<string, unknown>>(sql, params).map(rowToFocusSession);
}

export function deleteFocusSession(db: DatabaseAdapter, id: string): void {
  db.execute('DELETE FROM hb_focus_sessions WHERE id = ?', [id]);
}
