import type { PageDimensions, PageMargins, PageSize, BookEstimate } from './types';
import { WORDS_PER_PAGE } from './types';

/**
 * Get page dimensions in points (72 points per inch).
 */
export function getPageDimensions(size: PageSize): PageDimensions {
  switch (size) {
    case '6x9':
      return { widthPt: 432, heightPt: 648 };
    case '5.5x8.5':
      return { widthPt: 396, heightPt: 612 };
    case '8.5x11':
      return { widthPt: 612, heightPt: 792 };
  }
}

/**
 * Get page margins in points for a given page size.
 * Inner margin (binding side) is larger for readability.
 */
export function getPageMargins(size: PageSize): PageMargins {
  switch (size) {
    case '6x9':
      return { innerPt: 54, outerPt: 36, topPt: 54, bottomPt: 54 }; // 0.75" / 0.5"
    case '5.5x8.5':
      return { innerPt: 50, outerPt: 36, topPt: 50, bottomPt: 50 };
    case '8.5x11':
      return { innerPt: 54, outerPt: 54, topPt: 72, bottomPt: 72 }; // 0.75" all sides, 1" top/bottom
  }
}

/**
 * Estimate the total page count for a book.
 * Adds 2 pages for cover/inside cover and 1 for TOC.
 */
export function estimatePageCount(
  totalWords: number,
  imageCount: number,
): BookEstimate {
  const textPages = Math.max(1, Math.ceil(totalWords / WORDS_PER_PAGE));
  const imagePages = imageCount; // 1 page per inline image
  const fixedPages = 3; // cover, inside cover, TOC

  return {
    entryCount: 0, // set by caller
    estimatedPages: textPages + imagePages + fixedPages,
    estimatedImagePages: imagePages,
    estimatedTextPages: textPages,
  };
}

/**
 * Format a mood tag to its emoji representation.
 */
export function moodToEmoji(mood: string | null): string {
  switch (mood) {
    case 'low': return '😔';
    case 'okay': return '😐';
    case 'good': return '🙂';
    case 'great': return '😄';
    case 'grateful': return '💛';
    default: return '';
  }
}

/**
 * Format an entry for book page: date header, optional mood, title, body.
 */
export function formatEntryForPage(
  entryDate: string,
  title: string | null,
  body: string,
  mood: string | null,
  includeMood: boolean,
  placeName: string | null,
  weatherDescription: string | null,
  includeMetadata: boolean,
): string {
  const parts: string[] = [];

  // Date header with optional mood
  const moodStr = includeMood && mood ? ` ${moodToEmoji(mood)}` : '';
  parts.push(`## ${entryDate}${moodStr}`);

  if (title) {
    parts.push(`### ${title}`);
  }

  parts.push(body);

  // Metadata footer
  if (includeMetadata && (placeName || weatherDescription)) {
    const metaParts = [placeName, weatherDescription].filter(Boolean);
    if (metaParts.length > 0) {
      parts.push(`\n---\n*${metaParts.join(' | ')}*`);
    }
  }

  return parts.join('\n\n');
}

/**
 * Generate a table of contents from entries.
 */
export function generateTOC(
  entries: Array<{ date: string; title: string | null; pageNumber: number }>,
): string {
  const lines = entries.map((e) => {
    const label = e.title ?? e.date;
    return `${label} ........ ${e.pageNumber}`;
  });
  return `## Table of Contents\n\n${lines.join('\n')}`;
}

/**
 * Validate a book configuration.
 */
export function validateBookConfig(config: {
  title: string;
  author: string;
  entryCount: number;
}): string | null {
  if (!config.title.trim()) return 'Book title is required';
  if (config.title.length > 100) return 'Book title cannot exceed 100 characters';
  if (!config.author.trim()) return 'Author name is required';
  if (config.author.length > 100) return 'Author name cannot exceed 100 characters';
  if (config.entryCount < 1) return 'Select at least 1 entry';
  if (config.entryCount > 500) return 'Maximum 500 entries per book';
  return null;
}
