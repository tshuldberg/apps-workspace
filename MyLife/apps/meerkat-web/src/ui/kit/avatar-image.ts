// Plan 32 T4.2 (web twin of mobile data/avatar-photo.ts): pick + downscale a
// community avatar photo on the web with a canvas, to the SAME contract mobile
// uses (128x128 JPEG, quality 0.7, 32 KB decoded cap). Mobile leans on
// expo-image-manipulator; web has no native module, so it draws the picked File to
// a 128x128 canvas and exports JPEG. The downscale + cap check happen here; the
// signed-event cap is re-enforced in @mylife/sync (create AND verify), so a device
// that slips a too-large image past this seam still fails verification fail-closed.
//
// jsdom has no real 2D canvas, so the CANVAS STEP is injectable (opts.render) and
// the PURE cap/validation seam (finalizeAvatarBase64) is unit-tested in isolation.
//
// The authoritative 32 KB cap + JPEG-magic gate is the SINGLE source of truth in
// @mylife/sync (isValidCommunityAvatarImage; the native barrel re-exports it), so
// there is no inlined twin to drift. This is a client-side pre-flight only;
// createCommunityProfileEvent re-enforces the SAME gate authoritatively at sign time.

import { isValidCommunityAvatarImage } from '@mylife/sync';

/** Target square edge for the downscaled avatar, in px (mobile contract). */
export const AVATAR_TARGET_DIMENSION = 128;
/** JPEG quality for the downscaled avatar (mobile contract). */
export const AVATAR_JPEG_QUALITY = 0.7;

export type AvatarPrepResult =
  | { ok: true; base64: string }
  | { ok: false; reason: 'unavailable' | 'too_large' | 'failed' };

/** Strip an optional `data:...;base64,` prefix and return the raw base64 payload. */
export function stripDataUriPrefix(value: string): string {
  const comma = value.indexOf(',');
  return value.startsWith('data:') && comma !== -1 ? value.slice(comma + 1) : value;
}

/**
 * The PURE cap/validation seam (mirrors the mobile pickAndResizeAvatar tail): take
 * the base64 (or data URI) the canvas produced and accept it ONLY when it is a
 * well-formed, in-cap base64 JPEG per the SAME @mylife/sync gate the signed event
 * enforces at create AND verify. Never throws.
 */
export function finalizeAvatarBase64(raw: string | null | undefined): AvatarPrepResult {
  if (!raw) return { ok: false, reason: 'failed' };
  const base64 = stripDataUriPrefix(raw).trim();
  if (!base64) return { ok: false, reason: 'failed' };
  if (!isValidCommunityAvatarImage(base64)) return { ok: false, reason: 'too_large' };
  return { ok: true, base64 };
}

/**
 * Injectable canvas step: render a picked File to a <=128px square JPEG (data URI
 * or raw base64), or null on failure. Overridable in tests (jsdom has no canvas).
 */
export type RenderAvatarJpeg = (
  file: File,
  dimension: number,
  quality: number,
) => Promise<string | null>;

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('decode'));
    img.src = url;
  });
}

async function renderWithCanvas(
  file: File,
  dimension: number,
  quality: number,
): Promise<string | null> {
  if (typeof document === 'undefined' || typeof URL === 'undefined' || !URL.createObjectURL) {
    return null;
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const canvas = document.createElement('canvas');
    canvas.width = dimension;
    canvas.height = dimension;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    // Center-crop to a square before scaling, so the result matches mobile's
    // square crop instead of stretching a non-square source.
    const side = Math.min(img.naturalWidth || img.width, img.naturalHeight || img.height);
    if (!side) return null;
    const sx = ((img.naturalWidth || img.width) - side) / 2;
    const sy = ((img.naturalHeight || img.height) - side) / 2;
    ctx.drawImage(img, sx, sy, side, side, 0, 0, dimension, dimension);
    return canvas.toDataURL('image/jpeg', quality);
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Downscale a picked image File to an in-cap 128x128 JPEG avatar base64, or a typed
 * failure reason so the editor can show honest recovery copy and keep the initial
 * flow. Never throws. The cap is re-enforced by createCommunityProfileEvent.
 */
export async function prepareAvatarFromFile(
  file: File,
  opts: { render?: RenderAvatarJpeg } = {},
): Promise<AvatarPrepResult> {
  const render = opts.render ?? renderWithCanvas;
  let produced: string | null;
  try {
    produced = await render(file, AVATAR_TARGET_DIMENSION, AVATAR_JPEG_QUALITY);
  } catch {
    return { ok: false, reason: 'failed' };
  }
  if (produced === null) return { ok: false, reason: 'unavailable' };
  return finalizeAvatarBase64(produced);
}
