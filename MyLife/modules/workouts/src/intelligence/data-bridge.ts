/**
 * Cross-module data bridge for the Workout Intelligence Engine.
 * Reads data from other modules' SQLite tables with graceful degradation.
 * Pattern: follows nutrition/engine/data-bridge.ts (table-existence guards, null returns).
 */

import type { DatabaseAdapter } from '@mylife/db';
import type { DayWorkoutData, DayMoodData, DayNutritionData, DayFastingData } from './types';

// ── Table existence check ────────────────────────────────────────────

function tableExists(db: DatabaseAdapter, tableName: string): boolean {
  const result = db.query<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
    [tableName],
  );
  return result.length > 0;
}

// ── Workout data (own tables: wk_) ──────────────────────────────────

export function getWorkoutDays(db: DatabaseAdapter, dayCount: number): DayWorkoutData[] {
  try {
    const rows = db.query<{
      date: string;
      totalSets: number;
      totalReps: number;
      totalVolume: number;
      durationMinutes: number;
      startHour: number | null;
    }>(
      `SELECT
        date(s.started_at) as date,
        COALESCE(SUM(sw.reps), 0) as totalSets,
        COALESCE(SUM(sw.reps), 0) as totalReps,
        COALESCE(SUM(sw.weight * sw.reps), 0) as totalVolume,
        COALESCE(
          SUM(
            CASE WHEN s.completed_at IS NOT NULL
            THEN (julianday(s.completed_at) - julianday(s.started_at)) * 24.0 * 60.0
            ELSE 0 END
          ), 0
        ) as durationMinutes,
        MIN(CAST(strftime('%H', s.started_at) AS INTEGER)) as startHour
      FROM wk_workout_sessions s
      LEFT JOIN wk_workout_set_weights sw ON sw.session_id = s.id
      WHERE s.completed_at IS NOT NULL
        AND date(s.started_at) >= date('now', '-' || ? || ' days')
      GROUP BY date(s.started_at)
      ORDER BY date ASC`,
      [dayCount],
    );

    // Build full day list so non-workout days are represented
    const workoutMap = new Map(rows.map((r) => [r.date, r]));
    const result: DayWorkoutData[] = [];
    const today = new Date();
    for (let i = dayCount - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const row = workoutMap.get(dateStr);
      result.push({
        date: dateStr,
        didWorkout: !!row,
        totalSets: row?.totalSets ?? 0,
        totalReps: row?.totalReps ?? 0,
        totalVolumeLbs: row?.totalVolume ?? 0,
        durationMinutes: row ? Math.max(0, Math.round(row.durationMinutes)) : 0,
        startHour: row?.startHour ?? null,
      });
    }

    return result;
  } catch {
    return [];
  }
}

// ── Mood data (mo_ tables) ──────────────────────────────────────────

export function getMoodDays(db: DatabaseAdapter, dayCount: number): DayMoodData[] {
  try {
    if (!tableExists(db, 'mo_entries')) return [];

    const rows = db.query<{ date: string; avgScore: number }>(
      `SELECT
        date(created_at) as date,
        AVG(score) as avgScore
      FROM mo_entries
      WHERE date(created_at) >= date('now', '-' || ? || ' days')
      GROUP BY date(created_at)
      ORDER BY date ASC`,
      [dayCount],
    );

    return rows.map((r) => ({ date: r.date, avgScore: r.avgScore }));
  } catch {
    return [];
  }
}

// ── Nutrition data (nu_ tables) ─────────────────────────────────────

export function getNutritionDays(db: DatabaseAdapter, dayCount: number): DayNutritionData[] {
  try {
    if (!tableExists(db, 'nu_food_log')) return [];

    const rows = db.query<{
      date: string;
      totalCalories: number;
      proteinG: number;
    }>(
      `SELECT
        fl.date,
        COALESCE(SUM(fli.calories), 0) as totalCalories,
        COALESCE(SUM(fli.protein_g), 0) as proteinG
      FROM nu_food_log fl
      LEFT JOIN nu_food_log_items fli ON fli.log_id = fl.id
      WHERE fl.date >= date('now', '-' || ? || ' days')
      GROUP BY fl.date
      ORDER BY fl.date ASC`,
      [dayCount],
    );

    return rows.map((r) => ({
      date: r.date,
      totalCalories: r.totalCalories,
      proteinG: r.proteinG,
    }));
  } catch {
    return [];
  }
}

// ── Fasting data (ft_ tables) ───────────────────────────────────────

export function getFastingDays(db: DatabaseAdapter, dayCount: number): DayFastingData[] {
  try {
    if (!tableExists(db, 'ft_fasts')) return [];

    const rows = db.query<{ date: string }>(
      `SELECT DISTINCT date(started_at) as date
      FROM ft_fasts
      WHERE completed_at IS NOT NULL
        AND date(started_at) >= date('now', '-' || ? || ' days')
      ORDER BY date ASC`,
      [dayCount],
    );

    const fastDates = new Set(rows.map((r) => r.date));
    const result: DayFastingData[] = [];
    const today = new Date();
    for (let i = dayCount - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      result.push({ date: dateStr, didFast: fastDates.has(dateStr) });
    }

    return result;
  } catch {
    return [];
  }
}
