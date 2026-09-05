export interface GroomingOverviewItem {
  groomingType: string;
  lastGroomedAt: string | null;
  nextDueDate: string | null;
  intervalDays: number | null;
  isOverdue: boolean;
  daysUntilDue: number | null;
}

/**
 * Calculate the next grooming date based on an interval.
 */
export function calculateNextGroomingDate(groomedAt: string, intervalDays: number): string {
  const d = new Date(groomedAt + (groomedAt.length === 10 ? 'T00:00:00Z' : ''));
  d.setUTCDate(d.getUTCDate() + intervalDays);
  return d.toISOString().slice(0, 10);
}

/**
 * Build a grooming overview for a pet.
 * Shows all grooming types with their last-done and next-due dates.
 */
export function getGroomingOverview(
  records: Array<{ groomingType: string; groomedAt: string; nextDueDate: string | null }>,
  intervals: Array<{ groomingType: string; intervalDays: number }>,
  referenceDate: string,
): GroomingOverviewItem[] {
  const allTypes = new Set([
    ...records.map((r) => r.groomingType),
    ...intervals.map((i) => i.groomingType),
  ]);

  const latestByType = new Map<string, { groomedAt: string; nextDueDate: string | null }>();
  for (const r of records) {
    const existing = latestByType.get(r.groomingType);
    if (!existing || r.groomedAt > existing.groomedAt) {
      latestByType.set(r.groomingType, { groomedAt: r.groomedAt, nextDueDate: r.nextDueDate });
    }
  }

  const intervalMap = new Map(intervals.map((i) => [i.groomingType, i.intervalDays]));

  return Array.from(allTypes).map((type) => {
    const latest = latestByType.get(type);
    const interval = intervalMap.get(type) ?? null;
    const nextDue = latest?.nextDueDate ?? null;

    let isOverdue = false;
    let daysUntilDue: number | null = null;

    if (nextDue) {
      const nextDate = new Date(nextDue + 'T00:00:00Z').getTime();
      const refDate = new Date(referenceDate + 'T00:00:00Z').getTime();
      const diffDays = Math.floor((nextDate - refDate) / (24 * 60 * 60 * 1000));
      daysUntilDue = diffDays;
      isOverdue = diffDays < 0;
    }

    return {
      groomingType: type,
      lastGroomedAt: latest?.groomedAt?.slice(0, 10) ?? null,
      nextDueDate: nextDue,
      intervalDays: interval,
      isOverdue,
      daysUntilDue,
    };
  }).sort((a, b) => {
    if (a.isOverdue && !b.isOverdue) return -1;
    if (!a.isOverdue && b.isOverdue) return 1;
    if (a.daysUntilDue !== null && b.daysUntilDue !== null) return a.daysUntilDue - b.daysUntilDue;
    return 0;
  });
}

/**
 * Get all overdue grooming tasks across all pets.
 */
export function getOverdueGroomingTasks(
  items: GroomingOverviewItem[],
): GroomingOverviewItem[] {
  return items.filter((i) => i.isOverdue);
}
