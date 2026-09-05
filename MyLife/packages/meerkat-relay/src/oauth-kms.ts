import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { promises as fs } from 'node:fs';

const KEY_BYTES = 32;
const NONCE_BYTES = 12;
const TAG_BYTES = 16;

export interface KmsContext {
  purpose: 'oauth_refresh_token' | 'storage_credential';
  vaultId: string;
  provider: string;
  subjectId: string;
}

export interface KmsDataKey {
  plaintextKey: Uint8Array;
  wrappedKey: Uint8Array;
}

export interface Kms {
  generateDataKey(context: KmsContext): Promise<KmsDataKey>;
  decryptDataKey(wrappedKey: Uint8Array, context: KmsContext): Promise<Uint8Array>;
}

export class OAuthKmsError extends Error {
  readonly code = 'oauth_kms_error';

  constructor(message: string) {
    super(message);
    this.name = 'OAuthKmsError';
  }
}

function contextBytes(context: KmsContext): Buffer {
  return Buffer.from(
    JSON.stringify([
      context.purpose,
      context.vaultId,
      context.provider,
      context.subjectId,
    ]),
    'utf8',
  );
}

/**
 * Self-host KMS seam backed by one mounted key-encryption-key file. First-party
 * deployments can replace it with managed KMS without changing broker storage.
 */
export class MountedSecretKms implements Kms {
  private readonly keyEncryptionKey: Buffer;
  private readonly random: (size: number) => Buffer;

  constructor(keyEncryptionKey: Uint8Array, random: (size: number) => Buffer = randomBytes) {
    if (keyEncryptionKey.byteLength !== KEY_BYTES) {
      throw new OAuthKmsError('OAuth KMS key must be exactly 32 bytes');
    }
    this.keyEncryptionKey = Buffer.from(keyEncryptionKey);
    this.random = random;
  }

  async generateDataKey(context: KmsContext): Promise<KmsDataKey> {
    const plaintextKey = this.random(KEY_BYTES);
    const nonce = this.random(NONCE_BYTES);
    if (plaintextKey.byteLength !== KEY_BYTES || nonce.byteLength !== NONCE_BYTES) {
      plaintextKey.fill(0);
      nonce.fill(0);
      throw new OAuthKmsError('OAuth KMS random source returned an invalid length');
    }
    try {
      const cipher = createCipheriv('aes-256-gcm', this.keyEncryptionKey, nonce);
      cipher.setAAD(contextBytes(context));
      const encrypted = Buffer.concat([cipher.update(plaintextKey), cipher.final()]);
      const wrappedKey = Buffer.concat([nonce, cipher.getAuthTag(), encrypted]);
      return { plaintextKey, wrappedKey };
    } catch {
      plaintextKey.fill(0);
      throw new OAuthKmsError('OAuth KMS data-key generation failed');
    } finally {
      nonce.fill(0);
    }
  }

  async decryptDataKey(wrappedKey: Uint8Array, context: KmsContext): Promise<Uint8Array> {
    if (wrappedKey.byteLength !== NONCE_BYTES + TAG_BYTES + KEY_BYTES) {
      throw new OAuthKmsError('OAuth KMS wrapped key has an invalid length');
    }
    const envelope = Buffer.from(wrappedKey);
    const nonce = envelope.subarray(0, NONCE_BYTES);
    const tag = envelope.subarray(NONCE_BYTES, NONCE_BYTES + TAG_BYTES);
    const ciphertext = envelope.subarray(NONCE_BYTES + TAG_BYTES);
    try {
      const decipher = createDecipheriv('aes-256-gcm', this.keyEncryptionKey, nonce);
      decipher.setAAD(contextBytes(context));
      decipher.setAuthTag(tag);
      const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
      if (plaintext.byteLength !== KEY_BYTES) {
        plaintext.fill(0);
        throw new OAuthKmsError('OAuth KMS decrypted key has an invalid length');
      }
      return plaintext;
    } catch (error) {
      if (error instanceof OAuthKmsError) throw error;
      throw new OAuthKmsError('OAuth KMS wrapped key authentication failed');
    } finally {
      envelope.fill(0);
    }
  }
}

function parseKeyFile(raw: Buffer): Buffer {
  const withoutLf = raw.length > 0 && raw[raw.length - 1] === 0x0a
    ? raw.subarray(0, raw.length - 1)
    : raw;
  if (withoutLf.byteLength === KEY_BYTES) return Buffer.from(withoutLf);
  const text = withoutLf.toString('utf8').trim();
  if (/^[a-fA-F0-9]{64}$/u.test(text)) return Buffer.from(text, 'hex');
  throw new OAuthKmsError('OAuth KMS key file must contain 32 raw bytes or 64 hex characters');
}

export async function loadMountedSecretKmsFromFile(
  filePath: string,
  readFile: (path: string) => Promise<Buffer> = (path) => fs.readFile(path),
): Promise<MountedSecretKms> {
  let raw: Buffer;
  try {
    raw = await readFile(filePath);
  } catch {
    throw new OAuthKmsError('OAuth KMS key file is unreadable');
  }
  let key: Buffer | null = null;
  try {
    key = parseKeyFile(raw);
    return new MountedSecretKms(key);
  } finally {
    raw.fill(0);
    key?.fill(0);
  }
}
