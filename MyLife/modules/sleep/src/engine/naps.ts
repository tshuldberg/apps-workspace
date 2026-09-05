import type {
  Nap as NapRecord,
  SleepEntry as SleepEntryRecord,
} from '../models/schemas';

export type NapImpactStatus = 'reportable' | 'insufficient_data';
export type NapImpactDirection = 'positive' | 'negative' | 'neutral';

export interface NapDurationTrendPoint {
  date: string;
  count: number;
  totalMinutes: number;
  averageDuration: number;
}

export interface NapImpactInsight {
  status: NapImpactStatus;
  direction: NapImpactDirection;
  napNightSampleSize: number;
  noNapNightSampleSize: number;
  averageQualityAfterNap: number | null;
  averageQualityWithoutNap: number | null;
  qualityDelta: number | null;
  insight: string;
}

export interface NapSummary {
  totalNaps: number;
  totalMinutes: number;
  averageDuration: number | null;
  averageQuality: number | null;
  intentionalCount: number;
  accidentalCount: number;
  durationTrend: NapDurationTrendPoint[];
  impactInsight: NapImpactInsight;
}

const MIN_IMPACT_GROUP_SIZE = 3;
const REPORTABLE_QUALITY_DELTA = 0.25;

function round(value: number, places = 1): number {
  return Number(value.toFixed(places));
}

function average(values: readonly number[]): number | null {
  if (values.length === 0) {
    return null;
  }

  return round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function addDays(date: string, days: number): string {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

function buildInsufficientNapImpact(
  napNightQualities: readonly number[],
  noNapNightQualities: readonly number[],
): NapImpactInsight {
  return {
    status: 'insufficient_data',
    direction: 'neutral',
    napNightSampleSize: napNightQualities.length,
    noNapNightSampleSize: noNapNightQualities.length,
    averageQualityAfterNap: average(napNightQualities),
    averageQualityWithoutNap: average(noNapNightQualities),
    qualityDelta: null,
    insight: 'Log at least three nap nights and three non-nap nights to compare next-night sleep quality.',
  };
}

export function getNapDurationTrend(
  naps: readonly NapRecord[],
): NapDurationTrendPoint[] {
  const buckets = new Map<string, { count: number; totalMinutes: number }>();

  for (const nap of naps) {
    const bucket = buckets.get(nap.date) ?? { count: 0, totalMinutes: 0 };
    bucket.count += 1;
    bucket.totalMinutes += nap.duration_minutes;
    buckets.set(nap.date, bucket);
  }

  return [...buckets.entries()]
    .sort(([leftDate], [rightDate]) => leftDate.localeCompare(rightDate))
    .map(([date, bucket]) => ({
      date,
      count: bucket.count,
      totalMinutes: bucket.totalMinutes,
      averageDuration: round(bucket.totalMinutes / bucket.count),
    }));
}

export function getNapImpactInsight(
  naps: readonly NapRecord[],
  entries: readonly SleepEntryRecord[],
): NapImpactInsight {
  const napDates = new Set(naps.map((nap) => nap.date));
  const napNightQualities: number[] = [];
  const noNapNightQualities: number[] = [];

  for (const entry of entries) {
    const previousDate = addDays(entry.date, -1);
    if (napDates.has(previousDate)) {
      napNightQualities.push(entry.quality_rating);
    } else {
      noNapNightQualities.push(entry.quality_rating);
    }
  }

  if (
    napNightQualities.length < MIN_IMPACT_GROUP_SIZE ||
    noNapNightQualities.length < MIN_IMPACT_GROUP_SIZE
  ) {
    return buildInsufficientNapImpact(
      napNightQualities,
      noNapNightQualities,
    );
  }

  const averageQualityAfterNap = average(napNightQualities);
  const averageQualityWithoutNap = average(noNapNightQualities);

  if (
    averageQualityAfterNap === null ||
    averageQualityWithoutNap === null
  ) {
    return buildInsufficientNapImpact(
      napNightQualities,
      noNapNightQualities,
    );
  }

  const qualityDelta = round(
    averageQualityAfterNap - averageQualityWithoutNap,
  );
  const direction =
    Math.abs(qualityDelta) < REPORTABLE_QUALITY_DELTA
      ? 'neutral'
      : qualityDelta > 0
        ? 'positive'
        : 'negative';

  return {
    status: 'reportable',
    direction,
    napNightSampleSize: napNightQualities.length,
    noNapNightSampleSize: noNapNightQualities.length,
    averageQualityAfterNap,
    averageQualityWithoutNap,
    qualityDelta,
    insight:
      direction === 'neutral'
        ? 'Nap nights and non-nap nights are tracking about the same for sleep quality.'
        : direction === 'positive'
          ? `Nap nights average ${qualityDelta.toFixed(1)} quality points higher the next morning.`
          : `Nap nights average ${Math.abs(qualityDelta).toFixed(1)} quality points lower the next morning.`,
  };
}

export function getNapSummary(
  naps: readonly NapRecord[],
  entries: readonly SleepEntryRecord[],
): NapSummary {
  const totalMinutes = naps.reduce(
    (sum, nap) => sum + nap.duration_minutes,
    0,
  );
  const qualityValues = naps
    .map((nap) => nap.quality)
    .filter((value): value is number => typeof value === 'number');

  return {
    totalNaps: naps.length,
    totalMinutes,
    averageDuration:
      naps.length > 0 ? round(totalMinutes / naps.length) : null,
    averageQuality: average(qualityValues),
    intentionalCount: naps.filter((nap) => nap.intentional).length,
    accidentalCount: naps.filter((nap) => !nap.intentional).length,
    durationTrend: getNapDurationTrend(naps),
    impactInsight: getNapImpactInsight(naps, entries),
  };
}
