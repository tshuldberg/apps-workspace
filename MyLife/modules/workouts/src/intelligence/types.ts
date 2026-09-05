/**
 * Types for the Workout Intelligence Engine.
 * Cross-module insight detectors that read mood, nutrition, and fasting data
 * to surface correlations no standalone app can find.
 */

export type WorkoutInsightType =
  | 'mood_lift_correlation'
  | 'fasting_performance'
  | 'protein_recovery'
  | 'consistency_momentum'
  | 'time_of_day_performance'
  | 'volume_mood_feedback';

export type WorkoutInsightSeverity = 'positive' | 'neutral' | 'negative';

export interface WorkoutInsight {
  id: string;
  type: WorkoutInsightType;
  severity: WorkoutInsightSeverity;
  title: string;
  body: string;
  metric: string;
  recommendation: string;
  data?: Record<string, unknown>;
  generatedAt: string;
}

// ── Cross-module day shapes ──

export interface DayWorkoutData {
  date: string;
  didWorkout: boolean;
  totalSets: number;
  totalReps: number;
  totalVolumeLbs: number;
  durationMinutes: number;
  startHour: number | null;
}

export interface DayMoodData {
  date: string;
  avgScore: number;
}

export interface DayNutritionData {
  date: string;
  totalCalories: number;
  proteinG: number;
}

export interface DayFastingData {
  date: string;
  didFast: boolean;
}

export interface InsightInput {
  workoutDays: DayWorkoutData[];
  moodDays: DayMoodData[];
  nutritionDays: DayNutritionData[];
  fastingDays: DayFastingData[];
}

// ── Minimum data thresholds ──

/** Internal insights (workout data only) need at least 7 days. */
export const MIN_DAYS_INTERNAL = 7;

/** Cross-module insights (workout + one other module) need at least 10 days. */
export const MIN_DAYS_CROSS_MODULE = 10;
