// Video capture helper for the coaching loop.
//
// Records a new clip or picks one from the library, normalizes it to the
// { fileUri, contentType, contentLength, durationSeconds } shape the form-check
// upload pipeline expects, and enforces the same 500 MB / 10 min caps the
// server does so the user gets an honest local error instead of a rejected
// upload. contentType is constrained to the bucket's allowed MIME types.

import * as ImagePicker from 'expo-image-picker';

export const MAX_UPLOAD_BYTES = 500_000_000; // parity with dowork-form-checks bucket
export const MAX_DURATION_SECONDS = 600; // 10 min parity

export interface PickedVideo {
  fileUri: string;
  contentType: 'video/mp4' | 'video/quicktime';
  contentLength: number;
  durationSeconds: number | null;
}

export type PickVideoResult =
  | { ok: true; video: PickedVideo }
  | { ok: false; error: string }
  | { ok: false; cancelled: true };

function inferContentType(uri: string, mimeType?: string | null): 'video/mp4' | 'video/quicktime' {
  if (mimeType === 'video/quicktime') return 'video/quicktime';
  if (mimeType === 'video/mp4') return 'video/mp4';
  return uri.toLowerCase().endsWith('.mov') ? 'video/quicktime' : 'video/mp4';
}

async function ensureCameraPermission(): Promise<boolean> {
  const current = await ImagePicker.getCameraPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const requested = await ImagePicker.requestCameraPermissionsAsync();
  return requested.granted;
}

export async function pickOrRecordVideo(source: 'library' | 'camera'): Promise<PickVideoResult> {
  try {
    if (source === 'camera') {
      const allowed = await ensureCameraPermission();
      if (!allowed) {
        return { ok: false, error: 'Camera access is off. Enable it in Settings to record a clip.' };
      }
    }

    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ['videos'],
            videoMaxDuration: MAX_DURATION_SECONDS,
            quality: 1,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['videos'],
            quality: 1,
          });

    if (result.canceled || !result.assets || result.assets.length === 0) {
      return { ok: false, cancelled: true };
    }

    const asset = result.assets[0];
    const contentLength = typeof asset.fileSize === 'number' ? asset.fileSize : 0;
    if (contentLength > MAX_UPLOAD_BYTES) {
      return { ok: false, error: 'That clip is over 500 MB. Trim it and try again.' };
    }

    const durationSeconds =
      typeof asset.duration === 'number' && asset.duration > 0
        ? Math.round(asset.duration / 1000)
        : null;
    if (durationSeconds !== null && durationSeconds > MAX_DURATION_SECONDS) {
      return { ok: false, error: 'Clips are capped at 10 minutes. Trim it and try again.' };
    }

    return {
      ok: true,
      video: {
        fileUri: asset.uri,
        contentType: inferContentType(asset.uri, asset.mimeType),
        contentLength,
        durationSeconds,
      },
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Could not open the camera roll.' };
  }
}
