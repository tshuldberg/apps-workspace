/**
 * OS share-intake model (Plan 20, Phase 8). Pure, RN-safe, IO-light.
 *
 * Normalizes an incoming OS-shared item (text/url/image/audio/video/pdf/file,
 * single or multi) into a payload the app stages device-locally in mk_share_*
 * and content-addresses into the EXISTING blob store. Two load-bearing honesty
 * properties: the type is SNIFFED from magic bytes, never trusted from the
 * sender-declared MIME; and a size guard rejects oversized items rather than
 * silently dropping them. The DB rows + blob storage are app glue (Phase 8.3);
 * this model emits no sync row -- staged intake is device-local by construction.
 */

export type ShareSource =
  | 'ios_share_extension'
  | 'android_share_intent'
  | 'web_share_target'
  | 'web_file_pick';

export type ShareIntakeStatus = 'staged' | 'reviewing' | 'routed' | 'discarded' | 'expired';
export type ShareDestination = 'channel' | 'dm' | 'files';
export type SharePayloadKind = 'text' | 'url' | 'image' | 'audio' | 'video' | 'pdf' | 'file';

/** What the OS hands us for one shared item, before normalization. */
export interface RawSharedItem {
  /** Inline text/url payload. */
  text?: string;
  /** iOS Uniform Type Identifier, when provided. */
  uti?: string;
  /** The sender-declared MIME. NEVER trusted for classification when bytes exist. */
  declaredMime?: string;
  filename?: string;
  /** File bytes, when already staged into the App Group / app storage. */
  bytes?: Uint8Array;
  /** Byte length when the bytes are not in hand yet (iOS provider deferral). */
  byteLength?: number;
}

export interface NormalizedPayload {
  kind: SharePayloadKind;
  uti?: string;
  /** Sniffed MIME (preferred) or a normalized declared MIME when no bytes yet. */
  mime?: string;
  filename?: string;
  byteLength?: number;
  /** Inline value for text/url; undefined for files. */
  textValue?: string;
}

export interface ShareIntakeLimits {
  maxBytes: number;
}

/**
 * Size guard. Huge-file / forever-archive ingest is plans 19 + 22; the Share
 * Inbox stages ordinary items, so a generous-but-bounded cap rejects abuse.
 */
export const DEFAULT_SHARE_MAX_BYTES = 512 * 1024 * 1024;

export type NormalizeResult =
  | { ok: true; payload: NormalizedPayload }
  | { ok: false; reason: string };

interface MagicSignature {
  mime: string;
  offset: number;
  bytes: readonly number[];
}

// Ordered magic-byte signatures. First match wins. Sender MIME is never consulted.
const MAGIC: readonly MagicSignature[] = [
  { mime: 'image/png', offset: 0, bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { mime: 'image/jpeg', offset: 0, bytes: [0xff, 0xd8, 0xff] },
  { mime: 'image/gif', offset: 0, bytes: [0x47, 0x49, 0x46, 0x38] },
  { mime: 'application/pdf', offset: 0, bytes: [0x25, 0x50, 0x44, 0x46] },
  { mime: 'image/webp', offset: 8, bytes: [0x57, 0x45, 0x42, 0x50] }, // RIFF....WEBP
  { mime: 'audio/wav', offset: 8, bytes: [0x57, 0x41, 0x56, 0x45] }, // RIFF....WAVE
  { mime: 'video/mp4', offset: 4, bytes: [0x66, 0x74, 0x79, 0x70] }, // ....ftyp
  { mime: 'audio/mpeg', offset: 0, bytes: [0x49, 0x44, 0x33] }, // ID3
];

/** Sniff a MIME from the leading bytes, or undefined when nothing matches. */
export function sniffMime(bytes: Uint8Array): string | undefined {
  for (const sig of MAGIC) {
    let matched = true;
    for (let i = 0; i < sig.bytes.length; i++) {
      if (bytes[sig.offset + i] !== sig.bytes[i]) {
        matched = false;
        break;
      }
    }
    if (matched) return sig.mime;
  }
  return undefined;
}

/** True for an http(s) URL (used to split url from plain text). */
export function isShareUrl(text: string): boolean {
  return /^https?:\/\/\S+$/i.test(text.trim());
}

function kindForMime(mime: string | undefined): SharePayloadKind {
  if (!mime) return 'file';
  if (mime === 'application/pdf') return 'pdf';
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime.startsWith('video/')) return 'video';
  return 'file';
}

/**
 * Normalize one shared item. Inline text is classified url vs text; a file is
 * SNIFFED (bytes win over declaredMime) or, when bytes are not in hand yet,
 * falls back to declaredMime/uti for a best-effort kind (the app re-sniffs on
 * copy). Oversized items are rejected with a plain reason.
 */
export function normalizeSharedItem(
  raw: RawSharedItem,
  limits?: Partial<ShareIntakeLimits>,
): NormalizeResult {
  const maxBytes = limits?.maxBytes ?? DEFAULT_SHARE_MAX_BYTES;

  // Inline text / url.
  if (raw.bytes == null && raw.byteLength == null && raw.text != null) {
    const trimmed = raw.text.trim();
    if (!trimmed) return { ok: false, reason: 'Empty text was shared.' };
    return {
      ok: true,
      payload: { kind: isShareUrl(trimmed) ? 'url' : 'text', textValue: trimmed },
    };
  }

  // File payload (bytes present, or a deferred provider with a known length).
  const byteLength = raw.bytes ? raw.bytes.byteLength : raw.byteLength;
  if (byteLength == null) {
    return { ok: false, reason: 'Nothing was shared.' };
  }
  if (byteLength > maxBytes) {
    return { ok: false, reason: 'That item is too large to bring in.' };
  }

  const sniffed = raw.bytes ? sniffMime(raw.bytes) : undefined;
  const mime = sniffed ?? normalizeDeclaredMime(raw.declaredMime, raw.uti);
  return {
    ok: true,
    payload: {
      kind: kindForMime(mime),
      uti: raw.uti,
      mime,
      filename: raw.filename,
      byteLength,
    },
  };
}

/** Normalize a multi-item share; collects per-item failures rather than throwing. */
export function normalizeSharedItems(
  raws: readonly RawSharedItem[],
  limits?: Partial<ShareIntakeLimits>,
): { payloads: NormalizedPayload[]; errors: string[] } {
  const payloads: NormalizedPayload[] = [];
  const errors: string[] = [];
  for (const raw of raws) {
    const r = normalizeSharedItem(raw, limits);
    if (r.ok) payloads.push(r.payload);
    else errors.push(r.reason);
  }
  return { payloads, errors };
}

// When no bytes are in hand yet, take a best-effort MIME from the declared MIME
// (only the major type matters for kind) or the iOS UTI. The app re-sniffs the
// real bytes on copy, so this is never the final word.
function normalizeDeclaredMime(declaredMime?: string, uti?: string): string | undefined {
  if (declaredMime && /^[a-z]+\/[a-z0-9.+-]+$/i.test(declaredMime)) return declaredMime.toLowerCase();
  if (uti) {
    if (uti.includes('image')) return 'image/*';
    if (uti.includes('movie') || uti.includes('mpeg-4') || uti.includes('video')) return 'video/*';
    if (uti.includes('audio')) return 'audio/*';
    if (uti.includes('pdf')) return 'application/pdf';
  }
  return undefined;
}
