/**
 * Tag CRUD operations.
 */

import type { DatabaseAdapter } from './migrations';
import type { Tag, TagInsert, Book } from '../models/schemas';

export function createTag(
  db: DatabaseAdapter,
  id: string,
  input: TagInsert,
): Tag {
  const now = new Date().toISOString();
  const tag: Tag = {
    id,
    name: input.name,
    color: input.color ?? null,
    usage_count: input.usage_count ?? 0,
    created_at: now,
  };

  db.execute(
    `INSERT INTO tags (id, name, color, usage_count, created_at) VALUES (?, ?, ?, ?, ?)`,
    [tag.id, tag.name, tag.color, tag.usage_count, tag.created_at],
  );

  return tag;
}

export function getTag(db: DatabaseAdapter, id: string): Tag | null {
  const rows = db.query<Tag>(
    `SELECT * FROM tags WHERE id = ?`,
    [id],
  );
  return rows.length > 0 ? rows[0] : null;
}

export function getTags(db: DatabaseAdapter): Tag[] {
  return db.query<Tag>(
    `SELECT * FROM tags ORDER BY usage_count DESC, name`,
  );
}

export function updateTag(
  db: DatabaseAdapter,
  id: string,
  updates: Partial<Pick<Tag, 'name' | 'color'>>,
): void {
  const fields: string[] = [];
  const values: unknown[] = [];

  if (updates.name !== undefined) {
    fields.push('name = ?');
    values.push(updates.name);
  }
  if (updates.color !== undefined) {
    fields.push('color = ?');
    values.push(updates.color);
  }

  if (fields.length === 0) return;
  values.push(id);

  db.execute(
    `UPDATE tags SET ${fields.join(', ')} WHERE id = ?`,
    values,
  );
}

export function deleteTag(db: DatabaseAdapter, id: string): void {
  db.execute(`DELETE FROM tags WHERE id = ?`, [id]);
}

export function addTagToBook(
  db: DatabaseAdapter,
  bookId: string,
  tagId: string,
): void {
  db.execute(
    `INSERT OR IGNORE INTO book_tags (book_id, tag_id) VALUES (?, ?)`,
    [bookId, tagId],
  );
  db.execute(
    `UPDATE tags SET usage_count = (SELECT COUNT(*) FROM book_tags WHERE tag_id = ?) WHERE id = ?`,
    [tagId, tagId],
  );
}

export function removeTagFromBook(
  db: DatabaseAdapter,
  bookId: string,
  tagId: string,
): void {
  db.execute(
    `DELETE FROM book_tags WHERE book_id = ? AND tag_id = ?`,
    [bookId, tagId],
  );
  db.execute(
    `UPDATE tags SET usage_count = (SELECT COUNT(*) FROM book_tags WHERE tag_id = ?) WHERE id = ?`,
    [tagId, tagId],
  );
}

export function getTagsForBook(db: DatabaseAdapter, bookId: string): Tag[] {
  return db.query<Tag>(
    `SELECT t.* FROM tags t
     INNER JOIN book_tags bt ON t.id = bt.tag_id
     WHERE bt.book_id = ?
     ORDER BY t.name`,
    [bookId],
  );
}

export function getBooksWithTag(db: DatabaseAdapter, tagId: string): Book[] {
  return db.query<Book>(
    `SELECT b.* FROM books b
     INNER JOIN book_tags bt ON b.id = bt.book_id
     WHERE bt.tag_id = ?
     ORDER BY b.title`,
    [tagId],
  );
}
