/**
 * Sobriety clock calculation engine.
 * Pure functions: no database calls, no side effects.
 */

import type { SobrietyDuration, SobrietyLifetimeStats } from '../types';

/**
 * Calculate the time elapsed since a quit date, accounting for slip days.
 * Returns a structured duration breakdown.
 */
export function calculateSobrietyDuration(
  quitDate: string,
  now: number,
  slipDates: string[] = [],
): SobrietyDuration {
  const quitMs = new Date(quitDate).getTime();
  if (now < quitMs) {
    return { years: 0, months: 0, days: 0, hours: 0, minutes: 0, seconds: 0, totalDays: 0 };
  }

  // Find the most recent slip to determine current streak start
  const lastSlipDate = slipDates.length > 0
    ? slipDates.sort().reverse()[0]
    : null;

  const streakStartMs = lastSlipDate
    ? new Date(lastSlipDate).getTime() + 86400000 // day after last slip
    : quitMs;

  const elapsedMs = Math.max(0, now - streakStartMs);
  const totalSeconds = Math.floor(elapsedMs / 1000);
  const totalDays = Math.floor(elapsedMs / 86400000);

  const years = Math.floor(totalDays / 365);
  const remainingAfterYears = totalDays - years * 365;
  const months = Math.floor(remainingAfterYears / 30);
  const days = remainingAfterYears - months * 30;

  const dayRemainder = totalSeconds % 86400;
  const hours = Math.floor(dayRemainder / 3600);
  const minutes = Math.floor((dayRemainder % 3600) / 60);
  const seconds = dayRemainder % 60;

  return { years, months, days, hours, minutes, seconds, totalDays };
}

/**
 * Calculate money saved based on clean days and daily cost.
 * daily_cost is stored in cents. Returns cents.
 */
export function calculateMoneySaved(cleanDays: number, dailyCostCents: number): number {
  if (cleanDays <= 0 || dailyCostCents <= 0) return 0;
  return cleanDays * dailyCostCents;
}

/**
 * Calculate lifetime sobriety statistics from completion history.
 * Slips are completions with value = -1.
 */
export function calculateLifetimeStats(
  quitDate: string,
  dailyCostCents: number,
  completionDates: string[],
  now: number,
): SobrietyLifetimeStats {
  // Slip dates are completion dates with value = -1 (passed in already filtered)
  const slipDates = [...new Set(completionDates)].sort();
  const totalSlips = slipDates.length;

  const quitMs = new Date(quitDate).getTime();
  const totalDaysSinceQuit = Math.max(0, Math.floor((now - quitMs) / 86400000));
  const totalCleanDays = Math.max(0, totalDaysSinceQuit - totalSlips);

  // Current streak: days since last slip
  const lastSlip = slipDates.length > 0 ? slipDates[slipDates.length - 1] : null;
  const streakStartMs = lastSlip
    ? new Date(lastSlip).getTime() + 86400000
    : quitMs;
  const currentStreak = Math.max(0, Math.floor((now - streakStartMs) / 86400000));

  // Longest streak: find max gap between slips
  let longestStreak = currentStreak;
  if (slipDates.length > 0) {
    // Gap from quit date to first slip
    const firstSlipMs = new Date(slipDates[0]).getTime();
    const gapToFirst = Math.floor((firstSlipMs - quitMs) / 86400000);
    if (gapToFirst > longestStreak) longestStreak = gapToFirst;

    // Gaps between consecutive slips
    for (let i = 1; i < slipDates.length; i++) {
      const prevMs = new Date(slipDates[i - 1]).getTime();
      const currMs = new Date(slipDates[i]).getTime();
      const gap = Math.floor((currMs - prevMs) / 86400000) - 1;
      if (gap > longestStreak) longestStreak = gap;
    }
  }

  return {
    totalCleanDays,
    totalSlips,
    currentStreak,
    longestStreak,
    moneySavedCurrent: calculateMoneySaved(currentStreak, dailyCostCents),
    moneySavedLifetime: calculateMoneySaved(totalCleanDays, dailyCostCents),
  };
}

/**
 * Calculate consecutive daily pledge streak.
 * pledgeDates should be sorted DESC (most recent first).
 */
export function getPledgeStreak(pledgeDates: string[], today: string): number {
  if (pledgeDates.length === 0) return 0;

  // pledgeDates are in DESC order
  let streak = 0;
  const todayMs = new Date(today + 'T00:00:00Z').getTime();

  for (let i = 0; i < pledgeDates.length; i++) {
    const expectedMs = todayMs - i * 86400000;
    const expectedDate = new Date(expectedMs).toISOString().slice(0, 10);
    if (pledgeDates[i] === expectedDate) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}
