// Portable layout blob: a self-contained, serverless string carried inside the
// owner-signed cm_layout event and shareable as a template (copy, QR, deep
// link). No cryptography here (authenticity comes from the cm_layout event's
// Ed25519 signature, verified in @mylife/sync); the checksum guards against
// corruption only, NOT tampering. The real security is the strict schema
// validation + size cap on decode (an imported blob is untrusted input). Pure
// TS: hand-rolled base64url + UTF-8 + CRC32 so it runs identically in Node,
// Hermes, and the browser with zero dependencies. Mirrors
// @mylife/meerkat-theme/src/codec.ts (the proven Plan 18 shape).

import { MkLayoutDocumentSchema } from './schema';
import type { MkLayoutDocument } from './types';

export const LAYOUT_BLOB_PREFIX = 'meerkat-layout:v1:';
const BLOB_NAMESPACE = 'meerkat-layout:';
export const LAYOUT_DEEP_LINK_PREFIX = 'meerkat://layout/import#';

/** Hard cap on decoded JSON size (composition plan 2.2: layout_blob capped 32 KB). */
export const MAX_LAYOUT_BLOB_BYTES = 32 * 1024;
/** Outer guard so a multi-megabyte string never reaches base64 decoding. */
const MAX_INPUT_CHARS = 128 * 1024;

export type LayoutDecodeErrorCode =
  | 'malformed'
  | 'checksum'
  | 'too-large'
  | 'newer-version'
  | 'schema';

export interface LayoutDecodeError {
  code: LayoutDecodeErrorCode;
  message: string;
  /** Field-level schema errors when code === 'schema'. */
  details?: string[];
}

export type LayoutDecodeResult =
  | { success: true; layout: MkLayoutDocument }
  | { success: false; error: LayoutDecodeError };

const ERROR_COPY: Record<LayoutDecodeErrorCode, string> = {
  malformed: "That doesn't look like a Meerkat layout.",
  checksum: 'This layout code looks corrupted. Ask for a fresh copy.',
  'too-large': 'That layout is too large to import.',
  schema: "That layout is missing or has invalid blocks and can't be used.",
  'newer-version': 'That layout was made in a newer version of Meerkat.',
};

/** The exact honest copy for an import error code. */
export function layoutDecodeErrorMessage(code: LayoutDecodeErrorCode): string {
  return ERROR_COPY[code];
}

function fail(
  code: LayoutDecodeErrorCode,
  details?: string[],
): { success: false; error: LayoutDecodeError } {
  return { success: false, error: { code, message: ERROR_COPY[code], details } };
}

// --- base64url (no padding) over raw bytes ---

const B64_ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const B64_LOOKUP: Record<string, number> = {};
for (let i = 0; i < B64_ALPHABET.length; i++) B64_LOOKUP[B64_ALPHABET[i]] = i;

function bytesToBase64url(bytes: Uint8Array): string {
  let out = '';
  let buffer = 0;
  let bits = 0;
  for (let i = 0; i < bytes.length; i++) {
    buffer = (buffer << 8) | bytes[i];
    bits += 8;
    while (bits >= 6) {
      bits -= 6;
      out += B64_ALPHABET[(buffer >> bits) & 0x3f];
    }
  }
  if (bits > 0) out += B64_ALPHABET[(buffer << (6 - bits)) & 0x3f];
  return out;
}

function base64urlToBytes(input: string): Uint8Array {
  const out: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (let i = 0; i < input.length; i++) {
    const value = B64_LOOKUP[input[i]];
    if (value === undefined) throw new Error('bad base64url');
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out.push((buffer >> bits) & 0xff);
    }
  }
  return Uint8Array.from(out);
}

// --- UTF-8 (hand-rolled, no TextEncoder dependency) ---

function utf8Encode(str: string): Uint8Array {
  const out: number[] = [];
  for (let i = 0; i < str.length; i++) {
    let code = str.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff && i + 1 < str.length) {
      const next = str.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        code = 0x10000 + ((code - 0xd800) << 10) + (next - 0xdc00);
        i++;
      }
    }
    if (code < 0x80) {
      out.push(code);
    } else if (code < 0x800) {
      out.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else if (code < 0x10000) {
      out.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    } else {
      out.push(
        0xf0 | (code >> 18),
        0x80 | ((code >> 12) & 0x3f),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f),
      );
    }
  }
  return Uint8Array.from(out);
}

function utf8Decode(bytes: Uint8Array): string {
  let out = '';
  let i = 0;
  while (i < bytes.length) {
    const b0 = bytes[i++];
    if (b0 < 0x80) {
      out += String.fromCharCode(b0);
    } else if (b0 < 0xe0) {
      const b1 = bytes[i++];
      out += String.fromCharCode(((b0 & 0x1f) << 6) | (b1 & 0x3f));
    } else if (b0 < 0xf0) {
      const b1 = bytes[i++];
      const b2 = bytes[i++];
      out += String.fromCharCode(((b0 & 0x0f) << 12) | ((b1 & 0x3f) << 6) | (b2 & 0x3f));
    } else {
      const b1 = bytes[i++];
      const b2 = bytes[i++];
      const b3 = bytes[i++];
      let cp = ((b0 & 0x07) << 18) | ((b1 & 0x3f) << 12) | ((b2 & 0x3f) << 6) | (b3 & 0x3f);
      cp -= 0x10000;
      out += String.fromCharCode(0xd800 + (cp >> 10), 0xdc00 + (cp & 0x3ff));
    }
  }
  return out;
}

// --- CRC32 (corruption guard, NOT a security control) ---

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc ^= bytes[i];
    for (let k = 0; k < 8; k++) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function crc8hex(bytes: Uint8Array): string {
  return crc32(bytes).toString(16).padStart(8, '0');
}

// --- canonical JSON (stable key order so a document always encodes identically) ---

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      sorted[key] = canonicalize((value as Record<string, unknown>)[key]);
    }
    return sorted;
  }
  return value;
}

/**
 * The canonical UTF-8 bytes of a validated document: exactly what the blob
 * base64url-encodes. Stable (sorted keys) so the same layout always yields the
 * same bytes, which keeps the owner-signed event's canonical form stable.
 */
export function canonicalLayoutBytes(document: MkLayoutDocument): Uint8Array {
  const parsed = MkLayoutDocumentSchema.parse(document);
  return utf8Encode(JSON.stringify(canonicalize(parsed)));
}

/** Encode a validated document to a portable blob (canonicalized + checksummed). */
export function encodeLayoutBlob(document: MkLayoutDocument): string {
  const bytes = canonicalLayoutBytes(document);
  if (bytes.length > MAX_LAYOUT_BLOB_BYTES) {
    throw new Error('Layout document exceeds the 32 KB blob cap.');
  }
  return `${LAYOUT_BLOB_PREFIX}${bytesToBase64url(bytes)}:${crc8hex(bytes)}`;
}

/** Wrap a document as a `meerkat://layout/import#<blob>` deep link (templates). */
export function buildLayoutDeepLink(document: MkLayoutDocument): string {
  return `${LAYOUT_DEEP_LINK_PREFIX}${encodeLayoutBlob(document)}`;
}

/** Pull the blob out of a deep link, or return the input if it already looks like a blob. Null otherwise. */
export function extractLayoutBlob(input: string): string | null {
  const trimmed = input.trim();
  if (trimmed.startsWith(LAYOUT_DEEP_LINK_PREFIX)) {
    return trimmed.slice(LAYOUT_DEEP_LINK_PREFIX.length);
  }
  if (trimmed.startsWith(BLOB_NAMESPACE)) return trimmed;
  return null;
}

/**
 * Decode an untrusted blob (or deep link) into a validated document. Never
 * throws. Order of guards: namespace -> version gate -> outer size -> base64 ->
 * decoded size cap -> checksum -> JSON -> strict schema.
 */
export function decodeLayoutBlob(input: string): LayoutDecodeResult {
  if (typeof input !== 'string') return fail('malformed');
  // Bound work on the RAW input before trim() touches it, so a megabytes-of-
  // whitespace payload is rejected immediately rather than trimmed first.
  if (input.length > MAX_INPUT_CHARS) return fail('too-large');
  const raw = input.trim();

  const blob = extractLayoutBlob(raw);
  if (blob === null) return fail('malformed');

  const afterNamespace = blob.slice(BLOB_NAMESPACE.length);
  const versionMatch = afterNamespace.match(/^v(\d+):/);
  if (!versionMatch) return fail('malformed');
  const version = Number(versionMatch[1]);
  if (version > 1) return fail('newer-version');
  if (version !== 1) return fail('malformed');

  // body is `<b64document>:<crc>`. base64url and hex never contain ':'.
  const body = afterNamespace.slice(versionMatch[0].length);
  const segments = body.split(':');
  if (segments.length !== 2) return fail('malformed');
  const [b64, crcHex] = segments;
  if (!/^[0-9a-f]{8}$/.test(crcHex)) return fail('malformed');

  let bytes: Uint8Array;
  try {
    bytes = base64urlToBytes(b64);
  } catch {
    return fail('malformed');
  }
  if (bytes.length === 0) return fail('malformed');
  if (bytes.length > MAX_LAYOUT_BLOB_BYTES) return fail('too-large');
  if (crc8hex(bytes) !== crcHex) return fail('checksum');

  let parsed: unknown;
  try {
    parsed = JSON.parse(utf8Decode(bytes));
  } catch {
    return fail('malformed');
  }

  const result = MkLayoutDocumentSchema.safeParse(parsed);
  if (result.success) {
    return { success: true, layout: result.data as MkLayoutDocument };
  }
  return fail(
    'schema',
    result.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`),
  );
}
