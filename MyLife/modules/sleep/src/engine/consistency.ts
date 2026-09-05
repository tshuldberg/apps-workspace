import {
  getCalendarDateRangeBounds,
  getClockMinutes,
  normalizeBedtimeMinutes,
  roundNumber,
  type SleepAnalyticsDateRange,
  type SleepAnalyticsEntry,
} from './analytics';

export interface SleepConsistencySummary {
  score: number;
  bedtimeVarianceMinutes: number | null;
  wakeTimeVarianceMinutes: number | null;
  averageVarianceMinutes: number | null;
  sampleSize: number;
}

interface ConsistencySamples {
  bedtimeMinutes: number[];
  wakeTimeMinutes: number[];
  sampleSize: number;
}

function resolveDateRangeBounds(
  entries: readonly SleepAnalyticsEntry[],
  dateRange: SleepAnalyticsDateRange,
): { startDate: string; endDate: string } | null {
  if (!dateRange.startDate && !dateRange.endDate) {
    return null;
  }

  return getCalendarDateRangeBounds(entries, dateRange);
}

function getStandardDeviation(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  if (values.length === 1) {
    return 0;
  }

  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance =
    values.reduce((sum, value) => sum + ((value - mean) ** 2), 0) /
    values.length;
  return roundNumber(Math.sqrt(variance), 1);
}

function clampScore(value: number): number {
  return Math.min(100, Math.max(0, roundNumber(value, 1)));
}

function collectConsistencySamples(
  entries: readonly SleepAnalyticsEntry[],
  dateRange: SleepAnalyticsDateRange,
): ConsistencySamples {
  const bounds = resolveDateRangeBounds(entries, dateRange);
  const bedtimeMinutes: number[] = [];
  const wakeTimeMinutes: number[] = [];
  let sampleSize = 0;

  for (const entry of entries) {
    if (
      bounds &&
      (entry.date < bounds.startDate || entry.date > bounds.endDate)
    ) {
      continue;
    }

    sampleSize += 1;

    const bedtime = getClockMinutes(entry.bedtime);
    if (bedtime !== null) {
      bedtimeMinutes.push(normalizeBedtimeMinutes(bedtime));
    }
    const wakeTime = getClockMinutes(entry.wake_time);
    if (wakeTime !== null) {
      wakeTimeMinutes.push(wakeTime);
    }
  }

  return {
    bedtimeMinutes,
    wakeTimeMinutes,
    sampleSize,
  };
}

export function getBedtimeVariance(
  entries: readonly SleepAnalyticsEntry[],
  dateRange: SleepAnalyticsDateRange = {},
): number | null {
  return getStandardDeviation(
    collectConsistencySamples(entries, dateRange).bedtimeMinutes,
  );
}

export function getWakeTimeVariance(
  entries: readonly SleepAnalyticsEntry[],
  dateRange: SleepAnalyticsDateRange = {},
): number | null {
  return getStandardDeviation(
    collectConsistencySamples(entries, dateRange).wakeTimeMinutes,
  );
}

export function getSleepConsistencySummary(
  entries: readonly SleepAnalyticsEntry[],
  dateRange: SleepAnalyticsDateRange = {},
): SleepConsistencySummary {
  const samples = collectConsistencySamples(entries, dateRange);
  if (samples.sampleSize === 0) {
    return {
      score: 0,
      bedtimeVarianceMinutes: null,
      wakeTimeVarianceMinutes: null,
      averageVarianceMinutes: null,
      sampleSize: 0,
    };
  }

  const bedtimeVarianceMinutes = getStandardDeviation(samples.bedtimeMinutes);
  const wakeTimeVarianceMinutes = getStandardDeviation(samples.wakeTimeMinutes);
  const variances = [bedtimeVarianceMinutes, wakeTimeVarianceMinutes].filter(
    (value): value is number => value !== null,
  );
  const averageVarianceMinutes =
    variances.length === 0
      ? null
      : roundNumber(
          variances.reduce((sum, value) => sum + value, 0) / variances.length,
          1,
        );

  return {
    score:
      averageVarianceMinutes === null
        ? 0
        : clampScore(100 - (averageVarianceMinutes * 2)),
    bedtimeVarianceMinutes,
    wakeTimeVarianceMinutes,
    averageVarianceMinutes,
    sampleSize: samples.sampleSize,
  };
}

export function calculateConsistencyScore(
  entries: readonly SleepAnalyticsEntry[],
  dateRange: SleepAnalyticsDateRange = {},
): number {
  return getSleepConsistencySummary(entries, dateRange).score;
}
