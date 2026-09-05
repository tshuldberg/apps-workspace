import type { DatabaseAdapter } from '@mylife/db';

export type NutrientStatus = 'deficient' | 'low' | 'adequate' | 'excess';

export interface NutrientSummaryItem {
  nutrientId: string;
  nutrientName: string;
  unit: string;
  consumed: number;
  rda: number | null;
  percentage: number | null;
  status: NutrientStatus;
}

export interface NutrientDeficiency {
  nutrientId: string;
  nutrientName: string;
  unit: string;
  rda: number;
  avgConsumed: number;
  avgPercentage: number;
}

export interface TopNutrientSource {
  foodId: string;
  foodName: string;
  amount: number;
  unit: string;
}

function getStatus(percentage: number | null): NutrientStatus {
  if (percentage === null) return 'adequate';
  if (percentage < 25) return 'deficient';
  if (percentage < 75) return 'low';
  if (percentage <= 200) return 'adequate';
  return 'excess';
}

/**
 * Get micronutrient summary for a given date.
 * Shows all tracked nutrients with consumed vs RDA.
 */
export function getMicronutrientSummary(db: DatabaseAdapter, date: string): NutrientSummaryItem[] {
  // Get all nutrients with their consumed amounts for the date
  const rows = db.query<Record<string, unknown>>(
    `SELECT
       n.id as nutrient_id,
       n.name as nutrient_name,
       n.unit,
       n.rda_value,
       COALESCE(SUM(fn.amount * (i.serving_count * i.calories / NULLIF(f.calories, 0))), 0) as consumed
     FROM nu_nutrients n
     LEFT JOIN nu_food_nutrients fn ON fn.nutrient_id = n.id
     LEFT JOIN nu_foods f ON f.id = fn.food_id
     LEFT JOIN nu_food_log_items i ON i.food_id = f.id
     LEFT JOIN nu_food_log l ON l.id = i.log_id AND l.date = ?
     GROUP BY n.id
     ORDER BY n.sort_order ASC`,
    [date],
  );

  return rows.map((row) => {
    const rda = (row.rda_value as number) ?? null;
    const consumed = (row.consumed as number) ?? 0;
    const percentage = rda !== null && rda > 0 ? Math.round((consumed / rda) * 100) : null;

    return {
      nutrientId: row.nutrient_id as string,
      nutrientName: row.nutrient_name as string,
      unit: row.unit as string,
      consumed,
      rda,
      percentage,
      status: getStatus(percentage),
    };
  });
}

/**
 * Find nutrients consistently below 50% RDA over the last N days.
 */
export function getMicronutrientDeficiencies(db: DatabaseAdapter, days: number): NutrientDeficiency[] {
  const endDate = new Date().toISOString().slice(0, 10);
  const startDate = new Date(Date.now() - (days - 1) * 86400000).toISOString().slice(0, 10);

  const rows = db.query<Record<string, unknown>>(
    `SELECT
       n.id as nutrient_id,
       n.name as nutrient_name,
       n.unit,
       n.rda_value,
       COALESCE(SUM(fn.amount * (i.serving_count * i.calories / NULLIF(f.calories, 0))), 0) / ? as avg_consumed
     FROM nu_nutrients n
     LEFT JOIN nu_food_nutrients fn ON fn.nutrient_id = n.id
     LEFT JOIN nu_foods f ON f.id = fn.food_id
     LEFT JOIN nu_food_log_items i ON i.food_id = f.id
     LEFT JOIN nu_food_log l ON l.id = i.log_id AND l.date >= ? AND l.date <= ?
     WHERE n.rda_value IS NOT NULL AND n.rda_value > 0
     GROUP BY n.id
     HAVING avg_consumed < (n.rda_value * 0.5)
     ORDER BY (avg_consumed / n.rda_value) ASC`,
    [days, startDate, endDate],
  );

  return rows.map((row) => {
    const rda = row.rda_value as number;
    const avgConsumed = (row.avg_consumed as number) ?? 0;
    return {
      nutrientId: row.nutrient_id as string,
      nutrientName: row.nutrient_name as string,
      unit: row.unit as string,
      rda,
      avgConsumed,
      avgPercentage: Math.round((avgConsumed / rda) * 100),
    };
  });
}

/**
 * Get the top food sources of a specific nutrient from the user's food log.
 */
export function getTopNutrientSources(
  db: DatabaseAdapter,
  nutrientId: string,
  limit = 10,
): TopNutrientSource[] {
  return db
    .query<Record<string, unknown>>(
      `SELECT
         f.id as food_id,
         f.name as food_name,
         fn.amount,
         n.unit
       FROM nu_food_nutrients fn
       JOIN nu_foods f ON f.id = fn.food_id
       JOIN nu_nutrients n ON n.id = fn.nutrient_id
       WHERE fn.nutrient_id = ? AND fn.amount > 0
       ORDER BY fn.amount DESC
       LIMIT ?`,
      [nutrientId, limit],
    )
    .map((row) => ({
      foodId: row.food_id as string,
      foodName: row.food_name as string,
      amount: row.amount as number,
      unit: row.unit as string,
    }));
}
