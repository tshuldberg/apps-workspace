import type { DatabaseAdapter } from '@mylife/db';

interface StreakFreezeRow {
  id: string;
  habit_id: string;
  freeze_date: string;
  reason: string | null;
  created_at: string;
}

function rowToFreeze(row: StreakFreezeRow) {
  return {
    id: row.id,
    habitId: row.habit_id,
    freezeDate: row.freeze_date,
    reason: row.reason,
    createdAt: row.created_at,
  };
}

export function createStreakFreeze(
  db: DatabaseAdapter,
  habitId: string,
  freezeDate: string,
  reason?: string,
) {
  const id = crypto.randomUUID();
  db.execute(
    `INSERT INTO hb_streak_freezes (id, habit_id, freeze_date, reason)
     VALUES (?, ?, ?, ?)`,
    [id, habitId, freezeDate, reason ?? null],
  );
  return id;
}

export function getFreezesForHabit(db: DatabaseAdapter, habitId: string) {
  const rows = db.query<StreakFreezeRow>(
    `SELECT * FROM hb_streak_freezes WHERE habit_id = ? ORDER BY freeze_date DESC`,
    [habitId],
  );
  return rows.map(rowToFreeze);
}

export function getFreezeDatesForHabit(db: DatabaseAdapter, habitId: string): string[] {
  const rows = db.query<{ freeze_date: string }>(
    `SELECT freeze_date FROM hb_streak_freezes WHERE habit_id = ?`,
    [habitId],
  );
  return rows.map(r => r.freeze_date);
}

export function getFreezesInMonth(db: DatabaseAdapter, habitId: string, month: string) {
  const rows = db.query<StreakFreezeRow>(
    `SELECT * FROM hb_streak_freezes
     WHERE habit_id = ? AND freeze_date LIKE ? ESCAPE '\\'
     ORDER BY freeze_date ASC`,
    [habitId, `${escapeLike(month)}%`],
  );
  return rows.map(rowToFreeze);
}

function escapeLike(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

export function deleteStreakFreeze(db: DatabaseAdapter, id: string) {
  db.execute(`DELETE FROM hb_streak_freezes WHERE id = ?`, [id]);
}
