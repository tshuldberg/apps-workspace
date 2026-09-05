import type { BPCategory, BPReading, Medication } from '@mylife/meds';

export type BPPeriodKey = '7d' | '30d' | '90d' | '1y';
export type BPFilterKey = 'all' | 'normal' | 'elevated' | 'stage1plus';
export type BPMetricKey = 'systolic' | 'diastolic' | 'pulse';

export interface BPOption<T extends string> {
  key: T;
  label: string;
}

export interface BPSummaryStats {
  average: { systolic: number; diastolic: number; pulse: number | null };
  lowest: BPReading | null;
  highest: BPReading | null;
  count: number;
}

export interface BPDistributionSlice {
  category: BPCategory;
  label: string;
  color: string;
  count: number;
  percentage: number;
}

export interface BPReadingGroup {
  key: string;
  title: string;
  readings: BPReading[];
}

export interface BPTrendPoint {
  key: string;
  label: string;
  isoDate: string;
  systolic: number;
  diastolic: number;
  pulse: number | null;
  count: number;
}

export interface BPTimeBucket {
  key: string;
  label: string;
  avgSystolic: number;
  avgDiastolic: number;
  avgPulse: number | null;
  count: number;
}

export interface MedicationImpact {
  medicationId: string;
  medicationName: string;
  startedAt: string;
  beforeAverage: { systolic: number; diastolic: number; count: number } | null;
  afterAverage: { systolic: number; diastolic: number; count: number } | null;
  systolicDelta: number | null;
  diastolicDelta: number | null;
  effectiveness: 'strong' | 'positive' | 'neutral' | 'watch';
}

const DAY_MS = 24 * 60 * 60 * 1000;

export const BP_PERIOD_OPTIONS: BPOption<BPPeriodKey>[] = [
  { key: '7d', label: '7d' },
  { key: '30d', label: '30d' },
  { key: '90d', label: '90d' },
  { key: '1y', label: '1y' },
];

export const BP_FILTER_OPTIONS: BPOption<BPFilterKey>[] = [
  { key: 'all', label: 'All' },
  { key: 'normal', label: 'Normal' },
  { key: 'elevated', label: 'Elevated' },
  { key: 'stage1plus', label: 'Stage 1+' },
];

export const BP_CATEGORY_ORDER: BPCategory[] = [
  'normal',
  'elevated',
  'hypertension_1',
  'hypertension_2',
  'crisis',
];

export const BP_CATEGORY_LABELS: Record<BPCategory, string> = {
  normal: 'Normal',
  elevated: 'Elevated',
  hypertension_1: 'Stage 1',
  hypertension_2: 'Stage 2',
  crisis: 'Crisis',
};

export const BP_CATEGORY_COLORS: Record<BPCategory, string> = {
  normal: '#30D158',
  elevated: '#FFD60A',
  hypertension_1: '#FFB877',
  hypertension_2: '#FFB4AB',
  crisis: '#FF453A',
};

export const BP_METRIC_META: Record<
  BPMetricKey,
  {
    title: string;
    unit: string;
    stroke: string;
    averageStroke: string;
    min: number;
    max: number;
    bands: Array<{ from: number; to: number; color: string }>;
  }
> = {
  systolic: {
    title: 'Systolic',
    unit: 'mmHg',
    stroke: '#22D3EE',
    averageStroke: 'rgba(228, 225, 233, 0.32)',
    min: 80,
    max: 200,
    bands: [
      { from: 80, to: 120, color: 'rgba(48, 209, 88, 0.14)' },
      { from: 120, to: 130, color: 'rgba(255, 214, 10, 0.14)' },
      { from: 130, to: 200, color: 'rgba(255, 69, 58, 0.12)' },
    ],
  },
  diastolic: {
    title: 'Diastolic',
    unit: 'mmHg',
    stroke: '#8BCFF0',
    averageStroke: 'rgba(228, 225, 233, 0.32)',
    min: 50,
    max: 130,
    bands: [
      { from: 50, to: 80, color: 'rgba(48, 209, 88, 0.14)' },
      { from: 80, to: 90, color: 'rgba(255, 214, 10, 0.14)' },
      { from: 90, to: 130, color: 'rgba(255, 69, 58, 0.12)' },
    ],
  },
  pulse: {
    title: 'Pulse',
    unit: 'bpm',
    stroke: '#FFB877',
    averageStroke: 'rgba(228, 225, 233, 0.32)',
    min: 40,
    max: 140,
    bands: [
      { from: 40, to: 60, color: 'rgba(139, 207, 240, 0.1)' },
      { from: 60, to: 100, color: 'rgba(48, 209, 88, 0.12)' },
      { from: 100, to: 140, color: 'rgba(255, 180, 171, 0.12)' },
    ],
  },
};

const TIME_BUCKETS = [
  { key: 'overnight', label: '12a', startHour: 0, endHour: 4 },
  { key: 'morning', label: '4a', startHour: 4, endHour: 8 },
  { key: 'midmorning', label: '8a', startHour: 8, endHour: 12 },
  { key: 'afternoon', label: '12p', startHour: 12, endHour: 16 },
  { key: 'evening', label: '4p', startHour: 16, endHour: 20 },
  { key: 'night', label: '8p', startHour: 20, endHour: 24 },
] as const;

function getDaysForPeriod(period: BPPeriodKey): number {
  switch (period) {
    case '7d':
      return 7;
    case '30d':
      return 30;
    case '90d':
      return 90;
    case '1y':
      return 365;
  }
}

export function formatBPDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function getPeriodStart(period: BPPeriodKey, now: Date = new Date()): string {
  return new Date(now.getTime() - getDaysForPeriod(period) * DAY_MS).toISOString();
}

export function filterBPReadingsForPeriod(
  readings: BPReading[],
  period: BPPeriodKey,
  now: Date = new Date(),
): BPReading[] {
  const from = getPeriodStart(period, now);
  return readings.filter((reading) => reading.measuredAt >= from);
}

export function filterBPReadingsForFilter(
  readings: BPReading[],
  filter: BPFilterKey,
): BPReading[] {
  switch (filter) {
    case 'all':
      return readings;
    case 'normal':
      return readings.filter((reading) => reading.category === 'normal');
    case 'elevated':
      return readings.filter((reading) => reading.category === 'elevated');
    case 'stage1plus':
      return readings.filter((reading) =>
        reading.category === 'hypertension_1' ||
        reading.category === 'hypertension_2' ||
        reading.category === 'crisis');
  }
}

function compareSeverity(left: BPCategory, right: BPCategory): number {
  return BP_CATEGORY_ORDER.indexOf(left) - BP_CATEGORY_ORDER.indexOf(right);
}

export function getBPSummaryStats(readings: BPReading[]): BPSummaryStats {
  if (readings.length === 0) {
    return {
      average: { systolic: 0, diastolic: 0, pulse: null },
      lowest: null,
      highest: null,
      count: 0,
    };
  }

  let systolic = 0;
  let diastolic = 0;
  let pulse = 0;
  let pulseCount = 0;
  let lowest = readings[0];
  let highest = readings[0];

  for (const reading of readings) {
    systolic += reading.systolic;
    diastolic += reading.diastolic;
    if (reading.pulse != null) {
      pulse += reading.pulse;
      pulseCount += 1;
    }

    const readingScore = reading.systolic + reading.diastolic;
    const lowestScore = lowest.systolic + lowest.diastolic;
    const highestScore = highest.systolic + highest.diastolic;

    if (readingScore < lowestScore) {
      lowest = reading;
    }

    if (
      readingScore > highestScore ||
      (readingScore === highestScore &&
        compareSeverity(reading.category, highest.category) > 0)
    ) {
      highest = reading;
    }
  }

  return {
    average: {
      systolic: Math.round(systolic / readings.length),
      diastolic: Math.round(diastolic / readings.length),
      pulse: pulseCount > 0 ? Math.round(pulse / pulseCount) : null,
    },
    lowest,
    highest,
    count: readings.length,
  };
}

export function getBPDistribution(readings: BPReading[]): BPDistributionSlice[] {
  const counts = BP_CATEGORY_ORDER.reduce<Record<BPCategory, number>>(
    (accumulator, category) => ({ ...accumulator, [category]: 0 }),
    {
      normal: 0,
      elevated: 0,
      hypertension_1: 0,
      hypertension_2: 0,
      crisis: 0,
    },
  );

  readings.forEach((reading) => {
    counts[reading.category] += 1;
  });

  const total = readings.length;

  return BP_CATEGORY_ORDER.map((category) => ({
    category,
    label: BP_CATEGORY_LABELS[category],
    color: BP_CATEGORY_COLORS[category],
    count: counts[category],
    percentage: total > 0 ? Math.round((counts[category] / total) * 100) : 0,
  }));
}

export function groupBPReadingsByDay(readings: BPReading[]): BPReadingGroup[] {
  const groups = new Map<string, BPReading[]>();

  readings.forEach((reading) => {
    const key = reading.measuredAt.slice(0, 10);
    const items = groups.get(key) ?? [];
    items.push(reading);
    groups.set(key, items);
  });

  return [...groups.entries()]
    .sort(([left], [right]) => right.localeCompare(left))
    .map(([key, items]) => ({
      key,
      title: new Date(`${key}T12:00:00`).toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      }),
      readings: items.sort((left, right) => right.measuredAt.localeCompare(left.measuredAt)),
    }));
}

function getGroupedKey(date: Date, period: BPPeriodKey): string {
  if (period === '1y') {
    const weekStart = new Date(date);
    weekStart.setHours(0, 0, 0, 0);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    return weekStart.toISOString().slice(0, 10);
  }

  return date.toISOString().slice(0, 10);
}

function getGroupedLabel(dateKey: string, period: BPPeriodKey): string {
  const date = new Date(`${dateKey}T12:00:00`);

  if (period === '1y') {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  if (period === '90d') {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  return date.toLocaleDateString('en-US', { weekday: 'short' });
}

export function buildBPTrendSeries(
  readings: BPReading[],
  period: BPPeriodKey,
): BPTrendPoint[] {
  const groups = new Map<string, BPReading[]>();

  [...readings]
    .sort((left, right) => left.measuredAt.localeCompare(right.measuredAt))
    .forEach((reading) => {
      const date = new Date(reading.measuredAt);
      const key = getGroupedKey(date, period);
      const items = groups.get(key) ?? [];
      items.push(reading);
      groups.set(key, items);
    });

  return [...groups.entries()].map(([key, items]) => {
    const pulseValues = items
      .map((item) => item.pulse)
      .filter((value): value is number => value != null);

    const sum = items.reduce(
      (accumulator, item) => ({
        systolic: accumulator.systolic + item.systolic,
        diastolic: accumulator.diastolic + item.diastolic,
      }),
      { systolic: 0, diastolic: 0 },
    );

    return {
      key,
      isoDate: key,
      label: getGroupedLabel(key, period),
      systolic: Math.round(sum.systolic / items.length),
      diastolic: Math.round(sum.diastolic / items.length),
      pulse: pulseValues.length
        ? Math.round(pulseValues.reduce((accumulator, value) => accumulator + value, 0) / pulseValues.length)
        : null,
      count: items.length,
    };
  });
}

export function getTimeOfDayBuckets(readings: BPReading[]): BPTimeBucket[] {
  return TIME_BUCKETS.map((bucket) => {
    const items = readings.filter((reading) => {
      const hour = new Date(reading.measuredAt).getHours();
      return hour >= bucket.startHour && hour < bucket.endHour;
    });

    if (items.length === 0) {
      return {
        key: bucket.key,
        label: bucket.label,
        avgSystolic: 0,
        avgDiastolic: 0,
        avgPulse: null,
        count: 0,
      };
    }

    const stats = getBPSummaryStats(items);
    return {
      key: bucket.key,
      label: bucket.label,
      avgSystolic: stats.average.systolic,
      avgDiastolic: stats.average.diastolic,
      avgPulse: stats.average.pulse,
      count: items.length,
    };
  });
}

function averageReadings(readings: BPReading[]) {
  const stats = getBPSummaryStats(readings);
  return {
    systolic: stats.average.systolic,
    diastolic: stats.average.diastolic,
    count: stats.count,
  };
}

export function getMedicationImpact(
  readings: BPReading[],
  medications: Medication[],
): MedicationImpact[] {
  const impacts: MedicationImpact[] = [];

  medications.forEach((medication) => {
    const startedAt = medication.createdAt;
    const startTime = new Date(startedAt).getTime();
    const beforeStart = new Date(startTime - 7 * DAY_MS).toISOString();
    const afterEnd = new Date(startTime + 7 * DAY_MS).toISOString();

    const before = readings.filter((reading) =>
      reading.measuredAt >= beforeStart && reading.measuredAt < startedAt);
    const after = readings.filter((reading) =>
      reading.measuredAt >= startedAt && reading.measuredAt <= afterEnd);

    if (before.length < 2 || after.length < 2) {
      return;
    }

    const beforeAverage = averageReadings(before);
    const afterAverage = averageReadings(after);
    const systolicDelta = afterAverage.systolic - beforeAverage.systolic;
    const diastolicDelta = afterAverage.diastolic - beforeAverage.diastolic;

    let effectiveness: MedicationImpact['effectiveness'] = 'neutral';
    if (systolicDelta <= -10 || diastolicDelta <= -6) {
      effectiveness = 'strong';
    } else if (systolicDelta <= -4 || diastolicDelta <= -3) {
      effectiveness = 'positive';
    } else if (systolicDelta >= 6 || diastolicDelta >= 4) {
      effectiveness = 'watch';
    }

    impacts.push({
      medicationId: medication.id,
      medicationName: medication.name,
      startedAt,
      beforeAverage,
      afterAverage,
      systolicDelta,
      diastolicDelta,
      effectiveness,
    });
  });

  return impacts
    .sort(
      (left, right) =>
        Math.abs(left.systolicDelta ?? 0) - Math.abs(right.systolicDelta ?? 0),
    )
    .reverse();
}

export function buildBPInsights(
  readings: BPReading[],
  trendSeries: BPTrendPoint[],
  timeBuckets: BPTimeBucket[],
  impacts: MedicationImpact[],
): string[] {
  const insights: string[] = [];
  const stats = getBPSummaryStats(readings);
  const distribution = getBPDistribution(readings);

  if (stats.average.systolic > 0) {
    if (stats.average.systolic < 120 && stats.average.diastolic < 80) {
      insights.push('Recent BP averages are sitting inside the target zone.');
    } else if (stats.average.systolic >= 140 || stats.average.diastolic >= 90) {
      insights.push('Recent averages remain in Stage 2 range and need follow-up.');
    } else if (stats.average.systolic >= 130 || stats.average.diastolic >= 80) {
      insights.push('Recent averages are trending above the target range.');
    }
  }

  if (trendSeries.length >= 2) {
    const first = trendSeries[0];
    const last = trendSeries[trendSeries.length - 1];
    const systolicDelta = last.systolic - first.systolic;
    if (systolicDelta <= -6) {
      insights.push(`Systolic averages improved by ${Math.abs(systolicDelta)} mmHg across this period.`);
    } else if (systolicDelta >= 6) {
      insights.push(`Systolic averages climbed by ${systolicDelta} mmHg across this period.`);
    }
  }

  const worstBucket = [...timeBuckets]
    .filter((bucket) => bucket.count > 0)
    .sort((left, right) => right.avgSystolic - left.avgSystolic)[0];
  const bestBucket = [...timeBuckets]
    .filter((bucket) => bucket.count > 0)
    .sort((left, right) => left.avgSystolic - right.avgSystolic)[0];

  if (worstBucket && bestBucket && worstBucket.key !== bestBucket.key) {
    const delta = worstBucket.avgSystolic - bestBucket.avgSystolic;
    if (delta >= 8) {
      insights.push(`${worstBucket.label} readings run about ${delta} mmHg higher than ${bestBucket.label}.`);
    }
  }

  if (distribution.find((slice) => slice.category === 'crisis')?.count) {
    insights.push('Crisis-range readings were logged in this window. Review the timeline and caregiver settings.');
  }

  const strongestImpact = impacts.find((impact) => impact.effectiveness === 'strong' || impact.effectiveness === 'positive');
  if (strongestImpact && strongestImpact.systolicDelta != null && strongestImpact.systolicDelta < 0) {
    insights.push(
      `${strongestImpact.medicationName} lines up with a ${Math.abs(strongestImpact.systolicDelta)} mmHg lower systolic average after it was added.`,
    );
  }

  if (insights.length === 0) {
    insights.push('Keep logging readings at consistent times to unlock clearer pattern detection.');
  }

  return insights.slice(0, 4);
}
