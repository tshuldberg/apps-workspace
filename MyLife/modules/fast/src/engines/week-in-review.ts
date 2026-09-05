/**
 * Week-in-Review Engine
 *
 * Pure function that computes a weekly summary from fasting, hydration,
 * caffeine, and weight data. Foundation for shareable recap cards and
 * cross-module weekly digest (packages/engagement).
 *
 * All inputs are plain arrays/values. No database access.
 */

import type { Fast, WeekInReview, FastQualityInput } from '../types';
import { computeFastQualityScore } from './quality-score';

interface DailyHydration {
  date: string; // ISO date
  totalOz: number;
}

interface DailyCaffeine {
  date: string; // ISO date
  totalMg: number;
}

interface WeightSnapshot {
  date: string; // ISO date
  value: number;
  unit: 'lbs' | 'kg';
}

export interface WeekInReviewInput {
  periodStart: string; // ISO date (Monday)
  periodEnd: string; // ISO date (Sunday)
  fasts: Fast[];
  dailyHydration: DailyHydration[];
  dailyCaffeine: DailyCaffeine[];
  weights: WeightSnapshot[];
  hydrationTargetOz: number;
  caffeineCutoffTime: string; // HH:MM
  currentStreak: number;
}

/**
 * Compute a weekly summary from raw data inputs.
 */
export function computeWeekInReview(input: WeekInReviewInput): WeekInReview {
  const {
    periodStart,
    periodEnd,
    fasts,
    dailyHydration,
    dailyCaffeine,
    weights,
    hydrationTargetOz,
    currentStreak,
  } = input;

  // Fasting totals
  const completedFasts = fasts.filter((f) => f.endedAt !== null);
  const totalFastingHours = completedFasts.reduce((sum, f) => {
    const seconds = f.durationSeconds ?? 0;
    return sum + seconds / 3600;
  }, 0);

  // Hydration average
  const avgDailyHydrationOz =
    dailyHydration.length > 0
      ? dailyHydration.reduce((sum, d) => sum + d.totalOz, 0) / dailyHydration.length
      : 0;

  // Caffeine average
  const avgCaffeineMg =
    dailyCaffeine.length > 0
      ? dailyCaffeine.reduce((sum, d) => sum + d.totalMg, 0) / dailyCaffeine.length
      : 0;

  // Weight delta (first to last entry in the week)
  let weightDelta: number | null = null;
  if (weights.length >= 2) {
    const sorted = [...weights].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );
    weightDelta = sorted[sorted.length - 1].value - sorted[0].value;
  }

  // Quality scores per completed fast (simplified: assume hydration met if avg >= target)
  const hydrationMet = avgDailyHydrationOz >= hydrationTargetOz;
  const qualityScores = completedFasts.map((f) => {
    const qualityInput: FastQualityInput = {
      hitTarget: f.hitTarget === true,
      hydrationMet,
      noLateCaffeine: true, // Simplified: per-fast caffeine correlation needs per-day matching
      streakMaintained: currentStreak > 0,
    };
    return computeFastQualityScore(qualityInput);
  });

  const avgQualityScore =
    qualityScores.length > 0
      ? qualityScores.reduce((sum, q) => sum + q.total, 0) / qualityScores.length
      : 0;

  // Best day: the day of the highest-scoring fast
  let bestDay: string | null = null;
  if (qualityScores.length > 0) {
    let maxScore = -1;
    for (let i = 0; i < qualityScores.length; i++) {
      if (qualityScores[i].total > maxScore) {
        maxScore = qualityScores[i].total;
        const fast = completedFasts[i];
        bestDay = fast.endedAt?.split('T')[0] ?? fast.startedAt.split('T')[0];
      }
    }
  }

  return {
    periodStart,
    periodEnd,
    totalFastingHours: Math.round(totalFastingHours * 10) / 10,
    totalFasts: fasts.length,
    completedFasts: completedFasts.length,
    avgDailyHydrationOz: Math.round(avgDailyHydrationOz * 10) / 10,
    avgCaffeineMg: Math.round(avgCaffeineMg),
    weightDelta: weightDelta !== null ? Math.round(weightDelta * 100) / 100 : null,
    avgQualityScore: Math.round(avgQualityScore),
    streakAtEnd: currentStreak,
    bestDay,
  };
}
