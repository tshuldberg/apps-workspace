import type { DatabaseAdapter } from '@mylife/db';
import type { StreakInfo, NegativeStreakInfo } from '../types';

// ---------------------------------------------------------------------------
// Enhanced Streak Engine
// ---------------------------------------------------------------------------

/**
 * Compute streaks for a habit with optional grace period.
 * Grace period allows N missed days before breaking the streak.
 */
export function getStreaksWithGrace(
  db: DatabaseAdapter,
  habitId: string,
  gracePeriod: number = 0,
): StreakInfo {
  const rows = db.query<{ d: string }>(
    `SELECT DISTINCT DATE(completed_at) as d FROM hb_completions
     WHERE habit_id = ? AND (value IS NULL OR value >= 0)
     ORDER BY d DESC`,
    [habitId],
  );
  if (rows.length === 0) return { currentStreak: 0, longestStreak: 0 };

  const dates = rows.map((r) => r.d);
  const today = new Date().toISOString().slice(0, 10);

  let currentStreak = 0;
  let longestStreak = 0;
  let streak = 1;

  // Check if the most recent completion is within grace period of today
  const daysSinceLast = daysBetween(dates[0], today);
  const isActive = daysSinceLast <= (gracePeriod + 1);

  if (isActive) {
    currentStreak = 1;
  }

  for (let i = 1; i < dates.length; i++) {
    const gapDays = daysBetween(dates[i], dates[i - 1]);
    // Gap of 1 means consecutive days. With grace, allow gap up to (1 + gracePeriod).
    if (gapDays <= (1 + gracePeriod)) {
      streak++;
      if (isActive && i < streak) {
        currentStreak = streak;
      }
    } else {
      if (streak > longestStreak) longestStreak = streak;
      streak = 1;
    }
  }
  if (streak > longestStreak) longestStreak = streak;
  if (currentStreak > longestStreak) longestStreak = currentStreak;

  return { currentStreak, longestStreak };
}

/**
 * For negative habits: compute days since last slip and longest clean streak.
 * Slips are recorded as completions with value = -1.
 */
export function getNegativeStreaks(
  db: DatabaseAdapter,
  habitId: string,
): NegativeStreakInfo {
  const slipRows = db.query<{ d: string }>(
    `SELECT DISTINCT DATE(completed_at) as d FROM hb_completions
     WHERE habit_id = ? AND value = -1
     ORDER BY d DESC`,
    [habitId],
  );

  const today = new Date().toISOString().slice(0, 10);

  if (slipRows.length === 0) {
    // No slips ever recorded. Check when habit was created for clean streak.
    const habitRows = db.query<{ created_at: string }>(
      'SELECT created_at FROM hb_habits WHERE id = ?',
      [habitId],
    );
    if (habitRows.length === 0) return { daysSinceLastSlip: 0, longestCleanStreak: 0 };
    const createdDate = habitRows[0].created_at.slice(0, 10);
    const days = daysBetween(createdDate, today);
    return { daysSinceLastSlip: days, longestCleanStreak: days };
  }

  const slipDates = slipRows.map((r) => r.d);
  const daysSinceLastSlip = daysBetween(slipDates[0], today);

  // Compute longest clean streak between slips
  let longestClean = daysSinceLastSlip; // current clean streak

  for (let i = 1; i < slipDates.length; i++) {
    const gap = daysBetween(slipDates[i], slipDates[i - 1]) - 1; // days between slips (exclusive)
    if (gap > longestClean) longestClean = gap;
  }

  // Also check gap between habit creation and first slip (last in desc order)
  const habitRows = db.query<{ created_at: string }>(
    'SELECT created_at FROM hb_habits WHERE id = ?',
    [habitId],
  );
  if (habitRows.length > 0) {
    const createdDate = habitRows[0].created_at.slice(0, 10);
    const firstSlip = slipDates[slipDates.length - 1];
    const initialClean = daysBetween(createdDate, firstSlip);
    if (initialClean > longestClean) longestClean = initialClean;
  }

  return { daysSinceLastSlip, longestCleanStreak: longestClean };
}

/**
 * Compute streaks for measurable habits.
 * A day counts as "completed" if the measurement value >= target.
 */
export function getMeasurableStreaks(
  db: DatabaseAdapter,
  habitId: string,
  gracePeriod: number = 0,
): StreakInfo {
  const rows = db.query<{ d: string }>(
    `SELECT DISTINCT DATE(measured_at) as d FROM hb_measurements
     WHERE habit_id = ? AND value >= target
     ORDER BY d DESC`,
    [habitId],
  );
  if (rows.length === 0) return { currentStreak: 0, longestStreak: 0 };

  const dates = rows.map((r) => r.d);
  const today = new Date().toISOString().slice(0, 10);

  let currentStreak = 0;
  let longestStreak = 0;
  let streak = 1;

  const daysSinceLast = daysBetween(dates[0], today);
  const isActive = daysSinceLast <= (gracePeriod + 1);
  if (isActive) currentStreak = 1;

  for (let i = 1; i < dates.length; i++) {
    const gapDays = daysBetween(dates[i], dates[i - 1]);
    if (gapDays <= (1 + gracePeriod)) {
      streak++;
      if (isActive && i < streak) currentStreak = streak;
    } else {
      if (streak > longestStreak) longestStreak = streak;
      streak = 1;
    }
  }
  if (streak > longestStreak) longestStreak = streak;
  if (currentStreak > longestStreak) longestStreak = currentStreak;

  return { currentStreak, longestStreak };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function daysBetween(earlier: string, later: string): number {
  const d1 = new Date(earlier + 'T00:00:00Z');
  const d2 = new Date(later + 'T00:00:00Z');
  return Math.round((d2.getTime() - d1.getTime()) / 86400000);
}
