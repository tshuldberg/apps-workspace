/**
 * Report helper functions for the budget reports/charts dashboard.
 *
 * Pure utility functions for chart data preparation: color palettes,
 * date range presets, category bucketing, savings rate, and formatting.
 *
 * All amounts in integer cents unless noted.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DateRangePreset {
  start: string; // YYYY-MM-DD
  end: string;   // YYYY-MM-DD
}

export interface BucketizedCategory {
  categoryId: string;
  categoryName: string;
  amount: number;
  percentage: number;
  transactionCount: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Fixed chart color palette (8 colors). Assigned by index, never randomized. */
export const CHART_COLORS = [
  '#22C55E', // green (budget accent)
  '#3B82F6', // blue
  '#F97316', // orange
  '#8B5CF6', // purple
  '#EF4444', // red
  '#06B6D4', // cyan
  '#F59E0B', // amber
  '#64748B', // slate
] as const;

const DATE_RANGE_NAMES = [
  'thisMonth',
  'lastMonth',
  'last3Months',
  'last6Months',
  'thisYear',
  'lastYear',
  'allTime',
] as const;

export type DateRangeName = (typeof DATE_RANGE_NAMES)[number];

// ---------------------------------------------------------------------------
// Date range presets
// ---------------------------------------------------------------------------

/**
 * Get start/end dates for a named date range preset.
 * @param preset The preset name
 * @param today Reference date (YYYY-MM-DD), defaults to current date
 * @param earliestDate Earliest transaction date for "allTime" preset
 */
export function getDateRangePreset(
  preset: DateRangeName,
  today?: string,
  earliestDate?: string,
): DateRangePreset {
  const ref = today ? new Date(today + 'T00:00:00Z') : new Date();
  const y = ref.getUTCFullYear();
  const m = ref.getUTCMonth();
  const d = ref.getUTCDate();

  const fmt = (date: Date): string => {
    const yy = date.getUTCFullYear();
    const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(date.getUTCDate()).padStart(2, '0');
    return `${yy}-${mm}-${dd}`;
  };

  const lastDayOfMonth = (year: number, month: number): Date =>
    new Date(Date.UTC(year, month + 1, 0));

  switch (preset) {
    case 'thisMonth':
      return {
        start: fmt(new Date(Date.UTC(y, m, 1))),
        end: fmt(new Date(Date.UTC(y, m, d))),
      };
    case 'lastMonth':
      return {
        start: fmt(new Date(Date.UTC(y, m - 1, 1))),
        end: fmt(lastDayOfMonth(y, m - 1)),
      };
    case 'last3Months': {
      const startDate = new Date(Date.UTC(y, m - 2, 1));
      return { start: fmt(startDate), end: fmt(new Date(Date.UTC(y, m, d))) };
    }
    case 'last6Months': {
      const startDate = new Date(Date.UTC(y, m - 5, 1));
      return { start: fmt(startDate), end: fmt(new Date(Date.UTC(y, m, d))) };
    }
    case 'thisYear':
      return {
        start: fmt(new Date(Date.UTC(y, 0, 1))),
        end: fmt(new Date(Date.UTC(y, m, d))),
      };
    case 'lastYear':
      return {
        start: fmt(new Date(Date.UTC(y - 1, 0, 1))),
        end: fmt(new Date(Date.UTC(y - 1, 11, 31))),
      };
    case 'allTime':
      return {
        start: earliestDate ?? fmt(new Date(Date.UTC(y - 10, 0, 1))),
        end: fmt(new Date(Date.UTC(y, m, d))),
      };
  }
}

// ---------------------------------------------------------------------------
// Category bucketing
// ---------------------------------------------------------------------------

/**
 * Group categories beyond the top N into an "Other" bucket.
 * @param categories Spending by category, sorted descending by amount
 * @param maxCategories Maximum distinct categories to show (default 7)
 */
export function bucketizeCategories(
  categories: BucketizedCategory[],
  maxCategories = 7,
): BucketizedCategory[] {
  if (categories.length <= maxCategories) return categories;

  const top = categories.slice(0, maxCategories);
  const rest = categories.slice(maxCategories);

  const otherAmount = rest.reduce((sum, c) => sum + c.amount, 0);
  const otherCount = rest.reduce((sum, c) => sum + c.transactionCount, 0);
  const totalAmount = categories.reduce((sum, c) => sum + c.amount, 0);

  top.push({
    categoryId: '__other__',
    categoryName: 'Other',
    amount: otherAmount,
    percentage: totalAmount > 0 ? Math.round((otherAmount / totalAmount) * 100) : 0,
    transactionCount: otherCount,
  });

  return top;
}

// ---------------------------------------------------------------------------
// Chart colors
// ---------------------------------------------------------------------------

/**
 * Assign chart colors to categories by their index position.
 */
export function assignChartColors(
  categories: { categoryId: string }[],
): Map<string, string> {
  const map = new Map<string, string>();
  for (let i = 0; i < categories.length; i++) {
    map.set(categories[i].categoryId, CHART_COLORS[i % CHART_COLORS.length]);
  }
  return map;
}

// ---------------------------------------------------------------------------
// Savings rate
// ---------------------------------------------------------------------------

/**
 * Calculate savings rate as a percentage.
 * savings rate = (income - expenses) / income * 100
 * Returns 0 if income is 0 (avoids division by zero).
 *
 * @param income Total income in cents (positive)
 * @param expenses Total expenses in cents (positive)
 */
export function calculateSavingsRate(income: number, expenses: number): number {
  if (income <= 0) return 0;
  return Math.round(((income - expenses) / income) * 10000) / 100;
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

/**
 * Format integer cents as a dollar string with commas.
 * Examples: 150000 -> "$1,500.00", -50000 -> "-$500.00", 0 -> "$0.00"
 */
export function formatCentsAsDollars(cents: number): string {
  const negative = cents < 0;
  const absCents = Math.abs(cents);
  const dollars = Math.floor(absCents / 100);
  const remainder = absCents % 100;
  const formatted = dollars.toLocaleString('en-US') + '.' + String(remainder).padStart(2, '0');
  return negative ? `-$${formatted}` : `$${formatted}`;
}
