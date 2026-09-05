/**
 * Review CRUD operations.
 */

import type { DatabaseAdapter } from '@mylife/db';
import type { Review, ReviewInsert } from '../models/schemas';

export function createReview(
  db: DatabaseAdapter,
  id: string,
  input: ReviewInsert,
): Review {
  const now = new Date().toISOString();
  const review: Review = {
    id,
    book_id: input.book_id,
    session_id: input.session_id ?? null,
    rating: input.rating ?? null,
    review_text: input.review_text ?? null,
    favorite_quote: input.favorite_quote ?? null,
    is_favorite: input.is_favorite ?? 0,
    created_at: now,
    updated_at: now,
  };

  db.execute(
    `INSERT INTO bk_reviews (id, book_id, session_id, rating, review_text, favorite_quote, is_favorite, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [review.id, review.book_id, review.session_id, review.rating,
     review.review_text, review.favorite_quote, review.is_favorite,
     review.created_at, review.updated_at],
  );

  return review;
}

export function getReview(db: DatabaseAdapter, id: string): Review | null {
  const rows = db.query<Review>(
    `SELECT * FROM bk_reviews WHERE id = ?`,
    [id],
  );
  return rows.length > 0 ? rows[0] : null;
}

export function getReviewForBook(db: DatabaseAdapter, bookId: string): Review | null {
  const rows = db.query<Review>(
    `SELECT * FROM bk_reviews WHERE book_id = ? ORDER BY created_at DESC LIMIT 1`,
    [bookId],
  );
  return rows.length > 0 ? rows[0] : null;
}

export function updateReview(
  db: DatabaseAdapter,
  id: string,
  updates: Partial<Pick<Review, 'rating' | 'review_text' | 'favorite_quote' | 'is_favorite'>>,
): void {
  const fields: string[] = [];
  const values: unknown[] = [];

  if (updates.rating !== undefined) {
    fields.push('rating = ?');
    values.push(updates.rating);
  }
  if (updates.review_text !== undefined) {
    fields.push('review_text = ?');
    values.push(updates.review_text);
  }
  if (updates.favorite_quote !== undefined) {
    fields.push('favorite_quote = ?');
    values.push(updates.favorite_quote);
  }
  if (updates.is_favorite !== undefined) {
    fields.push('is_favorite = ?');
    values.push(updates.is_favorite);
  }

  if (fields.length === 0) return;

  fields.push('updated_at = ?');
  values.push(new Date().toISOString());
  values.push(id);

  db.execute(
    `UPDATE bk_reviews SET ${fields.join(', ')} WHERE id = ?`,
    values,
  );
}

export function deleteReview(db: DatabaseAdapter, id: string): void {
  db.execute(`DELETE FROM bk_reviews WHERE id = ?`, [id]);
}

export function getFavorites(db: DatabaseAdapter): Review[] {
  return db.query<Review>(
    `SELECT * FROM bk_reviews WHERE is_favorite = 1 ORDER BY created_at DESC`,
  );
}

export function getReviewsForBook(db: DatabaseAdapter, bookId: string): Review[] {
  return db.query<Review>(
    `SELECT * FROM bk_reviews WHERE book_id = ? ORDER BY created_at DESC`,
    [bookId],
  );
}
