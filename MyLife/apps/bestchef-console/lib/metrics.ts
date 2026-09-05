/**
 * Pure shaping helpers for the aggregate launch metrics page (plan 45 item 2.5).
 * Everything here takes plain rows and returns plain viewmodels so it is
 * unit-testable; lib/queries.ts does the service-role I/O and calls these.
 *
 * These operate only on aggregate (day, metric, count) integers. There are no
 * device IDs, per-user rows, or client-SDK events anywhere in this data.
 */

export interface MetricSeries {
  metric: string;
  total: number;
  /** day (YYYY-MM-DD) -> count, only for days with a nonzero count. */
  byDay: Record<string, number>;
}

export interface MetricsWindow {
  /** UTC days covered, oldest first, one per column. */
  days: string[];
  series: MetricSeries[];
}

export interface DailyMetricRow {
  day: string;
  metric: string;
  count: number;
}

/**
 * Human-facing labels + one-line meaning for each known metric key. Unknown
 * keys (added by a future migration) still render with their raw key.
 */
export const METRIC_LABELS: Record<string, { label: string; note: string }> = {
  accounts_created: { label: 'Accounts created', note: 'first BestChef terms acceptance' },
  submissions: { label: 'Submissions', note: 'new pending recipe submissions' },
  votes: { label: 'Votes', note: 'accepted votes (engagement proxy)' },
  reports: { label: 'Reports', note: 'content reports filed' },
  appeals: { label: 'Appeals', note: 'moderation appeals filed' },
  push_registrations: { label: 'Push registrations', note: 'push token registers/refreshes' },
  account_deletions: { label: 'Account deletions', note: 'new deletion requests' },
};

/** The `windowDays` most recent UTC day strings, oldest first. */
export function utcDayStrings(windowDays: number, now: Date = new Date()): string[] {
  const out: string[] = [];
  const base = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  for (let i = windowDays - 1; i >= 0; i -= 1) {
    out.push(new Date(base - i * 86_400_000).toISOString().slice(0, 10));
  }
  return out;
}

/**
 * Fold aggregate (day, metric, count) rows into per-metric series over the given
 * window of days. Known metrics sort in declaration order; unknown keys sort
 * alphabetically after them.
 */
export function shapeMetricsWindow(days: string[], rows: DailyMetricRow[]): MetricsWindow {
  const byMetric = new Map<string, MetricSeries>();
  for (const row of rows) {
    const day = String(row.day).slice(0, 10);
    let series = byMetric.get(row.metric);
    if (!series) {
      series = { metric: row.metric, total: 0, byDay: {} };
      byMetric.set(row.metric, series);
    }
    const n = Number(row.count) || 0;
    series.byDay[day] = (series.byDay[day] ?? 0) + n;
    series.total += n;
  }

  const known = Object.keys(METRIC_LABELS);
  const series = Array.from(byMetric.values()).sort((a, b) => {
    const ia = known.indexOf(a.metric);
    const ib = known.indexOf(b.metric);
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;
    return a.metric.localeCompare(b.metric);
  });

  return { days, series };
}

export function labelForMetric(metric: string): { label: string; note: string } {
  return METRIC_LABELS[metric] ?? { label: metric, note: 'unlabelled metric' };
}
