import type { DatabaseAdapter } from '@mylife/db';

function escapeCsvField(value: string): string {
  // Guard against CSV formula injection: prefix dangerous leading chars with a tab
  let safe = value;
  if (/^[=+\-@\t\r]/.test(safe)) {
    safe = '\t' + safe;
  }
  if (safe.includes(',') || safe.includes('"') || safe.includes('\n')) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

/**
 * Export food log entries as CSV.
 * Columns: Date, Meal, Food, Serving, Unit, Calories, Protein (g), Carbs (g), Fat (g)
 */
export function exportFoodLogCSV(
  db: DatabaseAdapter,
  startDate?: string,
  endDate?: string,
): string {
  let sql = `SELECT
    l.date,
    l.meal_type,
    f.name as food_name,
    i.serving_count,
    f.serving_unit,
    i.calories,
    i.protein_g,
    i.carbs_g,
    i.fat_g
  FROM nu_food_log_items i
  JOIN nu_food_log l ON l.id = i.log_id
  JOIN nu_foods f ON f.id = i.food_id`;

  const params: unknown[] = [];
  const conditions: string[] = [];

  if (startDate) { conditions.push('l.date >= ?'); params.push(startDate); }
  if (endDate) { conditions.push('l.date <= ?'); params.push(endDate); }
  if (conditions.length > 0) sql += ' WHERE ' + conditions.join(' AND ');
  sql += ' ORDER BY l.date ASC, l.meal_type ASC';

  const rows = db.query<Record<string, unknown>>(sql, params);

  const header = 'Date,Meal,Food,Servings,Unit,Calories,Protein (g),Carbs (g),Fat (g)';
  const lines = rows.map((row) =>
    [
      row.date as string,
      row.meal_type as string,
      escapeCsvField(row.food_name as string),
      row.serving_count as number,
      row.serving_unit as string,
      row.calories as number,
      row.protein_g as number,
      row.carbs_g as number,
      row.fat_g as number,
    ].join(','),
  );

  return [header, ...lines].join('\n');
}

/**
 * Export daily nutrition summary as CSV.
 * Columns: Date, Calories, Protein (g), Carbs (g), Fat (g), Meals
 */
export function exportNutritionSummaryCSV(
  db: DatabaseAdapter,
  startDate?: string,
  endDate?: string,
): string {
  let sql = `SELECT
    l.date,
    COALESCE(SUM(i.calories), 0) as total_cal,
    COALESCE(SUM(i.protein_g), 0) as total_protein,
    COALESCE(SUM(i.carbs_g), 0) as total_carbs,
    COALESCE(SUM(i.fat_g), 0) as total_fat,
    COUNT(DISTINCT l.id) as meal_count
  FROM nu_food_log l
  LEFT JOIN nu_food_log_items i ON i.log_id = l.id`;

  const params: unknown[] = [];
  const conditions: string[] = [];

  if (startDate) { conditions.push('l.date >= ?'); params.push(startDate); }
  if (endDate) { conditions.push('l.date <= ?'); params.push(endDate); }
  if (conditions.length > 0) sql += ' WHERE ' + conditions.join(' AND ');
  sql += ' GROUP BY l.date ORDER BY l.date ASC';

  const rows = db.query<Record<string, unknown>>(sql, params);

  const header = 'Date,Calories,Protein (g),Carbs (g),Fat (g),Meals';
  const lines = rows.map((row) =>
    [
      row.date as string,
      Math.round(row.total_cal as number),
      Math.round((row.total_protein as number) * 10) / 10,
      Math.round((row.total_carbs as number) * 10) / 10,
      Math.round((row.total_fat as number) * 10) / 10,
      row.meal_count as number,
    ].join(','),
  );

  return [header, ...lines].join('\n');
}
