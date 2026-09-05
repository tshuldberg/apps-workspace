import { z } from 'zod';

// ── Types ──

export const ConsistencyTrendSchema = z.enum(['increasing', 'decreasing', 'stable']);
export type ConsistencyTrend = z.infer<typeof ConsistencyTrendSchema>;

export const HabitIntelligenceSchema = z.object({
  consistencyScore7d: z.number().int(),
  consistencyScore30d: z.number().int(),
  entryRichnessAvg: z.number(),
  entryRichnessTrend: ConsistencyTrendSchema,
  bestDayOfWeek: z.string().nullable(),
  bestTimeOfDay: z.string().nullable(),
  promptAdherenceByCategory: z.record(z.string(), z.number()),
});
export type HabitIntelligence = z.infer<typeof HabitIntelligenceSchema>;

// ── Constants ──

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const HOUR_LABELS: Record<string, string> = {
  morning: '6am-12pm',
  afternoon: '12pm-5pm',
  evening: '5pm-9pm',
  night: '9pm-6am',
};

// ── Pure Functions ──

/**
 * Compute a rolling consistency score for a time window.
 * Score = (days with entries / window days) * 100, clamped 0-100.
 * referenceDate is the anchor (usually "today").
 */
export function computeConsistencyScore(
  entryDates: string[],
  windowDays: number,
  referenceDate: string,
): number {
  if (windowDays <= 0) return 0;

  const refMs = new Date(referenceDate).getTime();
  const windowStartMs = refMs - windowDays * 86_400_000;

  const uniqueDaysInWindow = new Set(
    entryDates.filter((d) => {
      const ms = new Date(d).getTime();
      return ms > windowStartMs && ms <= refMs;
    }),
  );

  const score = Math.round((uniqueDaysInWindow.size / windowDays) * 100);
  return Math.min(100, Math.max(0, score));
}

/**
 * Score an individual entry's "richness" based on how many metadata
 * dimensions are filled. Scale 0-100.
 *
 * Scoring: body present (+20), mood set (+15), has tags (+15),
 * has images (+15), has audio (+10), has location (+10), word count > 100 (+15).
 */
export function computeEntryRichness(entry: {
  mood: string | null;
  tags: string[];
  imageUris: string[];
  audioPath: string | null;
  latitude: number | null;
  wordCount: number;
}): number {
  let score = 20; // body is always present (required field)

  if (entry.mood) score += 15;
  if (entry.tags.length > 0) score += 15;
  if (entry.imageUris.length > 0) score += 15;
  if (entry.audioPath) score += 10;
  if (entry.latitude !== null) score += 10;
  if (entry.wordCount > 100) score += 15;

  return Math.min(100, score);
}

/**
 * Compute the trend of entry richness over time.
 * Compares average richness of first half vs second half.
 * Needs 4+ entries to detect a trend.
 */
export function computeEntryRichnessTrend(
  entries: Array<{ date: string; richness: number }>,
): ConsistencyTrend {
  if (entries.length < 4) return 'stable';

  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const mid = Math.floor(sorted.length / 2);

  const avgFirst =
    sorted.slice(0, mid).reduce((s, e) => s + e.richness, 0) / mid;
  const avgSecond =
    sorted.slice(mid).reduce((s, e) => s + e.richness, 0) / (sorted.length - mid);

  const change = avgSecond - avgFirst;
  if (change > 5) return 'increasing';
  if (change < -5) return 'decreasing';
  return 'stable';
}

/**
 * Find the day of the week with the most journal entries.
 * Returns null if no entries.
 */
export function findBestWritingDay(
  entryDates: string[],
): string | null {
  if (entryDates.length === 0) return null;

  const dayCounts = new Array(7).fill(0);

  for (const dateStr of entryDates) {
    // Append T12:00:00 to avoid UTC-midnight timezone boundary issues
    const day = new Date(dateStr + 'T12:00:00').getDay();
    if (!isNaN(day)) dayCounts[day]++;
  }

  const maxCount = Math.max(...dayCounts);
  if (maxCount === 0) return null;

  const bestDay = dayCounts.indexOf(maxCount);
  return DAY_NAMES[bestDay];
}

/**
 * Find the time-of-day bucket with the most journal entries.
 * Buckets: morning (6-12), afternoon (12-17), evening (17-21), night (21-6).
 */
export function findBestWritingTime(
  createdAtTimes: string[],
): string | null {
  if (createdAtTimes.length === 0) return null;

  const buckets: Record<string, number> = {
    morning: 0,
    afternoon: 0,
    evening: 0,
    night: 0,
  };

  for (const ts of createdAtTimes) {
    const match = ts.match(/(\d{2}):\d{2}/);
    if (!match) continue;

    const hour = parseInt(match[1], 10);

    if (hour >= 6 && hour < 12) buckets.morning++;
    else if (hour >= 12 && hour < 17) buckets.afternoon++;
    else if (hour >= 17 && hour < 21) buckets.evening++;
    else buckets.night++;
  }

  const maxBucket = Object.entries(buckets).sort((a, b) => b[1] - a[1])[0];
  if (!maxBucket || maxBucket[1] === 0) return null;

  return HOUR_LABELS[maxBucket[0]];
}

/**
 * Compute prompt adherence by category.
 * For each prompt category, what percentage of days with prompts
 * resulted in a journal entry? Returns a map of category -> 0-1.
 */
export function computePromptAdherence(
  promptsShown: Array<{ category: string; date: string }>,
  entryDates: string[],
): Record<string, number> {
  const entryDateSet = new Set(entryDates);
  const categoryStats = new Map<string, { shown: number; followed: number }>();

  for (const p of promptsShown) {
    const stats = categoryStats.get(p.category) ?? { shown: 0, followed: 0 };
    stats.shown++;
    if (entryDateSet.has(p.date)) stats.followed++;
    categoryStats.set(p.category, stats);
  }

  const result: Record<string, number> = {};
  for (const [category, stats] of categoryStats) {
    result[category] =
      stats.shown > 0
        ? Math.round((stats.followed / stats.shown) * 100) / 100
        : 0;
  }

  return result;
}

/**
 * Aggregate all habit intelligence metrics.
 */
export function computeHabitIntelligence(
  entries: Array<{
    entryDate: string;
    createdAt: string;
    mood: string | null;
    tags: string[];
    imageUris: string[];
    audioPath: string | null;
    latitude: number | null;
    wordCount: number;
  }>,
  referenceDate: string,
  promptsShown?: Array<{ category: string; date: string }>,
): HabitIntelligence {
  const entryDates = entries.map((e) => e.entryDate);
  const richnesses = entries.map((e) => ({
    date: e.entryDate,
    richness: computeEntryRichness(e),
  }));
  const avgRichness =
    richnesses.length > 0
      ? Math.round(richnesses.reduce((s, r) => s + r.richness, 0) / richnesses.length)
      : 0;

  return {
    consistencyScore7d: computeConsistencyScore(entryDates, 7, referenceDate),
    consistencyScore30d: computeConsistencyScore(entryDates, 30, referenceDate),
    entryRichnessAvg: avgRichness,
    entryRichnessTrend: computeEntryRichnessTrend(richnesses),
    bestDayOfWeek: findBestWritingDay(entryDates),
    bestTimeOfDay: findBestWritingTime(entries.map((e) => e.createdAt)),
    promptAdherenceByCategory: promptsShown
      ? computePromptAdherence(promptsShown, entryDates)
      : {},
  };
}
