import type { DatabaseAdapter } from '@mylife/db';
import type { Reminder } from '../types';

function rowToReminder(row: Record<string, unknown>): Reminder {
  return {
    id: row.id as string,
    habitId: row.habit_id as string,
    time: row.time as string,
    label: (row.label as string) ?? null,
    isActive: !!(row.is_active as number),
    createdAt: row.created_at as string,
  };
}

export function createReminder(
  db: DatabaseAdapter,
  id: string,
  habitId: string,
  time: string,
  label?: string,
): void {
  db.execute(
    `INSERT INTO hb_reminders (id, habit_id, time, label, is_active, created_at) VALUES (?, ?, ?, ?, 1, datetime('now'))`,
    [id, habitId, time, label ?? null],
  );
}

export function getRemindersForHabit(db: DatabaseAdapter, habitId: string): Reminder[] {
  return db.query<Record<string, unknown>>(
    'SELECT * FROM hb_reminders WHERE habit_id = ? ORDER BY time ASC',
    [habitId],
  ).map(rowToReminder);
}

export function updateReminder(
  db: DatabaseAdapter,
  id: string,
  input: { time?: string; label?: string | null },
): void {
  const sets: string[] = [];
  const params: unknown[] = [];
  if (input.time !== undefined) { sets.push('time = ?'); params.push(input.time); }
  if (input.label !== undefined) { sets.push('label = ?'); params.push(input.label); }
  if (sets.length === 0) return;
  params.push(id);
  db.execute(`UPDATE hb_reminders SET ${sets.join(', ')} WHERE id = ?`, params);
}

export function deleteReminder(db: DatabaseAdapter, id: string): void {
  db.execute('DELETE FROM hb_reminders WHERE id = ?', [id]);
}

export function toggleReminder(db: DatabaseAdapter, id: string, isActive: boolean): void {
  db.execute('UPDATE hb_reminders SET is_active = ? WHERE id = ?', [isActive ? 1 : 0, id]);
}
