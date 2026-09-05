import type { DatabaseAdapter } from '@mylife/db';
import type { Nutrient, FoodNutrient } from '../types';

export interface DailyNutrientTotal {
  nutrientId: string;
  nutrientName: string;
  unit: string;
  category: Nutrient['category'];
  rdaValue: number | null;
  total: number;
  percentage: number | null;
}

// ---------------------------------------------------------------------------
// Row mappers
// ---------------------------------------------------------------------------

function rowToNutrient(row: Record<string, unknown>): Nutrient {
  return {
    id: row.id as string,
    name: row.name as string,
    unit: row.unit as string,
    rdaValue: (row.rda_value as number) ?? null,
    rdaUnit: (row.rda_unit as string) ?? null,
    category: row.category as Nutrient['category'],
    sortOrder: row.sort_order as number,
  };
}

function rowToFoodNutrient(row: Record<string, unknown>): FoodNutrient {
  return {
    id: row.id as string,
    foodId: row.food_id as string,
    nutrientId: row.nutrient_id as string,
    amount: row.amount as number,
  };
}

// ---------------------------------------------------------------------------
// Nutrients CRUD
// ---------------------------------------------------------------------------

export function createNutrient(
  db: DatabaseAdapter,
  id: string,
  input: {
    name: string;
    unit: string;
    rdaValue?: number;
    rdaUnit?: string;
    category: string;
    sortOrder?: number;
  },
): void {
  db.execute(
    `INSERT INTO nu_nutrients (id, name, unit, rda_value, rda_unit, category, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.name,
      input.unit,
      input.rdaValue ?? null,
      input.rdaUnit ?? null,
      input.category,
      input.sortOrder ?? 0,
    ],
  );
}

export function getNutrients(db: DatabaseAdapter): Nutrient[] {
  return db
    .query<Record<string, unknown>>('SELECT * FROM nu_nutrients ORDER BY sort_order ASC, name ASC')
    .map(rowToNutrient);
}

export function getNutrientById(db: DatabaseAdapter, id: string): Nutrient | null {
  const rows = db.query<Record<string, unknown>>('SELECT * FROM nu_nutrients WHERE id = ?', [id]);
  return rows.length > 0 ? rowToNutrient(rows[0]) : null;
}

export function deleteNutrient(db: DatabaseAdapter, id: string): void {
  db.execute('DELETE FROM nu_nutrients WHERE id = ?', [id]);
}

// ---------------------------------------------------------------------------
// Food Nutrients (junction)
// ---------------------------------------------------------------------------

export function setFoodNutrient(
  db: DatabaseAdapter,
  id: string,
  foodId: string,
  nutrientId: string,
  amount: number,
): void {
  db.execute(
    `INSERT INTO nu_food_nutrients (id, food_id, nutrient_id, amount)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(food_id, nutrient_id) DO UPDATE SET amount = excluded.amount`,
    [id, foodId, nutrientId, amount],
  );
}

export function getFoodNutrients(db: DatabaseAdapter, foodId: string): FoodNutrient[] {
  return db
    .query<Record<string, unknown>>(
      'SELECT * FROM nu_food_nutrients WHERE food_id = ? ORDER BY nutrient_id',
      [foodId],
    )
    .map(rowToFoodNutrient);
}

export function deleteFoodNutrient(db: DatabaseAdapter, foodId: string, nutrientId: string): void {
  db.execute('DELETE FROM nu_food_nutrients WHERE food_id = ? AND nutrient_id = ?', [foodId, nutrientId]);
}

export function deleteFoodNutrients(db: DatabaseAdapter, foodId: string): void {
  db.execute('DELETE FROM nu_food_nutrients WHERE food_id = ?', [foodId]);
}

export function getDailyNutrientTotals(
  db: DatabaseAdapter,
  date: string,
): DailyNutrientTotal[] {
  const rows = db.query<Record<string, unknown>>(
    `SELECT
       n.id as nutrient_id,
       n.name as nutrient_name,
       n.unit as nutrient_unit,
       n.category as nutrient_category,
       n.rda_value as nutrient_rda,
       COALESCE(SUM(fn.amount * di.serving_count * di.calorie_ratio), 0) as total_amount
     FROM nu_nutrients n
     LEFT JOIN nu_food_nutrients fn ON fn.nutrient_id = n.id
     LEFT JOIN (
       SELECT
         i.food_id,
         i.serving_count,
         CASE
           WHEN COALESCE(f.calories, 0) <= 0 THEN 0
           ELSE i.calories / f.calories
         END as calorie_ratio
       FROM nu_food_log_items i
       JOIN nu_food_log l ON l.id = i.log_id
       JOIN nu_foods f ON f.id = i.food_id
       WHERE l.date = ?
     ) di ON di.food_id = fn.food_id
     GROUP BY n.id
     ORDER BY n.sort_order ASC, n.name ASC`,
    [date],
  );

  return rows.map((row) => {
    const total = Number(row.total_amount ?? 0);
    const rdaValue =
      row.nutrient_rda === null ? null : Number(row.nutrient_rda ?? 0);
    const percentage =
      rdaValue && rdaValue > 0 ? Math.round((total / rdaValue) * 100) : null;

    return {
      nutrientId: row.nutrient_id as string,
      nutrientName: row.nutrient_name as string,
      unit: row.nutrient_unit as string,
      category: row.nutrient_category as Nutrient['category'],
      rdaValue,
      total,
      percentage,
    };
  });
}
