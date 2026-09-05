import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getLeaderboardSubmissions,
  initBestChefClient,
  type LeaderboardKind,
  type LeaderboardRange,
  type Submission,
} from '@mylife/bestchef';
import { useBestChefCloud } from '../providers/BestChefCloudProvider';

export interface UseLeaderboardEntriesParams {
  kind: LeaderboardKind;
  subFilter: string | null;
  range?: LeaderboardRange;
  /** Lowercase language tag; restricts to UGC in that language (Phase 2.5). */
  language?: string | null;
}

export interface UseLeaderboardEntriesResult {
  entries: Submission[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useLeaderboardEntries({
  kind,
  subFilter,
  range = 'all',
  language = null,
}: UseLeaderboardEntriesParams): UseLeaderboardEntriesResult {
  const { isConfigured, supabase } = useBestChefCloud();
  const [entries, setEntries] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestRef = useRef(0);

  const load = useCallback(async () => {
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;

    if (!isConfigured) {
      setEntries([]);
      setError('BestChef cloud is not configured.'); // natural i18n key, screen renders t(error)
      setLoading(false);
      return;
    }

    if (!supabase) {
      setEntries([]);
      setError('BestChef cloud client is not available.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      initBestChefClient(supabase);
      const result = await getLeaderboardSubmissions({
        kind,
        subFilter,
        limit: 100,
        range,
        language: language ?? undefined,
      });

      if (requestRef.current !== requestId) return;

      if (!result.ok) {
        setEntries([]);
        setError(result.error);
        setLoading(false);
        return;
      }

      setEntries(result.data);
      setLoading(false);
    } catch (err) {
      if (requestRef.current !== requestId) return;
      setEntries([]);
      setError(err instanceof Error ? err.message : String(err));
      setLoading(false);
    }
  }, [isConfigured, kind, language, range, subFilter, supabase]);

  useEffect(() => {
    void load();
    return () => {
      requestRef.current += 1;
    };
  }, [load]);

  return { entries, loading, error, refresh: load };
}
