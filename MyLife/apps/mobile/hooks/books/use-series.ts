import { useState, useEffect, useCallback } from 'react';
import { useDatabase } from '../../components/DatabaseProvider';
import { uuid } from '../../lib/uuid';
import {
  createSeries,
  getAllSeries,
  deleteSeries,
  addBookToSeries,
  removeBookFromSeries,
  getBooksInSeries,
  getNextUnread,
  type Series,
  type Book,
} from '@mylife/books';

export function useSeries() {
  const db = useDatabase();
  const [allSeries, setAllSeries] = useState<Series[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    try {
      setLoading(true);
      setAllSeries(getAllSeries(db));
    } catch {
      // silently handle
    } finally {
      setLoading(false);
    }
  }, [db]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const create = useCallback(
    (name: string, description?: string) => {
      const id = uuid();
      createSeries(db, id, { name, description });
      refresh();
    },
    [db, refresh],
  );

  const remove = useCallback(
    (id: string) => {
      deleteSeries(db, id);
      refresh();
    },
    [db, refresh],
  );

  const addBook = useCallback(
    (seriesId: string, bookId: string, order: number) => {
      addBookToSeries(db, seriesId, bookId, order);
    },
    [db],
  );

  const removeBook = useCallback(
    (seriesId: string, bookId: string) => {
      removeBookFromSeries(db, seriesId, bookId);
    },
    [db],
  );

  const getBooks = useCallback(
    (seriesId: string): Book[] => {
      return getBooksInSeries(db, seriesId);
    },
    [db],
  );

  const nextUnread = useCallback(
    (seriesId: string): Book | null => {
      return getNextUnread(db, seriesId);
    },
    [db],
  );

  return { allSeries, loading, refresh, create, remove, addBook, removeBook, getBooks, nextUnread };
}
