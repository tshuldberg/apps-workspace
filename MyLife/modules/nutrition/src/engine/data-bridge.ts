/**
 * Cross-module data bridge for the Nutrition Correlation Engine.
 * Reads data from other modules' SQLite tables with graceful degradation.
 * Pattern: follows integration/fast-bridge.ts (table-existence guards, null returns).
 */

import type { DatabaseAdapter } from '@mylife/db';
import type { DayFastingData, DayWorkoutData, DayMoodData, DayNutritionData } from './types';

// ── Table existence check ────────────────────────────────────────────

function tableExists(db: DatabaseAdapter, tableName: string): boolean {
  const result = db.query<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
    [tableName],
  );
  return result.length > 0;
}

// ── Nutrition data (own tables) ──────────────────────────────────────

export function getNutritionDays(db: DatabaseAdapter, dayCount: number): DayNutritionData[] {
  try {
    const rows = db.query<{
      date: string;
      totalCalories: number;
      proteinG: number;
      carbsG: number;
      fatG: number;
      mealCount: number;
      snackCount: number;
    }>(
      `SELECT
        fl.date,
        COALESCE(SUM(fli.calories), 0) as totalCalories,
        COALESCE(SUM(fli.protein_g), 0) as proteinG,
        COALESCE(SUM(fli.carbs_g), 0) as carbsG,
        COALESCE(SUM(fli.fat_g), 0) as fatG,
        COUNT(DISTINCT CASE WHEN fl.meal_type IN ('breakfast', 'lunch', 'dinner') THEN fl.id END) as mealCount,
        COUNT(DISTINCT CASE WHEN fl.meal_type = 'snack' THEN fl.id END) as snackCount
      FROM nu_food_log fl
      LEFT JOIN nu_food_log_items fli ON fli.log_id = fl.id
      WHERE fl.date >= date('now', '-' || ? || ' days')
      GROUP BY fl.date
      ORDER BY fl.date`,
      [dayCount],
    );

    // Get last meal hour per day
    const mealTimings = db.query<{ date: string; lastHour: number; firstHour: number }>(
      `SELECT
        date,
        MAX(CAST(strftime('%H', created_at) AS INTEGER)) as lastHour,
        MIN(CAST(strftime('%H', created_at) AS INTEGER)) as firstHour
      FROM nu_food_log
      WHERE date >= date('now', '-' || ? || ' days')
      GROUP BY date`,
      [dayCount],
    );
    const timingMap = new Map(mealTimings.map((t) => [t.date, { lastHour: t.lastHour, firstHour: t.firstHour }]));

    // Get restaurant meal days -- foods from logMenuItemAsMeal have brand=restaurant name
    // and are linked via nu_menu_items. Detect by checking if the food's brand matches a restaurant.
    const restaurantDays = new Set<string>();
    if (tableExists(db, 'nu_restaurants') && tableExists(db, 'nu_menu_items')) {
      const rDays = db.query<{ date: string }>(
        `SELECT DISTINCT fl.date
        FROM nu_food_log fl
        INNER JOIN nu_food_log_items fli ON fli.log_id = fl.id
        INNER JOIN nu_foods f ON f.id = fli.food_id
        WHERE fl.date >= date('now', '-' || ? || ' days')
          AND f.brand IN (SELECT name FROM nu_restaurants)`,
        [dayCount],
      );
      for (const r of rDays) restaurantDays.add(r.date);
    }

    // Get water data
    const waterMap = new Map<string, number>();
    if (tableExists(db, 'nu_water_log')) {
      const waterRows = db.query<{ date: string; totalMl: number }>(
        `SELECT date, SUM(amount_ml) as totalMl
        FROM nu_water_log
        WHERE date >= date('now', '-' || ? || ' days')
        GROUP BY date`,
        [dayCount],
      );
      for (const w of waterRows) waterMap.set(w.date, w.totalMl);
    }

    return rows.map((r) => ({
      date: r.date,
      totalCalories: r.totalCalories,
      proteinG: r.proteinG,
      carbsG: r.carbsG,
      fatG: r.fatG,
      mealCount: r.mealCount,
      snackCount: r.snackCount,
      lastMealHour: timingMap.get(r.date)?.lastHour ?? null,
      firstMealHour: timingMap.get(r.date)?.firstHour ?? null,
      isRestaurantMeal: restaurantDays.has(r.date),
      waterMl: waterMap.get(r.date) ?? 0,
    }));
  } catch {
    return [];
  }
}

// ── Fasting data (ft_ tables) ────────────────────────────────────────

export function getFastingDays(db: DatabaseAdapter, dayCount: number): DayFastingData[] {
  try {
    if (!tableExists(db, 'ft_fasts')) return [];

    const rows = db.query<{
      date: string;
      didFast: number;
    }>(
      `SELECT
        date(started_at) as date,
        1 as didFast
      FROM ft_fasts
      WHERE date(started_at) >= date('now', '-' || ? || ' days')
        AND completed_at IS NOT NULL
      GROUP BY date(started_at)`,
      [dayCount],
    );

    // Get first meal nutrition on fasting days
    const firstMeals = db.query<{
      date: string;
      breakfastProteinG: number;
      breakfastCalories: number;
    }>(
      `SELECT
        fl.date,
        SUM(fli.protein_g) as breakfastProteinG,
        SUM(fli.calories) as breakfastCalories
      FROM nu_food_log fl
      INNER JOIN nu_food_log_items fli ON fli.log_id = fl.id
      WHERE fl.date >= date('now', '-' || ? || ' days')
        AND fl.id = (
          SELECT id FROM nu_food_log fl2
          WHERE fl2.date = fl.date
          ORDER BY fl2.created_at ASC
          LIMIT 1
        )
      GROUP BY fl.date`,
      [dayCount],
    );
    const firstMealMap = new Map(firstMeals.map((m) => [m.date, m]));

    // Get calorie goal adherence
    const goalRows = db.query<{ calories: number }>(
      `SELECT calories FROM nu_daily_goals ORDER BY effective_date DESC LIMIT 1`,
    );
    const calorieGoal = goalRows.length > 0 ? goalRows[0].calories : null;

    const dailyCalories = db.query<{ date: string; total: number }>(
      `SELECT fl.date, SUM(fli.calories) as total
      FROM nu_food_log fl
      INNER JOIN nu_food_log_items fli ON fli.log_id = fl.id
      WHERE fl.date >= date('now', '-' || ? || ' days')
      GROUP BY fl.date`,
      [dayCount],
    );
    const calorieMap = new Map(dailyCalories.map((c) => [c.date, c.total]));

    return rows.map((r) => {
      const firstMeal = firstMealMap.get(r.date);
      return {
        date: r.date,
        didFast: true,
        breakfastProteinG: firstMeal?.breakfastProteinG ?? null,
        breakfastCalories: firstMeal?.breakfastCalories ?? null,
        wasUnderCalorieGoal: calorieGoal !== null
          ? (calorieMap.get(r.date) ?? 0) <= calorieGoal
          : false,
      };
    });
  } catch {
    return [];
  }
}

// ── Workout data (wk_ tables, if available locally) ──────────────────

export function getWorkoutDays(db: DatabaseAdapter, dayCount: number): DayWorkoutData[] {
  try {
    // Workouts stores live sessions in wk_workout_sessions and quick logs in
    // wk_workout_logs; a day counts as trained if either has a row.
    const hasSessions = tableExists(db, 'wk_workout_sessions');
    const hasLogs = tableExists(db, 'wk_workout_logs');
    if (!hasSessions && !hasLogs) return [];

    const workoutDates = new Set<string>();
    if (hasSessions) {
      const rows = db.query<{ date: string }>(
        `SELECT DISTINCT date(started_at) as date
        FROM wk_workout_sessions
        WHERE date(started_at) >= date('now', '-' || ? || ' days')`,
        [dayCount],
      );
      for (const r of rows) workoutDates.add(r.date);
    }
    if (hasLogs) {
      const rows = db.query<{ date: string }>(
        `SELECT DISTINCT date(completed_at) as date
        FROM wk_workout_logs
        WHERE date(completed_at) >= date('now', '-' || ? || ' days')`,
        [dayCount],
      );
      for (const r of rows) workoutDates.add(r.date);
    }

    // Build full day list
    const result: DayWorkoutData[] = [];
    const today = new Date();
    for (let i = 0; i < dayCount; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      result.push({ date: dateStr, didWorkout: workoutDates.has(dateStr) });
    }

    return result;
  } catch {
    return [];
  }
}

// ── Mood/energy data (mo_ tables) ────────────────────────────────────

export function getMoodDays(db: DatabaseAdapter, dayCount: number): DayMoodData[] {
  try {
    if (!tableExists(db, 'mo_entries')) return [];

    const rows = db.query<{ date: string; avgScore: number }>(
      `SELECT
        date(created_at) as date,
        AVG(score) as avgScore
      FROM mo_entries
      WHERE date(created_at) >= date('now', '-' || ? || ' days')
      GROUP BY date(created_at)`,
      [dayCount],
    );

    return rows.map((r) => ({
      date: r.date,
      energyScore: r.avgScore,
    }));
  } catch {
    return [];
  }
}

// ── Get calorie goal ─────────────────────────────────────────────────

export function getCalorieGoal(db: DatabaseAdapter): number | null {
  try {
    const rows = db.query<{ calories: number }>(
      `SELECT calories FROM nu_daily_goals ORDER BY effective_date DESC LIMIT 1`,
    );
    return rows.length > 0 ? rows[0].calories : null;
  } catch {
    return null;
  }
}
