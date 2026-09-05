/**
 * Plan 51 P2: issuer-side RSABSSA operations for the account service.
 *
 * The pure protocol (blind/unblind/verify/epoch math) lives in @mylife/sync
 * (protocol/blind-credential.ts). This module owns the two operations that need
 * node:crypto: per-epoch RSA-2048 keypair generation and the raw RSA private-key
 * operation over an already-blinded message. The issuer NEVER sees a token
 * message, nonce, serial, or finished signature -- only the blinded bytes.
 *
 * Epoch private keys at rest are AES-256-GCM sealed under an env-held secret
 * (MEERKAT_ACCOUNT_EPOCH_KEY_SECRET). Compromise of a sealed key enables
 * credential FORGERY for that epoch (an integrity failure, rotated away at the
 * next epoch), never deanonymization: no key material links accounts to tokens.
 */

import {
  constants,
  createCipheriv,
  createDecipheriv,
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  hkdfSync,
  privateDecrypt,
  randomBytes,
} from 'node:crypto';
import { CREDENTIAL_MODULUS_BYTES } from '@mylife/sync';

export interface EpochKeyPair {
  epoch: number;
  publicKeySpkiDerBase64: string;
  privateKeyPkcs8DerBase64: string;
}

/** Generate the RSA-2048 keypair for one epoch. */
export function generateEpochKeyPair(epoch: number): EpochKeyPair {
  if (!Number.isInteger(epoch) || epoch < 0 || epoch > 100000) {
    throw new Error('Epoch out of range');
  }
  const { publicKey, privateKey } = generateKeyPairSync('rsa', {
    modulusLength: CREDENTIAL_MODULUS_BYTES * 8,
    publicExponent: 0x10001,
  });
  return {
    epoch,
    publicKeySpkiDerBase64: publicKey.export({ type: 'spki', format: 'der' }).toString('base64'),
    privateKeyPkcs8DerBase64: privateKey.export({ type: 'pkcs8', format: 'der' }).toString('base64'),
  };
}

/** Recover the public half of a supported persisted issuer key; malformed keys fail closed. */
export function deriveEpochPublicKey(privateKeyPkcs8DerBase64: string): string | null {
  try {
    const privateKey = createPrivateKey({
      key: Buffer.from(privateKeyPkcs8DerBase64, 'base64'), format: 'der', type: 'pkcs8',
    });
    if (privateKey.asymmetricKeyType !== 'rsa'
      || privateKey.asymmetricKeyDetails?.modulusLength !== CREDENTIAL_MODULUS_BYTES * 8
      || privateKey.asymmetricKeyDetails.publicExponent !== 65537n) return null;
    return createPublicKey(privateKey).export({ type: 'spki', format: 'der' }).toString('base64');
  } catch { return null; }
}

/**
 * The raw RSA private-key operation over a blinded message (RSA_NO_PADDING).
 * Input and output are exactly modulus-length. Throws on malformed input so a
 * caller can map the failure to a uniform refusal (quota side-channel hygiene).
 */
export function blindSignCredential(
  privateKeyPkcs8DerBase64: string,
  blindedMessageBase64: string,
): string {
  const blinded = Buffer.from(blindedMessageBase64, 'base64');
  if (blinded.length !== CREDENTIAL_MODULUS_BYTES) {
    throw new Error('Blinded message must be exactly modulus length');
  }
  const key = createPrivateKey({
    key: Buffer.from(privateKeyPkcs8DerBase64, 'base64'),
    format: 'der',
    type: 'pkcs8',
  });
  const signed = privateDecrypt({ key, padding: constants.RSA_NO_PADDING }, blinded);
  const padded = Buffer.alloc(CREDENTIAL_MODULUS_BYTES);
  signed.copy(padded, CREDENTIAL_MODULUS_BYTES - signed.length);
  return padded.toString('base64');
}

// ---------------------------------------------------------------------------
// Sealed key storage (AES-256-GCM under an env secret)
// ---------------------------------------------------------------------------

const SEAL_VERSION = 'v1';
const SEAL_SALT = 'meerkat-account-epoch-key';
const SEAL_INFO = 'seal';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

function deriveSealKey(secret: string): Buffer {
  if (typeof secret !== 'string' || secret.length < 16) {
    throw new Error('Epoch key seal secret must be at least 16 characters');
  }
  return Buffer.from(hkdfSync('sha256', Buffer.from(secret, 'utf8'), Buffer.from(SEAL_SALT), Buffer.from(SEAL_INFO), 32));
}

/** Seal an epoch private key for storage in account.epoch_signing_keys. */
export function sealEpochPrivateKey(secret: string, privateKeyPkcs8DerBase64: string): string {
  const key = deriveSealKey(secret);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(Buffer.from(privateKeyPkcs8DerBase64, 'utf8')),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `${SEAL_VERSION}:${Buffer.concat([iv, tag, ciphertext]).toString('base64')}`;
}

/** Unseal an epoch private key. Returns null on tamper, wrong secret, or defect. */
export function unsealEpochPrivateKey(secret: string, sealed: string): string | null {
  try {
    const [version, payloadBase64] = sealed.split(':', 2);
    if (version !== SEAL_VERSION || !payloadBase64) return null;
    const payload = Buffer.from(payloadBase64, 'base64');
    if (payload.length <= IV_LENGTH + TAG_LENGTH) return null;
    const iv = payload.subarray(0, IV_LENGTH);
    const tag = payload.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
    const ciphertext = payload.subarray(IV_LENGTH + TAG_LENGTH);
    const decipher = createDecipheriv('aes-256-gcm', deriveSealKey(secret), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}
