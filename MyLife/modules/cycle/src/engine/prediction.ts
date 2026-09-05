import type { CyclePhase, CyclePrediction } from '../types';

/**
 * Add days to an ISO date string, returning a new ISO date string.
 */
function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Difference in days between two ISO date strings (b - a).
 */
function daysBetween(a: string, b: string): number {
  const da = new Date(a + 'T00:00:00Z');
  const db = new Date(b + 'T00:00:00Z');
  return Math.round((db.getTime() - da.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Calculate the weighted moving average of cycle lengths.
 * More recent cycles receive higher weights.
 * Uses at most the last 6 completed cycles.
 *
 * @param cycleLengths - Array of cycle lengths in reverse chronological order (most recent first).
 * @returns The weighted average, or null if fewer than 2 cycles.
 */
export function calculateAverageCycleLength(cycleLengths: number[]): number | null {
  // Filter out unreasonable gaps (> 90 days likely a tracking gap)
  const filtered = cycleLengths.filter((l) => l <= 90);
  if (filtered.length < 2) return null;

  const n = Math.min(filtered.length, 6);
  const recent = filtered.slice(0, n);

  let weightedSum = 0;
  let weightTotal = 0;

  for (let i = 0; i < recent.length; i++) {
    const weight = n - i; // Most recent gets highest weight
    weightedSum += recent[i] * weight;
    weightTotal += weight;
  }

  return Math.round((weightedSum / weightTotal) * 10) / 10;
}

/**
 * Calculate the weighted average period length.
 *
 * @param periodLengths - Array of period lengths in reverse chronological order (most recent first).
 * @returns The weighted average, or null if insufficient data.
 */
export function calculateAveragePeriodLength(periodLengths: number[]): number | null {
  if (periodLengths.length < 1) return null;

  const n = Math.min(periodLengths.length, 6);
  const recent = periodLengths.slice(0, n);

  let weightedSum = 0;
  let weightTotal = 0;

  for (let i = 0; i < recent.length; i++) {
    const weight = n - i;
    weightedSum += recent[i] * weight;
    weightTotal += weight;
  }

  return Math.round((weightedSum / weightTotal) * 10) / 10;
}

/**
 * Predict the next period start date based on cycle history.
 *
 * @param lastStartDate - The start date of the most recent cycle (ISO string).
 * @param cycleLengths - Completed cycle lengths in reverse chronological order.
 * @param periodLengths - Completed period lengths in reverse chronological order.
 * @param today - Today's date as ISO string.
 * @returns A prediction object, or null if insufficient data.
 */
export function predictNextPeriod(
  lastStartDate: string,
  cycleLengths: number[],
  periodLengths: number[],
  today: string,
): CyclePrediction | null {
  const avgCycle = calculateAverageCycleLength(cycleLengths);
  if (avgCycle === null) return null;

  const avgPeriod = calculateAveragePeriodLength(periodLengths) ?? 5;

  const predictedStart = addDays(lastStartDate, Math.round(avgCycle));
  const predictedEnd = addDays(predictedStart, Math.round(avgPeriod) - 1);

  // Fertile window: estimated ovulation is cycle length minus 14 days from start
  const estimatedOvulation = addDays(lastStartDate, Math.round(avgCycle) - 14);
  const fertileWindowStart = addDays(estimatedOvulation, -3);
  const fertileWindowEnd = addDays(estimatedOvulation, 1);

  // Confidence based on standard deviation of cycle lengths
  const filtered = cycleLengths.filter((l) => l <= 90).slice(0, 6);
  let confidence = 0.5;
  if (filtered.length >= 2) {
    const avg = filtered.reduce((a, b) => a + b, 0) / filtered.length;
    const variance = filtered.reduce((s, l) => s + (l - avg) ** 2, 0) / filtered.length;
    const stdDev = Math.sqrt(variance);
    confidence = Math.max(0, Math.round((1 - stdDev / avg) * 100) / 100);
  }

  const daysUntil = daysBetween(today, predictedStart);

  return {
    predictedStartDate: predictedStart,
    predictedEndDate: predictedEnd,
    fertileWindowStart,
    fertileWindowEnd,
    confidence,
    daysUntilNextPeriod: daysUntil,
  };
}

/**
 * Determine the current cycle phase given a cycle start date and today's date.
 * Uses standard phase durations based on a 28-day cycle template,
 * scaled to the user's average cycle length.
 *
 * @param cycleStartDate - The start date of the current cycle (ISO string).
 * @param today - Today's date (ISO string).
 * @param avgCycleLength - The user's average cycle length (default 28).
 * @returns The current phase name.
 */
export function getCurrentPhase(
  cycleStartDate: string,
  today: string,
  avgCycleLength = 28,
): CyclePhase {
  const dayOfCycle = daysBetween(cycleStartDate, today) + 1; // 1-based

  if (dayOfCycle < 1) return 'menstrual';

  // Phase boundaries as fractions of cycle length
  // Menstrual: days 1-5 (~18% of cycle)
  // Follicular: days 6-13 (~29% of cycle)
  // Ovulation: days 14-16 (~11% of cycle)
  // Luteal: days 17-28 (~42% of cycle)
  const menstrualEnd = Math.round(avgCycleLength * 0.18);
  const follicularEnd = Math.round(avgCycleLength * 0.46);
  const ovulationEnd = Math.round(avgCycleLength * 0.57);

  if (dayOfCycle <= menstrualEnd) return 'menstrual';
  if (dayOfCycle <= follicularEnd) return 'follicular';
  if (dayOfCycle <= ovulationEnd) return 'ovulation';
  return 'luteal';
}

/**
 * Calculate how many days late the current period is.
 * Returns 0 if the period is not late, or a positive number of days.
 *
 * @param lastStartDate - The start date of the most recent cycle.
 * @param avgCycleLength - Average cycle length.
 * @param today - Today's date.
 * @returns Number of days late (0 means on time or early).
 */
export function isLateByDays(
  lastStartDate: string,
  avgCycleLength: number,
  today: string,
): number {
  const expectedStart = addDays(lastStartDate, Math.round(avgCycleLength));
  const diff = daysBetween(expectedStart, today);
  return Math.max(0, diff);
}
