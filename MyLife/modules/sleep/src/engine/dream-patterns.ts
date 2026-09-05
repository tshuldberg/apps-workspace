import { z } from 'zod';
import { SleepDateSchema } from '../models/schemas';
import type {
  Dream,
  DreamType,
} from '../models/dream-schemas';
import {
  getDreamExcerpt,
  getRecurringDreamGroupId,
} from './dream-presentation';
import { getSleepWeekStart } from './timeline';

const DREAM_TYPES = [
  'normal',
  'vivid',
  'nightmare',
  'lucid',
  'recurring',
] as const satisfies readonly DreamType[];

const MAX_DICTIONARY_EXCERPTS = 2;

export const DREAM_DICTIONARY_NOTES_SETTING_KEY = 'dream.dictionaryNotes';

export const DreamPatternDateRangeSchema = z
  .object({
    startDate: SleepDateSchema.optional(),
    endDate: SleepDateSchema.optional(),
  })
  .refine(
    (value) =>
      !value.startDate ||
      !value.endDate ||
      value.startDate <= value.endDate,
    'startDate must be on or before endDate',
  );

export type DreamPatternDateRange = z.infer<typeof DreamPatternDateRangeSchema>;

export interface DreamThemeFrequencyItem {
  theme: string;
  count: number;
}

export interface DreamEmotionDistributionItem {
  emotion: string;
  count: number;
  percentage: number;
}

export interface DreamTypeDistributionItem {
  type: DreamType;
  count: number;
  percentage: number;
}

export interface DreamRateSummary {
  count: number;
  total: number;
  percentage: number;
}

export interface DreamTrendPoint {
  weekStart: string;
  label: string;
  totalDreams: number;
  lucidCount: number;
  lucidRate: number;
  nightmareCount: number;
  nightmareRate: number;
}

export interface RecurringDreamSummaryItem {
  groupId: string;
  frequency: number;
  firstOccurrence: string;
  lastOccurrence: string;
  themes: string[];
  emotions: string[];
  exampleExcerpts: string[];
  latestDreamId: string;
}

export interface DreamEmotionCountItem {
  emotion: string;
  count: number;
}

export type DreamDictionaryNotesMap = Record<string, string>;

export interface DreamDictionaryEntry {
  theme: string;
  count: number;
  firstOccurrence: string;
  lastOccurrence: string;
  associatedEmotions: string[];
  emotionCounts: DreamEmotionCountItem[];
  exampleExcerpts: string[];
  latestDreamId: string;
  note: string | null;
}

export type DreamDictionarySort = 'frequency' | 'recency' | 'alphabetical';

export interface DreamPatternDashboard {
  totalDreams: number;
  dreamsPerWeekAverage: number;
  typeDistribution: DreamTypeDistributionItem[];
  topThemes: DreamThemeFrequencyItem[];
  mostCommonEmotions: DreamEmotionDistributionItem[];
  lucidRate: DreamRateSummary;
  nightmareRate: DreamRateSummary;
  lucidTrend: DreamTrendPoint[];
  nightmareTrend: DreamTrendPoint[];
  recurringGroups: RecurringDreamSummaryItem[];
}

function normalizeComparable(value: string | null | undefined): string {
  return value?.trim().toLocaleLowerCase() ?? '';
}

function parseCalendarDate(date: string): Date {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0));
}

function compareDreamsNewestFirst(a: Dream, b: Dream): number {
  if (a.date !== b.date) {
    return a.date < b.date ? 1 : -1;
  }
  if (a.created_at !== b.created_at) {
    return a.created_at < b.created_at ? 1 : -1;
  }
  return a.id.localeCompare(b.id);
}

function roundPercentage(count: number, total: number): number {
  if (count <= 0 || total <= 0) {
    return 0;
  }
  return Number(((count / total) * 100).toFixed(1));
}

function roundToTenths(value: number): number {
  return Number(value.toFixed(1));
}

function sortCountEntries(
  counts: Map<string, number>,
): Array<{ value: string; count: number }> {
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => {
      if (a.count !== b.count) {
        return b.count - a.count;
      }
      return a.value.localeCompare(b.value);
    });
}

function filterDreamsByDateRange(
  dreams: Dream[],
  rawDateRange?: DreamPatternDateRange,
): Dream[] {
  const dateRange = DreamPatternDateRangeSchema.parse(rawDateRange ?? {});

  return dreams.filter((dream) => {
    if (dateRange.startDate && dream.date < dateRange.startDate) {
      return false;
    }
    if (dateRange.endDate && dream.date > dateRange.endDate) {
      return false;
    }
    return true;
  });
}

function isLucidDream(dream: Dream): boolean {
  return dream.is_lucid || dream.type === 'lucid';
}

function isNightmareDream(dream: Dream): boolean {
  return dream.type === 'nightmare';
}

function getWeekLabel(weekStart: string): string {
  return parseCalendarDate(weekStart).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

function getExampleExcerpts(
  dreams: Dream[],
  limit: number = MAX_DICTIONARY_EXCERPTS,
): string[] {
  const excerpts: string[] = [];

  for (const dream of [...dreams].sort(compareDreamsNewestFirst)) {
    const excerpt = getDreamExcerpt(dream.content_md, 110);
    if (!excerpt || excerpts.includes(excerpt)) {
      continue;
    }

    excerpts.push(excerpt);
    if (excerpts.length >= limit) {
      break;
    }
  }

  return excerpts;
}

function getEmotionCountsForDreams(
  dreams: Dream[],
): DreamEmotionCountItem[] {
  const counts = new Map<string, number>();

  for (const dream of dreams) {
    for (const emotion of dream.emotions) {
      const key = normalizeComparable(emotion);
      if (!key) {
        continue;
      }
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }

  return sortCountEntries(counts).map(({ value, count }) => ({
    emotion: value,
    count,
  }));
}

function compareDreamDictionaryByFrequency(
  a: DreamDictionaryEntry,
  b: DreamDictionaryEntry,
): number {
  if (a.count !== b.count) {
    return b.count - a.count;
  }
  if (a.lastOccurrence !== b.lastOccurrence) {
    return a.lastOccurrence < b.lastOccurrence ? 1 : -1;
  }
  return a.theme.localeCompare(b.theme);
}

function compareDreamDictionaryByRecency(
  a: DreamDictionaryEntry,
  b: DreamDictionaryEntry,
): number {
  if (a.lastOccurrence !== b.lastOccurrence) {
    return a.lastOccurrence < b.lastOccurrence ? 1 : -1;
  }
  if (a.count !== b.count) {
    return b.count - a.count;
  }
  return a.theme.localeCompare(b.theme);
}

export function getThemeFrequency(
  dreams: Dream[],
  dateRange?: DreamPatternDateRange,
): DreamThemeFrequencyItem[] {
  const counts = new Map<string, number>();

  for (const dream of filterDreamsByDateRange(dreams, dateRange)) {
    for (const theme of dream.themes) {
      const key = normalizeComparable(theme);
      if (!key) {
        continue;
      }
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }

  return sortCountEntries(counts).map(({ value, count }) => ({
    theme: value,
    count,
  }));
}

export function getEmotionDistribution(
  dreams: Dream[],
  dateRange?: DreamPatternDateRange,
): DreamEmotionDistributionItem[] {
  const filtered = filterDreamsByDateRange(dreams, dateRange);
  const counts = getEmotionCountsForDreams(filtered);
  const totalEmotionTags = counts.reduce((sum, item) => sum + item.count, 0);

  return counts.map((item) => ({
    emotion: item.emotion,
    count: item.count,
    percentage: roundPercentage(item.count, totalEmotionTags),
  }));
}

export function getRecurringDreamSummary(
  dreams: Dream[],
): RecurringDreamSummaryItem[] {
  const groups = new Map<string, Dream[]>();

  for (const dream of dreams) {
    const groupId = getRecurringDreamGroupId(dream);
    if (!groupId) {
      continue;
    }

    const bucket = groups.get(groupId);
    if (bucket) {
      bucket.push(dream);
    } else {
      groups.set(groupId, [dream]);
    }
  }

  return [...groups.entries()]
    .map(([groupId, groupDreams]) => {
      const sortedByNewest = [...groupDreams].sort(compareDreamsNewestFirst);
      const sortedByOldest = [...sortedByNewest].reverse();
      const latestDream = sortedByNewest[0];
      const themeCounts = getThemeFrequency(groupDreams).slice(0, 3);
      const emotionCounts = getEmotionCountsForDreams(groupDreams).slice(0, 3);

      return {
        groupId,
        frequency: groupDreams.length,
        firstOccurrence: sortedByOldest[0]?.date ?? latestDream.date,
        lastOccurrence: latestDream.date,
        themes: themeCounts.map((item) => item.theme),
        emotions: emotionCounts.map((item) => item.emotion),
        exampleExcerpts: getExampleExcerpts(groupDreams),
        latestDreamId: latestDream.id,
      };
    })
    .sort((a, b) => {
      if (a.frequency !== b.frequency) {
        return b.frequency - a.frequency;
      }
      if (a.lastOccurrence !== b.lastOccurrence) {
        return a.lastOccurrence < b.lastOccurrence ? 1 : -1;
      }
      return a.groupId.localeCompare(b.groupId);
    });
}

export function getLucidDreamRate(
  dreams: Dream[],
  dateRange?: DreamPatternDateRange,
): DreamRateSummary {
  const filtered = filterDreamsByDateRange(dreams, dateRange);
  const count = filtered.reduce((sum, dream) => {
    return sum + (isLucidDream(dream) ? 1 : 0);
  }, 0);

  return {
    count,
    total: filtered.length,
    percentage: roundPercentage(count, filtered.length),
  };
}

export function getNightmareRate(
  dreams: Dream[],
  dateRange?: DreamPatternDateRange,
): DreamRateSummary {
  const filtered = filterDreamsByDateRange(dreams, dateRange);
  const count = filtered.reduce((sum, dream) => {
    return sum + (isNightmareDream(dream) ? 1 : 0);
  }, 0);

  return {
    count,
    total: filtered.length,
    percentage: roundPercentage(count, filtered.length),
  };
}

export function getDreamDictionary(
  dreams: Dream[],
  notesByTheme: DreamDictionaryNotesMap = {},
): DreamDictionaryEntry[] {
  const grouped = new Map<string, Dream[]>();

  for (const dream of dreams) {
    for (const theme of dream.themes) {
      const key = normalizeComparable(theme);
      if (!key) {
        continue;
      }

      const bucket = grouped.get(key);
      if (bucket) {
        bucket.push(dream);
      } else {
        grouped.set(key, [dream]);
      }
    }
  }

  const normalizedNotes = parseDreamDictionaryNotes(notesByTheme);

  return [...grouped.entries()]
    .map(([theme, themeDreams]) => {
      const sortedByNewest = [...themeDreams].sort(compareDreamsNewestFirst);
      const latestDream = sortedByNewest[0];
      const oldestDream = sortedByNewest[sortedByNewest.length - 1];
      const emotionCounts = getEmotionCountsForDreams(themeDreams);

      return {
        theme,
        count: themeDreams.length,
        firstOccurrence: oldestDream?.date ?? latestDream.date,
        lastOccurrence: latestDream.date,
        associatedEmotions: emotionCounts
          .slice(0, 3)
          .map((item) => item.emotion),
        emotionCounts,
        exampleExcerpts: getExampleExcerpts(themeDreams),
        latestDreamId: latestDream.id,
        note: normalizedNotes[theme] ?? null,
      };
    })
    .sort(compareDreamDictionaryByFrequency);
}

export function getDreamTypeDistribution(
  dreams: Dream[],
  dateRange?: DreamPatternDateRange,
): DreamTypeDistributionItem[] {
  const filtered = filterDreamsByDateRange(dreams, dateRange);
  const counts = new Map<DreamType, number>();

  for (const type of DREAM_TYPES) {
    counts.set(type, 0);
  }

  for (const dream of filtered) {
    counts.set(dream.type, (counts.get(dream.type) ?? 0) + 1);
  }

  return DREAM_TYPES.map((type) => ({
    type,
    count: counts.get(type) ?? 0,
    percentage: roundPercentage(counts.get(type) ?? 0, filtered.length),
  }));
}

export function getDreamsPerWeekAverage(dreams: Dream[]): number {
  if (dreams.length === 0) {
    return 0;
  }

  const sortedDates = [...dreams]
    .map((dream) => dream.date)
    .sort((a, b) => a.localeCompare(b));
  const earliest = parseCalendarDate(sortedDates[0]);
  const latest = parseCalendarDate(sortedDates[sortedDates.length - 1]);
  const spanDays =
    Math.floor((latest.getTime() - earliest.getTime()) / (24 * 60 * 60 * 1000)) +
    1;
  const weekCount = Math.max(1, Math.ceil(spanDays / 7));

  return roundToTenths(dreams.length / weekCount);
}

export function getDreamRateTrend(
  dreams: Dream[],
): DreamTrendPoint[] {
  const weekBuckets = new Map<string, Dream[]>();

  for (const dream of dreams) {
    const weekStart = getSleepWeekStart(dream.date);
    const bucket = weekBuckets.get(weekStart);
    if (bucket) {
      bucket.push(dream);
    } else {
      weekBuckets.set(weekStart, [dream]);
    }
  }

  return [...weekBuckets.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([weekStart, weekDreams]) => {
      const lucid = getLucidDreamRate(weekDreams);
      const nightmare = getNightmareRate(weekDreams);

      return {
        weekStart,
        label: getWeekLabel(weekStart),
        totalDreams: weekDreams.length,
        lucidCount: lucid.count,
        lucidRate: lucid.percentage,
        nightmareCount: nightmare.count,
        nightmareRate: nightmare.percentage,
      };
    });
}

export function getDreamPatternDashboard(
  dreams: Dream[],
): DreamPatternDashboard {
  const trend = getDreamRateTrend(dreams);

  return {
    totalDreams: dreams.length,
    dreamsPerWeekAverage: getDreamsPerWeekAverage(dreams),
    typeDistribution: getDreamTypeDistribution(dreams),
    topThemes: getThemeFrequency(dreams).slice(0, 5),
    mostCommonEmotions: getEmotionDistribution(dreams).slice(0, 5),
    lucidRate: getLucidDreamRate(dreams),
    nightmareRate: getNightmareRate(dreams),
    lucidTrend: trend,
    nightmareTrend: trend,
    recurringGroups: getRecurringDreamSummary(dreams),
  };
}

export function searchDreamDictionary(
  entries: DreamDictionaryEntry[],
  query: string,
): DreamDictionaryEntry[] {
  const tokens = query
    .trim()
    .toLocaleLowerCase()
    .split(/\s+/)
    .filter(Boolean);

  if (tokens.length === 0) {
    return entries;
  }

  return entries.filter((entry) => {
    const haystack = [
      entry.theme,
      entry.note ?? '',
      entry.associatedEmotions.join(' '),
      entry.exampleExcerpts.join(' '),
    ]
      .join(' ')
      .toLocaleLowerCase();

    return tokens.every((token) => haystack.includes(token));
  });
}

export function sortDreamDictionary(
  entries: DreamDictionaryEntry[],
  sort: DreamDictionarySort,
): DreamDictionaryEntry[] {
  const sorted = [...entries];

  switch (sort) {
    case 'alphabetical':
      return sorted.sort((a, b) => a.theme.localeCompare(b.theme));
    case 'recency':
      return sorted.sort(compareDreamDictionaryByRecency);
    case 'frequency':
    default:
      return sorted.sort(compareDreamDictionaryByFrequency);
  }
}

export function parseDreamDictionaryNotes(
  raw: unknown,
): DreamDictionaryNotesMap {
  if (!raw) {
    return {};
  }

  const input =
    typeof raw === 'string'
      ? (() => {
          try {
            return JSON.parse(raw) as unknown;
          } catch {
            return {};
          }
        })()
      : raw;

  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return {};
  }

  const notes: DreamDictionaryNotesMap = {};

  for (const [theme, note] of Object.entries(input)) {
    const normalizedTheme = normalizeComparable(theme);
    const normalizedNote =
      typeof note === 'string' ? note.trim().replace(/\s+/g, ' ') : '';

    if (!normalizedTheme || !normalizedNote) {
      continue;
    }

    notes[normalizedTheme] = normalizedNote;
  }

  return notes;
}

export function serializeDreamDictionaryNotes(
  notes: DreamDictionaryNotesMap,
): string {
  const normalized = parseDreamDictionaryNotes(notes);
  const sortedEntries = Object.entries(normalized).sort(([a], [b]) =>
    a.localeCompare(b),
  );

  return JSON.stringify(Object.fromEntries(sortedEntries));
}

export function updateDreamDictionaryNotesMap(
  current: DreamDictionaryNotesMap,
  theme: string,
  note: string | null | undefined,
): DreamDictionaryNotesMap {
  const normalized = parseDreamDictionaryNotes(current);
  const normalizedTheme = normalizeComparable(theme);
  const normalizedNote = note?.trim().replace(/\s+/g, ' ') ?? '';

  if (!normalizedTheme) {
    return normalized;
  }

  if (!normalizedNote) {
    delete normalized[normalizedTheme];
    return normalized;
  }

  normalized[normalizedTheme] = normalizedNote;
  return normalized;
}
