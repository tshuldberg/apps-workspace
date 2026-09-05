import { useState, useEffect, useCallback } from 'react';
import { useDatabase } from '../../components/DatabaseProvider';
import {
  discoverBooks,
  discoverNewBooks,
  getDistinctMoodValues,
  getDistinctWarnings,
  type Book,
  type DiscoveryFilters,
  type DiscoverySuggestion,
} from '@mylife/books';

export function useDiscovery() {
  const db = useDatabase();
  const [results, setResults] = useState<Book[]>([]);
  const [filters, setFilters] = useState<DiscoveryFilters>({});
  const [availableMoods, setAvailableMoods] = useState<string[]>([]);
  const [availablePaces, setAvailablePaces] = useState<string[]>([]);
  const [availableGenres, setAvailableGenres] = useState<string[]>([]);
  const [availableWarnings, setAvailableWarnings] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    try {
      setLoading(true);
      setResults(discoverBooks(db, filters));
      setAvailableMoods(getDistinctMoodValues(db, 'mood'));
      setAvailablePaces(getDistinctMoodValues(db, 'pace'));
      setAvailableGenres(getDistinctMoodValues(db, 'genre'));
      setAvailableWarnings(getDistinctWarnings(db));
    } catch {
      // silently handle
    } finally {
      setLoading(false);
    }
  }, [db, filters]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    results,
    filters,
    setFilters,
    availableMoods,
    availablePaces,
    availableGenres,
    availableWarnings,
    loading,
    refresh,
  };
}

export function useExternalDiscovery() {
  const db = useDatabase();
  const [suggestions, setSuggestions] = useState<DiscoverySuggestion[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const results = await discoverNewBooks(db);
      setSuggestions(results);
    } catch {
      // Silently fail -- discovery is non-critical
    } finally {
      setLoading(false);
    }
  }, [db]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { suggestions, loading, refresh };
}
