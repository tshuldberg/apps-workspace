import type { DatabaseAdapter } from '@mylife/db';

export interface AggregateTargetScore {
  /** Overall percentage of all nutrient targets met (0-100) */
  score: number;
  /** Macro target scores */
  macros: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  /** Count of micronutrients at adequate or excess levels */
  microsMet: number;
  /** Total tracked micronutrients */
  microsTotal: number;
}

export interface DailyReport {
  date: string;
  targetScore: AggregateTargetScore;
  topCalorieSources: { name: string; calories: number }[];
  topProteinSources: { name: string; proteinG: number }[];
  mealBreakdown: { mealType: string; calories: number; itemCount: number }[];
  waterMl: number;
  waterGoalMl: number;
}

/**
 * Calculate how close a consumed value is to its goal (0-100).
 * Being within 10% over goal still scores 100. Over 120% drops to 80, etc.
 */
function targetScore(consumed: number, goal: number): number {
  if (goal <= 0) return 100;
  const ratio = consumed / goal;
  if (ratio >= 0.9 && ratio <= 1.1) return 100;
  if (ratio < 0.9) return Math.round((ratio / 0.9) * 100);
  // Over 110%: penalize gently
  return Math.max(0, Math.round(100 - (ratio - 1.1) * 200));
}

export function getAggregateTargetScore(db: DatabaseAdapter, date: string): AggregateTargetScore {
  // Get daily totals
  const totalsRows = db.query<Record<string, unknown>>(
    `SELECT
       COALESCE(SUM(i.calories), 0) as cal,
       COALESCE(SUM(i.protein_g), 0) as prot,
       COALESCE(SUM(i.carbs_g), 0) as carbs,
       COALESCE(SUM(i.fat_g), 0) as fat
     FROM nu_food_log_items i
     JOIN nu_food_log l ON l.id = i.log_id
     WHERE l.date = ?`,
    [date],
  );
  const t = totalsRows[0] ?? { cal: 0, prot: 0, carbs: 0, fat: 0 };

  // Get goals
  const goalRows = db.query<Record<string, unknown>>(
    `SELECT calories, protein_g, carbs_g, fat_g
     FROM nu_daily_goals
     WHERE effective_date <= ?
     ORDER BY effective_date DESC LIMIT 1`,
    [date],
  );
  const g = goalRows[0] ?? { calories: 2000, protein_g: 150, carbs_g: 250, fat_g: 65 };

  const calScore = targetScore(t.cal as number, g.calories as number);
  const protScore = targetScore(t.prot as number, g.protein_g as number);
  const carbScore = targetScore(t.carbs as number, g.carbs_g as number);
  const fatScore = targetScore(t.fat as number, g.fat_g as number);

  // Micronutrient tracking
  const microRows = db.query<Record<string, unknown>>(
    `SELECT
       COUNT(*) as total,
       SUM(CASE WHEN consumed >= rda THEN 1 ELSE 0 END) as met
     FROM (
       SELECT fn.nutrient_id, n.rda,
         SUM(fn.amount_per_serving * i.serving_count) as consumed
       FROM nu_food_log_items i
       JOIN nu_food_log l ON l.id = i.log_id
       JOIN nu_food_nutrients fn ON fn.food_id = i.food_id
       JOIN nu_nutrients n ON n.id = fn.nutrient_id
       WHERE l.date = ? AND n.rda > 0
       GROUP BY fn.nutrient_id
     )`,
    [date],
  );
  const micro = microRows[0] ?? { total: 0, met: 0 };

  const macroAvg = Math.round((calScore + protScore + carbScore + fatScore) / 4);
  const microsTotal = (micro.total as number) || 0;
  const microsMet = (micro.met as number) || 0;
  const microScore = microsTotal > 0 ? Math.round((microsMet / microsTotal) * 100) : 0;

  // Weighted: macros 60%, micros 40%
  const score = microsTotal > 0
    ? Math.round(macroAvg * 0.6 + microScore * 0.4)
    : macroAvg;

  return {
    score,
    macros: { calories: calScore, protein: protScore, carbs: carbScore, fat: fatScore },
    microsMet,
    microsTotal,
  };
}

export function getDailyReport(db: DatabaseAdapter, date: string): DailyReport {
  const targetScoreData = getAggregateTargetScore(db, date);

  // Top calorie sources
  const topCal = db.query<{ name: string; calories: number }>(
    `SELECT f.name, ROUND(SUM(i.calories), 0) as calories
     FROM nu_food_log_items i
     JOIN nu_food_log l ON l.id = i.log_id
     JOIN nu_foods f ON f.id = i.food_id
     WHERE l.date = ?
     GROUP BY f.id ORDER BY calories DESC LIMIT 5`,
    [date],
  );

  // Top protein sources
  const topProt = db.query<{ name: string; proteinG: number }>(
    `SELECT f.name, ROUND(SUM(i.protein_g), 1) as proteinG
     FROM nu_food_log_items i
     JOIN nu_food_log l ON l.id = i.log_id
     JOIN nu_foods f ON f.id = i.food_id
     WHERE l.date = ?
     GROUP BY f.id ORDER BY proteinG DESC LIMIT 5`,
    [date],
  );

  // Meal breakdown
  const meals = db.query<{ mealType: string; calories: number; itemCount: number }>(
    `SELECT l.meal_type as mealType,
       ROUND(SUM(i.calories), 0) as calories,
       COUNT(i.id) as itemCount
     FROM nu_food_log_items i
     JOIN nu_food_log l ON l.id = i.log_id
     WHERE l.date = ?
     GROUP BY l.meal_type`,
    [date],
  );

  // Water
  const waterRows = db.query<{ total: number }>(
    `SELECT COALESCE(SUM(amount_ml), 0) as total FROM nu_water_log WHERE date = ?`,
    [date],
  );
  const settingsRows = db.query<{ value: string }>(
    `SELECT value FROM nu_settings WHERE key = 'water_goal_ml'`,
  );

  return {
    date,
    targetScore: targetScoreData,
    topCalorieSources: topCal,
    topProteinSources: topProt,
    mealBreakdown: meals,
    waterMl: waterRows[0]?.total ?? 0,
    waterGoalMl: parseInt(settingsRows[0]?.value ?? '2500', 10),
  };
}
