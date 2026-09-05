// Portable theme blob: a self-contained, serverless string a user can copy,
// QR, or deep-link. No cryptography (themes are public, non-secret data); the
// checksum guards against corruption only, NOT tampering. The real security is
// the strict schema validation + size cap on decode (an imported blob is
// untrusted input). Pure TS: hand-rolled base64url + UTF-8 + CRC32 so it runs
// identically in Node, Hermes, and the browser with zero dependencies.

import { MkThemeAuthorSchema, MkThemeProfileSchema } from './schema';
import type { MkThemeProfile } from './types';

export type { MkThemeAuthor } from './schema';
import type { MkThemeAuthor } from './schema';

export const THEME_BLOB_PREFIX = 'meerkat-theme:v1:';
const BLOB_NAMESPACE = 'meerkat-theme:';
export const THEME_DEEP_LINK_PREFIX = 'meerkat://theme/import#';

/** Hard cap on decoded JSON size. An imported blob above this is rejected before JSON.parse. */
export const MAX_THEME_BLOB_BYTES = 16 * 1024;
/** Cap on the optional author envelope segment (decoded). */
const MAX_AUTHOR_BYTES = 2 * 1024;
/** Outer guard so a multi-megabyte string never reaches base64 decoding. */
const MAX_INPUT_CHARS = 64 * 1024;

export type ThemeDecodeErrorCode =
  | 'malformed'
  | 'checksum'
  | 'too-large'
  | 'newer-version'
  | 'schema';

export interface ThemeDecodeError {
  code: ThemeDecodeErrorCode;
  message: string;
  /** Field-level schema errors when code === 'schema'. */
  details?: string[];
}

export type ThemeDecodeResult =
  | { success: true; theme: MkThemeProfile; author?: MkThemeAuthor }
  | { success: false; error: ThemeDecodeError };

const ERROR_COPY: Record<ThemeDecodeErrorCode, string> = {
  malformed: "That doesn't look like a Meerkat theme.",
  checksum: 'This theme code looks corrupted. Ask for a fresh copy.',
  'too-large': 'That theme is too large to import.',
  schema: "That theme is missing or has invalid colors and can't be used.",
  'newer-version': 'That theme was made in a newer version of Meerkat.',
};

/** The exact honest copy for an import error code. */
export function decodeErrorMessage(code: ThemeDecodeErrorCode): string {
  return ERROR_COPY[code];
}

function fail(
  code: ThemeDecodeErrorCode,
  details?: string[],
): { success: false; error: ThemeDecodeError } {
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

// --- canonical JSON (stable key order so a profile always encodes identically) ---

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

/** Low-level: wrap an already-serialized theme JSON string as a blob. */
export function buildThemeBlob(json: string): string {
  const bytes = utf8Encode(json);
  return `${THEME_BLOB_PREFIX}${bytesToBase64url(bytes)}:${crc8hex(bytes)}`;
}

/**
 * The canonical UTF-8 bytes of a validated profile: exactly what the blob
 * base64url-encodes and what a signed-author signature is computed over. Stable
 * (sorted keys) so the same theme always yields the same bytes.
 */
export function canonicalThemeBytes(profile: MkThemeProfile): Uint8Array {
  const parsed = MkThemeProfileSchema.parse(profile);
  return utf8Encode(JSON.stringify(canonicalize(parsed)));
}

/**
 * Encode a validated profile to a portable blob (canonicalized + checksummed).
 * An optional signed author is appended as a fourth `:`-segment; it attests who
 * authored the theme and never affects the theme's own validity.
 */
export function encodeThemeBlob(profile: MkThemeProfile, author?: MkThemeAuthor): string {
  const bytes = canonicalThemeBytes(profile);
  let blob = `${THEME_BLOB_PREFIX}${bytesToBase64url(bytes)}:${crc8hex(bytes)}`;
  if (author) {
    const authorBytes = utf8Encode(
      JSON.stringify(canonicalize(MkThemeAuthorSchema.parse(author))),
    );
    blob += `:${bytesToBase64url(authorBytes)}`;
  }
  return blob;
}

/**
 * Verify a theme's signed-author attribution. The package stays crypto-free: the
 * caller injects a verify function (the app's @mylife/sync verifySignature over
 * the canonical bytes). Returns false on any error; never throws. An invalid
 * signature only downgrades the attribution label, it never blocks a safe theme.
 */
export function verifyThemeAuthor(
  profile: MkThemeProfile,
  author: MkThemeAuthor,
  verify: (publicKeyHex: string, message: Uint8Array, signatureHex: string) => boolean,
): boolean {
  try {
    const parsed = MkThemeAuthorSchema.parse(author);
    return verify(parsed.publicKey, canonicalThemeBytes(profile), parsed.signature);
  } catch {
    return false;
  }
}

/** Parse an optional author segment; returns undefined on any failure (graceful downgrade to unsigned). */
function tryDecodeAuthor(b64author: string): MkThemeAuthor | undefined {
  try {
    const bytes = base64urlToBytes(b64author);
    if (bytes.length === 0 || bytes.length > MAX_AUTHOR_BYTES) return undefined;
    const parsed = MkThemeAuthorSchema.safeParse(JSON.parse(utf8Decode(bytes)));
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}

/** Wrap a profile as a `meerkat://theme/import#<blob>` deep link. */
export function buildThemeDeepLink(profile: MkThemeProfile): string {
  return `${THEME_DEEP_LINK_PREFIX}${encodeThemeBlob(profile)}`;
}

/** Pull the blob out of a deep link, or return the input if it already looks like a blob. Null otherwise. */
export function extractThemeBlob(input: string): string | null {
  const trimmed = input.trim();
  if (trimmed.startsWith(THEME_DEEP_LINK_PREFIX)) {
    return trimmed.slice(THEME_DEEP_LINK_PREFIX.length);
  }
  if (trimmed.startsWith(BLOB_NAMESPACE)) return trimmed;
  return null;
}

/**
 * Decode an untrusted blob (or deep link) into a validated profile. Never throws.
 * Order of guards: namespace -> version gate -> outer size -> base64 -> decoded
 * size cap -> checksum -> JSON -> strict schema.
 */
export function decodeThemeBlob(input: string): ThemeDecodeResult {
  if (typeof input !== 'string') return fail('malformed');
  // Bound work on the RAW input before trim() touches it, so a megabytes-of-
  // whitespace payload is rejected immediately rather than trimmed first.
  if (input.length > MAX_INPUT_CHARS) return fail('too-large');
  const raw = input.trim();

  const blob = extractThemeBlob(raw);
  if (blob === null) return fail('malformed');

  const afterNamespace = blob.slice(BLOB_NAMESPACE.length);
  const versionMatch = afterNamespace.match(/^v(\d+):/);
  if (!versionMatch) return fail('malformed');
  const version = Number(versionMatch[1]);
  if (version > 1) return fail('newer-version');
  if (version !== 1) return fail('malformed');

  // body is `<b64profile>:<crc>` or `<b64profile>:<crc>:<b64author>`. base64url
  // and hex never contain ':', so a plain split is unambiguous.
  const body = afterNamespace.slice(versionMatch[0].length);
  const segments = body.split(':');
  if (segments.length < 2 || segments.length > 3) return fail('malformed');
  const [b64, crcHex, b64author] = segments;
  if (!/^[0-9a-f]{8}$/.test(crcHex)) return fail('malformed');

  let bytes: Uint8Array;
  try {
    bytes = base64urlToBytes(b64);
  } catch {
    return fail('malformed');
  }
  if (bytes.length === 0) return fail('malformed');
  if (bytes.length > MAX_THEME_BLOB_BYTES) return fail('too-large');
  if (crc8hex(bytes) !== crcHex) return fail('checksum');

  let parsed: unknown;
  try {
    parsed = JSON.parse(utf8Decode(bytes));
  } catch {
    return fail('malformed');
  }

  const result = MkThemeProfileSchema.safeParse(parsed);
  if (result.success) {
    const author = b64author === undefined ? undefined : tryDecodeAuthor(b64author);
    return { success: true, theme: result.data as MkThemeProfile, author };
  }
  return fail(
    'schema',
    result.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`),
  );
}
