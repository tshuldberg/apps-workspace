/**
 * Runs the pending vote-proof draft sweep when the app becomes active and
 * the cloud session is ready (plan 33 Phase 3.3). Best-effort and
 * re-entrancy-guarded; failures stay in the local draft queue for the
 * next sweep.
 */

import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useDatabase } from '../providers/DatabaseProvider';
import { useBestChefCloud } from '../providers/BestChefCloudProvider';
import { sweepPendingProofDrafts } from '../data/proof-sweep';

export function usePendingProofSweep(): void {
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
      sweepPendingProofDrafts(db, supabase, profile)
        .catch(() => undefined)
        .finally(() => {
          sweepingRef.current = false;
        });
    };

    // Once when the session becomes ready, then on every foreground return.
    sweep();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') sweep();
    });
    return () => subscription.remove();
  }, [db, ready, cloud.supabase, cloud.profile]);
}
