import type { CGMReading, TrendArrow, AGPBin, CGMStats } from '../models/cgm';
import { GLUCOSE_CONVERSION_FACTOR } from '../models/glucose';

/**
 * Normalize a glucose value to mg/dL.
 */
function toMgDl(value: number, unit: string): number {
  return unit === 'mmol/L' ? value * GLUCOSE_CONVERSION_FACTOR : value;
}

/**
 * Calculate Glucose Management Indicator (GMI) from average CGM glucose.
 * GMI = 3.31 + (0.02392 * average_mg_dL)
 */
export function calculateGMI(averageMgDl: number): number {
  return Math.round((3.31 + 0.02392 * averageMgDl) * 10) / 10;
}

/**
 * Calculate trend arrow from recent readings.
 * Uses rate of change in mg/dL per minute from the 3 most recent readings.
 */
export function calculateTrendArrow(readings: CGMReading[]): TrendArrow {
  if (readings.length < 2) return 'flat';

  const sorted = [...readings].sort((a, b) => b.measuredAt.localeCompare(a.measuredAt));
  const recent = sorted.slice(0, 3);

  const newest = recent[0];
  const oldest = recent[recent.length - 1];
  const timeDiffMin = (new Date(newest.measuredAt).getTime() - new Date(oldest.measuredAt).getTime()) / 60000;

  if (timeDiffMin <= 0) return 'flat';

  const valueDiff = toMgDl(newest.value, newest.unit) - toMgDl(oldest.value, oldest.unit);
  const ratePerMin = valueDiff / timeDiffMin;

  if (ratePerMin > 3) return 'rising_fast';
  if (ratePerMin > 2) return 'rising';
  if (ratePerMin > 1) return 'rising_slow';
  if (ratePerMin < -3) return 'falling_fast';
  if (ratePerMin < -2) return 'falling';
  if (ratePerMin < -1) return 'falling_slow';
  return 'flat';
}

/**
 * Calculate coefficient of variation (CV%) from readings.
 * Target: <36% for good glucose stability.
 */
export function calculateCV(readings: CGMReading[]): number {
  if (readings.length < 2) return 0;

  const values = readings.map((r) => toMgDl(r.value, r.unit));
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  if (mean === 0) return 0;

  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  const sd = Math.sqrt(variance);

  return Math.round((sd / mean) * 100 * 10) / 10;
}

/**
 * Calculate standard deviation of glucose readings in mg/dL.
 */
export function calculateSD(readings: CGMReading[]): number {
  if (readings.length < 2) return 0;

  const values = readings.map((r) => toMgDl(r.value, r.unit));
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;

  return Math.round(Math.sqrt(variance) * 10) / 10;
}

/**
 * Calculate Time in Range breakdown.
 */
export function calculateTIRBreakdown(
  readings: CGMReading[],
  targetLow: number = 70,
  targetHigh: number = 180,
  urgentLow: number = 54,
  veryHigh: number = 250,
): { veryLow: number; low: number; inRange: number; high: number; veryHigh: number } {
  if (readings.length === 0) {
    return { veryLow: 0, low: 0, inRange: 0, high: 0, veryHigh: 0 };
  }

  let vl = 0, lo = 0, ir = 0, hi = 0, vh = 0;
  for (const r of readings) {
    const v = toMgDl(r.value, r.unit);
    if (v < urgentLow) vl++;
    else if (v < targetLow) lo++;
    else if (v <= targetHigh) ir++;
    else if (v <= veryHigh) hi++;
    else vh++;
  }

  const n = readings.length;
  return {
    veryLow: Math.round((vl / n) * 100),
    low: Math.round((lo / n) * 100),
    inRange: Math.round((ir / n) * 100),
    high: Math.round((hi / n) * 100),
    veryHigh: Math.round((vh / n) * 100),
  };
}

/**
 * Build Ambulatory Glucose Profile (AGP) data.
 * Bins readings into 5-minute intervals across the day and computes percentiles.
 */
export function calculateAGP(readings: CGMReading[]): AGPBin[] {
  if (readings.length === 0) return [];

  const bins: Map<number, number[]> = new Map();
  for (let m = 0; m < 1440; m += 5) {
    bins.set(m, []);
  }

  for (const r of readings) {
    const d = new Date(r.measuredAt);
    const minutes = d.getHours() * 60 + d.getMinutes();
    const binKey = Math.floor(minutes / 5) * 5;
    const arr = bins.get(binKey);
    if (arr) arr.push(toMgDl(r.value, r.unit));
  }

  const result: AGPBin[] = [];
  for (const [timeMinutes, values] of bins) {
    if (values.length === 0) continue;
    values.sort((a, b) => a - b);
    result.push({
      timeMinutes,
      p10: percentile(values, 10),
      p25: percentile(values, 25),
      p50: percentile(values, 50),
      p75: percentile(values, 75),
      p90: percentile(values, 90),
    });
  }

  return result.sort((a, b) => a.timeMinutes - b.timeMinutes);
}

/**
 * Get comprehensive CGM statistics.
 */
export function getCGMStats(readings: CGMReading[]): CGMStats {
  if (readings.length === 0) {
    return { averageGlucose: 0, gmi: 0, cv: 0, sd: 0, timeInRange: 0, timeBelowRange: 0, timeAboveRange: 0, readingCount: 0 };
  }

  const values = readings.map((r) => toMgDl(r.value, r.unit));
  const avg = values.reduce((s, v) => s + v, 0) / values.length;
  const tir = calculateTIRBreakdown(readings);

  return {
    averageGlucose: Math.round(avg * 10) / 10,
    gmi: calculateGMI(avg),
    cv: calculateCV(readings),
    sd: calculateSD(readings),
    timeInRange: tir.inRange,
    timeBelowRange: tir.veryLow + tir.low,
    timeAboveRange: tir.high + tir.veryHigh,
    readingCount: readings.length,
  };
}

/**
 * Deduplicate readings by timestamp proximity.
 * Skips new readings within `thresholdSeconds` of existing ones.
 */
export function deduplicateReadings(
  existing: CGMReading[],
  incoming: CGMReading[],
  thresholdSeconds: number = 60,
): CGMReading[] {
  const existingTimes = new Set(
    existing.map((r) => Math.floor(new Date(r.measuredAt).getTime() / (thresholdSeconds * 1000))),
  );

  return incoming.filter((r) => {
    const bucket = Math.floor(new Date(r.measuredAt).getTime() / (thresholdSeconds * 1000));
    return !existingTimes.has(bucket);
  });
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (idx - lower);
}
