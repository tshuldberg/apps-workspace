/**
 * Standards-compliant HKDF and HMAC over SHA-512 (RFC 5869, RFC 2104).
 *
 * The legacy `deriveKey` in ../encryption/keys.ts is a SHA-512(secret || info)
 * truncation, explicitly documented there as NOT standards-compliant. The
 * Meerkat node layer derives real per-purpose keys, so it uses this proper
 * HKDF instead. Built only on tweetnacl's SHA-512 (`nacl.hash`), so it adds
 * no dependency and runs unchanged on Hermes/React Native.
 */

import nacl from 'tweetnacl';

const HASH_LEN = 64; // SHA-512 output length in bytes
const BLOCK_LEN = 128; // SHA-512 block size in bytes

function concat(...parts: Uint8Array[]): Uint8Array {
  let total = 0;
  for (const p of parts) total += p.length;
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

/**
 * HMAC-SHA512 (RFC 2104).
 */
export function hmacSha512(key: Uint8Array, message: Uint8Array): Uint8Array {
  let k = key;
  if (k.length > BLOCK_LEN) {
    k = nacl.hash(k); // 64 bytes, still <= BLOCK_LEN
  }
  const keyBlock = new Uint8Array(BLOCK_LEN);
  keyBlock.set(k, 0);

  const ipad = new Uint8Array(BLOCK_LEN);
  const opad = new Uint8Array(BLOCK_LEN);
  for (let i = 0; i < BLOCK_LEN; i++) {
    ipad[i] = keyBlock[i]! ^ 0x36;
    opad[i] = keyBlock[i]! ^ 0x5c;
  }

  const inner = nacl.hash(concat(ipad, message));
  return nacl.hash(concat(opad, inner));
}

/**
 * HKDF-Extract (RFC 5869 section 2.2).
 * Returns a pseudorandom key (PRK) of HASH_LEN bytes.
 */
export function hkdfExtract(salt: Uint8Array | null, ikm: Uint8Array): Uint8Array {
  const actualSalt = salt && salt.length > 0 ? salt : new Uint8Array(HASH_LEN);
  return hmacSha512(actualSalt, ikm);
}

/**
 * HKDF-Expand (RFC 5869 section 2.3).
 */
export function hkdfExpand(prk: Uint8Array, info: Uint8Array, length: number): Uint8Array {
  const n = Math.ceil(length / HASH_LEN);
  if (n > 255) {
    throw new Error('HKDF-Expand: requested length too large');
  }
  const okm = new Uint8Array(n * HASH_LEN);
  let previous: Uint8Array = new Uint8Array(0);
  for (let i = 0; i < n; i++) {
    const t = hmacSha512(prk, concat(previous, info, new Uint8Array([i + 1])));
    okm.set(t, i * HASH_LEN);
    previous = t;
  }
  return okm.slice(0, length);
}

/**
 * Full HKDF (extract then expand). Default output is a 32-byte key suitable
 * for nacl.secretbox.
 */
export function hkdf(
  ikm: Uint8Array,
  info: string,
  salt: Uint8Array | null = null,
  length = 32,
): Uint8Array {
  const infoBytes = new TextEncoder().encode(info);
  const prk = hkdfExtract(salt, ikm);
  return hkdfExpand(prk, infoBytes, length);
}

/**
 * SHA-512 of a byte array, as a lowercase hex string. Used for content
 * addressing in the node layer (chunk ids, manifest content id). BLAKE3/CID
 * is the planned upgrade (MK-027); SHA-512 via the vendored audited primitive
 * is a real, collision-resistant interim.
 */
export function sha512Hex(bytes: Uint8Array): string {
  const digest = nacl.hash(bytes);
  let hex = '';
  for (let i = 0; i < digest.length; i++) {
    hex += digest[i]!.toString(16).padStart(2, '0');
  }
  return hex;
}
