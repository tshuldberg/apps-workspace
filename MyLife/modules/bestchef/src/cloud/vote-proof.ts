import type { SupabaseClient } from '@supabase/supabase-js';
import { err, getBestChefClient, ok, type BestChefResult } from './client';
import {
  mediaFailureFromInvokeError,
  mediaUploadFailure,
  type MediaUploadResult,
} from './media-errors';

export const VOTE_PROOF_MAX_BYTES = 2 * 1024 * 1024;
export const VOTE_PROOF_MIME_TYPE = 'image/jpeg';

export interface VoteProofMediaAssetInput {
  submissionId: string;
  contentHash: string;
  byteSize: number;
  mimeType?: string;
}

export interface VoteProofMediaAssetUpload {
  assetId: string;
  bucket: string;
  key: string;
  signedUploadUrl: string;
  token: string | null;
  maxBytes: number;
  uploadStatus: string;
  moderationStatus: string;
}

export interface CompleteVoteProofUploadInput {
  assetId: string;
  contentHash: string;
  byteSize: number;
  width?: number | null;
  height?: number | null;
}

export interface CompleteVoteProofUploadResult {
  assetId: string;
  uploadStatus: string;
  moderationStatus: string;
  visibility: string;
}

type FunctionInvokeResult<T> = {
  data: T | null;
  error: { message?: string } | null;
};

interface VoteProofFunctionClient {
  functions: {
    invoke<T>(
      fn: string,
      options: { body: Record<string, unknown> },
    ): Promise<FunctionInvokeResult<T>>;
  };
}

function clientOrDefault(supabase?: SupabaseClient | VoteProofFunctionClient): VoteProofFunctionClient {
  return (supabase ?? getBestChefClient()) as unknown as VoteProofFunctionClient;
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function numberValue(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function validateUploadInput(input: VoteProofMediaAssetInput) {
  if (!input.submissionId || !input.contentHash) {
    return mediaUploadFailure('invalid_input');
  }
  if (!Number.isFinite(input.byteSize) || input.byteSize <= 0) {
    return mediaUploadFailure('invalid_input');
  }
  if (input.byteSize > VOTE_PROOF_MAX_BYTES) {
    return mediaUploadFailure('file_too_large', {
      maxMb: Math.max(1, Math.round(VOTE_PROOF_MAX_BYTES / (1024 * 1024))),
    });
  }
  return null;
}

export async function createVoteProofMediaAsset(
  input: VoteProofMediaAssetInput,
  supabase?: SupabaseClient | VoteProofFunctionClient,
): Promise<MediaUploadResult<VoteProofMediaAssetUpload>> {
  const validationFailure = validateUploadInput(input);
  if (validationFailure) return validationFailure;

  try {
    const { data, error } = await clientOrDefault(supabase).functions.invoke<Record<string, unknown>>(
      'bestchef-media-upload',
      {
        body: {
          ownerKind: 'vote_proof',
          ownerId: input.submissionId,
          mediaKind: 'image',
          mimeType: input.mimeType ?? VOTE_PROOF_MIME_TYPE,
          byteSize: input.byteSize,
          contentHash: input.contentHash,
        },
      },
    );

    if (error) return await mediaFailureFromInvokeError(error);
    if (!data || data.ok !== true) return mediaUploadFailure('unknown');

    return {
      ok: true,
      data: {
        assetId: stringValue(data.assetId),
        bucket: stringValue(data.bucket),
        key: stringValue(data.key),
        signedUploadUrl: stringValue(data.signedUploadUrl),
        token: stringOrNull(data.token),
        maxBytes: numberValue(data.maxBytes),
        uploadStatus: stringValue(data.uploadStatus),
        moderationStatus: stringValue(data.moderationStatus),
      },
    };
  } catch (caught) {
    return await mediaFailureFromInvokeError(caught);
  }
}

// ── Reviewed votes list ───────────────────────────────────────────────

export interface ReviewedVoteRow {
  id: string;
  submissionId: string;
  voterProfileId: string;
  tier: string;
  /** Reviewer's verdict label (e.g. "Loved it", "Mixed"). */
  verdict: string | null;
  /** Star rating 1-5. */
  rating: number | null;
  /** Free-text notes from the reviewer. */
  notes: string | null;
  /** Display name snapshot from the reviewer's profile. */
  reviewerName: string | null;
  /** Whether the reviewer's profile is marked as a restaurant. */
  reviewerIsRestaurant: boolean;
  createdAt: Date;
}

export interface GetReviewedVotesOptions {
  submissionId: string;
  limit?: number;
}

/**
 * Fetch the most recent reviewed votes (gold/silver/bronze) for a submission,
 * joined with the voter's profile snapshot for display.
 */
export async function getReviewedVotesForSubmission(
  supabase: SupabaseClient,
  options: GetReviewedVotesOptions,
): Promise<BestChefResult<ReviewedVoteRow[]>> {
  const limit = options.limit ?? 5;

  const { data, error } = await supabase
    .from('bc_votes')
    .select(`
      id,
      submission_id,
      voter_profile_id,
      tier,
      verdict,
      rating,
      notes,
      created_at,
      bc_profiles!voter_profile_id (
        display_name,
        is_restaurant
      )
    `)
    .eq('submission_id', options.submissionId)
    .in('tier', ['gold', 'silver', 'bronze'])
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) return err(error.message);

  const rows: ReviewedVoteRow[] = (data ?? []).map((row) => {
    const profile = Array.isArray(row.bc_profiles)
      ? row.bc_profiles[0]
      : row.bc_profiles;
    return {
      id: row.id as string,
      submissionId: row.submission_id as string,
      voterProfileId: row.voter_profile_id as string,
      tier: row.tier as string,
      verdict: (row.verdict as string | null) ?? null,
      rating: typeof row.rating === 'number' ? row.rating : null,
      notes: (row.notes as string | null) ?? null,
      reviewerName: profile && typeof (profile as Record<string, unknown>).display_name === 'string'
        ? (profile as Record<string, unknown>).display_name as string
        : null,
      reviewerIsRestaurant: profile
        ? Boolean((profile as Record<string, unknown>).is_restaurant)
        : false,
      createdAt: new Date(row.created_at as string),
    };
  });

  return ok(rows);
}

export async function completeVoteProofUpload(
  input: CompleteVoteProofUploadInput,
  supabase?: SupabaseClient | VoteProofFunctionClient,
): Promise<MediaUploadResult<CompleteVoteProofUploadResult>> {
  if (!input.assetId || !input.contentHash) return mediaUploadFailure('invalid_input');
  if (!Number.isFinite(input.byteSize) || input.byteSize <= 0) {
    return mediaUploadFailure('invalid_input');
  }

  try {
    const { data, error } = await clientOrDefault(supabase).functions.invoke<Record<string, unknown>>(
      'bestchef-media-finalize',
      {
        body: {
          assetId: input.assetId,
          width: input.width ?? null,
          height: input.height ?? null,
          byteSize: input.byteSize,
          contentHash: input.contentHash,
        },
      },
    );

    if (error) return await mediaFailureFromInvokeError(error);
    if (!data || data.ok !== true) return mediaUploadFailure('unknown');

    return {
      ok: true,
      data: {
        assetId: stringValue(data.assetId),
        uploadStatus: stringValue(data.uploadStatus),
        moderationStatus: stringValue(data.moderationStatus),
        visibility: stringValue(data.visibility),
      },
    };
  } catch (caught) {
    return await mediaFailureFromInvokeError(caught);
  }
}

