import type {
  InsulinEntry,
  InsulinType,
  InjectionSite,
  InjectionSiteName,
  DailyInsulinTotals,
} from '../models/insulin';
import { IOB_DURATION_HOURS } from '../models/insulin';

/**
 * Calculate Insulin on Board (IOB) using linear decay.
 * Each dose contributes: max(0, units * (1 - elapsedHours / durationHours))
 * Returns total IOB across all active doses.
 */
export function calculateIOB(
  entries: InsulinEntry[],
  now: Date = new Date(),
  durationOverrides?: Partial<Record<InsulinType, number>>,
): number {
  let totalIOB = 0;
  const nowMs = now.getTime();

  for (const entry of entries) {
    const administeredMs = new Date(entry.administeredAt).getTime();
    const elapsedMs = nowMs - administeredMs;

    // Future dose: full IOB
    if (elapsedMs < 0) {
      totalIOB += entry.units;
      continue;
    }

    const elapsedHours = elapsedMs / (1000 * 60 * 60);
    const duration = durationOverrides?.[entry.insulinType]
      ?? IOB_DURATION_HOURS[entry.insulinType];

    // Past duration: 0 IOB
    if (elapsedHours >= duration) continue;

    // Linear decay
    const remaining = entry.units * (1 - elapsedHours / duration);
    totalIOB += Math.max(0, remaining);
  }

  return Math.round(totalIOB * 10) / 10;
}

/**
 * Get the suggested injection site (least recently used).
 * Returns null if no site history exists.
 */
export function getSuggestedSite(
  sites: InjectionSite[],
): InjectionSiteName | null {
  if (sites.length === 0) return null;

  let oldest: InjectionSite = sites[0];
  for (const site of sites) {
    if (site.lastUsedAt < oldest.lastUsedAt) {
      oldest = site;
    }
  }

  return oldest.siteName;
}

/**
 * Get site recency status for display coloring.
 * - 'recent' = used today or yesterday (red)
 * - 'moderate' = used 2-3 days ago (yellow)
 * - 'available' = not used recently or never used (green)
 */
export function getSiteRecency(
  lastUsedAt: string | null,
  now: Date = new Date(),
): 'recent' | 'moderate' | 'available' {
  if (!lastUsedAt) return 'available';

  const usedMs = new Date(lastUsedAt).getTime();
  const nowMs = now.getTime();
  const daysDiff = (nowMs - usedMs) / (1000 * 60 * 60 * 24);

  if (daysDiff < 2) return 'recent';
  if (daysDiff < 4) return 'moderate';
  return 'available';
}

/**
 * Calculate daily insulin totals with basal/bolus/correction breakdown.
 */
export function getDailyInsulinTotals(entries: InsulinEntry[]): DailyInsulinTotals[] {
  const byDate = new Map<string, DailyInsulinTotals>();

  for (const entry of entries) {
    const date = entry.administeredAt.slice(0, 10); // YYYY-MM-DD
    let day = byDate.get(date);
    if (!day) {
      day = { date, basal: 0, bolus: 0, correction: 0, mixed: 0, total: 0 };
      byDate.set(date, day);
    }

    day[entry.doseCategory] += entry.units;
    day.total += entry.units;
  }

  // Round all values
  for (const day of byDate.values()) {
    day.basal = Math.round(day.basal * 10) / 10;
    day.bolus = Math.round(day.bolus * 10) / 10;
    day.correction = Math.round(day.correction * 10) / 10;
    day.mixed = Math.round(day.mixed * 10) / 10;
    day.total = Math.round(day.total * 10) / 10;
  }

  return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Calculate overall daily average insulin usage.
 */
export function calculateDailyAverage(totals: DailyInsulinTotals[]): number {
  if (totals.length === 0) return 0;
  const sum = totals.reduce((acc, d) => acc + d.total, 0);
  return Math.round((sum / totals.length) * 10) / 10;
}
