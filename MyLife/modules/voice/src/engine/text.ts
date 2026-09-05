/**
 * Pure text processing functions for voice transcriptions.
 */

const WORDS_PER_MINUTE = 200;

/**
 * Count the number of words in a text string.
 * Splits on whitespace and filters empty tokens.
 */
export function calculateWordCount(text: string): number {
  if (!text.trim()) return 0;
  return text.trim().split(/\s+/).length;
}

/**
 * Estimate reading time in minutes assuming 200 wpm.
 * Returns a minimum of 1 for non-empty text.
 */
export function calculateReadingTime(text: string): number {
  const wordCount = calculateWordCount(text);
  if (wordCount === 0) return 0;
  return Math.max(1, Math.ceil(wordCount / WORDS_PER_MINUTE));
}

/**
 * Extract top-N keywords from text using simple word frequency.
 * Filters common stop words and short tokens.
 */
export function extractKeywords(text: string, topN = 5): string[] {
  if (!text.trim()) return [];

  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'shall', 'can', 'this', 'that', 'these',
    'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him',
    'her', 'us', 'them', 'my', 'your', 'his', 'its', 'our', 'their',
    'not', 'no', 'so', 'if', 'from', 'as', 'about', 'into', 'just',
    'also', 'than', 'then', 'very', 'too', 'more', 'most', 'some', 'any',
    'all', 'each', 'every', 'both', 'few', 'many', 'much', 'own', 'other',
    'such', 'only', 'same', 'what', 'which', 'who', 'whom', 'how', 'when',
    'where', 'why', 'up', 'out', 'there', 'here', 'over', 'after', 'before',
  ]);

  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopWords.has(w));

  const freq = new Map<string, number>();
  for (const word of words) {
    freq.set(word, (freq.get(word) ?? 0) + 1);
  }

  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([word]) => word);
}

/**
 * Summarize text by returning the first N sentences.
 */
export function summarizeText(text: string, maxSentences = 3): string {
  if (!text.trim()) return '';

  // Split on sentence-ending punctuation followed by whitespace or end of string
  const sentences = text
    .trim()
    .split(/(?<=[.!?])\s+/)
    .filter((s) => s.trim().length > 0);

  return sentences.slice(0, maxSentences).join(' ');
}

/**
 * Format a duration in seconds to a human-readable string.
 * Returns "0s" for zero, "Xs" for under a minute, "Xm Ys" otherwise.
 */
export function formatDuration(seconds: number): string {
  if (seconds <= 0) return '0s';

  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);

  if (mins === 0) return `${secs}s`;
  if (secs === 0) return `${mins}m`;
  return `${mins}m ${secs}s`;
}
