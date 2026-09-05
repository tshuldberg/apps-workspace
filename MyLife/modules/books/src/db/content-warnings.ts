/**
 * Content warning CRUD operations.
 */

import type { DatabaseAdapter } from '@mylife/db';
import type { ContentWarning, ContentWarningInsert, Book } from '../models/schemas';

export function addContentWarning(
  db: DatabaseAdapter,
  id: string,
  input: ContentWarningInsert,
): ContentWarning {
  const now = new Date().toISOString();
  const warning: ContentWarning = {
    id,
    book_id: input.book_id,
    warning: input.warning,
    severity: input.severity ?? 'moderate',
    created_at: now,
  };

  db.execute(
    `INSERT INTO bk_content_warnings (id, book_id, warning, severity, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    [warning.id, warning.book_id, warning.warning, warning.severity, warning.created_at],
  );

  return warning;
}

export function removeContentWarning(db: DatabaseAdapter, id: string): void {
  db.execute(`DELETE FROM bk_content_warnings WHERE id = ?`, [id]);
}

export function getContentWarningsForBook(
  db: DatabaseAdapter,
  bookId: string,
): ContentWarning[] {
  return db.query<ContentWarning>(
    `SELECT * FROM bk_content_warnings WHERE book_id = ? ORDER BY severity DESC, warning`,
    [bookId],
  );
}

export function getBooksWithContentWarning(
  db: DatabaseAdapter,
  warning: string,
): Book[] {
  return db.query<Book>(
    `SELECT b.* FROM bk_books b
     INNER JOIN bk_content_warnings cw ON b.id = cw.book_id
     WHERE cw.warning = ?
     ORDER BY b.title`,
    [warning],
  );
}

export function getDistinctWarnings(db: DatabaseAdapter): string[] {
  const rows = db.query<{ warning: string }>(
    `SELECT DISTINCT warning FROM bk_content_warnings ORDER BY warning`,
  );
  return rows.map((r) => r.warning);
}
