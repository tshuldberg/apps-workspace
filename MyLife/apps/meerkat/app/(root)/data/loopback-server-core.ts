/**
 * Plan 38 Phase 6a -- loopback A/V range server, PURE CORE (amendment D.5).
 *
 * This is the protocol brain of the on-device 127.0.0.1 range server that feeds
 * a native media player from sealed library blocks WITHOUT ever writing A/V
 * plaintext to disk. It is deliberately socket-free: every I/O dependency (the
 * block reader, the PRNG, the clock) is injected, so the whole thing runs and is
 * exhaustively tested under node. The react-native-tcp-socket glue that binds
 * 127.0.0.1, reads bytes, and pumps the body stream back is a separate unit and
 * is the ONLY layer allowed to touch a socket.
 *
 * Design invariants that live here (not in the glue):
 *  - The per-session token rides IN THE URL PATH (/v1/<token>/<contentId>),
 *    because real players do not forward custom headers on seek requests. It is
 *    compared in constant time, has a short TTL, and there is exactly one active
 *    token per server session. A wrong or expired token is 401, never a hint.
 *  - Range requests map to a chunk WINDOW over the signed manifest; each chunk
 *    is decrypted and hash-verified against the SIGNED manifest before a single
 *    byte is yielded (fail-closed: a tampered block aborts the stream mid-flight,
 *    unverified bytes never reach the player).
 *  - The DEK lives only for a stream's life and is zeroed when the stream ends.
 *
 * No react-native imports, no side effects, no sockets. Keep it that way.
 */

import { decodeBase64 } from 'tweetnacl-util';
import { decrypt, hkdf, sha512Hex } from '@mylife/sync';

// ---------------------------------------------------------------------------
// HTTP request parsing (tolerant of what real media players actually send).
// ---------------------------------------------------------------------------

/** Hard cap on a request head. Real range requests are tiny; anything larger is
 *  hostile or broken and is rejected with 431 before we allocate around it. */
export const MAX_REQUEST_BYTES = 16 * 1024;
/** Hard cap on header LINES, a second guard against header-flood requests. */
export const MAX_HEADER_LINES = 100;

export interface ParsedHttpRequest {
  method: string; // upper-cased verb as sent
  path: string; // raw request-target (may contain a query string)
  headers: Record<string, string>; // lower-cased names; last value wins
}

export type ParseHttpResult =
  | { ok: true; request: ParsedHttpRequest }
  | { ok: false; status: 400 | 431 };

function toRequestString(raw: string | Uint8Array): string {
  if (typeof raw === 'string') return raw;
  // Latin1/ascii decode is enough: a request head is ascii; a body (which we
  // never read) would be past the blank line we stop at anyway.
  let out = '';
  for (let i = 0; i < raw.length; i += 1) out += String.fromCharCode(raw[i]!);
  return out;
}

/**
 * Parse an HTTP/1.x request head into { method, path, headers }. Tolerant of
 * bare LF line endings and trailing whitespace, but bounded: an oversized head
 * or a header-line flood is rejected (431) rather than parsed, and a request
 * with no valid request line is 400.
 */
export function parseHttpRequest(raw: string | Uint8Array): ParseHttpResult {
  const byteLength = typeof raw === 'string' ? raw.length : raw.length;
  if (byteLength > MAX_REQUEST_BYTES) return { ok: false, status: 431 };

  const text = toRequestString(raw);
  // Only the head matters; stop at the first blank line (end of headers).
  const headEnd = text.search(/\r?\n\r?\n/);
  const head = headEnd === -1 ? text : text.slice(0, headEnd);
  const lines = head.split(/\r?\n/);
  if (lines.length === 0) return { ok: false, status: 400 };

  const requestLine = lines[0] ?? '';
  const parts = requestLine.trim().split(/\s+/);
  if (parts.length < 2) return { ok: false, status: 400 };
  const method = parts[0]!.toUpperCase();
  const path = parts[1]!;
  if (!method || !path) return { ok: false, status: 400 };

  const headerLines = lines.slice(1);
  if (headerLines.length > MAX_HEADER_LINES) return { ok: false, status: 431 };

  const headers: Record<string, string> = {};
  for (const line of headerLines) {
    if (line === '') continue;
    const colon = line.indexOf(':');
    if (colon === -1) continue; // tolerate a stray fold/garbage line
    const name = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();
    if (name) headers[name] = value;
  }

  return { ok: true, request: { method, path, headers } };
}

/** The token + content id carried in a /v1/<token>/<contentId> request-target. */
export interface ParsedPlaybackPath {
  token: string;
  contentId: string;
}

/**
 * Parse the request-target shape /v1/<token>/<contentId> (query string ignored).
 * Returns null on any other shape so the caller answers 404 without leaking
 * whether the token or the id was the problem.
 */
export function parsePlaybackPath(path: string): ParsedPlaybackPath | null {
  const noQuery = path.split('?')[0] ?? '';
  const segments = noQuery.split('/').filter((s) => s.length > 0);
  if (segments.length !== 3) return null;
  if (segments[0] !== 'v1') return null;
  const token = segments[1]!;
  // decodeURIComponent throws URIError on malformed percent-encoding (e.g.
  // '%E0%A4%A'). Fail closed to null so the caller answers a bounded 404 instead
  // of the server core throwing on a crafted request-target.
  let contentId: string;
  try {
    contentId = decodeURIComponent(segments[2]!);
  } catch {
    return null;
  }
  if (!token || !contentId) return null;
  return { token, contentId };
}

// ---------------------------------------------------------------------------
// Per-session playback token: mint, constant-time compare, TTL.
// ---------------------------------------------------------------------------

/** Random bytes source, injected so tests are deterministic. */
export type PrngBytes = (length: number) => Uint8Array;

export const PLAYBACK_TOKEN_BYTES = 32;

function toBase64Url(bytes: Uint8Array): string {
  // tweetnacl-util has no base64url encoder; url-safe the standard one.
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]!);
  const b64 =
    typeof btoa === 'function'
      ? btoa(binary)
      : Buffer.from(bytes).toString('base64');
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Mint a fresh playback token: at least 32 random bytes, base64url so it is
 * safe unescaped in a URL path segment.
 */
export function mintPlaybackToken(prng: PrngBytes): string {
  const bytes = prng(PLAYBACK_TOKEN_BYTES);
  if (bytes.length < PLAYBACK_TOKEN_BYTES) {
    throw new Error('A playback token needs at least 32 random bytes.');
  }
  return toBase64Url(bytes);
}

/**
 * Length-safe constant-time string comparison. Runs over the longer of the two
 * and folds the length difference in, so neither the match/mismatch nor the
 * length is revealed through timing.
 */
export function constantTimeEquals(a: string, b: string): boolean {
  const len = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < len; i += 1) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

/** The single active token for a server session. */
export interface PlaybackToken {
  value: string;
  createdAtMs: number;
  maxAgeMs: number;
}

/** True once a token is past createdAt + maxAgeMs at time `nowMs`. */
export function isPlaybackTokenExpired(token: PlaybackToken, nowMs: number): boolean {
  return nowMs >= token.createdAtMs + token.maxAgeMs;
}

/**
 * Validate a candidate token from a request path against the session's single
 * active token: constant-time value match AND not expired. A null active token
 * (server not armed) always fails.
 */
export function validatePlaybackToken(
  active: PlaybackToken | null,
  candidate: string,
  nowMs: number,
): boolean {
  if (!active) {
    // Still burn a constant-time compare against a fixed-width dummy so an
    // un-armed server is not distinguishable by timing from a wrong token.
    constantTimeEquals(candidate, '');
    return false;
  }
  const valueOk = constantTimeEquals(candidate, active.value);
  const fresh = !isPlaybackTokenExpired(active, nowMs);
  return valueOk && fresh;
}

// ---------------------------------------------------------------------------
// Range parsing (RFC 7233 single range) and range -> chunk window mapping.
// ---------------------------------------------------------------------------

/** Inclusive absolute byte offsets [start, end]. */
export interface ByteRange {
  start: number;
  end: number;
}

export type RangeResult =
  | { kind: 'full' } // no/ignored Range: serve the whole thing as 200
  | { kind: 'range'; range: ByteRange } // one satisfiable range: 206
  | { kind: 'unsatisfiable' }; // out of bounds: 416

/**
 * Parse a Range header value against the known total size, per RFC 7233 for a
 * single byte range. Recognizes `bytes=a-b`, `bytes=a-`, and `bytes=-suffix`.
 * A missing/blank value, an unknown unit, a multi-range set, or a malformed
 * value all fall back to `full` (serve 200), which is a legal server choice.
 * Only a well-formed BUT out-of-bounds range is `unsatisfiable` (416).
 */
export function parseRangeHeader(value: string | undefined, totalSize: number): RangeResult {
  if (!value) return { kind: 'full' };
  const trimmed = value.trim();
  const eq = trimmed.indexOf('=');
  if (eq === -1) return { kind: 'full' };
  const unit = trimmed.slice(0, eq).trim().toLowerCase();
  if (unit !== 'bytes') return { kind: 'full' };

  const spec = trimmed.slice(eq + 1).trim();
  if (spec.includes(',')) return { kind: 'full' }; // multi-range: serve full 200

  const dash = spec.indexOf('-');
  if (dash === -1) return { kind: 'full' };
  const startText = spec.slice(0, dash).trim();
  const endText = spec.slice(dash + 1).trim();

  const isDigits = (s: string) => s.length > 0 && /^[0-9]+$/.test(s);

  // Suffix form: bytes=-N (the last N bytes).
  if (startText === '') {
    if (!isDigits(endText)) return { kind: 'full' };
    const suffix = Number(endText);
    if (suffix === 0) return { kind: 'unsatisfiable' };
    if (totalSize === 0) return { kind: 'unsatisfiable' };
    const start = Math.max(0, totalSize - suffix);
    return { kind: 'range', range: { start, end: totalSize - 1 } };
  }

  if (!isDigits(startText)) return { kind: 'full' };
  const start = Number(startText);
  if (totalSize === 0 || start >= totalSize) return { kind: 'unsatisfiable' };

  // Open-ended form: bytes=a- (to end of content).
  if (endText === '') {
    return { kind: 'range', range: { start, end: totalSize - 1 } };
  }

  if (!isDigits(endText)) return { kind: 'full' };
  let end = Number(endText);
  if (end < start) return { kind: 'unsatisfiable' };
  if (end > totalSize - 1) end = totalSize - 1; // clamp per RFC
  return { kind: 'range', range: { start, end } };
}

/** The chunk-index window a byte range projects onto. */
export interface ChunkWindow {
  firstChunk: number;
  lastChunk: number;
  skipBytesInFirst: number; // bytes to drop off the front of firstChunk
  takeBytes: number; // total plaintext bytes to emit across the window
}

/**
 * Map an inclusive byte range onto the chunk grid: which chunks cover it, how
 * far into the first chunk playback starts (seek support), and how many bytes
 * to emit in all. chunkSize must match the signed manifest's chunkSize.
 */
export function rangeToChunkWindow(range: ByteRange, chunkSize: number): ChunkWindow {
  if (chunkSize <= 0) throw new Error('chunkSize must be positive.');
  const firstChunk = Math.floor(range.start / chunkSize);
  const lastChunk = Math.floor(range.end / chunkSize);
  return {
    firstChunk,
    lastChunk,
    skipBytesInFirst: range.start - firstChunk * chunkSize,
    takeBytes: range.end - range.start + 1,
  };
}

// ---------------------------------------------------------------------------
// Response head builders.
// ---------------------------------------------------------------------------

export interface ResponseHead {
  status: number;
  statusText: string;
  headers: Record<string, string>;
}

const STATUS_TEXT: Record<number, string> = {
  200: 'OK',
  206: 'Partial Content',
  400: 'Bad Request',
  401: 'Unauthorized',
  404: 'Not Found',
  405: 'Method Not Allowed',
  416: 'Range Not Satisfiable',
  431: 'Request Header Fields Too Large',
};

const DEFAULT_MIME = 'application/octet-stream';

/** A bodyless error head (401/404/405/400/431). 405 advertises Allow. */
export function buildErrorHead(status: 400 | 401 | 404 | 405 | 431): ResponseHead {
  const headers: Record<string, string> = { 'Content-Length': '0' };
  if (status === 405) headers['Allow'] = 'GET, HEAD';
  return { status, statusText: STATUS_TEXT[status]!, headers };
}

/** 416 with the required `Content-Range: bytes * /total` unsatisfiable marker. */
export function buildUnsatisfiableHead(totalSize: number): ResponseHead {
  return {
    status: 416,
    statusText: STATUS_TEXT[416]!,
    headers: {
      'Content-Range': `bytes */${totalSize}`,
      'Content-Length': '0',
      'Accept-Ranges': 'bytes',
    },
  };
}

/** 200 full-content head. */
export function buildFullHead(totalSize: number, mime: string | undefined): ResponseHead {
  return {
    status: 200,
    statusText: STATUS_TEXT[200]!,
    headers: {
      'Content-Type': mime || DEFAULT_MIME,
      'Content-Length': String(totalSize),
      'Accept-Ranges': 'bytes',
    },
  };
}

/** 206 partial-content head for an inclusive [start,end] over total. */
export function buildPartialHead(
  range: ByteRange,
  totalSize: number,
  mime: string | undefined,
): ResponseHead {
  return {
    status: 206,
    statusText: STATUS_TEXT[206]!,
    headers: {
      'Content-Type': mime || DEFAULT_MIME,
      'Content-Range': `bytes ${range.start}-${range.end}/${totalSize}`,
      'Content-Length': String(range.end - range.start + 1),
      'Accept-Ranges': 'bytes',
    },
  };
}

// ---------------------------------------------------------------------------
// Streaming decrypt iterator: verified plaintext, in order, seek-aware.
// ---------------------------------------------------------------------------

/** Async reader of a stored sealed block payload by its sealedId. */
export type GetBlockPayload = (sealedId: string) => Promise<string | null>;

/** The signed-manifest fields the stream needs (a NodeManifest satisfies it). */
export interface StreamManifest {
  contentId: string;
  chunkSize: number;
  chunkHashes: string[];
  size: number;
}

export interface MakeChunkStreamArgs {
  getBlockPayload: GetBlockPayload;
  manifest: StreamManifest;
  /** Ordered block ids, index i -> the sealed block for chunk i. */
  sealedChunkIds: string[];
  /** The unwrapped per-object DEK. Held for the stream's life, then zeroed. */
  dek: Uint8Array;
  window: ChunkWindow;
}

function chunkInfo(contentId: string, index: number): string {
  // Domain string MUST match sealed-share.ts's per-chunk key derivation.
  return `meerkat-node-chunk:v1:${contentId}:${index}`;
}

/** Split a `base64(nonce).base64(ciphertext)` payload and authenticated-decrypt. */
function openBlockPayload(payload: string, key: Uint8Array): Uint8Array | null {
  const dot = payload.indexOf('.');
  if (dot === -1) return null;
  try {
    const nonce = decodeBase64(payload.slice(0, dot));
    const ciphertext = decodeBase64(payload.slice(dot + 1));
    return decrypt(ciphertext, nonce, key);
  } catch {
    return null;
  }
}

/**
 * Yield verified plaintext byte slices for a chunk window, IN ORDER. Each chunk
 * is fetched, authenticated-decrypted, and its full plaintext hashed against the
 * SIGNED manifest BEFORE any of its bytes are emitted; a missing block, a failed
 * decrypt, or a hash mismatch throws and aborts the stream (unverified bytes are
 * never yielded). skipBytesInFirst seeks into the first chunk; takeBytes bounds
 * the total. The DEK is zeroed when the generator finishes (normally or on abort).
 */
export async function* makeChunkStream(
  args: MakeChunkStreamArgs,
): AsyncGenerator<Uint8Array, void, unknown> {
  const { getBlockPayload, manifest, sealedChunkIds, dek, window } = args;
  let remainingTake = window.takeBytes;
  try {
    for (let i = window.firstChunk; i <= window.lastChunk; i += 1) {
      if (remainingTake <= 0) break;

      const sealedId = sealedChunkIds[i];
      if (!sealedId) throw new Error(`Missing sealed block id for chunk ${i}.`);
      const payload = await getBlockPayload(sealedId);
      if (payload === null) throw new Error(`Sealed block ${sealedId} is not available.`);

      const key = hkdf(dek, chunkInfo(manifest.contentId, i));
      let plain: Uint8Array | null;
      try {
        plain = openBlockPayload(payload, key);
      } finally {
        key.fill(0);
      }
      if (!plain) throw new Error(`Chunk ${i} failed authenticated decrypt.`);
      if (sha512Hex(plain) !== manifest.chunkHashes[i]) {
        plain.fill(0);
        throw new Error(`Chunk ${i} plaintext does not match the signed manifest.`);
      }

      const sliceStart = i === window.firstChunk ? window.skipBytesInFirst : 0;
      const sliceEnd = Math.min(plain.length, sliceStart + remainingTake);
      if (sliceEnd > sliceStart) {
        // slice() copies, so zeroing `plain` afterward does not touch the emitted
        // bytes; the consumer owns its copy.
        const out = plain.slice(sliceStart, sliceEnd);
        remainingTake -= out.length;
        plain.fill(0);
        yield out;
      } else {
        plain.fill(0);
      }
    }
  } finally {
    dek.fill(0);
  }
}

// ---------------------------------------------------------------------------
// Orchestrator: raw request bytes -> response head + optional body stream.
// ---------------------------------------------------------------------------

/** A servable library item: its signed manifest, block ids, DEK, and mime. */
export interface LoopbackItem {
  manifest: StreamManifest;
  sealedChunkIds: string[];
  /** The unwrapped per-object DEK for this item's blocks. */
  dek: Uint8Array;
  mime?: string;
}

export interface LoopbackServerState {
  /** The single active playback token, or null when the server is not armed. */
  token: PlaybackToken | null;
  /** Wall clock, injected. */
  now: () => number;
  /** Resolve a content id to a servable item, or null if unknown to this server. */
  resolveItem: (contentId: string) => LoopbackItem | null;
  getBlockPayload: GetBlockPayload;
}

export interface LoopbackResponse {
  head: ResponseHead;
  /** Present for GET success; null for HEAD and every error/no-content head. */
  body: AsyncGenerator<Uint8Array, void, unknown> | null;
}

/**
 * The whole request handler, socket-free: parse -> method gate -> path/token ->
 * item -> range -> head + (for GET) verified body stream. The tcp-socket glue
 * only has to feed raw bytes in and serialize head + body out.
 */
export function handleLoopbackRequest(
  state: LoopbackServerState,
  raw: string | Uint8Array,
): LoopbackResponse {
  const parsed = parseHttpRequest(raw);
  if (!parsed.ok) return { head: buildErrorHead(parsed.status), body: null };

  const { method, path, headers } = parsed.request;
  if (method !== 'GET' && method !== 'HEAD') {
    return { head: buildErrorHead(405), body: null };
  }

  const playbackPath = parsePlaybackPath(path);
  if (!playbackPath) return { head: buildErrorHead(404), body: null };

  if (!validatePlaybackToken(state.token, playbackPath.token, state.now())) {
    return { head: buildErrorHead(401), body: null };
  }

  const item = state.resolveItem(playbackPath.contentId);
  if (!item) return { head: buildErrorHead(404), body: null };

  const totalSize = item.manifest.size;
  const rangeResult = parseRangeHeader(headers['range'], totalSize);

  if (rangeResult.kind === 'unsatisfiable') {
    return { head: buildUnsatisfiableHead(totalSize), body: null };
  }

  const effectiveRange: ByteRange =
    rangeResult.kind === 'range'
      ? rangeResult.range
      : { start: 0, end: Math.max(0, totalSize - 1) };

  const head =
    rangeResult.kind === 'range'
      ? buildPartialHead(effectiveRange, totalSize, item.mime)
      : buildFullHead(totalSize, item.mime);

  // HEAD returns identical headers with no body.
  if (method === 'HEAD') return { head, body: null };

  // A zero-length full response has no body to stream.
  if (totalSize === 0) return { head, body: null };

  const window = rangeToChunkWindow(effectiveRange, item.manifest.chunkSize);
  const body = makeChunkStream({
    getBlockPayload: state.getBlockPayload,
    manifest: item.manifest,
    sealedChunkIds: item.sealedChunkIds,
    dek: item.dek,
    window,
  });
  return { head, body };
}
