/**
 * Key derivation, encoding utilities, and random generation for the sync encryption layer.
 *
 * Uses tweetnacl primitives (SHA-512 hash, randomBytes) to provide
 * HKDF-like derivation, hex encoding/decoding, and nonce/key generation.
 */

import nacl from 'tweetnacl';
import { hkdf } from '../node/hkdf';

// ---------------------------------------------------------------------------
// Hex encoding utilities
// ---------------------------------------------------------------------------

/**
 * Convert a hex-encoded string to a Uint8Array.
 * Throws if the input contains non-hex characters or has odd length.
 */
export function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) {
    throw new Error('Hex string must have even length');
  }
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    const byte = parseInt(hex.substring(i, i + 2), 16);
    if (Number.isNaN(byte)) {
      throw new Error(`Invalid hex character at position ${i}`);
    }
    bytes[i / 2] = byte;
  }
  return bytes;
}

/**
 * Convert a Uint8Array to a lowercase hex-encoded string.
 */
export function bytesToHex(bytes: Uint8Array): string {
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i]!.toString(16).padStart(2, '0');
  }
  return hex;
}

// ---------------------------------------------------------------------------
// Key derivation
// ---------------------------------------------------------------------------

/**
 * HKDF-like key derivation using SHA-512 HMAC (via nacl.hash).
 *
 * Concatenates the shared secret with the UTF-8 encoded info string,
 * hashes with SHA-512, and truncates to the requested length (default 32 bytes).
 *
 * This is NOT a standards-compliant HKDF implementation but provides
 * adequate key separation for our use case with tweetnacl's available primitives.
 */
export function deriveKey(
  sharedSecret: Uint8Array,
  info: string,
  length: number = 32,
): Uint8Array {
  const encoder = new TextEncoder();
  const infoBytes = encoder.encode(info);

  // Concatenate secret + info
  const input = new Uint8Array(sharedSecret.length + infoBytes.length);
  input.set(sharedSecret, 0);
  input.set(infoBytes, sharedSecret.length);

  // SHA-512 hash (64 bytes output)
  const hash = nacl.hash(input);

  // Truncate to requested length
  return hash.slice(0, length);
}

const KDF_V2_SALT = new TextEncoder().encode('mylife-sync-kdf:v2');

/**
 * KDF v2 (MK-010): standards-compliant RFC 5869 HKDF (extract-then-expand over
 * HMAC-SHA-512, the node layer's cross-checked implementation) replacing the
 * concat-and-hash construction above. Sessions negotiate the version; v1 stays
 * available as the fallback window for older peers.
 */
export function deriveKeyV2(
  sharedSecret: Uint8Array,
  info: string,
  length: number = 32,
): Uint8Array {
  return hkdf(sharedSecret, info, KDF_V2_SALT, length);
}

// ---------------------------------------------------------------------------
// Random generation
// ---------------------------------------------------------------------------

/**
 * Generate a random 24-byte nonce suitable for XSalsa20-Poly1305 (nacl.secretbox).
 */
export function generateNonce(): Uint8Array {
  return nacl.randomBytes(nacl.secretbox.nonceLength);
}

/**
 * Generate a random 32-byte symmetric key suitable for nacl.secretbox.
 */
export function generateSessionKey(): Uint8Array {
  return nacl.randomBytes(nacl.secretbox.keyLength);
}
