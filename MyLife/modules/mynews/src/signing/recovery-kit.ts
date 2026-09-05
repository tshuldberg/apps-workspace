/**
 * MyNews recovery kit (plan 48 WP6, design docs/designs/mynews-key-custody.md).
 *
 * A recovery kit is the journalist's own copy of their signing key, encrypted
 * under a code only they hold. It is what makes device loss survivable: with the
 * kit and the code, a fresh install can prove possession of the OLD key and
 * rotate to a new one, so past work stays publishable by its actual author.
 *
 * The server never holds anything usable. `nw_key_escrow` stores this envelope's
 * ciphertext and nothing else; the recovery code never leaves the device. A full
 * database compromise therefore yields secretbox ciphertext whose key is 160
 * bits of CSPRNG entropy stretched through scrypt, which is not brute-forceable.
 *
 * Crypto choices, and why:
 *
 *   secretbox (XSalsa20-Poly1305) via @mylife/sync's encrypt/decrypt, the same
 *   authenticated primitive the mesh-sync backup format uses. Tampering fails
 *   closed: decrypt returns null rather than garbage.
 *
 *   scrypt (N=2^15, r=8, p=1) from @noble/hashes. With a 160-bit random code a
 *   fast KDF would already be safe, so scrypt is defense in depth: it also
 *   covers the case of a user who transcribes a kit's code somewhere weaker, and
 *   it makes a stolen-ciphertext attack expensive per guess rather than free.
 *
 *   Salt binding. secretbox has no AAD, so the envelope's public metadata (the
 *   version, the profile, the claimed pubkey) is folded into the scrypt salt
 *   instead: sha256(domain || v || profileId || pubkey || salt16). Editing any
 *   of those fields in a stored envelope changes the derived key, so the
 *   ciphertext no longer opens. That is the AAD property, obtained through the
 *   KDF. The exact preimage below is part of the v1 envelope contract; changing
 *   it requires a new version.
 *
 *   Post-decrypt pubkey assertion. A decrypted plaintext is only as trustworthy
 *   as the code that opened it, but a hand-edited or corrupt kit could still
 *   carry a private key whose real public key is NOT the one the envelope
 *   claims. Restoring that would strand the user under a key the chain does not
 *   know. `openRecoveryKit` proves correspondence by signing a probe with the
 *   decrypted key and verifying it against `envelope.pubkey`.
 *
 * Everything here is pure: no I/O, no platform APIs beyond an injectable CSPRNG
 * seam. The seam exists so tests can pin exact code widths and encodings; it
 * defaults to the platform CSPRNG and REFUSES to fall back to anything weaker.
 */

import { scrypt } from '@noble/hashes/scrypt';
import { sha256 } from '@noble/hashes/sha256';
import {
  bytesToHex,
  decrypt,
  encrypt,
  hexToBytes,
  signMessage,
  verifySignature,
} from '@mylife/sync';

/** Envelope format version. Bump for any change to the salt preimage or fields. */
export const RECOVERY_KIT_VERSION = 1 as const;

/** Domain tag folded into the scrypt salt; separates this KDF from every other. */
export const RECOVERY_KIT_KDF_DOMAIN = 'mylife-mynews-recovery-kit-v1';

/** Raw entropy in the recovery code. 160 bits = 20 bytes = 32 base32 chars. */
export const RECOVERY_CODE_ENTROPY_BYTES = 20;
export const RECOVERY_CODE_ENTROPY_BITS = RECOVERY_CODE_ENTROPY_BYTES * 8;

/** Displayed as 8 groups of 4 characters. */
export const RECOVERY_CODE_GROUP_SIZE = 4;
export const RECOVERY_CODE_GROUP_COUNT = 8;
export const RECOVERY_CODE_CHARS = RECOVERY_CODE_GROUP_SIZE * RECOVERY_CODE_GROUP_COUNT;

/** Metadata salt length, mixed into the KDF salt preimage. */
export const RECOVERY_KIT_SALT_BYTES = 16;

/**
 * scrypt cost. N=2^15 with r=8 needs 32 MiB of working memory, which is the
 * usual ceiling before mid-range phones start paging. Raising N raises the
 * mobile cost linearly; the budget self-test below is what keeps that honest.
 */
export const RECOVERY_KIT_SCRYPT_N = 32768;
export const RECOVERY_KIT_SCRYPT_R = 8;
export const RECOVERY_KIT_SCRYPT_P = 1;
export const RECOVERY_KIT_KEY_BYTES = 32;

/**
 * Wall-clock ceiling for one derivation, asserted by a self-test. Hermes on a
 * mid-range phone runs roughly an order of magnitude slower than a dev machine,
 * so the CI budget is deliberately far below the ~2s a user would notice: if a
 * dev machine cannot derive inside this, no phone can.
 */
export const RECOVERY_KIT_KDF_BUDGET_MS = 1500;

/**
 * Crockford base32 (no I, L, O, U), the same transcription rules the Meerkat
 * recovery key and friend codes use: a user reading a code aloud or off paper
 * cannot turn a 1 into an I or a 0 into an O.
 */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const DECODE: Record<string, number> = (() => {
  const map: Record<string, number> = {};
  for (let i = 0; i < ALPHABET.length; i += 1) map[ALPHABET[i]!] = i;
  map.I = 1;
  map.L = 1;
  map.O = 0;
  map.U = map.V!;
  return map;
})();

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/**
 * CSPRNG seam. Injectable ONLY so tests can assert the requested width and the
 * encoding of known bytes; production always resolves the platform CSPRNG.
 */
export type RecoveryKitRandomBytes = (byteCount: number) => Uint8Array;

/**
 * The platform CSPRNG, or a throw. There is deliberately no Math.random
 * fallback: a recovery code is the single secret protecting the kit, and a
 * predictable one is worse than no kit at all, because the user believes they
 * are protected. React Native reaches this through the same
 * `crypto.getRandomValues` polyfill the sync PRNG configuration uses.
 */
export function platformRandomBytes(byteCount: number): Uint8Array {
  const cryptoApi = globalThis.crypto;
  if (typeof cryptoApi?.getRandomValues !== 'function') {
    throw new Error(
      'mynews recovery kit: no platform CSPRNG (crypto.getRandomValues) is available',
    );
  }
  return cryptoApi.getRandomValues(new Uint8Array(byteCount));
}

function randomOrThrow(source: RecoveryKitRandomBytes | undefined, byteCount: number): Uint8Array {
  const bytes = (source ?? platformRandomBytes)(byteCount);
  // A seam that under-delivers must never be silently zero-padded into a
  // weaker secret.
  if (!(bytes instanceof Uint8Array) || bytes.length !== byteCount) {
    throw new Error(
      `mynews recovery kit: CSPRNG returned ${bytes?.length ?? 'no'} bytes for ${byteCount} requested`,
    );
  }
  return bytes;
}

/* --------------------------------- base32 --------------------------------- */

function encodeBase32(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

function decodeBase32(text: string, expectedBytes: number): Uint8Array | null {
  let bits = 0;
  let value = 0;
  const out = new Uint8Array(expectedBytes);
  let index = 0;
  for (const char of text) {
    const digit = DECODE[char];
    if (digit === undefined) return null;
    value = (value << 5) | digit;
    bits += 5;
    if (bits >= 8) {
      if (index >= expectedBytes) return null;
      out[index] = (value >>> (bits - 8)) & 0xff;
      index += 1;
      bits -= 8;
    }
  }
  return index === expectedBytes ? out : null;
}

/** Group a bare code into the displayed `XXXX-XXXX-...` form. */
export function formatRecoveryCode(code: string): string {
  const bare = normalizeRecoveryCode(code);
  return bare.match(new RegExp(`.{1,${RECOVERY_CODE_GROUP_SIZE}}`, 'g'))?.join('-') ?? bare;
}

/**
 * Strip presentation from a typed code: case, grouping dashes, and whitespace.
 * Ambiguous characters are NOT mapped here; that happens in the base32 decode,
 * so `normalizeRecoveryCode` stays a pure presentation strip.
 */
export function normalizeRecoveryCode(code: string): string {
  return code.toUpperCase().replace(/[\s-]/g, '');
}

/**
 * A fresh recovery code: 160 bits from the CSPRNG, base32, grouped for display.
 * Show it once, confirm by re-entry (see `recoveryCodesMatch`), then let the user
 * store it. Losing it means the kit is unopenable, which is the point.
 */
export function generateRecoveryCode(randomBytes?: RecoveryKitRandomBytes): {
  code: string;
  display: string;
  entropyBits: number;
} {
  const bytes = randomOrThrow(randomBytes, RECOVERY_CODE_ENTROPY_BYTES);
  const code = encodeBase32(bytes);
  return {
    code,
    display: formatRecoveryCode(code),
    entropyBits: RECOVERY_CODE_ENTROPY_BITS,
  };
}

/** Is a typed code well formed? Shape only; it proves nothing about the kit. */
export function isRecoveryCodeWellFormed(code: string): boolean {
  const bare = normalizeRecoveryCode(code);
  if (bare.length !== RECOVERY_CODE_CHARS) return false;
  return decodeBase32(bare, RECOVERY_CODE_ENTROPY_BYTES) !== null;
}

/**
 * Re-entry confirmation for kit creation. Compares the NORMALIZED forms, so a
 * user who retypes the code with different grouping or case still matches, but a
 * user who mistyped a character does not.
 */
export function recoveryCodesMatch(first: string, second: string): boolean {
  const a = normalizeRecoveryCode(first);
  const b = normalizeRecoveryCode(second);
  return a.length === RECOVERY_CODE_CHARS && a === b;
}

/* --------------------------------- envelope -------------------------------- */

/**
 * The exported kit. Public metadata plus base64 ciphertext; every metadata field
 * is bound into the KDF salt, so none of them can be edited without breaking
 * decryption.
 */
export interface RecoveryKitEnvelope {
  v: typeof RECOVERY_KIT_VERSION;
  profileId: string;
  /** Ed25519 public key the ciphertext's private key must correspond to. */
  pubkey: string;
  /** base64, 16 bytes. */
  salt16: string;
  /** base64 secretbox nonce. */
  nonce: string;
  /** base64 secretbox ciphertext of the private key hex. */
  ciphertext: string;
  createdAt: string;
}

export type RecoveryKitOpenFailure =
  | 'bad-envelope'
  | 'bad-code'
  | 'wrong-code'
  | 'pubkey-mismatch';

export type OpenRecoveryKitResult =
  | { ok: true; privateKeyHex: string; pubkey: string; profileId: string }
  | { ok: false; reason: RecoveryKitOpenFailure };

const PUBKEY_RE = /^[0-9a-f]{64}$/;
const PRIVATE_KEY_RE = /^[0-9a-f]{128}$/;

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  // btoa is present on Hermes, Deno, browsers, and Node 16+.
  return btoa(binary);
}

function fromBase64(text: string): Uint8Array | null {
  try {
    const binary = atob(text);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

/**
 * The scrypt salt preimage, and therefore the metadata binding. Fields are
 * separated by a byte that cannot appear in any of them (0x1f, unit separator)
 * so `profileId='a', pubkey='bc'` can never hash the same as
 * `profileId='ab', pubkey='c'`.
 */
export function recoveryKitSaltPreimage(input: {
  version: number;
  profileId: string;
  pubkey: string;
  salt16: Uint8Array;
}): Uint8Array {
  const parts = [
    encoder.encode(RECOVERY_KIT_KDF_DOMAIN),
    encoder.encode(String(input.version)),
    encoder.encode(input.profileId),
    encoder.encode(input.pubkey),
    input.salt16,
  ];
  const separator = 0x1f;
  const total = parts.reduce((sum, part) => sum + part.length, 0) + (parts.length - 1);
  const out = new Uint8Array(total);
  let offset = 0;
  parts.forEach((part, index) => {
    out.set(part, offset);
    offset += part.length;
    if (index < parts.length - 1) {
      out[offset] = separator;
      offset += 1;
    }
  });
  return out;
}

/** Derive the secretbox key for a kit. Pure, and the only KDF entry point. */
export function deriveRecoveryKitKey(input: {
  code: string;
  version: number;
  profileId: string;
  pubkey: string;
  salt16: Uint8Array;
}): Uint8Array {
  const bare = normalizeRecoveryCode(input.code);
  const codeBytes = decodeBase32(bare, RECOVERY_CODE_ENTROPY_BYTES);
  if (bare.length !== RECOVERY_CODE_CHARS || codeBytes === null) {
    throw new Error('mynews recovery kit: recovery code is malformed');
  }
  const salt = sha256(recoveryKitSaltPreimage(input));
  return scrypt(codeBytes, salt, {
    N: RECOVERY_KIT_SCRYPT_N,
    r: RECOVERY_KIT_SCRYPT_R,
    p: RECOVERY_KIT_SCRYPT_P,
    dkLen: RECOVERY_KIT_KEY_BYTES,
  });
}

/**
 * Does a private key hex actually correspond to a claimed public key? Proved by
 * signing a domain-tagged probe and verifying it against the claim, which needs
 * only the exported sign/verify primitives and is exactly as strong as deriving
 * the public key directly.
 */
export function privateKeyMatchesPubkey(privateKeyHex: string, pubkey: string): boolean {
  if (!PRIVATE_KEY_RE.test(privateKeyHex) || !PUBKEY_RE.test(pubkey)) return false;
  try {
    const probe = encoder.encode(`${RECOVERY_KIT_KDF_DOMAIN}:pubkey-assertion:${pubkey}`);
    return verifySignature(pubkey, probe, signMessage(privateKeyHex, probe));
  } catch {
    return false;
  }
}

/**
 * Seal a signing key into a kit. `pubkey` is asserted against the private key
 * BEFORE encryption, so a caller cannot mint a kit that would fail its own
 * post-decrypt check and only reveal the problem during a real recovery.
 */
export function createRecoveryKit(input: {
  profileId: string;
  pubkey: string;
  privateKeyHex: string;
  code: string;
  createdAt: string;
  randomBytes?: RecoveryKitRandomBytes;
}): RecoveryKitEnvelope {
  if (!PUBKEY_RE.test(input.pubkey)) {
    throw new Error('mynews recovery kit: pubkey must be 64 lowercase hex chars');
  }
  if (!PRIVATE_KEY_RE.test(input.privateKeyHex)) {
    throw new Error('mynews recovery kit: private key must be 128 lowercase hex chars');
  }
  if (input.profileId.length === 0) {
    throw new Error('mynews recovery kit: profileId is required');
  }
  if (!privateKeyMatchesPubkey(input.privateKeyHex, input.pubkey)) {
    throw new Error('mynews recovery kit: private key does not derive the claimed pubkey');
  }

  const salt16 = randomOrThrow(input.randomBytes, RECOVERY_KIT_SALT_BYTES);
  const key = deriveRecoveryKitKey({
    code: input.code,
    version: RECOVERY_KIT_VERSION,
    profileId: input.profileId,
    pubkey: input.pubkey,
    salt16,
  });
  try {
    const sealed = encrypt(encoder.encode(input.privateKeyHex), key);
    return {
      v: RECOVERY_KIT_VERSION,
      profileId: input.profileId,
      pubkey: input.pubkey,
      salt16: toBase64(salt16),
      nonce: toBase64(sealed.nonce),
      ciphertext: toBase64(sealed.ciphertext),
      createdAt: input.createdAt,
    };
  } finally {
    key.fill(0);
  }
}

/** Structural validation of a parsed envelope. Shape only, no crypto. */
export function isRecoveryKitEnvelope(value: unknown): value is RecoveryKitEnvelope {
  if (typeof value !== 'object' || value === null) return false;
  const e = value as Record<string, unknown>;
  return (
    e.v === RECOVERY_KIT_VERSION &&
    typeof e.profileId === 'string' &&
    e.profileId.length > 0 &&
    typeof e.pubkey === 'string' &&
    PUBKEY_RE.test(e.pubkey) &&
    typeof e.salt16 === 'string' &&
    typeof e.nonce === 'string' &&
    typeof e.ciphertext === 'string' &&
    typeof e.createdAt === 'string'
  );
}

/**
 * Open a kit. Fail-closed at every step, with distinguishable reasons so the UI
 * can say something true:
 *
 *   bad-envelope    the file is not a v1 kit, or its base64 fields are corrupt
 *   bad-code        the typed code is not a well-formed recovery code
 *   wrong-code      secretbox authentication failed. Note this ALSO covers a
 *                   tampered ciphertext and tampered metadata: editing v,
 *                   profileId, or pubkey changes the derived key, so it presents
 *                   identically to a wrong code, which is the correct amount of
 *                   information to give an attacker
 *   pubkey-mismatch the code was right and the plaintext decrypted, but the key
 *                   inside does not correspond to the claimed pubkey
 */
export function openRecoveryKit(
  envelope: unknown,
  code: string,
): OpenRecoveryKitResult {
  if (!isRecoveryKitEnvelope(envelope)) return { ok: false, reason: 'bad-envelope' };
  if (!isRecoveryCodeWellFormed(code)) return { ok: false, reason: 'bad-code' };

  const salt16 = fromBase64(envelope.salt16);
  const nonce = fromBase64(envelope.nonce);
  const ciphertext = fromBase64(envelope.ciphertext);
  if (
    salt16 === null ||
    nonce === null ||
    ciphertext === null ||
    salt16.length !== RECOVERY_KIT_SALT_BYTES
  ) {
    return { ok: false, reason: 'bad-envelope' };
  }

  const key = deriveRecoveryKitKey({
    code,
    version: envelope.v,
    profileId: envelope.profileId,
    pubkey: envelope.pubkey,
    salt16,
  });
  let plaintext: Uint8Array | null;
  try {
    plaintext = decrypt(ciphertext, nonce, key);
  } finally {
    key.fill(0);
  }
  if (plaintext === null) return { ok: false, reason: 'wrong-code' };

  const privateKeyHex = decoder.decode(plaintext).trim();
  if (!privateKeyMatchesPubkey(privateKeyHex, envelope.pubkey)) {
    return { ok: false, reason: 'pubkey-mismatch' };
  }

  return {
    ok: true,
    privateKeyHex,
    pubkey: envelope.pubkey,
    profileId: envelope.profileId,
  };
}

/** Canonical serialization for file export and QR payloads. */
export function serializeRecoveryKit(envelope: RecoveryKitEnvelope): string {
  return JSON.stringify(envelope);
}

/** Parse an imported kit. Null on anything that is not a v1 envelope. */
export function parseRecoveryKit(text: string): RecoveryKitEnvelope | null {
  try {
    const parsed = JSON.parse(text) as unknown;
    return isRecoveryKitEnvelope(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * KDF cost self-test. Asserted in CI so a parameter bump that would make kit
 * creation unusable on a phone fails the build instead of shipping. Returns the
 * measured milliseconds for one derivation at the configured cost.
 */
export function measureRecoveryKitKdfMs(now: () => number = () => Date.now()): number {
  const started = now();
  const key = deriveRecoveryKitKey({
    code: encodeBase32(new Uint8Array(RECOVERY_CODE_ENTROPY_BYTES).fill(7)),
    version: RECOVERY_KIT_VERSION,
    profileId: 'kdf-budget-self-test',
    pubkey: 'a'.repeat(64),
    salt16: new Uint8Array(RECOVERY_KIT_SALT_BYTES).fill(3),
  });
  const elapsed = now() - started;
  key.fill(0);
  return elapsed;
}

/**
 * Hex helpers re-exported so callers building a kit from a stored identity do
 * not have to reach into @mylife/sync directly.
 */
export { bytesToHex, hexToBytes };
