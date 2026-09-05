/**
 * Submission photo upload helper.
 *
 * Mirrors the vote-proof upload pattern: invoke `bestchef-media-upload` to
 * obtain a signed upload URL, PUT bytes to Supabase Storage, invoke
 * `bestchef-media-finalize` to mark the asset uploaded, and resolve the
 * public https URL via `storage.from(bucket).getPublicUrl(key)`.
 *
 * Required because `bc_submissions.photo_url` is constrained to https URLs
 * by `bc_submissions_photo_url_https`. Local file:// URIs from
 * expo-image-picker must be uploaded to storage first.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { getBestChefClient } from './client';
import {
  mediaFailureFromInvokeError,
  mediaUploadFailure,
  type MediaUploadResult,
} from './media-errors';

export const SUBMISSION_PHOTO_DEFAULT_MIME = 'image/jpeg';
export const SUBMISSION_VIDEO_DEFAULT_MIME = 'video/mp4';

export type SubmissionMediaKind = 'image' | 'video';

export interface UploadSubmissionPhotoInput {
  /** Profile id (or local submission id) used as `ownerId` for the upload intent. */
  ownerId: string;
  /** Local file:// or content:// URI from expo-image-picker / RN. */
  localUri: string;
  /** Resolved byte size of the encoded media. */
  byteSize: number;
  /** sha256 hex digest of the encoded media bytes. */
  contentHash: string;
  /** Defaults to image/jpeg for images, video/mp4 for videos. */
  mimeType?: string;
  /** Defaults to 'image'. */
  mediaKind?: SubmissionMediaKind;
}

export interface UploadSubmissionPhotoResult {
  /** https public URL safe to write to `bc_submissions.photo_url`. */
  publicUrl: string;
  /** Storage asset id returned by `bestchef-media-upload`. */
  assetId: string;
  /** Bucket name (e.g. `bestchef-submission-images`). */
  bucket: string;
  /** Storage key inside the bucket. */
  key: string;
}

type FunctionInvokeResult<T> = {
  data: T | null;
  error: { message?: string } | null;
};

interface UploadFunctionClient {
  functions: {
    invoke<T>(
      fn: string,
      options: { body: Record<string, unknown> },
    ): Promise<FunctionInvokeResult<T>>;
  };
  storage: {
    from(bucket: string): {
      getPublicUrl(path: string): { data: { publicUrl: string } };
      uploadToSignedUrl(
        path: string,
        token: string,
        body: ArrayBuffer | Blob | Uint8Array,
        options?: { contentType?: string },
      ): Promise<{ error: { message?: string; statusCode?: string | number } | null }>;
    };
  };
}

function clientOrDefault(
  supabase?: SupabaseClient | UploadFunctionClient,
): UploadFunctionClient {
  return (supabase ?? getBestChefClient()) as unknown as UploadFunctionClient;
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function validateInput(input: UploadSubmissionPhotoInput): boolean {
  if (!input.ownerId || !input.localUri || !input.contentHash) return false;
  if (!Number.isFinite(input.byteSize) || input.byteSize <= 0) return false;
  return true;
}

/**
 * Upload a local image (or video) to Supabase Storage and resolve its public
 * https URL.
 *
 * Three steps:
 *   1. Invoke `bestchef-media-upload` for a signed upload URL.
 *   2. PUT (or `uploadToSignedUrl`) the local bytes to that URL.
 *   3. Invoke `bestchef-media-finalize` to mark the asset uploaded.
 *
 * Returns the public URL ready to be written to `bc_submissions.photo_url`.
 */
export interface SubmissionMediaIntent {
  assetId: string;
  bucket: string;
  key: string;
  signedUploadUrl: string;
  token: string | null;
}

/**
 * Leg 1 of the submission media pipeline: request a signed upload slot.
 * Exported so the app upload queue (plan 33 Phase 4.4) can drive the PUT
 * leg itself with progress + cancellation.
 */
export async function createSubmissionMediaIntent(
  input: {
    ownerId: string;
    mediaKind: SubmissionMediaKind;
    mimeType: string;
    byteSize: number;
    /** Nullable: hashing a 150MB video in JS OOM-kills the app; the server
     * accepts null (plan 33 Phase 4.4 review P0). */
    contentHash: string | null;
  },
  supabase?: SupabaseClient | UploadFunctionClient,
): Promise<MediaUploadResult<SubmissionMediaIntent>> {
  const client = clientOrDefault(supabase);
  try {
    const { data, error } = await client.functions.invoke<Record<string, unknown>>(
      'bestchef-media-upload',
      {
        body: {
          ownerKind: 'submission',
          ownerId: input.ownerId,
          mediaKind: input.mediaKind,
          mimeType: input.mimeType,
          byteSize: input.byteSize,
          contentHash: input.contentHash,
        },
      },
    );

    if (error) return await mediaFailureFromInvokeError(error);
    if (!data || data.ok !== true) {
      return mediaUploadFailure('unknown');
    }

    const intent: SubmissionMediaIntent = {
      assetId: stringValue(data.assetId),
      bucket: stringValue(data.bucket),
      key: stringValue(data.key),
      signedUploadUrl: stringValue(data.signedUploadUrl),
      token: stringOrNull(data.token),
    };
    if (!intent.assetId || !intent.bucket || !intent.key || !intent.signedUploadUrl) {
      return mediaUploadFailure('unknown');
    }
    return { ok: true, data: intent };
  } catch (caught) {
    return await mediaFailureFromInvokeError(caught);
  }
}

/**
 * Leg 3: finalize the uploaded asset and resolve the public URL.
 */
export async function finalizeSubmissionMedia(
  input: {
    intent: SubmissionMediaIntent;
    byteSize: number;
    contentHash: string | null;
    /** Client-known media dimensions (audit M2). Videos supply durationMs so
     * bc_media_assets.duration_ms is populated and feed cards can show it. */
    durationMs?: number | null;
    width?: number | null;
    height?: number | null;
  },
  supabase?: SupabaseClient | UploadFunctionClient,
): Promise<MediaUploadResult<UploadSubmissionPhotoResult>> {
  const client = clientOrDefault(supabase);
  try {
    const { data, error } = await client.functions.invoke<Record<string, unknown>>(
      'bestchef-media-finalize',
      {
        body: {
          assetId: input.intent.assetId,
          width: input.width ?? null,
          height: input.height ?? null,
          durationMs: input.durationMs ?? null,
          byteSize: input.byteSize,
          contentHash: input.contentHash,
        },
      },
    );

    if (error) return await mediaFailureFromInvokeError(error);
    if (!data || data.ok !== true) {
      return mediaUploadFailure('unknown');
    }
  } catch (caught) {
    return await mediaFailureFromInvokeError(caught);
  }

  const { data: pub } = client.storage.from(input.intent.bucket).getPublicUrl(input.intent.key);
  const publicUrl = pub?.publicUrl;
  if (!publicUrl || !publicUrl.startsWith('https://')) {
    return mediaUploadFailure('unknown');
  }

  return {
    ok: true,
    data: {
      publicUrl,
      assetId: input.intent.assetId,
      bucket: input.intent.bucket,
      key: input.intent.key,
    },
  };
}

export async function uploadSubmissionPhoto(
  input: UploadSubmissionPhotoInput,
  supabase?: SupabaseClient | UploadFunctionClient,
): Promise<MediaUploadResult<UploadSubmissionPhotoResult>> {
  if (!validateInput(input)) return mediaUploadFailure('invalid_input');

  const mediaKind = input.mediaKind ?? 'image';
  const mimeType =
    input.mimeType ??
    (mediaKind === 'video'
      ? SUBMISSION_VIDEO_DEFAULT_MIME
      : SUBMISSION_PHOTO_DEFAULT_MIME);

  const client = clientOrDefault(supabase);

  // 1. Request a signed upload URL.
  const intentResult = await createSubmissionMediaIntent(
    {
      ownerId: input.ownerId,
      mediaKind,
      mimeType,
      byteSize: input.byteSize,
      contentHash: input.contentHash,
    },
    client,
  );
  if (!intentResult.ok) return intentResult;
  const intent = intentResult.data;

  // 2. Read the local bytes and upload them. A local read failure is a bad
  // draft file, not a transient condition: invalid_input, never retryable.
  let blob: Blob;
  try {
    const response = await fetch(input.localUri);
    blob = await response.blob();
  } catch {
    return mediaUploadFailure('invalid_input');
  }

  try {
    if (intent.token) {
      const { error } = await client.storage
        .from(intent.bucket)
        .uploadToSignedUrl(intent.key, intent.token, blob, { contentType: mimeType });
      if (error) {
        // Real SupabaseClients always take this branch: keep the 413
        // permanent-rejection mapping here too, not only on the raw PUT.
        const statusCode =
          typeof error.statusCode === 'string'
            ? Number.parseInt(error.statusCode, 10)
            : error.statusCode;
        return mediaUploadFailure(statusCode === 413 ? 'file_too_large' : 'service_unavailable');
      }
    } else {
      const res = await fetch(intent.signedUploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': mimeType, 'x-upsert': 'false' },
        body: blob as unknown as BodyInit,
      });
      if (!res.ok) {
        return mediaUploadFailure(res.status === 413 ? 'file_too_large' : 'service_unavailable');
      }
    }
  } catch {
    return mediaUploadFailure('network');
  }

  // 3 + 4. Finalize and resolve the public URL.
  return finalizeSubmissionMedia(
    { intent, byteSize: input.byteSize, contentHash: input.contentHash },
    client,
  );
}
