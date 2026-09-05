import { useState, useEffect, useRef } from 'react';
import { searchBooksRanked, type OLSearchDoc } from '@mylife/books';

export function useOpenLibrarySearch(query: string) {
  const [results, setResults] = useState<OLSearchDoc[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    if (query.trim().length < 2) {
      setResults([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    let cancelled = false;

    // Debounce 300ms
    timerRef.current = setTimeout(async () => {
      try {
        const response = await searchBooksRanked(query, 20);
        if (!cancelled) {
          setResults(response.docs);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e : new Error(String(e)));
          setResults([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }, 300);

    return () => {
      cancelled = true;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [query]);

  return { results, loading, error };
}
