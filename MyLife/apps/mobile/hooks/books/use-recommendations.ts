import { useState, useEffect, useCallback } from 'react';
import { useDatabase } from '../../components/DatabaseProvider';
import {
  computeRecommendations,
  type RecommendationSet,
} from '@mylife/books';

export function useRecommendations() {
  const db = useDatabase();
  const [recommendations, setRecommendations] = useState<RecommendationSet | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    try {
      setLoading(true);
      setRecommendations(computeRecommendations(db));
    } catch {
      // silently handle
    } finally {
      setLoading(false);
    }
  }, [db]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { recommendations, loading, refresh };
}
