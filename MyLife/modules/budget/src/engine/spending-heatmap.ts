/**
 * Spending heatmap -- daily spending totals for calendar visualization.
 *
 * Returns an array of daily entries for a given month, suitable for
 * rendering a calendar heatmap where darker cells = more spending.
 *
 * All amounts in integer cents.
 */

export interface HeatmapDay {
  /** Date as YYYY-MM-DD. */
  date: string;
  /** Total outflow for the day. Cents. */
  totalCents: number;
  /** Number of transactions on this day. */
  transactionCount: number;
  /** Intensity from 0 (no spending) to 1 (max spending in the month). */
  intensity: number;
}

export interface HeatmapMonth {
  year: number;
  month: number;
  days: HeatmapDay[];
  /** Maximum daily spend in the month. Cents. Used for intensity scaling. */
  maxDailyCents: number;
  /** Total spend for the entire month. Cents. */
  monthTotalCents: number;
  /** Average daily spend. Cents. */
  averageDailyCents: number;
}

export interface DailySpendingEntry {
  date: string;
  totalCents: number;
  transactionCount: number;
}

/**
 * Build a spending heatmap for a calendar month.
 *
 * @param dailySpending - Array of {date, totalCents, transactionCount} from DB query
 * @param year - Year
 * @param month - Month (1-12)
 * @param today - Current date YYYY-MM-DD (to cap future days)
 */
export function getSpendingHeatmap(
  dailySpending: DailySpendingEntry[],
  year: number,
  month: number,
  today: string,
): HeatmapMonth {
  const daysInMonth = new Date(year, month, 0).getDate();
  const spendMap = new Map<string, DailySpendingEntry>();

  for (const entry of dailySpending) {
    spendMap.set(entry.date, entry);
  }

  // Build full month array, filling in zero-spend days
  const days: HeatmapDay[] = [];
  let maxDailyCents = 0;
  let monthTotalCents = 0;
  let activeDayCount = 0;

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

    // Skip future days
    if (dateStr > today) break;

    activeDayCount++;
    const entry = spendMap.get(dateStr);
    const totalCents = entry?.totalCents ?? 0;
    const transactionCount = entry?.transactionCount ?? 0;

    if (totalCents > maxDailyCents) maxDailyCents = totalCents;
    monthTotalCents += totalCents;

    days.push({
      date: dateStr,
      totalCents,
      transactionCount,
      intensity: 0, // calculated below
    });
  }

  // Calculate intensity (0-1 scale relative to max)
  if (maxDailyCents > 0) {
    for (const day of days) {
      day.intensity = Math.round((day.totalCents / maxDailyCents) * 100) / 100;
    }
  }

  const averageDailyCents = activeDayCount > 0
    ? Math.round(monthTotalCents / activeDayCount)
    : 0;

  return {
    year,
    month,
    days,
    maxDailyCents,
    monthTotalCents,
    averageDailyCents,
  };
}
