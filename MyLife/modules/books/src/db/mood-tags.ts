/**
 * Mood tag CRUD operations.
 */

import type { DatabaseAdapter } from '@mylife/db';
import type { MoodTag, MoodTagInsert, MoodTagType, Book } from '../models/schemas';

export function addMoodTag(
  db: DatabaseAdapter,
  id: string,
  input: MoodTagInsert,
): MoodTag {
  const now = new Date().toISOString();
  const tag: MoodTag = {
    id,
    book_id: input.book_id,
    tag_type: input.tag_type,
    value: input.value,
    created_at: now,
  };

  db.execute(
    `INSERT OR IGNORE INTO bk_mood_tags (id, book_id, tag_type, value, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    [tag.id, tag.book_id, tag.tag_type, tag.value, tag.created_at],
  );

  return tag;
}

export function removeMoodTag(db: DatabaseAdapter, id: string): void {
  db.execute(`DELETE FROM bk_mood_tags WHERE id = ?`, [id]);
}

export function getMoodTagsForBook(db: DatabaseAdapter, bookId: string): MoodTag[] {
  return db.query<MoodTag>(
    `SELECT * FROM bk_mood_tags WHERE book_id = ? ORDER BY tag_type, value`,
    [bookId],
  );
}

export function getMoodTagsByType(
  db: DatabaseAdapter,
  bookId: string,
  tagType: MoodTagType,
): MoodTag[] {
  return db.query<MoodTag>(
    `SELECT * FROM bk_mood_tags WHERE book_id = ? AND tag_type = ? ORDER BY value`,
    [bookId, tagType],
  );
}

export function getBooksWithMoodTag(
  db: DatabaseAdapter,
  tagType: MoodTagType,
  value: string,
): Book[] {
  return db.query<Book>(
    `SELECT b.* FROM bk_books b
     INNER JOIN bk_mood_tags mt ON b.id = mt.book_id
     WHERE mt.tag_type = ? AND mt.value = ?
     ORDER BY b.title`,
    [tagType, value],
  );
}

export function getDistinctMoodValues(
  db: DatabaseAdapter,
  tagType: MoodTagType,
): string[] {
  const rows = db.query<{ value: string }>(
    `SELECT DISTINCT value FROM bk_mood_tags WHERE tag_type = ? ORDER BY value`,
    [tagType],
  );
  return rows.map((r) => r.value);
}
