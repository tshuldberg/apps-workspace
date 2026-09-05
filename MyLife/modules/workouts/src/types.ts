import { z } from 'zod';

export const WorkoutFocusSchema = z.enum([
  'full_body',
  'upper_body',
  'lower_body',
  'push',
  'pull',
  'legs',
  'cardio',
  'mobility',
  'custom',
]);
export type WorkoutFocus = z.infer<typeof WorkoutFocusSchema>;

export const WorkoutCategorySchema = z.enum([
  'cardio',
  'strength',
  'mobility',
  'fascia',
  'recovery',
  'flexibility',
  'balance',
]);
export type WorkoutCategory = z.infer<typeof WorkoutCategorySchema>;

export const MuscleGroupSchema = z.enum([
  'chest',
  'back',
  'shoulders',
  'biceps',
  'triceps',
  'forearms',
  'core',
  'quads',
  'hamstrings',
  'glutes',
  'calves',
  'hip_flexors',
  'neck',
  'full_body',
]);
export type MuscleGroup = z.infer<typeof MuscleGroupSchema>;

export const WorkoutDifficultySchema = z.enum(['beginner', 'intermediate', 'advanced']);
export type WorkoutDifficulty = z.infer<typeof WorkoutDifficultySchema>;

export const WorkoutAudioCueSchema = z.object({
  timestamp: z.number().nonnegative(),
  text: z.string().min(1),
  type: z.enum(['instruction', 'encouragement', 'countdown']).default('instruction'),
});
export type WorkoutAudioCue = z.infer<typeof WorkoutAudioCueSchema>;

export const WorkoutExerciseLibraryItemSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  category: WorkoutCategorySchema,
  muscleGroups: z.array(MuscleGroupSchema),
  difficulty: WorkoutDifficultySchema,
  defaultSets: z.number().int().positive(),
  defaultReps: z.number().int().positive().nullable(),
  defaultDuration: z.number().int().positive().nullable(),
  videoUrl: z.string().nullable(),
  thumbnailUrl: z.string().nullable(),
  audioCues: z.array(WorkoutAudioCueSchema),
  isPremium: z.boolean().default(false),
  createdAt: z.string().datetime(),
});
export type WorkoutExerciseLibraryItem = z.infer<typeof WorkoutExerciseLibraryItemSchema>;

export const WorkoutExerciseEntrySchema = z.object({
  exerciseId: z.string().min(1),
  name: z.string().min(1),
  category: WorkoutCategorySchema,
  sets: z.number().int().positive(),
  reps: z.number().int().positive().nullable(),
  duration: z.number().int().positive().nullable(),
  restAfter: z.number().int().nonnegative(),
  order: z.number().int().nonnegative(),
});
export type WorkoutExerciseEntry = z.infer<typeof WorkoutExerciseEntrySchema>;

export const WorkoutDefinitionSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string(),
  difficulty: WorkoutDifficultySchema,
  exercises: z.array(WorkoutExerciseEntrySchema),
  estimatedDuration: z.number().int().nonnegative(),
  isPremium: z.boolean(),
  createdAt: z.string().datetime(),
});
export type WorkoutDefinition = z.infer<typeof WorkoutDefinitionSchema>;

export const CompletedExerciseSchema = z.object({
  exerciseId: z.string().min(1),
  setsCompleted: z.number().int().nonnegative(),
  repsCompleted: z.number().int().nonnegative().nullable(),
  durationActual: z.number().nonnegative().nullable(),
  skipped: z.boolean(),
});
export type CompletedExercise = z.infer<typeof CompletedExerciseSchema>;

export const WorkoutSessionSchema = z.object({
  id: z.string().min(1),
  workoutId: z.string().min(1),
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime().nullable(),
  exercisesCompleted: z.array(CompletedExerciseSchema),
  voiceCommandsUsed: z.array(z.object({
    command: z.string(),
    timestamp: z.number().nonnegative(),
    recognized: z.boolean(),
  })),
  paceAdjustments: z.array(z.object({
    timestamp: z.number().nonnegative(),
    speed: z.number().positive(),
    source: z.enum(['voice', 'manual']),
  })),
  // User-entered metadata from the Save Workout screen (schema v7).
  title: z.string().nullable().default(null),
  notes: z.string().nullable().default(null),
  createdAt: z.string().datetime(),
});
export type WorkoutSession = z.infer<typeof WorkoutSessionSchema>;

export const WorkoutFormRecordingSchema = z.object({
  id: z.string().min(1),
  sessionId: z.string().min(1),
  exerciseId: z.string().min(1),
  videoUrl: z.string().min(1),
  timestampStart: z.number().nonnegative(),
  timestampEnd: z.number().nonnegative(),
  coachFeedback: z.array(z.object({
    timestamp: z.number().nonnegative(),
    comment: z.string().min(1),
    coachId: z.string().min(1),
    createdAt: z.string().datetime(),
  })),
  createdAt: z.string().datetime(),
});
export type WorkoutFormRecording = z.infer<typeof WorkoutFormRecordingSchema>;

export interface WorkoutExerciseFilters {
  search?: string;
  category?: WorkoutCategory | null;
  difficulty?: WorkoutDifficulty | null;
  muscleGroups?: MuscleGroup[];
  limit?: number;
}

export interface WorkoutMetrics {
  workouts: number;
  totalMinutes: number;
  totalCalories: number;
  averageRpe: number;
}

export interface WorkoutDashboard {
  workouts: number;
  exercises: number;
  sessions: number;
  streakDays: number;
  totalMinutes30d: number;
}

export interface WorkoutSeedItem {
  name: string;
  description: string;
  category: WorkoutCategory;
  muscleGroups: MuscleGroup[];
  difficulty: WorkoutDifficulty;
  defaultSets: number;
  defaultReps: number | null;
  defaultDuration?: number;
  audioCueText: string;
}

// Legacy shapes kept exported for compatibility with existing callers.
export const WorkoutLogSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  focus: WorkoutFocusSchema,
  durationMin: z.number().int().positive(),
  calories: z.number().int().nonnegative(),
  rpe: z.number().int().min(1).max(10),
  completedAt: z.string().datetime(),
  notes: z.string().nullable(),
  createdAt: z.string().datetime(),
});
export type WorkoutLog = z.infer<typeof WorkoutLogSchema>;

export const WorkoutProgramSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  goal: z.string().min(1),
  weeks: z.number().int().positive(),
  sessionsPerWeek: z.number().int().positive(),
  isActive: z.boolean(),
  createdAt: z.string().datetime(),
});
export type WorkoutProgram = z.infer<typeof WorkoutProgramSchema>;

export interface WorkoutCategoryCount {
  category: WorkoutCategory;
  count: number;
}

export const MUSCLE_GROUP_LABELS: Record<MuscleGroup, string> = {
  chest: 'Chest',
  back: 'Back',
  shoulders: 'Shoulders',
  biceps: 'Biceps',
  triceps: 'Triceps',
  forearms: 'Forearms',
  core: 'Core',
  quads: 'Quadriceps',
  hamstrings: 'Hamstrings',
  glutes: 'Glutes',
  calves: 'Calves',
  hip_flexors: 'Hip Flexors',
  neck: 'Neck',
  full_body: 'Full Body',
};

// ── Engine Types ──

export const PlayerStateSchema = z.enum(['idle', 'playing', 'paused', 'rest', 'completed']);
export type PlayerState = z.infer<typeof PlayerStateSchema>;

export const SetTypeSchema = z.enum(['normal', 'superset', 'dropset', 'giant', 'pyramid']);
export type SetType = z.infer<typeof SetTypeSchema>;

export const WeightUnitSchema = z.enum(['lbs', 'kg']);
export type WeightUnit = z.infer<typeof WeightUnitSchema>;

/** Engine input shape -- uses snake_case to match the workout player state machine. */
export interface WorkoutExerciseInput {
  exercise_id: string;
  sets: number;
  reps: number | null;
  duration: number | null;
  rest_after: number;
  order: number;
  weight?: number;
  weightUnit?: WeightUnit;
  setType?: SetType;
  setGroupId?: string;
}

/** Completed exercise as recorded by the engine -- snake_case. */
export interface EngineCompletedExercise {
  exercise_id: string;
  sets_completed: number;
  reps_completed: number | null;
  duration_actual: number | null;
  skipped: boolean;
  weight?: number;
  weightUnit?: WeightUnit;
  estimated1RM?: number;
}

export interface PlayerStatus {
  state: PlayerState;
  currentExerciseIndex: number;
  currentSet: number;
  currentRep: number;
  elapsedTime: number;
  exerciseElapsed: number;
  restRemaining: number;
  speed: number;
  exercises: WorkoutExerciseInput[];
  completed: EngineCompletedExercise[];
  groupNavigation: {
    nextInGroupByIndex: Record<number, number | undefined>;
    firstInGroupById: Record<string, number>;
  };
}

export type PlayerAction =
  | { type: 'START' }
  | { type: 'PAUSE' }
  | { type: 'RESUME' }
  | { type: 'TICK'; deltaMs: number }
  | { type: 'COMPLETE_REP' }
  | { type: 'COMPLETE_SET' }
  | { type: 'SKIP_EXERCISE' }
  | { type: 'PREVIOUS_EXERCISE' }
  | { type: 'ADJUST_SPEED'; direction: 'faster' | 'slower' | 'normal' }
  | { type: 'ADJUST_REST'; deltaMs: number }
  | { type: 'REST_COMPLETE' };

// ── Calculator Types ──

export const OneRMFormulaSchema = z.enum(['epley', 'brzycki']);
export type OneRMFormula = z.infer<typeof OneRMFormulaSchema>;

export const WarmupSetSchema = z.object({
  weight: z.number(),
  reps: z.number().int().positive(),
  percentage: z.number().nonnegative(),
});
export type WarmupSet = z.infer<typeof WarmupSetSchema>;

export const PlateResultSchema = z.object({
  perSide: z.array(z.object({ weight: z.number(), count: z.number().int().positive() })),
  totalWeight: z.number(),
  remainder: z.number(),
});
export type PlateResult = z.infer<typeof PlateResultSchema>;

// ── Body Map Types ──

export const MuscleGroupRegionSchema = z.enum(['upper', 'core', 'lower']);
export type MuscleGroupRegion = z.infer<typeof MuscleGroupRegionSchema>;

export const MuscleGroupSideSchema = z.enum(['front', 'back', 'both']);
export type MuscleGroupSide = z.infer<typeof MuscleGroupSideSchema>;

export interface MuscleGroupDefinition {
  id: MuscleGroup;
  label: string;
  region: MuscleGroupRegion;
  side: MuscleGroupSide;
}

export interface BodyHighlightDatum {
  slug: string;
  intensity: number;
  color?: string;
}

export interface ExerciseMuscleMapping {
  exerciseName: string;
  primary: MuscleGroup[];
  secondary: MuscleGroup[];
}

// ── Voice Types ──

export const VoiceCommandCategorySchema = z.enum(['playback', 'pacing', 'navigation', 'info', 'recording']);
export type VoiceCommandCategory = z.infer<typeof VoiceCommandCategorySchema>;

export interface VoiceCommand {
  category: VoiceCommandCategory;
  action: string;
  confidence: number;
  raw: string;
}

// ── Progress Types ──

export interface StreakInfo {
  current: number;
  longest: number;
  lastWorkoutDate: string | null;
}

export interface VolumeStats {
  totalSessions: number;
  totalExercises: number;
  totalSets: number;
  totalReps: number;
  totalDurationMinutes: number;
  byMuscleGroup: Record<string, number>;
}

export interface PersonalRecord {
  exerciseId: string;
  exerciseName: string;
  maxReps: number;
  maxSets: number;
  maxDuration: number | null;
  maxWeight?: number;
  max1RM?: number;
  achievedAt: string;
}

export interface PeriodSummary {
  label: string;
  sessions: number;
  totalMinutes: number;
  totalReps: number;
}

export interface WorkoutHistoryEntry {
  sessionId: string;
  workoutId: string;
  workoutTitle: string;
  date: string;
  durationMinutes: number;
  exercisesCompleted: number;
  exercisesTotal: number;
  totalReps: number;
}

export interface WeightPR {
  maxWeight: number;
  max1RM: number;
  date: string;
}

// ── Plan Types ──

export interface WorkoutPlanDay {
  day_number: number;
  workout_id: string | null;
  rest_day: boolean;
  notes: string | null;
}

export interface WorkoutPlanWeek {
  week_number: number;
  days: WorkoutPlanDay[];
}

export interface WorkoutPlan {
  id: string;
  title: string;
  description: string;
  creatorId: string | null;
  weeks: WorkoutPlanWeek[];
  isPremium: boolean;
  createdAt: string;
  updatedAt: string;
}

// ── DB Input Types ──

export const SetWeightInputSchema = z.object({
  sessionId: z.string().min(1),
  exerciseId: z.string().min(1),
  setNumber: z.number().int().positive(),
  weight: z.number().positive(),
  reps: z.number().int().positive(),
  unit: WeightUnitSchema.default('lbs'),
  estimated1rm: z.number().nonnegative().optional(),
});
export type SetWeightInput = z.input<typeof SetWeightInputSchema>;

export const Record1RMInputSchema = z.object({
  exerciseId: z.string().min(1),
  maxWeight: z.number().positive(),
  maxReps: z.number().int().positive(),
  estimated1rm: z.number().nonnegative(),
  unit: WeightUnitSchema.default('lbs'),
  achievedAt: z.string().min(1),
});
export type Record1RMInput = z.input<typeof Record1RMInputSchema>;

export const BodyMeasurementInputSchema = z.object({
  type: z.string().min(1),
  value: z.number(),
  unit: z.string().min(1),
  measuredAt: z.string().min(1),
});
export type BodyMeasurementInput = z.infer<typeof BodyMeasurementInputSchema>;

export const WorkoutPlanInputSchema = z.object({
  title: z.string().min(1),
  description: z.string().default(''),
  creatorId: z.string().nullable().default(null),
  weeksJson: z.string(),
  isPremium: z.boolean().default(false),
});
export type WorkoutPlanInput = z.input<typeof WorkoutPlanInputSchema>;

// ── DB Row Types ──

export interface SetWeightRow {
  id: string;
  sessionId: string;
  exerciseId: string;
  setNumber: number;
  weight: number;
  reps: number;
  unit: WeightUnit;
  estimated1rm: number;
  createdAt: string;
}

export interface Exercise1RMRow {
  id: string;
  exerciseId: string;
  maxWeight: number;
  maxReps: number;
  estimated1rm: number;
  unit: WeightUnit;
  achievedAt: string;
  createdAt: string;
}

export interface BodyMeasurementRow {
  id: string;
  type: string;
  value: number;
  unit: string;
  measuredAt: string;
  createdAt: string;
}

export interface PlanSubscriptionRow {
  id: string;
  planId: string;
  startedAt: string;
  isActive: boolean;
  createdAt: string;
}

// ── Progress Engine Input Type ──
// Used by the progress module -- uses snake_case matching standalone session shape.

export interface ProgressSession {
  id: string;
  workout_id: string;
  started_at: string;
  completed_at: string | null;
  exercises_completed: EngineCompletedExercise[];
}

export interface ProgressExercise {
  id: string;
  name: string;
  muscle_groups: MuscleGroup[];
}

export const WORKOUT_CATEGORIES: readonly WorkoutCategory[] = WorkoutCategorySchema.options;
export const MUSCLE_GROUPS: readonly MuscleGroup[] = MuscleGroupSchema.options;
export const WORKOUT_DIFFICULTIES: readonly WorkoutDifficulty[] = WorkoutDifficultySchema.options;

// ── Overload Types (used by crud.ts) ──

export interface OverloadRule {
  id: string;
  exerciseId: string | null;
  ruleType: 'weight_increment' | 'rep_increment' | 'set_increment' | 'percentage';
  triggerCondition: 'all_sets_hit' | 'any_set_hit' | 'average_reps_hit';
  targetReps: number | null;
  incrementValue: number;
  incrementUnit: 'lbs' | 'kg' | 'reps' | 'percent';
  minSessions: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ExercisePerformanceHistory {
  exerciseId: string;
  sessions: SessionSetData[];
}

export interface SessionSetData {
  sessionId: string;
  completedAt: string;
  sets: SetData[];
}

export interface SetData {
  setNumber: number;
  weight: number;
  reps: number;
  unit: WeightUnit;
}

// ── Generation History Types ──

export interface GenerationHistoryEntry {
  id: string;
  goal: string;
  focus: string;
  equipment: string[];
  difficulty: string;
  durationMinutes: number;
  generatedWorkoutJson: string;
  accepted: boolean;
  source: 'local' | 'llm';
  createdAt: string;
}

// ── GPS Types ──

export type GpsActivityType = 'run' | 'cycle' | 'hike' | 'walk' | 'other';

export interface GpsRoute {
  id: string;
  sessionId: string | null;
  activityType: GpsActivityType;
  name: string | null;
  distanceMeters: number;
  durationSeconds: number;
  elevationGainMeters: number;
  elevationLossMeters: number;
  avgPaceSecPerKm: number | null;
  avgSpeedKmh: number | null;
  maxSpeedKmh: number | null;
  caloriesEstimated: number;
  startedAt: string;
  completedAt: string | null;
  createdAt: string;
}

export interface GpsPointInput {
  latitude: number;
  longitude: number;
  altitudeMeters?: number | null;
  speedMps?: number | null;
  accuracyMeters?: number | null;
  timestampMs: number;
  segment?: number;
}

export interface GpsPoint {
  id: number;
  routeId: string;
  latitude: number;
  longitude: number;
  altitudeMeters: number | null;
  speedMps: number | null;
  accuracyMeters: number | null;
  timestampMs: number;
  segment: number;
}

/** Default rest time presets in seconds for the workout builder rest picker. */
export const REST_TIME_PRESETS = [30, 60, 90, 120, 180, 300] as const;

// ── Previous Performance Types ──

/** Data for a single previous set (weight, reps, unit). */
export interface PreviousSetData {
  weight: number;
  reps: number;
  unit: WeightUnit;
  estimated1rm: number;
}

/**
 * Map of exercise_id -> (set_number -> PreviousSetData).
 * Used to show "Last: 135 lbs x 10" ghost text during active sessions.
 */
export type PreviousPerformanceMap = Map<string, Map<number, PreviousSetData>>;

// ── Plate Inventory Types ──

export const PlateInventorySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  unit: WeightUnitSchema,
  plates: z.array(z.object({ weight: z.number().positive(), count: z.number().int().positive() })),
  barWeight: z.number().positive(),
  isDefault: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type PlateInventory = z.infer<typeof PlateInventorySchema>;

export const PlateInventoryInputSchema = z.object({
  name: z.string().min(1),
  unit: WeightUnitSchema.default('lbs'),
  platesJson: z.string(),
  barWeight: z.number().positive().default(45),
});
export type PlateInventoryInput = z.input<typeof PlateInventoryInputSchema>;

export const BAR_PRESETS = [
  { label: 'Standard', weightLbs: 45, weightKg: 20 },
  { label: "Women's", weightLbs: 35, weightKg: 15 },
  { label: 'EZ Curl', weightLbs: 15, weightKg: 7 },
] as const;

export const PLATE_COLORS: Record<number, string> = {
  45: '#3B82F6', // Blue
  35: '#EAB308', // Yellow
  25: '#22C55E', // Green
  20: '#3B82F6', // Blue (kg)
  15: '#22C55E', // Green (kg)
  10: '#FFFFFF', // White
  5: '#EF4444',  // Red
  2.5: '#9CA3AF', // Gray
  1.25: '#D1D5DB', // Silver
};

// ── Progress Photo Types ──

export const PhotoViewTypeSchema = z.enum(['front', 'side_left', 'side_right', 'back']);
export type PhotoViewType = z.infer<typeof PhotoViewTypeSchema>;

export const ProgressPhotoSchema = z.object({
  id: z.string().min(1),
  photoUri: z.string().min(1),
  viewType: PhotoViewTypeSchema,
  notes: z.string(),
  takenAt: z.string(),
  fileSizeBytes: z.number().int().nonnegative(),
  width: z.number().int().nonnegative(),
  height: z.number().int().nonnegative(),
  createdAt: z.string(),
});
export type ProgressPhoto = z.infer<typeof ProgressPhotoSchema>;

export const ProgressPhotoInputSchema = z.object({
  photoUri: z.string().min(1),
  viewType: PhotoViewTypeSchema.default('front'),
  notes: z.string().default(''),
  takenAt: z.string().min(1),
  fileSizeBytes: z.number().int().nonnegative().default(0),
  width: z.number().int().nonnegative().default(0),
  height: z.number().int().nonnegative().default(0),
});
export type ProgressPhotoInput = z.input<typeof ProgressPhotoInputSchema>;

export const PHOTO_VIEW_TYPES: readonly PhotoViewType[] = PhotoViewTypeSchema.options;

// ── Workout Sharing Types ──

export interface WorkoutSummaryCard {
  sessionId: string;
  title: string;
  date: string;
  durationMinutes: number;
  exerciseCount: number;
  totalSets: number;
  totalReps: number;
  totalVolume: number;
  prsHit: { exerciseName: string; estimated1rm: number }[];
  muscleGroups: MuscleGroup[];
}

// ── Demo Types ──

export type DemoStatus = 'available' | 'loading' | 'unavailable' | 'error';

export interface DemoAsset {
  type: 'lottie' | 'gif' | 'video';
  uri: string;
  thumbnailUri: string | null;
}

// ── Trainer Video Types ──

export const VideoAngleSchema = z.enum(['front', 'side', 'back', 'detail', 'common_mistakes']);
export type VideoAngle = z.infer<typeof VideoAngleSchema>;

export const VIDEO_ANGLES: readonly VideoAngle[] = VideoAngleSchema.options;

export const VIDEO_ANGLE_LABELS: Record<VideoAngle, string> = {
  front: 'Front View',
  side: 'Side View',
  back: 'Back View',
  detail: 'Detail',
  common_mistakes: 'Common Mistakes',
};

export const StorageTypeSchema = z.enum(['local', 'supabase', 'cdn']);
export type StorageType = z.infer<typeof StorageTypeSchema>;

export interface ExerciseVideo {
  id: string;
  exerciseId: string;
  trainerId: string;
  videoUri: string;
  thumbnailUri: string | null;
  angle: VideoAngle;
  durationSeconds: number;
  fileSizeBytes: number;
  width: number;
  height: number;
  sortOrder: number;
  isPrimary: boolean;
  storageType: StorageType;
  notes: string;
  createdAt: string;
}

export const ExerciseVideoInputSchema = z.object({
  exerciseId: z.string().min(1),
  trainerId: z.string().min(1),
  videoUri: z.string().min(1),
  thumbnailUri: z.string().nullable().default(null),
  angle: VideoAngleSchema.default('front'),
  durationSeconds: z.number().nonnegative().default(0),
  fileSizeBytes: z.number().int().nonnegative().default(0),
  width: z.number().int().nonnegative().default(0),
  height: z.number().int().nonnegative().default(0),
  notes: z.string().default(''),
});
export type ExerciseVideoInput = z.input<typeof ExerciseVideoInputSchema>;

export interface Trainer {
  id: string;
  userId: string | null;
  displayName: string;
  bio: string;
  avatarUri: string | null;
  isActive: boolean;
  createdAt: string;
}

// ── Social Types ──

export interface SocialPrivacySettings {
  shareTitle: boolean;
  shareExercises: boolean;
  shareWeightDetails: boolean;
  sharePrs: boolean;
  shareDuration: boolean;
  profileVisible: boolean;
}

export const DEFAULT_SOCIAL_PRIVACY: SocialPrivacySettings = {
  shareTitle: true,
  shareExercises: true,
  shareWeightDetails: false,
  sharePrs: true,
  shareDuration: true,
  profileVisible: true,
};

export interface SocialPost {
  id: string;
  userId: string;
  sessionId: string;
  content: WorkoutSummaryCard;
  privacySettings: Partial<SocialPrivacySettings>;
  createdAt: string;
}

export interface SocialPostEnriched extends SocialPost {
  likeCount: number;
  commentCount: number;
  isLikedByMe: boolean;
  authorName: string;
  authorAvatarUrl: string | null;
}

export interface SocialComment {
  id: string;
  userId: string;
  postId: string;
  body: string;
  createdAt: string;
  authorName: string;
}

export interface SocialUserProfile {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  memberSince: string;
  totalWorkouts: number;
  currentStreak: number;
  followerCount: number;
  followingCount: number;
  isFollowedByMe: boolean;
}
