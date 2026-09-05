import { useEffect, useState } from 'react';
import { getChefBestRank, getTopSubmissionsThisWeek } from '@mylife/bestchef';
import type { Submission } from '@mylife/bestchef';
import { useDatabase } from '../providers/DatabaseProvider';
import { useBestChefCloud } from '../providers/BestChefCloudProvider';
import { getLocalChefStats } from '../data/local-submissions';

// ── Cook streak ───────────────────────────────────────────────────────

/**
 * Day streak derived from local submission activity. A streak is the number
 * of consecutive days (ending today) on which the chef made at least one
 * submission or vote cast. For now we derive it from submissions count as a
 * proxy until a dedicated streak table lands (P4).
 */
export function useCookStreak(): { value: number | null; loading: boolean } {
  const db = useDatabase();
  const [value, setValue] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const stats = getLocalChefStats(db);
      // Proxy: use submissions count capped at 365 until streak table exists
      setValue(Math.min(stats.submissions, 365));
    } catch {
      setValue(0);
    } finally {
      setLoading(false);
    }
  }, [db]);

  return { value, loading };
}

// ── Chef rank ─────────────────────────────────────────────────────────

/**
 * Best rank this chef holds across all dishes on the cloud leaderboard.
 */
export function useChefRank(): { value: number | null; loading: boolean } {
  const { userId, isReady } = useBestChefCloud();
  const [value, setValue] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isReady || !userId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      const result = await getChefBestRank(userId);
      if (cancelled) return;
      setValue(result.ok ? result.data : null);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, isReady]);

  return { value, loading };
}

// ── Reviewed count ────────────────────────────────────────────────────

/**
 * Total reviewed (CookProof gold/silver/bronze) votes the chef's submissions
 * have received across all dishes this week.
 */
export function useReviewedCount(): { value: number | null; loading: boolean } {
  const { isReady } = useBestChefCloud();
  const [value, setValue] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isReady) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      const result = await getTopSubmissionsThisWeek({ limit: 50 });
      if (cancelled) return;
      if (result.ok) {
        const total = (result.data as Submission[]).reduce(
          (sum, s) => sum + (s.reviewedCount ?? 0),
          0,
        );
        setValue(total);
      } else {
        setValue(0);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [isReady]);

  return { value, loading };
}
