import { useState, useEffect, useCallback } from 'react';
import { useDatabase } from '../../components/DatabaseProvider';
import { uuid } from '../../lib/uuid';
import {
  getReviewForBook,
  getReviewsForBook,
  createReview,
  updateReview,
  getFavorites,
  type Review,
  type ReviewInsert,
} from '@mylife/books';

export function useReviews(bookId?: string) {
  const db = useDatabase();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(() => {
    try {
      setLoading(true);
      const result = bookId ? getReviewsForBook(db, bookId) : getFavorites(db);
      setReviews(result);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setLoading(false);
    }
  }, [db, bookId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { reviews, loading, error, refresh };
}

export function useReviewForBook(bookId: string | undefined) {
  const db = useDatabase();
  const [review, setReview] = useState<Review | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    if (!bookId) {
      setReview(null);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setReview(getReviewForBook(db, bookId));
    } finally {
      setLoading(false);
    }
  }, [db, bookId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const save = useCallback(
    (input: Omit<ReviewInsert, 'book_id'>) => {
      if (!bookId) return;
      if (review) {
        updateReview(db, review.id, input);
      } else {
        const id = uuid();
        createReview(db, id, { ...input, book_id: bookId });
      }
      refresh();
    },
    [db, bookId, review, refresh],
  );

  return { review, loading, refresh, save };
}
