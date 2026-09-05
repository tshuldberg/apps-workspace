// Yearn identity verification client (plan 47 Phase 5).
//
// Captures a LIVE camera selfie (never a library upload: the review is a
// same-person check against profile photos) into the caller's private
// verification folder, then registers it through submit_verification.
// Approval happens only in human review via the yearn-moderation surface;
// nothing here can set is_verified (a DB trigger enforces that an approved
// submission must exist). The liveness-vendor slot stays fail-closed
// ('not_configured') server-side until the founder selects a provider.

import * as ImagePicker from 'expo-image-picker';
import type { AnySupabaseClient } from './supabase';
import { YEARN_PHOTO_BUCKET } from './photoStorage';

export type VerificationCaptureReason =
  | 'permission_denied'
  | 'cancelled'
  | 'error';

export type VerificationCaptureResult =
  | { ok: true; localUri: string; mimeType: string }
  | { ok: false; reason: VerificationCaptureReason; error: string };

export interface VerificationCameraRuntime {
  requestCameraPermissionsAsync(): Promise<{ status: string }>;
  launchCameraAsync(options: Record<string, unknown>): Promise<{
    canceled: boolean;
    assets?: Array<{ uri: string; mimeType?: string | null }> | null;
  }>;
}

const defaultCameraRuntime: VerificationCameraRuntime = {
  requestCameraPermissionsAsync: () => ImagePicker.requestCameraPermissionsAsync(),
  launchCameraAsync: (options) => ImagePicker.launchCameraAsync(options as never),
};

function errMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Unknown error';
}

/** Builds the server-validated selfie path inside the caller's own folder. */
export function buildVerificationSelfiePath(userId: string, timestampMs: number): string {
  return `${userId}/verification-selfie-${timestampMs}.jpg`;
}

export async function captureVerificationSelfie(
  runtime: VerificationCameraRuntime = defaultCameraRuntime,
): Promise<VerificationCaptureResult> {
  try {
    const { status } = await runtime.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      return {
        ok: false,
        reason: 'permission_denied',
        error: 'Camera permission was denied. Verification needs a live selfie.',
      };
    }

    const result = await runtime.launchCameraAsync({
      mediaTypes: ['images'],
      cameraType: 'front',
      allowsEditing: false,
      quality: 0.86,
      exif: false,
    });
    if (result.canceled) {
      return { ok: false, reason: 'cancelled', error: 'Capture cancelled.' };
    }
    const asset = result.assets?.[0];
    if (!asset?.uri) {
      return { ok: false, reason: 'error', error: 'No selfie was captured.' };
    }
    return { ok: true, localUri: asset.uri, mimeType: asset.mimeType ?? 'image/jpeg' };
  } catch (error) {
    return { ok: false, reason: 'error', error: errMessage(error) };
  }
}

/**
 * Uploads the captured selfie to the private verification folder. The path
 * is owner-scoped by storage RLS and is never part of profiles.photos, so
 * other users cannot mint a signed URL for it; only service-role reviewers
 * can read it.
 */
export async function uploadVerificationSelfie(
  client: AnySupabaseClient,
  input: { userId: string; localUri: string; mimeType?: string; fetchBlob?: typeof fetch },
): Promise<string> {
  const path = buildVerificationSelfiePath(input.userId, Date.now());
  const fetchBlob = input.fetchBlob ?? fetch;
  const response = await fetchBlob(input.localUri);
  const blob = await response.blob();
  const { data, error } = await client.storage
    .from(YEARN_PHOTO_BUCKET)
    .upload(path, blob, {
      cacheControl: '3600',
      contentType: input.mimeType ?? 'image/jpeg',
      upsert: false,
    });
  if (error) throw new Error(error.message);
  return data?.path ?? path;
}
