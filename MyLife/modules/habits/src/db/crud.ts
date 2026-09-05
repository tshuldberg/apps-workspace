import type { DatabaseAdapter } from '@mylife/db';
import type { Habit, Completion, StreakInfo, DayOfWeek } from '../types';

// ---------------------------------------------------------------------------
// Row mappers
// ---------------------------------------------------------------------------

function rowToHabit(row: Record<string, unknown>): Habit {
  const specificDaysRaw = row.specific_days as string | null;
  let specificDays: DayOfWeek[] | null = null;
  if (specificDaysRaw) {
    try { specificDays = JSON.parse(specificDaysRaw) as DayOfWeek[]; } catch { specificDays = null; }
  }
  return {
    id: row.id as string,
    name: row.name as string,
    description: (row.description as string) ?? null,
    icon: (row.icon as string) ?? null,
    color: (row.color as string) ?? null,
    frequency: row.frequency as Habit['frequency'],
    targetCount: row.target_count as number,
    unit: (row.unit as string) ?? null,
    habitType: (row.habit_type as Habit['habitType']) ?? 'standard',
    timeOfDay: (row.time_of_day as Habit['timeOfDay']) ?? 'anytime',
    specificDays,
    gracePeriod: (row.grace_period as number) ?? 0,
    reminderTime: (row.reminder_time as string) ?? null,
    areaId: (row.area_id as string) ?? null,
    startDate: (row.start_date as string) ?? null,
    endDate: (row.end_date as string) ?? null,
    isArchived: !!(row.is_archived as number),
    sortOrder: row.sort_order as number,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function rowToCompletion(row: Record<string, unknown>): Completion {
  return {
    id: row.id as string,
    habitId: row.habit_id as string,
    completedAt: row.completed_at as string,
    value: (row.value as number) ?? null,
    notes: (row.notes as string) ?? null,
    createdAt: row.created_at as string,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function escapeLike(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

// ---------------------------------------------------------------------------
// Habits
// ---------------------------------------------------------------------------

export interface CreateHabitInput {
  name: string;
  description?: string | null;
  frequency?: string;
  targetCount?: number;
  unit?: string;
  icon?: string;
  color?: string;
  habitType?: string;
  timeOfDay?: string;
  specificDays?: string[];
  gracePeriod?: number;
  reminderTime?: string;
  areaId?: string;
  startDate?: string;
  endDate?: string;
}

export function createHabit(
  db: DatabaseAdapter,
  id: string,
  input: CreateHabitInput,
): void {
  const now = new Date().toISOString();
  const specificDaysJson = input.specificDays ? JSON.stringify(input.specificDays) : null;
  db.execute(
    `INSERT INTO hb_habits (id, name, description, frequency, target_count, unit, icon, color, habit_type, time_of_day, specific_days, grace_period, reminder_time, area_id, start_date, end_date, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.name,
      input.description ?? null,
      input.frequency ?? 'daily',
      input.targetCount ?? 1,
      input.unit ?? null,
      input.icon ?? null,
      input.color ?? null,
      input.habitType ?? 'standard',
      input.timeOfDay ?? 'anytime',
      specificDaysJson,
      input.gracePeriod ?? 0,
      input.reminderTime ?? null,
      input.areaId ?? null,
      input.startDate ?? null,
      input.endDate ?? null,
      now,
      now,
    ],
  );
}

export function getHabits(db: DatabaseAdapter, opts?: { isArchived?: boolean; areaId?: string; activeOnDate?: string }): Habit[] {
  const conditions: string[] = [];
  const params: unknown[] = [];
  if (opts?.isArchived !== undefined) {
    conditions.push('is_archived = ?');
    params.push(opts.isArchived ? 1 : 0);
  }
  if (opts?.areaId !== undefined) {
    conditions.push('area_id = ?');
    params.push(opts.areaId);
  }
  if (opts?.activeOnDate !== undefined) {
    conditions.push('(start_date IS NULL OR start_date <= ?)');
    params.push(opts.activeOnDate);
    conditions.push('(end_date IS NULL OR end_date >= ?)');
    params.push(opts.activeOnDate);
  }
  const where = conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '';
  return db.query<Record<string, unknown>>(
    `SELECT * FROM hb_habits${where} ORDER BY sort_order ASC, name ASC`,
    params,
  ).map(rowToHabit);
}

export function getHabitById(db: DatabaseAdapter, id: string): Habit | null {
  const rows = db.query<Record<string, unknown>>('SELECT * FROM hb_habits WHERE id = ?', [id]);
  return rows.length > 0 ? rowToHabit(rows[0]) : null;
}

export interface UpdateHabitInput {
  name?: string;
  description?: string | null;
  frequency?: string;
  targetCount?: number;
  unit?: string | null;
  icon?: string;
  color?: string;
  habitType?: string;
  timeOfDay?: string;
  specificDays?: string[];
  gracePeriod?: number;
  reminderTime?: string;
  areaId?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  isArchived?: boolean;
  sortOrder?: number;
}

export function updateHabit(db: DatabaseAdapter, id: string, updates: UpdateHabitInput): void {
  const sets: string[] = [];
  const params: unknown[] = [];
  if (updates.name !== undefined) { sets.push('name = ?'); params.push(updates.name); }
  if (updates.description !== undefined) { sets.push('description = ?'); params.push(updates.description); }
  if (updates.frequency !== undefined) { sets.push('frequency = ?'); params.push(updates.frequency); }
  if (updates.targetCount !== undefined) { sets.push('target_count = ?'); params.push(updates.targetCount); }
  if (updates.unit !== undefined) { sets.push('unit = ?'); params.push(updates.unit); }
  if (updates.icon !== undefined) { sets.push('icon = ?'); params.push(updates.icon); }
  if (updates.color !== undefined) { sets.push('color = ?'); params.push(updates.color); }
  if (updates.habitType !== undefined) { sets.push('habit_type = ?'); params.push(updates.habitType); }
  if (updates.timeOfDay !== undefined) { sets.push('time_of_day = ?'); params.push(updates.timeOfDay); }
  if (updates.specificDays !== undefined) { sets.push('specific_days = ?'); params.push(JSON.stringify(updates.specificDays)); }
  if (updates.gracePeriod !== undefined) { sets.push('grace_period = ?'); params.push(updates.gracePeriod); }
  if (updates.reminderTime !== undefined) { sets.push('reminder_time = ?'); params.push(updates.reminderTime); }
  if (updates.areaId !== undefined) { sets.push('area_id = ?'); params.push(updates.areaId); }
  if (updates.startDate !== undefined) { sets.push('start_date = ?'); params.push(updates.startDate); }
  if (updates.endDate !== undefined) { sets.push('end_date = ?'); params.push(updates.endDate); }
  if (updates.isArchived !== undefined) { sets.push('is_archived = ?'); params.push(updates.isArchived ? 1 : 0); }
  if (updates.sortOrder !== undefined) { sets.push('sort_order = ?'); params.push(updates.sortOrder); }
  if (sets.length === 0) return;
  sets.push('updated_at = ?');
  params.push(new Date().toISOString());
  params.push(id);
  db.execute(`UPDATE hb_habits SET ${sets.join(', ')} WHERE id = ?`, params);
}

export function deleteHabit(db: DatabaseAdapter, id: string): void {
  db.execute('DELETE FROM hb_habits WHERE id = ?', [id]);
}

export function countHabits(db: DatabaseAdapter): number {
  return (db.query<{ c: number }>('SELECT COUNT(*) as c FROM hb_habits')[0]).c;
}

// ---------------------------------------------------------------------------
// Completions
// ---------------------------------------------------------------------------

export function recordCompletion(
  db: DatabaseAdapter,
  id: string,
  habitId: string,
  completedAt: string,
  value?: number,
  notes?: string,
): void {
  const now = new Date().toISOString();
  db.execute(
    `INSERT INTO hb_completions (id, habit_id, completed_at, value, notes, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
    [id, habitId, completedAt, value ?? null, notes ?? null, now],
  );
}

export function getCompletions(db: DatabaseAdapter, habitId: string, opts?: { from?: string; to?: string; limit?: number }): Completion[] {
  let sql = 'SELECT * FROM hb_completions WHERE habit_id = ?';
  const params: unknown[] = [habitId];
  if (opts?.from) { sql += ' AND completed_at >= ?'; params.push(opts.from); }
  if (opts?.to) { sql += ' AND completed_at <= ?'; params.push(opts.to); }
  sql += ' ORDER BY completed_at DESC';
  sql += ' LIMIT ?';
  params.push(opts?.limit ?? 10000);
  return db.query<Record<string, unknown>>(sql, params).map(rowToCompletion);
}

export function getCompletionsForDate(db: DatabaseAdapter, date: string): Completion[] {
  return db.query<Record<string, unknown>>(
    `SELECT * FROM hb_completions WHERE completed_at LIKE ? ESCAPE '\\' ORDER BY completed_at ASC`,
    [`${escapeLike(date)}%`],
  ).map(rowToCompletion);
}

export function deleteCompletion(db: DatabaseAdapter, id: string): void {
  db.execute('DELETE FROM hb_completions WHERE id = ?', [id]);
}

// ---------------------------------------------------------------------------
// Streaks (basic -- enhanced version in streaks.ts)
// ---------------------------------------------------------------------------

export function getStreaks(db: DatabaseAdapter, habitId: string): StreakInfo {
  const rows = db.query<{ d: string }>(
    `SELECT DISTINCT DATE(completed_at) as d FROM hb_completions WHERE habit_id = ? ORDER BY d DESC`,
    [habitId],
  );
  if (rows.length === 0) return { currentStreak: 0, longestStreak: 0 };

  const dates = rows.map((r) => r.d);
  let currentStreak = 1;
  let longestStreak = 1;
  let streak = 1;

  const today = new Date().toISOString().slice(0, 10);
  const isCurrentDay = dates[0] === today;
  if (!isCurrentDay) currentStreak = 0;

  for (let i = 1; i < dates.length; i++) {
    const prev = new Date(dates[i - 1]);
    const curr = new Date(dates[i]);
    const diffDays = Math.round((prev.getTime() - curr.getTime()) / 86400000);
    if (diffDays === 1) {
      streak++;
      if (isCurrentDay && i < streak) currentStreak = streak;
    } else {
      streak = 1;
    }
    if (streak > longestStreak) longestStreak = streak;
  }
  if (currentStreak > longestStreak) longestStreak = currentStreak;

  return { currentStreak, longestStreak };
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export function getSetting(db: DatabaseAdapter, key: string): string | undefined {
  const rows = db.query<{ value: string }>('SELECT value FROM hb_settings WHERE key = ?', [key]);
  return rows.length > 0 ? rows[0].value : undefined;
}

export function setSetting(db: DatabaseAdapter, key: string, value: string): void {
  db.execute(
    `INSERT INTO hb_settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    [key, value],
  );
}
