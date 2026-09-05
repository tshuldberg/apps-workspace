import { useState, useEffect, useCallback } from 'react';
import { useDatabase } from '../../components/DatabaseProvider';
import {
  evaluateBadges,
  gatherBadgeStats,
  BADGE_CATEGORIES,
  type BadgeEvaluationResult,
  type BadgeStats,
  type BadgeProgress,
} from '@mylife/books';

export function useBadges() {
  const db = useDatabase();
  const [evaluation, setEvaluation] = useState<BadgeEvaluationResult | null>(null);
  const [stats, setStats] = useState<BadgeStats | null>(null);
  const [loading, setLoading] = useState(true);

  const evaluate = useCallback(() => {
    try {
      setLoading(true);
      const result = evaluateBadges(db);
      setEvaluation(result);
      const s = gatherBadgeStats(db);
      setStats(s);
    } catch {
      // silently handle
    } finally {
      setLoading(false);
    }
  }, [db]);

  const refresh = evaluate;

  useEffect(() => {
    evaluate();
  }, [evaluate]);

  const badgesByCategory: Record<string, BadgeProgress[]> = {};
  if (evaluation) {
    for (const progress of evaluation.allProgress) {
      const cat = progress.badge.category;
      if (!badgesByCategory[cat]) {
        badgesByCategory[cat] = [];
      }
      badgesByCategory[cat].push(progress);
    }
  }

  return {
    evaluation,
    stats,
    categories: BADGE_CATEGORIES,
    badgesByCategory,
    loading,
    refresh,
    evaluate,
  };
}
