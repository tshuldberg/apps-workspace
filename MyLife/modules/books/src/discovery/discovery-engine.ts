/**
 * Discovery engine -- combined multi-filter book discovery.
 */

import type { DatabaseAdapter } from '@mylife/db';
import type { Book, ContentWarning } from '../models/schemas';
import type { DiscoveryFilters, BookDiscoveryProfile, DiscoverySuggestion } from './types';
import { getBooksBySubject } from '../api/open-library';

/**
 * Discover books matching a combination of mood tags, pace, genre,
 * content warning exclusions, and user tags.
 */
export function discoverBooks(
  db: DatabaseAdapter,
  filters: DiscoveryFilters,
): Book[] {
  const conditions: string[] = [];
  const params: unknown[] = [];

  // Mood filter: books that have ANY of the specified mood values
  if (filters.moods && filters.moods.length > 0) {
    const placeholders = filters.moods.map(() => '?').join(', ');
    conditions.push(
      `b.id IN (SELECT book_id FROM bk_mood_tags WHERE tag_type = 'mood' AND value IN (${placeholders}))`,
    );
    params.push(...filters.moods);
  }

  // Pace filter
  if (filters.paces && filters.paces.length > 0) {
    const placeholders = filters.paces.map(() => '?').join(', ');
    conditions.push(
      `b.id IN (SELECT book_id FROM bk_mood_tags WHERE tag_type = 'pace' AND value IN (${placeholders}))`,
    );
    params.push(...filters.paces);
  }

  // Genre filter
  if (filters.genres && filters.genres.length > 0) {
    const placeholders = filters.genres.map(() => '?').join(', ');
    conditions.push(
      `b.id IN (SELECT book_id FROM bk_mood_tags WHERE tag_type = 'genre' AND value IN (${placeholders}))`,
    );
    params.push(...filters.genres);
  }

  // Exclude books with specific content warnings
  if (filters.excludeWarnings && filters.excludeWarnings.length > 0) {
    const placeholders = filters.excludeWarnings.map(() => '?').join(', ');
    conditions.push(
      `b.id NOT IN (SELECT book_id FROM bk_content_warnings WHERE warning IN (${placeholders}))`,
    );
    params.push(...filters.excludeWarnings);
  }

  // Tag filter (user-created tags via book_tags junction)
  if (filters.tags && filters.tags.length > 0) {
    const placeholders = filters.tags.map(() => '?').join(', ');
    conditions.push(
      `b.id IN (SELECT bt.book_id FROM bk_book_tags bt INNER JOIN bk_tags t ON bt.tag_id = t.id WHERE t.name IN (${placeholders}))`,
    );
    params.push(...filters.tags);
  }

  const whereClause = conditions.length > 0
    ? `WHERE ${conditions.join(' AND ')}`
    : '';

  const limit = filters.limit ?? 50;
  const offset = filters.offset ?? 0;
  params.push(limit, offset);

  return db.query<Book>(
    `SELECT b.* FROM bk_books b ${whereClause} ORDER BY b.title LIMIT ? OFFSET ?`,
    params,
  );
}

/**
 * Get the full discovery metadata profile for a single book.
 */
export function getBookDiscoveryProfile(
  db: DatabaseAdapter,
  bookId: string,
): BookDiscoveryProfile {
  const moodRows = db.query<{ value: string }>(
    `SELECT value FROM bk_mood_tags WHERE book_id = ? AND tag_type = 'mood' ORDER BY value`,
    [bookId],
  );
  const paceRows = db.query<{ value: string }>(
    `SELECT value FROM bk_mood_tags WHERE book_id = ? AND tag_type = 'pace' ORDER BY value`,
    [bookId],
  );
  const genreRows = db.query<{ value: string }>(
    `SELECT value FROM bk_mood_tags WHERE book_id = ? AND tag_type = 'genre' ORDER BY value`,
    [bookId],
  );
  const contentWarnings = db.query<ContentWarning>(
    `SELECT * FROM bk_content_warnings WHERE book_id = ? ORDER BY severity DESC, warning`,
    [bookId],
  );
  const tagRows = db.query<{ name: string }>(
    `SELECT t.name FROM bk_tags t
     INNER JOIN bk_book_tags bt ON t.id = bt.tag_id
     WHERE bt.book_id = ?
     ORDER BY t.name`,
    [bookId],
  );

  return {
    moods: moodRows.map((r) => r.value),
    paces: paceRows.map((r) => r.value),
    genres: genreRows.map((r) => r.value),
    contentWarnings,
    tags: tagRows.map((r) => r.name),
  };
}

const DEFAULT_GENRES = [
  { value: 'Fiction', count: 0 },
  { value: 'Fantasy', count: 0 },
  { value: 'Science Fiction', count: 0 },
];

/**
 * Get external book suggestions based on the user's top genres.
 * Filters out books already in the user's library.
 */
export async function discoverNewBooks(
  db: DatabaseAdapter,
  maxPerGenre: number = 5,
): Promise<DiscoverySuggestion[]> {
  // Get user's top genres from mood tags
  let genreRows = db.query<{ value: string; count: number }>(
    `SELECT value, COUNT(*) as count FROM bk_mood_tags
     WHERE tag_type = 'genre'
     GROUP BY value
     ORDER BY count DESC
     LIMIT 5`,
  );

  if (genreRows.length === 0) {
    genreRows = DEFAULT_GENRES;
  }

  // Get all existing Open Library IDs to filter out owned books
  const existingRows = db.query<{ open_library_id: string }>(
    `SELECT open_library_id FROM bk_books WHERE open_library_id IS NOT NULL`,
  );
  const existingOLIds = new Set(existingRows.map(r => r.open_library_id));

  const suggestions: DiscoverySuggestion[] = [];

  for (const genre of genreRows) {
    try {
      const response = await getBooksBySubject(genre.value, maxPerGenre * 2);

      for (const work of response.works) {
        // Extract OLID from key like "/works/OL12345W"
        const olid = work.key.replace(/^\/works\//, '');

        // Skip books already in library
        if (existingOLIds.has(olid)) continue;

        suggestions.push({
          key: work.key,
          title: work.title,
          authors: work.authors?.map(a => a.name) ?? [],
          coverUrl: work.cover_id
            ? `https://covers.openlibrary.org/b/id/${work.cover_id}-M.jpg`
            : null,
          firstPublishYear: work.first_publish_year ?? null,
          subject: genre.value,
        });

        if (suggestions.filter(s => s.subject === genre.value).length >= maxPerGenre) break;
      }
    } catch {
      // Skip genres that fail to fetch -- don't block the whole discovery
      continue;
    }
  }

  return suggestions;
}
