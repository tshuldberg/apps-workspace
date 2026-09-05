import type { DatabaseAdapter } from '@mylife/db';
import type { Measurement } from '../types';

// ---------------------------------------------------------------------------
// Row mapper
// ---------------------------------------------------------------------------

function rowToMeasurement(row: Record<string, unknown>): Measurement {
  return {
    id: row.id as string,
    habitId: row.habit_id as string,
    measuredAt: row.measured_at as string,
    value: row.value as number,
    target: row.target as number,
    createdAt: row.created_at as string,
  };
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export function recordMeasurement(
  db: DatabaseAdapter,
  id: string,
  habitId: string,
  measuredAt: string,
  value: number,
  target: number,
): void {
  const now = new Date().toISOString();
  db.execute(
    `INSERT INTO hb_measurements (id, habit_id, measured_at, value, target, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, habitId, measuredAt, value, target, now],
  );
}

export function getMeasurementsForHabit(
  db: DatabaseAdapter,
  habitId: string,
  opts?: { from?: string; to?: string },
): Measurement[] {
  let sql = 'SELECT * FROM hb_measurements WHERE habit_id = ?';
  const params: unknown[] = [habitId];
  if (opts?.from) { sql += ' AND measured_at >= ?'; params.push(opts.from); }
  if (opts?.to) { sql += ' AND measured_at <= ?'; params.push(opts.to); }
  sql += ' ORDER BY measured_at DESC';
  return db.query<Record<string, unknown>>(sql, params).map(rowToMeasurement);
}

export function getMeasurementsForDate(
  db: DatabaseAdapter,
  date: string,
): Measurement[] {
  return db.query<Record<string, unknown>>(
    "SELECT * FROM hb_measurements WHERE measured_at LIKE ? ESCAPE '\\' ORDER BY measured_at ASC",
    [`${escapeLike(date)}%`],
  ).map(rowToMeasurement);
}

function escapeLike(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

export function deleteMeasurement(db: DatabaseAdapter, id: string): void {
  db.execute('DELETE FROM hb_measurements WHERE id = ?', [id]);
}
