/**
 * Shared types for MyHealth V2 features.
 * All 14 A-tier feature types defined here.
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Breathing Exercises
// ---------------------------------------------------------------------------

export const BreathingPatternEnum = z.enum(['box', '478', 'relaxing', 'energizing', 'sleep']);
export type BreathingPattern = z.infer<typeof BreathingPatternEnum>;

export const BreathingSessionSchema = z.object({
  id: z.string(),
  pattern: BreathingPatternEnum,
  duration_seconds: z.number().int().positive(),
  cycles_completed: z.number().int().nonnegative(),
  completed: z.number().int().min(0).max(1),
  mood_before: z.number().int().min(1).max(10).nullable(),
  mood_after: z.number().int().min(1).max(10).nullable(),
  created_at: z.string(),
});
export type BreathingSession = z.infer<typeof BreathingSessionSchema>;

export const BreathingSessionInsertSchema = BreathingSessionSchema.omit({ id: true, created_at: true });
export type BreathingSessionInsert = z.infer<typeof BreathingSessionInsertSchema>;

export interface BreathingPatternConfig {
  name: string;
  description: string;
  inhale: number;
  hold1: number;
  exhale: number;
  hold2: number;
  defaultCycles: number;
}

export interface BreathingStats {
  totalSessions: number;
  totalMinutes: number;
  favoritePattern: BreathingPattern | null;
  averageMoodImprovement: number | null;
}

// ---------------------------------------------------------------------------
// Readiness Score
// ---------------------------------------------------------------------------

export const RecommendationEnum = z.enum(['rest', 'light', 'moderate', 'intense']);
export type Recommendation = z.infer<typeof RecommendationEnum>;

export const ReadinessScoreSchema = z.object({
  id: z.string(),
  date: z.string(),
  score: z.number().int().min(0).max(100),
  sleep_factor: z.number().min(0).max(1),
  hrv_factor: z.number().min(0).max(1),
  rhr_factor: z.number().min(0).max(1),
  activity_factor: z.number().min(0).max(1),
  strain_factor: z.number().min(0).max(1),
  recommendation: RecommendationEnum,
  data_completeness: z.number().min(0).max(1),
  created_at: z.string(),
});
export type ReadinessScore = z.infer<typeof ReadinessScoreSchema>;

export interface ReadinessInput {
  sleepDurationMinutes: number | null;
  sleepQualityScore: number | null;
  sleepTargetMinutes: number;
  hrvValue: number | null;
  hrvBaseline: number | null;
  rhrValue: number | null;
  rhrBaseline: number | null;
  activeEnergyYesterday: number | null;
  workoutStrainYesterday: number | null;
}

export interface ReadinessResult {
  score: number;
  sleepFactor: number;
  hrvFactor: number;
  rhrFactor: number;
  activityFactor: number;
  strainFactor: number;
  recommendation: Recommendation;
  dataCompleteness: number;
}

// ---------------------------------------------------------------------------
// Activity Tracking
// ---------------------------------------------------------------------------

export const ActivitySummarySchema = z.object({
  id: z.string(),
  date: z.string(),
  steps: z.number().int().nonnegative(),
  steps_goal: z.number().int().positive(),
  active_energy_cal: z.number().nonnegative(),
  active_energy_goal: z.number().positive(),
  move_minutes: z.number().int().nonnegative(),
  move_minutes_goal: z.number().int().positive(),
  distance_meters: z.number().nullable(),
  floors_climbed: z.number().int().nullable(),
  source: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type ActivitySummary = z.infer<typeof ActivitySummarySchema>;

export interface RingProgress {
  steps: number;
  activeEnergy: number;
  moveMinutes: number;
}

// ---------------------------------------------------------------------------
// Sleep Stage Analysis
// ---------------------------------------------------------------------------

export interface SleepStageBreakdown {
  deepPercent: number;
  remPercent: number;
  lightPercent: number;
  awakePercent: number;
  deepMinutes: number;
  remMinutes: number;
  lightMinutes: number;
  awakeMinutes: number;
  totalSleepMinutes: number;
}

export interface SleepStageTarget {
  stage: 'deep' | 'rem' | 'light';
  targetMinPercent: number;
  targetMaxPercent: number;
  actualPercent: number;
  status: 'low' | 'normal' | 'high';
}

export interface SleepAnalysis {
  breakdown: SleepStageBreakdown;
  targets: SleepStageTarget[];
  sleepEfficiency: number;
  trend: 'improving' | 'stable' | 'declining';
}

// ---------------------------------------------------------------------------
// CBT Exercises
// ---------------------------------------------------------------------------

export const CbtExerciseTypeEnum = z.enum([
  'thought_record', 'behavioral_activation', 'cognitive_restructuring',
  'gratitude', 'worry_time', 'values_clarification',
]);
export type CbtExerciseType = z.infer<typeof CbtExerciseTypeEnum>;

export const CbtEntrySchema = z.object({
  id: z.string(),
  exercise_type: CbtExerciseTypeEnum,
  prompt: z.string(),
  response: z.string(),
  mood_before: z.number().int().min(1).max(10).nullable(),
  mood_after: z.number().int().min(1).max(10).nullable(),
  tags: z.string().nullable(),
  created_at: z.string(),
});
export type CbtEntry = z.infer<typeof CbtEntrySchema>;

export interface CbtExerciseDefinition {
  type: CbtExerciseType;
  name: string;
  description: string;
  estimatedMinutes: number;
  prompts: string[];
}

export interface CbtStats {
  totalExercises: number;
  averageMoodImprovement: number | null;
  favoriteType: CbtExerciseType | null;
}

// ---------------------------------------------------------------------------
// HRV Tracking
// ---------------------------------------------------------------------------

export type HrvCategory = 'low' | 'below_average' | 'average' | 'above_average' | 'high';

export interface HrvAnalysis {
  currentValue: number;
  baseline: number;
  percentileRank: number;
  trend: 'improving' | 'stable' | 'declining';
  trendDelta: number;
  category: HrvCategory;
  insight: string;
}

// ---------------------------------------------------------------------------
// Guided Meditation
// ---------------------------------------------------------------------------

export const MeditationTypeEnum = z.enum([
  'body_scan', 'loving_kindness', 'mindful_awareness', 'stress_relief',
  'sleep_prep', 'focus', 'gratitude', 'custom_timer',
]);
export type MeditationType = z.infer<typeof MeditationTypeEnum>;

export const MeditationSessionSchema = z.object({
  id: z.string(),
  meditation_type: MeditationTypeEnum,
  duration_seconds: z.number().int().positive(),
  completed: z.number().int().min(0).max(1),
  mood_before: z.number().int().min(1).max(10).nullable(),
  mood_after: z.number().int().min(1).max(10).nullable(),
  notes: z.string().nullable(),
  created_at: z.string(),
});
export type MeditationSession = z.infer<typeof MeditationSessionSchema>;

export interface MeditationDefinition {
  type: MeditationType;
  name: string;
  description: string;
  defaultDurationSeconds: number;
  prompts: string[];
}

export interface MeditationStats {
  totalSessions: number;
  totalMinutes: number;
  favoriteType: MeditationType | null;
  currentStreak: number;
  averageMoodImprovement: number | null;
}

// ---------------------------------------------------------------------------
// Body Composition
// ---------------------------------------------------------------------------

export const BodyMeasurementSchema = z.object({
  id: z.string(),
  date: z.string(),
  weight_kg: z.number().positive().nullable(),
  body_fat_percent: z.number().min(1).max(60).nullable(),
  lean_mass_kg: z.number().positive().nullable(),
  bmi: z.number().positive().nullable(),
  waist_cm: z.number().positive().nullable(),
  hip_cm: z.number().positive().nullable(),
  chest_cm: z.number().positive().nullable(),
  height_cm: z.number().positive().nullable(),
  source: z.string(),
  notes: z.string().nullable(),
  created_at: z.string(),
});
export type BodyMeasurement = z.infer<typeof BodyMeasurementSchema>;

export type BmiCategory = 'underweight' | 'normal' | 'overweight' | 'obese';

// ---------------------------------------------------------------------------
// SOS/Panic
// ---------------------------------------------------------------------------

export const SosSessionSchema = z.object({
  id: z.string(),
  trigger_source: z.string(),
  tools_used: z.string().nullable(),
  duration_seconds: z.number().int().nullable(),
  mood_before: z.number().int().min(1).max(10).nullable(),
  mood_after: z.number().int().min(1).max(10).nullable(),
  notes: z.string().nullable(),
  created_at: z.string(),
});
export type SosSession = z.infer<typeof SosSessionSchema>;

export interface GroundingStep {
  count: number;
  sense: string;
  prompt: string;
}

export interface SosStats {
  totalSessions: number;
  averageDurationSeconds: number | null;
  mostUsedTool: string | null;
}

// ---------------------------------------------------------------------------
// Sleep Aids
// ---------------------------------------------------------------------------

export const SleepRoutineSchema = z.object({
  id: z.string(),
  routine_type: z.string(),
  routine_name: z.string(),
  duration_seconds: z.number().int().positive(),
  completed: z.number().int().min(0).max(1),
  sleep_session_id: z.string().nullable(),
  created_at: z.string(),
});
export type SleepRoutine = z.infer<typeof SleepRoutineSchema>;

export interface RoutineDefinition {
  type: string;
  name: string;
  description: string;
  durationSeconds: number;
  steps: string[];
}

export interface SleepHygieneTip {
  id: string;
  text: string;
  category: string;
}

// ---------------------------------------------------------------------------
// Multi-App Aggregation
// ---------------------------------------------------------------------------

export const ImportLogSchema = z.object({
  id: z.string(),
  source_name: z.string(),
  file_name: z.string().nullable(),
  records_imported: z.number().int().nonnegative(),
  records_skipped: z.number().int().nonnegative(),
  records_conflicted: z.number().int().nonnegative(),
  status: z.enum(['completed', 'failed', 'partial']),
  error_message: z.string().nullable(),
  started_at: z.string(),
  completed_at: z.string().nullable(),
});
export type ImportLog = z.infer<typeof ImportLogSchema>;

export interface DedupResult {
  isDuplicate: boolean;
  isConflict: boolean;
}

export interface ImportSummary {
  imported: number;
  skipped: number;
  conflicted: number;
  sourceName: string;
}

// ---------------------------------------------------------------------------
// Blood Oxygen Tracking
// ---------------------------------------------------------------------------

export type Spo2Category = 'normal' | 'borderline' | 'low';

export interface Spo2Analysis {
  latestReading: number;
  overnightAverage: number | null;
  thirtyDayAverage: number;
  lowestReading: number;
  category: Spo2Category;
  trend: 'stable' | 'declining' | 'improving';
  alertMessage: string | null;
}

// ---------------------------------------------------------------------------
// Sleep Bank
// ---------------------------------------------------------------------------

export type SleepBankStatus = 'well_rested' | 'slight_debt' | 'moderate_debt' | 'significant_debt';

export interface SleepBank {
  currentDebtMinutes: number;
  currentDebtHours: number;
  sevenDayBalance: number[];
  thirtyDayDebt: number;
  averageSleepHours: number;
  targetHours: number;
  status: SleepBankStatus;
  trend: 'paying_off' | 'stable' | 'accumulating';
}

// ---------------------------------------------------------------------------
// Wellness Timeline
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Heart Rate During Sleep (B-tier, engine-only, no new tables)
// ---------------------------------------------------------------------------

export type SleepStage = 'deep' | 'rem' | 'light' | 'awake';

export interface SleepHeartRatePoint {
  timestamp: string;
  bpm: number;
  stage: SleepStage | null;
}

export interface SleepHeartRateAnalysis {
  averageBpm: number;
  lowestBpm: number;
  lowestBpmAt: string;
  highestBpm: number;
  restingBpm: number | null;
  hrDip: number;
  dataPoints: SleepHeartRatePoint[];
  stageAverages: {
    deep: number | null;
    rem: number | null;
    light: number | null;
    awake: number | null;
  };
}

// ---------------------------------------------------------------------------
// Smart Alarm (B-tier, 2 new tables)
// ---------------------------------------------------------------------------

export const SmartAlarmSchema = z.object({
  id: z.string(),
  target_time: z.string(),
  wake_window_minutes: z.number().int().min(10).max(30),
  is_enabled: z.number().int().min(0).max(1),
  days_of_week: z.string(),
  sound: z.string(),
  vibration: z.number().int().min(0).max(1),
  snooze_enabled: z.number().int().min(0).max(1),
  snooze_duration_minutes: z.number().int().min(1).max(30),
  created_at: z.string(),
  updated_at: z.string(),
});
export type SmartAlarm = z.infer<typeof SmartAlarmSchema>;

export const SmartAlarmInsertSchema = SmartAlarmSchema.omit({ id: true, created_at: true, updated_at: true });
export type SmartAlarmInsert = z.infer<typeof SmartAlarmInsertSchema>;

export const TriggerReasonEnum = z.enum(['light_sleep', 'window_end', 'manual_wake', 'snoozed']);
export type TriggerReason = z.infer<typeof TriggerReasonEnum>;

export const AlarmHistorySchema = z.object({
  id: z.string(),
  alarm_id: z.string(),
  scheduled_time: z.string(),
  actual_trigger_time: z.string().nullable(),
  trigger_reason: TriggerReasonEnum,
  sleep_stage_at_trigger: z.string().nullable(),
  snoozed: z.number().int().min(0).max(1),
  snooze_count: z.number().int().nonnegative(),
  dismissed_at: z.string().nullable(),
  created_at: z.string(),
});
export type AlarmHistory = z.infer<typeof AlarmHistorySchema>;

export interface WakeWindow {
  start: Date;
  end: Date;
}

export interface AlarmSuccessRate {
  total: number;
  lightSleepWakes: number;
  rate: number;
}

// ---------------------------------------------------------------------------
// Snore Detection (C-tier, 2 new tables)
// ---------------------------------------------------------------------------

export type SnoreIntensity = 'light' | 'moderate' | 'loud' | 'epic';
export type SnoreScoreCategory = 'quiet' | 'light' | 'moderate' | 'heavy' | 'severe';
export type SnoreSessionStatus = 'recording' | 'completed' | 'cancelled';

export const SnoreSessionSchema = z.object({
  id: z.string(),
  sleep_session_id: z.string().nullable(),
  start_time: z.string(),
  end_time: z.string().nullable(),
  duration_minutes: z.number().int().nullable(),
  snore_score: z.number().int().min(0).max(100).nullable(),
  snore_minutes: z.number().int().nonnegative().nullable(),
  snore_percentage: z.number().min(0).max(100).nullable(),
  loudest_db: z.number().nullable(),
  average_db: z.number().nullable(),
  event_count: z.number().int().nonnegative(),
  status: z.string(),
  notes: z.string().nullable(),
  created_at: z.string(),
});
export type SnoreSession = z.infer<typeof SnoreSessionSchema>;

export const SnoreEventSchema = z.object({
  id: z.string(),
  session_id: z.string(),
  timestamp: z.string(),
  duration_seconds: z.number().positive(),
  intensity: z.string(),
  decibels: z.number().nullable(),
  audio_clip_path: z.string().nullable(),
  created_at: z.string(),
});
export type SnoreEvent = z.infer<typeof SnoreEventSchema>;

export interface SnoreSessionSummary {
  snoreScore: number;
  snoreMinutes: number;
  snorePercentage: number;
  loudestDb: number;
  averageDb: number;
  eventCount: number;
}

// ---------------------------------------------------------------------------
// Wellness Timeline
// ---------------------------------------------------------------------------

export type TimelineEventType =
  | 'vital_reading'
  | 'sleep_session'
  | 'medication_dose'
  | 'mood_checkin'
  | 'fasting_session'
  | 'cycle_day'
  | 'workout_session'
  | 'goal_progress';

export interface TimelineEvent {
  id: string;
  type: TimelineEventType;
  timestamp: string;
  title: string;
  subtitle: string | null;
  icon: string;
  accentColor: string;
  sourceModule: string;
  metadata: Record<string, unknown>;
}
