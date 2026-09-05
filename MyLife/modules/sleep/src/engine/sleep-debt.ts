import {
  addCalendarDays,
  getCalendarDateRangeBounds,
  roundNumber,
  type SleepAnalyticsDateRange,
  type SleepAnalyticsEntry,
} from './analytics';

export interface SleepDebtTrendPoint {
  date: string;
  targetHours: number;
  durationHours: number | null;
  dailyDebtHours: number | null;
  cumulativeDebtHours: number;
}

export interface SleepDebtRecoveryEstimate {
  currentDebtHours: number;
  nightlySurplusHours: number;
  nightsToRecover: number;
}

function normalizeTargetHours(targetHours: number): number {
  return Number.isFinite(targetHours) && targetHours > 0 ? targetHours : 8;
}

function getEntryForDate(
  entries: readonly SleepAnalyticsEntry[],
  date: string,
): SleepAnalyticsEntry | null {
  return buildEntryByDateMap(entries).get(date) ?? null;
}

function isNewerEntry(
  candidate: SleepAnalyticsEntry,
  current: SleepAnalyticsEntry,
): boolean {
  if (candidate.wake_time !== current.wake_time) {
    return candidate.wake_time > current.wake_time;
  }
  if (candidate.created_at !== current.created_at) {
    return candidate.created_at > current.created_at;
  }
  return candidate.id < current.id;
}

function buildEntryByDateMap(
  entries: readonly SleepAnalyticsEntry[],
): Map<string, SleepAnalyticsEntry> {
  const byDate = new Map<string, SleepAnalyticsEntry>();

  for (const entry of entries) {
    const current = byDate.get(entry.date);
    if (!current || isNewerEntry(entry, current)) {
      byDate.set(entry.date, entry);
    }
  }

  return byDate;
}

function getTrendBounds(
  entries: readonly SleepAnalyticsEntry[],
  dateRange: SleepAnalyticsDateRange,
): { startDate: string; endDate: string } | null {
  const bounds = getCalendarDateRangeBounds(entries, dateRange);
  if (bounds) {
    return bounds;
  }

  if (dateRange.startDate && !dateRange.endDate) {
    return {
      startDate: dateRange.startDate,
      endDate: dateRange.startDate,
    };
  }
  if (!dateRange.startDate && dateRange.endDate) {
    return {
      startDate: dateRange.endDate,
      endDate: dateRange.endDate,
    };
  }

  return null;
}

export function getDailyDebt(
  entries: readonly SleepAnalyticsEntry[],
  date: string,
  targetHours = 8,
): number | null {
  const entry = getEntryForDate(entries, date);
  if (!entry) {
    return null;
  }

  const actualHours = entry.duration_minutes / 60;
  return roundNumber(normalizeTargetHours(targetHours) - actualHours, 2);
}

export function getDebtTrend(
  entries: readonly SleepAnalyticsEntry[],
  dateRange: SleepAnalyticsDateRange = {},
  targetHours = 8,
): SleepDebtTrendPoint[] {
  const bounds = getTrendBounds(entries, dateRange);
  if (!bounds) {
    return [];
  }

  const normalizedTarget = normalizeTargetHours(targetHours);
  const trend: SleepDebtTrendPoint[] = [];
  const entryByDate = buildEntryByDateMap(entries);
  let date = bounds.startDate;
  let cumulativeDebtHours = 0;

  while (date <= bounds.endDate) {
    const entry = entryByDate.get(date) ?? null;
    const durationHours = entry
      ? roundNumber(entry.duration_minutes / 60, 2)
      : null;
    const dailyDebtHours = durationHours !== null
      ? roundNumber(normalizedTarget - durationHours, 2)
      : null;

    if (dailyDebtHours !== null) {
      cumulativeDebtHours = Math.max(
        0,
        roundNumber(cumulativeDebtHours + dailyDebtHours, 2),
      );
    }

    trend.push({
      date,
      targetHours: normalizedTarget,
      durationHours,
      dailyDebtHours,
      cumulativeDebtHours,
    });
    date = addCalendarDays(date, 1);
  }

  return trend;
}

export function calculateSleepDebt(
  entries: readonly SleepAnalyticsEntry[],
  dateRange: SleepAnalyticsDateRange = {},
  targetHours = 8,
): number {
  const trend = getDebtTrend(entries, dateRange, targetHours);
  return trend[trend.length - 1]?.cumulativeDebtHours ?? 0;
}

export function getRecoveryEstimate(
  currentDebtHours: number,
  nightlySurplusHours = 1,
): SleepDebtRecoveryEstimate {
  const debt = Math.max(0, roundNumber(currentDebtHours, 2));
  const surplus =
    Number.isFinite(nightlySurplusHours) && nightlySurplusHours > 0
      ? nightlySurplusHours
      : 1;

  return {
    currentDebtHours: debt,
    nightlySurplusHours: surplus,
    nightsToRecover: debt === 0 ? 0 : Math.ceil(debt / surplus),
  };
}
