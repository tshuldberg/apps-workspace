import type { Factor } from '../models/factor-schemas';
import type { SleepEntry } from '../models/schemas';
import { calculateDuration, calculateSleepLatency } from './duration';
import {
  addCalendarDays,
  formatClockMinutes,
  getCalendarDateRangeBounds,
  getClockMinutes,
  roundNumber,
  type SleepAnalyticsDateRange,
} from './analytics';

export type SleepRestrictionWindowStatus = 'restrict' | 'hold' | 'expand';

export interface SleepEfficiencyTrendPoint {
  date: string;
  sleepEfficiency: number | null;
  timeInBedMinutes: number | null;
  totalSleepTimeMinutes: number | null;
  sampleSize: number;
}

export interface SleepRestrictionWindowOptions {
  averageSleepMinutes?: number;
  currentTimeInBedMinutes?: number;
  preferredWakeTime?: string;
}

export interface SleepRestrictionWindow {
  currentEfficiency: number;
  targetEfficiency: number;
  targetRangeLabel: string;
  status: SleepRestrictionWindowStatus;
  recommendedBedtime: string;
  recommendedWakeTime: string;
  recommendedTimeInBedMinutes: number;
  safetyFloorMinutes: number;
  adjustmentMinutes: number;
  progressToTargetPercent: number;
  rationale: string;
}

export interface CBTIDiaryEntry {
  date: string;
  bedtime: string;
  triedToSleep: string;
  sleepOnset: string;
  wakeTime: string;
  outOfBedTime: string;
  timeToFallAsleepMinutes: number | null;
  timeInBedMinutes: number;
  totalSleepTimeMinutes: number;
  sleepEfficiency: number;
  numberAwakenings: number;
  wakeAfterSleepOnsetMinutes: number;
  sleepQuality: number;
  medicationsSupplements: string;
  notes: string;
}

const DEFAULT_TARGET_EFFICIENCY = 85;
const EXPAND_EFFICIENCY_THRESHOLD = 90;
const RESTRICTION_BUFFER_MINUTES = 30;
const WEEKLY_EXPANSION_MINUTES = 15;
const SAFETY_FLOOR_MINUTES = 5.5 * 60;
const DEFAULT_AVERAGE_SLEEP_MINUTES = 8 * 60;
const DEFAULT_WAKE_TIME = '07:00';
const CLOCK_TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

function isFinitePositive(value: number | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function parseClockTime(value: string): number | null {
  const match = CLOCK_TIME_RE.exec(value);
  if (!match) {
    return null;
  }

  return (Number(match[1]) * 60) + Number(match[2]);
}

function formatDateTimeClock(value: string | null): string {
  if (!value) {
    return '';
  }

  const minutes = getClockMinutes(value);
  return minutes === null ? '' : formatClockMinutes(minutes);
}

function compareEntriesOldestFirst(a: SleepEntry, b: SleepEntry): number {
  if (a.date !== b.date) {
    return a.date < b.date ? -1 : 1;
  }
  if (a.wake_time !== b.wake_time) {
    return a.wake_time < b.wake_time ? -1 : 1;
  }
  return a.id.localeCompare(b.id);
}

function isNewerEntry(candidate: SleepEntry, current: SleepEntry): boolean {
  if (candidate.wake_time !== current.wake_time) {
    return candidate.wake_time > current.wake_time;
  }
  if (candidate.created_at !== current.created_at) {
    return candidate.created_at > current.created_at;
  }
  return candidate.id < current.id;
}

function buildEntryByDateMap(
  entries: readonly SleepEntry[],
): Map<string, SleepEntry> {
  const byDate = new Map<string, SleepEntry>();

  for (const entry of entries) {
    const current = byDate.get(entry.date);
    if (!current || isNewerEntry(entry, current)) {
      byDate.set(entry.date, entry);
    }
  }

  return byDate;
}

function normalizeEfficiency(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? roundNumber(value, 1) : fallback;
}

function normalizeMinutes(
  value: number | undefined,
  fallback: number,
): number {
  return isFinitePositive(value) ? Math.round(value) : fallback;
}

function resolveFactorForEntry(
  entry: SleepEntry,
  factors: Factor | readonly Factor[] | null | undefined,
): Factor | null {
  if (!factors) {
    return null;
  }
  if (Array.isArray(factors)) {
    return (
      factors.find((factor) => factor.sleep_entry_id === entry.id)
      ?? factors.find((factor) => factor.date === entry.date)
      ?? null
    );
  }

  const factor = factors as Factor;
  return factor.sleep_entry_id === entry.id || factor.date === entry.date
    ? factor
    : null;
}

function formatListValue(value: string): string {
  return value.replace(/_/g, ' ');
}

function joinNotes(parts: Array<string | null | undefined>): string {
  return parts
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join(' | ');
}

export function calculateSleepEfficiency(entry: SleepEntry): number {
  const timeInBedMinutes = calculateDuration(entry.bedtime, entry.wake_time);
  return roundNumber((entry.duration_minutes / timeInBedMinutes) * 100, 1);
}

export function getEfficiencyTrend(
  entries: readonly SleepEntry[],
  dateRange: SleepAnalyticsDateRange = {},
): SleepEfficiencyTrendPoint[] {
  const bounds = getCalendarDateRangeBounds(entries, dateRange);
  if (!bounds) {
    return [];
  }

  const entryByDate = buildEntryByDateMap(entries);
  const trend: SleepEfficiencyTrendPoint[] = [];
  let date = bounds.startDate;

  while (date <= bounds.endDate) {
    const entry = entryByDate.get(date) ?? null;
    if (!entry) {
      trend.push({
        date,
        sleepEfficiency: null,
        timeInBedMinutes: null,
        totalSleepTimeMinutes: null,
        sampleSize: 0,
      });
      date = addCalendarDays(date, 1);
      continue;
    }

    const timeInBedMinutes = calculateDuration(entry.bedtime, entry.wake_time);
    trend.push({
      date,
      sleepEfficiency: calculateSleepEfficiency(entry),
      timeInBedMinutes,
      totalSleepTimeMinutes: entry.duration_minutes,
      sampleSize: 1,
    });
    date = addCalendarDays(date, 1);
  }

  return trend;
}

export function getSleepRestrictionWindow(
  currentEfficiency: number,
  targetEfficiency = DEFAULT_TARGET_EFFICIENCY,
  options: SleepRestrictionWindowOptions = {},
): SleepRestrictionWindow {
  const efficiency = normalizeEfficiency(currentEfficiency, 0);
  const target = normalizeEfficiency(
    targetEfficiency,
    DEFAULT_TARGET_EFFICIENCY,
  );
  const averageSleepMinutes = normalizeMinutes(
    options.averageSleepMinutes,
    DEFAULT_AVERAGE_SLEEP_MINUTES,
  );
  const currentTimeInBedMinutes = Math.max(
    SAFETY_FLOOR_MINUTES,
    normalizeMinutes(
      options.currentTimeInBedMinutes,
      averageSleepMinutes + RESTRICTION_BUFFER_MINUTES,
    ),
  );
  const wakeTime = options.preferredWakeTime ?? DEFAULT_WAKE_TIME;
  const wakeMinutes = parseClockTime(wakeTime) ?? parseClockTime(DEFAULT_WAKE_TIME)!;

  let status: SleepRestrictionWindowStatus = 'hold';
  let recommendedTimeInBedMinutes = currentTimeInBedMinutes;
  let rationale =
    'Efficiency is in the target range, so hold the current sleep window.';

  if (efficiency < target) {
    status = 'restrict';
    recommendedTimeInBedMinutes = Math.max(
      SAFETY_FLOOR_MINUTES,
      averageSleepMinutes + RESTRICTION_BUFFER_MINUTES,
    );
    rationale =
      'Efficiency is below target, so use actual sleep time plus 30 minutes while respecting the 5.5 hour floor.';
  } else if (efficiency >= EXPAND_EFFICIENCY_THRESHOLD) {
    status = 'expand';
    recommendedTimeInBedMinutes =
      currentTimeInBedMinutes + WEEKLY_EXPANSION_MINUTES;
    rationale =
      'Efficiency is at least 90%, so add 15 minutes to the sleep window for the next week.';
  }

  const recommendedBedtime = formatClockMinutes(
    wakeMinutes - recommendedTimeInBedMinutes,
  );
  const progressToTargetPercent =
    target <= 0 ? 100 : Math.min(100, roundNumber((efficiency / target) * 100, 1));

  return {
    currentEfficiency: efficiency,
    targetEfficiency: target,
    targetRangeLabel: '85-90%',
    status,
    recommendedBedtime,
    recommendedWakeTime: formatClockMinutes(wakeMinutes),
    recommendedTimeInBedMinutes,
    safetyFloorMinutes: SAFETY_FLOOR_MINUTES,
    adjustmentMinutes: recommendedTimeInBedMinutes - currentTimeInBedMinutes,
    progressToTargetPercent,
    rationale,
  };
}

export function generateCBTIDiaryEntry(
  entry: SleepEntry,
  factors?: Factor | readonly Factor[] | null,
): CBTIDiaryEntry {
  const factor = resolveFactorForEntry(entry, factors);
  const timeInBedMinutes = calculateDuration(entry.bedtime, entry.wake_time);
  const timeToFallAsleepMinutes =
    entry.sleep_latency_minutes
    ?? (entry.sleep_onset_time
      ? calculateSleepLatency(entry.bedtime, entry.sleep_onset_time)
      : null);
  const wakeAfterSleepOnsetMinutes = Math.max(
    0,
    timeInBedMinutes -
      entry.duration_minutes -
      (timeToFallAsleepMinutes ?? 0),
  );
  const supplements =
    factor?.supplements.map(formatListValue).join(', ') ?? '';

  return {
    date: entry.date,
    bedtime: formatDateTimeClock(entry.bedtime),
    triedToSleep: formatDateTimeClock(entry.bedtime),
    sleepOnset: formatDateTimeClock(entry.sleep_onset_time),
    wakeTime: formatDateTimeClock(entry.wake_time),
    outOfBedTime: formatDateTimeClock(entry.wake_time),
    timeToFallAsleepMinutes,
    timeInBedMinutes,
    totalSleepTimeMinutes: entry.duration_minutes,
    sleepEfficiency: calculateSleepEfficiency(entry),
    numberAwakenings: entry.wake_count,
    wakeAfterSleepOnsetMinutes,
    sleepQuality: entry.quality_rating,
    medicationsSupplements: supplements,
    notes: joinNotes([entry.notes_md, factor?.notes]),
  };
}

export function sortCBTIDiaryEntries(
  entries: readonly SleepEntry[],
): SleepEntry[] {
  return [...entries].sort(compareEntriesOldestFirst);
}
