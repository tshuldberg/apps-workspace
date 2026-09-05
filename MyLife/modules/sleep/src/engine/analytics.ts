import type { Factor } from '../models/factor-schemas';
import type { SleepEntry } from '../models/schemas';
import { getSleepWeekStart } from './timeline';

export type SleepTrendGranularity = 'day' | 'week' | 'month';

export interface SleepAnalyticsDateRange {
  startDate?: string;
  endDate?: string;
}

export type SleepAnalyticsEntry = Omit<SleepEntry, 'quality_rating'> & {
  quality_rating?: number | null;
};

export interface SleepAverageSummary {
  startDate: string;
  endDate: string;
  avgDurationMinutes: number | null;
  avgDurationHours: number | null;
  avgQualityRating: number | null;
  averageWakeCount: number | null;
  averageSleepLatencyMinutes: number | null;
  totalNights: number;
  ratedNights: number;
  onTargetNights: number;
  targetHours: number;
}

export interface SleepTrendPoint extends SleepAverageSummary {
  granularity: SleepTrendGranularity;
  bucketStart: string;
  bucketEnd: string;
  periodStart: string;
  periodEnd: string;
  label: string;
}

export interface SleepNightConditions {
  preSleepActivities: Factor['pre_sleep_activities'];
  supplements: Factor['supplements'];
  stressLevel: number | null;
  alcoholDrinks: number;
  exerciseToday: boolean;
  roomTemp: Factor['room_temp'];
  roomLight: Factor['room_light'];
  roomNoise: Factor['room_noise'];
  lastCaffeineTime: string | null;
  lastMealTime: string | null;
  screenCutoffTime: string | null;
}

export interface SleepNightInsight {
  entry: SleepAnalyticsEntry;
  factor: Factor | null;
  conditions: SleepNightConditions | null;
}

export interface WeekendVsWeekdaySummary {
  weekdayAvg: SleepAverageSummary;
  weekendAvg: SleepAverageSummary;
  difference: {
    durationMinutes: number | null;
    qualityRating: number | null;
  };
}

interface DateRangeBounds {
  startDate: string;
  endDate: string;
}

interface BucketRange {
  bucketStart: string;
  bucketEnd: string;
  rangeStart: string;
  rangeEnd: string;
}

const CALENDAR_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const CLOCK_TIME_RE = /T(\d{2}):(\d{2})/;
const MINUTES_PER_DAY = 24 * 60;

function assertCalendarDate(value: string): void {
  const match = CALENDAR_DATE_RE.exec(value);
  if (!match) {
    throw new Error(`Invalid calendar date: ${value}`);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0));

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw new Error(`Invalid calendar date: ${value}`);
  }
}

function assertDateRange(dateRange: DateRangeBounds): void {
  assertCalendarDate(dateRange.startDate);
  assertCalendarDate(dateRange.endDate);

  if (dateRange.startDate > dateRange.endDate) {
    throw new Error('startDate must be on or before endDate');
  }
}

function normalizeTargetHours(targetHours: number): number {
  return Number.isFinite(targetHours) && targetHours > 0 ? targetHours : 8;
}

function parseCalendarDate(value: string): Date {
  assertCalendarDate(value);
  const [year, month, day] = value.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0));
}

function formatCalendarDate(value: Date): string {
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, '0');
  const day = String(value.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatMonthStart(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}-01`;
}

function getMonthEnd(year: number, month: number): string {
  return formatCalendarDate(new Date(Date.UTC(year, month, 0, 12, 0, 0, 0)));
}

function maxDate(a: string, b: string): string {
  return a > b ? a : b;
}

function minDate(a: string, b: string): string {
  return a < b ? a : b;
}

function average(values: number[], decimals = 1): number | null {
  if (values.length === 0) {
    return null;
  }

  return roundNumber(
    values.reduce((sum, value) => sum + value, 0) / values.length,
    decimals,
  );
}

function qualityRatingOf(entry: SleepAnalyticsEntry): number | null {
  return typeof entry.quality_rating === 'number' ? entry.quality_rating : null;
}

function compareEntriesOldestFirst(
  a: SleepAnalyticsEntry,
  b: SleepAnalyticsEntry,
): number {
  if (a.date !== b.date) {
    return a.date < b.date ? -1 : 1;
  }
  if (a.wake_time !== b.wake_time) {
    return a.wake_time < b.wake_time ? -1 : 1;
  }
  return a.id.localeCompare(b.id);
}

function compareEntriesNewestFirst(
  a: SleepAnalyticsEntry,
  b: SleepAnalyticsEntry,
): number {
  return compareEntriesOldestFirst(b, a);
}

function summarizeFactorConditions(
  factor: Factor | null,
): SleepNightConditions | null {
  if (!factor) {
    return null;
  }

  return {
    preSleepActivities: factor.pre_sleep_activities,
    supplements: factor.supplements,
    stressLevel: factor.stress_level,
    alcoholDrinks: factor.alcohol_drinks,
    exerciseToday: factor.exercise_today,
    roomTemp: factor.room_temp,
    roomLight: factor.room_light,
    roomNoise: factor.room_noise,
    lastCaffeineTime: factor.last_caffeine_time,
    lastMealTime: factor.last_meal_time,
    screenCutoffTime: factor.screen_cutoff_time,
  };
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

function compareBestNight(a: SleepNightInsight, b: SleepNightInsight): number {
  const qualityDelta =
    (qualityRatingOf(b.entry) ?? 0) - (qualityRatingOf(a.entry) ?? 0);
  if (qualityDelta !== 0) {
    return qualityDelta;
  }

  if (a.entry.duration_minutes !== b.entry.duration_minutes) {
    return b.entry.duration_minutes - a.entry.duration_minutes;
  }
  if (a.entry.wake_count !== b.entry.wake_count) {
    return a.entry.wake_count - b.entry.wake_count;
  }
  return compareEntriesNewestFirst(a.entry, b.entry);
}

function compareWorstNight(a: SleepNightInsight, b: SleepNightInsight): number {
  const qualityDelta =
    (qualityRatingOf(a.entry) ?? 0) - (qualityRatingOf(b.entry) ?? 0);
  if (qualityDelta !== 0) {
    return qualityDelta;
  }

  if (a.entry.duration_minutes !== b.entry.duration_minutes) {
    return a.entry.duration_minutes - b.entry.duration_minutes;
  }
  if (a.entry.wake_count !== b.entry.wake_count) {
    return b.entry.wake_count - a.entry.wake_count;
  }
  return compareEntriesNewestFirst(a.entry, b.entry);
}

function getBucketEnd(
  bucketStart: string,
  granularity: SleepTrendGranularity,
): string {
  if (granularity === 'day') {
    return bucketStart;
  }
  if (granularity === 'week') {
    return addCalendarDays(bucketStart, 6);
  }

  const [year, month] = bucketStart.split('-').map(Number);
  return getMonthEnd(year, month);
}

function getNextBucketStart(
  bucketStart: string,
  granularity: SleepTrendGranularity,
): string {
  if (granularity === 'day') {
    return addCalendarDays(bucketStart, 1);
  }
  if (granularity === 'week') {
    return addCalendarDays(bucketStart, 7);
  }

  const [year, month] = bucketStart.split('-').map(Number);
  const next = new Date(Date.UTC(year, month, 1, 12, 0, 0, 0));
  return formatCalendarDate(next);
}

function getFirstBucketStart(
  startDate: string,
  granularity: SleepTrendGranularity,
): string {
  if (granularity === 'day') {
    return startDate;
  }
  if (granularity === 'week') {
    return getSleepWeekStart(startDate);
  }

  return `${startDate.slice(0, 7)}-01`;
}

function getEntryBucketStart(
  entry: SleepAnalyticsEntry,
  granularity: SleepTrendGranularity,
): string {
  return getFirstBucketStart(entry.date, granularity);
}

function getBucketRanges(
  dateRange: DateRangeBounds,
  granularity: SleepTrendGranularity,
): BucketRange[] {
  const ranges: BucketRange[] = [];
  let bucketStart = getFirstBucketStart(dateRange.startDate, granularity);

  while (bucketStart <= dateRange.endDate) {
    const bucketEnd = getBucketEnd(bucketStart, granularity);
    ranges.push({
      bucketStart,
      bucketEnd,
      rangeStart: maxDate(bucketStart, dateRange.startDate),
      rangeEnd: minDate(bucketEnd, dateRange.endDate),
    });
    bucketStart = getNextBucketStart(bucketStart, granularity);
  }

  return ranges;
}

function getTrendLabel(
  bucketStart: string,
  granularity: SleepTrendGranularity,
): string {
  if (granularity === 'day') {
    return bucketStart;
  }

  const parsed = parseCalendarDate(bucketStart);
  if (granularity === 'week') {
    return `Week of ${parsed.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    })}`;
  }

  return parsed.toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function filterEntriesForRange(
  entries: readonly SleepAnalyticsEntry[],
  dateRange: DateRangeBounds,
): SleepAnalyticsEntry[] {
  return entries.filter(
    (entry) => entry.date >= dateRange.startDate && entry.date <= dateRange.endDate,
  );
}

function resolveDateRange(
  entries: readonly SleepAnalyticsEntry[],
  rawDateRange?: SleepAnalyticsDateRange,
): DateRangeBounds | null {
  if (rawDateRange?.startDate && rawDateRange.endDate) {
    const explicit = {
      startDate: rawDateRange.startDate,
      endDate: rawDateRange.endDate,
    };
    assertDateRange(explicit);
    return explicit;
  }

  let minEntryDate: string | null = null;
  let maxEntryDate: string | null = null;
  for (const entry of entries) {
    if (minEntryDate === null || entry.date < minEntryDate) {
      minEntryDate = entry.date;
    }
    if (maxEntryDate === null || entry.date > maxEntryDate) {
      maxEntryDate = entry.date;
    }
  }

  const inferredStart = rawDateRange?.startDate ?? minEntryDate;
  const inferredEnd = rawDateRange?.endDate ?? maxEntryDate;

  if (!inferredStart || !inferredEnd) {
    return null;
  }

  const inferred = {
    startDate: inferredStart,
    endDate: inferredEnd,
  };
  assertDateRange(inferred);
  return inferred;
}

function getDateRangeSummary(
  entries: readonly SleepAnalyticsEntry[],
  startDate: string,
  endDate: string,
  targetHours: number,
): SleepAverageSummary {
  assertDateRange({ startDate, endDate });

  const target = normalizeTargetHours(targetHours);
  const durations = entries.map((entry) => entry.duration_minutes);
  const qualityRatings = entries
    .map(qualityRatingOf)
    .filter((value): value is number => value !== null);
  const wakeCounts = entries.map((entry) => entry.wake_count);
  const sleepLatency = entries
    .map((entry) => entry.sleep_latency_minutes)
    .filter((value): value is number => typeof value === 'number');

  return {
    startDate,
    endDate,
    avgDurationMinutes: average(durations, 0),
    avgDurationHours: average(
      durations.map((duration) => duration / 60),
      2,
    ),
    avgQualityRating: average(qualityRatings, 2),
    averageWakeCount: average(wakeCounts, 2),
    averageSleepLatencyMinutes: average(sleepLatency, 0),
    totalNights: entries.length,
    ratedNights: qualityRatings.length,
    onTargetNights: entries.filter(
      (entry) => entry.duration_minutes >= target * 60,
    ).length,
    targetHours: target,
  };
}

export function addCalendarDays(date: string, days: number): string {
  const parsed = parseCalendarDate(date);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return formatCalendarDate(parsed);
}

export function getCalendarDateRangeBounds(
  entries: readonly SleepAnalyticsEntry[],
  rawDateRange?: SleepAnalyticsDateRange,
): DateRangeBounds | null {
  return resolveDateRange(entries, rawDateRange);
}

export function getClockMinutes(value: string): number | null {
  const match = CLOCK_TIME_RE.exec(value);
  if (!match) {
    return null;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) {
    return null;
  }

  return (hours * 60) + minutes;
}

export function normalizeBedtimeMinutes(minutes: number): number {
  return minutes < 12 * 60 ? minutes + MINUTES_PER_DAY : minutes;
}

export function formatClockMinutes(totalMinutes: number): string {
  const normalized =
    ((Math.round(totalMinutes) % MINUTES_PER_DAY) + MINUTES_PER_DAY) %
    MINUTES_PER_DAY;
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export function roundNumber(value: number, decimals = 1): number {
  return Number(value.toFixed(decimals));
}

export function getWeeklyAverage(
  entries: readonly SleepAnalyticsEntry[],
  weekStart: string,
  targetHours = 8,
): SleepAverageSummary {
  assertCalendarDate(weekStart);
  const endDate = addCalendarDays(weekStart, 6);
  return getDateRangeSummary(
    filterEntriesForRange(entries, { startDate: weekStart, endDate }),
    weekStart,
    endDate,
    targetHours,
  );
}

export function getMonthlyAverage(
  entries: readonly SleepAnalyticsEntry[],
  month: number,
  year: number,
  targetHours = 8,
): SleepAverageSummary {
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error('month must be an integer from 1 to 12');
  }
  if (!Number.isInteger(year) || year < 1) {
    throw new Error('year must be a positive integer');
  }

  const startDate = formatMonthStart(year, month);
  const endDate = getMonthEnd(year, month);
  return getDateRangeSummary(
    filterEntriesForRange(entries, { startDate, endDate }),
    startDate,
    endDate,
    targetHours,
  );
}

export function getTrendData(
  entries: readonly SleepAnalyticsEntry[],
  dateRange: SleepAnalyticsDateRange = {},
  granularity: SleepTrendGranularity = 'day',
  targetHours = 8,
): SleepTrendPoint[] {
  const bounds = resolveDateRange(entries, dateRange);
  if (!bounds) {
    return [];
  }

  const filtered = filterEntriesForRange(entries, bounds);
  const buckets = getBucketRanges(bounds, granularity);
  const entriesByBucket = new Map<string, SleepAnalyticsEntry[]>();

  for (const bucket of buckets) {
    entriesByBucket.set(bucket.bucketStart, []);
  }
  for (const entry of filtered) {
    const bucketStart = getEntryBucketStart(entry, granularity);
    entriesByBucket.get(bucketStart)?.push(entry);
  }

  return buckets.map((bucket) => {
    const bucketEntries = entriesByBucket.get(bucket.bucketStart) ?? [];
    return {
      ...getDateRangeSummary(
        bucketEntries,
        bucket.rangeStart,
        bucket.rangeEnd,
        targetHours,
      ),
      granularity,
      bucketStart: bucket.bucketStart,
      bucketEnd: bucket.bucketEnd,
      periodStart: bucket.rangeStart,
      periodEnd: bucket.rangeEnd,
      label: getTrendLabel(bucket.bucketStart, granularity),
    };
  });
}

export function getBestNights(
  entries: readonly SleepAnalyticsEntry[],
  factors: readonly Factor[] = [],
  limit = 5,
  dateRange: SleepAnalyticsDateRange = {},
): SleepNightInsight[] {
  const bounds = resolveDateRange(entries, dateRange);
  const filtered = bounds ? filterEntriesForRange(entries, bounds) : [...entries];
  const lookup = buildFactorLookup(factors);

  return filtered
    .filter((entry) => qualityRatingOf(entry) !== null)
    .map((entry) => {
      const factor = getFactorForEntry(entry, lookup);
      return {
        entry,
        factor,
        conditions: summarizeFactorConditions(factor),
      };
    })
    .sort(compareBestNight)
    .slice(0, Math.max(0, limit));
}

export function getWorstNights(
  entries: readonly SleepAnalyticsEntry[],
  factors: readonly Factor[] = [],
  limit = 5,
  dateRange: SleepAnalyticsDateRange = {},
): SleepNightInsight[] {
  const bounds = resolveDateRange(entries, dateRange);
  const filtered = bounds ? filterEntriesForRange(entries, bounds) : [...entries];
  const lookup = buildFactorLookup(factors);

  return filtered
    .filter((entry) => qualityRatingOf(entry) !== null)
    .map((entry) => {
      const factor = getFactorForEntry(entry, lookup);
      return {
        entry,
        factor,
        conditions: summarizeFactorConditions(factor),
      };
    })
    .sort(compareWorstNight)
    .slice(0, Math.max(0, limit));
}

export function getWeekendVsWeekday(
  entries: readonly SleepAnalyticsEntry[],
  dateRange: SleepAnalyticsDateRange = {},
  targetHours = 8,
): WeekendVsWeekdaySummary {
  const fallbackDate = dateRange.startDate ?? dateRange.endDate ?? '1970-01-01';
  const bounds = resolveDateRange(entries, dateRange) ?? {
    startDate: dateRange.startDate ?? fallbackDate,
    endDate: dateRange.endDate ?? fallbackDate,
  };
  assertDateRange(bounds);

  const filtered = filterEntriesForRange(entries, bounds);
  const weekendEntries: SleepAnalyticsEntry[] = [];
  const weekdayEntries: SleepAnalyticsEntry[] = [];

  for (const entry of filtered) {
    const day = parseCalendarDate(entry.date).getUTCDay();
    if (day === 0 || day === 6) {
      weekendEntries.push(entry);
    } else {
      weekdayEntries.push(entry);
    }
  }

  const weekdayAvg = getDateRangeSummary(
    weekdayEntries,
    bounds.startDate,
    bounds.endDate,
    targetHours,
  );
  const weekendAvg = getDateRangeSummary(
    weekendEntries,
    bounds.startDate,
    bounds.endDate,
    targetHours,
  );

  return {
    weekdayAvg,
    weekendAvg,
    difference: {
      durationMinutes:
        weekendAvg.avgDurationMinutes !== null &&
        weekdayAvg.avgDurationMinutes !== null
          ? roundNumber(
              weekendAvg.avgDurationMinutes - weekdayAvg.avgDurationMinutes,
              0,
            )
          : null,
      qualityRating:
        weekendAvg.avgQualityRating !== null &&
        weekdayAvg.avgQualityRating !== null
          ? roundNumber(
              weekendAvg.avgQualityRating - weekdayAvg.avgQualityRating,
              2,
            )
          : null,
    },
  };
}
