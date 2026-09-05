import type { Factor } from '../models/factor-schemas';
import {
  getCalendarDateRangeBounds,
  getClockMinutes,
  normalizeBedtimeMinutes,
  roundNumber,
  type SleepAnalyticsDateRange,
  type SleepAnalyticsEntry,
} from './analytics';

export type SleepCorrelationFactor =
  | 'exercise'
  | 'caffeine'
  | 'alcohol'
  | 'stress'
  | 'screen_time';

export type SleepCorrelationStatus =
  | 'reportable'
  | 'insufficient_data'
  | 'not_significant';

export type SleepCorrelationConfidence = 'low' | 'medium' | 'high';
export type SleepCorrelationDirection = 'positive' | 'negative' | 'neutral';

export interface SleepCorrelationGroupSummary {
  key: string;
  label: string;
  averageQualityRating: number | null;
  sampleSize: number;
}

export interface SleepCorrelationResult {
  factor: SleepCorrelationFactor;
  label: string;
  status: SleepCorrelationStatus;
  direction: SleepCorrelationDirection;
  confidence: SleepCorrelationConfidence | null;
  sampleSize: number;
  groups: SleepCorrelationGroupSummary[];
  preferredGroupKey: string;
  comparisonGroupKey: string;
  favorableGroupKey: string | null;
  baselineGroupKey: string | null;
  difference: number | null;
  impactPercent: number | null;
  thresholdLabel: string | null;
  reason: string | null;
  insight: string | null;
}

interface RatedFactorEntry {
  entry: SleepAnalyticsEntry;
  factor: Factor;
  qualityRating: number;
}

interface CorrelationGroupConfig {
  key: string;
  label: string;
}

interface BuildCorrelationOptions {
  factor: SleepCorrelationFactor;
  label: string;
  preferredGroup: CorrelationGroupConfig;
  comparisonGroup: CorrelationGroupConfig;
  thresholdLabel?: string;
  classify: (point: RatedFactorEntry) => string | null;
}

const FACTOR_ORDER: SleepCorrelationFactor[] = [
  'exercise',
  'caffeine',
  'alcohol',
  'stress',
  'screen_time',
];

const MIN_GROUP_SAMPLE_SIZE = 7;
const MIN_REPORTABLE_QUALITY_DELTA = 0.25;
const EARLY_CAFFEINE_CUTOFF_MINUTES = 14 * 60;
const LATE_CAFFEINE_CUTOFF_MINUTES = 18 * 60;
const EARLY_SCREEN_CUTOFF_MINUTES = 60;
const LATE_SCREEN_CUTOFF_MINUTES = 30;
const CLOCK_TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const MAX_PRESLEEP_LOOKBACK_MINUTES = 12 * 60;

function getQualityRating(entry: SleepAnalyticsEntry): number | null {
  return typeof entry.quality_rating === 'number' ? entry.quality_rating : null;
}

function parseClockTime(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const match = CLOCK_TIME_RE.exec(value);
  if (!match) {
    return null;
  }

  return (Number(match[1]) * 60) + Number(match[2]);
}

function filterEntriesByRange(
  entries: readonly SleepAnalyticsEntry[],
  dateRange: SleepAnalyticsDateRange,
): SleepAnalyticsEntry[] {
  const bounds = getCalendarDateRangeBounds(entries, dateRange);
  if (!bounds) {
    return [];
  }

  return entries.filter(
    (entry) => entry.date >= bounds.startDate && entry.date <= bounds.endDate,
  );
}

function buildFactorLookup(
  factors: readonly Factor[],
): {
  byEntryId: Map<string, Factor>;
  byDate: Map<string, Factor>;
} {
  const byEntryId = new Map<string, Factor>();
  const byDate = new Map<string, Factor>();

  for (const factor of factors) {
    if (factor.sleep_entry_id && !byEntryId.has(factor.sleep_entry_id)) {
      byEntryId.set(factor.sleep_entry_id, factor);
    }
    if (!byDate.has(factor.date)) {
      byDate.set(factor.date, factor);
    }
  }

  return { byEntryId, byDate };
}

function getFactorForEntry(
  entry: SleepAnalyticsEntry,
  lookup: ReturnType<typeof buildFactorLookup>,
): Factor | null {
  return lookup.byEntryId.get(entry.id) ?? lookup.byDate.get(entry.date) ?? null;
}

function collectRatedFactorEntries(
  entries: readonly SleepAnalyticsEntry[],
  factors: readonly Factor[],
  dateRange: SleepAnalyticsDateRange,
): RatedFactorEntry[] {
  const lookup = buildFactorLookup(factors);
  const points: RatedFactorEntry[] = [];

  for (const entry of filterEntriesByRange(entries, dateRange)) {
    const qualityRating = getQualityRating(entry);
    if (qualityRating === null) {
      continue;
    }

    const factor = getFactorForEntry(entry, lookup);
    if (!factor) {
      continue;
    }

    points.push({ entry, factor, qualityRating });
  }

  return points;
}

function averageQuality(values: readonly number[]): number | null {
  if (values.length === 0) {
    return null;
  }

  return roundNumber(
    values.reduce((sum, value) => sum + value, 0) / values.length,
    2,
  );
}

function getConfidence(sampleSize: number): SleepCorrelationConfidence {
  if (sampleSize < 15) {
    return 'low';
  }
  if (sampleSize < 30) {
    return 'medium';
  }
  return 'high';
}

function getImpactPercent(
  firstAverage: number,
  secondAverage: number,
): number | null {
  const lowerAverage = Math.min(firstAverage, secondAverage);
  if (lowerAverage <= 0) {
    return null;
  }

  return roundNumber(
    (Math.abs(firstAverage - secondAverage) / lowerAverage) * 100,
    1,
  );
}

function summarizeGroups(
  points: readonly RatedFactorEntry[],
  options: BuildCorrelationOptions,
): SleepCorrelationGroupSummary[] {
  const valuesByGroup = new Map<string, number[]>();
  valuesByGroup.set(options.preferredGroup.key, []);
  valuesByGroup.set(options.comparisonGroup.key, []);

  for (const point of points) {
    const groupKey = options.classify(point);
    if (!groupKey || !valuesByGroup.has(groupKey)) {
      continue;
    }

    valuesByGroup.get(groupKey)?.push(point.qualityRating);
  }

  return [options.preferredGroup, options.comparisonGroup].map((group) => {
    const values = valuesByGroup.get(group.key) ?? [];
    return {
      key: group.key,
      label: group.label,
      averageQualityRating: averageQuality(values),
      sampleSize: values.length,
    };
  });
}

function getGroup(
  groups: readonly SleepCorrelationGroupSummary[],
  key: string,
): SleepCorrelationGroupSummary {
  const group = groups.find((candidate) => candidate.key === key);
  if (!group) {
    throw new Error(`Missing correlation group: ${key}`);
  }
  return group;
}

function buildInsufficientCorrelation(
  options: BuildCorrelationOptions,
  groups: SleepCorrelationGroupSummary[],
  sampleSize: number,
): SleepCorrelationResult {
  return {
    factor: options.factor,
    label: options.label,
    status: 'insufficient_data',
    direction: 'neutral',
    confidence: null,
    sampleSize,
    groups,
    preferredGroupKey: options.preferredGroup.key,
    comparisonGroupKey: options.comparisonGroup.key,
    favorableGroupKey: null,
    baselineGroupKey: null,
    difference: null,
    impactPercent: null,
    thresholdLabel: options.thresholdLabel ?? null,
    reason: 'At least 7 rated nights are required in each comparison group.',
    insight: null,
  };
}

function buildNotSignificantCorrelation(
  options: BuildCorrelationOptions,
  groups: SleepCorrelationGroupSummary[],
  sampleSize: number,
  difference: number,
  impactPercent: number | null,
): SleepCorrelationResult {
  return {
    factor: options.factor,
    label: options.label,
    status: 'not_significant',
    direction: 'neutral',
    confidence: getConfidence(sampleSize),
    sampleSize,
    groups,
    preferredGroupKey: options.preferredGroup.key,
    comparisonGroupKey: options.comparisonGroup.key,
    favorableGroupKey: null,
    baselineGroupKey: null,
    difference,
    impactPercent,
    thresholdLabel: options.thresholdLabel ?? null,
    reason: 'Average quality differs by less than 0.25 points.',
    insight: null,
  };
}

function buildReportableCorrelation(
  options: BuildCorrelationOptions,
  groups: SleepCorrelationGroupSummary[],
  sampleSize: number,
  difference: number,
  impactPercent: number | null,
): SleepCorrelationResult {
  const preferred = getGroup(groups, options.preferredGroup.key);
  const comparison = getGroup(groups, options.comparisonGroup.key);
  const preferredIsBetter = difference > 0;

  const result: SleepCorrelationResult = {
    factor: options.factor,
    label: options.label,
    status: 'reportable',
    direction: preferredIsBetter ? 'positive' : 'negative',
    confidence: getConfidence(sampleSize),
    sampleSize,
    groups,
    preferredGroupKey: options.preferredGroup.key,
    comparisonGroupKey: options.comparisonGroup.key,
    favorableGroupKey: preferredIsBetter ? preferred.key : comparison.key,
    baselineGroupKey: preferredIsBetter ? comparison.key : preferred.key,
    difference,
    impactPercent,
    thresholdLabel: options.thresholdLabel ?? null,
    reason: null,
    insight: null,
  };

  return {
    ...result,
    insight: generateInsight(result),
  };
}

function buildCorrelationResult(
  entries: readonly SleepAnalyticsEntry[],
  factors: readonly Factor[],
  dateRange: SleepAnalyticsDateRange,
  options: BuildCorrelationOptions,
): SleepCorrelationResult {
  const points = collectRatedFactorEntries(entries, factors, dateRange);
  const groups = summarizeGroups(points, options);
  const preferred = getGroup(groups, options.preferredGroup.key);
  const comparison = getGroup(groups, options.comparisonGroup.key);
  const sampleSize = preferred.sampleSize + comparison.sampleSize;

  if (
    preferred.sampleSize < MIN_GROUP_SAMPLE_SIZE ||
    comparison.sampleSize < MIN_GROUP_SAMPLE_SIZE ||
    preferred.averageQualityRating === null ||
    comparison.averageQualityRating === null
  ) {
    return buildInsufficientCorrelation(options, groups, sampleSize);
  }

  const difference = roundNumber(
    preferred.averageQualityRating - comparison.averageQualityRating,
    2,
  );
  const impactPercent = getImpactPercent(
    preferred.averageQualityRating,
    comparison.averageQualityRating,
  );

  if (Math.abs(difference) < MIN_REPORTABLE_QUALITY_DELTA) {
    return buildNotSignificantCorrelation(
      options,
      groups,
      sampleSize,
      difference,
      impactPercent,
    );
  }

  return buildReportableCorrelation(
    options,
    groups,
    sampleSize,
    difference,
    impactPercent,
  );
}

function getMinutesBeforeBed(
  clockTime: string | null,
  bedtime: string,
): number | null {
  const rawBedtimeMinutes = getClockMinutes(bedtime);
  const rawFactorMinutes = parseClockTime(clockTime);
  if (rawBedtimeMinutes === null || rawFactorMinutes === null) {
    return null;
  }

  const bedtimeMinutes = normalizeBedtimeMinutes(rawBedtimeMinutes);
  const candidates = [
    rawFactorMinutes - (24 * 60),
    rawFactorMinutes,
    rawFactorMinutes + (24 * 60),
  ];
  const deltas = candidates
    .map((candidate) => bedtimeMinutes - candidate)
    .filter(
      (delta) =>
        delta >= 0 &&
        delta <= MAX_PRESLEEP_LOOKBACK_MINUTES,
    );

  return deltas.length > 0 ? Math.min(...deltas) : null;
}

function getInsightSubject(correlation: SleepCorrelationResult): string {
  const preferredWon =
    correlation.favorableGroupKey === correlation.preferredGroupKey;

  if (correlation.factor === 'exercise') {
    return preferredWon ? 'on exercise days' : 'on days without exercise';
  }
  if (correlation.factor === 'caffeine') {
    return preferredWon
      ? 'when caffeine stops before 2 PM'
      : 'when caffeine continues after 6 PM';
  }
  if (correlation.factor === 'alcohol') {
    return preferredWon ? 'on nights without alcohol' : 'on nights with alcohol';
  }
  if (correlation.factor === 'stress') {
    return preferredWon ? 'after low-stress days' : 'after high-stress days';
  }

  return preferredWon
    ? 'when screens stop more than 1 hour before bed'
    : 'when screens stop less than 30 minutes before bed';
}

export function correlateExercise(
  entries: readonly SleepAnalyticsEntry[],
  factors: readonly Factor[],
  dateRange: SleepAnalyticsDateRange = {},
): SleepCorrelationResult {
  return buildCorrelationResult(entries, factors, dateRange, {
    factor: 'exercise',
    label: 'Exercise',
    preferredGroup: {
      key: 'with_exercise',
      label: 'With exercise',
    },
    comparisonGroup: {
      key: 'without_exercise',
      label: 'Without exercise',
    },
    classify: (point) =>
      point.factor.exercise_today ? 'with_exercise' : 'without_exercise',
  });
}

export function correlateCaffeine(
  entries: readonly SleepAnalyticsEntry[],
  factors: readonly Factor[],
  dateRange: SleepAnalyticsDateRange = {},
): SleepCorrelationResult {
  return buildCorrelationResult(entries, factors, dateRange, {
    factor: 'caffeine',
    label: 'Caffeine cutoff',
    preferredGroup: {
      key: 'early_caffeine_cutoff',
      label: 'Before 2 PM',
    },
    comparisonGroup: {
      key: 'late_caffeine_cutoff',
      label: 'After 6 PM',
    },
    thresholdLabel: 'Early before 2 PM, late after 6 PM',
    classify: (point) => {
      const minutes = parseClockTime(point.factor.last_caffeine_time);
      if (minutes === null) {
        return null;
      }
      if (minutes < EARLY_CAFFEINE_CUTOFF_MINUTES) {
        return 'early_caffeine_cutoff';
      }
      if (minutes > LATE_CAFFEINE_CUTOFF_MINUTES) {
        return 'late_caffeine_cutoff';
      }
      return null;
    },
  });
}

export function correlateAlcohol(
  entries: readonly SleepAnalyticsEntry[],
  factors: readonly Factor[],
  dateRange: SleepAnalyticsDateRange = {},
): SleepCorrelationResult {
  return buildCorrelationResult(entries, factors, dateRange, {
    factor: 'alcohol',
    label: 'Alcohol',
    preferredGroup: {
      key: 'no_alcohol',
      label: 'No drinks',
    },
    comparisonGroup: {
      key: 'with_alcohol',
      label: 'Any drinks',
    },
    classify: (point) =>
      point.factor.alcohol_drinks === 0 ? 'no_alcohol' : 'with_alcohol',
  });
}

export function correlateStress(
  entries: readonly SleepAnalyticsEntry[],
  factors: readonly Factor[],
  dateRange: SleepAnalyticsDateRange = {},
): SleepCorrelationResult {
  return buildCorrelationResult(entries, factors, dateRange, {
    factor: 'stress',
    label: 'Stress',
    preferredGroup: {
      key: 'low_stress',
      label: 'Low stress',
    },
    comparisonGroup: {
      key: 'high_stress',
      label: 'High stress',
    },
    classify: (point) => {
      const stressLevel = point.factor.stress_level;
      if (stressLevel === null) {
        return null;
      }
      if (stressLevel <= 2) {
        return 'low_stress';
      }
      if (stressLevel >= 4) {
        return 'high_stress';
      }
      return null;
    },
  });
}

export function correlateScreenTime(
  entries: readonly SleepAnalyticsEntry[],
  factors: readonly Factor[],
  dateRange: SleepAnalyticsDateRange = {},
): SleepCorrelationResult {
  return buildCorrelationResult(entries, factors, dateRange, {
    factor: 'screen_time',
    label: 'Screen cutoff',
    preferredGroup: {
      key: 'early_screen_cutoff',
      label: 'More than 1 hour before bed',
    },
    comparisonGroup: {
      key: 'late_screen_cutoff',
      label: 'Less than 30 minutes before bed',
    },
    thresholdLabel: 'Early more than 1 hour before bed, late less than 30 minutes before bed',
    classify: (point) => {
      const minutesBeforeBed = getMinutesBeforeBed(
        point.factor.screen_cutoff_time,
        point.entry.bedtime,
      );
      if (minutesBeforeBed === null) {
        return null;
      }
      if (minutesBeforeBed > EARLY_SCREEN_CUTOFF_MINUTES) {
        return 'early_screen_cutoff';
      }
      if (minutesBeforeBed < LATE_SCREEN_CUTOFF_MINUTES) {
        return 'late_screen_cutoff';
      }
      return null;
    },
  });
}

export function getTopCorrelations(
  entries: readonly SleepAnalyticsEntry[],
  factors: readonly Factor[],
  dateRange: SleepAnalyticsDateRange = {},
  limit = 5,
): SleepCorrelationResult[] {
  const correlations = [
    correlateExercise(entries, factors, dateRange),
    correlateCaffeine(entries, factors, dateRange),
    correlateAlcohol(entries, factors, dateRange),
    correlateStress(entries, factors, dateRange),
    correlateScreenTime(entries, factors, dateRange),
  ];

  const factorRank = new Map(
    FACTOR_ORDER.map((factor, index) => [factor, index]),
  );

  return correlations
    .filter((correlation) => correlation.status === 'reportable')
    .sort((a, b) => {
      const impactDelta =
        Math.abs(b.difference ?? 0) - Math.abs(a.difference ?? 0);
      if (impactDelta !== 0) {
        return impactDelta;
      }
      if (a.sampleSize !== b.sampleSize) {
        return b.sampleSize - a.sampleSize;
      }
      return (
        (factorRank.get(a.factor) ?? Number.MAX_SAFE_INTEGER) -
        (factorRank.get(b.factor) ?? Number.MAX_SAFE_INTEGER)
      );
    })
    .slice(0, Math.max(0, limit));
}

export function generateInsight(
  correlation: SleepCorrelationResult,
): string | null {
  if (
    correlation.status !== 'reportable' ||
    correlation.favorableGroupKey === null ||
    correlation.impactPercent === null
  ) {
    return null;
  }

  return `Sleep quality is ${correlation.impactPercent}% better ${getInsightSubject(correlation)}.`;
}
