/**
 * Readiness score calculation engine.
 * Produces a daily 0-100 composite metric from sleep, HRV, RHR, activity, and strain.
 * Pure functions, no side effects.
 */

import type { ReadinessInput, ReadinessResult, Recommendation } from '../types';

// Weights: Sleep 35%, HRV 25%, RHR 15%, Activity 15%, Strain 10%
const WEIGHT_SLEEP = 0.35;
const WEIGHT_HRV = 0.25;
const WEIGHT_RHR = 0.15;
const WEIGHT_ACTIVITY = 0.15;
const WEIGHT_STRAIN = 0.10;

const DEFAULT_FACTOR = 0.5;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function normalizeSleepFactor(
  durationMinutes: number | null,
  qualityScore: number | null,
  targetMinutes: number,
): number {
  if (durationMinutes === null) return DEFAULT_FACTOR;
  const durationRatio = clamp(durationMinutes / targetMinutes, 0, 1);
  const quality = qualityScore !== null ? clamp(qualityScore / 100, 0, 1) : 0.7;
  return durationRatio * 0.6 + quality * 0.4;
}

export function normalizeHrvFactor(
  current: number | null,
  baseline: number | null,
): number {
  if (current === null) return DEFAULT_FACTOR;
  if (baseline === null || baseline === 0) return DEFAULT_FACTOR;
  const ratio = current / baseline;
  return clamp(ratio, 0, 1.5) / 1.5;
}

export function normalizeRhrFactor(
  current: number | null,
  baseline: number | null,
): number {
  if (current === null) return DEFAULT_FACTOR;
  if (baseline === null || baseline === 0) return DEFAULT_FACTOR;
  // Lower RHR relative to baseline = better recovery
  const deviation = (baseline - current) / baseline;
  return clamp(0.5 + deviation, 0, 1);
}

export function normalizeActivityFactor(activeEnergy: number | null): number {
  if (activeEnergy === null) return DEFAULT_FACTOR;
  // Moderate activity is ideal. Too low or too high reduces score.
  // Optimal range: 200-600 cal
  if (activeEnergy < 50) return 0.3;
  if (activeEnergy <= 200) return 0.5 + (activeEnergy - 50) / 300;
  if (activeEnergy <= 600) return 1.0;
  // Excessive activity
  return clamp(1.0 - (activeEnergy - 600) / 800, 0.3, 1.0);
}

export function normalizeStrainFactor(workoutStrain: number | null): number {
  if (workoutStrain === null) return 0.8; // Rest day is good
  // High strain yesterday = need more recovery = lower readiness
  // Strain is arbitrary units; normalize assuming 0-100 scale
  return clamp(1.0 - workoutStrain / 100, 0, 1);
}

export function getRecommendation(score: number): Recommendation {
  if (score >= 80) return 'intense';
  if (score >= 60) return 'moderate';
  if (score >= 40) return 'light';
  return 'rest';
}

export function calculateDataCompleteness(input: ReadinessInput): number {
  let present = 0;
  const total = 5;
  if (input.sleepDurationMinutes !== null) present++;
  if (input.hrvValue !== null) present++;
  if (input.rhrValue !== null) present++;
  if (input.activeEnergyYesterday !== null) present++;
  if (input.workoutStrainYesterday !== null) present++;
  return present / total;
}

export function calculateReadinessScore(input: ReadinessInput): ReadinessResult {
  const sleepFactor = normalizeSleepFactor(
    input.sleepDurationMinutes, input.sleepQualityScore, input.sleepTargetMinutes,
  );
  const hrvFactor = normalizeHrvFactor(input.hrvValue, input.hrvBaseline);
  const rhrFactor = normalizeRhrFactor(input.rhrValue, input.rhrBaseline);
  const activityFactor = normalizeActivityFactor(input.activeEnergyYesterday);
  const strainFactor = normalizeStrainFactor(input.workoutStrainYesterday);

  const rawScore =
    sleepFactor * WEIGHT_SLEEP +
    hrvFactor * WEIGHT_HRV +
    rhrFactor * WEIGHT_RHR +
    activityFactor * WEIGHT_ACTIVITY +
    strainFactor * WEIGHT_STRAIN;

  const score = Math.round(clamp(rawScore * 100, 0, 100));
  const recommendation = getRecommendation(score);
  const dataCompleteness = calculateDataCompleteness(input);

  return {
    score,
    sleepFactor: Math.round(sleepFactor * 100) / 100,
    hrvFactor: Math.round(hrvFactor * 100) / 100,
    rhrFactor: Math.round(rhrFactor * 100) / 100,
    activityFactor: Math.round(activityFactor * 100) / 100,
    strainFactor: Math.round(strainFactor * 100) / 100,
    recommendation,
    dataCompleteness,
  };
}
