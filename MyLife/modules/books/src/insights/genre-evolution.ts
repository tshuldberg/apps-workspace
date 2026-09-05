/**
 * Genre evolution timeline -- tracks how reading taste changes over time.
 *
 * Analyzes finished books by period (yearly or quarterly) and shows
 * how genre distribution shifts.
 */

import type { DatabaseAdapter } from '@mylife/db';
import type { GenreEvolutionTimeline, GenreEvolutionPeriod, GenreSnapshot } from './types';

interface FinishedBookRow {
  book_id: string;
  subjects: string | null;
  finished_at: string;
}

/**
 * Compute genre evolution across yearly periods.
 */
export function computeGenreEvolution(db: DatabaseAdapter): GenreEvolutionTimeline {
  const books = db.query<FinishedBookRow>(
    `SELECT s.book_id, b.subjects, s.finished_at
     FROM bk_reading_sessions s
     JOIN bk_books b ON b.id = s.book_id
     WHERE s.status = 'finished' AND s.finished_at IS NOT NULL AND b.subjects IS NOT NULL
     ORDER BY s.finished_at ASC`,
  );

  if (books.length === 0) {
    return { periods: [], dominantGenreShifts: [] };
  }

  // Group books by year
  const byYear = new Map<number, string[][]>();

  for (const book of books) {
    const year = new Date(book.finished_at).getFullYear();
    const genres = parseTopGenres(book.subjects);
    if (genres.length === 0) continue;

    if (!byYear.has(year)) byYear.set(year, []);
    byYear.get(year)!.push(genres);
  }

  // Build periods
  const periods: GenreEvolutionPeriod[] = [];

  for (const [year, bookGenres] of Array.from(byYear.entries()).sort((a, b) => a[0] - b[0])) {
    const genreCounts = new Map<string, number>();
    let totalBooks = 0;

    for (const genres of bookGenres) {
      totalBooks++;
      for (const genre of genres) {
        genreCounts.set(genre, (genreCounts.get(genre) ?? 0) + 1);
      }
    }

    const genres: GenreSnapshot[] = Array.from(genreCounts.entries())
      .map(([genre, count]) => ({
        genre,
        count,
        percentage: Math.round((count / totalBooks) * 100),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    periods.push({
      period: String(year),
      year,
      genres,
    });
  }

  // Detect dominant genre shifts
  const dominantGenreShifts: GenreEvolutionTimeline['dominantGenreShifts'] = [];

  for (let i = 1; i < periods.length; i++) {
    const prevTop = periods[i - 1].genres[0]?.genre;
    const currTop = periods[i].genres[0]?.genre;

    if (prevTop && currTop && prevTop !== currTop) {
      dominantGenreShifts.push({
        from: prevTop,
        to: currTop,
        period: periods[i].period,
      });
    }
  }

  return { periods, dominantGenreShifts };
}

function parseTopGenres(subjectsJson: string | null, limit = 3): string[] {
  if (!subjectsJson) return [];
  try {
    const parsed = JSON.parse(subjectsJson);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((s): s is string => typeof s === 'string' && s.length > 0)
      .map((s) => s.toLowerCase().trim())
      .slice(0, limit);
  } catch {
    return [];
  }
}
