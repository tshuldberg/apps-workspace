/**
 * MyTravel <-> MyBooks read-only integration.
 *
 * Surfaces book suggestions relevant to a destination and builds a
 * road-trip reading list from unread books. Read-only: no schema changes,
 * no writes.
 *
 * `bk_books` has `title`, `subjects` (TEXT of genre/subject tags), and
 * `created_at`. Reading status lives on `bk_reading_sessions.status`
 * ('want_to_read', 'reading', 'finished', 'dnf'). Unread == no session, or
 * latest session is 'want_to_read'.
 *
 * Degrades gracefully if `bk_books` is not present.
 */

import type { DatabaseAdapter } from '@mylife/db';

export type BookStatus = 'want_to_read' | 'reading' | 'finished' | 'dnf' | 'unread';

export interface BookLink {
  bookId: string;
  title: string;
  author?: string;
  status?: BookStatus;
}

interface BookRow {
  id: string;
  title: string | null;
  authors: string | null;
  status: string | null;
}

function toLink(row: BookRow): BookLink {
  const link: BookLink = {
    bookId: row.id,
    title: row.title ?? '',
  };
  if (row.authors) {
    link.author = row.authors;
  }
  if (row.status) {
    link.status = row.status as BookStatus;
  } else {
    link.status = 'unread';
  }
  return link;
}

const READING_LIST_ABSOLUTE_MAX = 10;

/**
 * Suggest books for a destination. Matches LIKE '%destination%' on title
 * and subjects. If no matches (or the tables are missing), falls back to
 * the most recently added unread books up to `limit`.
 */
export function suggestBooksForDestination(
  db: DatabaseAdapter,
  destinationName: string,
  _countryCode?: string,
  limit = 8,
): BookLink[] {
  const cap = Math.max(1, Math.floor(limit));
  const pattern = '%' + (destinationName ?? '').trim() + '%';
  const hasSearch = destinationName && destinationName.trim().length > 0;

  if (hasSearch) {
    try {
      const matched = db.query<BookRow>(
        `SELECT b.id AS id,
                b.title AS title,
                b.authors AS authors,
                (
                  SELECT s.status FROM bk_reading_sessions s
                  WHERE s.book_id = b.id
                  ORDER BY s.updated_at DESC LIMIT 1
                ) AS status
         FROM bk_books b
         WHERE b.title LIKE ? OR b.subjects LIKE ?
         ORDER BY b.created_at DESC
         LIMIT ?`,
        [pattern, pattern, cap],
      );
      if (matched.length > 0) {
        return matched.map(toLink);
      }
    } catch {
      // fall through to fallback
    }
  }

  try {
    const recent = db.query<BookRow>(
      `SELECT b.id AS id,
              b.title AS title,
              b.authors AS authors,
              (
                SELECT s.status FROM bk_reading_sessions s
                WHERE s.book_id = b.id
                ORDER BY s.updated_at DESC LIMIT 1
              ) AS status
       FROM bk_books b
       ORDER BY b.created_at DESC
       LIMIT ?`,
      [cap],
    );
    return recent
      .map(toLink)
      .filter((l) => l.status === 'unread' || l.status === 'want_to_read');
  } catch {
    return [];
  }
}

/**
 * Build a road-trip reading list of unread books.
 *
 * Size is `max(1, floor(tripDurationDays / 3))`, capped at 10. Ordered by
 * most recently added. Returns `[]` if the books table is missing.
 */
export function getRoadTripReadingList(
  db: DatabaseAdapter,
  tripDurationDays: number,
): BookLink[] {
  const raw = Math.floor(Math.max(0, tripDurationDays) / 3);
  const size = Math.min(READING_LIST_ABSOLUTE_MAX, Math.max(1, raw));

  try {
    const rows = db.query<BookRow>(
      `SELECT b.id AS id,
              b.title AS title,
              b.authors AS authors,
              (
                SELECT s.status FROM bk_reading_sessions s
                WHERE s.book_id = b.id
                ORDER BY s.updated_at DESC LIMIT 1
              ) AS status
       FROM bk_books b
       ORDER BY b.created_at DESC`,
    );
    const unread = rows
      .map(toLink)
      .filter((l) => l.status === 'unread' || l.status === 'want_to_read');
    return unread.slice(0, size);
  } catch {
    return [];
  }
}
