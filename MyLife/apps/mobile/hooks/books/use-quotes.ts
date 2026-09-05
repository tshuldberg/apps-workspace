import { useState, useEffect, useCallback } from 'react';
import { useDatabase } from '../../components/DatabaseProvider';
import { uuid } from '../../lib/uuid';
import {
  createQuote,
  getQuotes,
  updateQuote,
  deleteQuote,
  getRandomQuote,
  getFavoriteQuotes,
  getQuoteCount,
  type QuoteWithBook,
  type CreateQuoteInput,
  type QuoteFilter,
} from '@mylife/books';

export function useQuotes(initialFilter?: QuoteFilter) {
  const db = useDatabase();
  const [quotes, setQuotes] = useState<QuoteWithBook[]>([]);
  const [random, setRandom] = useState<QuoteWithBook | null>(null);
  const [favorites, setFavorites] = useState<QuoteWithBook[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    try {
      setLoading(true);
      setQuotes(getQuotes(db, initialFilter));
      setRandom(getRandomQuote(db));
      setFavorites(getFavoriteQuotes(db));
      setCount(getQuoteCount(db));
    } catch {
      // silently handle
    } finally {
      setLoading(false);
    }
  }, [db, initialFilter]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const create = useCallback(
    (input: CreateQuoteInput) => {
      const id = uuid();
      createQuote(db, id, input);
      refresh();
    },
    [db, refresh],
  );

  const update = useCallback(
    (id: string, updates: Partial<Pick<CreateQuoteInput, 'content' | 'page_number' | 'chapter' | 'note' | 'is_favorite'>>) => {
      updateQuote(db, id, updates);
      refresh();
    },
    [db, refresh],
  );

  const remove = useCallback(
    (id: string) => {
      deleteQuote(db, id);
      refresh();
    },
    [db, refresh],
  );

  const search = useCallback(
    (text: string) => {
      const results = getQuotes(db, { searchText: text });
      setQuotes(results);
    },
    [db],
  );

  const toggleFavorite = useCallback(
    (id: string, current: number) => {
      updateQuote(db, id, { is_favorite: current ? 0 : 1 });
      refresh();
    },
    [db, refresh],
  );

  const refreshRandom = useCallback(() => {
    setRandom(getRandomQuote(db));
  }, [db]);

  return { quotes, random, favorites, count, loading, refresh, create, update, remove, search, toggleFavorite, refreshRandom };
}
