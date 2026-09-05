/**
 * Caffeine Calculation Engine
 *
 * Pure functions for computing daily caffeine totals, metabolization curves,
 * and status classification. No database access -- takes data as input.
 *
 * Half-life: 5 hours (median human caffeine half-life).
 * Clear threshold: 25mg (roughly negligible).
 */

import type { CaffeineSnapshot, CaffeineStatus, CaffeineSummary } from '../types';

const HALF_LIFE_MS = 5 * 60 * 60 * 1000; // 5 hours in milliseconds
const CLEAR_THRESHOLD_MG = 25;
const STEP_MS = 15 * 60 * 1000; // 15-minute granularity

/**
 * Scale caffeine by volume ratio.
 * E.g., 16oz of coffee (default 8oz at 95mg) = 190mg.
 */
export function scaleCaffeine(caffeineMgPerDefault: number, volumeOz: number, defaultOz: number): number {
  if (defaultOz <= 0) return 0;
  return caffeineMgPerDefault * (volumeOz / defaultOz);
}

/**
 * Calculate total daily caffeine from drink snapshots.
 */
export function calculateDailyCaffeine(drinks: CaffeineSnapshot[]): number {
  return drinks.reduce((sum, d) => sum + d.caffeineMg, 0);
}

/**
 * Calculate remaining caffeine from a single dose at a given time.
 * Formula: remaining = dose * 0.5^((now - loggedAt) / halfLife)
 */
export function remainingFromDose(doseMg: number, loggedAtMs: number, nowMs: number): number {
  if (nowMs <= loggedAtMs) return doseMg;
  const elapsed = nowMs - loggedAtMs;
  return doseMg * Math.pow(0.5, elapsed / HALF_LIFE_MS);
}

/**
 * Calculate total remaining caffeine at a given time from all drinks.
 */
export function calculateRemainingCaffeine(drinks: CaffeineSnapshot[], now?: Date): number {
  const nowMs = (now ?? new Date()).getTime();
  return drinks.reduce((sum, d) => {
    const loggedMs = new Date(d.loggedAt).getTime();
    return sum + remainingFromDose(d.caffeineMg, loggedMs, nowMs);
  }, 0);
}

/**
 * Find the time when total remaining caffeine drops below the clear threshold.
 * Returns ISO 8601 string or null if already clear.
 * Uses 15-minute step iteration.
 */
export function calculateClearByTime(drinks: CaffeineSnapshot[], now?: Date): string | null {
  const caffeinated = drinks.filter((d) => d.caffeineMg > 0);
  if (caffeinated.length === 0) return null;

  const nowMs = (now ?? new Date()).getTime();
  const currentRemaining = calculateRemainingCaffeine(caffeinated, new Date(nowMs));
  if (currentRemaining < CLEAR_THRESHOLD_MG) return null;

  // Step forward in 15-minute increments up to 48 hours
  const maxSteps = (48 * 60) / 15;
  let checkMs = nowMs;
  for (let i = 0; i < maxSteps; i++) {
    checkMs += STEP_MS;
    const remaining = caffeinated.reduce((sum, d) => {
      const loggedMs = new Date(d.loggedAt).getTime();
      return sum + remainingFromDose(d.caffeineMg, loggedMs, checkMs);
    }, 0);
    if (remaining < CLEAR_THRESHOLD_MG) {
      return new Date(checkMs).toISOString();
    }
  }

  // Shouldn't reach here with realistic caffeine amounts
  return new Date(checkMs).toISOString();
}

/**
 * Classify caffeine intake status.
 */
export function getCaffeineStatus(
  totalMg: number,
  dailyLimitMg: number,
  hasLateDrink: boolean,
): CaffeineStatus {
  if (totalMg === 0) return 'empty';
  if (totalMg >= 1000) return 'critical';
  if (hasLateDrink) return 'late';
  if (totalMg >= dailyLimitMg) return 'high';
  return 'normal';
}

/**
 * Check if any drink was logged after the cutoff time.
 * @param drinks Caffeine snapshots
 * @param cutoffTime HH:MM format (24h), e.g., "14:00"
 * @param referenceDate Date to compare against (defaults to today)
 */
export function hasLateCaffeine(
  drinks: CaffeineSnapshot[],
  cutoffTime: string,
  referenceDate?: Date,
): boolean {
  if (drinks.length === 0) return false;

  const [cutoffH, cutoffM] = cutoffTime.split(':').map(Number);
  const ref = referenceDate ?? new Date();
  const cutoffDate = new Date(ref);
  cutoffDate.setHours(cutoffH, cutoffM, 0, 0);
  const cutoffMs = cutoffDate.getTime();

  return drinks.some((d) => new Date(d.loggedAt).getTime() >= cutoffMs);
}

/**
 * Build a complete caffeine summary for the day.
 */
export function buildCaffeineSummary(
  drinks: CaffeineSnapshot[],
  dailyLimitMg: number,
  cutoffTime: string,
  now?: Date,
): CaffeineSummary {
  const totalMg = calculateDailyCaffeine(drinks);
  const isLate = hasLateCaffeine(drinks, cutoffTime, now);
  const status = getCaffeineStatus(totalMg, dailyLimitMg, isLate);
  const remainingMg = calculateRemainingCaffeine(drinks, now);
  const clearByTime = calculateClearByTime(drinks, now);

  return {
    totalMg,
    status,
    drinks,
    remainingMg,
    clearByTime,
  };
}
