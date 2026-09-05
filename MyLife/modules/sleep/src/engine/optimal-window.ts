import {
  formatClockMinutes,
  getCalendarDateRangeBounds,
  getClockMinutes,
  normalizeBedtimeMinutes,
  roundNumber,
  type SleepAnalyticsDateRange,
  type SleepAnalyticsEntry,
} from './analytics';

export type ChronotypeEstimate = 'early_bird' | 'night_owl' | 'intermediate';
export type OptimalWindowConfidence = 'low' | 'medium' | 'high';

export interface OptimalBedtimeWindow {
  recommendedTime: string | null;
  windowStart: string | null;
  windowEnd: string | null;
  averageQualityRating: number | null;
  sampleSize: number;
  confidence: OptimalWindowConfidence;
}

export interface OptimalDurationWindow {
  recommendedDurationMinutes: number | null;
  recommendedDurationHours: number | null;
  windowStartMinutes: number | null;
  windowEndMinutes: number | null;
  averageQualityRating: number | null;
  sampleSize: number;
  confidence: OptimalWindowConfidence;
}

interface QualityBucket {
  bucketStart: number;
  qualityRatings: number[];
}

interface QualityBucketResult {
  buckets: Map<number, QualityBucket>;
  ratedCount: number;
}

const DEFAULT_BUCKET_MINUTES = 30;

function getEntriesForDateRange(
  entries: readonly SleepAnalyticsEntry[],
  dateRange: SleepAnalyticsDateRange,
): readonly SleepAnalyticsEntry[] {
  if (!dateRange.startDate && !dateRange.endDate) {
    return entries;
  }

  const bounds = getCalendarDateRangeBounds(entries, dateRange);
  if (!bounds) {
    return [];
  }

  return entries.filter(
    (entry) => entry.date >= bounds.startDate && entry.date <= bounds.endDate,
  );
}

function getBucketStart(value: number, bucketMinutes: number): number {
  return Math.floor(value / bucketMinutes) * bucketMinutes;
}

function getBucketAverage(bucket: QualityBucket): number {
  return roundNumber(
    bucket.qualityRatings.reduce((sum, value) => sum + value, 0) /
      bucket.qualityRatings.length,
    2,
  );
}

function getConfidence(sampleSize: number): OptimalWindowConfidence {
  if (sampleSize >= 21) {
    return 'high';
  }
  if (sampleSize >= 14) {
    return 'medium';
  }
  return 'low';
}

function getBestBucket(buckets: Map<number, QualityBucket>): QualityBucket | null {
  const sorted = [...buckets.values()].sort((a, b) => {
    const qualityDelta = getBucketAverage(b) - getBucketAverage(a);
    if (qualityDelta !== 0) {
      return qualityDelta;
    }
    if (a.qualityRatings.length !== b.qualityRatings.length) {
      return b.qualityRatings.length - a.qualityRatings.length;
    }
    return a.bucketStart - b.bucketStart;
  });

  return sorted[0] ?? null;
}

function getMedian(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function buildQualityBuckets(
  entries: readonly SleepAnalyticsEntry[],
  getValue: (entry: SleepAnalyticsEntry) => number | null,
  bucketMinutes = DEFAULT_BUCKET_MINUTES,
): QualityBucketResult {
  const buckets = new Map<number, QualityBucket>();
  let ratedCount = 0;

  for (const entry of entries) {
    const qualityRating = entry.quality_rating;
    if (typeof qualityRating !== 'number') {
      continue;
    }

    const value = getValue(entry);
    if (value === null) {
      continue;
    }

    ratedCount += 1;
    const bucketStart = getBucketStart(value, bucketMinutes);
    const bucket = buckets.get(bucketStart) ?? {
      bucketStart,
      qualityRatings: [],
    };
    bucket.qualityRatings.push(qualityRating);
    buckets.set(bucketStart, bucket);
  }

  return {
    buckets,
    ratedCount,
  };
}

export function findOptimalBedtime(
  entries: readonly SleepAnalyticsEntry[],
  dateRange: SleepAnalyticsDateRange = {},
  bucketMinutes = DEFAULT_BUCKET_MINUTES,
): OptimalBedtimeWindow {
  const filtered = getEntriesForDateRange(entries, dateRange);
  const bucketResult = buildQualityBuckets(filtered, (entry) => {
    const minutes = getClockMinutes(entry.bedtime);
    return minutes === null ? null : normalizeBedtimeMinutes(minutes);
  }, bucketMinutes);
  const bestBucket = getBestBucket(bucketResult.buckets);

  if (!bestBucket) {
    return {
      recommendedTime: null,
      windowStart: null,
      windowEnd: null,
      averageQualityRating: null,
      sampleSize: 0,
      confidence: 'low',
    };
  }

  return {
    recommendedTime: formatClockMinutes(bestBucket.bucketStart),
    windowStart: formatClockMinutes(bestBucket.bucketStart),
    windowEnd: formatClockMinutes(bestBucket.bucketStart + bucketMinutes),
    averageQualityRating: getBucketAverage(bestBucket),
    sampleSize: bestBucket.qualityRatings.length,
    confidence: getConfidence(bucketResult.ratedCount),
  };
}

export function findOptimalDuration(
  entries: readonly SleepAnalyticsEntry[],
  dateRange: SleepAnalyticsDateRange = {},
  bucketMinutes = DEFAULT_BUCKET_MINUTES,
): OptimalDurationWindow {
  const filtered = getEntriesForDateRange(entries, dateRange);
  const bucketResult = buildQualityBuckets(
    filtered,
    (entry) => entry.duration_minutes,
    bucketMinutes,
  );
  const bestBucket = getBestBucket(bucketResult.buckets);

  if (!bestBucket) {
    return {
      recommendedDurationMinutes: null,
      recommendedDurationHours: null,
      windowStartMinutes: null,
      windowEndMinutes: null,
      averageQualityRating: null,
      sampleSize: 0,
      confidence: 'low',
    };
  }

  return {
    recommendedDurationMinutes: bestBucket.bucketStart,
    recommendedDurationHours: roundNumber(bestBucket.bucketStart / 60, 2),
    windowStartMinutes: bestBucket.bucketStart,
    windowEndMinutes: bestBucket.bucketStart + bucketMinutes,
    averageQualityRating: getBucketAverage(bestBucket),
    sampleSize: bestBucket.qualityRatings.length,
    confidence: getConfidence(bucketResult.ratedCount),
  };
}

export function getChronotypeEstimate(
  entries: readonly SleepAnalyticsEntry[],
  dateRange: SleepAnalyticsDateRange = {},
): ChronotypeEstimate {
  const filtered = getEntriesForDateRange(entries, dateRange);
  const bedtimes = filtered
    .map((entry) => getClockMinutes(entry.bedtime))
    .filter((value): value is number => value !== null)
    .map(normalizeBedtimeMinutes);
  const wakeTimes = filtered
    .map((entry) => getClockMinutes(entry.wake_time))
    .filter((value): value is number => value !== null);
  const medianBedtime = getMedian(bedtimes);
  const medianWake = getMedian(wakeTimes);

  if (medianBedtime === null || medianWake === null) {
    return 'intermediate';
  }

  if (medianBedtime <= (22 * 60) + 30 && medianWake <= (6 * 60) + 30) {
    return 'early_bird';
  }
  if (medianBedtime >= (24 * 60) + 30 || medianWake >= (8 * 60) + 30) {
    return 'night_owl';
  }
  return 'intermediate';
}
