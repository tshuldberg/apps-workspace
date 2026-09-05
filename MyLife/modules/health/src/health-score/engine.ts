/**
 * Daily Health Score engine.
 * Produces a unified 0-100 composite from readiness, sleep, medication adherence,
 * mood, activity, and mindfulness inputs. Pure functions, no side effects.
 *
 * SCORE ARCHITECTURE:
 *   ┌─────────────┐
 *   │ Health Score │ 0-100
 *   └──────┬──────┘
 *     ┌────┴────────────────────────────────────┐
 *     │ sleep  readiness  adherence  mood  activity  mindfulness │
 *     │  25%     20%        20%      15%    10%        10%       │
 *     └─────────────────────────────────────────────────────────┘
 *
 * Each factor normalizes to 0-1. Missing data gets a neutral 0.5.
 * Data completeness is tracked separately so the UI can prompt for missing inputs.
 */

export interface HealthScoreInput {
  /** Readiness score from readiness engine (0-100). */
  readinessScore: number | null;
  /** Medication adherence rate for the day (0-100%). */
  medicationAdherence: number | null;
  /** Sleep quality score from last night (0-100). */
  sleepQualityScore: number | null;
  /** Most recent mood score (1-10). */
  moodScore: number | null;
  /** Whether today's fasting window was completed. */
  fastingCompleted: boolean | null;
  /** Breathing exercise minutes today. */
  breathingMinutes: number | null;
  /** Meditation minutes today. */
  meditationMinutes: number | null;
  /** Steps progress as percentage of daily goal (0-100+). */
  stepsProgress: number | null;
}

export interface HealthScoreBreakdown {
  sleep: number;
  readiness: number;
  adherence: number;
  mood: number;
  activity: number;
  mindfulness: number;
}

export type HealthScoreLabel = 'excellent' | 'good' | 'fair' | 'needs_attention';

export interface HealthScoreResult {
  score: number;
  label: HealthScoreLabel;
  breakdown: HealthScoreBreakdown;
  dataCompleteness: number;
  insights: string[];
}

const WEIGHT_SLEEP = 0.25;
const WEIGHT_READINESS = 0.20;
const WEIGHT_ADHERENCE = 0.20;
const WEIGHT_MOOD = 0.15;
const WEIGHT_ACTIVITY = 0.10;
const WEIGHT_MINDFULNESS = 0.10;

const DEFAULT_FACTOR = 0.5;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function normalizeSleep(qualityScore: number | null): number {
  if (qualityScore === null) return DEFAULT_FACTOR;
  return clamp(qualityScore / 100, 0, 1);
}

export function normalizeReadiness(readinessScore: number | null): number {
  if (readinessScore === null) return DEFAULT_FACTOR;
  return clamp(readinessScore / 100, 0, 1);
}

export function normalizeAdherence(adherencePercent: number | null): number {
  if (adherencePercent === null) return DEFAULT_FACTOR;
  return clamp(adherencePercent / 100, 0, 1);
}

export function normalizeMood(moodScore: number | null): number {
  if (moodScore === null) return DEFAULT_FACTOR;
  // Mood is 1-10, normalize to 0-1
  return clamp((moodScore - 1) / 9, 0, 1);
}

export function normalizeActivity(
  stepsProgress: number | null,
  fastingCompleted: boolean | null,
): number {
  if (stepsProgress === null && fastingCompleted === null) return DEFAULT_FACTOR;
  let score = 0;
  let parts = 0;
  if (stepsProgress !== null) {
    score += clamp(stepsProgress / 100, 0, 1);
    parts++;
  }
  if (fastingCompleted !== null) {
    score += fastingCompleted ? 1.0 : 0.3;
    parts++;
  }
  return parts > 0 ? score / parts : DEFAULT_FACTOR;
}

export function normalizeMindfulness(
  breathingMinutes: number | null,
  meditationMinutes: number | null,
): number {
  const totalMinutes = (breathingMinutes ?? 0) + (meditationMinutes ?? 0);
  if (breathingMinutes === null && meditationMinutes === null) return DEFAULT_FACTOR;
  // 10+ minutes of mindfulness per day is excellent
  if (totalMinutes >= 10) return 1.0;
  if (totalMinutes >= 5) return 0.8;
  if (totalMinutes >= 1) return 0.6;
  return 0.3;
}

export function getLabel(score: number): HealthScoreLabel {
  if (score >= 80) return 'excellent';
  if (score >= 60) return 'good';
  if (score >= 40) return 'fair';
  return 'needs_attention';
}

export function calculateDataCompleteness(input: HealthScoreInput): number {
  let present = 0;
  const total = 8;
  if (input.readinessScore !== null) present++;
  if (input.medicationAdherence !== null) present++;
  if (input.sleepQualityScore !== null) present++;
  if (input.moodScore !== null) present++;
  if (input.fastingCompleted !== null) present++;
  if (input.breathingMinutes !== null) present++;
  if (input.meditationMinutes !== null) present++;
  if (input.stepsProgress !== null) present++;
  return Math.round((present / total) * 100) / 100;
}

export function generateInsights(
  input: HealthScoreInput,
  breakdown: HealthScoreBreakdown,
): string[] {
  const insights: string[] = [];

  if (breakdown.sleep >= 0.8) {
    insights.push('Great sleep last night -- keep it up.');
  } else if (breakdown.sleep < 0.4 && input.sleepQualityScore !== null) {
    insights.push('Sleep quality was low. Consider an earlier bedtime or a wind-down routine.');
  }

  if (breakdown.adherence >= 0.95 && input.medicationAdherence !== null) {
    insights.push('Perfect medication adherence today.');
  } else if (breakdown.adherence < 0.5 && input.medicationAdherence !== null) {
    insights.push('Missed some medication doses. Check your reminders.');
  }

  if (breakdown.mindfulness >= 0.8) {
    insights.push('Solid mindfulness practice today.');
  } else if (breakdown.mindfulness < 0.4 && (input.breathingMinutes !== null || input.meditationMinutes !== null)) {
    insights.push('Try a quick breathing exercise to boost your score.');
  }

  if (breakdown.activity >= 0.8) {
    insights.push('Activity goals on track.');
  }

  return insights;
}

export function calculateHealthScore(input: HealthScoreInput): HealthScoreResult {
  const breakdown: HealthScoreBreakdown = {
    sleep: normalizeSleep(input.sleepQualityScore),
    readiness: normalizeReadiness(input.readinessScore),
    adherence: normalizeAdherence(input.medicationAdherence),
    mood: normalizeMood(input.moodScore),
    activity: normalizeActivity(input.stepsProgress, input.fastingCompleted),
    mindfulness: normalizeMindfulness(input.breathingMinutes, input.meditationMinutes),
  };

  const rawScore =
    breakdown.sleep * WEIGHT_SLEEP +
    breakdown.readiness * WEIGHT_READINESS +
    breakdown.adherence * WEIGHT_ADHERENCE +
    breakdown.mood * WEIGHT_MOOD +
    breakdown.activity * WEIGHT_ACTIVITY +
    breakdown.mindfulness * WEIGHT_MINDFULNESS;

  const score = Math.round(clamp(rawScore * 100, 0, 100));
  const label = getLabel(score);
  const dataCompleteness = calculateDataCompleteness(input);
  const insights = generateInsights(input, breakdown);

  return {
    score,
    label,
    breakdown: {
      sleep: Math.round(breakdown.sleep * 100) / 100,
      readiness: Math.round(breakdown.readiness * 100) / 100,
      adherence: Math.round(breakdown.adherence * 100) / 100,
      mood: Math.round(breakdown.mood * 100) / 100,
      activity: Math.round(breakdown.activity * 100) / 100,
      mindfulness: Math.round(breakdown.mindfulness * 100) / 100,
    },
    dataCompleteness,
    insights,
  };
}
