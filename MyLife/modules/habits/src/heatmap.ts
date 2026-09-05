import type { DatabaseAdapter } from '@mylife/db';
import type { HeatmapDay } from './types';

/**
 * Get heatmap data for a habit over a full year.
 * Returns 365 (or 366) days with completion counts.
 */
export function getHeatmapData(
  db: DatabaseAdapter,
  habitId: string,
  year?: number,
): HeatmapDay[] {
  const targetYear = year ?? new Date().getFullYear();
  const startDate = `${targetYear}-01-01`;
  const endDate = `${targetYear}-12-31`;
  return getHeatmapRange(db, habitId, startDate, endDate);
}

/**
 * Get heatmap data for a habit over an arbitrary date range.
 * Returns one entry per day with the completion count for that day.
 */
export function getHeatmapRange(
  db: DatabaseAdapter,
  habitId: string,
  from: string,
  to: string,
): HeatmapDay[] {
  // Query completion counts grouped by date
  const rows = db.query<{ d: string; cnt: number }>(
    `SELECT DATE(completed_at) as d, COUNT(*) as cnt
     FROM hb_completions
     WHERE habit_id = ? AND DATE(completed_at) >= ? AND DATE(completed_at) <= ?
     GROUP BY DATE(completed_at)
     ORDER BY d ASC`,
    [habitId, from, to],
  );

  // Build a map for fast lookup
  const countMap = new Map<string, number>();
  for (const row of rows) {
    countMap.set(row.d, row.cnt);
  }

  // Fill in every day in the range
  const result: HeatmapDay[] = [];
  const current = new Date(from + 'T00:00:00Z');
  const end = new Date(to + 'T00:00:00Z');

  while (current <= end) {
    const dateStr = current.toISOString().slice(0, 10);
    result.push({
      date: dateStr,
      count: countMap.get(dateStr) ?? 0,
    });
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return result;
}
