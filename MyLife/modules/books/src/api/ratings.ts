import type { DatabaseAdapter } from '@mylife/db';

interface RatingsResponse {
  summary?: {
    average?: number;
    count?: number;
  };
}

/**
 * Fetch community ratings for an Open Library work.
 * Returns null on error or if the work has no ratings.
 */
export async function fetchWorkRatings(
  workId: string,
): Promise<{ average: number; count: number } | null> {
  try {
    const url = `https://openlibrary.org/works/${workId}/ratings.json`;
    const res = await fetch(url);
    if (!res.ok) return null;

    const data = (await res.json()) as RatingsResponse;
    const average = data.summary?.average;
    const count = data.summary?.count;

    if (typeof average !== 'number' || typeof count !== 'number') return null;
    if (count === 0) return null;

    return { average, count };
  } catch {
    return null;
  }
}

/**
 * Sync community ratings for a book from Open Library.
 * Reads the book's open_library_id, fetches ratings, and updates the columns.
 */
export async function syncBookRatings(
  db: DatabaseAdapter,
  bookId: string,
): Promise<boolean> {
  const rows = db.query<{ open_library_id: string | null }>(
    'SELECT open_library_id FROM bk_books WHERE id = ?',
    [bookId],
  );
  if (rows.length === 0 || !rows[0].open_library_id) return false;

  const ratings = await fetchWorkRatings(rows[0].open_library_id);
  if (!ratings) return false;

  db.execute(
    'UPDATE bk_books SET ol_rating_average = ?, ol_rating_count = ? WHERE id = ?',
    [ratings.average, ratings.count, bookId],
  );
  return true;
}
