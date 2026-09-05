/**
 * Pending vote-proof draft sweep (plan 33 Phase 3.3).
 *
 * Offline drafts queued by the reviewed-vote flow promised "the vote will
 * retry", but drainPendingProofs had no production caller (2.2 review
 * flag). This module gives it one: uploads the draft photo through the
 * standard intent -> PUT -> finalize path and casts the vote, using the
 * same typed failure semantics as the live flow.
 *
 * Differences from the interactive flow, on purpose:
 * - Draft submission ids may be app-local ids; they are resolved to cloud
 *   UUIDs through the same alias bridge the live cast path uses.
 * - rate_limited and auth failures are treated as retryable here: in a
 *   background sweep they are transient (daily quota window, token
 *   refresh), and permanently failing a queued vote on them would break
 *   the "your vote will retry" promise.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  castVoteWithProof,
  completeVoteProofUpload,
  createVoteProofMediaAsset,
  drainPendingProofs,
  mediaUploadFailure,
  type DrainPendingProofsResult,
  type LocalVoteProofDraft,
  type MediaUploadFailure,
  type VoteProofUploadResult,
} from '@mylife/bestchef';
import type { DatabaseAdapter } from '@mylife/db';
import type { SocialProfile } from '@mylife/social';
import { fileIsMissing, readFileBytes } from '../utils/file-bytes';
import { resolveCloudSubmissionForAppId, type CloudSubmissionResolution } from './cloud-submissions';

/** Media failure codes that stay retryable in the background sweep. */
const SWEEP_RETRYABLE_OVERRIDES = new Set(['rate_limited', 'auth']);

function sweepRetryable(failure: MediaUploadFailure): boolean {
  return failure.retryable || SWEEP_RETRYABLE_OVERRIDES.has(failure.code);
}

async function readDraftBytes(
  localImageUri: string,
): Promise<{ ok: true; bytes: Uint8Array } | { ok: false; missing: boolean }> {
  try {
    return { ok: true, bytes: await readFileBytes(localImageUri) };
  } catch {
    return { ok: false, missing: await fileIsMissing(localImageUri) };
  }
}

/** Same typed PUT failure semantics as the live reviewed-vote flow. */
async function putProofBytes(
  supabase: SupabaseClient,
  upload: { bucket: string; key: string; token: string | null; signedUploadUrl: string },
  bytes: Uint8Array,
): Promise<MediaUploadFailure | null> {
  try {
    if (upload.token) {
      const { error } = await supabase.storage
        .from(upload.bucket)
        .uploadToSignedUrl(upload.key, upload.token, bytes, { contentType: 'image/jpeg' });
      if (error) {
        const rawStatus = (error as { statusCode?: string | number }).statusCode;
        const status = typeof rawStatus === 'string' ? Number.parseInt(rawStatus, 10) : rawStatus;
        return mediaUploadFailure(status === 413 ? 'file_too_large' : 'service_unavailable');
      }
      return null;
    }
    const res = await fetch(upload.signedUploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'image/jpeg', 'x-upsert': 'false' },
      body: bytes as unknown as RequestInit['body'],
    });
    if (!res.ok) {
      return mediaUploadFailure(res.status === 413 ? 'file_too_large' : 'service_unavailable');
    }
    return null;
  } catch {
    return mediaUploadFailure('network');
  }
}

async function uploadDraftProof(
  supabase: SupabaseClient,
  cloudSubmissionId: string,
  draft: LocalVoteProofDraft,
): Promise<VoteProofUploadResult> {
  const read = await readDraftBytes(draft.localImageUri);
  if (!read.ok) {
    // Only a verified-missing file is permanent; transient read errors retry.
    return read.missing
      ? { ok: false, error: 'draft_file_missing', retryable: false }
      : { ok: false, error: 'draft_read_failed', retryable: true };
  }
  const bytes = read.bytes;

  const intent = await createVoteProofMediaAsset(
    {
      submissionId: cloudSubmissionId,
      contentHash: draft.contentHash,
      byteSize: bytes.byteLength,
    },
    supabase,
  );
  if (!intent.ok) {
    return { ok: false, error: intent.code, retryable: sweepRetryable(intent) };
  }

  const putFailure = await putProofBytes(supabase, intent.data, bytes);
  if (putFailure) {
    return { ok: false, error: putFailure.code, retryable: sweepRetryable(putFailure) };
  }

  const finalized = await completeVoteProofUpload(
    {
      assetId: intent.data.assetId,
      contentHash: draft.contentHash,
      byteSize: bytes.byteLength,
    },
    supabase,
  );
  if (!finalized.ok) {
    return { ok: false, error: finalized.code, retryable: sweepRetryable(finalized) };
  }

  return { ok: true, mediaAssetId: intent.data.assetId };
}

/**
 * One best-effort sweep of all pending drafts. stopOnFailure keeps a dead
 * network from burning through every draft's attempt budget in one pass.
 */
export async function sweepPendingProofDrafts(
  db: DatabaseAdapter,
  supabase: SupabaseClient,
  profile: SocialProfile,
): Promise<DrainPendingProofsResult> {
  // Memoized app-id -> cloud-UUID resolution, shared by both legs.
  // Permanent misses (submission gone, policy-gated) fail the draft;
  // transient misses (alias bridge offline) keep it queued for retry.
  const resolved = new Map<string, CloudSubmissionResolution>();
  const resolveSubmissionId = async (submissionId: string): Promise<CloudSubmissionResolution> => {
    const cached = resolved.get(submissionId);
    if (cached) return cached;
    let resolution: CloudSubmissionResolution;
    try {
      resolution = await resolveCloudSubmissionForAppId(db, profile, submissionId);
    } catch {
      resolution = { ok: false, permanent: false };
    }
    resolved.set(submissionId, resolution);
    return resolution;
  };

  return drainPendingProofs(db, {
    uploadProof: async (draft) => {
      const resolution = await resolveSubmissionId(draft.submissionId);
      if (!resolution.ok) {
        return { ok: false, error: 'submission_not_found', retryable: !resolution.permanent };
      }
      return uploadDraftProof(supabase, resolution.cloudId, draft);
    },
    castVote: async (input) => {
      const resolution = await resolveSubmissionId(input.submissionId);
      if (!resolution.ok) {
        return {
          ok: false,
          code: 'submission_not_found',
          message: 'This recipe submission is no longer available.',
          retryable: !resolution.permanent,
        };
      }
      const cast = await castVoteWithProof({ ...input, submissionId: resolution.cloudId, supabase });
      // Same background-sweep override as the media legs: a durable vote
      // quota window or a token refresh must not permanently drop a queued
      // vote. The draft stays in 'committing' and retries next sweep.
      if (!cast.ok && (cast.code === 'rate_limited' || cast.code === 'unauthenticated')) {
        return { ...cast, retryable: true };
      }
      return cast;
    },
    stopOnFailure: true,
  });
}
