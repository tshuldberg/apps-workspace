import { useState, useEffect, useCallback } from 'react';
import { useDatabase } from '../../components/DatabaseProvider';
import { uuid } from '../../lib/uuid';
import {
  getShelves,
  createShelf,
  addBookToShelf,
  removeBookFromShelf,
  getBooksOnShelf,
  type Shelf,
  type ShelfInsert,
  type Book,
} from '@mylife/books';

export function useShelves() {
  const db = useDatabase();
  const [shelves, setShelves] = useState<Shelf[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(() => {
    try {
      setLoading(true);
      const result = getShelves(db);
      setShelves(result);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setLoading(false);
    }
  }, [db]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const create = useCallback(
    (input: ShelfInsert): Shelf => {
      const id = uuid();
      const shelf = createShelf(db, id, input);
      refresh();
      return shelf;
    },
    [db, refresh],
  );

  return { shelves, loading, error, refresh, create };
}

export function useShelfBooks(shelfId: string | undefined) {
  const db = useDatabase();
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    if (!shelfId) {
      setBooks([]);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setBooks(getBooksOnShelf(db, shelfId));
    } finally {
      setLoading(false);
    }
  }, [db, shelfId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addBook = useCallback(
    (bookId: string) => {
      if (!shelfId) return;
      addBookToShelf(db, bookId, shelfId);
      refresh();
    },
    [db, shelfId, refresh],
  );

  const removeBook = useCallback(
    (bookId: string) => {
      if (!shelfId) return;
      removeBookFromShelf(db, bookId, shelfId);
      refresh();
    },
    [db, shelfId, refresh],
  );

  return { books, loading, refresh, addBook, removeBook };
}
