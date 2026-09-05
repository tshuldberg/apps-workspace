import type { Factor } from '../models/factor-schemas';
import type { SleepEntry } from '../models/schemas';
import {
  getCalendarDateRangeBounds,
  type SleepAnalyticsDateRange,
} from './analytics';
import {
  generateCBTIDiaryEntry,
  sortCBTIDiaryEntries,
} from './cbti';

export interface SleepCsvExport {
  filename: string;
  mimeType: 'text/csv';
  content: string;
  rowCount: number;
}

type CsvValue = string | number | boolean | null | undefined;

const CBTI_HEADERS = [
  'date',
  'bedtime',
  'tried_to_sleep',
  'sleep_onset',
  'wake_time',
  'out_of_bed_time',
  'time_to_fall_asleep_minutes',
  'time_in_bed_minutes',
  'total_sleep_time_minutes',
  'sleep_efficiency_percent',
  'number_awakenings',
  'wake_after_sleep_onset_minutes',
  'sleep_quality_1_to_5',
  'medications_supplements',
  'notes',
] as const;

const GENERIC_SLEEP_HEADERS = [
  'id',
  'date',
  'bedtime',
  'sleep_onset_time',
  'wake_time',
  'duration_minutes',
  'quality_rating',
  'wake_count',
  'sleep_latency_minutes',
  'alarm_time',
  'snooze_count',
  'wake_feeling',
  'notes_md',
  'factor_last_caffeine_time',
  'factor_last_meal_time',
  'factor_alcohol_drinks',
  'factor_exercise_today',
  'factor_exercise_time',
  'factor_screen_cutoff_time',
  'factor_room_temp',
  'factor_room_light',
  'factor_room_noise',
  'factor_supplements',
  'factor_stress_level',
  'factor_pre_sleep_activities',
  'factor_notes',
] as const;

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
  entry: SleepEntry,
  lookup: ReturnType<typeof buildFactorLookup>,
): Factor | null {
  return lookup.byEntryId.get(entry.id) ?? lookup.byDate.get(entry.date) ?? null;
}

function getEntriesForExport(
  entries: readonly SleepEntry[],
  dateRange: SleepAnalyticsDateRange,
): SleepEntry[] {
  const bounds = getCalendarDateRangeBounds(entries, dateRange);
  const filtered = bounds
    ? entries.filter(
        (entry) => entry.date >= bounds.startDate && entry.date <= bounds.endDate,
      )
    : entries;

  return sortCBTIDiaryEntries(filtered);
}

function getRangeLabel(
  entries: readonly SleepEntry[],
  dateRange: SleepAnalyticsDateRange,
): string {
  const bounds = getCalendarDateRangeBounds(entries, dateRange);
  if (!bounds) {
    return 'all';
  }

  return bounds.startDate === bounds.endDate
    ? bounds.startDate
    : `${bounds.startDate}-to-${bounds.endDate}`;
}

function serializeCsvValue(value: CsvValue): string {
  if (value === null || value === undefined) {
    return '';
  }

  const text = String(value);
  if (!/[",\n\r]/.test(text)) {
    return text;
  }

  return `"${text.replace(/"/g, '""')}"`;
}

function buildCsv<Header extends string>(
  headers: readonly Header[],
  rows: Array<Record<Header, CsvValue>>,
): string {
  return [
    headers.join(','),
    ...rows.map((row) =>
      headers.map((header) => serializeCsvValue(row[header])).join(','),
    ),
  ].join('\n');
}

function joinValues(values: readonly string[]): string {
  return values.map((value) => value.replace(/_/g, ' ')).join(', ');
}

function buildCBTIRow(
  entry: SleepEntry,
  factor: Factor | null,
): Record<typeof CBTI_HEADERS[number], CsvValue> {
  const diaryEntry = generateCBTIDiaryEntry(entry, factor);

  return {
    date: diaryEntry.date,
    bedtime: diaryEntry.bedtime,
    tried_to_sleep: diaryEntry.triedToSleep,
    sleep_onset: diaryEntry.sleepOnset,
    wake_time: diaryEntry.wakeTime,
    out_of_bed_time: diaryEntry.outOfBedTime,
    time_to_fall_asleep_minutes: diaryEntry.timeToFallAsleepMinutes,
    time_in_bed_minutes: diaryEntry.timeInBedMinutes,
    total_sleep_time_minutes: diaryEntry.totalSleepTimeMinutes,
    sleep_efficiency_percent: diaryEntry.sleepEfficiency,
    number_awakenings: diaryEntry.numberAwakenings,
    wake_after_sleep_onset_minutes: diaryEntry.wakeAfterSleepOnsetMinutes,
    sleep_quality_1_to_5: diaryEntry.sleepQuality,
    medications_supplements: diaryEntry.medicationsSupplements,
    notes: diaryEntry.notes,
  };
}

function buildGenericSleepRow(
  entry: SleepEntry,
  factor: Factor | null,
): Record<typeof GENERIC_SLEEP_HEADERS[number], CsvValue> {
  return {
    id: entry.id,
    date: entry.date,
    bedtime: entry.bedtime,
    sleep_onset_time: entry.sleep_onset_time,
    wake_time: entry.wake_time,
    duration_minutes: entry.duration_minutes,
    quality_rating: entry.quality_rating,
    wake_count: entry.wake_count,
    sleep_latency_minutes: entry.sleep_latency_minutes,
    alarm_time: entry.alarm_time,
    snooze_count: entry.snooze_count,
    wake_feeling: entry.wake_feeling,
    notes_md: entry.notes_md,
    factor_last_caffeine_time: factor?.last_caffeine_time,
    factor_last_meal_time: factor?.last_meal_time,
    factor_alcohol_drinks: factor?.alcohol_drinks,
    factor_exercise_today: factor?.exercise_today,
    factor_exercise_time: factor?.exercise_time,
    factor_screen_cutoff_time: factor?.screen_cutoff_time,
    factor_room_temp: factor?.room_temp,
    factor_room_light: factor?.room_light,
    factor_room_noise: factor?.room_noise,
    factor_supplements: factor ? joinValues(factor.supplements) : '',
    factor_stress_level: factor?.stress_level,
    factor_pre_sleep_activities: factor
      ? joinValues(factor.pre_sleep_activities)
      : '',
    factor_notes: factor?.notes,
  };
}

export function exportToCBTIFormat(
  entries: readonly SleepEntry[],
  factors: readonly Factor[] = [],
  dateRange: SleepAnalyticsDateRange = {},
): SleepCsvExport {
  const exportEntries = getEntriesForExport(entries, dateRange);
  const factorLookup = buildFactorLookup(factors);
  const rows = exportEntries.map((entry) =>
    buildCBTIRow(entry, getFactorForEntry(entry, factorLookup)),
  );
  const rangeLabel = getRangeLabel(entries, dateRange);

  return {
    filename: `mysleep-cbti-diary-${rangeLabel}.csv`,
    mimeType: 'text/csv',
    content: buildCsv(CBTI_HEADERS, rows),
    rowCount: rows.length,
  };
}

export function exportToCSV(
  entries: readonly SleepEntry[],
  factors: readonly Factor[] = [],
  dateRange: SleepAnalyticsDateRange = {},
): SleepCsvExport {
  const exportEntries = getEntriesForExport(entries, dateRange);
  const factorLookup = buildFactorLookup(factors);
  const rows = exportEntries.map((entry) =>
    buildGenericSleepRow(entry, getFactorForEntry(entry, factorLookup)),
  );
  const rangeLabel = getRangeLabel(entries, dateRange);

  return {
    filename: `mysleep-all-sleep-data-${rangeLabel}.csv`,
    mimeType: 'text/csv',
    content: buildCsv(GENERIC_SLEEP_HEADERS, rows),
    rowCount: rows.length,
  };
}
