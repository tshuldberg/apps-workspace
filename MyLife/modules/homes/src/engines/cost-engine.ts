import type { CostEntry, CostCategory } from '../types';

export interface CostSummary {
  totalCents: number;
  byCategory: Record<CostCategory, number>;
  entryCount: number;
}

export interface MonthlyCostTrend {
  month: string;
  totalCents: number;
}

/**
 * Compute a cost summary across all entries: total, breakdown by category, and count.
 */
export function getCostSummary(entries: CostEntry[]): CostSummary {
  const byCategory: Record<CostCategory, number> = {
    maintenance: 0,
    repair: 0,
    improvement: 0,
    utility: 0,
    other: 0,
  };

  let totalCents = 0;

  for (const entry of entries) {
    totalCents += entry.amountCents;
    byCategory[entry.category] += entry.amountCents;
  }

  return { totalCents, byCategory, entryCount: entries.length };
}

/**
 * Group entries by year-month (YYYY-MM) and return totals sorted chronologically.
 */
export function getMonthlyCostTrend(entries: CostEntry[]): MonthlyCostTrend[] {
  const monthMap = new Map<string, number>();

  for (const entry of entries) {
    // costDate is a date string; extract YYYY-MM
    const month = entry.costDate.slice(0, 7);
    monthMap.set(month, (monthMap.get(month) ?? 0) + entry.amountCents);
  }

  return Array.from(monthMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, totalCents]) => ({ month, totalCents }));
}

/**
 * Sum all entry amounts (lifetime total in cents).
 */
export function getLifetimeCosts(entries: CostEntry[]): number {
  let total = 0;
  for (const entry of entries) {
    total += entry.amountCents;
  }
  return total;
}

/**
 * Group entries by scheduleId and return the total cost per schedule.
 * Entries with no scheduleId are excluded.
 */
export function getCostsBySchedule(entries: CostEntry[]): Map<string, number> {
  const result = new Map<string, number>();

  for (const entry of entries) {
    if (entry.scheduleId) {
      result.set(
        entry.scheduleId,
        (result.get(entry.scheduleId) ?? 0) + entry.amountCents,
      );
    }
  }

  return result;
}
