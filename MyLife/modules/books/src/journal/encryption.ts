/**
 * AES-256-GCM encryption for journal entries using Web Crypto API.
 * Works in both Node.js 20+ and React Native (via expo-crypto polyfill).
 */

const PBKDF2_ITERATIONS = 100_000;
const KEY_LENGTH = 256;
const IV_LENGTH = 12;
const SALT_LENGTH = 16;

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function fromBase64(base64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes as Uint8Array<ArrayBuffer>;
}

export async function deriveKey(
  passphrase: string,
  salt: BufferSource,
): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey'],
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function encryptContent(
  content: string,
  passphrase: string,
): Promise<{ encrypted: string; salt: string; iv: string }> {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

  const key = await deriveKey(passphrase, salt);
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(content),
  );

  return {
    encrypted: toBase64(ciphertext),
    salt: toBase64(salt.buffer as ArrayBuffer),
    iv: toBase64(iv.buffer as ArrayBuffer),
  };
}

export async function decryptContent(
  encrypted: string,
  passphrase: string,
  salt: string,
  iv: string,
): Promise<string> {
  const decoder = new TextDecoder();
  const saltBytes = fromBase64(salt);
  const ivBytes = fromBase64(iv);
  const ciphertextBytes = fromBase64(encrypted);

  const key = await deriveKey(passphrase, saltBytes);
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: ivBytes },
    key,
    ciphertextBytes,
  );

  return decoder.decode(plaintext);
}
