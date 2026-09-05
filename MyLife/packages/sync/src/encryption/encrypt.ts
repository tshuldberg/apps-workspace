/**
 * Symmetric encryption/decryption using XSalsa20-Poly1305 (nacl.secretbox).
 *
 * Provides both raw Uint8Array and string convenience wrappers.
 * All ciphertext is authenticated -- tampered data returns null on decrypt.
 */

import nacl from 'tweetnacl';
import naclUtil from 'tweetnacl-util';
import { generateNonce } from './keys';

const { encodeBase64, decodeBase64, decodeUTF8, encodeUTF8 } = naclUtil;

/**
 * Encrypt plaintext bytes with a 32-byte symmetric key.
 * Returns the ciphertext and the random nonce used (both needed for decryption).
 */
export function encrypt(
  plaintext: Uint8Array,
  key: Uint8Array,
): { ciphertext: Uint8Array; nonce: Uint8Array } {
  const nonce = generateNonce();
  const ciphertext = nacl.secretbox(plaintext, nonce, key);
  return { ciphertext, nonce };
}

/**
 * Decrypt ciphertext bytes produced by `encrypt()`.
 * Returns null if authentication fails (wrong key, tampered data, or wrong nonce).
 */
export function decrypt(
  ciphertext: Uint8Array,
  nonce: Uint8Array,
  key: Uint8Array,
): Uint8Array | null {
  return nacl.secretbox.open(ciphertext, nonce, key) ?? null;
}

/**
 * Encrypt a UTF-8 string and return a base64-encoded payload.
 *
 * The output format is: base64(nonce) + "." + base64(ciphertext)
 * This makes it safe to store in SQLite TEXT columns or JSON.
 */
export function encryptString(text: string, key: Uint8Array): string {
  const plaintext = decodeUTF8(text);
  const { ciphertext, nonce } = encrypt(plaintext, key);
  return encodeBase64(nonce) + '.' + encodeBase64(ciphertext);
}

/**
 * Decrypt a base64-encoded payload produced by `encryptString()`.
 * Returns null if authentication fails or the format is invalid.
 */
export function decryptString(encrypted: string, key: Uint8Array): string | null {
  const dotIndex = encrypted.indexOf('.');
  if (dotIndex === -1) return null;

  try {
    const nonce = decodeBase64(encrypted.substring(0, dotIndex));
    const ciphertext = decodeBase64(encrypted.substring(dotIndex + 1));
    const plaintext = decrypt(ciphertext, nonce, key);
    if (!plaintext) return null;
    return encodeUTF8(plaintext);
  } catch {
    return null;
  }
}
