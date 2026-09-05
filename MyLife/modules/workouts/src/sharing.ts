/**
 * Workout sharing: builds a WorkoutSummaryCard from session data.
 * Used for both share cards (WO-021) and social feed posts (WO-023).
 */

import type { DatabaseAdapter } from '@mylife/db';
import type { MuscleGroup, WorkoutSummaryCard } from './types';

interface SetWeightRow {
  exercise_id: string;
  weight: number;
  reps: number;
  estimated_1rm: number;
}

interface ExerciseInfoRow {
  id: string;
  name: string;
  muscle_groups_json: string;
}

interface PRRow {
  exercise_id: string;
  exercise_name: string;
  estimated_1rm: number;
}

function parseJsonSafe<T>(value: unknown, fallback: T): T {
  if (typeof value !== 'string' || value.length === 0) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

/**
 * Build a workout summary card from a completed session.
 * Aggregates volume, detects PRs, and collects muscle groups.
 */
export function buildWorkoutSummary(
  db: DatabaseAdapter,
  sessionId: string,
): WorkoutSummaryCard | null {
  // Get session info
  const sessions = db.query<Record<string, unknown>>(
    `SELECT s.workout_id, s.started_at, s.completed_at, s.exercises_completed_json,
            w.title
     FROM wk_workout_sessions s
     JOIN wk_workouts w ON s.workout_id = w.id
     WHERE s.id = ?`,
    [sessionId],
  );
  if (sessions.length === 0) return null;

  const session = sessions[0];
  const title = (session.title as string) ?? 'Workout';
  const startedAt = session.started_at as string;
  const completedAt = session.completed_at as string | null;

  // Calculate duration
  let durationMinutes = 0;
  if (completedAt && startedAt) {
    durationMinutes = Math.round(
      (new Date(completedAt).getTime() - new Date(startedAt).getTime()) / 60000,
    );
  }

  // Get exercises completed
  const exercisesCompleted = parseJsonSafe<{ exercise_id?: string; exerciseId?: string }[]>(
    session.exercises_completed_json,
    [],
  );
  const exerciseCount = exercisesCompleted.length;

  // Get set weights for volume calculation
  const setWeights = db.query<SetWeightRow>(
    `SELECT exercise_id, weight, reps, estimated_1rm
     FROM wk_workout_set_weights WHERE session_id = ?`,
    [sessionId],
  );

  let totalSets = setWeights.length;
  let totalReps = 0;
  let totalVolume = 0;
  for (const sw of setWeights) {
    totalReps += sw.reps;
    totalVolume += sw.weight * sw.reps;
  }

  // If no set weights logged, fall back to exercises_completed data
  if (totalSets === 0 && exercisesCompleted.length > 0) {
    for (const ec of exercisesCompleted) {
      const setsCompleted = (ec as Record<string, unknown>).sets_completed ?? (ec as Record<string, unknown>).setsCompleted;
      const repsCompleted = (ec as Record<string, unknown>).reps_completed ?? (ec as Record<string, unknown>).repsCompleted;
      if (typeof setsCompleted === 'number') totalSets += setsCompleted;
      if (typeof repsCompleted === 'number') totalReps += repsCompleted;
    }
  }

  // Detect PRs: find 1RM records achieved during this session
  const exerciseIds = [
    ...new Set(
      exercisesCompleted
        .map((e) => e.exercise_id ?? e.exerciseId)
        .filter((id): id is string => !!id),
    ),
  ];

  const prsHit: { exerciseName: string; estimated1rm: number }[] = [];

  if (exerciseIds.length > 0 && completedAt) {
    // Get the latest 1RM for each exercise that was achieved around session time
    const placeholders = exerciseIds.map(() => '?').join(',');
    const prRows = db.query<PRRow>(
      `SELECT h.exercise_id, e.name as exercise_name, h.estimated_1rm
       FROM wk_exercise_1rm_history h
       JOIN wk_exercises e ON h.exercise_id = e.id
       WHERE h.exercise_id IN (${placeholders})
         AND h.achieved_at >= ? AND h.achieved_at <= ?
       ORDER BY h.estimated_1rm DESC`,
      [...exerciseIds, startedAt, completedAt],
    );

    // Dedupe by exercise (take highest)
    const seen = new Set<string>();
    for (const pr of prRows) {
      if (!seen.has(pr.exercise_id)) {
        seen.add(pr.exercise_id);
        prsHit.push({
          exerciseName: pr.exercise_name,
          estimated1rm: Math.round(pr.estimated_1rm),
        });
      }
    }
  }

  // Cap PR display at 3 with overflow indication
  const prsDisplay = prsHit.length > 3
    ? [...prsHit.slice(0, 3), { exerciseName: `+${prsHit.length - 3} more`, estimated1rm: 0 }]
    : prsHit;

  // Collect muscle groups from all exercises
  const muscleGroups: MuscleGroup[] = [];
  if (exerciseIds.length > 0) {
    const placeholders = exerciseIds.map(() => '?').join(',');
    const exerciseRows = db.query<ExerciseInfoRow>(
      `SELECT id, name, muscle_groups_json FROM wk_exercises WHERE id IN (${placeholders})`,
      exerciseIds,
    );
    const seen = new Set<string>();
    for (const row of exerciseRows) {
      const groups = parseJsonSafe<MuscleGroup[]>(row.muscle_groups_json, []);
      for (const g of groups) {
        if (!seen.has(g)) {
          seen.add(g);
          muscleGroups.push(g);
        }
      }
    }
  }

  // Truncate title
  const displayTitle = title.length > 40 ? title.slice(0, 37) + '...' : title;

  return {
    sessionId,
    title: displayTitle,
    date: completedAt ?? startedAt,
    durationMinutes: Math.max(0, durationMinutes),
    exerciseCount,
    totalSets,
    totalReps,
    totalVolume: Math.round(totalVolume),
    prsHit: prsDisplay,
    muscleGroups,
  };
}
