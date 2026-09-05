/**
 * Envelope cipher for push provider tokens (Plan 42 P4).
 *
 * Implements the PushTokenCipher KMS seam with dependency-free AES-256-GCM
 * authenticated encryption keyed from MOUNTED SECRET FILES, following the same
 * mounted-secret convention as postgres-ca.pem and the object-store credentials. A
 * managed-KMS implementation (AWS KMS, GCP KMS) can replace this class behind the
 * exact same PushTokenCipher interface as founder-ops hardening; nothing else in the
 * gateway changes because the interface is the only contract the gateway depends on.
 *
 * KEYRING + ROTATION. The cipher loads a keyring of numbered 32-byte keys. Encryption
 * always uses the ACTIVE version. Decryption looks the key up by the envelope's
 * embedded keyVersion, so tokens sealed under a previous version keep decrypting after
 * a rotation; an unknown version is a TYPED failure, never a silent null. Rotate by
 * adding a higher-numbered key file and pointing the active version at it.
 *
 * FAIL-CLOSED VALIDATION. Wrong key length, an unreadable file, a duplicate version,
 * or a missing active version is a construction-time throw (the bin turns it into a
 * fatal boot before any listener opens). No error message ever echoes a key byte or a
 * path that could carry secret material.
 *
 * Envelope layout (all binary, versioned): [version:u32be][iv:12][authTag:16][ciphertext].
 */

import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import type {
  EncryptedPushProviderToken,
  PushTokenCipher,
  PushTokenCipherContext,
} from './push-store';

const KEY_BYTES = 32; // AES-256
const IV_BYTES = 12; // GCM nonce
const TAG_BYTES = 16;
const MAX_TOKEN_PLAINTEXT_BYTES = 8 * 1024;
const KEY_FILE_NAME = /^(\d{1,9})\.key$/u;

/** A single validated keyring entry: a version number and its 32-byte key material. */
interface KeyringEntry {
  version: number;
  key: Buffer;
}

/**
 * The context is bound into the GCM additional authenticated data so a ciphertext
 * sealed for one registration/provider/generation cannot be replayed under another.
 */
function additionalData(context: PushTokenCipherContext): Buffer {
  if (!/^[a-f0-9]{64}$/u.test(context.registrationIdHash)) {
    throw new PushTokenCipherError('cipher context registrationIdHash is invalid');
  }
  if (context.provider !== 'apns' && context.provider !== 'fcm' && context.provider !== 'webpush') {
    throw new PushTokenCipherError('cipher context provider is invalid');
  }
  if (!Number.isSafeInteger(context.tokenGeneration) || context.tokenGeneration <= 0) {
    throw new PushTokenCipherError('cipher context tokenGeneration is invalid');
  }
  return Buffer.from(
    `${context.registrationIdHash}:${context.provider}:${context.tokenGeneration}`,
    'utf8',
  );
}

/** A typed error so the gateway/bin never confuse a cipher fault with a missing token. */
export class PushTokenCipherError extends Error {
  readonly code = 'push_token_cipher_error';
}

export interface AesGcmPushTokenCipherOptions {
  keyring: KeyringEntry[];
  activeVersion: number;
  random?: (size: number) => Buffer;
}

/**
 * AES-256-GCM envelope cipher over a version keyring. Construct via the async loaders
 * below (they validate and read key files); the direct constructor is for tests that
 * supply in-memory key material.
 */
export class AesGcmPushTokenCipher implements PushTokenCipher {
  private readonly keys = new Map<number, Buffer>();
  private readonly activeVersion: number;
  private readonly random: (size: number) => Buffer;

  constructor(options: AesGcmPushTokenCipherOptions) {
    if (options.keyring.length === 0) {
      throw new PushTokenCipherError('push token cipher requires at least one key');
    }
    for (const entry of options.keyring) {
      if (!Number.isSafeInteger(entry.version) || entry.version <= 0) {
        throw new PushTokenCipherError('push token key version must be a positive integer');
      }
      if (!(entry.key instanceof Buffer) || entry.key.length !== KEY_BYTES) {
        throw new PushTokenCipherError('push token key must be exactly 32 bytes');
      }
      if (this.keys.has(entry.version)) {
        throw new PushTokenCipherError('push token key version is duplicated');
      }
      this.keys.set(entry.version, entry.key);
    }
    if (!this.keys.has(options.activeVersion)) {
      throw new PushTokenCipherError('push token active key version is not in the keyring');
    }
    this.activeVersion = options.activeVersion;
    this.random = options.random ?? ((size: number) => randomBytes(size));
  }

  async encryptProviderToken(
    plaintextToken: string,
    context: PushTokenCipherContext,
  ): Promise<EncryptedPushProviderToken> {
    if (typeof plaintextToken !== 'string' || plaintextToken.length === 0) {
      throw new PushTokenCipherError('push provider token plaintext is empty');
    }
    const plaintext = Buffer.from(plaintextToken, 'utf8');
    if (plaintext.byteLength > MAX_TOKEN_PLAINTEXT_BYTES) {
      throw new PushTokenCipherError('push provider token plaintext is too large');
    }
    const key = this.keys.get(this.activeVersion);
    if (!key) throw new PushTokenCipherError('push token active key vanished');
    const iv = this.random(IV_BYTES);
    if (iv.length !== IV_BYTES) throw new PushTokenCipherError('push token iv length is invalid');
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    cipher.setAAD(additionalData(context));
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const authTag = cipher.getAuthTag();
    const header = Buffer.alloc(4);
    header.writeUInt32BE(this.activeVersion, 0);
    const envelope = Buffer.concat([header, iv, authTag, ciphertext]);
    return { ciphertext: new Uint8Array(envelope), keyVersion: this.activeVersion };
  }

  async decryptProviderToken(
    encryptedToken: EncryptedPushProviderToken,
    context: PushTokenCipherContext,
  ): Promise<string> {
    const envelope = Buffer.from(encryptedToken.ciphertext);
    if (envelope.byteLength < 4 + IV_BYTES + TAG_BYTES) {
      throw new PushTokenCipherError('push token envelope is truncated');
    }
    const version = envelope.readUInt32BE(0);
    if (version !== encryptedToken.keyVersion) {
      throw new PushTokenCipherError('push token envelope version does not match key version');
    }
    const key = this.keys.get(version);
    if (!key) {
      // Unknown version is a TYPED failure so a rotation that dropped an old key is
      // loud, never a silent decryption miss that the gateway would read as "no token".
      throw new PushTokenCipherError('push token key version is not in the keyring');
    }
    const iv = envelope.subarray(4, 4 + IV_BYTES);
    const authTag = envelope.subarray(4 + IV_BYTES, 4 + IV_BYTES + TAG_BYTES);
    const ciphertext = envelope.subarray(4 + IV_BYTES + TAG_BYTES);
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAAD(additionalData(context));
    decipher.setAuthTag(authTag);
    try {
      const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
      return plaintext.toString('utf8');
    } catch {
      // A tampered or context-mismatched envelope fails the GCM tag. Surface a typed
      // fault with no plaintext or key material in the message.
      throw new PushTokenCipherError('push token authentication failed');
    }
  }

  async readiness(): Promise<{ ready: true; keyVersion: number } | { ready: false; reason: string }> {
    return this.keys.has(this.activeVersion)
      ? { ready: true, keyVersion: this.activeVersion }
      : { ready: false, reason: 'active_key_missing' };
  }

  /** The count of loaded key versions, surfaced by the bin's ready log (not a secret). */
  loadedVersionCount(): number {
    return this.keys.size;
  }
}

function parseHexOrRaw(name: string, raw: Buffer): Buffer {
  // Accept either 32 raw bytes or 64 hex characters (with optional trailing newline).
  const trimmed = raw.length > 0 && raw[raw.length - 1] === 0x0a ? raw.subarray(0, raw.length - 1) : raw;
  if (trimmed.length === KEY_BYTES) return Buffer.from(trimmed);
  const text = trimmed.toString('utf8').trim();
  if (/^[a-fA-F0-9]{64}$/u.test(text)) return Buffer.from(text, 'hex');
  throw new PushTokenCipherError(`push token key ${name} must be 32 raw bytes or 64 hex chars`);
}

/**
 * Load the keyring from a directory of <version>.key files, choosing the active version
 * explicitly. Fails closed (typed throw, no path/byte echo) on an unreadable file, a
 * wrong-length key, a duplicate version, or an active version with no file.
 */
export async function loadAesGcmPushTokenCipherFromDir(options: {
  directory: string;
  activeVersion: number;
  random?: (size: number) => Buffer;
}): Promise<AesGcmPushTokenCipher> {
  if (!Number.isSafeInteger(options.activeVersion) || options.activeVersion <= 0) {
    throw new PushTokenCipherError('push token active key version must be a positive integer');
  }
  let entries: string[];
  try {
    entries = await fs.readdir(options.directory);
  } catch {
    throw new PushTokenCipherError('push token key directory is unreadable');
  }
  const keyring: KeyringEntry[] = [];
  const seen = new Set<number>();
  for (const entry of entries.sort()) {
    const match = KEY_FILE_NAME.exec(entry);
    if (!match) continue;
    const version = Number(match[1]);
    if (!Number.isSafeInteger(version) || version <= 0) continue;
    if (seen.has(version)) throw new PushTokenCipherError('push token key version is duplicated');
    seen.add(version);
    let raw: Buffer;
    try {
      raw = await fs.readFile(path.join(options.directory, entry));
    } catch {
      throw new PushTokenCipherError('push token key file is unreadable');
    }
    keyring.push({ version, key: parseHexOrRaw(`v${version}`, raw) });
  }
  if (keyring.length === 0) throw new PushTokenCipherError('push token key directory has no key files');
  if (!seen.has(options.activeVersion)) {
    throw new PushTokenCipherError('push token active key version has no key file');
  }
  return new AesGcmPushTokenCipher({
    keyring,
    activeVersion: options.activeVersion,
    ...(options.random ? { random: options.random } : {}),
  });
}

/**
 * Confirm two keyrings share an identical key for a version (used by tests to prove
 * rotation continuity). Constant-time on the key bytes.
 */
export function pushKeyBytesEqual(left: Buffer, right: Buffer): boolean {
  return left.length === right.length && timingSafeEqual(left, right);
}
