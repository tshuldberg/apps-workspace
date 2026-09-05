import type { DatabaseAdapter } from '@mylife/db';
import type { FoodLogEntry, FoodLogItem } from '../types';

// ---------------------------------------------------------------------------
// Row mappers
// ---------------------------------------------------------------------------

function rowToLogEntry(row: Record<string, unknown>): FoodLogEntry {
  return {
    id: row.id as string,
    date: row.date as string,
    mealType: row.meal_type as FoodLogEntry['mealType'],
    notes: (row.notes as string) ?? null,
    createdAt: row.created_at as string,
  };
}

function rowToLogItem(row: Record<string, unknown>): FoodLogItem {
  return {
    id: row.id as string,
    logId: row.log_id as string,
    foodId: row.food_id as string,
    servingCount: row.serving_count as number,
    calories: row.calories as number,
    proteinG: row.protein_g as number,
    carbsG: row.carbs_g as number,
    fatG: row.fat_g as number,
  };
}

// ---------------------------------------------------------------------------
// Food Log Entries
// ---------------------------------------------------------------------------

export function createFoodLogEntry(
  db: DatabaseAdapter,
  id: string,
  input: { date: string; mealType: string; notes?: string },
): void {
  const now = new Date().toISOString();
  db.execute(
    `INSERT INTO nu_food_log (id, date, meal_type, notes, created_at) VALUES (?, ?, ?, ?, ?)`,
    [id, input.date, input.mealType, input.notes ?? null, now],
  );
}

export function getFoodLogEntries(db: DatabaseAdapter, date: string): FoodLogEntry[] {
  return db
    .query<Record<string, unknown>>(
      'SELECT * FROM nu_food_log WHERE date = ? ORDER BY created_at ASC',
      [date],
    )
    .map(rowToLogEntry);
}

export function getFoodLogEntryById(db: DatabaseAdapter, id: string): FoodLogEntry | null {
  const rows = db.query<Record<string, unknown>>('SELECT * FROM nu_food_log WHERE id = ?', [id]);
  return rows.length > 0 ? rowToLogEntry(rows[0]) : null;
}

export function updateFoodLogEntry(
  db: DatabaseAdapter,
  id: string,
  updates: Partial<{ mealType: string; notes: string }>,
): void {
  const sets: string[] = [];
  const params: unknown[] = [];
  if (updates.mealType !== undefined) { sets.push('meal_type = ?'); params.push(updates.mealType); }
  if (updates.notes !== undefined) { sets.push('notes = ?'); params.push(updates.notes); }
  if (sets.length === 0) return;
  params.push(id);
  db.execute(`UPDATE nu_food_log SET ${sets.join(', ')} WHERE id = ?`, params);
}

export function deleteFoodLogEntry(db: DatabaseAdapter, id: string): void {
  db.execute('DELETE FROM nu_food_log WHERE id = ?', [id]);
}

// ---------------------------------------------------------------------------
// Food Log Items
// ---------------------------------------------------------------------------

export function addFoodLogItem(
  db: DatabaseAdapter,
  id: string,
  input: {
    logId: string;
    foodId: string;
    servingCount?: number;
    calories: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
  },
): void {
  const now = new Date().toISOString();
  db.execute(
    `INSERT INTO nu_food_log_items (id, log_id, food_id, serving_count, calories, protein_g, carbs_g, fat_g, logged_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.logId,
      input.foodId,
      input.servingCount ?? 1,
      input.calories,
      input.proteinG,
      input.carbsG,
      input.fatG,
      now,
    ],
  );
}

export function getFoodLogItems(db: DatabaseAdapter, logId: string): FoodLogItem[] {
  return db
    .query<Record<string, unknown>>(
      'SELECT * FROM nu_food_log_items WHERE log_id = ? ORDER BY rowid ASC',
      [logId],
    )
    .map(rowToLogItem);
}

export function updateFoodLogItem(
  db: DatabaseAdapter,
  id: string,
  updates: Partial<{ servingCount: number; calories: number; proteinG: number; carbsG: number; fatG: number }>,
): void {
  const sets: string[] = [];
  const params: unknown[] = [];
  if (updates.servingCount !== undefined) { sets.push('serving_count = ?'); params.push(updates.servingCount); }
  if (updates.calories !== undefined) { sets.push('calories = ?'); params.push(updates.calories); }
  if (updates.proteinG !== undefined) { sets.push('protein_g = ?'); params.push(updates.proteinG); }
  if (updates.carbsG !== undefined) { sets.push('carbs_g = ?'); params.push(updates.carbsG); }
  if (updates.fatG !== undefined) { sets.push('fat_g = ?'); params.push(updates.fatG); }
  if (sets.length === 0) return;
  params.push(id);
  db.execute(`UPDATE nu_food_log_items SET ${sets.join(', ')} WHERE id = ?`, params);
}

export function deleteFoodLogItem(db: DatabaseAdapter, id: string): void {
  db.execute('DELETE FROM nu_food_log_items WHERE id = ?', [id]);
}

export function copyFoodLog(
  db: DatabaseAdapter,
  fromDate: string,
  toDate: string,
): number {
  if (!fromDate || !toDate || fromDate === toDate) {
    return 0;
  }

  const sourceEntries = getFoodLogEntries(db, fromDate);
  if (sourceEntries.length === 0) {
    return 0;
  }

  let copiedItems = 0;

  db.transaction(() => {
    for (const entry of sourceEntries) {
      const nextLogId = crypto.randomUUID();
      createFoodLogEntry(db, nextLogId, {
        date: toDate,
        mealType: entry.mealType,
        notes: entry.notes ?? undefined,
      });

      const items = getFoodLogItems(db, entry.id);
      for (const item of items) {
        addFoodLogItem(db, crypto.randomUUID(), {
          logId: nextLogId,
          foodId: item.foodId,
          servingCount: item.servingCount,
          calories: item.calories,
          proteinG: item.proteinG,
          carbsG: item.carbsG,
          fatG: item.fatG,
        });
        copiedItems += 1;
      }
    }
  });

  return copiedItems;
}

// ---------------------------------------------------------------------------
// Daily Totals
// ---------------------------------------------------------------------------

export interface DailyTotals {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export function getDailyTotals(db: DatabaseAdapter, date: string): DailyTotals {
  const rows = db.query<Record<string, unknown>>(
    `SELECT
       COALESCE(SUM(i.calories), 0) as total_calories,
       COALESCE(SUM(i.protein_g), 0) as total_protein,
       COALESCE(SUM(i.carbs_g), 0) as total_carbs,
       COALESCE(SUM(i.fat_g), 0) as total_fat
     FROM nu_food_log_items i
     JOIN nu_food_log l ON l.id = i.log_id
     WHERE l.date = ?`,
    [date],
  );
  const row = rows[0];
  return {
    calories: (row.total_calories as number) ?? 0,
    proteinG: (row.total_protein as number) ?? 0,
    carbsG: (row.total_carbs as number) ?? 0,
    fatG: (row.total_fat as number) ?? 0,
  };
}
