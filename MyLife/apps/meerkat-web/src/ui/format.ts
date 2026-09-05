// Pure display helpers. Replica of apps/meerkat/app/(root)/theme/format.ts
// (App Isolation: that module lives inside the apps/meerkat boundary).

/** Human byte size: 1536 -> "1.5 KB". */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const exp = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, exp);
  const rounded = exp === 0 ? value : Math.round(value * 10) / 10;
  return `${rounded} ${units[exp]}`;
}

/** Short hex form of a long key/id: first 6 + last 4, for display only. */
export function shortHex(hex: string, head = 6, tail = 4): string {
  if (!hex) return '';
  if (hex.length <= head + tail + 1) return hex;
  return `${hex.slice(0, head)}…${hex.slice(-tail)}`;
}

/**
 * Build a Blob from raw bytes for a browser download / object URL. Copies into a
 * fresh ArrayBuffer-backed view so TS's BlobPart (which rejects the generic
 * Uint8Array<ArrayBufferLike> from a SharedArrayBuffer) is satisfied and the
 * caller's buffer can never be mutated out from under the Blob.
 */
export function bytesToBlob(bytes: Uint8Array, mimeType: string): Blob {
  const copy = new Uint8Array(bytes.length);
  copy.set(bytes);
  return new Blob([copy.buffer], { type: mimeType || 'application/octet-stream' });
}

/**
 * Audit S1 gate: is this MIME type safe to open INLINE as a top-level document on the
 * app origin? An attachment's mimeType is sender-signed and untrusted, so the
 * View path opens a blob URL inline ONLY for an allowlisted render-safe type; everything
 * else force-downloads instead of previewing on the app origin.
 *
 * Allowed: raster/vector-free images, video, audio, and PDF. Excluded (fail-closed):
 * scriptable document types, xhtml/xml, and any unknown type. The parameter list
 * (";charset=...") is stripped first so a scriptable base type cannot be smuggled
 * behind a parameter.
 */
export function isInlineRenderSafeMimeType(mimeType: string): boolean {
  const type = (mimeType || '').toLowerCase().split(';')[0]!.trim();
  if (!type) return false;
  // SVG is an image/* type but executes script, so it is never inline-safe.
  if (type === 'image/svg+xml' || type === 'image/svg') return false;
  if (type.startsWith('image/')) return true;
  if (type.startsWith('video/')) return true;
  if (type.startsWith('audio/')) return true;
  if (type === 'application/pdf') return true;
  return false;
}

/** Local datetime string from an ISO wall time; empty for null/blank. */
export function formatWhen(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}
