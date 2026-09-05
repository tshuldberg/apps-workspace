/**
 * AES-GCM helpers for private Market conversations.
 *
 * This supports encrypted payload envelopes without exposing phone numbers or
 * moving buyer/seller coordination outside the app.
 */

import type { CreateMessageInput } from './types';

const PBKDF2_ITERATIONS = 100_000;
const KEY_LENGTH = 256;
const IV_LENGTH = 12;
const SALT_LENGTH = 16;

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let index = 0; index < bytes.byteLength; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }
  return btoa(binary);
}

function fromBase64(base64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes as Uint8Array<ArrayBuffer>;
}

function getWebCrypto(): Crypto {
  const cryptoApi = globalThis.crypto as Crypto | undefined;
  if (!cryptoApi?.subtle || !cryptoApi.getRandomValues) {
    throw new Error('Web Crypto is required for Market message encryption');
  }
  return cryptoApi;
}

async function deriveKey(passphrase: string, salt: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  const cryptoApi = getWebCrypto();
  const keyMaterial = await cryptoApi.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey'],
  );

  return cryptoApi.subtle.deriveKey(
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

export async function encryptMarketMessageBody(
  body: string,
  passphrase: string,
): Promise<Extract<CreateMessageInput, { contentType: 'application/e2ee+ciphertext' }>> {
  const cryptoApi = getWebCrypto();
  const salt = cryptoApi.getRandomValues(new Uint8Array(SALT_LENGTH));
  const iv = cryptoApi.getRandomValues(new Uint8Array(IV_LENGTH));
  const key = await deriveKey(passphrase, salt);
  const ciphertext = await cryptoApi.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(body),
  );

  return {
    contentType: 'application/e2ee+ciphertext',
    ciphertext: toBase64(ciphertext),
    encryptionAlgorithm: 'aes-256-gcm',
    encryptionSalt: toBase64(salt.buffer as ArrayBuffer),
    encryptionIv: toBase64(iv.buffer as ArrayBuffer),
  };
}

export async function decryptMarketMessageBody(
  message: {
    contentType: 'text/plain' | 'application/e2ee+ciphertext';
    ciphertext?: string;
    encryptionSalt?: string;
    encryptionIv?: string;
  },
  passphrase: string,
): Promise<string> {
  if (message.contentType !== 'application/e2ee+ciphertext') {
    throw new Error('Only encrypted Market messages can be decrypted');
  }

  if (!message.ciphertext || !message.encryptionSalt || !message.encryptionIv) {
    throw new Error('Encrypted Market message envelope is incomplete');
  }

  const cryptoApi = getWebCrypto();
  const key = await deriveKey(passphrase, fromBase64(message.encryptionSalt));
  const plaintext = await cryptoApi.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64(message.encryptionIv) },
    key,
    fromBase64(message.ciphertext),
  );

  return new TextDecoder().decode(plaintext);
}
