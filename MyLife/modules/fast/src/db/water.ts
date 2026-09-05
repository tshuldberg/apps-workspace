import type { DatabaseAdapter } from '@mylife/db';
import type { WaterIntake } from '../types';

interface WaterIntakeRow {
  date: string;
  count: number;
  target: number;
  updated_at: string;
}

function toISODate(date?: Date): string {
  return (date ?? new Date()).toISOString().slice(0, 10);
}

function getDefaultTarget(db: DatabaseAdapter): number {
  const rows = db.query<{ value: string }>(`SELECT value FROM ft_settings WHERE key = ?`, ['waterDailyTarget']);
  const parsed = Number(rows[0]?.value ?? 8);
  if (!Number.isFinite(parsed) || parsed < 1) return 8;
  return Math.round(parsed);
}

function rowToWaterIntake(row: WaterIntakeRow): WaterIntake {
  return {
    date: row.date,
    count: row.count,
    target: row.target,
    completed: row.count >= row.target,
    updatedAt: row.updated_at,
  };
}

/**
 * Get water intake for a specific date. If no row exists, returns a default zero row.
 */
export function getWaterIntake(db: DatabaseAdapter, date?: Date): WaterIntake {
  const dateStr = toISODate(date);
  const rows = db.query<WaterIntakeRow>(`SELECT * FROM ft_water_intake WHERE date = ?`, [dateStr]);
  const row = rows[0];

  if (!row) {
    const target = getDefaultTarget(db);
    return {
      date: dateStr,
      count: 0,
      target,
      completed: false,
      updatedAt: new Date().toISOString(),
    };
  }

  return rowToWaterIntake(row);
}

/**
 * Increment today's water intake count by a positive amount (default: 1).
 */
export function incrementWaterIntake(db: DatabaseAdapter, amount: number = 1, date?: Date): WaterIntake {
  const dateStr = toISODate(date);
  const increment = Math.max(1, Math.floor(amount));
  const current = getWaterIntake(db, date);
  const nextCount = current.count + increment;

  db.execute(
    `INSERT OR REPLACE INTO ft_water_intake (date, count, target, updated_at) VALUES (?, ?, ?, ?)`,
    [dateStr, nextCount, current.target, new Date().toISOString()],
  );

  return getWaterIntake(db, date);
}

/**
 * Set the target glasses/bottles for a given day.
 */
export function setWaterTarget(db: DatabaseAdapter, target: number, date?: Date): WaterIntake {
  const dateStr = toISODate(date);
  const roundedTarget = Math.max(1, Math.round(target));
  const current = getWaterIntake(db, date);

  db.transaction(() => {
    db.execute(
      `INSERT OR REPLACE INTO ft_water_intake (date, count, target, updated_at) VALUES (?, ?, ?, ?)`,
      [dateStr, current.count, roundedTarget, new Date().toISOString()],
    );
    db.execute(
      `INSERT OR REPLACE INTO ft_settings (key, value) VALUES ('waterDailyTarget', ?)`,
      [String(roundedTarget)],
    );
  });

  return getWaterIntake(db, date);
}

/**
 * Set an explicit water intake count for a specific date.
 */
export function setWaterIntakeCount(db: DatabaseAdapter, count: number, date?: Date): WaterIntake {
  const dateStr = toISODate(date);
  const safeCount = Math.max(0, Math.round(count));
  const current = getWaterIntake(db, date);

  db.execute(
    `INSERT OR REPLACE INTO ft_water_intake (date, count, target, updated_at) VALUES (?, ?, ?, ?)`,
    [dateStr, safeCount, current.target, new Date().toISOString()],
  );

  return getWaterIntake(db, date);
}

/**
 * Reset today's count to zero while preserving its target.
 */
export function resetWaterIntake(db: DatabaseAdapter, date?: Date): WaterIntake {
  return setWaterIntakeCount(db, 0, date);
}
