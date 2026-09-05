import { describe, expect, it } from 'vitest';

import {
  labelForMetric,
  METRIC_LABELS,
  shapeMetricsWindow,
  utcDayStrings,
  type DailyMetricRow,
} from '../metrics';

describe('utcDayStrings', () => {
  it('returns windowDays UTC day strings, oldest first', () => {
    const days = utcDayStrings(3, new Date('2026-07-11T15:00:00Z'));
    expect(days).toEqual(['2026-07-09', '2026-07-10', '2026-07-11']);
  });

  it('crosses month boundaries in UTC', () => {
    const days = utcDayStrings(2, new Date('2026-08-01T00:30:00Z'));
    expect(days).toEqual(['2026-07-31', '2026-08-01']);
  });
});

describe('shapeMetricsWindow', () => {
  const days = ['2026-07-09', '2026-07-10', '2026-07-11'];

  it('folds rows into per-metric totals and daily buckets', () => {
    const rows: DailyMetricRow[] = [
      { day: '2026-07-09', metric: 'votes', count: 4 },
      { day: '2026-07-10', metric: 'votes', count: 6 },
      { day: '2026-07-10', metric: 'submissions', count: 2 },
    ];
    const { series } = shapeMetricsWindow(days, rows);
    const votes = series.find((s) => s.metric === 'votes');
    expect(votes?.total).toBe(10);
    expect(votes?.byDay).toEqual({ '2026-07-09': 4, '2026-07-10': 6 });
    const submissions = series.find((s) => s.metric === 'submissions');
    expect(submissions?.total).toBe(2);
  });

  it('normalizes timestamptz-style day values to YYYY-MM-DD', () => {
    const rows: DailyMetricRow[] = [
      { day: '2026-07-11T00:00:00+00:00', metric: 'reports', count: 1 },
    ];
    const { series } = shapeMetricsWindow(days, rows);
    expect(series[0]?.byDay).toEqual({ '2026-07-11': 1 });
  });

  it('orders known metrics by declaration order and unknown keys alphabetically after', () => {
    const rows: DailyMetricRow[] = [
      { day: '2026-07-09', metric: 'zebra_unknown', count: 1 },
      { day: '2026-07-09', metric: 'votes', count: 1 },
      { day: '2026-07-09', metric: 'accounts_created', count: 1 },
      { day: '2026-07-09', metric: 'apple_unknown', count: 1 },
    ];
    const { series } = shapeMetricsWindow(days, rows);
    expect(series.map((s) => s.metric)).toEqual([
      'accounts_created',
      'votes',
      'apple_unknown',
      'zebra_unknown',
    ]);
  });

  it('returns an empty series for no rows', () => {
    expect(shapeMetricsWindow(days, []).series).toEqual([]);
  });
});

describe('labelForMetric', () => {
  it('labels every known metric', () => {
    for (const key of Object.keys(METRIC_LABELS)) {
      expect(labelForMetric(key).label).toBe(METRIC_LABELS[key].label);
    }
  });

  it('falls back to the raw key for unknown metrics', () => {
    expect(labelForMetric('surprise_metric')).toEqual({
      label: 'surprise_metric',
      note: 'unlabelled metric',
    });
  });
});
