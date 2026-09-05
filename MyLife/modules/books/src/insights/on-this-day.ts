/**
 * "On This Day" reading history -- surfaces what you were reading on
 * this calendar date in previous years.
 */

import type { DatabaseAdapter } from '@mylife/db';
import type { OnThisDayEvent } from './types';

interface StartedRow {
  book_id: string;
  title: string;
  cover_url: string | null;
  started_at: string;
}

interface FinishedRow {
  book_id: string;
  title: string;
  cover_url: string | null;
  finished_at: string;
}

interface AddedRow {
  id: string;
  title: string;
  cover_url: string | null;
  created_at: string;
}

interface ReviewRow {
  book_id: string;
  title: string;
  cover_url: string | null;
  rating: number | null;
  created_at: string;
}

/**
 * Get reading events that happened on this calendar date in prior years.
 *
 * @param monthDay - Format "MM-DD" (e.g. "03-24" for March 24)
 */
export function getOnThisDay(
  db: DatabaseAdapter,
  monthDay?: string,
): OnThisDayEvent[] {
  const now = new Date();
  const currentYear = now.getFullYear();
  const md = monthDay ?? `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  const events: OnThisDayEvent[] = [];

  // Books started on this date
  const started = db.query<StartedRow>(
    `SELECT s.book_id, b.title, b.cover_url, s.started_at
     FROM bk_reading_sessions s
     JOIN bk_books b ON b.id = s.book_id
     WHERE strftime('%m-%d', s.started_at) = ?
       AND strftime('%Y', s.started_at) != ?
     ORDER BY s.started_at DESC`,
    [md, String(currentYear)],
  );

  for (const row of started) {
    events.push({
      type: 'started',
      bookTitle: row.title,
      bookId: row.book_id,
      coverUrl: row.cover_url,
      year: new Date(row.started_at).getFullYear(),
      date: row.started_at,
    });
  }

  // Books finished on this date
  const finished = db.query<FinishedRow>(
    `SELECT s.book_id, b.title, b.cover_url, s.finished_at
     FROM bk_reading_sessions s
     JOIN bk_books b ON b.id = s.book_id
     WHERE s.status = 'finished'
       AND strftime('%m-%d', s.finished_at) = ?
       AND strftime('%Y', s.finished_at) != ?
     ORDER BY s.finished_at DESC`,
    [md, String(currentYear)],
  );

  for (const row of finished) {
    events.push({
      type: 'finished',
      bookTitle: row.title,
      bookId: row.book_id,
      coverUrl: row.cover_url,
      year: new Date(row.finished_at).getFullYear(),
      date: row.finished_at,
    });
  }

  // Books added on this date
  const added = db.query<AddedRow>(
    `SELECT id, title, cover_url, created_at FROM bk_books
     WHERE strftime('%m-%d', created_at) = ?
       AND strftime('%Y', created_at) != ?
     ORDER BY created_at DESC`,
    [md, String(currentYear)],
  );

  for (const row of added) {
    events.push({
      type: 'added',
      bookTitle: row.title,
      bookId: row.id,
      coverUrl: row.cover_url,
      year: new Date(row.created_at).getFullYear(),
      date: row.created_at,
    });
  }

  // Reviews written on this date
  const reviews = db.query<ReviewRow>(
    `SELECT r.book_id, b.title, b.cover_url, r.rating, r.created_at
     FROM bk_reviews r
     JOIN bk_books b ON b.id = r.book_id
     WHERE strftime('%m-%d', r.created_at) = ?
       AND strftime('%Y', r.created_at) != ?
     ORDER BY r.created_at DESC`,
    [md, String(currentYear)],
  );

  for (const row of reviews) {
    events.push({
      type: 'reviewed',
      bookTitle: row.title,
      bookId: row.book_id,
      coverUrl: row.cover_url,
      year: new Date(row.created_at).getFullYear(),
      date: row.created_at,
      detail: row.rating ? `Rated ${row.rating}/5` : undefined,
    });
  }

  // Sort by year descending
  events.sort((a, b) => b.year - a.year);

  return events;
}
