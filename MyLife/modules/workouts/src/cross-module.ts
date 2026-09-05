/**
 * Cross-module interface implementation for MyWorkouts.
 *
 * Exposes workout data for hub-level search, dashboard summaries,
 * activity feeds, and cross-module correlation (volume + duration time series).
 */

import type { DatabaseAdapter } from '@mylife/db';
import type {
  CrossModuleInterface,
  SearchableItem,
  ModuleSummary,
  ActivityItem,
  CorrelationDataset,
  CorrelationDataPoint,
  TodayCard,
  TodayCardContext,
} from '@mylife/module-registry';

const MODULE_ID = 'workouts';

// ---------------------------------------------------------------------------
// Row types for raw SQL queries
// ---------------------------------------------------------------------------

interface ExerciseRow {
  id: string;
  name: string;
  description: string | null;
  category: string;
  muscle_groups_json: string | null;
  difficulty: string;
  updated_at?: string;
  created_at: string;
}

interface WorkoutRow {
  id: string;
  title: string;
  description: string | null;
  difficulty: string;
  exercises_json: string | null;
  estimated_duration: number;
  created_at: string;
}

interface PlanRow {
  id: string;
  title: string;
  description: string | null;
  updated_at: string;
  created_at: string;
}

interface SessionRow {
  id: string;
  workout_id: string;
  started_at: string;
  completed_at: string | null;
  exercises_completed_json: string | null;
  created_at: string;
}

interface CountRow {
  count: number;
}

interface PRRow {
  exercise_id: string;
  exercise_name: string;
  estimated_1rm: number;
  achieved_at: string;
}

interface DailyVolumeRow {
  dt: string;
  total_reps: number;
  total_sets: number;
}

interface DailyDurationRow {
  dt: string;
  total_minutes: number;
}

function parseJsonSafe<T>(value: unknown, fallback: T): T {
  if (typeof value !== 'string' || value.length === 0) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

// ---------------------------------------------------------------------------
// getSearchableContent
// ---------------------------------------------------------------------------

export function getSearchableContent(db: DatabaseAdapter): SearchableItem[] {
  const items: SearchableItem[] = [];

  // Exercise library
  const exercises = db.query<ExerciseRow>(
    `SELECT id, name, description, category, muscle_groups_json, difficulty, created_at
     FROM wk_exercises LIMIT 500`,
  );

  for (const ex of exercises) {
    const muscles = parseJsonSafe<string[]>(ex.muscle_groups_json, []);
    const tags = [ex.category, ex.difficulty, ...muscles].filter(Boolean);

    items.push({
      moduleId: MODULE_ID,
      type: 'exercise',
      title: ex.name,
      body: ex.description ?? undefined,
      tags: tags.length > 0 ? tags : undefined,
      itemId: ex.id,
      updatedAt: ex.created_at,
    });
  }

  // Workout definitions
  const workouts = db.query<WorkoutRow>(
    `SELECT id, title, description, difficulty, exercises_json, estimated_duration, created_at
     FROM wk_workouts LIMIT 500`,
  );

  for (const w of workouts) {
    const exerciseEntries = parseJsonSafe<{ name?: string }[]>(w.exercises_json, []);
    const exerciseNames = exerciseEntries
      .map((e) => e.name)
      .filter((n): n is string => !!n);
    const tags = [w.difficulty, ...exerciseNames].filter(Boolean);

    items.push({
      moduleId: MODULE_ID,
      type: 'workout',
      title: w.title,
      body: w.description ?? undefined,
      tags: tags.length > 0 ? tags : undefined,
      itemId: w.id,
      updatedAt: w.created_at,
    });
  }

  // Workout plans
  const plans = db.query<PlanRow>(
    `SELECT id, title, description, updated_at, created_at FROM wk_workout_plans LIMIT 200`,
  );

  for (const p of plans) {
    items.push({
      moduleId: MODULE_ID,
      type: 'plan',
      title: p.title,
      body: p.description ?? undefined,
      itemId: p.id,
      updatedAt: p.updated_at,
    });
  }

  return items;
}

// ---------------------------------------------------------------------------
// getDataSummary
// ---------------------------------------------------------------------------

export function getDataSummary(db: DatabaseAdapter): ModuleSummary {
  // Total workout definitions
  const totalRows = db.query<CountRow>(
    `SELECT COUNT(*) as count FROM wk_workouts`,
  );
  const totalItems = totalRows[0]?.count ?? 0;

  // Workouts completed this week (Mon-Sun)
  const weekRows = db.query<CountRow>(
    `SELECT COUNT(*) as count FROM wk_workout_sessions
     WHERE completed_at IS NOT NULL
       AND completed_at >= date('now', 'weekday 1', '-7 days')`,
  );
  const workoutsThisWeek = weekRows[0]?.count ?? 0;

  // Current streak
  const completedDates = db.query<{ dt: string }>(
    `SELECT DISTINCT DATE(completed_at) as dt FROM wk_workout_sessions
     WHERE completed_at IS NOT NULL
     ORDER BY dt DESC
     LIMIT 365`,
  );

  let currentStreak = 0;
  if (completedDates.length > 0) {
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    if (completedDates[0].dt === today || completedDates[0].dt === yesterday) {
      currentStreak = 1;
      for (let i = 1; i < completedDates.length; i++) {
        const prev = new Date(completedDates[i - 1].dt);
        const curr = new Date(completedDates[i].dt);
        const diff = Math.round((prev.getTime() - curr.getTime()) / 86400000);
        if (diff === 1) {
          currentStreak++;
        } else {
          break;
        }
      }
    }
  }

  // Total volume this week (reps from set weights)
  const volumeRows = db.query<{ total: number | null }>(
    `SELECT SUM(reps) as total FROM wk_workout_set_weights
     WHERE created_at >= date('now', 'weekday 1', '-7 days')`,
  );
  const totalVolumeThisWeek = volumeRows[0]?.total ?? 0;

  // Last workout date
  const lastRows = db.query<{ last_workout: string | null }>(
    `SELECT MAX(completed_at) as last_workout FROM wk_workout_sessions
     WHERE completed_at IS NOT NULL`,
  );
  const lastActivity = lastRows[0]?.last_workout ?? undefined;

  return {
    moduleId: MODULE_ID,
    totalItems,
    stats: {
      workoutsThisWeek,
      currentStreak,
      totalVolumeThisWeek,
    },
    lastActivity,
  };
}

// ---------------------------------------------------------------------------
// getActivityFeed
// ---------------------------------------------------------------------------

export function getActivityFeed(db: DatabaseAdapter, since: Date): ActivityItem[] {
  const sinceISO = since.toISOString();
  const items: ActivityItem[] = [];

  // Completed workout sessions
  const sessions = db.query<SessionRow & { workout_title: string }>(
    `SELECT s.id, s.workout_id, s.started_at, s.completed_at,
            s.exercises_completed_json, s.created_at,
            w.title as workout_title
     FROM wk_workout_sessions s
     JOIN wk_workouts w ON s.workout_id = w.id
     WHERE s.completed_at IS NOT NULL AND s.completed_at >= ?
     ORDER BY s.completed_at DESC`,
    [sinceISO],
  );

  for (const session of sessions) {
    const exercisesCompleted = parseJsonSafe<{ exerciseId?: string; exercise_id?: string }[]>(
      session.exercises_completed_json, [],
    );
    const exerciseCount = exercisesCompleted.length;
    const durationMinutes = session.completed_at && session.started_at
      ? Math.round(
          (new Date(session.completed_at).getTime() - new Date(session.started_at).getTime())
          / 60000,
        )
      : 0;

    let description = `Completed "${session.workout_title}"`;
    if (exerciseCount > 0 && durationMinutes > 0) {
      description += ` (${exerciseCount} exercises, ${durationMinutes}min)`;
    } else if (durationMinutes > 0) {
      description += ` (${durationMinutes}min)`;
    }

    items.push({
      moduleId: MODULE_ID,
      action: 'completed',
      description,
      timestamp: session.completed_at!,
      itemId: session.workout_id,
      itemType: 'workout',
    });
  }

  // New 1RM personal records
  const prs = db.query<PRRow>(
    `SELECT h.exercise_id, e.name as exercise_name, h.estimated_1rm, h.achieved_at
     FROM wk_exercise_1rm_history h
     JOIN wk_exercises e ON h.exercise_id = e.id
     WHERE h.achieved_at >= ?
     ORDER BY h.achieved_at DESC
     LIMIT 200`,
    [sinceISO],
  );

  for (const pr of prs) {
    items.push({
      moduleId: MODULE_ID,
      action: 'pr',
      description: `New PR: ${pr.exercise_name} (est. 1RM: ${Math.round(pr.estimated_1rm)})`,
      timestamp: pr.achieved_at,
      itemId: pr.exercise_id,
      itemType: 'exercise',
    });
  }

  // Sort all items by timestamp descending
  items.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  return items;
}

// ---------------------------------------------------------------------------
// getCorrelationData
// ---------------------------------------------------------------------------

export function getCorrelationData(db: DatabaseAdapter): CorrelationDataset {
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  const sinceISO = ninetyDaysAgo.toISOString();

  // Daily workout volume (total reps from set weights)
  const volumeDays = db.query<DailyVolumeRow>(
    `SELECT DATE(created_at) as dt,
            SUM(reps) as total_reps,
            COUNT(DISTINCT set_number) as total_sets
     FROM wk_workout_set_weights
     WHERE created_at >= ?
     GROUP BY DATE(created_at)
     ORDER BY dt ASC`,
    [sinceISO],
  );

  const volumeData: CorrelationDataPoint[] = volumeDays.map((row) => ({
    date: row.dt,
    value: row.total_reps,
  }));

  // Daily workout duration (minutes from completed sessions)
  const durationDays = db.query<DailyDurationRow>(
    `SELECT DATE(completed_at) as dt,
            SUM((julianday(completed_at) - julianday(started_at)) * 24.0 * 60.0) as total_minutes
     FROM wk_workout_sessions
     WHERE completed_at IS NOT NULL AND completed_at >= ?
     GROUP BY DATE(completed_at)
     ORDER BY dt ASC`,
    [sinceISO],
  );

  const durationData: CorrelationDataPoint[] = durationDays.map((row) => ({
    date: row.dt,
    value: Math.max(0, Math.round(row.total_minutes)),
  }));

  return {
    moduleId: MODULE_ID,
    series: [
      {
        metric: 'workout_volume',
        label: 'Workout Volume',
        unit: 'reps',
        data: volumeData,
      },
      {
        metric: 'workout_duration',
        label: 'Workout Duration',
        unit: 'minutes',
        data: durationData,
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Assembled interface
// ---------------------------------------------------------------------------

function endOfUtcDay(now: Date): string {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1),
  ).toISOString();
}

function getTodayCards(db: DatabaseAdapter, context: TodayCardContext): TodayCard[] {
  const today = context.now.toISOString().slice(0, 10);

  const doneToday =
    db.query<{ n: number }>(
      `SELECT COUNT(*) as n FROM wk_workout_sessions
       WHERE completed_at IS NOT NULL AND date(completed_at) = ?`,
      [today],
    )[0]?.n ?? 0;

  const weekDays =
    db.query<{ n: number }>(
      `SELECT COUNT(DISTINCT date(completed_at)) as n FROM wk_workout_sessions
       WHERE completed_at IS NOT NULL AND date(completed_at) >= date(?, '-6 days')`,
      [today],
    )[0]?.n ?? 0;

  const expiresAt = endOfUtcDay(context.now);

  if (doneToday > 0) {
    return [
      {
        id: `workouts.trained.${today}`,
        moduleId: MODULE_ID,
        kind: 'progress',
        priority: 45,
        title: 'Workout logged today',
        subtitle: `${weekDays} training day${weekDays === 1 ? '' : 's'} in the last 7`,
        cta: { label: 'View history', route: '/workouts/history' },
        dismissible: true,
        expiresAt,
      },
    ];
  }

  return [
    {
      id: `workouts.train-today.${today}`,
      moduleId: MODULE_ID,
      kind: 'action',
      priority: 70,
      title: 'Train today',
      subtitle:
        weekDays > 0
          ? `${weekDays} of the last 7 days trained`
          : 'No sessions yet this week',
      cta: { label: 'Start a session', route: '/workouts' },
      dismissible: true,
      expiresAt,
    },
  ];
}

export const workoutsCrossModule: CrossModuleInterface = {
  getSearchableContent: (db) => getSearchableContent(db as DatabaseAdapter),
  getDataSummary: (db) => getDataSummary(db as DatabaseAdapter),
  getActivityFeed: (db, since) => getActivityFeed(db as DatabaseAdapter, since),
  getCorrelationData: (db) => getCorrelationData(db as DatabaseAdapter),
  getTodayCards: (db, context) => getTodayCards(db as DatabaseAdapter, context),
};
