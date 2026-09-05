import type { BPCategory, BPReading, BPAverages, BPCategoryDistribution } from '../models/bp-reading';

/**
 * Classify blood pressure according to AHA guidelines.
 * When systolic and diastolic fall into different categories, the higher (worse) category wins.
 */
export function classifyBP(systolic: number, diastolic: number): BPCategory {
  // Crisis takes priority
  if (systolic > 180 || diastolic > 120) return 'crisis';
  // Hypertension Stage 2
  if (systolic >= 140 || diastolic >= 90) return 'hypertension_2';
  // Hypertension Stage 1
  if (systolic >= 130 || diastolic >= 80) return 'hypertension_1';
  // Elevated (systolic 120-129 AND diastolic < 80)
  if (systolic >= 120) return 'elevated';
  // Normal
  return 'normal';
}

/**
 * Validate that systolic > diastolic.
 */
export function validateBP(systolic: number, diastolic: number): { valid: boolean; error?: string } {
  if (systolic <= diastolic) {
    return { valid: false, error: 'Systolic must be higher than diastolic.' };
  }
  return { valid: true };
}

/**
 * Calculate average systolic, diastolic, and pulse from readings.
 */
export function calculateBPAverages(readings: BPReading[]): BPAverages {
  if (readings.length === 0) {
    return { systolic: 0, diastolic: 0, pulse: null, count: 0 };
  }

  let systolicSum = 0;
  let diastolicSum = 0;
  let pulseSum = 0;
  let pulseCount = 0;

  for (const r of readings) {
    systolicSum += r.systolic;
    diastolicSum += r.diastolic;
    if (r.pulse != null) {
      pulseSum += r.pulse;
      pulseCount++;
    }
  }

  return {
    systolic: Math.round(systolicSum / readings.length),
    diastolic: Math.round(diastolicSum / readings.length),
    pulse: pulseCount > 0 ? Math.round(pulseSum / pulseCount) : null,
    count: readings.length,
  };
}

/**
 * Count readings per AHA category.
 */
export function getCategoryDistribution(readings: BPReading[]): BPCategoryDistribution {
  const dist: BPCategoryDistribution = {
    normal: 0,
    elevated: 0,
    hypertension_1: 0,
    hypertension_2: 0,
    crisis: 0,
  };

  for (const r of readings) {
    dist[r.category]++;
  }

  return dist;
}

/**
 * Parse legacy "120/80" string from md_measurements into systolic/diastolic.
 */
export function parseLegacyBP(value: string): { systolic: number; diastolic: number } | null {
  const match = value.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (!match) return null;

  const systolic = parseInt(match[1], 10);
  const diastolic = parseInt(match[2], 10);

  if (isNaN(systolic) || isNaN(diastolic)) return null;
  if (systolic <= 0 || diastolic <= 0) return null;

  return { systolic, diastolic };
}

/**
 * Filter readings within a date range.
 */
export function filterReadingsByPeriod(
  readings: BPReading[],
  fromDate: string,
  toDate: string,
): BPReading[] {
  return readings.filter((r) => r.measuredAt >= fromDate && r.measuredAt <= toDate);
}
