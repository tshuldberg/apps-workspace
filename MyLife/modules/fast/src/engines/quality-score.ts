/**
 * Fast Quality Score Engine
 *
 * Pure function that computes a composite quality score (0-100) for a
 * completed fast. Gives users richer feedback than binary pass/fail.
 *
 * Scoring breakdown:
 *   Target hit:         40 points (did you reach your fasting target?)
 *   Hydration met:      30 points (did you meet your daily hydration goal?)
 *   No late caffeine:   20 points (did you avoid caffeine after cutoff?)
 *   Streak maintained:  10 points (is your current streak intact?)
 *
 * Grade scale: A (90+), B (75+), C (60+), D (40+), F (<40)
 */

import type { FastQualityInput, FastQualityScore } from '../types';

const WEIGHTS = {
  target: 40,
  hydration: 30,
  caffeine: 20,
  streak: 10,
} as const;

function gradeFromScore(total: number): FastQualityScore['grade'] {
  if (total >= 90) return 'A';
  if (total >= 75) return 'B';
  if (total >= 60) return 'C';
  if (total >= 40) return 'D';
  return 'F';
}

/**
 * Compute a composite quality score for a completed fast.
 * Each boolean input maps to its weight (full points if true, 0 if false).
 */
export function computeFastQualityScore(input: FastQualityInput): FastQualityScore {
  const breakdown = {
    target: input.hitTarget ? WEIGHTS.target : 0,
    hydration: input.hydrationMet ? WEIGHTS.hydration : 0,
    caffeine: input.noLateCaffeine ? WEIGHTS.caffeine : 0,
    streak: input.streakMaintained ? WEIGHTS.streak : 0,
  };

  const total = breakdown.target + breakdown.hydration + breakdown.caffeine + breakdown.streak;

  return {
    total,
    breakdown,
    grade: gradeFromScore(total),
  };
}
