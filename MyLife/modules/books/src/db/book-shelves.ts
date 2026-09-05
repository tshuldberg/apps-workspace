/**
 * Book-Shelf junction CRUD operations.
 */

import type { DatabaseAdapter } from '@mylife/db';
import type { Book } from '../models/schemas';
import type { Shelf } from '../models/schemas';
import { refreshShelfCount } from './shelves';
import { getSessionsForBook, createSession, updateSession } from './reading-sessions';

/** Map system shelf slugs to reading session statuses. */
const SHELF_STATUS_MAP: Record<string, 'want_to_read' | 'reading' | 'finished'> = {
  'want-to-read': 'want_to_read',
  'currently-reading': 'reading',
  'finished': 'finished',
};

export function addBookToShelf(
  db: DatabaseAdapter,
  bookId: string,
  shelfId: string,
): void {
  db.transaction(() => {
    db.execute(
      `INSERT OR IGNORE INTO bk_book_shelves (book_id, shelf_id, added_at) VALUES (?, ?, ?)`,
      [bookId, shelfId, new Date().toISOString()],
    );
    refreshShelfCount(db, shelfId);
  });
}

export function removeBookFromShelf(
  db: DatabaseAdapter,
  bookId: string,
  shelfId: string,
): void {
  db.transaction(() => {
    db.execute(
      `DELETE FROM bk_book_shelves WHERE book_id = ? AND shelf_id = ?`,
      [bookId, shelfId],
    );
    refreshShelfCount(db, shelfId);
  });
}

export function getBooksOnShelf(db: DatabaseAdapter, shelfId: string): Book[] {
  return db.query<Book>(
    `SELECT b.* FROM bk_books b
     INNER JOIN bk_book_shelves bs ON b.id = bs.book_id
     WHERE bs.shelf_id = ?
     ORDER BY bs.added_at DESC`,
    [shelfId],
  );
}

export function getShelvesForBook(db: DatabaseAdapter, bookId: string): Shelf[] {
  return db.query<Shelf>(
    `SELECT s.* FROM bk_shelves s
     INNER JOIN bk_book_shelves bs ON s.id = bs.shelf_id
     WHERE bs.book_id = ?
     ORDER BY s.sort_order`,
    [bookId],
  );
}

/**
 * Move a book from all current shelves to a single target shelf.
 * Useful for transitioning reading status (e.g., TBR -> Reading -> Finished).
 * Automatically syncs the reading session status for system shelves.
 */
export function moveBookToShelf(
  db: DatabaseAdapter,
  bookId: string,
  targetShelfId: string,
): void {
  db.transaction(() => {
    // Get current shelves so we can refresh their counts
    const currentShelves = db.query<{ shelf_id: string }>(
      `SELECT shelf_id FROM bk_book_shelves WHERE book_id = ?`,
      [bookId],
    );

    // Remove from all shelves
    db.execute(`DELETE FROM bk_book_shelves WHERE book_id = ?`, [bookId]);

    // Add to target shelf
    const now = new Date().toISOString();
    db.execute(
      `INSERT INTO bk_book_shelves (book_id, shelf_id, added_at) VALUES (?, ?, ?)`,
      [bookId, targetShelfId, now],
    );

    // Refresh counts for all affected shelves
    const affectedIds = new Set([
      ...currentShelves.map((r) => r.shelf_id),
      targetShelfId,
    ]);
    for (const shelfId of affectedIds) {
      refreshShelfCount(db, shelfId);
    }

    // Sync reading session status for system shelves
    const targetShelf = db.query<{ slug: string }>(
      `SELECT slug FROM bk_shelves WHERE id = ?`,
      [targetShelfId],
    );
    const slug = targetShelf.length > 0 ? targetShelf[0].slug : null;
    const newStatus = slug ? SHELF_STATUS_MAP[slug] : undefined;

    if (newStatus) {
      const sessions = getSessionsForBook(db, bookId);
      if (sessions.length > 0) {
        // Update the most recent session
        const updates: Record<string, unknown> = { status: newStatus };
        if (newStatus === 'reading' && !sessions[0].started_at) {
          updates.started_at = now;
        }
        if (newStatus === 'finished') {
          updates.finished_at = now;
          if (!sessions[0].started_at) {
            updates.started_at = now;
          }
        }
        updateSession(db, sessions[0].id, updates);
      } else {
        // Create a new session
        const sessionId = `session-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
        createSession(db, sessionId, {
          book_id: bookId,
          status: newStatus,
          started_at: newStatus === 'reading' || newStatus === 'finished' ? now : undefined,
          finished_at: newStatus === 'finished' ? now : undefined,
        });
      }
    }
  });
}
