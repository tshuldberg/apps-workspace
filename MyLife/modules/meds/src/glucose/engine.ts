import type {
  GlucoseRangeStatus,
  GlucoseUnit,
  GlucoseTargets,
  GlucoseReading,
  GlucosePatternAnalysis,
} from '../models/glucose';
import { DEFAULT_GLUCOSE_TARGETS, GLUCOSE_CONVERSION_FACTOR } from '../models/glucose';

/**
 * Convert glucose value between mg/dL and mmol/L.
 */
export function convertGlucose(
  value: number,
  from: GlucoseUnit,
  to: GlucoseUnit,
): number {
  if (from === to) return value;
  if (from === 'mg/dL' && to === 'mmol/L') {
    return Math.round((value / GLUCOSE_CONVERSION_FACTOR) * 100) / 100;
  }
  // mmol/L to mg/dL
  return Math.round(value * GLUCOSE_CONVERSION_FACTOR * 100) / 100;
}

/**
 * Normalize a glucose value to mg/dL for internal calculations.
 */
function toMgDl(value: number, unit: GlucoseUnit): number {
  return unit === 'mmol/L' ? value * GLUCOSE_CONVERSION_FACTOR : value;
}

/**
 * Classify a glucose reading into a range status based on ADA guidelines.
 * Value is compared in mg/dL internally.
 */
export function classifyGlucose(
  value: number,
  unit: GlucoseUnit = 'mg/dL',
  targets: GlucoseTargets = DEFAULT_GLUCOSE_TARGETS,
): GlucoseRangeStatus {
  const mgDl = toMgDl(value, unit);

  if (mgDl < targets.urgentLow) return 'very_low';
  if (mgDl < targets.low) return 'low';
  if (mgDl <= targets.high) return 'in_range';
  if (mgDl <= targets.veryHigh) return 'high';
  return 'very_high';
}

/**
 * Check if a glucose value is in the target range.
 */
export function isInRange(
  value: number,
  unit: GlucoseUnit = 'mg/dL',
  targets: GlucoseTargets = DEFAULT_GLUCOSE_TARGETS,
): boolean {
  const mgDl = toMgDl(value, unit);
  return mgDl >= targets.low && mgDl <= targets.high;
}

/**
 * Calculate Time in Range percentage.
 * Returns 0-100 percentage of readings within targetLow..targetHigh (in mg/dL).
 */
export function calculateTimeInRange(
  readings: GlucoseReading[],
  targetLow: number = DEFAULT_GLUCOSE_TARGETS.low,
  targetHigh: number = DEFAULT_GLUCOSE_TARGETS.high,
): number {
  if (readings.length === 0) return 0;

  let inRange = 0;
  for (const r of readings) {
    const mgDl = toMgDl(r.value, r.unit as GlucoseUnit);
    if (mgDl >= targetLow && mgDl <= targetHigh) {
      inRange++;
    }
  }

  return Math.round((inRange / readings.length) * 100);
}

/**
 * Estimate A1c from average glucose in mg/dL using the ADAG formula.
 * Formula: A1c = (average_mg + 46.7) / 28.7
 */
export function estimateA1c(averageGlucoseMgDl: number): number {
  return Math.round(((averageGlucoseMgDl + 46.7) / 28.7) * 10) / 10;
}

/**
 * Calculate average glucose in mg/dL from a set of readings.
 */
export function calculateAverageGlucose(readings: GlucoseReading[]): number {
  if (readings.length === 0) return 0;

  let sum = 0;
  for (const r of readings) {
    sum += toMgDl(r.value, r.unit as GlucoseUnit);
  }

  return Math.round((sum / readings.length) * 10) / 10;
}

/**
 * Analyze glucose patterns by meal context.
 */
export function analyzeGlucosePatterns(readings: GlucoseReading[]): GlucosePatternAnalysis {
  if (readings.length === 0) {
    return {
      averageFasting: null,
      averagePostMeal: null,
      averageOverall: 0,
      readingCount: 0,
      fastingCount: 0,
      postMealCount: 0,
    };
  }

  let overallSum = 0;
  let fastingSum = 0;
  let fastingCount = 0;
  let postMealSum = 0;
  let postMealCount = 0;

  for (const r of readings) {
    const mgDl = toMgDl(r.value, r.unit as GlucoseUnit);
    overallSum += mgDl;

    if (r.mealContext === 'fasting') {
      fastingSum += mgDl;
      fastingCount++;
    } else if (r.mealContext === 'after_meal') {
      postMealSum += mgDl;
      postMealCount++;
    }
  }

  return {
    averageFasting: fastingCount > 0 ? Math.round((fastingSum / fastingCount) * 10) / 10 : null,
    averagePostMeal: postMealCount > 0 ? Math.round((postMealSum / postMealCount) * 10) / 10 : null,
    averageOverall: Math.round((overallSum / readings.length) * 10) / 10,
    readingCount: readings.length,
    fastingCount,
    postMealCount,
  };
}

/**
 * Parse legacy blood sugar value from md_measurements.
 */
export function parseLegacyGlucose(value: string): number | null {
  const num = parseFloat(value);
  return isNaN(num) || num <= 0 ? null : num;
}
