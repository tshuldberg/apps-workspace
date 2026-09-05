/**
 * Journal-to-book linking operations (hub variant with bk_ prefix).
 */

import type { DatabaseAdapter } from '@mylife/db';
import type { JournalBookLink, JournalEntry, Book } from '../models/schemas';

export function linkJournalToBook(
  db: DatabaseAdapter,
  entryId: string,
  bookId: string,
): JournalBookLink {
  const now = new Date().toISOString();
  const link: JournalBookLink = {
    entry_id: entryId,
    book_id: bookId,
    created_at: now,
  };

  db.execute(
    `INSERT OR IGNORE INTO bk_journal_book_links (entry_id, book_id, created_at) VALUES (?, ?, ?)`,
    [link.entry_id, link.book_id, link.created_at],
  );

  return link;
}

export function unlinkJournalFromBook(
  db: DatabaseAdapter,
  entryId: string,
  bookId: string,
): void {
  db.execute(
    `DELETE FROM bk_journal_book_links WHERE entry_id = ? AND book_id = ?`,
    [entryId, bookId],
  );
}

export function getLinkedBooks(
  db: DatabaseAdapter,
  entryId: string,
): Book[] {
  return db.query<Book>(
    `SELECT b.* FROM bk_books b
     INNER JOIN bk_journal_book_links jbl ON b.id = jbl.book_id
     WHERE jbl.entry_id = ?
     ORDER BY b.title`,
    [entryId],
  );
}

export function getJournalEntriesForBook(
  db: DatabaseAdapter,
  bookId: string,
): JournalEntry[] {
  return db.query<JournalEntry>(
    `SELECT e.* FROM bk_journal_entries e
     INNER JOIN bk_journal_book_links jbl ON e.id = jbl.entry_id
     WHERE jbl.book_id = ?
     ORDER BY e.created_at DESC`,
    [bookId],
  );
}

export function getLinkedEntryCount(
  db: DatabaseAdapter,
  bookId: string,
): number {
  const rows = db.query<{ count: number }>(
    `SELECT COUNT(*) as count FROM bk_journal_book_links WHERE book_id = ?`,
    [bookId],
  );
  return rows[0]?.count ?? 0;
}
