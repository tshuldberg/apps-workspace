/**
 * Snore detection classification and scoring engine.
 * Classifies snore intensity, calculates scores, and finalizes sessions.
 * Pure functions, no side effects.
 */

import type { SnoreIntensity, SnoreScoreCategory, SnoreSessionSummary } from '../types';

/**
 * Classify snore intensity based on peak decibels.
 * Light: 40-50 dB, Moderate: 50-60 dB, Loud: 60-70 dB, Epic: >70 dB
 */
export function classifySnoreIntensity(decibels: number): SnoreIntensity {
  if (decibels < 50) return 'light';
  if (decibels < 60) return 'moderate';
  if (decibels < 70) return 'loud';
  return 'epic';
}

/**
 * Get the intensity weight multiplier for score calculation.
 */
export function getIntensityWeight(intensity: SnoreIntensity): number {
  switch (intensity) {
    case 'light': return 0.5;
    case 'moderate': return 1.0;
    case 'loud': return 1.5;
    case 'epic': return 2.0;
    default: return 1.0;
  }
}

/**
 * Calculate the percentage of recording time spent snoring.
 */
export function calculateSnorePercentage(
  snoreMinutes: number,
  totalMinutes: number,
): number {
  if (totalMinutes <= 0) return 0;
  return Math.round((snoreMinutes / totalMinutes) * 1000) / 10;
}

/**
 * Calculate the snore score (0-100).
 * Base = snore_percentage, adjusted by average intensity multiplier.
 */
export function calculateSnoreScore(
  snorePercentage: number,
  events: Array<{ intensity: SnoreIntensity }>,
): number {
  if (events.length === 0 || snorePercentage <= 0) return 0;

  const avgWeight = events.reduce((sum, e) => sum + getIntensityWeight(e.intensity), 0) / events.length;
  const raw = snorePercentage * avgWeight;
  return Math.round(Math.min(100, Math.max(0, raw)));
}

/**
 * Get the human-readable score category.
 */
export function getScoreCategory(score: number): SnoreScoreCategory {
  if (score <= 10) return 'quiet';
  if (score <= 30) return 'light';
  if (score <= 60) return 'moderate';
  if (score <= 80) return 'heavy';
  return 'severe';
}

/**
 * Get the color for a snore score (for UI rendering).
 */
export function getScoreColor(score: number): string {
  if (score <= 30) return '#30D158';   // green
  if (score <= 60) return '#FFD60A';   // yellow
  if (score <= 80) return '#FF9F0A';   // orange
  return '#FF453A';                     // red
}

/**
 * Finalize a snore session: compute all aggregate stats from events.
 */
export function finalizeSession(
  events: Array<{
    duration_seconds: number;
    intensity: string;
    decibels: number | null;
  }>,
  totalDurationMinutes: number,
): SnoreSessionSummary {
  if (events.length === 0) {
    return {
      snoreScore: 0,
      snoreMinutes: 0,
      snorePercentage: 0,
      loudestDb: 0,
      averageDb: 0,
      eventCount: 0,
    };
  }

  const snoreSeconds = events.reduce((sum, e) => sum + e.duration_seconds, 0);
  const snoreMinutes = Math.round(snoreSeconds / 60);
  const snorePercentage = calculateSnorePercentage(snoreMinutes, totalDurationMinutes);

  const dbValues = events
    .map((e) => e.decibels)
    .filter((d): d is number => d != null);

  const loudestDb = dbValues.length > 0 ? Math.max(...dbValues) : 0;
  const averageDb = dbValues.length > 0
    ? Math.round((dbValues.reduce((a, b) => a + b, 0) / dbValues.length) * 10) / 10
    : 0;

  const VALID_INTENSITIES = new Set<string>(['light', 'moderate', 'loud', 'epic']);
  const typedEvents = events.map((e) => ({
    intensity: (VALID_INTENSITIES.has(e.intensity) ? e.intensity : 'moderate') as SnoreIntensity,
  }));

  const snoreScore = calculateSnoreScore(snorePercentage, typedEvents);

  return {
    snoreScore,
    snoreMinutes,
    snorePercentage,
    loudestDb,
    averageDb,
    eventCount: events.length,
  };
}

/**
 * Determine if a snore session overlaps with a sleep session.
 * Used for linking snore data to sleep data.
 */
export function sessionsOverlap(
  snoreStart: string,
  snoreEnd: string,
  sleepStart: string,
  sleepEnd: string,
): boolean {
  const s1 = new Date(snoreStart).getTime();
  const e1 = new Date(snoreEnd).getTime();
  const s2 = new Date(sleepStart).getTime();
  const e2 = new Date(sleepEnd).getTime();

  return s1 < e2 && s2 < e1;
}

/**
 * Medical disclaimer text (required by NC-3).
 */
export const SNORE_DISCLAIMER =
  'Snore detection is for informational purposes only and is not a medical device. ' +
  'Consult a healthcare provider if you suspect a sleep disorder.';
