/**
 * Spending Pulse -- single hero metric for financial health.
 *
 * Returns one number: how far ahead or behind the user is this month
 * relative to their budget. Includes month-over-month trend.
 *
 * All amounts in integer cents.
 */

export interface SpendingPulse {
  /** Positive = ahead of budget, negative = over budget. Cents. */
  remainingCents: number;
  /** Total budget across all active envelopes for the month. Cents. */
  totalBudgetCents: number;
  /** Total outflow this month. Cents. */
  spentCents: number;
  /** Percentage of budget remaining (0-100+, can exceed 100 if underspent). */
  remainingPercent: number;
  /** Days remaining in the month. */
  daysRemaining: number;
  /** Safe daily spend to stay on budget for rest of month. Cents. */
  safeDailySpendCents: number;
  /** Month-over-month change in spending (-1 to +Infinity). null if no prior month data. */
  monthOverMonthChange: number | null;
  /** Human-readable summary line. */
  summary: string;
}

export interface SpendingPulseInput {
  totalBudgetCents: number;
  spentThisMonthCents: number;
  spentLastMonthCents: number | null;
  today: string; // YYYY-MM-DD
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/**
 * Calculate the spending pulse hero metric.
 */
export function calculateSpendingPulse(input: SpendingPulseInput): SpendingPulse {
  const { totalBudgetCents, spentThisMonthCents, spentLastMonthCents, today } = input;

  const [yearStr, monthStr, dayStr] = today.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const day = parseInt(dayStr, 10);
  const totalDays = daysInMonth(year, month);
  const daysRemaining = Math.max(0, totalDays - day);

  const remainingCents = totalBudgetCents - spentThisMonthCents;
  const remainingPercent = totalBudgetCents > 0
    ? Math.round((remainingCents / totalBudgetCents) * 100)
    : 0;

  const safeDailySpendCents = daysRemaining > 0
    ? Math.max(0, Math.round(remainingCents / daysRemaining))
    : 0;

  const monthOverMonthChange = spentLastMonthCents !== null && spentLastMonthCents > 0
    ? (spentThisMonthCents - spentLastMonthCents) / spentLastMonthCents
    : null;

  const dollars = Math.abs(Math.round(remainingCents / 100));
  const summary = remainingCents >= 0
    ? `You're $${dollars} ahead this month`
    : `You're $${dollars} over budget this month`;

  return {
    remainingCents,
    totalBudgetCents,
    spentCents: spentThisMonthCents,
    remainingPercent,
    daysRemaining,
    safeDailySpendCents,
    monthOverMonthChange,
    summary,
  };
}
