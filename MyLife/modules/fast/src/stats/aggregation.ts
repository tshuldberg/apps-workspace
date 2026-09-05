import type { DatabaseAdapter } from '@mylife/db';

/** Average fasting duration in seconds across all completed fasts */
export function averageDuration(db: DatabaseAdapter): number {
  const rows = db.query<{ avg_duration: number | null }>(
    `SELECT AVG(duration_seconds) as avg_duration FROM ft_fasts WHERE ended_at IS NOT NULL AND duration_seconds IS NOT NULL`,
  );
  return rows[0]?.avg_duration ?? 0;
}

/** Adherence rate: % of completed fasts that hit their target (0-100) */
export function adherenceRate(db: DatabaseAdapter): number {
  const rows = db.query<{ total: number; hits: number }>(
    `SELECT
       COUNT(*) as total,
       SUM(CASE WHEN hit_target = 1 THEN 1 ELSE 0 END) as hits
     FROM ft_fasts
     WHERE ended_at IS NOT NULL`,
  );
  const row = rows[0];
  if (!row || row.total === 0) return 0;
  return Math.round((row.hits / row.total) * 100 * 10) / 10;
}

/** A single day's fasting summary */
export interface DaySummary {
  date: string; // YYYY-MM-DD
  totalSeconds: number;
  totalHours: number;
  fastCount: number;
  hitTarget: boolean;
}

/**
 * Weekly rollup: fasting hours per day for the past 7 days.
 * Returns exactly 7 entries (including days with no fasts).
 */
export function weeklyRollup(db: DatabaseAdapter, today?: Date): DaySummary[] {
  const ref = today ?? new Date();

  // Build date range
  const startDate = new Date(ref);
  startDate.setDate(startDate.getDate() - 6);
  const startStr = startDate.toISOString().slice(0, 10);
  const endStr = ref.toISOString().slice(0, 10);

  // Single query for the entire 7-day range
  const rows = db.query<{ fast_date: string; total_seconds: number; fast_count: number; hits: number }>(
    `SELECT
       date(started_at) as fast_date,
       COALESCE(SUM(duration_seconds), 0) as total_seconds,
       COUNT(*) as fast_count,
       SUM(CASE WHEN hit_target = 1 THEN 1 ELSE 0 END) as hits
     FROM ft_fasts
     WHERE ended_at IS NOT NULL
       AND started_at >= ? AND started_at < date(?, '+1 day')
     GROUP BY date(started_at)`,
    [startStr, endStr],
  );

  const dayMap = new Map<string, { total_seconds: number; fast_count: number; hits: number }>();
  for (const row of rows) {
    dayMap.set(row.fast_date, { total_seconds: row.total_seconds, fast_count: row.fast_count, hits: row.hits });
  }

  const results: DaySummary[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(ref);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const data = dayMap.get(dateStr);

    results.push({
      date: dateStr,
      totalSeconds: data?.total_seconds ?? 0,
      totalHours: Math.round(((data?.total_seconds ?? 0) / 3600) * 10) / 10,
      fastCount: data?.fast_count ?? 0,
      hitTarget: (data?.hits ?? 0) > 0,
    });
  }

  return results;
}

/** A single day's status for the monthly heatmap */
export interface MonthDay {
  date: string; // YYYY-MM-DD
  status: 'none' | 'fasted' | 'hit_target';
}

/**
 * Monthly rollup for heatmap display.
 * Returns one entry per day of the given month.
 */
export function monthlyRollup(db: DatabaseAdapter, year: number, month: number): MonthDay[] {
  const daysInMonth = new Date(year, month, 0).getDate();
  const monthStr = `${year}-${String(month).padStart(2, '0')}`;
  const results: MonthDay[] = [];

  const rangeStart = `${monthStr}-01`;
  const nextMonth = month === 12
    ? `${year + 1}-01-01`
    : `${year}-${String(month + 1).padStart(2, '0')}-01`;

  const rows = db.query<{ fast_date: string; hits: number; total: number }>(
    `SELECT
       date(started_at) as fast_date,
       SUM(CASE WHEN hit_target = 1 THEN 1 ELSE 0 END) as hits,
       COUNT(*) as total
     FROM ft_fasts
     WHERE ended_at IS NOT NULL
       AND started_at >= ? AND started_at < ?
     GROUP BY date(started_at)`,
    [rangeStart, nextMonth],
  );

  const dayMap = new Map<string, { hits: number; total: number }>();
  for (const row of rows) {
    dayMap.set(row.fast_date, { hits: row.hits, total: row.total });
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${monthStr}-${String(d).padStart(2, '0')}`;
    const data = dayMap.get(dateStr);

    let status: MonthDay['status'] = 'none';
    if (data && data.total > 0) {
      status = data.hits > 0 ? 'hit_target' : 'fasted';
    }

    results.push({ date: dateStr, status });
  }

  return results;
}

/** A single day's duration data point for trend charts */
export interface DurationPoint {
  date: string; // YYYY-MM-DD
  durationSeconds: number;
  durationHours: number;
  movingAverage: number | null;
}

/**
 * Duration trend: daily total fasting durations for the past N days
 * with a 7-day moving average.
 */
export function durationTrend(db: DatabaseAdapter, days: number = 30, today?: Date): DurationPoint[] {
  const ref = today ?? new Date();

  const startDate = new Date(ref);
  startDate.setDate(startDate.getDate() - (days - 1));
  const startStr = startDate.toISOString().slice(0, 10);
  const endStr = ref.toISOString().slice(0, 10);

  // Single query for the entire range
  const rows = db.query<{ fast_date: string; total_seconds: number }>(
    `SELECT
       date(started_at) as fast_date,
       COALESCE(SUM(duration_seconds), 0) as total_seconds
     FROM ft_fasts
     WHERE ended_at IS NOT NULL
       AND started_at >= ? AND started_at < date(?, '+1 day')
     GROUP BY date(started_at)`,
    [startStr, endStr],
  );

  const dayMap = new Map<string, number>();
  for (const row of rows) {
    dayMap.set(row.fast_date, row.total_seconds);
  }

  const results: DurationPoint[] = [];
  const hourValues: number[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(ref);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);

    const totalSeconds = dayMap.get(dateStr) ?? 0;
    const totalHours = Math.round((totalSeconds / 3600) * 10) / 10;
    hourValues.push(totalHours);

    let movingAverage: number | null = null;
    if (hourValues.length >= 7) {
      const window = hourValues.slice(-7);
      const sum = window.reduce((a, b) => a + b, 0);
      movingAverage = Math.round((sum / 7) * 10) / 10;
    }

    results.push({
      date: dateStr,
      durationSeconds: totalSeconds,
      durationHours: totalHours,
      movingAverage,
    });
  }

  return results;
}
