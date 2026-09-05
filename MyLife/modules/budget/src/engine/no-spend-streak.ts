/**
 * No Spend Day tracker -- gamify frugality.
 *
 * Counts consecutive days with zero outflow transactions (streak)
 * and total no-spend days in a given month. Connects naturally
 * to the Habits module for cross-module engagement.
 *
 * Pure functions operating on transaction date arrays.
 */

export interface NoSpendStreakResult {
  /** Current consecutive no-spend days ending today (or yesterday if today has spending). */
  currentStreak: number;
  /** Longest streak in the provided date range. */
  longestStreak: number;
  /** Total no-spend days in the month. */
  noSpendDaysThisMonth: number;
  /** Total days elapsed in the month (up to today). */
  daysElapsed: number;
  /** Percentage of days that were no-spend. */
  noSpendPercent: number;
}

/**
 * Build a set of dates (YYYY-MM-DD) that had outflow transactions.
 */
function buildSpendDaySet(transactionDates: string[]): Set<string> {
  return new Set(transactionDates);
}

/**
 * Generate all dates from startDate to endDate inclusive (YYYY-MM-DD strings).
 */
function generateDateRange(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const current = new Date(startDate + 'T00:00:00Z');
  const end = new Date(endDate + 'T00:00:00Z');

  while (current <= end) {
    dates.push(current.toISOString().slice(0, 10));
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return dates;
}

/**
 * Calculate the current no-spend streak ending at `today`.
 * Walks backward from today, counting consecutive days with no outflow.
 *
 * @param outflowDates - Array of YYYY-MM-DD dates that had outflow transactions
 * @param today - Current date as YYYY-MM-DD
 * @param lookbackDays - How far back to check (default 90)
 */
export function getNoSpendStreak(
  outflowDates: string[],
  today: string,
  lookbackDays = 90,
): number {
  const spendDays = buildSpendDaySet(outflowDates);
  let streak = 0;
  const current = new Date(today + 'T00:00:00Z');

  for (let i = 0; i < lookbackDays; i++) {
    const dateStr = current.toISOString().slice(0, 10);
    if (spendDays.has(dateStr)) break;
    streak++;
    current.setUTCDate(current.getUTCDate() - 1);
  }

  return streak;
}

/**
 * Count no-spend days in a specific month.
 *
 * @param outflowDates - Array of YYYY-MM-DD dates that had outflow transactions
 * @param year - Year
 * @param month - Month (1-12)
 * @param today - Current date as YYYY-MM-DD (to cap at today if month is current)
 */
export function getNoSpendDaysInMonth(
  outflowDates: string[],
  year: number,
  month: number,
  today: string,
): number {
  const spendDays = buildSpendDaySet(outflowDates);
  const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
  const daysInMonth = new Date(year, month, 0).getDate();
  const monthEnd = `${year}-${String(month).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;

  // Cap at today if the month hasn't ended yet
  const endDate = monthEnd <= today ? monthEnd : today;
  if (monthStart > endDate) return 0;

  const allDates = generateDateRange(monthStart, endDate);
  return allDates.filter((d) => !spendDays.has(d)).length;
}

/**
 * Calculate comprehensive no-spend streak statistics.
 *
 * @param outflowDates - Array of YYYY-MM-DD dates that had outflow transactions in the month
 * @param today - Current date as YYYY-MM-DD
 */
export function calculateNoSpendStats(
  outflowDates: string[],
  today: string,
): NoSpendStreakResult {
  const [yearStr, monthStr] = today.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);

  const currentStreak = getNoSpendStreak(outflowDates, today);
  const noSpendDaysThisMonth = getNoSpendDaysInMonth(outflowDates, year, month, today);

  const dayOfMonth = parseInt(today.split('-')[2], 10);
  const daysElapsed = dayOfMonth;
  const noSpendPercent = daysElapsed > 0
    ? Math.round((noSpendDaysThisMonth / daysElapsed) * 100)
    : 0;

  // Calculate longest streak in the month
  const monthStart = `${yearStr}-${monthStr}-01`;
  const allDates = generateDateRange(monthStart, today);
  const spendDays = buildSpendDaySet(outflowDates);

  let longestStreak = 0;
  let runningStreak = 0;
  for (const date of allDates) {
    if (!spendDays.has(date)) {
      runningStreak++;
      if (runningStreak > longestStreak) longestStreak = runningStreak;
    } else {
      runningStreak = 0;
    }
  }

  return {
    currentStreak,
    longestStreak,
    noSpendDaysThisMonth,
    daysElapsed,
    noSpendPercent,
  };
}
