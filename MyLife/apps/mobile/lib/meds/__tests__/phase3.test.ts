import { describe, expect, it } from 'vitest';
import type { BPReading, Medication } from '@mylife/meds';
import {
  buildBPInsights,
  buildBPTrendSeries,
  filterBPReadingsForFilter,
  filterBPReadingsForPeriod,
  getBPSummaryStats,
  getMedicationImpact,
  getTimeOfDayBuckets,
  groupBPReadingsByDay,
} from '../phase3';

const readings: BPReading[] = [
  {
    id: 'bp-1',
    systolic: 126,
    diastolic: 82,
    pulse: 74,
    arm: 'left',
    position: 'sitting',
    context: 'morning',
    category: 'hypertension_1',
    notes: null,
    measuredAt: '2026-04-07T08:10:00.000Z',
    createdAt: '2026-04-07T08:10:00.000Z',
  },
  {
    id: 'bp-2',
    systolic: 118,
    diastolic: 76,
    pulse: 68,
    arm: 'left',
    position: 'sitting',
    context: 'routine',
    category: 'normal',
    notes: null,
    measuredAt: '2026-04-06T08:15:00.000Z',
    createdAt: '2026-04-06T08:15:00.000Z',
  },
  {
    id: 'bp-3',
    systolic: 134,
    diastolic: 86,
    pulse: 80,
    arm: 'right',
    position: 'standing',
    context: 'evening',
    category: 'hypertension_1',
    notes: null,
    measuredAt: '2026-04-04T18:30:00.000Z',
    createdAt: '2026-04-04T18:30:00.000Z',
  },
  {
    id: 'bp-4',
    systolic: 182,
    diastolic: 112,
    pulse: 88,
    arm: 'right',
    position: 'standing',
    context: 'evening',
    category: 'crisis',
    notes: null,
    measuredAt: '2026-03-20T20:45:00.000Z',
    createdAt: '2026-03-20T20:45:00.000Z',
  },
];

const medications: Medication[] = [
  {
    id: 'med-1',
    name: 'Lisinopril',
    dosage: '10mg',
    unit: 'mg',
    frequency: 'daily',
    instructions: null,
    prescriber: null,
    pharmacy: null,
    refillDate: null,
    pillCount: 30,
    pillsPerDose: 1,
    timeSlots: ['08:00'],
    endDate: null,
    isActive: true,
    sortOrder: 0,
    notes: null,
    createdAt: '2026-04-01T08:00:00.000Z',
    updatedAt: '2026-04-01T08:00:00.000Z',
  },
];

describe('meds phase3 helpers', () => {
  it('filters readings by period using the provided reference date', () => {
    const filtered = filterBPReadingsForPeriod(
      readings,
      '7d',
      new Date('2026-04-07T12:00:00.000Z'),
    );

    expect(filtered.map((reading) => reading.id)).toEqual(['bp-1', 'bp-2', 'bp-3']);
  });

  it('filters stage1plus to stage1, stage2, and crisis categories', () => {
    const filtered = filterBPReadingsForFilter(readings, 'stage1plus');

    expect(filtered.map((reading) => reading.id)).toEqual(['bp-1', 'bp-3', 'bp-4']);
  });

  it('computes BP summary cards from the selected readings', () => {
    const stats = getBPSummaryStats(readings.slice(0, 3));

    expect(stats.average).toEqual({ systolic: 126, diastolic: 81, pulse: 74 });
    expect(stats.lowest?.id).toBe('bp-2');
    expect(stats.highest?.id).toBe('bp-3');
    expect(stats.count).toBe(3);
  });

  it('groups readings by day in reverse chronological order', () => {
    const groups = groupBPReadingsByDay(readings);

    expect(groups).toHaveLength(4);
    expect(groups[0]?.key).toBe('2026-04-07');
    expect(groups[1]?.key).toBe('2026-04-06');
  });

  it('builds trend points and time-of-day buckets for charts', () => {
    const trend = buildBPTrendSeries(readings.slice(0, 3), '30d');
    const buckets = getTimeOfDayBuckets(readings.slice(0, 3));

    expect(trend).toHaveLength(3);
    expect(trend[0]?.label).toBe('Sat');
    // `getTimeOfDayBuckets` buckets by local hour (`getHours`), which shifts
    // with the runner's timezone. Vitest's `env.TZ` only mutates
    // `process.env.TZ` at runtime, not Node's initialized timezone, so the
    // bucket key a reading lands in is machine-dependent. Assert on the math
    // (averaged systolic values) across non-empty buckets instead of naming
    // a specific bucket key, which keeps the test passing regardless of TZ.
    const populated = buckets.filter((bucket) => bucket.count > 0);
    expect(populated).toHaveLength(2);
    const avgSystolics = populated.map((bucket) => bucket.avgSystolic).sort((a, b) => a - b);
    expect(avgSystolics).toEqual([122, 134]); // bp-1+bp-2 avg=122, bp-3=134
  });

  it('detects medication impact when there is enough before and after data', () => {
    const impactReadings: BPReading[] = [
      {
        ...readings[0],
        id: 'before-1',
        systolic: 146,
        diastolic: 92,
        measuredAt: '2026-03-28T08:00:00.000Z',
        createdAt: '2026-03-28T08:00:00.000Z',
        category: 'hypertension_2',
      },
      {
        ...readings[0],
        id: 'before-2',
        systolic: 142,
        diastolic: 88,
        measuredAt: '2026-03-30T08:00:00.000Z',
        createdAt: '2026-03-30T08:00:00.000Z',
        category: 'hypertension_1',
      },
      {
        ...readings[0],
        id: 'after-1',
        systolic: 126,
        diastolic: 80,
        measuredAt: '2026-04-03T08:00:00.000Z',
        createdAt: '2026-04-03T08:00:00.000Z',
        category: 'hypertension_1',
      },
      {
        ...readings[0],
        id: 'after-2',
        systolic: 122,
        diastolic: 78,
        measuredAt: '2026-04-05T08:00:00.000Z',
        createdAt: '2026-04-05T08:00:00.000Z',
        category: 'elevated',
      },
    ];

    const impacts = getMedicationImpact(impactReadings, medications);

    expect(impacts).toHaveLength(1);
    expect(impacts[0]?.systolicDelta).toBe(-20);
    expect(impacts[0]?.effectiveness).toBe('strong');
  });

  it('turns trend, rhythm, and medication data into BP insights', () => {
    const trend = buildBPTrendSeries(readings.slice(0, 3), '30d');
    const buckets = getTimeOfDayBuckets(readings.slice(0, 3));
    const insights = buildBPInsights(readings.slice(0, 3), trend, buckets, []);

    expect(insights.length).toBeGreaterThan(0);
    expect(insights.some((insight) => insight.includes('averages'))).toBe(true);
  });
});
