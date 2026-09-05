import type {
  DailyUsage,
  AppUsage,
  DailySummary,
  WeeklySummary,
  CategoryBreakdown,
  AppCategory,
} from '../types';

const ALL_CATEGORIES: AppCategory[] = [
  'social',
  'entertainment',
  'productivity',
  'communication',
  'gaming',
  'news',
  'shopping',
  'health',
  'education',
  'other',
];

/**
 * Build a daily summary from usage records.
 */
export function buildDailySummary(
  daily: DailyUsage,
  appUsage: AppUsage[],
  topN = 5,
): DailySummary {
  const sorted = [...appUsage].sort((a, b) => b.minutes - a.minutes);
  return {
    date: daily.date,
    totalMinutes: daily.total_minutes,
    goalMinutes: daily.goal_minutes,
    goalMet: daily.goal_met === 1,
    pickups: daily.pickups,
    topApps: sorted.slice(0, topN).map((a) => ({
      appName: a.app_name,
      minutes: a.minutes,
      category: a.category as AppCategory,
    })),
  };
}

/**
 * Build a weekly summary from an array of daily usage records.
 * Records should be for a 7-day period.
 */
export function buildWeeklySummary(records: DailyUsage[], weekStart: string): WeeklySummary {
  if (records.length === 0) {
    return {
      weekStart,
      averageMinutes: 0,
      totalMinutes: 0,
      daysMetGoal: 0,
      bestDay: null,
      worstDay: null,
    };
  }

  const totalMinutes = records.reduce((sum, r) => sum + r.total_minutes, 0);
  const daysMetGoal = records.filter((r) => r.goal_met === 1).length;

  let bestDay: string | null = null;
  let worstDay: string | null = null;
  let minMinutes = Infinity;
  let maxMinutes = -Infinity;

  for (const r of records) {
    if (r.total_minutes < minMinutes) {
      minMinutes = r.total_minutes;
      bestDay = r.date; // least screen time = best
    }
    if (r.total_minutes > maxMinutes) {
      maxMinutes = r.total_minutes;
      worstDay = r.date; // most screen time = worst
    }
  }

  return {
    weekStart,
    averageMinutes: Math.round(totalMinutes / records.length),
    totalMinutes,
    daysMetGoal,
    bestDay,
    worstDay,
  };
}

/**
 * Compute category breakdown from app usage records.
 */
export function buildCategoryBreakdown(appUsage: AppUsage[]): CategoryBreakdown[] {
  const totals = new Map<AppCategory, number>();
  let grandTotal = 0;

  for (const record of appUsage) {
    const cat = (record.category as AppCategory) || 'other';
    totals.set(cat, (totals.get(cat) ?? 0) + record.minutes);
    grandTotal += record.minutes;
  }

  return ALL_CATEGORIES
    .filter((cat) => (totals.get(cat) ?? 0) > 0)
    .map((cat) => {
      const minutes = totals.get(cat) ?? 0;
      return {
        category: cat,
        minutes,
        percentage: grandTotal > 0 ? Math.round((minutes / grandTotal) * 100) : 0,
      };
    })
    .sort((a, b) => b.minutes - a.minutes);
}

/**
 * Format minutes as "Xh Ym" display string.
 */
export function formatScreenTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/**
 * Calculate improvement percentage between two periods.
 * Negative = improvement (less screen time). Positive = regression.
 */
export function calculateImprovement(currentMinutes: number, previousMinutes: number): number {
  if (previousMinutes === 0) return 0;
  return Math.round(((currentMinutes - previousMinutes) / previousMinutes) * 100);
}
