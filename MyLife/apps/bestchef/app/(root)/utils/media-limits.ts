/**
 * Video limit constants + pure pre-validation, kept free of React Native /
 * expo imports so the caps can be unit-tested in Node (audit M7).
 *
 * The byte cap matches the server bucket cap enforced in
 * supabase/functions/_shared/media.ts and SUBMISSION_VIDEO_MAX_BYTES in
 * data/media-upload-worker.ts. Kept in one place so the user-facing copy and
 * the byte gate never drift apart again (the old "200 MB" copy let 151-200MB
 * clips pass the picker then hard-fail at the byte gate).
 */

export const MAX_VIDEO_DURATION_MS = 120_000;
export const MAX_VIDEO_BYTES = 150 * 1024 * 1024;
export const MAX_VIDEO_SIZE_MB = MAX_VIDEO_BYTES / (1024 * 1024);

/**
 * Convert an expo-image-picker asset duration to seconds. The picker always
 * reports duration in MILLISECONDS, so convert unconditionally: a magnitude
 * heuristic (`> 1000 ? /1000 : as-is`) turned a genuine 900ms clip into 900
 * seconds, rendering a ~15-minute feed card. Returns undefined for a missing
 * or non-finite value.
 */
export function videoDurationSecondsFromMs(
  durationMs: number | null | undefined,
): number | undefined {
  if (typeof durationMs !== 'number' || !Number.isFinite(durationMs)) return undefined;
  return durationMs / 1000;
}

export type VideoLimitTranslate = (
  key: string,
  values?: Record<string, string | number>,
) => string;

const identityTranslate: VideoLimitTranslate = (key, values) =>
  values
    ? key.replace(/\{(\w+)\}/g, (match, name) =>
        name in values ? String(values[name]) : match,
      )
    : key;

/**
 * Throw a translated Error when a picked/recorded video exceeds the duration
 * or byte caps the server enforces. Applied to BOTH the camera and library
 * paths so an oversized clip fails here instead of at the byte gate.
 */
export function assertVideoWithinLimits(
  asset: { duration?: number | null; fileSize?: number | null },
  t: VideoLimitTranslate = identityTranslate,
): void {
  if (typeof asset.duration === 'number' && asset.duration > MAX_VIDEO_DURATION_MS) {
    throw new Error(t('Video too long. Please pick a video under 2 minutes.'));
  }
  if (typeof asset.fileSize === 'number' && asset.fileSize > MAX_VIDEO_BYTES) {
    throw new Error(t('Video too large. Max {max} MB.', { max: MAX_VIDEO_SIZE_MB }));
  }
}
