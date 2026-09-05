import { z } from 'zod';

// ── Types ──

export const NostalgiaScoreSchema = z.object({
  id: z.string(),
  score: z.number(),
  yearsAgo: z.number().int(),
});
export type NostalgiaScore = z.infer<typeof NostalgiaScoreSchema>;

// ── Pure Functions ──

/**
 * Score an On-This-Day entry for emotional significance.
 * Higher scores = more meaningful memories to surface first.
 *
 * Scoring factors:
 * - Has mood data: +10
 * - Mood is 'great' or 'grateful': +5 bonus
 * - Has images: +10 (up to 3 images, +3 each after first)
 * - Word count > 200: +10 (substantial entry)
 * - Word count > 500: +5 bonus (deep entry)
 * - Has tags: +5
 * - Has audio: +8
 * - Has location: +5
 * - Is therapy prep: +8 (milestone entry)
 * - Years ago bonus: +2 per year (older = more nostalgic, capped at 20)
 */
export function scoreOnThisDayEntry(
  entry: {
    id: string;
    mood: string | null;
    imageUris: string[];
    wordCount: number;
    tags: string[];
    entryType: string;
    audioPath: string | null;
    latitude: number | null;
  },
  yearsAgo: number,
): number {
  let score = 0;

  // Mood
  if (entry.mood) {
    score += 10;
    if (entry.mood === 'great' || entry.mood === 'grateful') score += 5;
  }

  // Images
  if (entry.imageUris.length > 0) {
    score += 10;
    score += Math.min(entry.imageUris.length - 1, 3) * 3;
  }

  // Word count
  if (entry.wordCount > 200) score += 10;
  if (entry.wordCount > 500) score += 5;

  // Tags
  if (entry.tags.length > 0) score += 5;

  // Audio
  if (entry.audioPath) score += 8;

  // Location
  if (entry.latitude !== null) score += 5;

  // Therapy prep (milestone)
  if (entry.entryType === 'therapy_prep') score += 8;

  // Nostalgia bonus (older memories are more precious)
  score += Math.min(yearsAgo * 2, 20);

  return score;
}

/**
 * Rank On-This-Day entries by emotional significance score.
 * Returns entries sorted from most meaningful to least.
 */
export function rankOnThisDayEntries(
  entries: Array<{
    id: string;
    mood: string | null;
    imageUris: string[];
    wordCount: number;
    tags: string[];
    entryType: string;
    audioPath: string | null;
    latitude: number | null;
    yearsAgo: number;
  }>,
): NostalgiaScore[] {
  return entries
    .map((e) => ({
      id: e.id,
      score: scoreOnThisDayEntry(e, e.yearsAgo),
      yearsAgo: e.yearsAgo,
    }))
    .sort((a, b) => b.score - a.score);
}
