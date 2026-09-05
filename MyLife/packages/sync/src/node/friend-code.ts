/**
 * Meerkat friend codes.
 *
 * A friend code is a human-shareable, checksummed pointer to a rendezvous id.
 * Format: `MEER-XXXX-XXXX-XXXX-XXXX` where the 16 payload characters are
 * Crockford base32 of 10 bytes: 8 random rendezvous-id bytes plus a 2-byte
 * checksum (the first 2 bytes of SHA-512 over the id). The checksum lets a
 * mistyped code be rejected before it ever hits the network.
 *
 * The code itself carries no key material. It resolves, via the rendezvous
 * service, to a SIGNED identity bundle; both peers then approve and verify
 * (emoji SAS) before anything syncs. See D7 in the v2 design.
 */

import nacl from 'tweetnacl';

// Crockford base32 alphabet (no I, L, O, U to avoid transcription errors).
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const DECODE_MAP: Record<string, number> = (() => {
  const map: Record<string, number> = {};
  for (let i = 0; i < ALPHABET.length; i++) map[ALPHABET[i]!] = i;
  // Common transcription aliases.
  map['I'] = 1;
  map['L'] = 1;
  map['O'] = 0;
  map['U'] = map['V']!;
  return map;
})();

const ID_BYTES = 8;
const CHECKSUM_BYTES = 2;
const TOTAL_BYTES = ID_BYTES + CHECKSUM_BYTES; // 10 bytes -> 16 base32 chars

function checksum(id: Uint8Array): Uint8Array {
  return nacl.hash(id).slice(0, CHECKSUM_BYTES);
}

function encodeBase32(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    value = (value << 8) | bytes[i]!;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    out += ALPHABET[(value << (5 - bits)) & 31];
  }
  return out;
}

function decodeBase32(text: string, expectedBytes: number): Uint8Array | null {
  let bits = 0;
  let value = 0;
  const out = new Uint8Array(expectedBytes);
  let index = 0;
  for (const ch of text) {
    const v = DECODE_MAP[ch];
    if (v === undefined) return null;
    value = (value << 5) | v;
    bits += 5;
    if (bits >= 8) {
      if (index >= expectedBytes) return null;
      out[index++] = (value >>> (bits - 8)) & 0xff;
      bits -= 8;
    }
  }
  if (index !== expectedBytes) return null;
  return out;
}

function group(code: string): string {
  return code.match(/.{1,4}/g)?.join('-') ?? code;
}

/**
 * Generate a fresh friend code from a random rendezvous id.
 * Returns both the formatted code and the raw id bytes (the id is what the
 * device registers with the rendezvous service).
 */
export function generateFriendCode(): { code: string; rendezvousId: Uint8Array } {
  const rendezvousId = nacl.randomBytes(ID_BYTES);
  return { code: encodeFriendCode(rendezvousId), rendezvousId };
}

/**
 * Encode a known rendezvous id (8 bytes) into a formatted friend code.
 */
export function encodeFriendCode(rendezvousId: Uint8Array): string {
  if (rendezvousId.length !== ID_BYTES) {
    throw new Error(`rendezvousId must be ${ID_BYTES} bytes`);
  }
  const payload = new Uint8Array(TOTAL_BYTES);
  payload.set(rendezvousId, 0);
  payload.set(checksum(rendezvousId), ID_BYTES);
  return 'MEER-' + group(encodeBase32(payload));
}

/**
 * Parse and checksum-validate a friend code (case-insensitive, dashes and
 * spaces ignored). Returns the rendezvous id, or null if malformed or the
 * checksum does not match.
 */
export function parseFriendCode(code: string): Uint8Array | null {
  const cleaned = code
    .toUpperCase()
    .replace(/^MEER-?/i, '')
    .replace(/[-\s]/g, '');
  if (cleaned.length !== 16) return null;

  const payload = decodeBase32(cleaned, TOTAL_BYTES);
  if (!payload) return null;

  const id = payload.slice(0, ID_BYTES);
  const expected = checksum(id);
  for (let i = 0; i < CHECKSUM_BYTES; i++) {
    if (payload[ID_BYTES + i] !== expected[i]) return null;
  }
  return id;
}

/**
 * True if the code is well-formed and its checksum matches.
 */
export function isValidFriendCode(code: string): boolean {
  return parseFriendCode(code) !== null;
}

// ---------------------------------------------------------------------------
// Custom (vanity + random suffix) friend codes.
//
// A user picks a readable word; Meerkat appends a random Crockford suffix so the
// code keeps real baseline entropy. Unlike a standard code, a custom code is NOT
// checksummed and carries no embedded rendezvous bytes; instead its full
// normalized text is hashed (domain-separated) into a stable 8-byte rendezvous
// id. The normalized length is deliberately kept away from the standard 16-char
// shape so a custom code can never be mistaken for a checksummed one.
// ---------------------------------------------------------------------------

/** Minimum normalized length for a custom friend code. */
export const CUSTOM_FRIEND_CODE_MIN_LENGTH = 12;

/** Minimum normalized vanity length a user must supply before the suffix. */
const VANITY_MIN_LENGTH = 4;

/** Random Crockford chars appended to a vanity (>= 40 bits at 5 bits/char). */
const VANITY_SUFFIX_LENGTH = 8;

/** Domain separation tag for deriving a rid from a custom code. */
const CUSTOM_CODE_RID_DOMAIN = 'meerkat/custom-friend-code/v1';

const ALIAS_MAP: Record<string, string> = { I: '1', L: '1', O: '0', U: 'V' };

/** A random-bytes source compatible with the package PRNG (nacl.randomBytes). */
export type FriendCodePrng = (count: number) => Uint8Array | ArrayLike<number>;

/**
 * Normalize a user-typed friend code: uppercase, strip a leading `MEER-?`, drop
 * dashes and whitespace, and map Crockford transcription aliases (I/L->1, O->0,
 * U->V). Any character outside the Crockford base32 alphabet after aliasing
 * makes the whole input invalid, signalled by an empty string. Idempotent.
 */
export function normalizeFriendCodeInput(input: string): string {
  const cleaned = input
    .toUpperCase()
    .replace(/^MEER-?/, '')
    .replace(/[-\s]/g, '');
  let out = '';
  for (const ch of cleaned) {
    const mapped = ALIAS_MAP[ch] ?? ch;
    if (DECODE_MAP[mapped] === undefined) return '';
    out += mapped;
  }
  return out;
}

/**
 * True if `input` normalizes to a pure Crockford string of at least
 * CUSTOM_FRIEND_CODE_MIN_LENGTH characters.
 */
export function isValidCustomFriendCode(input: string): boolean {
  const normalized = normalizeFriendCodeInput(input);
  return normalized.length >= CUSTOM_FRIEND_CODE_MIN_LENGTH;
}

/**
 * Build a display-formatted custom friend code from a user-chosen vanity plus a
 * random Crockford suffix. The vanity must normalize to at least
 * VANITY_MIN_LENGTH chars; the suffix adds VANITY_SUFFIX_LENGTH random chars so
 * the total normalized length is always >= CUSTOM_FRIEND_CODE_MIN_LENGTH. The
 * result is guaranteed never to be exactly 16 normalized chars, so it cannot
 * collide with the standard checksummed shape.
 *
 * Entropy comes from the package PRNG (`nacl.randomBytes`, configured to the
 * platform CSPRNG) unless an explicit `prng` is injected for tests. Never
 * `Math.random`.
 */
export function makeVanityFriendCode(vanity: string, prng: FriendCodePrng = nacl.randomBytes): string {
  const normalizedVanity = normalizeFriendCodeInput(vanity);
  if (normalizedVanity.length < VANITY_MIN_LENGTH) {
    throw new Error(
      `Vanity must be at least ${VANITY_MIN_LENGTH} valid characters (got ${normalizedVanity.length}).`,
    );
  }

  let suffixLength = VANITY_SUFFIX_LENGTH;
  // Guarantee the total normalized length reaches the minimum even for a short
  // vanity, and step off the standard 16-char shape if we would land on it.
  if (normalizedVanity.length + suffixLength < CUSTOM_FRIEND_CODE_MIN_LENGTH) {
    suffixLength = CUSTOM_FRIEND_CODE_MIN_LENGTH - normalizedVanity.length;
  }
  if (normalizedVanity.length + suffixLength === 16) {
    suffixLength += 1;
  }

  const suffix = randomCrockford(suffixLength, prng);
  return 'MEER-' + group(normalizedVanity + suffix);
}

/** Draw `length` random Crockford characters from the given PRNG. */
function randomCrockford(length: number, prng: FriendCodePrng): string {
  const raw = prng(length);
  let out = '';
  for (let i = 0; i < length; i++) {
    const byte = raw[i] ?? 0;
    out += ALPHABET[byte & 31];
  }
  return out;
}

/**
 * Derive a stable 8-byte rendezvous id from a custom friend code by a
 * domain-separated SHA-512 over its normalized text. Deterministic, so publish
 * and resolve agree. Returns null when the code is not a valid custom code.
 */
export function rendezvousIdFromCustomCode(input: string): Uint8Array | null {
  const normalized = normalizeFriendCodeInput(input);
  if (normalized.length < CUSTOM_FRIEND_CODE_MIN_LENGTH) return null;
  const material = new TextEncoder().encode(CUSTOM_CODE_RID_DOMAIN + normalized);
  return nacl.hash(material).slice(0, ID_BYTES);
}

/**
 * Unified resolver: try the standard checksummed path first (parseFriendCode),
 * then fall back to the custom domain-separated derivation. Returns the 8-byte
 * rendezvous id, or null when the code is neither a valid standard nor a valid
 * custom code. A custom code (never 16 normalized chars) cannot be parsed as a
 * standard one, so the two derivations never overlap.
 */
export function friendCodeToRendezvousId(code: string): Uint8Array | null {
  const standard = parseFriendCode(code);
  if (standard) return standard;
  return rendezvousIdFromCustomCode(code);
}

// ---------------------------------------------------------------------------
// Extended (sealed) friend codes (Plan 23 D.5).
//
// A normal friend code's PUBLIC half derives the rendezvous id `rid` that is
// sent to the relay. An extended code appends a SECRET half (random bytes that
// only the code holder learns) after a `~` separator. The secret half never
// reaches the relay; it derives the symmetric key that seals the published
// identity record, so a relay operator can no longer read a device's public
// keys or display name from the stored record. The `rid` (an HKDF of the public
// half) is the ONLY thing transmitted, exactly as before -- no relay change.
//
//   MEER-XXXX-XXXX-XXXX-XXXX~YYYY-YYYY-YYYY-YYYY-YYYY-YYYY
//   \________ public code (rid) ______/ \___ secret half ___/
// ---------------------------------------------------------------------------

/** Separator between the public friend code and its secret seal half. */
const EXTENDED_CODE_SEP = '~';

/** Secret-half entropy in bytes (128-bit). Encodes to ~26 Crockford chars. */
const SECRET_HALF_BYTES = 16;

export interface ExtendedFriendCodeParts {
  /** The public half's 8-byte rendezvous id (what the relay sees). */
  rendezvousId: Uint8Array;
  /** The secret half bytes (NEVER transmitted; derives the seal key). */
  secretHalf: Uint8Array;
  /** The public friend code (standard or custom) without the secret half. */
  publicCode: string;
}

/** True if `code` carries a secret half (contains the extended separator). */
export function isExtendedFriendCode(code: string): boolean {
  return code.includes(EXTENDED_CODE_SEP);
}

/**
 * Append a secret half to an existing public friend code (standard or custom),
 * producing the shareable extended code. The public code is left untouched, so
 * the derived `rid` and any prior pairing stay stable.
 */
export function buildExtendedFriendCode(publicCode: string, secretHalf: Uint8Array): string {
  if (secretHalf.length !== SECRET_HALF_BYTES) {
    throw new Error(`secretHalf must be ${SECRET_HALF_BYTES} bytes`);
  }
  return `${publicCode}${EXTENDED_CODE_SEP}${group(encodeBase32(secretHalf))}`;
}

/** Generate a fresh random secret half for sealing a rendezvous record. */
export function generateRendezvousSecretHalf(prng: FriendCodePrng = nacl.randomBytes): Uint8Array {
  return Uint8Array.from(prng(SECRET_HALF_BYTES));
}

/**
 * Parse an extended friend code into its public rendezvous id + secret half.
 * Accepts a public code (standard or custom) followed by `~` and the base32
 * secret half. Returns null if the code is not extended or either half is
 * malformed. The public half resolves through {@link friendCodeToRendezvousId},
 * so both standard and custom public codes are supported.
 */
export function parseExtendedFriendCode(code: string): ExtendedFriendCodeParts | null {
  const sepIndex = code.indexOf(EXTENDED_CODE_SEP);
  if (sepIndex === -1) return null;
  const publicCode = code.slice(0, sepIndex).trim();
  const secretPart = code.slice(sepIndex + 1);
  const rendezvousId = friendCodeToRendezvousId(publicCode);
  if (!rendezvousId) return null;
  const cleanedSecret = secretPart.toUpperCase().replace(/[-\s]/g, '');
  const secretHalf = decodeBase32(cleanedSecret, SECRET_HALF_BYTES);
  if (!secretHalf) return null;
  return { rendezvousId, secretHalf, publicCode };
}
