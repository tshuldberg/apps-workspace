/**
 * App-side bookmarks (plan 33 Phase 5.6, F-010).
 *
 * Optimistic local cache first, cloud write second: toggles feel instant,
 * work offline, and the pending-op queue drains on foreground alongside
 * the vote-proof sweep. Cloud truth reconciles on demand (Saved screen,
 * session start).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  drainPendingSaves,
  getSavedSubmissionIds,
  isSubmissionSavedLocally,
  listCachedSavedIds,
  listSavedSubmissions,
  markSavedLocally,
  markUnsavedLocally,
  reconcileSavedCache,
  saveSubmission,
  unsaveSubmission,
  type DrainPendingSavesResult,
  type SavedSubmissionSummary,
} from '@mylife/bestchef';
import type { DatabaseAdapter } from '@mylife/db';
import type { SocialProfile } from '@mylife/social';
import { isCloudSubmissionId, resolveCloudSubmissionForAppId } from './cloud-submissions';

/**
 * Inline classifier: rate_limited rolls the optimistic toggle back so the
 * user gets honest immediate feedback. RLS/uuid rejections are permanent;
 * anything else (network) retries via the queue.
 */
function isRetryable(error: string): boolean {
  if (error === 'rate_limited') return false;
  if (/permission denied|row-level security|violates|invalid input syntax/i.test(error)) return false;
  return true;
}

/**
 * Sweep classifier: in the background queue rate_limited is a transient
 * window (same call as the proof sweep), so it stays queued.
 */
function isSweepRetryable(error: string): boolean {
  if (error === 'rate_limited') return true;
  return isRetryable(error);
}

export function isSaved(db: DatabaseAdapter, submissionId: string): boolean {
  return isSubmissionSavedLocally(db, submissionId);
}

/**
 * Toggle a bookmark. Local cache updates immediately; the cloud write is
 * attempted inline and left queued (pending_op) when it fails retryably.
 * Returns the new saved state.
 */
export async function toggleSaved(
  db: DatabaseAdapter,
  submissionId: string,
  cloud: { supabase: SupabaseClient | null; profile: SocialProfile | null },
): Promise<boolean> {
  const next = !isSubmissionSavedLocally(db, submissionId);
  if (next) {
    markSavedLocally(db, submissionId);
  } else {
    markUnsavedLocally(db, submissionId);
  }

  // App-local ids must resolve to the cloud UUID before any cloud write;
  // re-key the optimistic row so the queue never carries an unusable id.
  let cloudId = submissionId;
  if (!isCloudSubmissionId(submissionId) && cloud.profile) {
    const resolution = await resolveCloudSubmissionForAppId(db, cloud.profile, submissionId);
    if (resolution.ok) {
      cloudId = resolution.cloudId;
      markUnsavedLocally(db, submissionId, { pending: false });
      if (next) {
        markSavedLocally(db, cloudId);
      } else {
        markUnsavedLocally(db, cloudId);
      }
    } else if (resolution.permanent) {
      // Submission is gone: nothing to bookmark. Roll back.
      markUnsavedLocally(db, submissionId, { pending: false });
      return false;
    }
    // Transient resolution failure: the local-keyed pending row stays; the
    // sweep resolves it later.
  }

  if (cloud.supabase && cloud.profile && isCloudSubmissionId(cloudId)) {
    const input = { submissionId: cloudId, profileId: cloud.profile.id };
    const result = next
      ? await saveSubmission(input, cloud.supabase)
      : await unsaveSubmission(input, cloud.supabase);
    if (result.ok) {
      if (next) {
        markSavedLocally(db, cloudId, { pending: false });
      } else {
        markUnsavedLocally(db, cloudId, { pending: false });
      }
    } else if (!isRetryable(result.error)) {
      // Roll the optimistic change back so the UI never lies.
      if (next) {
        markUnsavedLocally(db, cloudId, { pending: false });
      } else {
        markSavedLocally(db, cloudId, { pending: false });
      }
      return !next;
    }
    // Retryable failure: the pending op stays queued for the sweep.
  }

  return next;
}

/** Pull cloud truth for the given feed page into the local cache. */
export async function refreshSavedStateFor(
  db: DatabaseAdapter,
  submissionIds: string[],
  cloud: { supabase: SupabaseClient | null; profile: SocialProfile | null },
): Promise<void> {
  if (!cloud.supabase || !cloud.profile || submissionIds.length === 0) return;
  const result = await getSavedSubmissionIds(
    { profileId: cloud.profile.id, submissionIds },
    cloud.supabase,
  );
  if (!result.ok) return;
  const savedSet = new Set(result.data);
  for (const submissionId of submissionIds) {
    const locallyPending = db.query<{ pending_op: string | null }>(
      `SELECT pending_op FROM rc_saved_submissions_cache WHERE submission_id = ? LIMIT 1`,
      [submissionId],
    )[0]?.pending_op;
    if (locallyPending) continue; // queued local intent wins until drained
    if (savedSet.has(submissionId)) {
      markSavedLocally(db, submissionId, { pending: false });
    } else {
      markUnsavedLocally(db, submissionId, { pending: false });
    }
  }
}

/** Full reconcile + display list for the Saved screen. */
export async function loadSavedSubmissions(
  db: DatabaseAdapter,
  cloud: { supabase: SupabaseClient | null; profile: SocialProfile | null },
): Promise<{ items: SavedSubmissionSummary[]; source: 'cloud' | 'local' }> {
  if (cloud.supabase && cloud.profile) {
    const result = await listSavedSubmissions({ profileId: cloud.profile.id }, cloud.supabase);
    if (result.ok) {
      reconcileSavedCache(db, result.data.map((item) => item.submissionId));
      return { items: result.data, source: 'cloud' };
    }
  }
  // Offline: ids only, no display join. The Saved screen renders these as
  // navigable rows without photos.
  const ids = new Set<string>();
  const items: SavedSubmissionSummary[] = [];
  for (const submissionId of listCachedSavedIds(db)) {
    if (ids.has(submissionId)) continue;
    ids.add(submissionId);
    items.push({
      submissionId,
      savedAt: '',
      dishId: null,
      dishName: null,
      title: null,
      photoUrl: null,
      chefHandle: null,
      chefName: null,
    });
  }
  return { items, source: 'local' };
}


/** One best-effort sweep of queued save/unsave ops (foreground hook). */
export async function sweepPendingSaves(
  db: DatabaseAdapter,
  supabase: SupabaseClient,
  profile: SocialProfile,
): Promise<DrainPendingSavesResult> {
  // Memoized app-id -> cloud-UUID resolution (same shape as the proof sweep).
  const resolved = new Map<string, { ok: true; cloudId: string } | { ok: false; permanent: boolean }>();
  const resolveId = async (submissionId: string) => {
    if (isCloudSubmissionId(submissionId)) return { ok: true as const, cloudId: submissionId };
    const cached = resolved.get(submissionId);
    if (cached) return cached;
    let resolution: { ok: true; cloudId: string } | { ok: false; permanent: boolean };
    try {
      resolution = await resolveCloudSubmissionForAppId(db, profile, submissionId);
    } catch {
      resolution = { ok: false, permanent: false };
    }
    resolved.set(submissionId, resolution);
    return resolution;
  };

  return drainPendingSaves(db, {
    save: async (submissionId) => {
      const resolution = await resolveId(submissionId);
      if (!resolution.ok) return { ok: false, retryable: !resolution.permanent };
      const result = await saveSubmission({ submissionId: resolution.cloudId, profileId: profile.id }, supabase);
      if (result.ok && resolution.cloudId !== submissionId) {
        // Re-key: the settled row must live under the cloud id.
        markUnsavedLocally(db, submissionId, { pending: false });
        markSavedLocally(db, resolution.cloudId, { pending: false });
      }
      return result.ok ? { ok: true } : { ok: false, retryable: isSweepRetryable(result.error) };
    },
    unsave: async (submissionId) => {
      const resolution = await resolveId(submissionId);
      if (!resolution.ok) return { ok: false, retryable: !resolution.permanent };
      const result = await unsaveSubmission({ submissionId: resolution.cloudId, profileId: profile.id }, supabase);
      return result.ok ? { ok: true } : { ok: false, retryable: isSweepRetryable(result.error) };
    },
    stopOnFailure: true,
  });
}
