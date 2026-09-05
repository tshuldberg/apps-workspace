import type { Dream } from '../models/dream-schemas';
import type {
  SleepStreakHistoryPoint,
  SleepStreakType,
} from '../models/goal-schemas';
import { SLEEP_STREAK_TYPES } from '../models/goal-schemas';
import type { Nap, SleepEntry } from '../models/schemas';
import {
  addCalendarDays,
  getMonthlyAverage,
  roundNumber,
} from './analytics';
import { calculateConsistencyScore } from './consistency';
import {
  getEmotionDistribution,
  getLucidDreamRate,
  getNightmareRate,
  getThemeFrequency,
  type DreamThemeFrequencyItem,
} from './dream-patterns';
import { evaluateStreakType } from './progress';
import { calculateSleepDebt } from './sleep-debt';

export type YearReviewTrend = 'improved' | 'declined' | 'stable';

export interface YearReviewInput {
  entries?: readonly SleepEntry[];
  dreams?: readonly Dream[];
  naps?: readonly Nap[];
  streakHistory?: readonly SleepStreakHistoryPoint[];
  targetHours?: number;
  targetBedtime?: string;
  minPriorYearNights?: number;
}

export interface YearReviewMonthStats {
  month: number;
  label: string;
  totalNights: number;
  totalHours: number;
  avgQuality: number | null;
  avgDuration: number | null;
}

export interface YearReviewMonthHighlight {
  month: number | null;
  label: string | null;
  totalNights: number;
  avgQuality: number | null;
  avgDuration: number | null;
}

export interface YearReviewLongestStreak {
  type: SleepStreakType | 'none';
  count: number;
  startDate: string | null;
  endDate: string | null;
}

export interface YearReviewDreamStats {
  total: number;
  lucidCount: number;
  nightmareCount: number;
  topThemes: DreamThemeFrequencyItem[];
  mostCommonEmotion: string | null;
}

export interface YearReviewImprovementMetric {
  startQuality: number | null;
  endQuality: number | null;
  trend: YearReviewTrend;
}

export interface YearReviewComparison {
  priorYear: number;
  sampleSize: number;
  totalHoursDelta: number;
  totalNightsDelta: number;
  averageDurationDelta: number | null;
  averageQualityDelta: number | null;
  trend: YearReviewTrend;
}

export interface YearReview {
  year: number;
  startDate: string;
  endDate: string;
  totalHoursSlept: number;
  totalNights: number;
  averageDuration: number | null;
  averageQuality: number | null;
  bestMonth: YearReviewMonthHighlight;
  worstMonth: YearReviewMonthHighlight;
  longestStreak: YearReviewLongestStreak;
  consistencyScore: number;
  sleepDebtTotal: number;
  dreamStats: YearReviewDreamStats;
  improvementMetric: YearReviewImprovementMetric;
  totalNaps: number;
  funFacts: string[];
  monthlyStats: YearReviewMonthStats[];
  comparison: YearReviewComparison | null;
}

interface StreakCandidate {
  type: SleepStreakType;
  count: number;
  startDate: string | null;
  endDate: string | null;
}

interface BasicYearSummary {
  totalHoursSlept: number;
  totalNights: number;
  averageDuration: number | null;
  averageQuality: number | null;
}

const MONTH_LABELS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

const DEFAULT_TARGET_HOURS = 8;
const DEFAULT_MIN_PRIOR_YEAR_NIGHTS = 14;
const TREND_THRESHOLD = 0.25;

function assertYear(year: number): void {
  if (!Number.isInteger(year) || year < 1 || year > 9999) {
    throw new Error('year must be an integer from 1 to 9999');
  }
}

function formatYear(year: number): string {
  return String(year).padStart(4, '0');
}

function getYearBounds(year: number): { startDate: string; endDate: string } {
  const label = formatYear(year);
  return {
    startDate: `${label}-01-01`,
    endDate: `${label}-12-31`,
  };
}

function isWithinDateRange(
  date: string,
  startDate: string,
  endDate: string,
): boolean {
  return date >= startDate && date <= endDate;
}

function filterEntriesForYear(
  entries: readonly SleepEntry[],
  year: number,
): SleepEntry[] {
  const { startDate, endDate } = getYearBounds(year);
  return entries.filter((entry) =>
    isWithinDateRange(entry.date, startDate, endDate),
  );
}

function filterDreamsForYear(
  dreams: readonly Dream[],
  year: number,
): Dream[] {
  const { startDate, endDate } = getYearBounds(year);
  return dreams.filter((dream) =>
    isWithinDateRange(dream.date, startDate, endDate),
  );
}

function filterNapsForYear(naps: readonly Nap[], year: number): Nap[] {
  const { startDate, endDate } = getYearBounds(year);
  return naps.filter((nap) => isWithinDateRange(nap.date, startDate, endDate));
}

function normalizeTargetHours(value: number | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value
    : DEFAULT_TARGET_HOURS;
}

function average(values: readonly number[], decimals = 2): number | null {
  if (values.length === 0) {
    return null;
  }

  return roundNumber(
    values.reduce((sum, value) => sum + value, 0) / values.length,
    decimals,
  );
}

function summarizeBasic(entries: readonly SleepEntry[]): BasicYearSummary {
  const totalMinutes = entries.reduce(
    (sum, entry) => sum + entry.duration_minutes,
    0,
  );
  const averageDurationMinutes = average(
    entries.map((entry) => entry.duration_minutes),
    0,
  );

  return {
    totalHoursSlept: roundNumber(totalMinutes / 60, 1),
    totalNights: entries.length,
    averageDuration:
      averageDurationMinutes === null
        ? null
        : roundNumber(averageDurationMinutes / 60, 2),
    averageQuality: average(
      entries.map((entry) => entry.quality_rating),
      2,
    ),
  };
}

function getMonthTotalHours(
  entries: readonly SleepEntry[],
  month: number,
): number {
  const monthPrefix = `${String(month).padStart(2, '0')}`;
  const totalMinutes = entries
    .filter((entry) => entry.date.slice(5, 7) === monthPrefix)
    .reduce((sum, entry) => sum + entry.duration_minutes, 0);

  return roundNumber(totalMinutes / 60, 1);
}

function getMonthlyStats(
  entries: readonly SleepEntry[],
  year: number,
  targetHours: number,
): YearReviewMonthStats[] {
  return MONTH_LABELS.map((label, index) => {
    const month = index + 1;
    const summary = getMonthlyAverage(entries, month, year, targetHours);

    return {
      month,
      label,
      totalNights: summary.totalNights,
      totalHours: getMonthTotalHours(entries, month),
      avgQuality: summary.avgQualityRating,
      avgDuration: summary.avgDurationHours,
    };
  });
}

function monthToHighlight(
  month: YearReviewMonthStats | undefined,
): YearReviewMonthHighlight {
  if (!month) {
    return {
      month: null,
      label: null,
      totalNights: 0,
      avgQuality: null,
      avgDuration: null,
    };
  }

  return {
    month: month.month,
    label: month.label,
    totalNights: month.totalNights,
    avgQuality: month.avgQuality,
    avgDuration: month.avgDuration,
  };
}

function compareBestMonth(
  a: YearReviewMonthStats,
  b: YearReviewMonthStats,
): number {
  if (a.avgQuality !== b.avgQuality) {
    return (b.avgQuality ?? 0) - (a.avgQuality ?? 0);
  }
  if (a.avgDuration !== b.avgDuration) {
    return (b.avgDuration ?? 0) - (a.avgDuration ?? 0);
  }
  if (a.totalNights !== b.totalNights) {
    return b.totalNights - a.totalNights;
  }
  return a.month - b.month;
}

function compareWorstMonth(
  a: YearReviewMonthStats,
  b: YearReviewMonthStats,
): number {
  if (a.avgQuality !== b.avgQuality) {
    return (a.avgQuality ?? 0) - (b.avgQuality ?? 0);
  }
  if (a.avgDuration !== b.avgDuration) {
    return (a.avgDuration ?? 0) - (b.avgDuration ?? 0);
  }
  if (a.totalNights !== b.totalNights) {
    return b.totalNights - a.totalNights;
  }
  return a.month - b.month;
}

function getMonthHighlights(months: readonly YearReviewMonthStats[]): {
  bestMonth: YearReviewMonthHighlight;
  worstMonth: YearReviewMonthHighlight;
} {
  const populated = months.filter((month) => month.totalNights > 0);

  return {
    bestMonth: monthToHighlight([...populated].sort(compareBestMonth)[0]),
    worstMonth: monthToHighlight([...populated].sort(compareWorstMonth)[0]),
  };
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

function getLatestEntriesByDate(
  entries: readonly SleepEntry[],
): SleepEntry[] {
  const byDate = new Map<string, SleepEntry>();

  for (const entry of entries) {
    const current = byDate.get(entry.date);
    if (!current || isNewerEntry(entry, current)) {
      byDate.set(entry.date, entry);
    }
  }

  return [...byDate.values()].sort(compareEntriesOldestFirst);
}

function compareStreakCandidate(
  a: StreakCandidate,
  b: StreakCandidate,
): number {
  if (a.count !== b.count) {
    return b.count - a.count;
  }
  if (a.endDate !== b.endDate) {
    return (b.endDate ?? '').localeCompare(a.endDate ?? '');
  }
  return a.type.localeCompare(b.type);
}

function getEmptyStreakCandidate(type: SleepStreakType): StreakCandidate {
  return {
    type,
    count: 0,
    startDate: null,
    endDate: null,
  };
}

function deriveStreakFromEntries(
  entries: readonly SleepEntry[],
  type: SleepStreakType,
  targetHours: number,
  targetBedtime: string | undefined,
): StreakCandidate {
  let currentCount = 0;
  let currentStartDate: string | null = null;
  let previousMetDate: string | null = null;
  let best = getEmptyStreakCandidate(type);

  for (const entry of getLatestEntriesByDate(entries)) {
    const met = evaluateStreakType(entry, type, {
      targetHours,
      targetBedtime,
    });
    const consecutive =
      previousMetDate !== null && addCalendarDays(previousMetDate, 1) === entry.date;

    if (met) {
      if (!consecutive) {
        currentCount = 1;
        currentStartDate = entry.date;
      } else {
        currentCount += 1;
      }
      previousMetDate = entry.date;

      if (currentCount > best.count) {
        best = {
          type,
          count: currentCount,
          startDate: currentStartDate,
          endDate: entry.date,
        };
      }
    } else {
      currentCount = 0;
      currentStartDate = null;
      previousMetDate = null;
    }
  }

  return best;
}

function deriveStreakFromHistory(
  history: readonly SleepStreakHistoryPoint[],
  type: SleepStreakType,
): StreakCandidate {
  const sorted = history
    .filter((point) => point.type === type)
    .sort((a, b) => a.date.localeCompare(b.date));
  let currentCount = 0;
  let currentStartDate: string | null = null;
  let previousMetDate: string | null = null;
  let best = getEmptyStreakCandidate(type);

  for (const point of sorted) {
    const consecutive =
      previousMetDate !== null && addCalendarDays(previousMetDate, 1) === point.date;

    if (point.met) {
      if (!consecutive) {
        currentCount = 1;
        currentStartDate = point.date;
      } else {
        currentCount += 1;
      }
      previousMetDate = point.date;

      if (currentCount > best.count) {
        best = {
          type,
          count: currentCount,
          startDate: currentStartDate,
          endDate: point.date,
        };
      }
    } else {
      currentCount = 0;
      currentStartDate = null;
      previousMetDate = null;
    }
  }

  return best;
}

function getLongestStreak(
  entries: readonly SleepEntry[],
  streakHistory: readonly SleepStreakHistoryPoint[],
  year: number,
  targetHours: number,
  targetBedtime: string | undefined,
): YearReviewLongestStreak {
  const { startDate, endDate } = getYearBounds(year);
  const yearHistory = streakHistory.filter((point) =>
    isWithinDateRange(point.date, startDate, endDate),
  );
  const candidates: StreakCandidate[] = [];

  for (const type of SLEEP_STREAK_TYPES) {
    candidates.push(
      deriveStreakFromEntries(entries, type, targetHours, targetBedtime),
    );
    if (yearHistory.length > 0) {
      candidates.push(deriveStreakFromHistory(yearHistory, type));
    }
  }

  const best = candidates.sort(compareStreakCandidate)[0];
  if (!best || best.count === 0) {
    return {
      type: 'none',
      count: 0,
      startDate: null,
      endDate: null,
    };
  }

  return best;
}

function getDreamStats(dreams: Dream[]): YearReviewDreamStats {
  const lucid = getLucidDreamRate(dreams);
  const nightmare = getNightmareRate(dreams);
  const emotions = getEmotionDistribution(dreams);

  return {
    total: dreams.length,
    lucidCount: lucid.count,
    nightmareCount: nightmare.count,
    topThemes: getThemeFrequency(dreams).slice(0, 5),
    mostCommonEmotion: emotions[0]?.emotion ?? null,
  };
}

function getImprovementMetric(
  entries: readonly SleepEntry[],
): YearReviewImprovementMetric {
  if (entries.length === 0) {
    return {
      startQuality: null,
      endQuality: null,
      trend: 'stable',
    };
  }

  const sorted = [...entries].sort(compareEntriesOldestFirst);
  const sampleSize = Math.max(
    1,
    Math.min(30, Math.ceil(sorted.length * 0.25)),
  );
  const startQuality = average(
    sorted.slice(0, sampleSize).map((entry) => entry.quality_rating),
    2,
  );
  const endQuality = average(
    sorted.slice(-sampleSize).map((entry) => entry.quality_rating),
    2,
  );
  const delta =
    startQuality === null || endQuality === null ? 0 : endQuality - startQuality;

  return {
    startQuality,
    endQuality,
    trend: getTrendFromDelta(delta),
  };
}

function getTrendFromDelta(delta: number | null): YearReviewTrend {
  if (delta === null || Math.abs(delta) < TREND_THRESHOLD) {
    return 'stable';
  }

  return delta > 0 ? 'improved' : 'declined';
}

function getComparison(
  current: BasicYearSummary,
  priorEntries: readonly SleepEntry[],
  priorYear: number,
  minPriorYearNights: number,
): YearReviewComparison | null {
  if (priorEntries.length < minPriorYearNights) {
    return null;
  }

  const prior = summarizeBasic(priorEntries);
  const averageQualityDelta =
    current.averageQuality === null || prior.averageQuality === null
      ? null
      : roundNumber(current.averageQuality - prior.averageQuality, 2);
  const averageDurationDelta =
    current.averageDuration === null || prior.averageDuration === null
      ? null
      : roundNumber(current.averageDuration - prior.averageDuration, 2);

  return {
    priorYear,
    sampleSize: priorEntries.length,
    totalHoursDelta: roundNumber(
      current.totalHoursSlept - prior.totalHoursSlept,
      1,
    ),
    totalNightsDelta: current.totalNights - prior.totalNights,
    averageDurationDelta,
    averageQualityDelta,
    trend: getTrendFromDelta(averageQualityDelta),
  };
}

function formatQuality(value: number | null): string {
  return value === null ? 'unrated' : `${value.toFixed(1)}/5`;
}

function getFunFacts(
  reviewBase: {
    totalHoursSlept: number;
    totalNights: number;
    averageQuality: number | null;
    bestMonth: YearReviewMonthHighlight;
    longestStreak: YearReviewLongestStreak;
    dreamStats: YearReviewDreamStats;
    totalNaps: number;
  },
): string[] {
  const facts: string[] = [];

  if (reviewBase.totalNights === 0) {
    return [
      'Log sleep through the year to unlock your annual sleep story.',
      'MySleep can build the review from partial-year data as soon as one night is saved.',
    ];
  }

  const sleptDays = reviewBase.totalHoursSlept / 24;
  facts.push(
    `You slept the equivalent of ${roundNumber(sleptDays, 1)} full days this year.`,
  );
  facts.push(
    `You logged ${reviewBase.totalNights} nights with an average quality of ${formatQuality(reviewBase.averageQuality)}.`,
  );

  if (reviewBase.bestMonth.label) {
    facts.push(
      `${reviewBase.bestMonth.label} was your strongest month at ${formatQuality(reviewBase.bestMonth.avgQuality)} average quality.`,
    );
  }

  if (reviewBase.longestStreak.count > 0) {
    facts.push(
      `Your best streak lasted ${reviewBase.longestStreak.count} nights.`,
    );
  }

  if (reviewBase.dreamStats.total > 0) {
    facts.push(
      `You recorded ${reviewBase.dreamStats.total} dreams, including ${reviewBase.dreamStats.lucidCount} lucid dreams.`,
    );
  }

  if (reviewBase.totalNaps > 0) {
    facts.push(`You tracked ${reviewBase.totalNaps} naps alongside nightly sleep.`);
  }

  return facts.slice(0, 6);
}

export function generateYearReview(
  year: number,
  input: YearReviewInput = {},
): YearReview {
  assertYear(year);

  const targetHours = normalizeTargetHours(input.targetHours);
  const { startDate, endDate } = getYearBounds(year);
  const entries = filterEntriesForYear(input.entries ?? [], year);
  const dreams = filterDreamsForYear(input.dreams ?? [], year);
  const naps = filterNapsForYear(input.naps ?? [], year);
  const previousYear = year - 1;
  const priorEntries = filterEntriesForYear(input.entries ?? [], previousYear);
  const basic = summarizeBasic(entries);
  const monthlyStats = getMonthlyStats(entries, year, targetHours);
  const { bestMonth, worstMonth } = getMonthHighlights(monthlyStats);
  const longestStreak = getLongestStreak(
    entries,
    input.streakHistory ?? [],
    year,
    targetHours,
    input.targetBedtime,
  );
  const dreamStats = getDreamStats(dreams);

  return {
    year,
    startDate,
    endDate,
    ...basic,
    bestMonth,
    worstMonth,
    longestStreak,
    consistencyScore: calculateConsistencyScore(entries, { startDate, endDate }),
    sleepDebtTotal: calculateSleepDebt(entries, { startDate, endDate }, targetHours),
    dreamStats,
    improvementMetric: getImprovementMetric(entries),
    totalNaps: naps.length,
    funFacts: getFunFacts({
      ...basic,
      bestMonth,
      longestStreak,
      dreamStats,
      totalNaps: naps.length,
    }),
    monthlyStats,
    comparison: getComparison(
      basic,
      priorEntries,
      previousYear,
      input.minPriorYearNights ?? DEFAULT_MIN_PRIOR_YEAR_NIGHTS,
    ),
  };
}
