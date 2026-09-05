/**
 * High-level secure messaging API.
 *
 * Wraps Web Crypto operations for the Signal-style protocol:
 *   - ECDH key generation (P-256)
 *   - HKDF key derivation
 *   - AES-256-GCM message encryption / decryption
 *   - Safety number computation
 *
 * This module provides the cryptographic primitives. The full
 * X3DH and Double Ratchet protocols are composed from these.
 */

const HKDF_HASH = 'SHA-256';
const AES_KEY_LENGTH = 256;
const IV_LENGTH = 12;
const INFO_PREFIX = 'MyMarket_Signal_v1';

function getSubtle(): SubtleCrypto {
  const crypto = globalThis.crypto;
  if (!crypto?.subtle) {
    throw new Error('Web Crypto API required for encrypted messaging');
  }
  return crypto.subtle;
}

function getRandomBytes(length: number): Uint8Array<ArrayBuffer> {
  return globalThis.crypto.getRandomValues(
    new Uint8Array(length) as Uint8Array<ArrayBuffer>,
  );
}

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function fromBase64(b64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length) as Uint8Array<ArrayBuffer>;
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/** Generate an ECDH key pair for identity or prekeys. */
export async function generateKeyPair(): Promise<{
  publicKey: string;
  privateKey: string;
}> {
  const subtle = getSubtle();
  const keyPair = await subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveKey', 'deriveBits'],
  );

  const publicKeyRaw = await subtle.exportKey('raw', keyPair.publicKey);
  const privateKeyJwk = await subtle.exportKey('jwk', keyPair.privateKey);

  return {
    publicKey: toBase64(publicKeyRaw),
    privateKey: JSON.stringify(privateKeyJwk),
  };
}

/** Import a public key from base64 for ECDH. */
async function importPublicKey(b64: string): Promise<CryptoKey> {
  const subtle = getSubtle();
  const keyData = fromBase64(b64);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (subtle as any).importKey(
    'raw',
    keyData,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    [],
  ) as Promise<CryptoKey>;
}

/** Import a private key from JWK string for ECDH. */
async function importPrivateKey(jwkString: string): Promise<CryptoKey> {
  const subtle = getSubtle();
  const jwk = JSON.parse(jwkString) as Record<string, unknown>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (subtle as any).importKey(
    'jwk',
    jwk,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    ['deriveKey', 'deriveBits'],
  ) as Promise<CryptoKey>;
}

/** Perform ECDH to derive shared bits. */
export async function performDH(
  privateKeyJwk: string,
  publicKeyB64: string,
): Promise<ArrayBuffer> {
  const subtle = getSubtle();
  const privateKey = await importPrivateKey(privateKeyJwk);
  const publicKey = await importPublicKey(publicKeyB64);
  return subtle.deriveBits(
    { name: 'ECDH', public: publicKey },
    privateKey,
    256,
  );
}

/** Derive an AES-GCM key from input keying material via HKDF. */
export async function hkdfDeriveKey(
  ikm: ArrayBuffer,
  salt: Uint8Array<ArrayBuffer>,
  info: string,
): Promise<CryptoKey> {
  const subtle = getSubtle();
  const baseKey = await subtle.importKey('raw', ikm, 'HKDF', false, [
    'deriveKey',
  ]);
  return subtle.deriveKey(
    {
      name: 'HKDF',
      hash: HKDF_HASH,
      salt,
      info: new TextEncoder().encode(`${INFO_PREFIX}_${info}`),
    },
    baseKey,
    { name: 'AES-GCM', length: AES_KEY_LENGTH },
    false,
    ['encrypt', 'decrypt'],
  );
}

/** Encrypt a plaintext message with AES-256-GCM. */
export async function encryptMessage(
  key: CryptoKey,
  plaintext: string,
): Promise<{ ciphertext: string; iv: string }> {
  const subtle = getSubtle();
  const iv = getRandomBytes(IV_LENGTH);
  const encoded = new TextEncoder().encode(plaintext);
  const encrypted = await subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoded,
  );

  return {
    ciphertext: toBase64(encrypted),
    iv: toBase64(iv.buffer),
  };
}

/** Decrypt a ciphertext message with AES-256-GCM. */
export async function decryptMessage(
  key: CryptoKey,
  ciphertext: string,
  iv: string,
): Promise<string> {
  const subtle = getSubtle();
  const decrypted = await subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64(iv) },
    key,
    fromBase64(ciphertext),
  );

  return new TextDecoder().decode(decrypted);
}

/**
 * Compute a safety number from two identity keys.
 * Produces a 60-digit numeric string (deterministic).
 */
export async function computeSafetyNumber(
  localIdentityKey: string,
  remoteIdentityKey: string,
): Promise<string> {
  const subtle = getSubtle();
  // Sort keys lexicographically so both participants produce the same hash
  const [first, second] = [localIdentityKey, remoteIdentityKey].sort();
  const combined = new Uint8Array([
    ...fromBase64(first),
    ...fromBase64(second),
  ]) as Uint8Array<ArrayBuffer>;

  const hash = await subtle.digest('SHA-256', combined);
  const hashHex = Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  // Convert hex chars to decimal digits, take first 60
  const digits = hashHex
    .split('')
    .map((c) => parseInt(c, 16).toString())
    .join('');
  return digits.slice(0, 60);
}

/** Generate a random registration ID (1 to 16383). */
export function generateRegistrationId(): number {
  const bytes = getRandomBytes(2);
  return ((bytes[0] << 8) | bytes[1]) & 0x3fff;
}

/** Utility: encode bytes to base64 */
export { toBase64, fromBase64 };
