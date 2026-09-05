import { useState, useEffect, useCallback } from 'react';
import { useDatabase } from '../../components/DatabaseProvider';
import {
  computeInsights,
  computeGenreEvolution,
  getOnThisDay,
  type InsightSet,
  type GenreEvolutionTimeline,
  type OnThisDayEvent,
} from '@mylife/books';

export function useInsights() {
  const db = useDatabase();
  const [insights, setInsights] = useState<InsightSet | null>(null);
  const [genreEvolution, setGenreEvolution] = useState<GenreEvolutionTimeline | null>(null);
  const [onThisDay, setOnThisDay] = useState<OnThisDayEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    try {
      setLoading(true);
      setInsights(computeInsights(db));
      setGenreEvolution(computeGenreEvolution(db));
      setOnThisDay(getOnThisDay(db));
    } catch {
      // silently handle
    } finally {
      setLoading(false);
    }
  }, [db]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { insights, genreEvolution, onThisDay, loading, refresh };
}
