import type { DatabaseAdapter } from '@mylife/db';

export interface DailySummary {
  date: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  sugarG: number;
  mealCount: number;
}

export interface GoalProgress {
  calories: { consumed: number; goal: number; percentage: number };
  proteinG: { consumed: number; goal: number; percentage: number };
  carbsG: { consumed: number; goal: number; percentage: number };
  fatG: { consumed: number; goal: number; percentage: number };
}

export interface MealBreakdown {
  mealType: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  itemCount: number;
}

export function getDailySummary(db: DatabaseAdapter, date: string): DailySummary {
  const rows = db.query<Record<string, unknown>>(
    `SELECT
       COALESCE(SUM(i.calories), 0) as total_cal,
       COALESCE(SUM(i.protein_g), 0) as total_protein,
       COALESCE(SUM(i.carbs_g), 0) as total_carbs,
       COALESCE(SUM(i.fat_g), 0) as total_fat,
       COUNT(DISTINCT l.id) as meal_count
     FROM nu_food_log_items i
     JOIN nu_food_log l ON l.id = i.log_id
     WHERE l.date = ?`,
    [date],
  );
  const row = rows[0];

  // Get fiber and sugar from the food entries
  const macros = db.query<Record<string, unknown>>(
    `SELECT
       COALESCE(SUM(f.fiber_g * i.serving_count * i.calories / NULLIF(f.calories, 0)), 0) as total_fiber,
       COALESCE(SUM(f.sugar_g * i.serving_count * i.calories / NULLIF(f.calories, 0)), 0) as total_sugar
     FROM nu_food_log_items i
     JOIN nu_food_log l ON l.id = i.log_id
     JOIN nu_foods f ON f.id = i.food_id
     WHERE l.date = ?`,
    [date],
  );
  const m = macros[0];

  return {
    date,
    calories: (row.total_cal as number) ?? 0,
    proteinG: (row.total_protein as number) ?? 0,
    carbsG: (row.total_carbs as number) ?? 0,
    fatG: (row.total_fat as number) ?? 0,
    fiberG: (m.total_fiber as number) ?? 0,
    sugarG: (m.total_sugar as number) ?? 0,
    mealCount: (row.meal_count as number) ?? 0,
  };
}

export function getDailyGoalProgress(db: DatabaseAdapter, date: string): GoalProgress | null {
  const goals = db.query<Record<string, unknown>>(
    'SELECT * FROM nu_daily_goals WHERE effective_date <= ? ORDER BY effective_date DESC LIMIT 1',
    [date],
  );
  if (goals.length === 0) return null;

  const goal = goals[0];
  const summary = getDailySummary(db, date);

  const pct = (consumed: number, g: number) => g > 0 ? Math.round((consumed / g) * 100) : 0;

  return {
    calories: { consumed: summary.calories, goal: goal.calories as number, percentage: pct(summary.calories, goal.calories as number) },
    proteinG: { consumed: summary.proteinG, goal: goal.protein_g as number, percentage: pct(summary.proteinG, goal.protein_g as number) },
    carbsG: { consumed: summary.carbsG, goal: goal.carbs_g as number, percentage: pct(summary.carbsG, goal.carbs_g as number) },
    fatG: { consumed: summary.fatG, goal: goal.fat_g as number, percentage: pct(summary.fatG, goal.fat_g as number) },
  };
}

export function getMealBreakdown(db: DatabaseAdapter, date: string): MealBreakdown[] {
  return db
    .query<Record<string, unknown>>(
      `SELECT
         l.meal_type,
         COALESCE(SUM(i.calories), 0) as total_cal,
         COALESCE(SUM(i.protein_g), 0) as total_protein,
         COALESCE(SUM(i.carbs_g), 0) as total_carbs,
         COALESCE(SUM(i.fat_g), 0) as total_fat,
         COUNT(i.id) as item_count
       FROM nu_food_log l
       LEFT JOIN nu_food_log_items i ON i.log_id = l.id
       WHERE l.date = ?
       GROUP BY l.meal_type
       ORDER BY CASE l.meal_type
         WHEN 'breakfast' THEN 1
         WHEN 'lunch' THEN 2
         WHEN 'dinner' THEN 3
         WHEN 'snack' THEN 4
       END`,
      [date],
    )
    .map((row) => ({
      mealType: row.meal_type as string,
      calories: (row.total_cal as number) ?? 0,
      proteinG: (row.total_protein as number) ?? 0,
      carbsG: (row.total_carbs as number) ?? 0,
      fatG: (row.total_fat as number) ?? 0,
      itemCount: (row.item_count as number) ?? 0,
    }));
}
