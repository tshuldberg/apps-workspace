// DoWork cloud media upload client.
//
// Client half of the dowork-upload-finalize edge function contract:
//   1. sign     -> server validates kind/caps/trainer status and returns an
//                  absolute signed Storage upload URL + server-chosen key
//   2. upload   -> the file streams from disk straight to Storage via
//                  FileSystem upload task (progress callbacks supported)
//   3. finalize -> server verifies the object exists and writes the
//                  metadata row itself (dw_trainer_videos) so device-local
//                  paths can never end up in cloud rows.

import type { SupabaseClient } from '@supabase/supabase-js';
import * as FileSystem from 'expo-file-system/legacy';
import { mapRawTrainerVideoRow, type TrainerVideoAngle, type TrainerVideoRow } from './cloud-trainer-videos';

export type DoWorkUploadKind =
  | 'trainer_video'
  | 'trainer_thumbnail'
  | 'share_hero'
  | 'share_video'
  | 'avatar';

export interface SignedUpload {
  bucket: string;
  key: string;
  uploadUrl: string;
  token: string | null;
  maxBytes: number;
}

export type CloudMediaResult<T> = ({ ok: true } & T) | { ok: false; error: string };

const UPLOAD_FUNCTION = 'dowork-upload-finalize';

function errMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string') return message;
  }
  return 'Unknown error';
}

async function invokeUploadFunction(
  supabase: SupabaseClient,
  body: Record<string, unknown>,
): Promise<CloudMediaResult<{ data: Record<string, unknown> }>> {
  try {
    const { data, error } = await supabase.functions.invoke(UPLOAD_FUNCTION, { body });
    if (error) return { ok: false, error: errMessage(error) };
    const record = (data ?? {}) as Record<string, unknown>;
    if (record.ok !== true) {
      const errObj = record.error as { message?: unknown } | undefined;
      return {
        ok: false,
        error: typeof errObj?.message === 'string' ? errObj.message : 'Upload service error.',
      };
    }
    return { ok: true, data: record };
  } catch (error) {
    return { ok: false, error: errMessage(error) };
  }
}

export async function signUpload(
  supabase: SupabaseClient,
  params: { kind: DoWorkUploadKind; contentType: string; contentLength: number },
): Promise<CloudMediaResult<{ signed: SignedUpload }>> {
  const result = await invokeUploadFunction(supabase, { action: 'sign', ...params });
  if (!result.ok) return result;
  const d = result.data;
  if (typeof d.uploadUrl !== 'string' || typeof d.key !== 'string' || typeof d.bucket !== 'string') {
    return { ok: false, error: 'Upload service returned an invalid sign response.' };
  }
  return {
    ok: true,
    signed: {
      bucket: d.bucket,
      key: d.key,
      uploadUrl: d.uploadUrl,
      token: typeof d.token === 'string' ? d.token : null,
      maxBytes: typeof d.maxBytes === 'number' ? d.maxBytes : 0,
    },
  };
}

export async function uploadFileToSignedUrl(
  signed: SignedUpload,
  fileUri: string,
  contentType: string,
  onProgress?: (fraction: number) => void,
): Promise<CloudMediaResult<object>> {
  try {
    const task = FileSystem.createUploadTask(
      signed.uploadUrl,
      fileUri,
      {
        httpMethod: 'PUT',
        headers: { 'content-type': contentType },
        uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
      },
      onProgress
        ? (progress) => {
            const total = progress.totalBytesExpectedToSend || 1;
            onProgress(Math.min(1, progress.totalBytesSent / total));
          }
        : undefined,
    );
    const result = await task.uploadAsync();
    if (!result || result.status < 200 || result.status >= 300) {
      return { ok: false, error: `Storage upload failed (HTTP ${result?.status ?? 'unknown'}).` };
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, error: errMessage(error) };
  }
}

export interface FinalizeTrainerVideoParams {
  key: string;
  exerciseSlug: string;
  angle?: TrainerVideoAngle;
  durationSeconds?: number;
  thumbnailKey?: string;
  isPrimary?: boolean;
  sortOrder?: number;
  title?: string;
  description?: string;
  isPremium?: boolean;
}

export async function finalizeTrainerVideo(
  supabase: SupabaseClient,
  params: FinalizeTrainerVideoParams,
): Promise<CloudMediaResult<{ video: TrainerVideoRow }>> {
  const result = await invokeUploadFunction(supabase, {
    action: 'finalize',
    kind: 'trainer_video',
    ...params,
  });
  if (!result.ok) return result;
  const raw = result.data.video;
  if (!raw || typeof raw !== 'object') {
    return { ok: false, error: 'Upload service returned an invalid finalize response.' };
  }
  return { ok: true, video: mapRawTrainerVideoRow(raw as Parameters<typeof mapRawTrainerVideoRow>[0]) };
}

// Image finalize (trainer_thumbnail / hero / avatar): the object is verified
// server-side and the public URL is returned. Trainer heroes reuse the
// trainer_thumbnail kind (image, requires-trainer, public-read), so no new
// upload kind is needed.
export async function finalizeImageUpload(
  supabase: SupabaseClient,
  params: { kind: Extract<DoWorkUploadKind, 'trainer_thumbnail' | 'avatar' | 'share_hero'>; key: string },
): Promise<CloudMediaResult<{ key: string; publicUrl: string }>> {
  const result = await invokeUploadFunction(supabase, {
    action: 'finalize',
    kind: params.kind,
    key: params.key,
  });
  if (!result.ok) return result;
  const publicUrl = result.data.publicUrl;
  if (typeof publicUrl !== 'string' || !publicUrl) {
    return { ok: false, error: 'Upload service did not return a public URL.' };
  }
  return { ok: true, key: params.key, publicUrl };
}

export interface UploadImageParams {
  kind: Extract<DoWorkUploadKind, 'trainer_thumbnail' | 'avatar' | 'share_hero'>;
  fileUri: string;
  contentType: string;
  contentLength: number;
  onProgress?: (fraction: number) => void;
}

// One-call image orchestration: sign -> stream upload -> finalize. Used for the
// trainer hero image and per-video thumbnails.
export async function uploadTrainerImage(
  supabase: SupabaseClient,
  params: UploadImageParams,
): Promise<CloudMediaResult<{ key: string; publicUrl: string }>> {
  const signed = await signUpload(supabase, {
    kind: params.kind,
    contentType: params.contentType,
    contentLength: params.contentLength,
  });
  if (!signed.ok) return signed;

  const uploaded = await uploadFileToSignedUrl(
    signed.signed,
    params.fileUri,
    params.contentType,
    params.onProgress,
  );
  if (!uploaded.ok) return uploaded;

  return finalizeImageUpload(supabase, { kind: params.kind, key: signed.signed.key });
}

export interface UploadTrainerVideoParams {
  fileUri: string;
  contentType: string;
  contentLength: number;
  exerciseSlug: string;
  angle?: TrainerVideoAngle;
  durationSeconds?: number;
  title?: string;
  description?: string;
  isPremium?: boolean;
  // Optional local thumbnail (expo-video-thumbnails); uploaded first as a
  // trainer_thumbnail so the finalized row carries a public poster image.
  thumbnailUri?: string;
  thumbnailContentType?: string;
  thumbnailContentLength?: number;
  onProgress?: (fraction: number) => void;
}

// One-call orchestration: [thumbnail] -> sign -> stream upload -> finalize.
export async function uploadTrainerVideoToCloud(
  supabase: SupabaseClient,
  params: UploadTrainerVideoParams,
): Promise<CloudMediaResult<{ video: TrainerVideoRow }>> {
  let thumbnailKey: string | undefined;
  if (params.thumbnailUri) {
    const thumb = await uploadTrainerImage(supabase, {
      kind: 'trainer_thumbnail',
      fileUri: params.thumbnailUri,
      contentType: params.thumbnailContentType ?? 'image/jpeg',
      contentLength: params.thumbnailContentLength ?? 0,
    });
    // A thumbnail failure must not block the (much larger) video upload; the
    // finalized row simply has no poster and can gain one on a later edit.
    if (thumb.ok) thumbnailKey = thumb.key;
  }

  const signed = await signUpload(supabase, {
    kind: 'trainer_video',
    contentType: params.contentType,
    contentLength: params.contentLength,
  });
  if (!signed.ok) return signed;

  const uploaded = await uploadFileToSignedUrl(
    signed.signed,
    params.fileUri,
    params.contentType,
    params.onProgress,
  );
  if (!uploaded.ok) return uploaded;

  return finalizeTrainerVideo(supabase, {
    key: signed.signed.key,
    exerciseSlug: params.exerciseSlug,
    angle: params.angle,
    durationSeconds: params.durationSeconds,
    thumbnailKey,
    title: params.title,
    description: params.description,
    isPremium: params.isPremium,
  });
}
