import type { DatabaseAdapter } from '@mylife/db';

export type SleepMoodCorrelationStatus =
  | 'disabled'
  | 'insufficient_data'
  | 'no_variance'
  | 'reportable';

export interface SleepMoodCorrelationDateRange {
  startDate?: string;
  endDate?: string;
  minPairedDataPoints?: number;
}

export interface SleepMoodPair {
  date: string;
  sleepQuality: number;
  moodScore: number;
  sleepEntryCount: number;
  moodEntryCount: number;
}

export interface SleepMoodCorrelation {
  correlation: number;
  insight: string;
  sampleSize: number;
  status: SleepMoodCorrelationStatus;
  goodSleepAverageMood: number | null;
  lowerQualitySleepAverageMood: number | null;
  highMoodAverageSleepQuality: number | null;
  lowMoodAverageSleepQuality: number | null;
  pairs: SleepMoodPair[];
}

interface SleepMoodPairRow {
  date: string;
  sleep_quality: number;
  mood_score: number;
  sleep_entry_count: number;
  mood_entry_count: number;
}

const DEFAULT_MIN_PAIRED_DATA_POINTS = 7;

function emptyCorrelation(status: SleepMoodCorrelationStatus): SleepMoodCorrelation {
  return {
    correlation: 0,
    insight: '',
    sampleSize: 0,
    status,
    goodSleepAverageMood: null,
    lowerQualitySleepAverageMood: null,
    highMoodAverageSleepQuality: null,
    lowMoodAverageSleepQuality: null,
    pairs: [],
  };
}

function areBridgeModulesEnabled(db: DatabaseAdapter): boolean {
  try {
    const rows = db.query<{ count: number }>(
      `SELECT COUNT(DISTINCT module_id) as count
       FROM hub_enabled_modules
       WHERE module_id IN (?, ?)`,
      ['sleep', 'mood'],
    );

    return (rows[0]?.count ?? 0) === 2;
  } catch {
    return false;
  }
}

function readPairs(
  db: DatabaseAdapter,
  dateRange: SleepMoodCorrelationDateRange,
): SleepMoodPair[] | null {
  const sleepWhere = ['quality_rating IS NOT NULL'];
  const moodWhere: string[] = [];
  const sleepParams: unknown[] = [];
  const moodParams: unknown[] = [];

  if (dateRange.startDate) {
    sleepWhere.push('date >= ?');
    moodWhere.push('date >= ?');
    sleepParams.push(dateRange.startDate);
    moodParams.push(dateRange.startDate);
  }
  if (dateRange.endDate) {
    sleepWhere.push('date <= ?');
    moodWhere.push('date <= ?');
    sleepParams.push(dateRange.endDate);
    moodParams.push(dateRange.endDate);
  }

  const moodWhereClause =
    moodWhere.length > 0 ? `WHERE ${moodWhere.join(' AND ')}` : '';

  try {
    const rows = db.query<SleepMoodPairRow>(
      `WITH sleep_daily AS (
         SELECT
           date,
           AVG(quality_rating) as sleep_quality,
           COUNT(*) as sleep_entry_count
         FROM sl_sleep_entries
         WHERE ${sleepWhere.join(' AND ')}
         GROUP BY date
       ),
       mood_daily AS (
         SELECT
           date,
           AVG(score) as mood_score,
           COUNT(*) as mood_entry_count
         FROM mo_entries
         ${moodWhereClause}
         GROUP BY date
       )
       SELECT
         sleep_daily.date,
         sleep_daily.sleep_quality,
         mood_daily.mood_score,
         sleep_daily.sleep_entry_count,
         mood_daily.mood_entry_count
       FROM sleep_daily
       INNER JOIN mood_daily ON mood_daily.date = sleep_daily.date
       ORDER BY sleep_daily.date ASC
       LIMIT 1000`,
      [...sleepParams, ...moodParams],
    );

    return rows
      .map((row) => ({
        date: row.date,
        sleepQuality: Number(row.sleep_quality),
        moodScore: Number(row.mood_score),
        sleepEntryCount: Number(row.sleep_entry_count),
        moodEntryCount: Number(row.mood_entry_count),
      }))
      .filter(
        (pair) =>
          Number.isFinite(pair.sleepQuality) && Number.isFinite(pair.moodScore),
      );
  } catch {
    return null;
  }
}

function average(values: readonly number[]): number | null {
  if (values.length === 0) {
    return null;
  }

  return round(values.reduce((sum, value) => sum + value, 0) / values.length, 1);
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function pearsonCorrelation(
  leftValues: readonly number[],
  rightValues: readonly number[],
): number | null {
  const sampleSize = Math.min(leftValues.length, rightValues.length);
  if (sampleSize < DEFAULT_MIN_PAIRED_DATA_POINTS) {
    return null;
  }

  const leftMean =
    leftValues.reduce((sum, value) => sum + value, 0) / sampleSize;
  const rightMean =
    rightValues.reduce((sum, value) => sum + value, 0) / sampleSize;

  let numerator = 0;
  let leftVariance = 0;
  let rightVariance = 0;

  for (let index = 0; index < sampleSize; index += 1) {
    const leftDelta = leftValues[index] - leftMean;
    const rightDelta = rightValues[index] - rightMean;
    numerator += leftDelta * rightDelta;
    leftVariance += leftDelta * leftDelta;
    rightVariance += rightDelta * rightDelta;
  }

  const denominator = Math.sqrt(leftVariance * rightVariance);
  if (denominator === 0) {
    return null;
  }

  return round(numerator / denominator, 3);
}

function buildInsight(
  correlation: number,
  sampleSize: number,
  goodSleepAverageMood: number | null,
  lowerQualitySleepAverageMood: number | null,
): string {
  if (
    goodSleepAverageMood !== null &&
    lowerQualitySleepAverageMood !== null
  ) {
    return `Your mood averages ${goodSleepAverageMood.toFixed(1)}/10 after nights with quality 4+, vs ${lowerQualitySleepAverageMood.toFixed(1)}/10 after lower-quality sleep.`;
  }

  if (correlation > 0) {
    return `Across ${sampleSize} paired days, higher sleep quality lines up with higher mood (r=${correlation.toFixed(2)}).`;
  }

  return `Across ${sampleSize} paired days, higher sleep quality lines up with lower mood (r=${correlation.toFixed(2)}).`;
}

export function getSleepMoodCorrelation(
  db: DatabaseAdapter,
  dateRange: SleepMoodCorrelationDateRange = {},
): SleepMoodCorrelation {
  if (!areBridgeModulesEnabled(db)) {
    return emptyCorrelation('disabled');
  }

  const minPairedDataPoints =
    dateRange.minPairedDataPoints ?? DEFAULT_MIN_PAIRED_DATA_POINTS;
  const pairs = readPairs(db, dateRange);

  if (!pairs) {
    return emptyCorrelation('disabled');
  }
  if (pairs.length < minPairedDataPoints) {
    return {
      ...emptyCorrelation('insufficient_data'),
      sampleSize: pairs.length,
      pairs,
    };
  }

  const sleepQualityValues = pairs.map((pair) => pair.sleepQuality);
  const moodScoreValues = pairs.map((pair) => pair.moodScore);
  const correlation = pearsonCorrelation(sleepQualityValues, moodScoreValues);

  if (correlation === null) {
    return {
      ...emptyCorrelation('no_variance'),
      sampleSize: pairs.length,
      pairs,
    };
  }

  const goodSleepAverageMood = average(
    pairs
      .filter((pair) => pair.sleepQuality >= 4)
      .map((pair) => pair.moodScore),
  );
  const lowerQualitySleepAverageMood = average(
    pairs
      .filter((pair) => pair.sleepQuality < 4)
      .map((pair) => pair.moodScore),
  );
  const highMoodAverageSleepQuality = average(
    pairs
      .filter((pair) => pair.moodScore >= 7)
      .map((pair) => pair.sleepQuality),
  );
  const lowMoodAverageSleepQuality = average(
    pairs
      .filter((pair) => pair.moodScore <= 5)
      .map((pair) => pair.sleepQuality),
  );

  return {
    correlation,
    insight: buildInsight(
      correlation,
      pairs.length,
      goodSleepAverageMood,
      lowerQualitySleepAverageMood,
    ),
    sampleSize: pairs.length,
    status: 'reportable',
    goodSleepAverageMood,
    lowerQualitySleepAverageMood,
    highMoodAverageSleepQuality,
    lowMoodAverageSleepQuality,
    pairs,
  };
}
