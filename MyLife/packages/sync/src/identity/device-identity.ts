/**
 * Device identity generation and Ed25519 signing/verification.
 *
 * Each device generates a unique Ed25519 signing keypair and an X25519
 * Diffie-Hellman keypair on first launch. The Ed25519 public key serves
 * as the canonical device ID.
 */

import nacl from 'tweetnacl';
import { bytesToHex, hexToBytes } from '../encryption/keys';
import {
  getDeviceIdentitySecrets,
  isDeviceIdentitySecretRef,
  storeDeviceIdentitySecrets,
} from '../secrets/sync-secret-store';

/**
 * Re-export DeviceIdentity from types for convenience.
 */
import type { DeviceIdentity } from '../types';
export type { DeviceIdentity };

/**
 * Generate a new device identity with fresh Ed25519 and X25519 keypairs.
 *
 * The `privateKeyRef` is an opaque secure-storage reference. Raw private
 * key material must not be persisted in SQLite.
 */
export function generateDeviceIdentity(displayName: string): DeviceIdentity {
  const signingKeypair = nacl.sign.keyPair();
  const dhKeypair = nacl.box.keyPair();

  const publicKeyHex = bytesToHex(signingKeypair.publicKey);
  const privateKeyHex = bytesToHex(signingKeypair.secretKey);
  const dhPublicKeyHex = bytesToHex(dhKeypair.publicKey);
  const dhPrivateKeyHex = bytesToHex(dhKeypair.secretKey);
  const privateKeyRef = storeDeviceIdentitySecrets(publicKeyHex, {
    ed25519PrivateKeyHex: privateKeyHex,
    x25519PrivateKeyHex: dhPrivateKeyHex,
  });

  return {
    publicKey: publicKeyHex,
    privateKeyRef,
    dhPublicKey: dhPublicKeyHex,
    displayName,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Extract the device ID from an identity.
 * The device ID is the Ed25519 public key (hex-encoded).
 */
export function getDeviceId(identity: DeviceIdentity): string {
  return identity.publicKey;
}

/**
 * Sign a message using an Ed25519 private key.
 *
 * @param privateKeyHex - The full Ed25519 secret key (64 bytes) as hex
 * @param message - The message bytes to sign
 * @returns The detached signature (64 bytes)
 */
export function signMessage(privateKeyHex: string, message: Uint8Array): Uint8Array {
  const privateKey = hexToBytes(privateKeyHex);
  return nacl.sign.detached(message, privateKey);
}

function extractLegacySigningPrivateKeyHex(ref: string): string | null {
  const match = ref.match(/^local:ed25519:([0-9a-f]+)/i);
  return match?.[1] ?? null;
}

function extractLegacyDhPrivateKeyHex(ref: string): string | null {
  const match = ref.match(/:x25519:([0-9a-f]+)/i);
  if (match?.[1]) return match[1];

  const legacySigningMatch = ref.match(/^local:ed25519:([0-9a-f]+)/i);
  if (legacySigningMatch?.[1] && legacySigningMatch[1].length >= 64) {
    return legacySigningMatch[1].slice(0, 64);
  }

  return null;
}

export function isLegacyRawDevicePrivateKeyRef(ref: string): boolean {
  return /^local:ed25519:/i.test(ref);
}

export function migrateDeviceIdentityPrivateKeyRef(identity: DeviceIdentity): DeviceIdentity | null {
  if (!isLegacyRawDevicePrivateKeyRef(identity.privateKeyRef)) return null;

  const signingPrivateKeyHex = extractLegacySigningPrivateKeyHex(identity.privateKeyRef);
  const dhPrivateKeyHex = extractLegacyDhPrivateKeyHex(identity.privateKeyRef);
  if (!signingPrivateKeyHex || !dhPrivateKeyHex) return null;

  return {
    ...identity,
    privateKeyRef: storeDeviceIdentitySecrets(identity.publicKey, {
      ed25519PrivateKeyHex: signingPrivateKeyHex,
      x25519PrivateKeyHex: dhPrivateKeyHex,
    }),
  };
}

export function extractSigningPrivateKeyHex(ref: string): string {
  if (isDeviceIdentitySecretRef(ref)) {
    const bundle = getDeviceIdentitySecrets(ref);
    if (!bundle) {
      throw new Error('Sync signing private key is unavailable in secure storage.');
    }
    return bundle.ed25519PrivateKeyHex;
  }

  const legacy = extractLegacySigningPrivateKeyHex(ref);
  if (legacy) return legacy;

  throw new Error('Unsupported sync signing private key reference.');
}

export function extractDhPrivateKeyHex(ref: string): string | null {
  if (isDeviceIdentitySecretRef(ref)) {
    return getDeviceIdentitySecrets(ref)?.x25519PrivateKeyHex ?? null;
  }

  return extractLegacyDhPrivateKeyHex(ref);
}

/**
 * Verify an Ed25519 signature against a public key.
 *
 * @param publicKeyHex - The Ed25519 public key as hex
 * @param message - The original message bytes
 * @param signature - The detached signature to verify
 * @returns true if the signature is valid
 */
export function verifySignature(
  publicKeyHex: string,
  message: Uint8Array,
  signature: Uint8Array,
): boolean {
  try {
    const publicKey = hexToBytes(publicKeyHex);
    return nacl.sign.detached.verify(message, signature, publicKey);
  } catch {
    return false;
  }
}

/**
 * Compute a short fingerprint of a public key for human-readable display.
 *
 * Returns the first 8 hex characters of the SHA-512 hash of the public key bytes.
 * This is NOT cryptographically binding for security purposes -- it is purely
 * a UX convenience for device identification in the pairing UI.
 */
export function getPublicKeyFingerprint(publicKeyHex: string): string {
  const publicKeyBytes = hexToBytes(publicKeyHex);
  const hash = nacl.hash(publicKeyBytes); // SHA-512
  return bytesToHex(hash).substring(0, 8);
}
