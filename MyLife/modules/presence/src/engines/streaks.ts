import type { StreakInfo, DailyUsage } from '../types';

/**
 * Calculate streak info from daily usage records.
 * A streak day = goal_met === 1. Records must be sorted by date descending.
 */
export function calculateStreaks(records: DailyUsage[]): StreakInfo {
  if (records.length === 0) {
    return { current: 0, longest: 0, lastGoalMetDate: null };
  }

  // Sort descending by date (most recent first)
  const sorted = [...records].sort((a, b) => b.date.localeCompare(a.date));

  let current = 0;
  let longest = 0;
  let runLength = 0;
  let lastGoalMetDate: string | null = null;

  // Find current streak (consecutive goal_met from most recent day)
  let foundBreak = false;
  for (const record of sorted) {
    if (record.goal_met === 1) {
      if (!lastGoalMetDate) lastGoalMetDate = record.date;
      if (!foundBreak) current++;
    } else {
      foundBreak = true;
    }
  }

  // Find longest streak
  // Re-sort ascending for longest streak calculation
  const ascending = [...sorted].reverse();
  for (const record of ascending) {
    if (record.goal_met === 1) {
      runLength++;
      if (runLength > longest) longest = runLength;
    } else {
      runLength = 0;
    }
  }

  return { current, longest, lastGoalMetDate };
}

/**
 * Check if today's streak is at risk (goal not yet met but streak > 0).
 */
export function isStreakAtRisk(
  currentStreak: number,
  todayGoalMet: boolean,
  currentHour: number,
): boolean {
  if (currentStreak === 0) return false;
  if (todayGoalMet) return false;
  // After 6 PM and goal not met = at risk
  return currentHour >= 18;
}
