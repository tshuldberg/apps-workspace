import type { ChannelBreakdown, ComparisonPeriod, DayPartHeatmap } from './types';

/**
 * Revenue per available seat hour.
 * RevPASH = Revenue / (Total Seats * Service Hours)
 */
export function calculateRevPASH(
  revenueCents: number,
  totalSeats: number,
  serviceHours: number
): number {
  if (totalSeats <= 0 || serviceHours <= 0) return 0;
  return revenueCents / 100 / (totalSeats * serviceHours);
}

/**
 * No-show rate as a percentage (0-100).
 */
export function calculateNoShowRate(noShows: number, total: number): number {
  if (total <= 0) return 0;
  return (noShows / total) * 100;
}

/**
 * Average turn time in minutes from seated to completed.
 */
export function calculateAvgTurnTime(
  reservations: { seatedAt: string; completedAt: string }[]
): number {
  if (reservations.length === 0) return 0;
  const totalMinutes = reservations.reduce((sum, r) => {
    const seated = new Date(r.seatedAt).getTime();
    const completed = new Date(r.completedAt).getTime();
    return sum + (completed - seated) / 60000;
  }, 0);
  return totalMinutes / reservations.length;
}

/**
 * Compare current vs previous period, returning change percent and trend.
 */
export function calculateComparison(
  current: number,
  previous: number
): ComparisonPeriod {
  if (previous === 0) {
    return {
      current,
      previous,
      changePercent: current === 0 ? 0 : 100,
      trend: current > previous ? 'up' : current < previous ? 'down' : 'flat',
    };
  }
  const changePercent = ((current - previous) / previous) * 100;
  const trend: ComparisonPeriod['trend'] =
    changePercent > 1 ? 'up' : changePercent < -1 ? 'down' : 'flat';
  return { current, previous, changePercent, trend };
}

/**
 * Aggregate reservations by source channel with no-show rates.
 */
export function aggregateByChannel(
  reservations: { source: string; status: string }[]
): ChannelBreakdown[] {
  const channels = new Map<string, { count: number; noShows: number }>();

  for (const r of reservations) {
    const entry = channels.get(r.source) ?? { count: 0, noShows: 0 };
    entry.count++;
    if (r.status === 'no_show') entry.noShows++;
    channels.set(r.source, entry);
  }

  return Array.from(channels.entries()).map(([channel, data]) => ({
    channel,
    count: data.count,
    noShowRate: calculateNoShowRate(data.noShows, data.count),
  }));
}

/**
 * Generate a day-part heatmap: covers by hour (0-23) and day of week (0=Sun, 6=Sat).
 */
export function generateDayPartHeatmap(
  reservations: { scheduledAt: string }[]
): DayPartHeatmap[] {
  const grid = new Map<string, number>();

  for (const r of reservations) {
    const date = new Date(r.scheduledAt);
    const hour = date.getHours();
    const dayOfWeek = date.getDay();
    const key = `${hour}-${dayOfWeek}`;
    grid.set(key, (grid.get(key) ?? 0) + 1);
  }

  return Array.from(grid.entries()).map(([key, covers]) => {
    const [hour, dayOfWeek] = key.split('-').map(Number);
    return { hour, dayOfWeek, covers };
  });
}
