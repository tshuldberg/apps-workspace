import { useState, useEffect, useCallback } from 'react';
import { useDatabase } from '../../components/DatabaseProvider';
import { uuid } from '../../lib/uuid';
import {
  getBooks,
  getBook,
  createBook,
  updateBook,
  deleteBook,
  type BookFilters,
  type Book,
  type BookInsert,
} from '@mylife/books';

export function useBooks(filters?: BookFilters) {
  const db = useDatabase();
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(() => {
    try {
      setLoading(true);
      const result = getBooks(db, filters);
      setBooks(result);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setLoading(false);
    }
  }, [db, filters?.shelf_id, filters?.tag_id, filters?.format, filters?.sort_by, filters?.sort_dir]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const create = useCallback(
    (input: BookInsert): Book => {
      const id = uuid();
      const book = createBook(db, id, input);
      refresh();
      return book;
    },
    [db, refresh],
  );

  const update = useCallback(
    (id: string, updates: Partial<Omit<Book, 'id' | 'created_at' | 'updated_at'>>) => {
      updateBook(db, id, updates);
      refresh();
    },
    [db, refresh],
  );

  const remove = useCallback(
    (id: string) => {
      deleteBook(db, id);
      refresh();
    },
    [db, refresh],
  );

  return { books, loading, error, refresh, create, update, remove };
}

export function useBook(id: string | undefined) {
  const db = useDatabase();
  const [book, setBook] = useState<Book | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    if (!id) {
      setBook(null);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setBook(getBook(db, id));
    } finally {
      setLoading(false);
    }
  }, [db, id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { book, loading, refresh };
}
