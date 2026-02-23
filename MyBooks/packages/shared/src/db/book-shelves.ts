/**
 * Book-Shelf junction CRUD operations.
 */

import type { DatabaseAdapter } from './migrations';
import type { Book } from '../models/schemas';
import type { Shelf } from '../models/schemas';
import { refreshShelfCount } from './shelves';

export function addBookToShelf(
  db: DatabaseAdapter,
  bookId: string,
  shelfId: string,
): void {
  db.execute(
    `INSERT OR IGNORE INTO book_shelves (book_id, shelf_id, added_at) VALUES (?, ?, ?)`,
    [bookId, shelfId, new Date().toISOString()],
  );
  refreshShelfCount(db, shelfId);
}

export function removeBookFromShelf(
  db: DatabaseAdapter,
  bookId: string,
  shelfId: string,
): void {
  db.execute(
    `DELETE FROM book_shelves WHERE book_id = ? AND shelf_id = ?`,
    [bookId, shelfId],
  );
  refreshShelfCount(db, shelfId);
}

export function getBooksOnShelf(db: DatabaseAdapter, shelfId: string): Book[] {
  return db.query<Book>(
    `SELECT b.* FROM books b
     INNER JOIN book_shelves bs ON b.id = bs.book_id
     WHERE bs.shelf_id = ?
     ORDER BY bs.added_at DESC`,
    [shelfId],
  );
}

export function getShelvesForBook(db: DatabaseAdapter, bookId: string): Shelf[] {
  return db.query<Shelf>(
    `SELECT s.* FROM shelves s
     INNER JOIN book_shelves bs ON s.id = bs.shelf_id
     WHERE bs.book_id = ?
     ORDER BY s.sort_order`,
    [bookId],
  );
}

/**
 * Move a book from all current shelves to a single target shelf.
 * Useful for transitioning reading status (e.g., TBR -> Reading -> Finished).
 */
export function moveBookToShelf(
  db: DatabaseAdapter,
  bookId: string,
  targetShelfId: string,
): void {
  db.transaction(() => {
    // Get current shelves so we can refresh their counts
    const currentShelves = db.query<{ shelf_id: string }>(
      `SELECT shelf_id FROM book_shelves WHERE book_id = ?`,
      [bookId],
    );

    // Remove from all shelves
    db.execute(`DELETE FROM book_shelves WHERE book_id = ?`, [bookId]);

    // Add to target shelf
    db.execute(
      `INSERT INTO book_shelves (book_id, shelf_id, added_at) VALUES (?, ?, ?)`,
      [bookId, targetShelfId, new Date().toISOString()],
    );

    // Refresh counts for all affected shelves
    const affectedIds = new Set([
      ...currentShelves.map((r) => r.shelf_id),
      targetShelfId,
    ]);
    for (const shelfId of affectedIds) {
      refreshShelfCount(db, shelfId);
    }
  });
}
