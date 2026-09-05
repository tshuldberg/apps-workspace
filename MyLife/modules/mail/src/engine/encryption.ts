import type { EncryptionKey } from '../types';

/**
 * Compute a simple fingerprint from a public key string.
 * In production, use SHA-256. This is a deterministic hash for the module layer.
 */
export function computeFingerprint(publicKey: string): string {
  let hash = 0;
  for (let i = 0; i < publicKey.length; i++) {
    hash = ((hash << 5) - hash + publicKey.charCodeAt(i)) | 0;
  }
  const hex = Math.abs(hash).toString(16).padStart(8, '0');
  // Format as fingerprint-like string
  return `${hex.slice(0, 4)}:${hex.slice(4, 8)}:${publicKey.length.toString(16).padStart(4, '0')}`;
}

/**
 * Check if we have a valid (non-revoked, non-expired) public key for a contact email.
 */
export function findKeyForContact(
  email: string,
  keys: EncryptionKey[],
): EncryptionKey | null {
  const lower = email.toLowerCase();
  return keys.find(
    (k) =>
      k.contactEmail?.toLowerCase() === lower &&
      !k.isRevoked &&
      !k.isOwnKey &&
      (!k.expiresAt || k.expiresAt > new Date().toISOString()),
  ) ?? null;
}

/**
 * Check if we have our own key pair for an account.
 */
export function findOwnKey(
  accountId: string,
  keys: EncryptionKey[],
): EncryptionKey | null {
  return keys.find(
    (k) => k.accountId === accountId && k.isOwnKey && !k.isRevoked,
  ) ?? null;
}

/**
 * Determine the encryption status for composing a message.
 */
export function canEncrypt(
  recipientEmails: string[],
  keys: EncryptionKey[],
): { canEncrypt: boolean; missingKeys: string[] } {
  const missing: string[] = [];
  for (const email of recipientEmails) {
    if (!findKeyForContact(email, keys)) {
      missing.push(email);
    }
  }
  return {
    canEncrypt: missing.length === 0,
    missingKeys: missing,
  };
}

/**
 * Detect if a message body contains PGP encrypted content.
 */
export function isPgpEncrypted(body: string): boolean {
  return body.includes('-----BEGIN PGP MESSAGE-----');
}

/**
 * Detect if a message body contains a PGP signature.
 */
export function hasPgpSignature(body: string): boolean {
  return body.includes('-----BEGIN PGP SIGNATURE-----');
}

/**
 * Detect if a string is a PGP public key block.
 */
export function isPgpPublicKey(text: string): boolean {
  return text.includes('-----BEGIN PGP PUBLIC KEY BLOCK-----') &&
    text.includes('-----END PGP PUBLIC KEY BLOCK-----');
}
