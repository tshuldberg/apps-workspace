/**
 * Drains the submission media upload queue when the app becomes active
 * and the cloud session is ready (plan 33 Phase 4.4). Requeues jobs left
 * mid-flight by an app death, then processes with progress persisted to
 * the job rows. Mirrors usePendingProofSweep.
 */

import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useDatabase } from '../providers/DatabaseProvider';
import { useBestChefCloud } from '../providers/BestChefCloudProvider';
import { sweepMediaUploadJobs } from '../data/media-upload-worker';

export function useMediaUploadSweep(): void {
  const db = useDatabase();
  const cloud = useBestChefCloud();
  const sweepingRef = useRef(false);

  const ready = cloud.isReady && !!cloud.profile && !!cloud.supabase;

  useEffect(() => {
    if (!ready || !cloud.supabase) return;
    const supabase = cloud.supabase;

    const sweep = () => {
      if (sweepingRef.current) return;
      sweepingRef.current = true;
      sweepMediaUploadJobs(db, supabase)
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
  }, [db, ready, cloud.supabase]);
}
