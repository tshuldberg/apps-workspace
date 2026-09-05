import type { DatabaseAdapter } from '@mylife/db';
import type { DailyGoals } from '../types';

// ---------------------------------------------------------------------------
// Row mapper
// ---------------------------------------------------------------------------

function rowToGoals(row: Record<string, unknown>): DailyGoals {
  return {
    id: row.id as string,
    calories: row.calories as number,
    proteinG: row.protein_g as number,
    carbsG: row.carbs_g as number,
    fatG: row.fat_g as number,
    effectiveDate: row.effective_date as string,
  };
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export function createDailyGoals(
  db: DatabaseAdapter,
  id: string,
  input: {
    calories: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
    effectiveDate: string;
  },
): void {
  db.execute(
    `INSERT INTO nu_daily_goals (id, calories, protein_g, carbs_g, fat_g, effective_date)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, input.calories, input.proteinG, input.carbsG, input.fatG, input.effectiveDate],
  );
}

export function getDailyGoals(db: DatabaseAdapter, limit = 100): DailyGoals[] {
  return db
    .query<Record<string, unknown>>('SELECT * FROM nu_daily_goals ORDER BY effective_date DESC LIMIT ?', [limit])
    .map(rowToGoals);
}

export function getActiveGoals(db: DatabaseAdapter, date: string): DailyGoals | null {
  const rows = db.query<Record<string, unknown>>(
    'SELECT * FROM nu_daily_goals WHERE effective_date <= ? ORDER BY effective_date DESC LIMIT 1',
    [date],
  );
  return rows.length > 0 ? rowToGoals(rows[0]) : null;
}

export function updateDailyGoals(
  db: DatabaseAdapter,
  id: string,
  updates: Partial<{ calories: number; proteinG: number; carbsG: number; fatG: number; effectiveDate: string }>,
): void {
  const sets: string[] = [];
  const params: unknown[] = [];
  if (updates.calories !== undefined) { sets.push('calories = ?'); params.push(updates.calories); }
  if (updates.proteinG !== undefined) { sets.push('protein_g = ?'); params.push(updates.proteinG); }
  if (updates.carbsG !== undefined) { sets.push('carbs_g = ?'); params.push(updates.carbsG); }
  if (updates.fatG !== undefined) { sets.push('fat_g = ?'); params.push(updates.fatG); }
  if (updates.effectiveDate !== undefined) { sets.push('effective_date = ?'); params.push(updates.effectiveDate); }
  if (sets.length === 0) return;
  params.push(id);
  db.execute(`UPDATE nu_daily_goals SET ${sets.join(', ')} WHERE id = ?`, params);
}

export function deleteDailyGoals(db: DatabaseAdapter, id: string): void {
  db.execute('DELETE FROM nu_daily_goals WHERE id = ?', [id]);
}
