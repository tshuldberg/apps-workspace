// Plan 38 Phase 1c (web): pick + downscale a COMMUNITY BANNER image on the web
// with a canvas, to raw JPEG bytes that fit the sealed-banner plaintext cap
// (COMMUNITY_BANNER_MAX_BYTES = 512 KB). Unlike the square 128x128 avatar, a
// banner keeps its landscape aspect: it is fit inside a max 1024x512 box, then
// re-encoded at descending JPEG quality until the bytes fit under the cap. The
// authoritative cap is re-enforced in @mylife/sync at seal + verify time (the
// sealed manifest carries manifest.size, checked against COMMUNITY_BANNER_MAX_BYTES),
// so a device that slips oversized bytes past this seam still fails fail-closed.
//
// jsdom has no real 2D canvas, so the CANVAS STEP is injectable (opts.render) and
// the PURE cap seam (finalizeBannerBytes) is unit-tested in isolation.

import { COMMUNITY_BANNER_MAX_BYTES } from '@mylife/sync';

/** Longest edge of the downscaled banner box, in px. */
export const BANNER_MAX_WIDTH = 1024;
export const BANNER_MAX_HEIGHT = 512;
/** Descending JPEG qualities tried until the bytes fit under the cap. */
export const BANNER_JPEG_QUALITIES = [0.82, 0.7, 0.6, 0.5, 0.4] as const;

export type BannerPrepResult =
  | { ok: true; bytes: Uint8Array }
  | { ok: false; reason: 'unavailable' | 'too_large' | 'failed' };

/**
 * The PURE cap seam: accept the produced JPEG bytes ONLY when non-empty and under
 * the SAME @mylife/sync banner byte cap the sealed manifest enforces. Never throws.
 */
export function finalizeBannerBytes(bytes: Uint8Array | null | undefined): BannerPrepResult {
  if (!bytes || bytes.length === 0) return { ok: false, reason: 'failed' };
  if (bytes.length > COMMUNITY_BANNER_MAX_BYTES) return { ok: false, reason: 'too_large' };
  return { ok: true, bytes };
}

/**
 * Injectable canvas step: render a picked File to landscape JPEG bytes under the
 * banner byte cap, or null on failure. Overridable in tests (jsdom has no canvas).
 */
export type RenderBannerJpeg = (file: File) => Promise<Uint8Array | null>;

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('decode'));
    img.src = url;
  });
}

function canvasToJpegBytes(canvas: HTMLCanvasElement, quality: number): Promise<Uint8Array | null> {
  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          resolve(null);
          return;
        }
        void blob.arrayBuffer().then((buf) => resolve(new Uint8Array(buf))).catch(() => resolve(null));
      },
      'image/jpeg',
      quality,
    );
  });
}

async function renderWithCanvas(file: File): Promise<Uint8Array | null> {
  if (typeof document === 'undefined' || typeof URL === 'undefined' || !URL.createObjectURL) {
    return null;
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const srcW = img.naturalWidth || img.width;
    const srcH = img.naturalHeight || img.height;
    if (!srcW || !srcH) return null;
    const scale = Math.min(1, BANNER_MAX_WIDTH / srcW, BANNER_MAX_HEIGHT / srcH);
    const width = Math.max(1, Math.round(srcW * scale));
    const height = Math.max(1, Math.round(srcH * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, width, height);
    // Re-encode at descending quality until the bytes fit under the cap.
    for (const quality of BANNER_JPEG_QUALITIES) {
      const bytes = await canvasToJpegBytes(canvas, quality);
      if (bytes && bytes.length > 0 && bytes.length <= COMMUNITY_BANNER_MAX_BYTES) return bytes;
    }
    return null;
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Downscale a picked image File to in-cap landscape JPEG banner bytes, or a typed
 * failure reason so the editor can show honest recovery copy. Never throws.
 */
export async function prepareBannerFromFile(
  file: File,
  opts: { render?: RenderBannerJpeg } = {},
): Promise<BannerPrepResult> {
  const render = opts.render ?? renderWithCanvas;
  let produced: Uint8Array | null;
  try {
    produced = await render(file);
  } catch {
    return { ok: false, reason: 'failed' };
  }
  if (produced === null) return { ok: false, reason: 'unavailable' };
  return finalizeBannerBytes(produced);
}
