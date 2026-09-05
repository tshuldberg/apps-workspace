// Plan 38 Phase 6 (WEB): the honest container matrix for in-browser playback.
//
// The web node holds the FULL decrypted bytes in memory (openLibraryItemContent
// returns a Uint8Array, never a stream), so playback here is a browser-decode
// question, not a transport one. This module sniffs the real container from the
// leading bytes and decides, honestly, HOW the browser can play it:
//
//   - fragmented MP4 / WebM  -> MSE (real SourceBuffer append, streams in chunks)
//   - anything small + decodable (plain MP4, audio, small fMP4/WebM) -> object URL
//   - MKV and everything the browser cannot decode -> UNSUPPORTED, honest copy
//
// It is pure and side-effect free: `playbackPlan` takes bytes + mime + size and
// returns a decision. The codec-support probe is injectable so the decision is
// testable in Node (where `MediaSource` does not exist). Nothing here fetches,
// transcodes, or remuxes; the app never claims otherwise.

/** The canonical, lock-ready honest copy for a container the browser cannot play. */
export const UNSUPPORTED_PLAYBACK_COPY =
  'Not playable in the browser. Download it or play it on mobile.';

/** Above this size we will not build a single in-memory Blob object URL. */
export const OBJECT_URL_MAX_BYTES = 256 * 1024 * 1024; // 256 MB

/** Bytes we need from the head of a file to sniff its container. */
export const PLAYBACK_SNIFF_BYTES = 64 * 1024; // 64 KB

export type ContainerKind =
  | 'mp4-fragmented'
  | 'mp4-plain'
  | 'webm'
  | 'mkv'
  | 'mp3'
  | 'flac'
  | 'ogg'
  | 'wav'
  | 'aac'
  | 'unknown';

export type PlaybackMode = 'mse' | 'object_url' | 'unsupported';

export interface PlaybackPlan {
  mode: PlaybackMode;
  container: ContainerKind;
  /** For `object_url` / `mse`, the element kind to mount. */
  element: 'video' | 'audio' | null;
  /** For `mse`, the exact `MediaSource.isTypeSupported` string to add the SourceBuffer with. */
  mseMimeType: string | null;
  /** Honest, user-facing reason. For `unsupported` this is exactly UNSUPPORTED_PLAYBACK_COPY. */
  reason: string;
}

export interface PlaybackInput {
  /** The head of the file (>= a few bytes). The full array is fine too. */
  header: Uint8Array;
  mimeType: string | null;
  sizeBytes: number | null;
}

/** Injectable codec probe. Defaults to the real MediaSource when present. */
export type IsTypeSupported = (mimeType: string) => boolean;

const AUDIO_CONTAINERS: ReadonlySet<ContainerKind> = new Set([
  'mp3', 'flac', 'ogg', 'wav', 'aac',
]);

// Candidate MSE mime strings per streamable container, most-specific first. We
// hold the full bytes, so MSE is only worth it for fragmented MP4 / WebM; the
// element still needs a concrete codec string for addSourceBuffer.
const MSE_CANDIDATES: Record<'mp4-fragmented' | 'webm', readonly string[]> = {
  'mp4-fragmented': [
    'video/mp4; codecs="avc1.42E01E, mp4a.40.2"',
    'video/mp4; codecs="avc1.4D401F, mp4a.40.2"',
    'video/mp4; codecs="avc1.640028, mp4a.40.2"',
    'video/mp4; codecs="avc1.42E01E"',
    'video/mp4',
  ],
  webm: [
    'video/webm; codecs="vp9,opus"',
    'video/webm; codecs="vp8,vorbis"',
    'video/webm; codecs="vp9"',
    'video/webm; codecs="vp8"',
    'video/webm',
  ],
};

function defaultIsTypeSupported(mimeType: string): boolean {
  if (typeof MediaSource === 'undefined') return false;
  try {
    return MediaSource.isTypeSupported(mimeType);
  } catch {
    return false;
  }
}

function ascii(bytes: Uint8Array, start: number, len: number): string {
  let out = '';
  for (let i = start; i < start + len && i < bytes.length; i += 1) {
    out += String.fromCharCode(bytes[i]!);
  }
  return out;
}

function u32be(bytes: Uint8Array, offset: number): number {
  return (
    (bytes[offset]! * 0x1000000) +
    (bytes[offset + 1]! << 16) +
    (bytes[offset + 2]! << 8) +
    bytes[offset + 3]!
  );
}

// Fragmented / DASH / CMAF brands that imply an MSE-appendable init+moof layout.
const FRAGMENTED_BRANDS = new Set([
  'iso5', 'iso6', 'dash', 'cmfc', 'cmf2', 'msdh', 'msix', 'avc3', 'dsms', 'lmsg',
]);

/** Walk the top-level MP4 boxes present in the header and classify. */
function classifyMp4(bytes: Uint8Array): 'mp4-fragmented' | 'mp4-plain' {
  // Collect ftyp brands (major brand at 8, compatible brands from 16 on).
  const boxes: string[] = [];
  let brandsFragmented = false;
  let offset = 0;
  const limit = bytes.length;
  // Guard against malformed sizes: cap the number of boxes we walk.
  for (let n = 0; n < 64 && offset + 8 <= limit; n += 1) {
    const size = u32be(bytes, offset);
    const type = ascii(bytes, offset + 4, 4);
    boxes.push(type);
    if (type === 'ftyp') {
      const end = size >= 8 ? Math.min(offset + size, limit) : limit;
      const major = ascii(bytes, offset + 8, 4);
      if (FRAGMENTED_BRANDS.has(major)) brandsFragmented = true;
      for (let b = offset + 16; b + 4 <= end; b += 4) {
        if (FRAGMENTED_BRANDS.has(ascii(bytes, b, 4))) brandsFragmented = true;
      }
    }
    if (size < 8) break; // size 0 ("to end of file") or nonsense: stop walking.
    offset += size;
  }
  // moof / styp are the definitive fragmented signals; mvex (inside moov) also is.
  if (boxes.includes('moof') || boxes.includes('styp')) return 'mp4-fragmented';
  if (brandsFragmented) return 'mp4-fragmented';
  // Fall back to a substring scan for mvex (lives inside moov, not top-level).
  if (indexOfAscii(bytes, 'mvex') >= 0) return 'mp4-fragmented';
  return 'mp4-plain';
}

function indexOfAscii(bytes: Uint8Array, needle: string): number {
  const n = needle.length;
  const limit = bytes.length - n;
  for (let i = 0; i <= limit; i += 1) {
    let hit = true;
    for (let j = 0; j < n; j += 1) {
      if (bytes[i + j] !== needle.charCodeAt(j)) { hit = false; break; }
    }
    if (hit) return i;
  }
  return -1;
}

/**
 * Identify the media container from its leading bytes, using the declared mime
 * only as a tie-breaker. Byte magics win because a signed `mimeType` is
 * attacker-controlled community data.
 */
export function sniffContainer(header: Uint8Array, mimeType: string | null): ContainerKind {
  const b = header;
  // ISO-BMFF (MP4/MOV): 'ftyp' at offset 4.
  if (b.length >= 12 && ascii(b, 4, 4) === 'ftyp') {
    return classifyMp4(b);
  }
  // EBML (Matroska / WebM): 0x1A45DFA3. Distinguish by DocType string.
  if (b.length >= 4 && b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) {
    // The DocType element sits within the first tens of bytes.
    if (indexOfAscii(b, 'webm') >= 0) return 'webm';
    if (indexOfAscii(b, 'matroska') >= 0) return 'mkv';
    // Unknown EBML doctype: treat as MKV (conservative, not MSE-appendable).
    return 'mkv';
  }
  // Ogg.
  if (b.length >= 4 && ascii(b, 0, 4) === 'OggS') return 'ogg';
  // FLAC.
  if (b.length >= 4 && ascii(b, 0, 4) === 'fLaC') return 'flac';
  // RIFF/WAVE (vs AVI, which we do not decode).
  if (b.length >= 12 && ascii(b, 0, 4) === 'RIFF') {
    return ascii(b, 8, 4) === 'WAVE' ? 'wav' : 'unknown';
  }
  // MP3: ID3 tag or an MPEG audio frame sync.
  if (b.length >= 3 && ascii(b, 0, 3) === 'ID3') return 'mp3';
  if (b.length >= 2 && b[0] === 0xff && (b[1]! & 0xe0) === 0xe0) return 'mp3';
  // ADTS AAC frame sync.
  if (b.length >= 2 && b[0] === 0xff && (b[1]! & 0xf6) === 0xf0) return 'aac';

  // Byte magic inconclusive: last-resort mime hint (still honest -- if the mime
  // lies, the media element simply fails to decode; we never fake success).
  const type = (mimeType ?? '').toLowerCase().split(';')[0]!.trim();
  if (type === 'audio/mpeg' || type === 'audio/mp3') return 'mp3';
  if (type === 'audio/flac') return 'flac';
  if (type === 'audio/ogg' || type === 'application/ogg') return 'ogg';
  if (type === 'audio/wav' || type === 'audio/x-wav') return 'wav';
  if (type === 'audio/aac') return 'aac';
  if (type === 'video/webm') return 'webm';
  if (type === 'video/x-matroska') return 'mkv';
  return 'unknown';
}

function pickMseType(
  container: 'mp4-fragmented' | 'webm',
  isSupported: IsTypeSupported,
): string | null {
  for (const candidate of MSE_CANDIDATES[container]) {
    if (isSupported(candidate)) return candidate;
  }
  return null;
}

const unsupported = (container: ContainerKind): PlaybackPlan => ({
  mode: 'unsupported',
  container,
  element: null,
  mseMimeType: null,
  reason: UNSUPPORTED_PLAYBACK_COPY,
});

/**
 * Decide how (or whether) the browser can play this file. Honest by construction:
 * MSE only when the codec probe says yes, object URL only under the size cap, and
 * the exact download-or-mobile copy for everything else.
 */
export function playbackPlan(
  input: PlaybackInput,
  opts?: { isTypeSupported?: IsTypeSupported },
): PlaybackPlan {
  const isSupported = opts?.isTypeSupported ?? defaultIsTypeSupported;
  const container = sniffContainer(input.header, input.mimeType);
  const size = input.sizeBytes;
  const underCap = size == null || size <= OBJECT_URL_MAX_BYTES;

  // Audio: hand the bytes to an <audio> element via an object URL.
  if (AUDIO_CONTAINERS.has(container)) {
    if (!underCap) return unsupported(container);
    return {
      mode: 'object_url',
      container,
      element: 'audio',
      mseMimeType: null,
      reason: 'Plays from the sealed copy on this device.',
    };
  }

  // Containers the browser cannot decode natively.
  if (container === 'mkv' || container === 'unknown') {
    return unsupported(container);
  }

  // Fragmented MP4 / WebM: prefer MSE (streams in chunks without a giant Blob).
  if (container === 'mp4-fragmented' || container === 'webm') {
    const mse = pickMseType(container, isSupported);
    if (mse) {
      return {
        mode: 'mse',
        container,
        element: 'video',
        mseMimeType: mse,
        reason: 'Streams from the sealed copy on this device.',
      };
    }
    // Codec not MSE-supported: fall back to an object URL if it is small enough.
    if (underCap) {
      return {
        mode: 'object_url',
        container,
        element: 'video',
        mseMimeType: null,
        reason: 'Plays from the sealed copy on this device.',
      };
    }
    return unsupported(container);
  }

  // Plain (progressive) MP4: not MSE-appendable, so only an object URL, and only
  // under the cap (a multi-GB progressive file cannot be a single Blob).
  if (container === 'mp4-plain') {
    if (underCap) {
      return {
        mode: 'object_url',
        container,
        element: 'video',
        mseMimeType: null,
        reason: 'Plays from the sealed copy on this device.',
      };
    }
    return unsupported(container);
  }

  return unsupported(container);
}
