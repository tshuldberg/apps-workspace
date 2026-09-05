import type { DatabaseAdapter } from '@mylife/db';

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

export interface WorkoutPhaseOneSettings {
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

const SETTINGS_KEY = 'workouts.phase1.settings';
const RECENT_VIEWS_KEY = 'workouts.phase1.recent_views';
const FAVORITE_EXERCISES_KEY = 'workouts.phase3.favorite_exercises';
const PROGRAM_COVER_KEY_PREFIX = 'workouts.phase3.program_cover.';

const DEFAULT_SETTINGS: WorkoutPhaseOneSettings = {
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

function readHubSetting(db: DatabaseAdapter, key: string): string | null {
  const rows = db.query<{ value: string }>(
    'SELECT value FROM hub_settings WHERE key = ? LIMIT 1',
    [key],
  );
  return rows[0]?.value ?? null;
}

function writeHubSetting(db: DatabaseAdapter, key: string, value: string): void {
  db.execute(
    `INSERT INTO hub_settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [key, value],
  );
}

function parseBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function parseNumber(
  value: unknown,
  fallback: number,
  min?: number,
  max?: number,
): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  if (typeof min === 'number' && value < min) return fallback;
  if (typeof max === 'number' && value > max) return fallback;
  return value;
}

function parseUnit<T extends string>(
  value: unknown,
  valid: readonly T[],
  fallback: T,
): T {
  return typeof value === 'string' && valid.includes(value as T)
    ? (value as T)
    : fallback;
}

function normalizeSettings(raw: unknown): WorkoutPhaseOneSettings {
  const data = (typeof raw === 'object' && raw != null ? raw : {}) as Partial<WorkoutPhaseOneSettings>;

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
      typeof data.defaultFocus === 'string' && VALID_FOCUS.has(data.defaultFocus as WorkoutPreferenceFocus)
        ? (data.defaultFocus as WorkoutPreferenceFocus)
        : DEFAULT_SETTINGS.defaultFocus,
    defaultRestSeconds: parseNumber(data.defaultRestSeconds, DEFAULT_SETTINGS.defaultRestSeconds, 15, 600),
    autoStartRestTimer: parseBoolean(data.autoStartRestTimer, DEFAULT_SETTINGS.autoStartRestTimer),
    voiceCommandsEnabled: parseBoolean(data.voiceCommandsEnabled, DEFAULT_SETTINGS.voiceCommandsEnabled),
    defaultBarbellWeight: parseNumber(data.defaultBarbellWeight, DEFAULT_SETTINGS.defaultBarbellWeight, 15, 100),
    availableEquipment: equipment.length > 0 ? equipment : DEFAULT_SETTINGS.availableEquipment,
    weightUnit: parseUnit(data.weightUnit, ['lbs', 'kg'], DEFAULT_SETTINGS.weightUnit),
    distanceUnit: parseUnit(data.distanceUnit, ['mi', 'km'], DEFAULT_SETTINGS.distanceUnit),
    bodyWeightUnit: parseUnit(data.bodyWeightUnit, ['lbs', 'kg'], DEFAULT_SETTINGS.bodyWeightUnit),
    workoutReminders: parseBoolean(data.workoutReminders, DEFAULT_SETTINGS.workoutReminders),
    restTimerAlerts: parseBoolean(data.restTimerAlerts, DEFAULT_SETTINGS.restTimerAlerts),
    prNotifications: parseBoolean(data.prNotifications, DEFAULT_SETTINGS.prNotifications),
    gpsTrackingEnabled: parseBoolean(data.gpsTrackingEnabled, DEFAULT_SETTINGS.gpsTrackingEnabled),
    formRecordingsEnabled: parseBoolean(data.formRecordingsEnabled, DEFAULT_SETTINGS.formRecordingsEnabled),
  };
}

function parseRecentViews(raw: unknown): WorkoutRecentView[] {
  if (!Array.isArray(raw)) return [];

  const parsed = raw.map((item): WorkoutRecentView | null => {
      const view = item as Partial<WorkoutRecentView>;
      if (
        typeof view?.id !== 'string' ||
        typeof view?.type !== 'string' ||
        typeof view?.title !== 'string' ||
        typeof view?.route !== 'string' ||
        typeof view?.seenAt !== 'string'
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
    .slice(0, 5);
}

export function getWorkoutPhaseOneSettings(db: DatabaseAdapter): WorkoutPhaseOneSettings {
  const raw = readHubSetting(db, SETTINGS_KEY);
  if (!raw) return DEFAULT_SETTINGS;

  try {
    return normalizeSettings(JSON.parse(raw));
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveWorkoutPhaseOneSettings(
  db: DatabaseAdapter,
  settings: WorkoutPhaseOneSettings,
): void {
  writeHubSetting(db, SETTINGS_KEY, JSON.stringify(normalizeSettings(settings)));
}

export function getWorkoutRecentViews(db: DatabaseAdapter): WorkoutRecentView[] {
  const raw = readHubSetting(db, RECENT_VIEWS_KEY);
  if (!raw) return [];

  try {
    return parseRecentViews(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function pushWorkoutRecentView(
  db: DatabaseAdapter,
  view: Omit<WorkoutRecentView, 'seenAt'>,
): WorkoutRecentView[] {
  const next: WorkoutRecentView = {
    ...view,
    seenAt: new Date().toISOString(),
  };

  const existing = getWorkoutRecentViews(db).filter(
    (item) => !(item.type === next.type && item.id === next.id),
  );
  const merged = [next, ...existing].slice(0, 5);

  writeHubSetting(db, RECENT_VIEWS_KEY, JSON.stringify(merged));
  return merged;
}

export function clearWorkoutRecentViews(db: DatabaseAdapter): void {
  writeHubSetting(db, RECENT_VIEWS_KEY, JSON.stringify([]));
}

function parseStringArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((value): value is string => typeof value === 'string');
}

export function getFavoriteWorkoutExercises(db: DatabaseAdapter): string[] {
  const raw = readHubSetting(db, FAVORITE_EXERCISES_KEY);
  if (!raw) return [];

  try {
    return parseStringArray(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function toggleFavoriteWorkoutExercise(
  db: DatabaseAdapter,
  exerciseId: string,
): string[] {
  const current = new Set(getFavoriteWorkoutExercises(db));
  if (current.has(exerciseId)) {
    current.delete(exerciseId);
  } else {
    current.add(exerciseId);
  }

  const next = Array.from(current);
  writeHubSetting(db, FAVORITE_EXERCISES_KEY, JSON.stringify(next));
  return next;
}

export function getWorkoutProgramCover(
  db: DatabaseAdapter,
  planId: string,
): string | null {
  const raw = readHubSetting(db, `${PROGRAM_COVER_KEY_PREFIX}${planId}`);
  return raw && raw.trim().length > 0 ? raw : null;
}

export function saveWorkoutProgramCover(
  db: DatabaseAdapter,
  planId: string,
  uri: string | null,
): void {
  writeHubSetting(db, `${PROGRAM_COVER_KEY_PREFIX}${planId}`, uri?.trim() ?? '');
}

export const WORKOUT_PHASE_ONE_DEFAULTS = DEFAULT_SETTINGS;
