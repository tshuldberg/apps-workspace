/**
 * Series-Books junction CRUD operations.
 */

import type { DatabaseAdapter } from '@mylife/db';
import type { Book, Series } from '../models/schemas';

export function addBookToSeries(
  db: DatabaseAdapter,
  seriesId: string,
  bookId: string,
  sortOrder: number,
): void {
  db.execute(
    `INSERT OR IGNORE INTO bk_series_books (series_id, book_id, sort_order, created_at)
     VALUES (?, ?, ?, datetime('now'))`,
    [seriesId, bookId, sortOrder],
  );
}

export function removeBookFromSeries(
  db: DatabaseAdapter,
  seriesId: string,
  bookId: string,
): void {
  db.execute(
    `DELETE FROM bk_series_books WHERE series_id = ? AND book_id = ?`,
    [seriesId, bookId],
  );
}

export function getBooksInSeries(
  db: DatabaseAdapter,
  seriesId: string,
): Array<Book & { sort_order: number }> {
  return db.query<Book & { sort_order: number }>(
    `SELECT b.*, sb.sort_order FROM bk_books b
     INNER JOIN bk_series_books sb ON b.id = sb.book_id
     WHERE sb.series_id = ?
     ORDER BY sb.sort_order`,
    [seriesId],
  );
}

export function getSeriesForBook(
  db: DatabaseAdapter,
  bookId: string,
): Series[] {
  return db.query<Series>(
    `SELECT s.* FROM bk_series s
     INNER JOIN bk_series_books sb ON s.id = sb.series_id
     WHERE sb.book_id = ?
     ORDER BY s.name`,
    [bookId],
  );
}

export function reorderSeriesBook(
  db: DatabaseAdapter,
  seriesId: string,
  bookId: string,
  newOrder: number,
): void {
  db.execute(
    `UPDATE bk_series_books SET sort_order = ? WHERE series_id = ? AND book_id = ?`,
    [newOrder, seriesId, bookId],
  );
}

export function getNextUnread(
  db: DatabaseAdapter,
  seriesId: string,
): Book | null {
  const rows = db.query<Book>(
    `SELECT b.* FROM bk_books b
     INNER JOIN bk_series_books sb ON b.id = sb.book_id
     WHERE sb.series_id = ?
       AND NOT EXISTS (
         SELECT 1 FROM bk_reading_sessions rs
         WHERE rs.book_id = b.id AND rs.status = 'finished'
       )
     ORDER BY sb.sort_order
     LIMIT 1`,
    [seriesId],
  );
  return rows.length > 0 ? rows[0] : null;
}
