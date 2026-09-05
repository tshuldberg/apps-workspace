'use server';

import { getAdapter, ensureModuleMigrations } from '@/lib/db';
import { getEnabledModules } from '@mylife/db';

export interface TrainingFuelDay {
  /** ISO date (YYYY-MM-DD). */
  date: string;
  trained: boolean;
  /** null when nutrition is disabled or nothing was logged that day. */
  kcal: number | null;
  proteinG: number | null;
  /** null when meds is disabled or no doses were logged that day. */
  dosesTaken: number | null;
  dosesLogged: number | null;
}

export interface TrainingFuelReport {
  rangeDays: number;
  workoutsEnabled: boolean;
  nutritionEnabled: boolean;
  medsEnabled: boolean;
  /** Oldest first, exactly rangeDays entries ending today. */
  days: TrainingFuelDay[];
  trainingDays: number;
  currentStreak: number;
  totalVolume: number;
  avgCalories: number | null;
  avgProtein: number | null;
  calorieGoal: number | null;
  /** % of logged days within 10% of the calorie goal. Null without goal/data. */
  calorieAdherencePct: number | null;
  /** % of logged doses in range marked taken or late. Null without data. */
  medsAdherencePct: number | null;
}

function tableExists(db: ReturnType<typeof getAdapter>, name: string): boolean {
  return (
    db.query<{ name: string }>(
      `SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`,
      [name],
    ).length > 0
  );
}

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

/**
 * Compose the cross-module self-report: training days, fuel (calories +
 * protein vs goal), and dose adherence over one window. Reads only real
 * rows from enabled modules; a disabled module renders as absent, never as
 * zeros pretending to be data.
 */
export async function fetchTrainingFuelReport(rangeDays: number): Promise<TrainingFuelReport> {
  const range = rangeDays === 30 ? 30 : 7;
  const db = getAdapter();
  const enabled = new Set(getEnabledModules(db).map((row) => row.module_id));

  const workoutsEnabled = enabled.has('workouts');
  const nutritionEnabled = enabled.has('nutrition');
  const medsEnabled = enabled.has('meds');

  for (const id of ['workouts', 'nutrition', 'meds'] as const) {
    if (enabled.has(id)) {
      try {
        ensureModuleMigrations(id);
      } catch {
        /* a broken module must not blank the whole report */
      }
    }
  }

  const startDate = isoDaysAgo(range - 1);

  // Trained days: union of live sessions and quick logs.
  const trainedDays = new Set<string>();
  if (workoutsEnabled && tableExists(db, 'wk_workout_sessions')) {
    for (const row of db.query<{ date: string }>(
      `SELECT DISTINCT date(completed_at) as date FROM wk_workout_sessions
       WHERE completed_at IS NOT NULL AND date(completed_at) >= ?`,
      [startDate],
    )) {
      trainedDays.add(row.date);
    }
  }
  if (workoutsEnabled && tableExists(db, 'wk_workout_logs')) {
    for (const row of db.query<{ date: string }>(
      `SELECT DISTINCT date(completed_at) as date FROM wk_workout_logs
       WHERE date(completed_at) >= ?`,
      [startDate],
    )) {
      trainedDays.add(row.date);
    }
  }

  let totalVolume = 0;
  if (workoutsEnabled && tableExists(db, 'wk_workout_set_weights')) {
    totalVolume =
      db.query<{ volume: number }>(
        `SELECT COALESCE(SUM(weight * reps), 0) as volume FROM wk_workout_set_weights
         WHERE date(created_at) >= ?`,
        [startDate],
      )[0]?.volume ?? 0;
  }

  // Fuel per day.
  const kcalByDay = new Map<string, { kcal: number; protein: number }>();
  if (nutritionEnabled && tableExists(db, 'nu_food_log')) {
    for (const row of db.query<{ date: string; kcal: number; protein: number }>(
      `SELECT l.date as date,
              COALESCE(SUM(i.calories), 0) as kcal,
              COALESCE(SUM(i.protein_g), 0) as protein
       FROM nu_food_log l
       JOIN nu_food_log_items i ON i.log_id = l.id
       WHERE l.date >= ?
       GROUP BY l.date`,
      [startDate],
    )) {
      kcalByDay.set(row.date, { kcal: row.kcal, protein: row.protein });
    }
  }

  let calorieGoal: number | null = null;
  if (nutritionEnabled && tableExists(db, 'nu_daily_goals')) {
    calorieGoal =
      db.query<{ calories: number }>(
        `SELECT calories FROM nu_daily_goals ORDER BY effective_date DESC LIMIT 1`,
      )[0]?.calories ?? null;
  }

  // Doses per day (logged doses only; the regimen engine owns today's due list).
  const dosesByDay = new Map<string, { taken: number; logged: number }>();
  if (medsEnabled && tableExists(db, 'md_dose_logs')) {
    for (const row of db.query<{ date: string; taken: number; logged: number }>(
      `SELECT date(scheduled_time) as date,
              SUM(CASE WHEN status IN ('taken', 'late') THEN 1 ELSE 0 END) as taken,
              COUNT(*) as logged
       FROM md_dose_logs
       WHERE date(scheduled_time) >= ?
       GROUP BY date(scheduled_time)`,
      [startDate],
    )) {
      dosesByDay.set(row.date, { taken: row.taken, logged: row.logged });
    }
  }

  // Assemble the day list, oldest first.
  const days: TrainingFuelDay[] = [];
  for (let i = range - 1; i >= 0; i--) {
    const date = isoDaysAgo(i);
    const fuel = kcalByDay.get(date);
    const doses = dosesByDay.get(date);
    days.push({
      date,
      trained: trainedDays.has(date),
      kcal: nutritionEnabled ? (fuel ? Math.round(fuel.kcal) : null) : null,
      proteinG: nutritionEnabled ? (fuel ? Math.round(fuel.protein) : null) : null,
      dosesTaken: medsEnabled ? (doses ? doses.taken : null) : null,
      dosesLogged: medsEnabled ? (doses ? doses.logged : null) : null,
    });
  }

  // Current streak: consecutive trained days ending today or yesterday.
  let currentStreak = 0;
  for (let i = 0; i < range; i++) {
    const date = isoDaysAgo(i);
    if (trainedDays.has(date)) {
      currentStreak++;
    } else if (i === 0) {
      // Today untrained does not break a streak that ended yesterday.
      continue;
    } else {
      break;
    }
  }

  const loggedFuelDays = days.filter((d) => d.kcal !== null);
  const avgCalories =
    loggedFuelDays.length > 0
      ? Math.round(loggedFuelDays.reduce((sum, d) => sum + (d.kcal ?? 0), 0) / loggedFuelDays.length)
      : null;
  const avgProtein =
    loggedFuelDays.length > 0
      ? Math.round(loggedFuelDays.reduce((sum, d) => sum + (d.proteinG ?? 0), 0) / loggedFuelDays.length)
      : null;

  let calorieAdherencePct: number | null = null;
  if (calorieGoal !== null && loggedFuelDays.length > 0) {
    const within = loggedFuelDays.filter(
      (d) => Math.abs((d.kcal ?? 0) - calorieGoal) <= calorieGoal * 0.1,
    ).length;
    calorieAdherencePct = Math.round((within / loggedFuelDays.length) * 100);
  }

  let medsAdherencePct: number | null = null;
  const doseTotals = [...dosesByDay.values()].reduce(
    (acc, d) => ({ taken: acc.taken + d.taken, logged: acc.logged + d.logged }),
    { taken: 0, logged: 0 },
  );
  if (doseTotals.logged > 0) {
    medsAdherencePct = Math.round((doseTotals.taken / doseTotals.logged) * 100);
  }

  return {
    rangeDays: range,
    workoutsEnabled,
    nutritionEnabled,
    medsEnabled,
    days,
    trainingDays: days.filter((d) => d.trained).length,
    currentStreak,
    totalVolume: Math.round(totalVolume),
    avgCalories,
    avgProtein,
    calorieGoal,
    calorieAdherencePct,
    medsAdherencePct,
  };
}
