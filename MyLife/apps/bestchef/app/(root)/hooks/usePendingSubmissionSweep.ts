/**
 * Retries queued offline submissions when the app becomes active and the
 * cloud session is ready (plan 33 Phase 4.4 follow-up: the sweeper was
 * exported but mounted nowhere, so queued submissions never retried
 * without the user finding the manual Retry button).
 *
 * Before replaying, payloads are reconciled against the media upload
 * queue: a photo the queue finished uploading after the submission was
 * queued is patched in, so replays never publish photoless when a photo
 * exists.
 */

import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import {
  listMediaJobsForOwner,
  listPendingSubmissions,
  runPendingSubmissionSweep,
  updatePendingSubmissionPhotoUrl,
} from '@mylife/bestchef';
import type { DatabaseAdapter } from '@mylife/db';
import { useDatabase } from '../providers/DatabaseProvider';
import { useBestChefCloud } from '../providers/BestChefCloudProvider';

function reconcilePhotoUrls(db: DatabaseAdapter): void {
  for (const pending of listPendingSubmissions(db)) {
    const photoUrl = pending.payload.photoUrl;
    if (photoUrl && photoUrl.startsWith('https://')) continue;
    const uploaded = listMediaJobsForOwner(db, pending.localId).find(
      (job) => job.mediaKind === 'image' && job.status === 'done' && job.publicUrl,
    );
    if (uploaded?.publicUrl) {
      updatePendingSubmissionPhotoUrl(db, pending.localId, uploaded.publicUrl);
    }
  }
}

export function usePendingSubmissionSweep(): void {
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
      void (async () => {
        try {
          reconcilePhotoUrls(db);
          await runPendingSubmissionSweep(supabase, db);
        } catch {
          // Best effort; the queue rows keep their next_attempt_at backoff.
        } finally {
          sweepingRef.current = false;
        }
      })();
    };

    sweep();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') sweep();
    });
    return () => subscription.remove();
  }, [db, ready, cloud.supabase]);
}
