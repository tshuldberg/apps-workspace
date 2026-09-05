'use server';

import { revalidatePath } from 'next/cache';
import { ensureModuleMigrations, getAdapter } from '@/lib/db';
import {
  applyPrivacyFilter,
  buildRecoveryMap,
  buildWorkoutSummary,
  calculate1RM,
  completeWorkoutSession,
  createBodyMeasurement,
  createGenerationEntry,
  createOverloadRule,
  createProgressPhoto,
  createWorkout,
  createWorkoutSession,
  DEFAULT_OVERLOAD_RULE,
  deleteBodyMeasurement,
  deleteOverloadRule,
  deleteProgressPhoto,
  deleteWorkout,
  enrichPost,
  exportWorkoutHistoryCSV,
  exportSetWeightsCSV,
  generateLocalWorkout,
  generateOverloadSuggestion,
  getActivePlanSubscription,
  getAllPlanWorkoutIds,
  getBodyMeasurements,
  getCurrentPlanPosition,
  getExercisePerformanceHistory,
  getExerciseVideos,
  getLatest1RM,
  getOverloadRules,
  getPlanProgress,
  getPrimaryVideo,
  getPreviousPerformance,
  getProgressPhotoCount,
  getProgressPhotos,
  getSetWeightsForExercise,
  getWorkoutById,
  getWorkoutCategoryCounts,
  getWorkoutDashboard,
  getWorkoutExerciseById,
  getWorkoutExerciseCount,
  getWorkoutExercises,
  getWorkoutMetrics,
  getWorkoutPlanById,
  getWorkoutPlans,
  getWorkoutSessions,
  getWorkouts,
  getBestToTrain,
  markGenerationAccepted,
  normalizePrivacySettings,
  record1RM,
  recordSetWeight,
  seedWorkoutExerciseLibrary,
  subscribeToPlan,
  unsubscribeFromPlan,
  updateOverloadRule,
  updateWorkout,
  type CompletedExercise,
  type ExercisePerformanceHistory,
  type ExerciseVideo,
  type GenerationGoal,
  type GeneratedWorkout,
  type MuscleGroup,
  type OverloadRule,
  type OverloadRuleType,
  type OverloadSuggestion,
  type OverloadTrigger,
  type PersonalRecord,
  type PeriodSummary,
  type PhotoViewType,
  type SocialPrivacySettings,
  type SocialPost,
  type SocialPostEnriched,
  type SocialUserProfile,
  type StreakInfo,
  type VolumeStats,
  type WeightUnit,
  type WorkoutCategory,
  type WorkoutDefinition,
  type WorkoutDifficulty,
  type WorkoutExerciseEntry,
  type WorkoutExerciseFilters,
  type WorkoutExerciseLibraryItem,
  type WorkoutHistoryEntry,
  type WorkoutMetrics,
  type WorkoutPlan,
  type WorkoutSession,
  type WorkoutSummaryCard,
} from '@mylife/workouts';

interface DashboardPayload {
  dashboard: ReturnType<typeof getWorkoutDashboard>;
  metrics: WorkoutMetrics;
  categories: ReturnType<typeof getWorkoutCategoryCounts>;
}

interface ProgressPayload {
  streaks: StreakInfo;
  volume: VolumeStats;
  personalRecords: PersonalRecord[];
  weeklySummaries: PeriodSummary[];
}

export interface WorkoutPlanSummary {
  id: string;
  title: string;
  description: string;
  weekCount: number;
  frequency: number;
  workoutCount: number;
  isActive: boolean;
  progressPercent: number | null;
  weeks: WorkoutPlan['weeks'];
}

export type WorkoutPreferenceFocus =
  | 'strength'
  | 'hypertrophy'
  | 'cardio'
  | 'mobility'
  | 'recovery';

export type WorkoutEquipmentOption =
  | 'barbell'
  | 'dumbbells'
  | 'kettlebells'
  | 'machines'
  | 'bands'
  | 'bodyweight';

export interface WorkoutWebSettings {
  displayName: string;
  tierLabel: string;
  defaultFocus: WorkoutPreferenceFocus;
  defaultRestSeconds: number;
  autoStartRestTimer: boolean;
  voiceCommandsEnabled: boolean;
  defaultBarbellWeight: number;
  availableEquipment: WorkoutEquipmentOption[];
  weightUnit: 'lbs' | 'kg';
  distanceUnit: 'mi' | 'km';
  bodyWeightUnit: 'lbs' | 'kg';
  workoutReminders: boolean;
  restTimerAlerts: boolean;
  prNotifications: boolean;
  gpsTrackingEnabled: boolean;
  formRecordingsEnabled: boolean;
}

export interface WorkoutRecentView {
  id: string;
  type: 'workout' | 'program' | 'exercise';
  title: string;
  subtitle?: string;
  route: string;
  category?: string | null;
  seenAt: string;
}

export interface WorkoutBuilderSeed {
  workout: WorkoutDefinition | null;
  exercises: WorkoutExerciseLibraryItem[];
  settings: WorkoutWebSettings;
  starterExerciseId: string | null;
}

export interface WorkoutSessionBlueprint {
  workout: WorkoutDefinition;
  exerciseDetails: Array<{
    entry: WorkoutExerciseEntry;
    exercise: WorkoutExerciseLibraryItem | null;
  }>;
  previousPerformance: Record<
    string,
    Record<
      string,
      {
        weight: number;
        reps: number;
        unit: WeightUnit;
        estimated1rm: number;
      }
    >
  >;
  settings: WorkoutWebSettings;
}

export interface WorkoutSocialCommentPreview {
  id: string;
  authorName: string;
  body: string;
}

export interface WorkoutSocialProfileCard extends SocialUserProfile {
  bio: string;
  privacySettings: Partial<SocialPrivacySettings>;
}

export interface WorkoutSocialFeedItem extends SocialPostEnriched {
  comments: WorkoutSocialCommentPreview[];
  focusLabel: string;
  focusAccent: string;
  privacyLevel: 'public' | 'friends' | 'private';
  privacyLabel: string;
  privacyAccent: string;
  privacyIcon: string;
  segmentHints: Array<'for-you' | 'following' | 'trending'>;
  coverVariant: 'metric' | 'hero' | 'recovery';
  coverValue: string;
  coverUnit: string;
  coverCaption: string;
  caption: string;
  hasNewPr: boolean;
  profile: WorkoutSocialProfileCard;
  reactionCounts: Record<'fire' | 'muscle' | 'clap', number>;
}

const SETTINGS_KEY = 'workouts.phase1.settings';
const RECENT_VIEWS_KEY = 'workouts.phase1.recent_views';
const FAVORITE_EXERCISES_KEY = 'workouts.phase3.favorite_exercises';

const DEFAULT_SETTINGS: WorkoutWebSettings = {
  displayName: 'The Curator',
  tierLabel: 'Elite Athlete',
  defaultFocus: 'strength',
  defaultRestSeconds: 90,
  autoStartRestTimer: true,
  voiceCommandsEnabled: false,
  defaultBarbellWeight: 45,
  availableEquipment: ['barbell', 'dumbbells', 'bodyweight'],
  weightUnit: 'lbs',
  distanceUnit: 'mi',
  bodyWeightUnit: 'lbs',
  workoutReminders: true,
  restTimerAlerts: true,
  prNotifications: true,
  gpsTrackingEnabled: true,
  formRecordingsEnabled: true,
};

const VALID_FOCUS = new Set<WorkoutPreferenceFocus>([
  'strength',
  'hypertrophy',
  'cardio',
  'mobility',
  'recovery',
]);

const VALID_EQUIPMENT = new Set<WorkoutEquipmentOption>([
  'barbell',
  'dumbbells',
  'kettlebells',
  'machines',
  'bands',
  'bodyweight',
]);

const EQUIPMENT_MATCHERS: Record<WorkoutEquipmentOption, RegExp[]> = {
  barbell: [/barbell/i, /\bbench press\b/i, /\bdeadlift\b/i, /\bsquat\b/i],
  dumbbells: [/dumbbell/i, /\bdb\b/i],
  kettlebells: [/kettlebell/i],
  machines: [/machine/i, /cable/i, /\brower\b/i, /\bbattle rope/i],
  bands: [/band/i],
  bodyweight: [
    /push[- ]?up/i,
    /pull[- ]?up/i,
    /dip/i,
    /plank/i,
    /run/i,
    /jump/i,
    /burpee/i,
    /mountain climber/i,
    /mobility/i,
    /stretch/i,
    /breath/i,
    /bodyweight/i,
  ],
};

const LOCAL_SOCIAL_PROFILE_ID = 'local-athlete';

function workoutDb() {
  ensureModuleMigrations('workouts');
  return getAdapter();
}

function ensureExerciseLibrarySeeded() {
  const db = workoutDb();
  if (getWorkoutExerciseCount(db) === 0) {
    seedWorkoutExerciseLibrary(db);
  }
  return db;
}

function nowIso(): string {
  return new Date().toISOString();
}

function readHubSetting(key: string): string | null {
  const db = workoutDb();
  const rows = db.query<{ value: string }>(
    'SELECT value FROM hub_settings WHERE key = ? LIMIT 1',
    [key],
  );
  return rows[0]?.value ?? null;
}

function writeHubSetting(key: string, value: string): void {
  const db = workoutDb();
  db.execute(
    `INSERT INTO hub_settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [key, value],
  );
}

function parseBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function parseNumber(value: unknown, fallback: number, min?: number, max?: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  if (typeof min === 'number' && value < min) return fallback;
  if (typeof max === 'number' && value > max) return fallback;
  return value;
}

function parseUnit<T extends string>(value: unknown, valid: readonly T[], fallback: T): T {
  return typeof value === 'string' && valid.includes(value as T) ? (value as T) : fallback;
}

function normalizeSettings(raw: unknown): WorkoutWebSettings {
  const data = (typeof raw === 'object' && raw != null
    ? raw
    : {}) as Partial<WorkoutWebSettings>;

  const equipment = Array.isArray(data.availableEquipment)
    ? data.availableEquipment.filter(
        (value): value is WorkoutEquipmentOption =>
          typeof value === 'string' && VALID_EQUIPMENT.has(value as WorkoutEquipmentOption),
      )
    : DEFAULT_SETTINGS.availableEquipment;

  return {
    displayName:
      typeof data.displayName === 'string' && data.displayName.trim().length > 0
        ? data.displayName.trim()
        : DEFAULT_SETTINGS.displayName,
    tierLabel:
      typeof data.tierLabel === 'string' && data.tierLabel.trim().length > 0
        ? data.tierLabel.trim()
        : DEFAULT_SETTINGS.tierLabel,
    defaultFocus:
      typeof data.defaultFocus === 'string' &&
      VALID_FOCUS.has(data.defaultFocus as WorkoutPreferenceFocus)
        ? (data.defaultFocus as WorkoutPreferenceFocus)
        : DEFAULT_SETTINGS.defaultFocus,
    defaultRestSeconds: parseNumber(
      data.defaultRestSeconds,
      DEFAULT_SETTINGS.defaultRestSeconds,
      15,
      600,
    ),
    autoStartRestTimer: parseBoolean(
      data.autoStartRestTimer,
      DEFAULT_SETTINGS.autoStartRestTimer,
    ),
    voiceCommandsEnabled: parseBoolean(
      data.voiceCommandsEnabled,
      DEFAULT_SETTINGS.voiceCommandsEnabled,
    ),
    defaultBarbellWeight: parseNumber(
      data.defaultBarbellWeight,
      DEFAULT_SETTINGS.defaultBarbellWeight,
      15,
      100,
    ),
    availableEquipment: equipment.length > 0 ? equipment : DEFAULT_SETTINGS.availableEquipment,
    weightUnit: parseUnit(data.weightUnit, ['lbs', 'kg'], DEFAULT_SETTINGS.weightUnit),
    distanceUnit: parseUnit(data.distanceUnit, ['mi', 'km'], DEFAULT_SETTINGS.distanceUnit),
    bodyWeightUnit: parseUnit(
      data.bodyWeightUnit,
      ['lbs', 'kg'],
      DEFAULT_SETTINGS.bodyWeightUnit,
    ),
    workoutReminders: parseBoolean(
      data.workoutReminders,
      DEFAULT_SETTINGS.workoutReminders,
    ),
    restTimerAlerts: parseBoolean(data.restTimerAlerts, DEFAULT_SETTINGS.restTimerAlerts),
    prNotifications: parseBoolean(data.prNotifications, DEFAULT_SETTINGS.prNotifications),
    gpsTrackingEnabled: parseBoolean(
      data.gpsTrackingEnabled,
      DEFAULT_SETTINGS.gpsTrackingEnabled,
    ),
    formRecordingsEnabled: parseBoolean(
      data.formRecordingsEnabled,
      DEFAULT_SETTINGS.formRecordingsEnabled,
    ),
  };
}

function parseStringArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((value): value is string => typeof value === 'string');
}

function parseRecentViews(raw: unknown): WorkoutRecentView[] {
  if (!Array.isArray(raw)) return [];

  const parsed = raw
    .map((item): WorkoutRecentView | null => {
      const view = item as Partial<WorkoutRecentView>;
      if (
        typeof view.id !== 'string' ||
        typeof view.type !== 'string' ||
        typeof view.title !== 'string' ||
        typeof view.route !== 'string' ||
        typeof view.seenAt !== 'string'
      ) {
        return null;
      }

      return {
        id: view.id,
        type:
          view.type === 'program' || view.type === 'exercise'
            ? view.type
            : 'workout',
        title: view.title,
        subtitle: typeof view.subtitle === 'string' ? view.subtitle : undefined,
        route: view.route,
        category: typeof view.category === 'string' ? view.category : null,
        seenAt: view.seenAt,
      };
    })
    .filter((item): item is WorkoutRecentView => item !== null);

  return parsed
    .sort((left, right) => right.seenAt.localeCompare(left.seenAt))
    .slice(0, 6);
}

function getWorkoutWebSettings(): WorkoutWebSettings {
  const raw = readHubSetting(SETTINGS_KEY);
  if (!raw) return DEFAULT_SETTINGS;

  try {
    return normalizeSettings(JSON.parse(raw));
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function getWorkoutRecentViews(): WorkoutRecentView[] {
  const raw = readHubSetting(RECENT_VIEWS_KEY);
  if (!raw) return [];

  try {
    return parseRecentViews(JSON.parse(raw));
  } catch {
    return [];
  }
}

function pushWorkoutRecentView(view: Omit<WorkoutRecentView, 'seenAt'>): WorkoutRecentView[] {
  const next: WorkoutRecentView = {
    ...view,
    seenAt: nowIso(),
  };

  const merged = [
    next,
    ...getWorkoutRecentViews().filter(
      (item) => !(item.type === next.type && item.id === next.id),
    ),
  ].slice(0, 6);

  writeHubSetting(RECENT_VIEWS_KEY, JSON.stringify(merged));
  return merged;
}

function getFavoriteWorkoutExercises(): string[] {
  const raw = readHubSetting(FAVORITE_EXERCISES_KEY);
  if (!raw) return [];

  try {
    return parseStringArray(JSON.parse(raw));
  } catch {
    return [];
  }
}

function saveFavoriteWorkoutExercises(next: string[]): void {
  writeHubSetting(FAVORITE_EXERCISES_KEY, JSON.stringify(Array.from(new Set(next)).slice(0, 100)));
}

function revalidateWorkoutsPaths(extraPaths: string[] = []): void {
  const paths = new Set([
    '/workouts',
    '/workouts/explore',
    '/workouts/exercises',
    '/workouts/workouts',
    '/workouts/programs',
    '/workouts/history',
    '/workouts/progress',
    '/workouts/settings',
    '/workouts/recovery',
    '/workouts/measurements',
    '/workouts/photos',
    '/workouts/overload',
    '/workouts/social',
    '/workouts/generate',
    ...extraPaths,
  ]);

  for (const path of paths) {
    revalidatePath(path);
  }
}

function sessionDurationMinutes(session: WorkoutSession): number {
  if (!session.completedAt) return 0;
  return Math.max(
    0,
    Math.round(
      (new Date(session.completedAt).getTime() - new Date(session.startedAt).getTime()) /
        60000,
    ),
  );
}

function buildStreakInfo(sessions: WorkoutSession[]): StreakInfo {
  const completedDates = Array.from(
    new Set(
      sessions
        .filter((session) => session.completedAt)
        .map((session) => (session.completedAt as string).slice(0, 10)),
    ),
  ).sort((left, right) => right.localeCompare(left));

  if (completedDates.length === 0) {
    return { current: 0, longest: 0, lastWorkoutDate: null };
  }

  let longest = 1;
  let running = 1;
  for (let index = 1; index < completedDates.length; index += 1) {
    const previous = new Date(completedDates[index - 1]);
    const current = new Date(completedDates[index]);
    const diffDays = Math.round((previous.getTime() - current.getTime()) / 86400000);
    if (diffDays === 1) {
      running += 1;
      longest = Math.max(longest, running);
    } else {
      running = 1;
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  let current = 0;

  if (completedDates[0] === today || completedDates[0] === yesterday) {
    current = 1;
    for (let index = 1; index < completedDates.length; index += 1) {
      const previous = new Date(completedDates[index - 1]);
      const date = new Date(completedDates[index]);
      const diffDays = Math.round((previous.getTime() - date.getTime()) / 86400000);
      if (diffDays === 1) {
        current += 1;
      } else {
        break;
      }
    }
  }

  return {
    current,
    longest,
    lastWorkoutDate: completedDates[0],
  };
}

function buildWeeklySummaries(sessions: WorkoutSession[]): PeriodSummary[] {
  const buckets = new Map<string, PeriodSummary>();

  for (const session of sessions) {
    const date = new Date(session.completedAt ?? session.startedAt);
    date.setUTCHours(0, 0, 0, 0);
    const mondayOffset = (date.getUTCDay() + 6) % 7;
    date.setUTCDate(date.getUTCDate() - mondayOffset);
    const key = date.toISOString().slice(0, 10);
    const current = buckets.get(key) ?? {
      label: `Week of ${date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      })}`,
      sessions: 0,
      totalMinutes: 0,
      totalReps: 0,
    };

    current.sessions += 1;
    current.totalMinutes += sessionDurationMinutes(session);
    current.totalReps += session.exercisesCompleted.reduce(
      (sum, exercise) => sum + (exercise.repsCompleted ?? 0),
      0,
    );
    buckets.set(key, current);
  }

  return Array.from(buckets.entries())
    .sort((left, right) => right[0].localeCompare(left[0]))
    .slice(0, 8)
    .map(([, summary]) => summary)
    .reverse();
}

function buildVolumeStats(
  sessions: WorkoutSession[],
  exercises: Map<string, WorkoutExerciseLibraryItem>,
): VolumeStats {
  const byMuscleGroup: Record<string, number> = {};

  let totalExercises = 0;
  let totalSets = 0;
  let totalReps = 0;
  let totalDurationMinutes = 0;

  for (const session of sessions) {
    totalDurationMinutes += sessionDurationMinutes(session);

    for (const exercise of session.exercisesCompleted) {
      totalExercises += 1;
      totalSets += exercise.setsCompleted;
      totalReps += exercise.repsCompleted ?? 0;

      const definition = exercises.get(exercise.exerciseId);
      for (const muscleGroup of definition?.muscleGroups ?? []) {
        byMuscleGroup[muscleGroup] =
          (byMuscleGroup[muscleGroup] ?? 0) + Math.max(exercise.setsCompleted, 1);
      }
    }
  }

  return {
    totalSessions: sessions.length,
    totalExercises,
    totalSets,
    totalReps,
    totalDurationMinutes,
    byMuscleGroup,
  };
}

function buildPersonalRecords(
  sessions: WorkoutSession[],
  exercises: Map<string, WorkoutExerciseLibraryItem>,
): PersonalRecord[] {
  const records = new Map<string, PersonalRecord>();

  for (const session of sessions) {
    for (const exercise of session.exercisesCompleted) {
      const previous = records.get(exercise.exerciseId);
      const next: PersonalRecord = {
        exerciseId: exercise.exerciseId,
        exerciseName: exercises.get(exercise.exerciseId)?.name ?? exercise.exerciseId,
        maxReps: Math.max(previous?.maxReps ?? 0, exercise.repsCompleted ?? 0),
        maxSets: Math.max(previous?.maxSets ?? 0, exercise.setsCompleted),
        maxDuration: Math.max(previous?.maxDuration ?? 0, exercise.durationActual ?? 0) || null,
        achievedAt: session.completedAt ?? session.startedAt,
      };
      records.set(exercise.exerciseId, next);
    }
  }

  return Array.from(records.values())
    .sort(
      (left, right) =>
        new Date(right.achievedAt).getTime() - new Date(left.achievedAt).getTime(),
    )
    .slice(0, 12);
}

function buildHistoryIntensityCells(history: WorkoutHistoryEntry[]) {
  const byDate = new Map<string, number>();
  for (const entry of history) {
    const key = entry.date.slice(0, 10);
    const current = byDate.get(key) ?? 0;
    byDate.set(key, current + Math.max(entry.totalReps, entry.exercisesCompleted * 12));
  }

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const values: Array<{ key: string; label: string; value: number }> = [];

  for (let index = 83; index >= 0; index -= 1) {
    const date = new Date(today);
    date.setUTCDate(today.getUTCDate() - index);
    const key = date.toISOString().slice(0, 10);
    const raw = byDate.get(key) ?? 0;
    values.push({
      key,
      label: key,
      value: Math.min(100, raw),
    });
  }

  return values;
}

function inferWorkoutCategory(
  workout: WorkoutDefinition,
  exercisesById: Record<string, WorkoutExerciseLibraryItem>,
): WorkoutCategory | null {
  const counts = new Map<WorkoutCategory, number>();

  for (const entry of workout.exercises) {
    const category = exercisesById[entry.exerciseId]?.category ?? entry.category;
    counts.set(category, (counts.get(category) ?? 0) + 1);
  }

  let top: WorkoutCategory | null = null;
  let max = 0;
  for (const [category, count] of counts) {
    if (count > max) {
      top = category;
      max = count;
    }
  }

  return top;
}

function inferEquipmentOptions(
  exercise: Pick<WorkoutExerciseLibraryItem, 'name' | 'description' | 'category'>,
): WorkoutEquipmentOption[] {
  const haystack = `${exercise.name} ${exercise.description}`.toLowerCase();
  const matches = (Object.keys(EQUIPMENT_MATCHERS) as WorkoutEquipmentOption[])
    .filter((key) => EQUIPMENT_MATCHERS[key].some((pattern) => pattern.test(haystack)));

  if (matches.length > 0) return matches;
  if (
    exercise.category === 'cardio' ||
    exercise.category === 'mobility' ||
    exercise.category === 'recovery'
  ) {
    return ['bodyweight'];
  }

  return ['dumbbells'];
}

function getPrimaryEquipmentLabel(
  exercise: Pick<WorkoutExerciseLibraryItem, 'name' | 'description' | 'category'>,
): string {
  const [primary] = inferEquipmentOptions(exercise);
  return primary.replace(/_/g, ' ').replace(/\b\w/g, (token) => token.toUpperCase());
}

function buildEquipmentSummary(
  plan: WorkoutPlan,
  workoutsById: Record<string, WorkoutDefinition>,
  exercisesById: Record<string, WorkoutExerciseLibraryItem>,
): string[] {
  const equipment = new Map<string, number>();

  for (const week of plan.weeks) {
    for (const day of week.days) {
      if (!day.workout_id) continue;
      const workout = workoutsById[day.workout_id];
      if (!workout) continue;

      for (const entry of workout.exercises) {
        const exercise = exercisesById[entry.exerciseId];
        if (!exercise) continue;
        const label = getPrimaryEquipmentLabel(exercise);
        equipment.set(label, (equipment.get(label) ?? 0) + 1);
      }
    }
  }

  return Array.from(equipment.entries())
    .sort((left, right) => right[1] - left[1])
    .slice(0, 3)
    .map(([label]) => label);
}

function getFocusAccent(focus: string): string {
  if (focus === 'cardio') return '#8BCFF0';
  if (focus === 'recovery' || focus === 'mobility') return '#30D158';
  if (focus === 'hypertrophy') return '#FF7A59';
  return '#C9894D';
}

function buildSessionMuscleData(
  sessions: WorkoutSession[],
  exerciseLookup: Map<string, WorkoutExerciseLibraryItem>,
) {
  return sessions
    .map((session) => {
      if (!session.completedAt) return null;

      const volumeByMuscle = new Map<
        MuscleGroup,
        {
          totalSets: number;
          totalReps: number;
          isPrimary: boolean;
        }
      >();

      for (const completed of session.exercisesCompleted) {
        if (completed.skipped) continue;
        const exercise = exerciseLookup.get(completed.exerciseId);
        if (!exercise) continue;

        exercise.muscleGroups.forEach((muscleGroup, index) => {
          const current = volumeByMuscle.get(muscleGroup) ?? {
            totalSets: 0,
            totalReps: 0,
            isPrimary: false,
          };

          current.totalSets += Math.max(completed.setsCompleted, 1);
          current.totalReps += completed.repsCompleted ?? 0;
          current.isPrimary = current.isPrimary || index === 0;
          volumeByMuscle.set(muscleGroup, current);
        });
      }

      return {
        sessionId: session.id,
        completedAt: session.completedAt,
        muscleVolume: Array.from(volumeByMuscle.entries()).map(([muscleGroup, data]) => ({
          muscleGroup,
          totalSets: data.totalSets,
          totalReps: data.totalReps,
          isPrimary: data.isPrimary,
          avgIntensityPct: null,
        })),
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);
}

function serializePreviousPerformance(
  workoutId: string,
): WorkoutSessionBlueprint['previousPerformance'] {
  const db = ensureExerciseLibrarySeeded();
  const map = getPreviousPerformance(db, workoutId, '__web-preview__');
  const result: WorkoutSessionBlueprint['previousPerformance'] = {};

  for (const [exerciseId, sets] of map.entries()) {
    result[exerciseId] = {};
    for (const [setNumber, value] of sets.entries()) {
      result[exerciseId][String(setNumber)] = value;
    }
  }

  return result;
}

function serializeCompletedExercises(
  completed: Array<{
    exercise_id: string;
    sets_completed: number;
    reps_completed: number | null;
    duration_actual: number | null;
    skipped: boolean;
  }>,
): CompletedExercise[] {
  return completed.map((entry) => ({
    exerciseId: entry.exercise_id,
    setsCompleted: entry.sets_completed,
    repsCompleted: entry.reps_completed,
    durationActual: entry.duration_actual,
    skipped: entry.skipped,
  }));
}

function buildSocialPrivacyPresentation(settings: Partial<SocialPrivacySettings>) {
  const normalized = normalizePrivacySettings(settings);

  if (!normalized.profileVisible) {
    return {
      privacyLevel: 'private' as const,
      privacyLabel: 'Private',
      privacyAccent: '#FF453A',
      privacyIcon: 'lock',
    };
  }

  if (!normalized.shareWeightDetails) {
    return {
      privacyLevel: 'friends' as const,
      privacyLabel: 'Friends',
      privacyAccent: '#30D158',
      privacyIcon: 'groups',
    };
  }

  return {
    privacyLevel: 'public' as const,
    privacyLabel: 'Public',
    privacyAccent: '#8BCFF0',
    privacyIcon: 'public',
  };
}

function buildFocusPresentation(card: WorkoutSummaryCard) {
  const muscle = card.muscleGroups[0] ?? 'full_body';
  return {
    focusLabel: muscle.replace(/_/g, ' '),
    focusAccent:
      muscle === 'full_body' ? '#C9894D' : getFocusAccent(muscle === 'core' ? 'hypertrophy' : 'strength'),
  };
}

function buildLocalSocialProfile(completedSessions: WorkoutSession[]): WorkoutSocialProfileCard {
  const settings = getWorkoutWebSettings();
  const streaks = buildStreakInfo(completedSessions);

  const earliest = completedSessions.reduce<string | null>((min, session) => {
    const started = session.startedAt;
    return min === null || started < min ? started : min;
  }, null);

  return {
    userId: LOCAL_SOCIAL_PROFILE_ID,
    displayName: settings.displayName,
    avatarUrl: null,
    memberSince: earliest ?? nowIso(),
    totalWorkouts: completedSessions.length,
    currentStreak: streaks.current,
    // Honest zeros: workouts social is device-local; there is no server
    // community, so follower counts and engagement cannot exist yet.
    followerCount: 0,
    followingCount: 0,
    isFollowedByMe: false,
    bio: '',
    privacySettings: normalizePrivacySettings({ shareWeightDetails: false }),
  };
}

function buildLocalSocialPosts(
  db: ReturnType<typeof workoutDb>,
  sessions: WorkoutSession[],
  profile: WorkoutSocialProfileCard,
): WorkoutSocialFeedItem[] {
  const workoutsById = new Map(getWorkouts(db, { limit: 300 }).map((workout) => [workout.id, workout]));

  return sessions
    .slice(0, 8)
    .map((session): WorkoutSocialFeedItem | null => {
      const summary =
        buildWorkoutSummary(db, session.id) ??
        (() => {
          const workout = workoutsById.get(session.workoutId);
          return workout
            ? {
                sessionId: session.id,
                title: workout.title,
                date: session.completedAt ?? session.startedAt,
                durationMinutes: sessionDurationMinutes(session),
                exerciseCount: session.exercisesCompleted.length,
                totalSets: session.exercisesCompleted.reduce(
                  (sum, entry) => sum + entry.setsCompleted,
                  0,
                ),
                totalReps: session.exercisesCompleted.reduce(
                  (sum, entry) => sum + (entry.repsCompleted ?? 0),
                  0,
                ),
                totalVolume: 0,
                prsHit: [],
                muscleGroups: [],
              }
            : null;
        })();

      if (!summary) return null;

      const privacySettings = profile.privacySettings;
      const post: SocialPost = {
        id: `local-${session.id}`,
        userId: profile.userId,
        sessionId: session.id,
        content: applyPrivacyFilter(summary, privacySettings),
        privacySettings,
        createdAt: summary.date,
      };

      // Honest zeros: reactions and comments require a server community that
      // does not exist yet; local share cards carry no fabricated engagement.
      const reactionCounts: Record<'fire' | 'muscle' | 'clap', number> = {
        fire: 0,
        muscle: 0,
        clap: 0,
      };
      const comments: WorkoutSocialCommentPreview[] = [];
      const enriched = enrichPost(
        post,
        0,
        0,
        false,
        profile.displayName,
        profile.avatarUrl,
      );
      const privacy = buildSocialPrivacyPresentation(privacySettings);
      const focus = buildFocusPresentation(post.content);

      return {
        ...enriched,
        comments,
        segmentHints: ['for-you'],
        coverVariant: post.content.prsHit.length > 0 ? 'metric' : 'hero',
        coverValue:
          post.content.totalVolume > 0
            ? `${Math.round(post.content.totalVolume / 100) / 10}`
            : `${post.content.durationMinutes}`,
        coverUnit: post.content.totalVolume > 0 ? 'k lb' : 'min',
        coverCaption:
          post.content.totalVolume > 0 ? 'Total session volume' : 'Session duration',
        caption:
          post.content.prsHit.length > 0
            ? `New PR energy in ${post.content.title}.`
            : `Locked in another ${post.content.title.toLowerCase()} session.`,
        hasNewPr: post.content.prsHit.length > 0,
        profile,
        reactionCounts,
        ...privacy,
        ...focus,
      };
    })
    .filter((item): item is WorkoutSocialFeedItem => item !== null);
}

function buildWorkoutSocialSnapshot() {
  const db = ensureExerciseLibrarySeeded();
  const completedSessions = getWorkoutSessions(db, { onlyCompleted: true, limit: 20 });
  const localProfile = buildLocalSocialProfile(completedSessions);
  const profiles: Record<string, WorkoutSocialProfileCard> = {
    [localProfile.userId]: localProfile,
  };

  // Device-local only: the feed is the user's own completed sessions rendered
  // as share cards. No fabricated athletes, posts, or engagement.
  const feed = buildLocalSocialPosts(db, completedSessions, localProfile).sort(
    (left, right) => right.createdAt.localeCompare(left.createdAt),
  );

  return {
    profiles,
    feed,
    composerSessionId: completedSessions[0]?.id ?? null,
  };
}

export async function fetchWorkoutExercises(
  filters: WorkoutExerciseFilters = {},
): Promise<WorkoutExerciseLibraryItem[]> {
  const db = ensureExerciseLibrarySeeded();
  return getWorkoutExercises(db, filters);
}

export async function fetchWorkoutExercise(
  exerciseId: string,
): Promise<WorkoutExerciseLibraryItem | null> {
  const db = ensureExerciseLibrarySeeded();
  return getWorkoutExerciseById(db, exerciseId);
}

export async function fetchWorkoutExerciseDetail(exerciseId: string) {
  const db = ensureExerciseLibrarySeeded();
  const exercise = getWorkoutExerciseById(db, exerciseId);
  if (!exercise) return null;

  const videos = getExerciseVideos(db, exerciseId);
  const primaryVideo = getPrimaryVideo(db, exerciseId);
  const history = getSetWeightsForExercise(db, exerciseId, { limit: 120 });
  const latestOneRM = getLatest1RM(db, exerciseId);
  const relatedWorkouts = getWorkouts(db, { limit: 300 }).filter((workout) =>
    workout.exercises.some((entry) => entry.exerciseId === exerciseId),
  );
  const favorite = getFavoriteWorkoutExercises().includes(exerciseId);

  const fallbackVideos: ExerciseVideo[] =
    videos.length === 0 && exercise.videoUrl
      ? [
          {
            id: `fallback-${exercise.id}`,
            exerciseId: exercise.id,
            trainerId: 'local',
            videoUri: exercise.videoUrl,
            thumbnailUri: exercise.thumbnailUrl,
            angle: 'front',
            durationSeconds: 0,
            fileSizeBytes: 0,
            width: 0,
            height: 0,
            sortOrder: 0,
            isPrimary: true,
            storageType: 'local',
            notes: '',
            createdAt: exercise.createdAt,
          },
        ]
      : [];

  return {
    exercise,
    videos: primaryVideo
      ? [primaryVideo, ...videos.filter((video) => video.id !== primaryVideo.id)]
      : videos.length > 0
        ? videos
        : fallbackVideos,
    history,
    latestOneRM,
    relatedWorkouts,
    favorite,
    equipmentLabel: getPrimaryEquipmentLabel(exercise),
  };
}

export async function fetchWorkout(
  workoutId: string,
): Promise<WorkoutDefinition | null> {
  const db = ensureExerciseLibrarySeeded();
  return getWorkoutById(db, workoutId);
}

export async function fetchWorkouts(options?: {
  search?: string;
  difficulty?: WorkoutDifficulty;
}) {
  const db = ensureExerciseLibrarySeeded();
  return getWorkouts(db, {
    search: options?.search,
    difficulty: options?.difficulty ?? null,
    limit: 80,
  });
}

export async function fetchWorkoutDashboard(): Promise<DashboardPayload> {
  const db = ensureExerciseLibrarySeeded();
  return {
    dashboard: getWorkoutDashboard(db),
    metrics: getWorkoutMetrics(db),
    categories: getWorkoutCategoryCounts(db),
  };
}

export async function fetchWorkoutHistoryWithTitles(
  limit = 10,
): Promise<WorkoutHistoryEntry[]> {
  const db = ensureExerciseLibrarySeeded();
  const sessions = getWorkoutSessions(db, { onlyCompleted: true, limit });
  const workouts = new Map(
    getWorkouts(db, { limit: 500 }).map((workout) => [workout.id, workout]),
  );

  return sessions.map((session) => {
    const workout = workouts.get(session.workoutId);
    return {
      sessionId: session.id,
      workoutId: session.workoutId,
      workoutTitle: workout?.title ?? 'Workout',
      date: session.completedAt ?? session.startedAt,
      durationMinutes: sessionDurationMinutes(session),
      exercisesCompleted: session.exercisesCompleted.filter((exercise) => !exercise.skipped).length,
      exercisesTotal: workout?.exercises.length ?? session.exercisesCompleted.length,
      totalReps: session.exercisesCompleted.reduce(
        (sum, exercise) => sum + (exercise.repsCompleted ?? 0),
        0,
      ),
    };
  });
}

export async function fetchWorkoutDashboardPageData() {
  const [dashboard, history, plans] = await Promise.all([
    fetchWorkoutDashboard(),
    fetchWorkoutHistoryWithTitles(16),
    fetchWorkoutPlans(),
  ]);

  return {
    ...dashboard,
    history,
    plans,
    recentViews: getWorkoutRecentViews(),
    settings: getWorkoutWebSettings(),
  };
}

export async function fetchWorkoutProgress(): Promise<ProgressPayload> {
  const db = ensureExerciseLibrarySeeded();
  const sessions = getWorkoutSessions(db, { onlyCompleted: true, limit: 365 });
  const exerciseMap = new Map(
    getWorkoutExercises(db, { limit: 500 }).map((exercise) => [exercise.id, exercise]),
  );

  return {
    streaks: buildStreakInfo(sessions),
    volume: buildVolumeStats(sessions, exerciseMap),
    personalRecords: buildPersonalRecords(sessions, exerciseMap),
    weeklySummaries: buildWeeklySummaries(sessions),
  };
}

export async function fetchWorkoutHistoryPageData() {
  const [history, progress] = await Promise.all([
    fetchWorkoutHistoryWithTitles(200),
    fetchWorkoutProgress(),
  ]);

  return {
    history,
    intensityCells: buildHistoryIntensityCells(history),
    weekly: progress.weeklySummaries,
  };
}

export async function fetchWorkoutPlans(): Promise<WorkoutPlanSummary[]> {
  const db = ensureExerciseLibrarySeeded();
  const plans = getWorkoutPlans(db, { limit: 24 });
  const activeSubscription = getActivePlanSubscription(db);
  const completedWorkoutIds = new Set(
    getWorkoutSessions(db, { onlyCompleted: true, limit: 500 }).map(
      (session) => session.workoutId,
    ),
  );

  return plans.map((plan) => {
    const progress = getPlanProgress(plan, completedWorkoutIds);
    const frequency = Math.max(
      0,
      ...plan.weeks.map((week) =>
        week.days.filter((day) => !day.rest_day && day.workout_id).length,
      ),
    );

    return {
      id: plan.id,
      title: plan.title,
      description: plan.description,
      weekCount: plan.weeks.length,
      frequency,
      workoutCount: getAllPlanWorkoutIds(plan).length,
      isActive: activeSubscription?.planId === plan.id,
      progressPercent: activeSubscription?.planId === plan.id ? progress.percent : null,
      weeks: plan.weeks,
    };
  });
}

export async function fetchWorkoutPlanDetail(planId: string) {
  const db = ensureExerciseLibrarySeeded();
  const plan = getWorkoutPlanById(db, planId);
  if (!plan) return null;

  const workouts = getWorkouts(db, { limit: 500 });
  const exercises = getWorkoutExercises(db, { limit: 500 });
  const workoutsById = Object.fromEntries(workouts.map((workout) => [workout.id, workout]));
  const exercisesById = Object.fromEntries(
    exercises.map((exercise) => [exercise.id, exercise]),
  );
  const subscription = getActivePlanSubscription(db);
  const completedWorkoutIds = new Set(
    getWorkoutSessions(db, { onlyCompleted: true, limit: 500 }).map(
      (session) => session.workoutId,
    ),
  );
  const progress = getPlanProgress(plan, completedWorkoutIds);
  const isSubscribed = subscription?.planId === plan.id;
  const position =
    isSubscribed && subscription
      ? getCurrentPlanPosition(plan, subscription.startedAt)
      : null;
  const activeWeek = position
    ? plan.weeks.find((week) => week.week_number === position.weekNumber) ?? null
    : null;

  return {
    plan,
    isSubscribed,
    progress,
    position,
    activeWeek,
    workoutsById,
    equipmentSummary: buildEquipmentSummary(plan, workoutsById, exercisesById),
    frequency: Math.max(
      0,
      ...plan.weeks.map((week) =>
        week.days.filter((day) => !day.rest_day && day.workout_id).length,
      ),
    ),
    workoutCount: getAllPlanWorkoutIds(plan).length,
  };
}

export async function fetchWorkoutLibraryData() {
  const db = ensureExerciseLibrarySeeded();
  return {
    categories: getWorkoutCategoryCounts(db),
    plans: await fetchWorkoutPlans(),
  };
}

export async function fetchWorkoutExploreData() {
  const db = ensureExerciseLibrarySeeded();
  const exercises = getWorkoutExercises(db, { limit: 240 });
  const workouts = getWorkouts(db, { limit: 80 });
  const workoutPlans = await fetchWorkoutPlans();
  const favorites = new Set(getFavoriteWorkoutExercises());
  const settings = getWorkoutWebSettings();
  const recentViews = getWorkoutRecentViews();
  const exercisesById = Object.fromEntries(exercises.map((exercise) => [exercise.id, exercise]));

  const featuredPlan = workoutPlans[0] ?? null;
  const featuredWorkout = workouts[0] ?? null;
  const featured =
    featuredPlan != null
      ? {
          id: featuredPlan.id,
          type: 'program' as const,
          title: featuredPlan.title,
          subtitle: `${featuredPlan.weekCount} weeks · ${featuredPlan.frequency} days / week`,
          route: `/workouts/programs/${featuredPlan.id}`,
        }
      : featuredWorkout
        ? {
            id: featuredWorkout.id,
            type: 'workout' as const,
            title: featuredWorkout.title,
            subtitle: `${featuredWorkout.exercises.length} exercises · ${featuredWorkout.difficulty}`,
            route: `/workouts/session?workoutId=${featuredWorkout.id}`,
          }
        : null;

  const focusCategory: WorkoutCategory | null =
    settings.defaultFocus === 'cardio'
      ? 'cardio'
      : settings.defaultFocus === 'mobility'
        ? 'mobility'
        : settings.defaultFocus === 'recovery'
          ? 'recovery'
          : 'strength';

  const trending = exercises
    .slice()
    .sort((left, right) => {
      const leftScore =
        (favorites.has(left.id) ? 15 : 0) +
        (left.videoUrl ? 10 : 0) +
        left.muscleGroups.length * 2;
      const rightScore =
        (favorites.has(right.id) ? 15 : 0) +
        (right.videoUrl ? 10 : 0) +
        right.muscleGroups.length * 2;
      return rightScore - leftScore;
    })
    .slice(0, 8);

  const forYou = exercises
    .filter((exercise) => favorites.has(exercise.id) || exercise.category === focusCategory)
    .slice(0, 8);

  return {
    categories: getWorkoutCategoryCounts(db),
    featured,
    workouts: workouts.map((workout) => ({
      ...workout,
      inferredCategory: inferWorkoutCategory(workout, exercisesById),
    })),
    programs: workoutPlans,
    trending,
    forYou: forYou.length > 0 ? forYou : trending,
    recentViews,
    favorites: Array.from(favorites),
    settings,
  };
}

export async function fetchWorkoutSessionBlueprint(
  workoutId: string,
): Promise<WorkoutSessionBlueprint | null> {
  const db = ensureExerciseLibrarySeeded();
  const workout = getWorkoutById(db, workoutId);
  if (!workout) return null;

  return {
    workout,
    exerciseDetails: workout.exercises.map((entry) => ({
      entry,
      exercise: getWorkoutExerciseById(db, entry.exerciseId),
    })),
    previousPerformance: serializePreviousPerformance(workoutId),
    settings: getWorkoutWebSettings(),
  };
}

export async function fetchWorkoutBuilderSeed(
  options: {
    workoutId?: string | null;
    exerciseId?: string | null;
  } = {},
): Promise<WorkoutBuilderSeed> {
  const db = ensureExerciseLibrarySeeded();
  const workout =
    options.workoutId && options.workoutId.length > 0
      ? getWorkoutById(db, options.workoutId)
      : null;

  return {
    workout,
    exercises: getWorkoutExercises(db, { limit: 500 }),
    settings: getWorkoutWebSettings(),
    starterExerciseId:
      !workout && options.exerciseId && options.exerciseId.length > 0
        ? options.exerciseId
        : null,
  };
}

export async function fetchWorkoutToolDefaults() {
  const settings = getWorkoutWebSettings();
  return {
    barWeight: settings.defaultBarbellWeight,
    unit: settings.weightUnit,
    restSeconds: settings.defaultRestSeconds,
  };
}

export async function fetchWorkoutProgressPageData() {
  const db = ensureExerciseLibrarySeeded();
  const [progress] = await Promise.all([fetchWorkoutProgress()]);
  const measurements = getBodyMeasurements(db, { type: 'weight', limit: 24 });
  const photoCount = getProgressPhotoCount(db);

  return {
    ...progress,
    measurements,
    photoCount,
    routeTiles: [
      {
        href: '/workouts/measurements',
        icon: 'straighten',
        title: 'Body Measurements',
        description: 'Weight, circumference, and body-composition trend logs.',
      },
      {
        href: '/workouts/photos',
        icon: 'photo_library',
        title: 'Progress Photos',
        description: 'Visual comparisons across your training blocks.',
      },
      {
        href: '/workouts/recovery',
        icon: 'health_and_safety',
        title: 'Recovery Heatmap',
        description: 'Muscle-readiness scores derived from your recent training.',
      },
      {
        href: '/workouts/overload',
        icon: 'trending_up',
        title: 'Progressive Overload',
        description: 'Default rules, overrides, and next-session suggestions.',
      },
    ],
  };
}

export async function fetchWorkoutRecoveryView() {
  const db = ensureExerciseLibrarySeeded();
  const sessions = getWorkoutSessions(db, { onlyCompleted: true, limit: 120 });
  const exercises = getWorkoutExercises(db, { limit: 500 });
  const exerciseLookup = new Map(exercises.map((exercise) => [exercise.id, exercise]));
  const recoveryMap = buildRecoveryMap(buildSessionMuscleData(sessions, exerciseLookup));
  const suggestion = getBestToTrain(recoveryMap);

  return {
    suggestion,
    recovery: Array.from(recoveryMap.values())
      .filter((entry) => entry.muscleGroup !== 'full_body')
      .sort((left, right) => right.score - left.score),
  };
}

export async function fetchWorkoutSettings() {
  return getWorkoutWebSettings();
}

export async function fetchWorkoutMeasurementsView(type = 'weight') {
  const db = workoutDb();
  return {
    settings: getWorkoutWebSettings(),
    entries: getBodyMeasurements(db, { type, limit: 120 }),
  };
}

export async function fetchWorkoutPhotosView(viewType?: PhotoViewType | 'all') {
  const db = workoutDb();
  const photos =
    !viewType || viewType === 'all' ? getProgressPhotos(db) : getProgressPhotos(db, viewType);

  return {
    photos,
    allPhotos: getProgressPhotos(db),
  };
}

export async function fetchWorkoutOverloadView() {
  const db = ensureExerciseLibrarySeeded();
  const rules = getOverloadRules(db);
  const exercises = getWorkoutExercises(db, { limit: 500 });
  const exerciseLookup = new Map(exercises.map((exercise) => [exercise.id, exercise]));
  const defaultRule =
    rules.find((rule) => rule.exerciseId === null && rule.isActive) ?? {
      id: '__builtin__',
      createdAt: nowIso(),
      updatedAt: nowIso(),
      ...DEFAULT_OVERLOAD_RULE,
    };

  const overrides = rules
    .filter((rule) => rule.exerciseId)
    .map((rule) => ({
      ...rule,
      exerciseName: exerciseLookup.get(rule.exerciseId ?? '')?.name ?? 'Exercise',
    }));

  const suggestions = exercises
    .map((exercise) => {
      const history = getExercisePerformanceHistory(db, exercise.id, undefined, 8);
      const rule =
        overrides.find((item) => item.exerciseId === exercise.id) ?? defaultRule;
      const suggestion = generateOverloadSuggestion(
        exercise.id,
        exercise.category,
        rule,
        history as ExercisePerformanceHistory,
      );

      if (!suggestion) return null;

      return {
        exercise,
        history,
        rule,
        suggestion,
      };
    })
    .filter(
      (
        item,
      ): item is {
        exercise: WorkoutExerciseLibraryItem;
        history: ExercisePerformanceHistory;
        rule: OverloadRule;
        suggestion: OverloadSuggestion;
      } => item !== null,
    )
    .slice(0, 8);

  return {
    defaultRule,
    overrides,
    suggestions,
    exercises,
  };
}

export async function fetchWorkoutSocialView() {
  return buildWorkoutSocialSnapshot();
}

export async function fetchWorkoutSocialProfile(userId: string) {
  const snapshot = buildWorkoutSocialSnapshot();
  const profile = snapshot.profiles[userId] ?? null;

  return {
    profile,
    profiles: snapshot.profiles,
    feed: snapshot.feed.filter((item) => item.userId === userId),
    composerSessionId: snapshot.composerSessionId,
  };
}

export async function doTrackWorkoutRecentView(
  view: Omit<WorkoutRecentView, 'seenAt'>,
) {
  const recentViews = pushWorkoutRecentView(view);
  revalidateWorkoutsPaths([view.route]);
  return recentViews;
}

export async function doToggleFavoriteWorkoutExercise(exerciseId: string) {
  const current = new Set(getFavoriteWorkoutExercises());
  if (current.has(exerciseId)) {
    current.delete(exerciseId);
  } else {
    current.add(exerciseId);
  }

  saveFavoriteWorkoutExercises(Array.from(current));
  revalidateWorkoutsPaths([`/workouts/exercises/${exerciseId}`]);
  return Array.from(current);
}

export async function doCreateWorkout(input: {
  title: string;
  description?: string;
  difficulty: WorkoutDifficulty;
  exercises: WorkoutExerciseEntry[];
}) {
  const db = ensureExerciseLibrarySeeded();
  const id = crypto.randomUUID();
  createWorkout(db, id, input);
  revalidateWorkoutsPaths([`/workouts/builder?workoutId=${id}`]);
  return id;
}

export async function doUpdateWorkout(
  workoutId: string,
  input: {
    title: string;
    description?: string;
    difficulty: WorkoutDifficulty;
    exercises: WorkoutExerciseEntry[];
  },
) {
  const db = ensureExerciseLibrarySeeded();
  updateWorkout(db, workoutId, input);
  revalidateWorkoutsPaths([
    `/workouts/session?workoutId=${workoutId}`,
    `/workouts/builder?workoutId=${workoutId}`,
  ]);
  return workoutId;
}

export async function doDeleteWorkout(workoutId: string) {
  const db = ensureExerciseLibrarySeeded();
  deleteWorkout(db, workoutId);
  revalidateWorkoutsPaths();
  return true;
}

export async function doCreateWorkoutSession(input: {
  workoutId: string;
  startedAt?: string;
}) {
  const db = ensureExerciseLibrarySeeded();
  const sessionId = crypto.randomUUID();
  createWorkoutSession(db, sessionId, {
    workoutId: input.workoutId,
    startedAt: input.startedAt ?? nowIso(),
    exercisesCompleted: [],
  });
  revalidateWorkoutsPaths([`/workouts/session?workoutId=${input.workoutId}`]);
  return sessionId;
}

export async function doRecordSetWeight(input: {
  sessionId: string;
  exerciseId: string;
  setNumber: number;
  weight: number;
  reps: number;
  unit: WeightUnit;
}) {
  const db = ensureExerciseLibrarySeeded();
  const estimated1rm = calculate1RM(input.weight, input.reps, 'epley');

  recordSetWeight(db, crypto.randomUUID(), {
    sessionId: input.sessionId,
    exerciseId: input.exerciseId,
    setNumber: input.setNumber,
    weight: input.weight,
    reps: input.reps,
    unit: input.unit,
    estimated1rm,
  });

  const latest = getLatest1RM(db, input.exerciseId);
  if (!latest || estimated1rm >= latest.estimated1rm) {
    record1RM(db, crypto.randomUUID(), {
      exerciseId: input.exerciseId,
      maxWeight: input.weight,
      maxReps: input.reps,
      estimated1rm,
      unit: input.unit,
      achievedAt: nowIso(),
    });
  }

  revalidateWorkoutsPaths();
  return estimated1rm;
}

export async function doCompleteWorkoutSession(input: {
  sessionId: string;
  workoutId: string;
  exercisesCompleted: Array<{
    exercise_id: string;
    sets_completed: number;
    reps_completed: number | null;
    duration_actual: number | null;
    skipped: boolean;
  }>;
}) {
  const db = ensureExerciseLibrarySeeded();
  completeWorkoutSession(db, input.sessionId, {
    completedAt: nowIso(),
    exercisesCompleted: serializeCompletedExercises(input.exercisesCompleted),
  });
  revalidateWorkoutsPaths([
    `/workouts/session?workoutId=${input.workoutId}`,
    `/workouts/history`,
    `/workouts/progress`,
  ]);
  return true;
}

export async function doToggleWorkoutPlanSubscription(planId: string) {
  const db = ensureExerciseLibrarySeeded();
  const active = getActivePlanSubscription(db);
  const isSubscribed = active?.planId === planId;

  if (isSubscribed) {
    unsubscribeFromPlan(db, planId);
  } else {
    subscribeToPlan(db, crypto.randomUUID(), planId);
  }

  revalidateWorkoutsPaths([`/workouts/programs/${planId}`]);
  return !isSubscribed;
}

export async function doGenerateWorkout(input: {
  goal: GenerationGoal;
  muscleFocus: string[];
  equipment: Array<
    'barbell' | 'dumbbells' | 'cables' | 'machines' | 'bodyweight' | 'bands' | 'kettlebell'
  >;
  durationMinutes: number;
  difficulty: WorkoutDifficulty;
}) {
  const db = ensureExerciseLibrarySeeded();
  const availableExercises = getWorkoutExercises(db, { limit: 500 });
  const recentSessions = getWorkoutSessions(db, { onlyCompleted: true, limit: 12 });
  const recentExerciseIds = new Set(
    recentSessions.flatMap((session) =>
      session.exercisesCompleted.map((exercise) => exercise.exerciseId),
    ),
  );

  const generatedWorkout = generateLocalWorkout(input, availableExercises, recentExerciseIds);
  if (!generatedWorkout) {
    return null;
  }

  const generationId = crypto.randomUUID();
  createGenerationEntry(db, generationId, {
    goal: input.goal,
    focus: input.muscleFocus.join(', '),
    equipment: input.equipment,
    difficulty: input.difficulty,
    durationMinutes: input.durationMinutes,
    generatedWorkoutJson: JSON.stringify(generatedWorkout),
    source: 'local',
  });

  return {
    generationId,
    workout: generatedWorkout,
  };
}

export async function doSaveGeneratedWorkout(input: {
  generationId: string;
  workout: GeneratedWorkout;
}) {
  const db = ensureExerciseLibrarySeeded();
  const workoutId = crypto.randomUUID();
  createWorkout(db, workoutId, {
    title: input.workout.title,
    description: input.workout.description,
    difficulty: input.workout.difficulty,
    exercises: input.workout.exercises,
    estimatedDuration: input.workout.estimatedDuration,
  });
  markGenerationAccepted(db, input.generationId);
  revalidateWorkoutsPaths([`/workouts/session?workoutId=${workoutId}`]);
  return workoutId;
}

export async function doSaveWorkoutSettings(settings: WorkoutWebSettings) {
  writeHubSetting(SETTINGS_KEY, JSON.stringify(normalizeSettings(settings)));
  revalidateWorkoutsPaths();
  return getWorkoutWebSettings();
}

export async function doCreateWorkoutMeasurement(input: {
  type: string;
  value: number;
  unit: string;
  measuredAt: string;
}) {
  const db = workoutDb();
  createBodyMeasurement(db, crypto.randomUUID(), input);
  revalidateWorkoutsPaths(['/workouts/measurements', '/workouts/progress']);
  return true;
}

export async function doDeleteWorkoutMeasurement(id: string) {
  const db = workoutDb();
  deleteBodyMeasurement(db, id);
  revalidateWorkoutsPaths(['/workouts/measurements', '/workouts/progress']);
  return true;
}

export async function doUploadWorkoutPhoto(input: {
  photoUri: string;
  viewType: PhotoViewType;
  notes?: string;
  takenAt: string;
  fileSizeBytes?: number;
  width?: number;
  height?: number;
}) {
  const db = workoutDb();
  const photo = createProgressPhoto(db, input);
  revalidateWorkoutsPaths(['/workouts/photos', '/workouts/progress']);
  return photo;
}

export async function doDeleteWorkoutPhoto(id: string) {
  const db = workoutDb();
  deleteProgressPhoto(db, id);
  revalidateWorkoutsPaths(['/workouts/photos', '/workouts/progress']);
  return true;
}

export async function doSaveWorkoutOverloadRule(input: {
  id?: string | null;
  exerciseId?: string | null;
  ruleType: OverloadRuleType;
  triggerCondition: OverloadTrigger;
  targetReps: number | null;
  incrementValue: number;
  incrementUnit: 'lbs' | 'kg' | 'reps' | 'percent';
  minSessions: number;
  isActive?: boolean;
}) {
  const db = ensureExerciseLibrarySeeded();

  if (input.id && input.id.length > 0 && input.id !== '__builtin__') {
    updateOverloadRule(db, input.id, {
      ruleType: input.ruleType,
      triggerCondition: input.triggerCondition,
      targetReps: input.targetReps,
      incrementValue: input.incrementValue,
      incrementUnit: input.incrementUnit,
      minSessions: input.minSessions,
      isActive: input.isActive ?? true,
    });
  } else {
    createOverloadRule(db, crypto.randomUUID(), {
      exerciseId: input.exerciseId ?? null,
      ruleType: input.ruleType,
      triggerCondition: input.triggerCondition,
      targetReps: input.targetReps,
      incrementValue: input.incrementValue,
      incrementUnit: input.incrementUnit,
      minSessions: input.minSessions,
    });
  }

  revalidateWorkoutsPaths(['/workouts/overload']);
  return true;
}

export async function doDeleteWorkoutOverloadRule(id: string) {
  const db = ensureExerciseLibrarySeeded();
  deleteOverloadRule(db, id);
  revalidateWorkoutsPaths(['/workouts/overload']);
  return true;
}

// ---------------------------------------------------------------------------
// CSV export (data ownership)
// ---------------------------------------------------------------------------

export async function fetchWorkoutHistoryCSV(): Promise<string> {
  return exportWorkoutHistoryCSV(workoutDb());
}

export async function fetchWorkoutSetWeightsCSV(): Promise<string> {
  return exportSetWeightsCSV(workoutDb());
}
