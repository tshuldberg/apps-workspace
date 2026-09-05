import { z } from 'zod';

// ── Enums ──────────────────────────────────────────────────────────────

export const MoodLevelSchema = z.enum([
  'great',
  'good',
  'okay',
  'low',
  'awful',
]);
export type MoodLevel = z.infer<typeof MoodLevelSchema>;

export const MoodScoreDescriptors: Record<number, { label: string; level: MoodLevel }> = {
  1: { label: 'Awful', level: 'awful' },
  2: { label: 'Terrible', level: 'awful' },
  3: { label: 'Bad', level: 'low' },
  4: { label: 'Poor', level: 'low' },
  5: { label: 'Meh', level: 'okay' },
  6: { label: 'Okay', level: 'okay' },
  7: { label: 'Good', level: 'good' },
  8: { label: 'Great', level: 'good' },
  9: { label: 'Amazing', level: 'great' },
  10: { label: 'Incredible', level: 'great' },
};

// Plutchik primary emotions (8 primary x 3 intensity = 24 named emotions)
export const PlutchikEmotionSchema = z.enum([
  // Joy axis
  'ecstasy', 'joy', 'serenity',
  // Trust axis
  'admiration', 'trust', 'acceptance',
  // Fear axis
  'terror', 'fear', 'apprehension',
  // Surprise axis
  'amazement', 'surprise', 'distraction',
  // Sadness axis
  'grief', 'sadness', 'pensiveness',
  // Disgust axis
  'loathing', 'disgust', 'boredom',
  // Anger axis
  'rage', 'anger', 'annoyance',
  // Anticipation axis
  'vigilance', 'anticipation', 'interest',
]);
export type PlutchikEmotion = z.infer<typeof PlutchikEmotionSchema>;

// ── Core Entities ──────────────────────────────────────────────────────

export const MoodEntrySchema = z.object({
  id: z.string(),
  score: z.number().int().min(1).max(10),
  note: z.string().nullable(),
  loggedAt: z.string(),
  date: z.string(),
  createdAt: z.string(),
});
export type MoodEntry = z.infer<typeof MoodEntrySchema>;

export const MoodActivitySchema = z.object({
  id: z.string(),
  name: z.string(),
  icon: z.string().nullable(),
  category: z.string().nullable(),
  isDefault: z.boolean(),
  sortOrder: z.number().int(),
  createdAt: z.string(),
});
export type MoodActivity = z.infer<typeof MoodActivitySchema>;

export const MoodEmotionTagSchema = z.object({
  id: z.string(),
  entryId: z.string(),
  emotion: PlutchikEmotionSchema,
  intensity: z.number().int().min(1).max(3),
  createdAt: z.string(),
});
export type MoodEmotionTag = z.infer<typeof MoodEmotionTagSchema>;

export const MoodEntryActivitySchema = z.object({
  id: z.string(),
  entryId: z.string(),
  activityId: z.string(),
  createdAt: z.string(),
});
export type MoodEntryActivity = z.infer<typeof MoodEntryActivitySchema>;

export const MoodStreakSchema = z.object({
  currentStreak: z.number().int(),
  longestStreak: z.number().int(),
  lastLogDate: z.string().nullable(),
});
export type MoodStreak = z.infer<typeof MoodStreakSchema>;

export const BreathingPatternSchema = z.enum([
  'box',         // 4-4-4-4
  '478',         // 4-7-8
  'relaxing',    // 4-2-6
  'energizing',  // 2-1-2-0 (quick cycles for alertness)
  'sleep',       // 4-0-8-2 (long exhale for sleep onset)
]);
export type BreathingPattern = z.infer<typeof BreathingPatternSchema>;

export const BreathingSessionSchema = z.object({
  id: z.string(),
  pattern: BreathingPatternSchema,
  durationSeconds: z.number().int(),
  cyclesCompleted: z.number().int(),
  completedAt: z.string(),
  createdAt: z.string(),
});
export type BreathingSession = z.infer<typeof BreathingSessionSchema>;

export const MoodSettingSchema = z.object({
  key: z.string(),
  value: z.string(),
});
export type MoodSetting = z.infer<typeof MoodSettingSchema>;

// ── Input Schemas ──────────────────────────────────────────────────────

export const CreateMoodEntryInputSchema = z.object({
  score: z.number().int().min(1).max(10),
  note: z.string().max(500).nullable().default(null),
  loggedAt: z.string().optional(),
  emotions: z.array(z.object({
    emotion: PlutchikEmotionSchema,
    intensity: z.number().int().min(1).max(3).default(2),
  })).default([]),
  activityIds: z.array(z.string()).default([]),
});
export type CreateMoodEntryInput = z.input<typeof CreateMoodEntryInputSchema>;

export const CreateActivityInputSchema = z.object({
  name: z.string().min(1).max(50),
  icon: z.string().nullable().default(null),
  category: z.string().nullable().default(null),
  sortOrder: z.number().int().default(0),
});
export type CreateActivityInput = z.input<typeof CreateActivityInputSchema>;

export const UpdateActivityInputSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  icon: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  sortOrder: z.number().int().optional(),
});
export type UpdateActivityInput = z.input<typeof UpdateActivityInputSchema>;

export const CreateBreathingSessionInputSchema = z.object({
  pattern: BreathingPatternSchema,
  durationSeconds: z.number().int().min(1),
  cyclesCompleted: z.number().int().min(0),
});
export type CreateBreathingSessionInput = z.input<typeof CreateBreathingSessionInputSchema>;

export const MoodEntryFilterSchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  minScore: z.number().int().min(1).max(10).optional(),
  maxScore: z.number().int().min(1).max(10).optional(),
  limit: z.number().int().min(1).max(500).default(50),
  offset: z.number().int().min(0).default(0),
});
export type MoodEntryFilter = z.input<typeof MoodEntryFilterSchema>;

// ── Analytics Types ────────────────────────────────────────────────────

export interface DailyAverage {
  date: string;
  average: number;
  count: number;
}

export interface MoodDashboard {
  todayEntries: number;
  todayAverage: number | null;
  weekAverage: number | null;
  monthAverage: number | null;
  currentStreak: number;
  longestStreak: number;
  totalEntries: number;
}

export interface ActivityCorrelation {
  activityId: string;
  activityName: string;
  entryCount: number;
  averageScore: number;
  pearsonR: number | null;
}

export interface WeeklyReport {
  weekStart: string;
  weekEnd: string;
  average: number;
  high: number;
  low: number;
  entryCount: number;
  topActivities: { name: string; count: number }[];
  topEmotions: { emotion: string; count: number }[];
}

// ── Experiment Types ──────────────────────────────────────────────────

export const ExperimentStatusSchema = z.enum([
  'draft',
  'baseline',
  'intervention',
  'analyzing',
  'completed',
  'abandoned',
]);
export type ExperimentStatus = z.infer<typeof ExperimentStatusSchema>;

export const ExperimentCategorySchema = z.enum([
  'exercise',
  'sleep',
  'mindfulness',
  'social',
  'nutrition',
  'digital',
]);
export type ExperimentCategory = z.infer<typeof ExperimentCategorySchema>;

export const ExperimentSchema = z.object({
  id: z.string(),
  hypothesis: z.string(),
  interventionDescription: z.string(),
  periodDays: z.number().int(),
  baselineStart: z.string(),
  baselineEnd: z.string(),
  interventionStart: z.string(),
  interventionEnd: z.string(),
  status: ExperimentStatusSchema,
  templateId: z.string().nullable(),
  baselineAvg: z.number().nullable(),
  interventionAvg: z.number().nullable(),
  baselineEntryCount: z.number().int().nullable(),
  interventionEntryCount: z.number().int().nullable(),
  scoreDiff: z.number().nullable(),
  percentChange: z.number().nullable(),
  pearsonR: z.number().nullable(),
  isSignificant: z.boolean().nullable(),
  conclusion: z.string().nullable(),
  createdAt: z.string(),
  completedAt: z.string().nullable(),
});
export type Experiment = z.infer<typeof ExperimentSchema>;

export const ExperimentTemplateSchema = z.object({
  id: z.string(),
  name: z.string(),
  hypothesis: z.string(),
  interventionDescription: z.string(),
  suggestedDays: z.number().int(),
  category: ExperimentCategorySchema,
});
export type ExperimentTemplate = z.infer<typeof ExperimentTemplateSchema>;

export const CreateExperimentInputSchema = z.object({
  hypothesis: z.string().min(1).max(500),
  interventionDescription: z.string().min(1).max(500),
  periodDays: z.union([z.literal(7), z.literal(14), z.literal(21), z.literal(30)]),
  baselineStart: z.string(),
  templateId: z.string().nullable().default(null),
});
export type CreateExperimentInput = z.input<typeof CreateExperimentInputSchema>;

// ── Lock Types ────────────────────────────────────────────────────────

export const LockMethodSchema = z.enum(['pin', 'biometric', 'biometricWithPin']);
export type LockMethod = z.infer<typeof LockMethodSchema>;

export const LockTimeoutSchema = z.union([
  z.literal(0),
  z.literal(60),
  z.literal(300),
  z.literal(900),
]);
export type LockTimeout = z.infer<typeof LockTimeoutSchema>;

export const ModuleLockConfigSchema = z.object({
  isEnabled: z.boolean(),
  method: LockMethodSchema.nullable(),
  lockTimeoutSeconds: z.number().int(),
  failedAttempts: z.number().int(),
  lockedUntil: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type ModuleLockConfig = z.infer<typeof ModuleLockConfigSchema>;

export const PinInputSchema = z.string().regex(/^\d{4,6}$/, 'PIN must be 4-6 digits');

// ── Insight Types ─────────────────────────────────────────────────────

export const InsightTypeSchema = z.enum([
  'day_of_week_pattern',
  'time_of_day_pattern',
  'activity_impact',
  'emotion_cluster',
  'streak_impact',
  'trend_direction',
  'volatility_alert',
  'best_worst_day',
]);
export type InsightType = z.infer<typeof InsightTypeSchema>;

export const InsightSeveritySchema = z.enum(['info', 'notable', 'actionable']);
export type InsightSeverity = z.infer<typeof InsightSeveritySchema>;

export const MoodInsightSchema = z.object({
  id: z.string(),
  type: InsightTypeSchema,
  severity: InsightSeveritySchema,
  title: z.string(),
  body: z.string(),
  metric: z.string(),
  data: z.record(z.unknown()).optional(),
  generatedAt: z.string(),
});
export type MoodInsight = z.infer<typeof MoodInsightSchema>;

// ── SOS Types ────────────────────────────────────────────────────────

export const SosSessionSchema = z.object({
  id: z.string(),
  triggerMoodScore: z.number().int().min(1).max(10).nullable(),
  stepsCompleted: z.number().int(),
  totalDurationSeconds: z.number().int(),
  exitMoodScore: z.number().int().min(1).max(10).nullable(),
  breathingPattern: z.string().nullable(),
  groundingCompleted: z.boolean(),
  startedAt: z.string(),
  completedAt: z.string().nullable(),
  createdAt: z.string(),
});
export type SosSession = z.infer<typeof SosSessionSchema>;

export const EmergencyContactSchema = z.object({
  id: z.string(),
  name: z.string(),
  phone: z.string().nullable(),
  relationship: z.string().nullable(),
  sortOrder: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type EmergencyContact = z.infer<typeof EmergencyContactSchema>;

export const CreateSosSessionInputSchema = z.object({
  triggerMoodScore: z.number().int().min(1).max(10).nullable().default(null),
  breathingPattern: z.string().nullable().default(null),
});
export type CreateSosSessionInput = z.input<typeof CreateSosSessionInputSchema>;

export const CompleteSosSessionInputSchema = z.object({
  stepsCompleted: z.number().int().min(0),
  totalDurationSeconds: z.number().int().min(0),
  exitMoodScore: z.number().int().min(1).max(10).nullable().default(null),
  groundingCompleted: z.boolean().default(false),
});
export type CompleteSosSessionInput = z.input<typeof CompleteSosSessionInputSchema>;

export const CreateEmergencyContactInputSchema = z.object({
  name: z.string().min(1).max(100),
  phone: z.string().nullable().default(null),
  relationship: z.string().nullable().default(null),
  sortOrder: z.number().int().default(0),
});
export type CreateEmergencyContactInput = z.input<typeof CreateEmergencyContactInputSchema>;

// ── Attachment Types ─────────────────────────────────────────────────

export const AttachmentTypeSchema = z.enum(['photo', 'voice']);
export type AttachmentType = z.infer<typeof AttachmentTypeSchema>;

export const AttachmentSchema = z.object({
  id: z.string(),
  entryId: z.string(),
  type: AttachmentTypeSchema,
  filePath: z.string(),
  thumbnailPath: z.string().nullable(),
  fileSizeBytes: z.number().int(),
  durationSeconds: z.number().nullable(),
  mimeType: z.string(),
  width: z.number().int().nullable(),
  height: z.number().int().nullable(),
  createdAt: z.string(),
});
export type Attachment = z.infer<typeof AttachmentSchema>;

export const CreateAttachmentInputSchema = z.object({
  entryId: z.string(),
  type: AttachmentTypeSchema,
  filePath: z.string(),
  thumbnailPath: z.string().nullable().default(null),
  fileSizeBytes: z.number().int().min(0),
  durationSeconds: z.number().nullable().default(null),
  mimeType: z.string(),
  width: z.number().int().nullable().default(null),
  height: z.number().int().nullable().default(null),
});
export type CreateAttachmentInput = z.input<typeof CreateAttachmentInputSchema>;

// ── Suggestion Types ─────────────────────────────────────────────────

export const SuggestionSourceSchema = z.enum(['data_driven', 'catalog', 'cross_module']);
export type SuggestionSource = z.infer<typeof SuggestionSourceSchema>;

export const SuggestionActionSchema = z.enum(['completed', 'dismissed', 'ignored']);
export type SuggestionAction = z.infer<typeof SuggestionActionSchema>;

export const SuggestionHistorySchema = z.object({
  id: z.string(),
  suggestionKey: z.string(),
  category: z.string(),
  source: SuggestionSourceSchema,
  shownAt: z.string(),
  action: SuggestionActionSchema.nullable(),
  actedAt: z.string().nullable(),
  createdAt: z.string(),
});
export type SuggestionHistory = z.infer<typeof SuggestionHistorySchema>;

export const CreateSuggestionHistoryInputSchema = z.object({
  suggestionKey: z.string(),
  category: z.string(),
  source: SuggestionSourceSchema,
});
export type CreateSuggestionHistoryInput = z.input<typeof CreateSuggestionHistoryInputSchema>;

export const SuggestionCategorySchema = z.enum([
  'physical', 'social', 'creative', 'relaxation', 'mindfulness',
]);
export type SuggestionCategory = z.infer<typeof SuggestionCategorySchema>;

export interface CatalogSuggestion {
  key: string;
  title: string;
  description: string;
  category: SuggestionCategory;
  durationMinutes: number;
}

export interface GeneratedSuggestion {
  key: string;
  title: string;
  description: string;
  category: string;
  source: SuggestionSource;
}

// ── Meditation Types ─────────────────────────────────────────────────

export const MeditationDifficultySchema = z.enum(['beginner', 'intermediate', 'advanced']);
export type MeditationDifficulty = z.infer<typeof MeditationDifficultySchema>;

export const MeditationStepSchema = z.object({
  instruction: z.string(),
  durationSeconds: z.number().int().min(1),
});
export type MeditationStep = z.infer<typeof MeditationStepSchema>;

export const MeditationTemplateSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  category: z.string(),
  difficulty: MeditationDifficultySchema,
  durationSeconds: z.number().int(),
  steps: z.array(MeditationStepSchema),
  isDefault: z.boolean(),
  sortOrder: z.number().int(),
  createdAt: z.string(),
});
export type MeditationTemplate = z.infer<typeof MeditationTemplateSchema>;

export const MeditationSessionSchema = z.object({
  id: z.string(),
  templateId: z.string().nullable(),
  templateName: z.string(),
  durationSeconds: z.number().int(),
  stepsCompleted: z.number().int(),
  totalSteps: z.number().int(),
  preMoodScore: z.number().int().min(1).max(10).nullable(),
  postMoodScore: z.number().int().min(1).max(10).nullable(),
  completed: z.boolean(),
  startedAt: z.string(),
  completedAt: z.string().nullable(),
  createdAt: z.string(),
});
export type MeditationSession = z.infer<typeof MeditationSessionSchema>;

export const CreateMeditationSessionInputSchema = z.object({
  templateId: z.string().nullable().default(null),
  templateName: z.string(),
  durationSeconds: z.number().int().min(1),
  totalSteps: z.number().int().min(1),
  preMoodScore: z.number().int().min(1).max(10).nullable().default(null),
});
export type CreateMeditationSessionInput = z.input<typeof CreateMeditationSessionInputSchema>;

export const CompleteMeditationSessionInputSchema = z.object({
  stepsCompleted: z.number().int().min(0),
  postMoodScore: z.number().int().min(1).max(10).nullable().default(null),
});
export type CompleteMeditationSessionInput = z.input<typeof CompleteMeditationSessionInputSchema>;

// ── Pet Types ────────────────────────────────────────────────────────

export const PetSpeciesSchema = z.enum(['egg', 'cat', 'dog', 'bird', 'bunny', 'fox']);
export type PetSpecies = z.infer<typeof PetSpeciesSchema>;

export const PetActivityTypeSchema = z.enum([
  'mood_log', 'breathing', 'meditation', 'journal', 'workout', 'experiment', 'streak_bonus',
]);
export type PetActivityType = z.infer<typeof PetActivityTypeSchema>;

export const PetSchema = z.object({
  id: z.string(),
  name: z.string(),
  species: z.string(),
  evolutionStage: z.number().int().min(0).max(5),
  happiness: z.number().int().min(0).max(100),
  experience: z.number().int().min(0),
  totalFeeds: z.number().int().min(0),
  streakBonus: z.number().int().min(0),
  lastFedAt: z.string().nullable(),
  hatchedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Pet = z.infer<typeof PetSchema>;

export const PetActivitySchema = z.object({
  id: z.string(),
  activityType: PetActivityTypeSchema,
  happinessDelta: z.number().int(),
  experienceDelta: z.number().int(),
  sourceModule: z.string().nullable(),
  createdAt: z.string(),
});
export type PetActivity = z.infer<typeof PetActivitySchema>;

// ── Focus Music Types ────────────────────────────────────────────────

export const SoundLayerSchema = z.object({
  sound: z.string(),
  volume: z.number().min(0).max(1),
});
export type SoundLayer = z.infer<typeof SoundLayerSchema>;

export const FocusSessionSchema = z.object({
  id: z.string(),
  presetName: z.string(),
  layers: z.array(SoundLayerSchema),
  targetDurationSeconds: z.number().int(),
  actualDurationSeconds: z.number().int(),
  completed: z.boolean(),
  preMoodScore: z.number().int().min(1).max(10).nullable(),
  postMoodScore: z.number().int().min(1).max(10).nullable(),
  startedAt: z.string(),
  completedAt: z.string().nullable(),
  createdAt: z.string(),
});
export type FocusSession = z.infer<typeof FocusSessionSchema>;

export const SoundPresetSchema = z.object({
  id: z.string(),
  name: z.string(),
  layers: z.array(SoundLayerSchema),
  isDefault: z.boolean(),
  sortOrder: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type SoundPreset = z.infer<typeof SoundPresetSchema>;

export const CreateFocusSessionInputSchema = z.object({
  presetName: z.string(),
  layers: z.array(SoundLayerSchema),
  targetDurationSeconds: z.number().int().min(1),
  preMoodScore: z.number().int().min(1).max(10).nullable().default(null),
});
export type CreateFocusSessionInput = z.input<typeof CreateFocusSessionInputSchema>;

export const CompleteFocusSessionInputSchema = z.object({
  actualDurationSeconds: z.number().int().min(0),
  postMoodScore: z.number().int().min(1).max(10).nullable().default(null),
});
export type CompleteFocusSessionInput = z.input<typeof CompleteFocusSessionInputSchema>;

export const CreateSoundPresetInputSchema = z.object({
  name: z.string().min(1).max(100),
  layers: z.array(SoundLayerSchema).min(1),
  sortOrder: z.number().int().default(0),
});
export type CreateSoundPresetInput = z.input<typeof CreateSoundPresetInputSchema>;

// ── Constants ──────────────────────────────────────────────────────────

export const BREATHING_PATTERNS: Record<BreathingPattern, { inhale: number; hold1: number; exhale: number; hold2: number; name: string }> = {
  box: { inhale: 4, hold1: 4, exhale: 4, hold2: 4, name: 'Box Breathing' },
  '478': { inhale: 4, hold1: 7, exhale: 8, hold2: 0, name: '4-7-8 Breathing' },
  relaxing: { inhale: 4, hold1: 2, exhale: 6, hold2: 0, name: 'Relaxing Breath' },
  energizing: { inhale: 2, hold1: 1, exhale: 2, hold2: 0, name: 'Energizing Breath' },
  sleep: { inhale: 4, hold1: 0, exhale: 8, hold2: 2, name: 'Sleep Breath' },
};

export const DEFAULT_ACTIVITIES: { name: string; icon: string; category: string }[] = [
  { name: 'Exercise', icon: 'dumbbell', category: 'health' },
  { name: 'Work', icon: 'briefcase', category: 'productivity' },
  { name: 'Social', icon: 'users', category: 'social' },
  { name: 'Family', icon: 'heart', category: 'social' },
  { name: 'Sleep', icon: 'moon', category: 'health' },
  { name: 'Outdoors', icon: 'sun', category: 'leisure' },
  { name: 'Reading', icon: 'book', category: 'leisure' },
  { name: 'Cooking', icon: 'chef-hat', category: 'leisure' },
  { name: 'Meditation', icon: 'flower', category: 'health' },
  { name: 'Music', icon: 'music', category: 'leisure' },
  { name: 'Travel', icon: 'plane', category: 'leisure' },
  { name: 'Shopping', icon: 'shopping-bag', category: 'other' },
  { name: 'Therapy', icon: 'message-circle', category: 'health' },
  { name: 'Date', icon: 'heart', category: 'social' },
  { name: 'Gaming', icon: 'gamepad', category: 'leisure' },
];
