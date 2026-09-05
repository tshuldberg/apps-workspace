/**
 * Streak freeze / insurance engine.
 * Allows users to freeze their streak for up to N days per month
 * without breaking it (vacation, sick days).
 * Pure functions: no database calls, no side effects.
 */

/** Maximum freeze days allowed per calendar month. */
export const MAX_FREEZES_PER_MONTH = 2;

/**
 * Check if a freeze can be applied for a given date.
 * Returns false if the monthly freeze limit is already reached.
 */
export function canFreeze(
  existingFreezeDates: string[],
  targetDate: string,
  maxPerMonth: number = MAX_FREEZES_PER_MONTH,
): boolean {
  const targetMonth = targetDate.slice(0, 7); // YYYY-MM
  const freezesThisMonth = existingFreezeDates.filter(
    d => d.slice(0, 7) === targetMonth,
  ).length;
  return freezesThisMonth < maxPerMonth;
}

/**
 * Get the number of remaining freezes for a given month.
 */
export function remainingFreezes(
  existingFreezeDates: string[],
  month: string, // YYYY-MM
  maxPerMonth: number = MAX_FREEZES_PER_MONTH,
): number {
  const used = existingFreezeDates.filter(d => d.slice(0, 7) === month).length;
  return Math.max(0, maxPerMonth - used);
}

/**
 * Calculate a streak length that respects frozen dates.
 * Frozen dates are treated as "free passes" -- they don't break
 * the streak but also don't increment it.
 *
 * completionDates: sorted DESC (most recent first), YYYY-MM-DD format
 * frozenDates: set of YYYY-MM-DD dates that are frozen
 * today: YYYY-MM-DD
 */
export function calculateStreakWithFreezes(
  completionDates: string[],
  frozenDates: Set<string>,
  today: string,
): { currentStreak: number; frozenDaysUsed: number } {
  if (completionDates.length === 0 && frozenDates.size === 0) {
    return { currentStreak: 0, frozenDaysUsed: 0 };
  }

  const completionSet = new Set(completionDates);
  let streak = 0;
  let frozenDaysUsed = 0;
  const todayMs = new Date(today + 'T00:00:00Z').getTime();
  const dayMs = 86400000;

  // Walk backwards from today
  for (let i = 0; i < 3650; i++) { // max 10 years lookback
    const checkDate = new Date(todayMs - i * dayMs).toISOString().slice(0, 10);

    if (completionSet.has(checkDate)) {
      streak++;
    } else if (frozenDates.has(checkDate)) {
      frozenDaysUsed++;
      // Frozen day: don't break streak, don't increment
    } else {
      break; // Neither completed nor frozen -- streak broken
    }
  }

  return { currentStreak: streak, frozenDaysUsed };
}

/**
 * Determine if today should be auto-suggested as a freeze day.
 * Useful for: user hasn't completed any habits today and it's past their
 * typical completion time.
 */
export function shouldSuggestFreeze(
  completedTodayCount: number,
  totalActiveHabits: number,
  currentHour: number,
  typicalCompletionHour: number,
): boolean {
  if (totalActiveHabits === 0) return false;
  if (completedTodayCount > 0) return false;
  // Suggest freeze if it's 2+ hours past their typical completion time
  return currentHour >= typicalCompletionHour + 2;
}
