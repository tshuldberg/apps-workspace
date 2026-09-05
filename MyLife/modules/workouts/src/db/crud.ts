import type { DatabaseAdapter } from '@mylife/db';
import type {
  BodyMeasurementInput,
  BodyMeasurementRow,
  CompletedExercise,
  Exercise1RMRow,
  ExercisePerformanceHistory,
  ExerciseVideo,
  ExerciseVideoInput,
  GenerationHistoryEntry,
  GpsPoint,
  GpsPointInput,
  GpsRoute,
  MuscleGroup,
  OverloadRule,
  PlanSubscriptionRow,
  PreviousPerformanceMap,
  Record1RMInput,
  SetData,
  SetWeightInput,
  SetWeightRow,
  Trainer,
  VideoAngle,
  WeightUnit,
  WorkoutAudioCue,
  WorkoutCategory,
  WorkoutCategoryCount,
  WorkoutDashboard,
  WorkoutDefinition,
  WorkoutDifficulty,
  WorkoutExerciseEntry,
  WorkoutExerciseFilters,
  WorkoutExerciseLibraryItem,
  WorkoutFocus,
  WorkoutFormRecording,
  WorkoutLog,
  WorkoutMetrics,
  WorkoutPlan,
  WorkoutPlanInput,
  WorkoutPlanWeek,
  WorkoutProgram,
  WorkoutSeedItem,
  WorkoutSession,
  PlateInventory,
  PlateInventoryInput,
  ProgressPhoto,
  ProgressPhotoInput,
  PhotoViewType,
  StorageType,
} from '../types';
import seedExercisesRaw from '../data/exercise-seed.json';

const seedExercises = seedExercisesRaw as WorkoutSeedItem[];

function nowIso(): string {
  return new Date().toISOString();
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function escapeLike(value: string): string {
  return value.replace(/[%_]/g, '\\$&');
}

function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== 'string' || value.length === 0) {
    return fallback;
  }
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function rowToExercise(row: Record<string, unknown>): WorkoutExerciseLibraryItem {
  return {
    id: row.id as string,
    name: row.name as string,
    description: (row.description as string) ?? '',
    category: row.category as WorkoutCategory,
    muscleGroups: parseJson<MuscleGroup[]>(row.muscle_groups_json, []),
    difficulty: row.difficulty as WorkoutDifficulty,
    defaultSets: row.default_sets as number,
    defaultReps: (row.default_reps as number | null) ?? null,
    defaultDuration: (row.default_duration as number | null) ?? null,
    videoUrl: (row.video_url as string | null) ?? null,
    thumbnailUrl: (row.thumbnail_url as string | null) ?? null,
    audioCues: parseJson<WorkoutAudioCue[]>(row.audio_cues_json, []),
    isPremium: !!(row.is_premium as number),
    createdAt: row.created_at as string,
  };
}

function rowToWorkout(row: Record<string, unknown>): WorkoutDefinition {
  return {
    id: row.id as string,
    title: row.title as string,
    description: (row.description as string) ?? '',
    difficulty: row.difficulty as WorkoutDifficulty,
    exercises: parseJson<WorkoutExerciseEntry[]>(row.exercises_json, []),
    estimatedDuration: row.estimated_duration as number,
    isPremium: !!(row.is_premium as number),
    createdAt: row.created_at as string,
  };
}

function rowToSession(row: Record<string, unknown>): WorkoutSession {
  return {
    id: row.id as string,
    workoutId: row.workout_id as string,
    title: (row.title as string | null) ?? null,
    notes: (row.notes as string | null) ?? null,
    startedAt: row.started_at as string,
    completedAt: (row.completed_at as string | null) ?? null,
    exercisesCompleted: parseJson<CompletedExercise[]>(row.exercises_completed_json, []),
    voiceCommandsUsed: parseJson<WorkoutSession['voiceCommandsUsed']>(row.voice_commands_used_json, []),
    paceAdjustments: parseJson<WorkoutSession['paceAdjustments']>(row.pace_adjustments_json, []),
    createdAt: row.created_at as string,
  };
}

function rowToRecording(row: Record<string, unknown>): WorkoutFormRecording {
  return {
    id: row.id as string,
    sessionId: row.session_id as string,
    exerciseId: row.exercise_id as string,
    videoUrl: row.video_url as string,
    timestampStart: row.timestamp_start as number,
    timestampEnd: row.timestamp_end as number,
    coachFeedback: parseJson<WorkoutFormRecording['coachFeedback']>(row.coach_feedback_json, []),
    createdAt: row.created_at as string,
  };
}

function estimateDurationSeconds(exercises: WorkoutExerciseEntry[]): number {
  let total = 0;
  for (const exercise of exercises) {
    const reps = exercise.reps ?? 10;
    const duration = exercise.duration ?? reps * 3;
    total += duration * exercise.sets;
    if (exercise.sets > 1) {
      total += exercise.restAfter * (exercise.sets - 1);
    }
  }
  return Math.max(0, Math.round(total));
}

export function seedWorkoutExerciseLibrary(db: DatabaseAdapter): number {
  const existing = db.query<{ c: number }>('SELECT COUNT(*) as c FROM wk_exercises')[0]?.c ?? 0;
  if (existing > 0) {
    return 0;
  }

  const createdAt = nowIso();
  db.transaction(() => {
    seedExercises.forEach((item, index) => {
      const id = `seed-${slugify(item.name)}-${index + 1}`;
      const audioCues: WorkoutAudioCue[] = [
        {
          timestamp: 0,
          text: item.audioCueText,
          type: 'instruction',
        },
      ];
      db.execute(
        `INSERT INTO wk_exercises (
          id, name, description, category, muscle_groups_json, difficulty,
          audio_cues_json, default_sets, default_reps, default_duration,
          is_premium, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          item.name,
          item.description,
          item.category,
          JSON.stringify(item.muscleGroups),
          item.difficulty,
          JSON.stringify(audioCues),
          item.defaultSets,
          item.defaultReps,
          item.defaultDuration ?? null,
          0,
          createdAt,
        ],
      );
    });
  });

  return seedExercises.length;
}

export function getWorkoutExercises(
  db: DatabaseAdapter,
  filters?: WorkoutExerciseFilters,
): WorkoutExerciseLibraryItem[] {
  const where: string[] = [];
  const params: unknown[] = [];

  if (filters?.search) {
    const token = `%${escapeLike(filters.search.toLowerCase())}%`;
    where.push("(LOWER(name) LIKE ? ESCAPE '\\' OR LOWER(description) LIKE ? ESCAPE '\\')");
    params.push(token, token);
  }

  if (filters?.category) {
    where.push('category = ?');
    params.push(filters.category);
  }

  if (filters?.difficulty) {
    where.push('difficulty = ?');
    params.push(filters.difficulty);
  }

  const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
  const effectiveLimit = (filters?.limit && filters.limit > 0) ? filters.limit : 500;
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM wk_exercises ${whereClause} ORDER BY name ASC LIMIT ?`,
    [...params, effectiveLimit],
  );

  const base = rows.map(rowToExercise);
  const filtered = filters?.muscleGroups?.length
    ? base.filter((exercise) =>
        exercise.muscleGroups.some((group) => filters.muscleGroups?.includes(group)),
      )
    : base;

  return filtered;
}

export function getWorkoutExerciseById(
  db: DatabaseAdapter,
  id: string,
): WorkoutExerciseLibraryItem | null {
  const row = db
    .query<Record<string, unknown>>('SELECT * FROM wk_exercises WHERE id = ? LIMIT 1', [id])[0];
  return row ? rowToExercise(row) : null;
}

export function getWorkoutExerciseCount(db: DatabaseAdapter): number {
  return db.query<{ c: number }>('SELECT COUNT(*) as c FROM wk_exercises')[0]?.c ?? 0;
}

export function getWorkoutCategoryCounts(db: DatabaseAdapter): WorkoutCategoryCount[] {
  const rows = db.query<{ category: WorkoutCategory; c: number }>(
    `SELECT category, COUNT(*) as c
     FROM wk_exercises
     GROUP BY category
     ORDER BY category ASC`,
  );
  return rows.map((row) => ({ category: row.category, count: row.c }));
}

export function createWorkout(
  db: DatabaseAdapter,
  id: string,
  input: {
    title: string;
    description?: string;
    difficulty: WorkoutDifficulty;
    exercises: WorkoutExerciseEntry[];
    estimatedDuration?: number;
    isPremium?: boolean;
  },
): void {
  const exercises = input.exercises
    .map((exercise, index) => ({ ...exercise, order: index }))
    .sort((a, b) => a.order - b.order);
  db.execute(
    `INSERT INTO wk_workouts (
      id, title, description, difficulty, exercises_json,
      estimated_duration, is_premium, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.title,
      input.description ?? '',
      input.difficulty,
      JSON.stringify(exercises),
      input.estimatedDuration ?? estimateDurationSeconds(exercises),
      input.isPremium ? 1 : 0,
      nowIso(),
    ],
  );
}

export function updateWorkout(
  db: DatabaseAdapter,
  id: string,
  input: {
    title: string;
    description?: string;
    difficulty: WorkoutDifficulty;
    exercises: WorkoutExerciseEntry[];
    estimatedDuration?: number;
    isPremium?: boolean;
  },
): void {
  const exercises = input.exercises
    .map((exercise, index) => ({ ...exercise, order: index }))
    .sort((a, b) => a.order - b.order);

  db.execute(
    `UPDATE wk_workouts
     SET title = ?, description = ?, difficulty = ?, exercises_json = ?,
         estimated_duration = ?, is_premium = ?
     WHERE id = ?`,
    [
      input.title,
      input.description ?? '',
      input.difficulty,
      JSON.stringify(exercises),
      input.estimatedDuration ?? estimateDurationSeconds(exercises),
      input.isPremium ? 1 : 0,
      id,
    ],
  );
}

export function deleteWorkout(db: DatabaseAdapter, id: string): void {
  db.execute('DELETE FROM wk_workouts WHERE id = ?', [id]);
}

export function getWorkouts(
  db: DatabaseAdapter,
  options?: {
    search?: string;
    difficulty?: WorkoutDifficulty | null;
    limit?: number;
  },
): WorkoutDefinition[] {
  const where: string[] = [];
  const params: unknown[] = [];

  if (options?.search) {
    const token = `%${escapeLike(options.search.toLowerCase())}%`;
    where.push("(LOWER(title) LIKE ? ESCAPE '\\' OR LOWER(description) LIKE ? ESCAPE '\\')");
    params.push(token, token);
  }

  if (options?.difficulty) {
    where.push('difficulty = ?');
    params.push(options.difficulty);
  }

  let sql = `SELECT * FROM wk_workouts`;
  if (where.length > 0) {
    sql += ` WHERE ${where.join(' AND ')}`;
  }
  sql += ' ORDER BY created_at DESC';

  if (options?.limit && options.limit > 0) {
    sql += ' LIMIT ?';
    params.push(options.limit);
  }

  return db.query<Record<string, unknown>>(sql, params).map(rowToWorkout);
}

export function getWorkoutById(
  db: DatabaseAdapter,
  id: string,
): WorkoutDefinition | null {
  const row = db
    .query<Record<string, unknown>>('SELECT * FROM wk_workouts WHERE id = ? LIMIT 1', [id])[0];
  return row ? rowToWorkout(row) : null;
}

export function createWorkoutSession(
  db: DatabaseAdapter,
  id: string,
  input: {
    workoutId: string;
    startedAt?: string;
    completedAt?: string | null;
    exercisesCompleted?: CompletedExercise[];
    voiceCommandsUsed?: WorkoutSession['voiceCommandsUsed'];
    paceAdjustments?: WorkoutSession['paceAdjustments'];
  },
): void {
  db.execute(
    `INSERT INTO wk_workout_sessions (
      id, workout_id, started_at, completed_at,
      exercises_completed_json, voice_commands_used_json,
      pace_adjustments_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.workoutId,
      input.startedAt ?? nowIso(),
      input.completedAt ?? null,
      JSON.stringify(input.exercisesCompleted ?? []),
      JSON.stringify(input.voiceCommandsUsed ?? []),
      JSON.stringify(input.paceAdjustments ?? []),
      nowIso(),
    ],
  );
}

export function completeWorkoutSession(
  db: DatabaseAdapter,
  id: string,
  input: {
    completedAt?: string;
    exercisesCompleted: CompletedExercise[];
    voiceCommandsUsed?: WorkoutSession['voiceCommandsUsed'];
    paceAdjustments?: WorkoutSession['paceAdjustments'];
  },
): void {
  db.execute(
    `UPDATE wk_workout_sessions
     SET completed_at = ?, exercises_completed_json = ?,
         voice_commands_used_json = ?, pace_adjustments_json = ?
     WHERE id = ?`,
    [
      input.completedAt ?? nowIso(),
      JSON.stringify(input.exercisesCompleted),
      JSON.stringify(input.voiceCommandsUsed ?? []),
      JSON.stringify(input.paceAdjustments ?? []),
      id,
    ],
  );
}

export function annotateWorkoutSession(
  db: DatabaseAdapter,
  id: string,
  input: {
    title?: string | null;
    notes?: string | null;
  },
): void {
  const sets: string[] = [];
  const params: unknown[] = [];

  if ('title' in input) {
    sets.push('title = ?');
    params.push(input.title ?? null);
  }
  if ('notes' in input) {
    sets.push('notes = ?');
    params.push(input.notes ?? null);
  }

  if (sets.length === 0) {
    return;
  }

  params.push(id);
  db.execute(
    `UPDATE wk_workout_sessions SET ${sets.join(', ')} WHERE id = ?`,
    params,
  );
}

export function getWorkoutSessions(
  db: DatabaseAdapter,
  options?: {
    workoutId?: string;
    onlyCompleted?: boolean;
    limit?: number;
  },
): WorkoutSession[] {
  const where: string[] = [];
  const params: unknown[] = [];

  if (options?.workoutId) {
    where.push('workout_id = ?');
    params.push(options.workoutId);
  }

  if (options?.onlyCompleted) {
    where.push('completed_at IS NOT NULL');
  }

  let sql = 'SELECT * FROM wk_workout_sessions';
  if (where.length > 0) {
    sql += ` WHERE ${where.join(' AND ')}`;
  }

  sql += ' ORDER BY COALESCE(completed_at, started_at) DESC LIMIT ?';
  params.push((options?.limit && options.limit > 0) ? options.limit : 500);

  return db.query<Record<string, unknown>>(sql, params).map(rowToSession);
}

/**
 * Delete a completed or in-progress session and every row that hangs off it.
 *
 * The schema declares `ON DELETE CASCADE` on `wk_workout_set_weights` and
 * `wk_form_recordings` and `ON DELETE SET NULL` on `wk_gps_routes`, but that
 * only fires when `PRAGMA foreign_keys = ON`, which is not guaranteed on every
 * host connection (expo-sqlite defaults it off). We clean the children
 * explicitly inside a transaction so the delete is correct regardless of the
 * foreign-key pragma state.
 */
export function deleteWorkoutSession(db: DatabaseAdapter, id: string): void {
  db.transaction(() => {
    db.execute('DELETE FROM wk_workout_set_weights WHERE session_id = ?', [id]);
    db.execute('DELETE FROM wk_form_recordings WHERE session_id = ?', [id]);
    db.execute('UPDATE wk_gps_routes SET session_id = NULL WHERE session_id = ?', [id]);
    db.execute('DELETE FROM wk_workout_sessions WHERE id = ?', [id]);
  });
}

export function createWorkoutFormRecording(
  db: DatabaseAdapter,
  id: string,
  input: {
    sessionId: string;
    exerciseId: string;
    videoUrl: string;
    timestampStart: number;
    timestampEnd: number;
    coachFeedback?: WorkoutFormRecording['coachFeedback'];
  },
): void {
  db.execute(
    `INSERT INTO wk_form_recordings (
      id, session_id, exercise_id, video_url,
      timestamp_start, timestamp_end, coach_feedback_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.sessionId,
      input.exerciseId,
      input.videoUrl,
      input.timestampStart,
      input.timestampEnd,
      JSON.stringify(input.coachFeedback ?? []),
      nowIso(),
    ],
  );
}

export function getWorkoutFormRecordings(
  db: DatabaseAdapter,
  options?: {
    sessionId?: string;
    limit?: number;
  },
): WorkoutFormRecording[] {
  const where: string[] = [];
  const params: unknown[] = [];

  if (options?.sessionId) {
    where.push('session_id = ?');
    params.push(options.sessionId);
  }

  let sql = 'SELECT * FROM wk_form_recordings';
  if (where.length > 0) {
    sql += ` WHERE ${where.join(' AND ')}`;
  }
  sql += ' ORDER BY created_at DESC LIMIT ?';
  params.push((options?.limit && options.limit > 0) ? options.limit : 200);

  return db.query<Record<string, unknown>>(sql, params).map(rowToRecording);
}

export function deleteWorkoutFormRecording(db: DatabaseAdapter, id: string): void {
  db.execute('DELETE FROM wk_form_recordings WHERE id = ?', [id]);
}

export function getWorkoutMetrics(
  db: DatabaseAdapter,
  days = 30,
): WorkoutMetrics {
  const sessionRow = db.query<{
    workouts: number;
    total_minutes: number | null;
  }>(
    `SELECT
      COUNT(*) as workouts,
      SUM((julianday(completed_at) - julianday(started_at)) * 24.0 * 60.0) as total_minutes
     FROM wk_workout_sessions
     WHERE completed_at IS NOT NULL
       AND completed_at >= datetime('now', ?)`,
    [`-${days} days`],
  )[0];

  const logRow = db.query<{
    total_calories: number | null;
    average_rpe: number | null;
  }>(
    `SELECT
      SUM(calories) as total_calories,
      AVG(rpe) as average_rpe
     FROM wk_workout_logs
     WHERE completed_at >= datetime('now', ?)`,
    [`-${days} days`],
  )[0];

  const totalMinutes = Math.max(0, Math.round(sessionRow?.total_minutes ?? 0));
  const estimatedCalories = Math.round(totalMinutes * 8.2);

  return {
    workouts: sessionRow?.workouts ?? 0,
    totalMinutes,
    totalCalories: (logRow?.total_calories ?? 0) || estimatedCalories,
    averageRpe: (logRow?.average_rpe ?? 0) || 7,
  };
}

function calculateCurrentStreak(sessions: WorkoutSession[]): number {
  const completedDates = Array.from(
    new Set(
      sessions
        .filter((session) => !!session.completedAt)
        .map((session) => (session.completedAt as string).slice(0, 10)),
    ),
  ).sort().reverse();

  if (completedDates.length === 0) return 0;

  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (completedDates[0] !== today && completedDates[0] !== yesterday) {
    return 0;
  }

  let streak = 1;
  for (let i = 1; i < completedDates.length; i += 1) {
    const prev = new Date(completedDates[i - 1]);
    const current = new Date(completedDates[i]);
    const diff = Math.round((prev.getTime() - current.getTime()) / 86400000);
    if (diff === 1) {
      streak += 1;
    } else {
      break;
    }
  }
  return streak;
}

export function getWorkoutDashboard(db: DatabaseAdapter): WorkoutDashboard {
  const exerciseCount = getWorkoutExerciseCount(db);
  const workouts = db.query<{ c: number }>('SELECT COUNT(*) as c FROM wk_workouts')[0]?.c ?? 0;
  const sessions = db.query<{ c: number }>('SELECT COUNT(*) as c FROM wk_workout_sessions')[0]?.c ?? 0;
  const sessions30d = getWorkoutMetrics(db, 30);
  const streakDays = calculateCurrentStreak(getWorkoutSessions(db, { onlyCompleted: true, limit: 365 }));

  return {
    workouts,
    exercises: exerciseCount,
    sessions,
    streakDays,
    totalMinutes30d: sessions30d.totalMinutes,
  };
}

// ── Set Weight Tracking ──

function rowToSetWeight(row: Record<string, unknown>): SetWeightRow {
  return {
    id: row.id as string,
    sessionId: row.session_id as string,
    exerciseId: row.exercise_id as string,
    setNumber: row.set_number as number,
    weight: row.weight as number,
    reps: row.reps as number,
    unit: row.unit as WeightUnit,
    estimated1rm: row.estimated_1rm as number,
    createdAt: row.created_at as string,
  };
}

export function recordSetWeight(
  db: DatabaseAdapter,
  id: string,
  input: SetWeightInput,
): void {
  db.execute(
    `INSERT INTO wk_workout_set_weights (
      id, session_id, exercise_id, set_number, weight, reps, unit, estimated_1rm, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.sessionId,
      input.exerciseId,
      input.setNumber,
      input.weight,
      input.reps,
      input.unit ?? 'lbs',
      input.estimated1rm ?? 0,
      nowIso(),
    ],
  );
}

export function getSetWeightsForSession(
  db: DatabaseAdapter,
  sessionId: string,
): SetWeightRow[] {
  return db
    .query<Record<string, unknown>>(
      'SELECT * FROM wk_workout_set_weights WHERE session_id = ? ORDER BY set_number ASC',
      [sessionId],
    )
    .map(rowToSetWeight);
}

export function getSetWeightsForExercise(
  db: DatabaseAdapter,
  exerciseId: string,
  options?: { limit?: number },
): SetWeightRow[] {
  const params: unknown[] = [exerciseId, (options?.limit && options.limit > 0) ? options.limit : 500];
  return db.query<Record<string, unknown>>(
    'SELECT * FROM wk_workout_set_weights WHERE exercise_id = ? ORDER BY created_at DESC LIMIT ?',
    params,
  ).map(rowToSetWeight);
}

// ── Previous Performance ──

/**
 * Get previous performance data for a workout.
 * Queries the most recent completed session of the same workout_id (excluding currentSessionId)
 * and returns a map of exerciseId -> setNumber -> { weight, reps, unit, estimated1rm }.
 */
export function getPreviousPerformance(
  db: DatabaseAdapter,
  workoutId: string,
  currentSessionId: string,
): PreviousPerformanceMap {
  const result: PreviousPerformanceMap = new Map();

  // Find the most recent completed session for this workout (excluding current)
  const sessions = db.query<{ id: string }>(
    `SELECT id FROM wk_workout_sessions
     WHERE workout_id = ? AND id != ? AND completed_at IS NOT NULL
     ORDER BY completed_at DESC
     LIMIT 1`,
    [workoutId, currentSessionId],
  );

  if (sessions.length === 0) return result;

  const previousSessionId = sessions[0].id;

  // Get all set weights for that session
  const rows = db.query<Record<string, unknown>>(
    `SELECT exercise_id, set_number, weight, reps, unit, estimated_1rm
     FROM wk_workout_set_weights
     WHERE session_id = ?
     ORDER BY exercise_id, set_number ASC`,
    [previousSessionId],
  );

  for (const row of rows) {
    const exerciseId = row.exercise_id as string;
    const setNumber = row.set_number as number;

    let exerciseMap = result.get(exerciseId);
    if (!exerciseMap) {
      exerciseMap = new Map();
      result.set(exerciseId, exerciseMap);
    }

    exerciseMap.set(setNumber, {
      weight: row.weight as number,
      reps: row.reps as number,
      unit: row.unit as WeightUnit,
      estimated1rm: (row.estimated_1rm as number) ?? 0,
    });
  }

  return result;
}

// ── 1RM History ──

function rowTo1RM(row: Record<string, unknown>): Exercise1RMRow {
  return {
    id: row.id as string,
    exerciseId: row.exercise_id as string,
    maxWeight: row.max_weight as number,
    maxReps: row.max_reps as number,
    estimated1rm: row.estimated_1rm as number,
    unit: row.unit as WeightUnit,
    achievedAt: row.achieved_at as string,
    createdAt: row.created_at as string,
  };
}

export function record1RM(
  db: DatabaseAdapter,
  id: string,
  input: Record1RMInput,
): void {
  db.execute(
    `INSERT INTO wk_exercise_1rm_history (
      id, exercise_id, max_weight, max_reps, estimated_1rm, unit, achieved_at, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.exerciseId,
      input.maxWeight,
      input.maxReps,
      input.estimated1rm,
      input.unit ?? 'lbs',
      input.achievedAt,
      nowIso(),
    ],
  );
}

export function get1RMHistory(
  db: DatabaseAdapter,
  exerciseId: string,
  options?: { limit?: number },
): Exercise1RMRow[] {
  const params: unknown[] = [exerciseId, (options?.limit && options.limit > 0) ? options.limit : 200];
  return db.query<Record<string, unknown>>(
    'SELECT * FROM wk_exercise_1rm_history WHERE exercise_id = ? ORDER BY achieved_at DESC LIMIT ?',
    params,
  ).map(rowTo1RM);
}

export function getLatest1RM(
  db: DatabaseAdapter,
  exerciseId: string,
): Exercise1RMRow | null {
  const row = db
    .query<Record<string, unknown>>(
      'SELECT * FROM wk_exercise_1rm_history WHERE exercise_id = ? ORDER BY achieved_at DESC LIMIT 1',
      [exerciseId],
    )[0];
  return row ? rowTo1RM(row) : null;
}

// ── Body Measurements ──

function rowToMeasurement(row: Record<string, unknown>): BodyMeasurementRow {
  return {
    id: row.id as string,
    type: row.type as string,
    value: row.value as number,
    unit: row.unit as string,
    measuredAt: row.measured_at as string,
    createdAt: row.created_at as string,
  };
}

export function createBodyMeasurement(
  db: DatabaseAdapter,
  id: string,
  input: BodyMeasurementInput,
): void {
  db.execute(
    `INSERT INTO wk_body_measurements (
      id, type, value, unit, measured_at, created_at
    ) VALUES (?, ?, ?, ?, ?, ?)`,
    [id, input.type, input.value, input.unit, input.measuredAt, nowIso()],
  );
}

export function getBodyMeasurements(
  db: DatabaseAdapter,
  options?: { type?: string; limit?: number },
): BodyMeasurementRow[] {
  const where: string[] = [];
  const params: unknown[] = [];

  if (options?.type) {
    where.push('type = ?');
    params.push(options.type);
  }

  let sql = 'SELECT * FROM wk_body_measurements';
  if (where.length > 0) {
    sql += ` WHERE ${where.join(' AND ')}`;
  }
  sql += ' ORDER BY measured_at DESC LIMIT ?';
  params.push((options?.limit && options.limit > 0) ? options.limit : 500);

  return db.query<Record<string, unknown>>(sql, params).map(rowToMeasurement);
}

export function deleteBodyMeasurement(db: DatabaseAdapter, id: string): void {
  db.execute('DELETE FROM wk_body_measurements WHERE id = ?', [id]);
}

// ── Workout Plans ──

function rowToPlan(row: Record<string, unknown>): WorkoutPlan {
  return {
    id: row.id as string,
    title: row.title as string,
    description: (row.description as string) ?? '',
    creatorId: (row.creator_id as string | null) ?? null,
    weeks: parseJson<WorkoutPlanWeek[]>(row.weeks_json, []),
    isPremium: !!(row.is_premium as number),
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export function createWorkoutPlan(
  db: DatabaseAdapter,
  id: string,
  input: WorkoutPlanInput,
): void {
  const now = nowIso();
  db.execute(
    `INSERT INTO wk_workout_plans (
      id, title, description, creator_id, weeks_json, is_premium, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.title,
      input.description ?? '',
      input.creatorId ?? null,
      input.weeksJson,
      input.isPremium ? 1 : 0,
      now,
      now,
    ],
  );
}

export function getWorkoutPlans(
  db: DatabaseAdapter,
  options?: { limit?: number },
): WorkoutPlan[] {
  let sql = 'SELECT * FROM wk_workout_plans ORDER BY created_at DESC';
  const params: unknown[] = [];
  if (options?.limit && options.limit > 0) {
    sql += ' LIMIT ?';
    params.push(options.limit);
  }
  return db.query<Record<string, unknown>>(sql, params).map(rowToPlan);
}

export function getWorkoutPlanById(
  db: DatabaseAdapter,
  id: string,
): WorkoutPlan | null {
  const row = db
    .query<Record<string, unknown>>(
      'SELECT * FROM wk_workout_plans WHERE id = ? LIMIT 1',
      [id],
    )[0];
  return row ? rowToPlan(row) : null;
}

export function updateWorkoutPlan(
  db: DatabaseAdapter,
  id: string,
  input: WorkoutPlanInput,
): void {
  db.execute(
    `UPDATE wk_workout_plans
     SET title = ?, description = ?, creator_id = ?, weeks_json = ?,
         is_premium = ?, updated_at = ?
     WHERE id = ?`,
    [
      input.title,
      input.description ?? '',
      input.creatorId ?? null,
      input.weeksJson,
      input.isPremium ? 1 : 0,
      nowIso(),
      id,
    ],
  );
}

export function deleteWorkoutPlan(db: DatabaseAdapter, id: string): void {
  db.execute('DELETE FROM wk_workout_plans WHERE id = ?', [id]);
}

// ── Plan Subscriptions ──

function rowToSubscription(row: Record<string, unknown>): PlanSubscriptionRow {
  return {
    id: row.id as string,
    planId: row.plan_id as string,
    startedAt: row.started_at as string,
    isActive: !!(row.is_active as number),
    createdAt: row.created_at as string,
  };
}

export function subscribeToPlan(
  db: DatabaseAdapter,
  id: string,
  planId: string,
): void {
  db.execute(
    `INSERT INTO wk_plan_subscriptions (
      id, plan_id, started_at, is_active, created_at
    ) VALUES (?, ?, ?, 1, ?)`,
    [id, planId, nowIso(), nowIso()],
  );
}

export function unsubscribeFromPlan(db: DatabaseAdapter, planId: string): void {
  db.execute(
    'UPDATE wk_plan_subscriptions SET is_active = 0 WHERE plan_id = ? AND is_active = 1',
    [planId],
  );
}

export function getActivePlanSubscription(
  db: DatabaseAdapter,
): PlanSubscriptionRow | null {
  const row = db
    .query<Record<string, unknown>>(
      'SELECT * FROM wk_plan_subscriptions WHERE is_active = 1 ORDER BY created_at DESC LIMIT 1',
    )[0];
  return row ? rowToSubscription(row) : null;
}

// Legacy APIs retained below to avoid breaking existing callers while the
// upgraded MyWorkouts feature surface rolls out in the hub.

function rowToWorkoutLog(row: Record<string, unknown>): WorkoutLog {
  return {
    id: row.id as string,
    name: row.name as string,
    focus: row.focus as WorkoutFocus,
    durationMin: row.duration_min as number,
    calories: row.calories as number,
    rpe: row.rpe as number,
    completedAt: row.completed_at as string,
    notes: (row.notes as string) ?? null,
    createdAt: row.created_at as string,
  };
}

function rowToWorkoutProgram(row: Record<string, unknown>): WorkoutProgram {
  return {
    id: row.id as string,
    name: row.name as string,
    goal: row.goal as string,
    weeks: row.weeks as number,
    sessionsPerWeek: row.sessions_per_week as number,
    isActive: !!(row.is_active as number),
    createdAt: row.created_at as string,
  };
}

export function createWorkoutLog(
  db: DatabaseAdapter,
  id: string,
  input: {
    name: string;
    focus: WorkoutFocus;
    durationMin: number;
    calories?: number;
    rpe?: number;
    completedAt: string;
    notes?: string;
  },
): void {
  db.execute(
    `INSERT INTO wk_workout_logs (
      id, name, focus, duration_min, calories, rpe, completed_at, notes, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.name,
      input.focus,
      input.durationMin,
      input.calories ?? 0,
      input.rpe ?? 7,
      input.completedAt,
      input.notes ?? null,
      nowIso(),
    ],
  );
}

export function getWorkoutLogs(
  db: DatabaseAdapter,
  options?: {
    focus?: WorkoutFocus;
    limit?: number;
  },
): WorkoutLog[] {
  const params: unknown[] = [];
  let sql = 'SELECT * FROM wk_workout_logs';

  if (options?.focus) {
    sql += ' WHERE focus = ?';
    params.push(options.focus);
  }

  sql += ' ORDER BY completed_at DESC';

  if (options?.limit !== undefined) {
    sql += ' LIMIT ?';
    params.push(options.limit);
  }

  return db.query<Record<string, unknown>>(sql, params).map(rowToWorkoutLog);
}

export function deleteWorkoutLog(db: DatabaseAdapter, id: string): void {
  db.execute('DELETE FROM wk_workout_logs WHERE id = ?', [id]);
}

export function createWorkoutProgram(
  db: DatabaseAdapter,
  id: string,
  input: {
    name: string;
    goal: string;
    weeks: number;
    sessionsPerWeek: number;
    isActive?: boolean;
  },
): void {
  db.transaction(() => {
    if (input.isActive) {
      db.execute('UPDATE wk_programs SET is_active = 0');
    }
    db.execute(
      `INSERT INTO wk_programs (
        id, name, goal, weeks, sessions_per_week, is_active, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.name,
        input.goal,
        input.weeks,
        input.sessionsPerWeek,
        input.isActive ? 1 : 0,
        nowIso(),
      ],
    );
  });
}

export function getWorkoutPrograms(db: DatabaseAdapter): WorkoutProgram[] {
  return db
    .query<Record<string, unknown>>(
      'SELECT * FROM wk_programs ORDER BY is_active DESC, created_at DESC LIMIT 100',
    )
    .map(rowToWorkoutProgram);
}

export function setActiveWorkoutProgram(
  db: DatabaseAdapter,
  id: string | null,
): void {
  db.transaction(() => {
    db.execute('UPDATE wk_programs SET is_active = 0');
    if (id) {
      db.execute('UPDATE wk_programs SET is_active = 1 WHERE id = ?', [id]);
    }
  });
}

export function deleteWorkoutProgram(db: DatabaseAdapter, id: string): void {
  db.execute('DELETE FROM wk_programs WHERE id = ?', [id]);
}

// ── Overload Rules ──

export function createOverloadRule(
  db: DatabaseAdapter,
  id: string,
  input: {
    exerciseId?: string | null;
    ruleType?: string;
    triggerCondition?: string;
    targetReps?: number | null;
    incrementValue?: number;
    incrementUnit?: string;
    minSessions?: number;
  },
): void {
  const now = nowIso();
  db.execute(
    `INSERT INTO wk_overload_rules (
      id, exercise_id, rule_type, trigger_condition, target_reps,
      increment_value, increment_unit, min_sessions, is_active, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    [
      id,
      input.exerciseId ?? null,
      input.ruleType ?? 'weight_increment',
      input.triggerCondition ?? 'all_sets_hit',
      input.targetReps ?? 10,
      input.incrementValue ?? 5,
      input.incrementUnit ?? 'lbs',
      input.minSessions ?? 2,
      now,
      now,
    ],
  );
}

export function getOverloadRules(db: DatabaseAdapter): OverloadRule[] {
  return db
    .query<Record<string, unknown>>('SELECT * FROM wk_overload_rules ORDER BY exercise_id NULLS FIRST, created_at DESC LIMIT 200')
    .map(rowToOverloadRule);
}

export function getOverloadRuleForExercise(
  db: DatabaseAdapter,
  exerciseId: string,
): OverloadRule | null {
  const row = db.query<Record<string, unknown>>(
    'SELECT * FROM wk_overload_rules WHERE exercise_id = ? AND is_active = 1 LIMIT 1',
    [exerciseId],
  )[0];
  return row ? rowToOverloadRule(row) : null;
}

export function updateOverloadRule(
  db: DatabaseAdapter,
  id: string,
  input: {
    ruleType?: string;
    triggerCondition?: string;
    targetReps?: number | null;
    incrementValue?: number;
    incrementUnit?: string;
    minSessions?: number;
    isActive?: boolean;
  },
): void {
  const sets: string[] = [];
  const params: unknown[] = [];

  if (input.ruleType !== undefined) { sets.push('rule_type = ?'); params.push(input.ruleType); }
  if (input.triggerCondition !== undefined) { sets.push('trigger_condition = ?'); params.push(input.triggerCondition); }
  if (input.targetReps !== undefined) { sets.push('target_reps = ?'); params.push(input.targetReps); }
  if (input.incrementValue !== undefined) { sets.push('increment_value = ?'); params.push(input.incrementValue); }
  if (input.incrementUnit !== undefined) { sets.push('increment_unit = ?'); params.push(input.incrementUnit); }
  if (input.minSessions !== undefined) { sets.push('min_sessions = ?'); params.push(input.minSessions); }
  if (input.isActive !== undefined) { sets.push('is_active = ?'); params.push(input.isActive ? 1 : 0); }

  if (sets.length === 0) return;

  sets.push('updated_at = ?');
  params.push(nowIso());
  params.push(id);

  db.execute(`UPDATE wk_overload_rules SET ${sets.join(', ')} WHERE id = ?`, params);
}

export function deleteOverloadRule(db: DatabaseAdapter, id: string): void {
  db.execute('DELETE FROM wk_overload_rules WHERE id = ?', [id]);
}

function rowToOverloadRule(row: Record<string, unknown>): OverloadRule {
  return {
    id: row.id as string,
    exerciseId: (row.exercise_id as string | null) ?? null,
    ruleType: row.rule_type as OverloadRule['ruleType'],
    triggerCondition: row.trigger_condition as OverloadRule['triggerCondition'],
    targetReps: (row.target_reps as number | null) ?? null,
    incrementValue: row.increment_value as number,
    incrementUnit: row.increment_unit as OverloadRule['incrementUnit'],
    minSessions: row.min_sessions as number,
    isActive: !!(row.is_active as number),
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

// ── Exercise Performance History (for overload) ──

export function getExercisePerformanceHistory(
  db: DatabaseAdapter,
  exerciseId: string,
  workoutId?: string,
  limit = 10,
): ExercisePerformanceHistory {
  const whereClause = workoutId
    ? 'AND s.workout_id = ?'
    : '';
  const params: unknown[] = workoutId
    ? [exerciseId, workoutId, limit]
    : [exerciseId, limit];

  const rows = db.query<Record<string, unknown>>(
    `SELECT sw.session_id, sw.set_number, sw.weight, sw.reps, sw.unit,
            s.completed_at
     FROM wk_workout_set_weights sw
     JOIN wk_workout_sessions s ON sw.session_id = s.id
     WHERE sw.exercise_id = ?
       AND s.completed_at IS NOT NULL
       ${whereClause}
     ORDER BY s.completed_at DESC, sw.set_number ASC
     LIMIT ?`,
    params,
  );

  const sessionsMap = new Map<string, { completedAt: string; sets: SetData[] }>();
  for (const row of rows) {
    const sessionId = row.session_id as string;
    if (!sessionsMap.has(sessionId)) {
      sessionsMap.set(sessionId, { completedAt: row.completed_at as string, sets: [] });
    }
    sessionsMap.get(sessionId)!.sets.push({
      setNumber: row.set_number as number,
      weight: row.weight as number,
      reps: row.reps as number,
      unit: row.unit as WeightUnit,
    });
  }

  return {
    exerciseId,
    sessions: Array.from(sessionsMap.entries()).map(([sessionId, data]) => ({
      sessionId,
      completedAt: data.completedAt,
      sets: data.sets,
    })),
  };
}

// ── Generation History ──

export function createGenerationEntry(
  db: DatabaseAdapter,
  id: string,
  input: {
    goal: string;
    focus: string;
    equipment: string[];
    difficulty: string;
    durationMinutes: number;
    generatedWorkoutJson: string;
    source?: 'local' | 'llm';
  },
): void {
  db.execute(
    `INSERT INTO wk_generation_history (
      id, goal, focus, equipment_json, difficulty, duration_minutes,
      generated_workout_json, source, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.goal,
      input.focus,
      JSON.stringify(input.equipment),
      input.difficulty,
      input.durationMinutes,
      input.generatedWorkoutJson,
      input.source ?? 'local',
      nowIso(),
    ],
  );
}

export function markGenerationAccepted(db: DatabaseAdapter, id: string): void {
  db.execute('UPDATE wk_generation_history SET accepted = 1 WHERE id = ?', [id]);
}

export function getGenerationHistory(
  db: DatabaseAdapter,
  limit = 20,
): GenerationHistoryEntry[] {
  return db
    .query<Record<string, unknown>>(
      'SELECT * FROM wk_generation_history ORDER BY created_at DESC LIMIT ?',
      [limit],
    )
    .map(rowToGenerationEntry);
}

function rowToGenerationEntry(row: Record<string, unknown>): GenerationHistoryEntry {
  return {
    id: row.id as string,
    goal: row.goal as string,
    focus: row.focus as string,
    equipment: parseJson<string[]>(row.equipment_json, []),
    difficulty: row.difficulty as string,
    durationMinutes: row.duration_minutes as number,
    generatedWorkoutJson: row.generated_workout_json as string,
    accepted: !!(row.accepted as number),
    source: row.source as 'local' | 'llm',
    createdAt: row.created_at as string,
  };
}

// ── GPS Routes ──

export function createGpsRoute(
  db: DatabaseAdapter,
  id: string,
  input: {
    sessionId?: string | null;
    activityType: string;
    name?: string | null;
    startedAt: string;
  },
): void {
  db.execute(
    `INSERT INTO wk_gps_routes (
      id, session_id, activity_type, name, started_at, created_at
    ) VALUES (?, ?, ?, ?, ?, ?)`,
    [id, input.sessionId ?? null, input.activityType, input.name ?? null, input.startedAt, nowIso()],
  );
}

export function completeGpsRoute(
  db: DatabaseAdapter,
  id: string,
  metrics: {
    distanceMeters: number;
    durationSeconds: number;
    elevationGainMeters: number;
    elevationLossMeters: number;
    avgPaceSecPerKm: number | null;
    avgSpeedKmh: number | null;
    maxSpeedKmh: number | null;
    caloriesEstimated: number;
    completedAt: string;
  },
): void {
  db.execute(
    `UPDATE wk_gps_routes SET
      distance_meters = ?, duration_seconds = ?,
      elevation_gain_meters = ?, elevation_loss_meters = ?,
      avg_pace_sec_per_km = ?, avg_speed_kmh = ?, max_speed_kmh = ?,
      calories_estimated = ?, completed_at = ?
     WHERE id = ?`,
    [
      metrics.distanceMeters, metrics.durationSeconds,
      metrics.elevationGainMeters, metrics.elevationLossMeters,
      metrics.avgPaceSecPerKm, metrics.avgSpeedKmh, metrics.maxSpeedKmh,
      metrics.caloriesEstimated, metrics.completedAt,
      id,
    ],
  );
}

export function getGpsRoutes(
  db: DatabaseAdapter,
  activityType?: string,
  limit = 50,
): GpsRoute[] {
  const where = activityType ? 'WHERE activity_type = ?' : '';
  const params: unknown[] = activityType ? [activityType, limit] : [limit];
  return db
    .query<Record<string, unknown>>(
      `SELECT * FROM wk_gps_routes ${where} ORDER BY started_at DESC LIMIT ?`,
      params,
    )
    .map(rowToGpsRoute);
}

export function getGpsRouteById(db: DatabaseAdapter, id: string): GpsRoute | null {
  const row = db.query<Record<string, unknown>>(
    'SELECT * FROM wk_gps_routes WHERE id = ? LIMIT 1',
    [id],
  )[0];
  return row ? rowToGpsRoute(row) : null;
}

export function deleteGpsRoute(db: DatabaseAdapter, id: string): void {
  db.execute('DELETE FROM wk_gps_routes WHERE id = ?', [id]);
}

function rowToGpsRoute(row: Record<string, unknown>): GpsRoute {
  return {
    id: row.id as string,
    sessionId: (row.session_id as string | null) ?? null,
    activityType: row.activity_type as GpsRoute['activityType'],
    name: (row.name as string | null) ?? null,
    distanceMeters: row.distance_meters as number,
    durationSeconds: row.duration_seconds as number,
    elevationGainMeters: row.elevation_gain_meters as number,
    elevationLossMeters: row.elevation_loss_meters as number,
    avgPaceSecPerKm: (row.avg_pace_sec_per_km as number | null) ?? null,
    avgSpeedKmh: (row.avg_speed_kmh as number | null) ?? null,
    maxSpeedKmh: (row.max_speed_kmh as number | null) ?? null,
    caloriesEstimated: row.calories_estimated as number,
    startedAt: row.started_at as string,
    completedAt: (row.completed_at as string | null) ?? null,
    createdAt: row.created_at as string,
  };
}

// ── GPS Points ──

export function insertGpsPoints(
  db: DatabaseAdapter,
  routeId: string,
  points: GpsPointInput[],
): void {
  if (points.length === 0) return;
  db.transaction(() => {
    for (const p of points) {
      db.execute(
        `INSERT INTO wk_gps_points (
          route_id, latitude, longitude, altitude_meters,
          speed_mps, accuracy_meters, timestamp_ms, segment
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          routeId,
          p.latitude,
          p.longitude,
          p.altitudeMeters ?? null,
          p.speedMps ?? null,
          p.accuracyMeters ?? null,
          p.timestampMs,
          p.segment ?? 0,
        ],
      );
    }
  });
}

export function getGpsPoints(
  db: DatabaseAdapter,
  routeId: string,
): GpsPoint[] {
  return db
    .query<Record<string, unknown>>(
      'SELECT * FROM wk_gps_points WHERE route_id = ? ORDER BY timestamp_ms ASC',
      [routeId],
    )
    .map((row) => ({
      id: row.id as number,
      routeId: row.route_id as string,
      latitude: row.latitude as number,
      longitude: row.longitude as number,
      altitudeMeters: (row.altitude_meters as number | null) ?? null,
      speedMps: (row.speed_mps as number | null) ?? null,
      accuracyMeters: (row.accuracy_meters as number | null) ?? null,
      timestampMs: row.timestamp_ms as number,
      segment: row.segment as number,
    }));
}

// ── Plate Inventories ──

function validatePlatesJson(json: string): void {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error('Invalid plates JSON: must be valid JSON');
  }
  if (!Array.isArray(parsed)) {
    throw new Error('Invalid plates JSON: must be an array');
  }
  for (const entry of parsed) {
    if (typeof entry !== 'object' || entry === null || typeof (entry as Record<string, unknown>).weight !== 'number' || typeof (entry as Record<string, unknown>).count !== 'number') {
      throw new Error('Invalid plates JSON: each entry must have numeric weight and count');
    }
  }
}

function rowToPlateInventory(row: Record<string, unknown>): PlateInventory {
  return {
    id: row.id as string,
    name: row.name as string,
    unit: (row.unit as 'lbs' | 'kg') ?? 'lbs',
    plates: parseJson<{ weight: number; count: number }[]>(row.plates_json, []),
    barWeight: row.bar_weight as number,
    isDefault: !!(row.is_default as number),
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export function createPlateInventory(
  db: DatabaseAdapter,
  input: PlateInventoryInput,
): PlateInventory {
  validatePlatesJson(input.platesJson);
  const id = slugify(input.name) + '-' + Date.now();
  const now = nowIso();
  db.execute(
    `INSERT INTO wk_plate_inventories (id, name, unit, plates_json, bar_weight, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, input.name, input.unit ?? 'lbs', input.platesJson, input.barWeight ?? 45, now, now],
  );
  return getPlateInventoryById(db, id)!;
}

export function getPlateInventories(db: DatabaseAdapter): PlateInventory[] {
  return db
    .query<Record<string, unknown>>('SELECT * FROM wk_plate_inventories ORDER BY is_default DESC, name ASC LIMIT 50')
    .map(rowToPlateInventory);
}

export function getPlateInventoryById(
  db: DatabaseAdapter,
  id: string,
): PlateInventory | null {
  const rows = db.query<Record<string, unknown>>(
    'SELECT * FROM wk_plate_inventories WHERE id = ?',
    [id],
  );
  return rows.length > 0 ? rowToPlateInventory(rows[0]) : null;
}

export function updatePlateInventory(
  db: DatabaseAdapter,
  id: string,
  input: Partial<PlateInventoryInput>,
): void {
  const sets: string[] = [];
  const values: unknown[] = [];
  if (input.name !== undefined) { sets.push('name = ?'); values.push(input.name); }
  if (input.unit !== undefined) { sets.push('unit = ?'); values.push(input.unit); }
  if (input.platesJson !== undefined) { validatePlatesJson(input.platesJson); sets.push('plates_json = ?'); values.push(input.platesJson); }
  if (input.barWeight !== undefined) { sets.push('bar_weight = ?'); values.push(input.barWeight); }
  if (sets.length === 0) return;
  sets.push('updated_at = ?');
  values.push(nowIso());
  values.push(id);
  db.execute(`UPDATE wk_plate_inventories SET ${sets.join(', ')} WHERE id = ?`, values);
}

export function deletePlateInventory(db: DatabaseAdapter, id: string): void {
  db.execute('DELETE FROM wk_plate_inventories WHERE id = ?', [id]);
}

// ── Progress Photos ──

function rowToProgressPhoto(row: Record<string, unknown>): ProgressPhoto {
  return {
    id: row.id as string,
    photoUri: row.photo_uri as string,
    viewType: (row.view_type as PhotoViewType) ?? 'front',
    notes: (row.notes as string) ?? '',
    takenAt: row.taken_at as string,
    fileSizeBytes: (row.file_size_bytes as number) ?? 0,
    width: (row.width as number) ?? 0,
    height: (row.height as number) ?? 0,
    createdAt: row.created_at as string,
  };
}

export function createProgressPhoto(
  db: DatabaseAdapter,
  input: ProgressPhotoInput,
): ProgressPhoto {
  const id = 'photo-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
  db.execute(
    `INSERT INTO wk_progress_photos (id, photo_uri, view_type, notes, taken_at, file_size_bytes, width, height)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, input.photoUri, input.viewType ?? 'front', input.notes ?? '', input.takenAt, input.fileSizeBytes ?? 0, input.width ?? 0, input.height ?? 0],
  );
  return getProgressPhotoById(db, id)!;
}

export function getProgressPhotos(
  db: DatabaseAdapter,
  viewType?: PhotoViewType,
): ProgressPhoto[] {
  if (viewType) {
    return db
      .query<Record<string, unknown>>(
        'SELECT * FROM wk_progress_photos WHERE view_type = ? ORDER BY taken_at DESC LIMIT 500',
        [viewType],
      )
      .map(rowToProgressPhoto);
  }
  return db
    .query<Record<string, unknown>>('SELECT * FROM wk_progress_photos ORDER BY taken_at DESC LIMIT 500')
    .map(rowToProgressPhoto);
}

export function getProgressPhotoById(
  db: DatabaseAdapter,
  id: string,
): ProgressPhoto | null {
  const rows = db.query<Record<string, unknown>>(
    'SELECT * FROM wk_progress_photos WHERE id = ?',
    [id],
  );
  return rows.length > 0 ? rowToProgressPhoto(rows[0]) : null;
}

export function deleteProgressPhoto(db: DatabaseAdapter, id: string): void {
  db.execute('DELETE FROM wk_progress_photos WHERE id = ?', [id]);
}

export function getProgressPhotoCount(db: DatabaseAdapter): number {
  const rows = db.query<{ count: number }>('SELECT COUNT(*) as count FROM wk_progress_photos');
  return rows[0]?.count ?? 0;
}

// ── Trainers ──

function rowToTrainer(row: Record<string, unknown>): Trainer {
  return {
    id: row.id as string,
    userId: (row.user_id as string | null) ?? null,
    displayName: row.display_name as string,
    bio: (row.bio as string) ?? '',
    avatarUri: (row.avatar_uri as string | null) ?? null,
    isActive: !!(row.is_active as number),
    createdAt: row.created_at as string,
  };
}

export function createTrainer(
  db: DatabaseAdapter,
  id: string,
  displayName: string,
  userId?: string | null,
): Trainer {
  db.execute(
    `INSERT INTO wk_trainers (id, user_id, display_name, created_at)
     VALUES (?, ?, ?, ?)`,
    [id, userId ?? null, displayName, nowIso()],
  );
  return getTrainerById(db, id)!;
}

export function getActiveTrainer(db: DatabaseAdapter): Trainer | null {
  const row = db.query<Record<string, unknown>>(
    'SELECT * FROM wk_trainers WHERE is_active = 1 ORDER BY created_at DESC LIMIT 1',
  )[0];
  return row ? rowToTrainer(row) : null;
}

export function getTrainerById(db: DatabaseAdapter, id: string): Trainer | null {
  const row = db.query<Record<string, unknown>>(
    'SELECT * FROM wk_trainers WHERE id = ? LIMIT 1',
    [id],
  )[0];
  return row ? rowToTrainer(row) : null;
}

export function deactivateTrainer(db: DatabaseAdapter, id: string): void {
  db.execute('UPDATE wk_trainers SET is_active = 0 WHERE id = ?', [id]);
}

// ── Exercise Videos ──

function rowToExerciseVideo(row: Record<string, unknown>): ExerciseVideo {
  return {
    id: row.id as string,
    exerciseId: row.exercise_id as string,
    trainerId: row.trainer_id as string,
    videoUri: row.video_uri as string,
    thumbnailUri: (row.thumbnail_uri as string | null) ?? null,
    angle: (row.angle as VideoAngle) ?? 'front',
    durationSeconds: (row.duration_seconds as number) ?? 0,
    fileSizeBytes: (row.file_size_bytes as number) ?? 0,
    width: (row.width as number) ?? 0,
    height: (row.height as number) ?? 0,
    sortOrder: (row.sort_order as number) ?? 0,
    isPrimary: !!(row.is_primary as number),
    storageType: (row.storage_type as StorageType) ?? 'local',
    notes: (row.notes as string) ?? '',
    createdAt: row.created_at as string,
  };
}

export function createExerciseVideo(
  db: DatabaseAdapter,
  id: string,
  input: ExerciseVideoInput,
): ExerciseVideo {
  db.transaction(() => {
    // Auto-set as primary if first video for this exercise
    const existingCount = getExerciseVideoCount(db, input.exerciseId);
    const isPrimary = existingCount === 0 ? 1 : 0;
    const sortOrder = existingCount;

    db.execute(
      `INSERT INTO wk_exercise_videos (
        id, exercise_id, trainer_id, video_uri, thumbnail_uri,
        angle, duration_seconds, file_size_bytes, width, height,
        sort_order, is_primary, storage_type, notes, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'local', ?, ?)`,
      [
        id,
        input.exerciseId,
        input.trainerId,
        input.videoUri,
        input.thumbnailUri ?? null,
        input.angle ?? 'front',
        input.durationSeconds ?? 0,
        input.fileSizeBytes ?? 0,
        input.width ?? 0,
        input.height ?? 0,
        sortOrder,
        isPrimary,
        input.notes ?? '',
        nowIso(),
      ],
    );
  });
  return getExerciseVideoById(db, id)!;
}

export function getExerciseVideos(
  db: DatabaseAdapter,
  exerciseId: string,
): ExerciseVideo[] {
  return db
    .query<Record<string, unknown>>(
      'SELECT * FROM wk_exercise_videos WHERE exercise_id = ? ORDER BY sort_order ASC, created_at ASC',
      [exerciseId],
    )
    .map(rowToExerciseVideo);
}

export function getExerciseVideoById(
  db: DatabaseAdapter,
  id: string,
): ExerciseVideo | null {
  const row = db.query<Record<string, unknown>>(
    'SELECT * FROM wk_exercise_videos WHERE id = ? LIMIT 1',
    [id],
  )[0];
  return row ? rowToExerciseVideo(row) : null;
}

export function getPrimaryVideo(
  db: DatabaseAdapter,
  exerciseId: string,
): ExerciseVideo | null {
  const row = db.query<Record<string, unknown>>(
    'SELECT * FROM wk_exercise_videos WHERE exercise_id = ? AND is_primary = 1 LIMIT 1',
    [exerciseId],
  )[0];
  return row ? rowToExerciseVideo(row) : null;
}

export function setPrimaryVideo(
  db: DatabaseAdapter,
  exerciseId: string,
  videoId: string,
): void {
  db.transaction(() => {
    db.execute(
      'UPDATE wk_exercise_videos SET is_primary = 0 WHERE exercise_id = ?',
      [exerciseId],
    );
    db.execute(
      'UPDATE wk_exercise_videos SET is_primary = 1 WHERE id = ?',
      [videoId],
    );
  });
}

export function updateVideoOrder(
  db: DatabaseAdapter,
  videoIds: string[],
): void {
  db.transaction(() => {
    for (let i = 0; i < videoIds.length; i++) {
      db.execute(
        'UPDATE wk_exercise_videos SET sort_order = ? WHERE id = ?',
        [i, videoIds[i]],
      );
    }
  });
}

export function deleteExerciseVideo(
  db: DatabaseAdapter,
  id: string,
): string | null {
  const video = getExerciseVideoById(db, id);
  if (!video) return null;
  const { videoUri, exerciseId, isPrimary } = video;

  db.transaction(() => {
    db.execute('DELETE FROM wk_exercise_videos WHERE id = ?', [id]);

    // If we deleted the primary, promote the next one
    if (isPrimary) {
      const remaining = getExerciseVideos(db, exerciseId);
      if (remaining.length > 0) {
        db.execute(
          'UPDATE wk_exercise_videos SET is_primary = 1 WHERE id = ?',
          [remaining[0].id],
        );
      }
    }
  });
  return videoUri;
}

export function getExerciseVideoCount(
  db: DatabaseAdapter,
  exerciseId: string,
): number {
  const rows = db.query<{ count: number }>(
    'SELECT COUNT(*) as count FROM wk_exercise_videos WHERE exercise_id = ?',
    [exerciseId],
  );
  return rows[0]?.count ?? 0;
}
