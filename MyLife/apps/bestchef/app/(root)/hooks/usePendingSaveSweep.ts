/**
 * Drains queued bookmark save/unsave ops when the app becomes active and
 * the cloud session is ready (plan 33 Phase 5.6, F-010). Mirrors
 * usePendingProofSweep: best-effort, re-entrancy-guarded, failures stay
 * queued for the next sweep.
 */

import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useDatabase } from '../providers/DatabaseProvider';
import { useBestChefCloud } from '../providers/BestChefCloudProvider';
import { sweepPendingSaves } from '../data/saved-submissions';

export function usePendingSaveSweep(): void {
  const db = useDatabase();
  const cloud = useBestChefCloud();
  const sweepingRef = useRef(false);

  const ready = cloud.isReady && !!cloud.profile && !!cloud.supabase;

  useEffect(() => {
    if (!ready || !cloud.supabase || !cloud.profile) return;
    const supabase = cloud.supabase;
    const profile = cloud.profile;

    const sweep = () => {
      if (sweepingRef.current) return;
      sweepingRef.current = true;
      sweepPendingSaves(db, supabase, profile)
        .catch(() => undefined)
        .finally(() => {
          sweepingRef.current = false;
        });
    };

    sweep();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') sweep();
    });
    return () => subscription.remove();
  }, [db, ready, cloud.supabase, cloud.profile]);
}
