import { z } from 'zod';

// ── Types ──

const MOOD_VALUES: Record<string, number> = {
  low: 1,
  okay: 2,
  good: 3,
  great: 4,
  grateful: 5,
};

export const WordCountTrendSchema = z.enum(['increasing', 'decreasing', 'stable']);
export type WordCountTrend = z.infer<typeof WordCountTrendSchema>;

export const TagInsightSchema = z.object({
  tag: z.string(),
  entryCount: z.number().int(),
  avgMood: z.number().nullable(),
});
export type TagInsight = z.infer<typeof TagInsightSchema>;

export const WritingInsightsSchema = z.object({
  avgWordsPerEntry: z.number(),
  wordCountTrend: WordCountTrendSchema,
  topTags: z.array(TagInsightSchema),
  vocabularyRichness: z.number(),
  longestEntryWordCount: z.number().int(),
  shortestEntryWordCount: z.number().int(),
  totalEntries: z.number().int(),
  totalWords: z.number().int(),
});
export type WritingInsights = z.infer<typeof WritingInsightsSchema>;

// ── Pure Functions ──

/**
 * Compute word count trend by comparing the average of the first half
 * of entries (chronologically) against the second half. Needs at least
 * 4 entries to detect a trend; otherwise returns 'stable'.
 */
export function computeWordCountTrend(
  entries: Array<{ wordCount: number; entryDate: string }>,
): WordCountTrend {
  if (entries.length < 4) return 'stable';

  const sorted = [...entries].sort((a, b) => a.entryDate.localeCompare(b.entryDate));
  const mid = Math.floor(sorted.length / 2);
  const firstHalf = sorted.slice(0, mid);
  const secondHalf = sorted.slice(mid);

  const avgFirst = firstHalf.reduce((s, e) => s + e.wordCount, 0) / firstHalf.length;
  const avgSecond = secondHalf.reduce((s, e) => s + e.wordCount, 0) / secondHalf.length;

  const changePercent = ((avgSecond - avgFirst) / Math.max(avgFirst, 1)) * 100;

  if (changePercent > 15) return 'increasing';
  if (changePercent < -15) return 'decreasing';
  return 'stable';
}

/**
 * Compute top tags by frequency with average mood per tag.
 * Returns up to `limit` tags sorted by entry count descending.
 */
export function computeTopTags(
  entries: Array<{ id: string; mood: string | null }>,
  entryTags: Array<{ entryId: string; tagName: string }>,
  limit = 10,
): TagInsight[] {
  const entryMoodMap = new Map<string, string | null>();
  for (const e of entries) {
    entryMoodMap.set(e.id, e.mood);
  }

  const tagStats = new Map<string, { count: number; moodSum: number; moodCount: number }>();

  for (const { entryId, tagName } of entryTags) {
    const stats = tagStats.get(tagName) ?? { count: 0, moodSum: 0, moodCount: 0 };
    stats.count++;

    const mood = entryMoodMap.get(entryId);
    if (mood && mood in MOOD_VALUES) {
      stats.moodSum += MOOD_VALUES[mood];
      stats.moodCount++;
    }

    tagStats.set(tagName, stats);
  }

  return [...tagStats.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, limit)
    .map(([tag, stats]) => ({
      tag,
      entryCount: stats.count,
      avgMood: stats.moodCount > 0 ? Math.round((stats.moodSum / stats.moodCount) * 100) / 100 : null,
    }));
}

/**
 * Estimate vocabulary richness as the ratio of unique words to total words
 * across all provided body texts. Returns 0-1 where higher = more diverse.
 * Strips markdown formatting before counting.
 */
export function estimateVocabularyRichness(bodyTexts: string[]): number {
  const allWords: string[] = [];

  for (const text of bodyTexts) {
    const cleaned = text
      .replace(/[#*_`~\[\]()>!|-]/g, '')
      .replace(/https?:\/\/\S+/g, '')
      .toLowerCase();

    const words = cleaned.split(/\s+/).filter((w) => w.length > 0);
    allWords.push(...words);
  }

  if (allWords.length === 0) return 0;

  const uniqueWords = new Set(allWords);
  return Math.round((uniqueWords.size / allWords.length) * 1000) / 1000;
}

/**
 * Correlate tags with mood values. For each tag, compute the average mood
 * of entries that have that tag. Only includes tags with mood data.
 */
export function computeTagMoodCorrelation(
  entries: Array<{ id: string; mood: string | null }>,
  entryTags: Array<{ entryId: string; tagName: string }>,
): TagInsight[] {
  const insights = computeTopTags(entries, entryTags, 50);
  return insights.filter((t) => t.avgMood !== null);
}

/**
 * Compute writing time distribution bucketed by hour (0-23).
 * Returns a map of hour -> entry count.
 */
export function computeWritingTimeDistribution(
  entries: Array<{ createdAt: string }>,
): Record<number, number> {
  const dist: Record<number, number> = {};

  for (const entry of entries) {
    const match = entry.createdAt.match(/(\d{2}):\d{2}/);
    if (match) {
      const hour = parseInt(match[1], 10);
      dist[hour] = (dist[hour] ?? 0) + 1;
    }
  }

  return dist;
}

/**
 * Aggregate all writing insights from a set of entries.
 */
export function computeWritingInsights(
  entries: Array<{
    id: string;
    wordCount: number;
    entryDate: string;
    createdAt: string;
    mood: string | null;
    body: string;
  }>,
  entryTags: Array<{ entryId: string; tagName: string }>,
): WritingInsights {
  if (entries.length === 0) {
    return {
      avgWordsPerEntry: 0,
      wordCountTrend: 'stable',
      topTags: [],
      vocabularyRichness: 0,
      longestEntryWordCount: 0,
      shortestEntryWordCount: 0,
      totalEntries: 0,
      totalWords: 0,
    };
  }

  const totalWords = entries.reduce((s, e) => s + e.wordCount, 0);
  const wordCounts = entries.map((e) => e.wordCount);

  return {
    avgWordsPerEntry: Math.round(totalWords / entries.length),
    wordCountTrend: computeWordCountTrend(entries),
    topTags: computeTopTags(entries, entryTags),
    vocabularyRichness: estimateVocabularyRichness(entries.map((e) => e.body)),
    longestEntryWordCount: Math.max(...wordCounts),
    shortestEntryWordCount: Math.min(...wordCounts),
    totalEntries: entries.length,
    totalWords,
  };
}
