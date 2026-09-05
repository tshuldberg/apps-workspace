/**
 * Device pairing protocol for P2P sync.
 *
 * Handles pairing payload creation, validation, X25519 key agreement,
 * and PairedDevice record construction. The pairing flow is:
 *
 * 1. Device A calls createPairingPayload() to get a QR code payload + 6-digit code
 * 2. Device B scans QR / enters code and receives the PairingData
 * 3. Both sides call derivePairingSharedSecret() with their own DH private key
 *    and the other's DH public key
 * 4. Device B calls completePairing() to create the PairedDevice record
 */

import nacl from 'tweetnacl';
import { bytesToHex, hexToBytes } from '../encryption/keys';
import type { DeviceIdentity, PairedDevice } from '../types';
import { extractDhPrivateKeyHex } from './device-identity';
import { storeSharedSecret } from '../secrets/sync-secret-store';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Data exchanged during device pairing (transmitted via QR code or manual entry). */
export interface PairingData {
  /** Ed25519 public key of the device (hex-encoded, also the device ID). */
  publicKey: string;
  /** X25519 Diffie-Hellman public key (hex-encoded). */
  dhPublicKey: string;
  /** Human-readable device name. */
  displayName: string;
  /** Random nonce to prevent replay (hex-encoded). */
  pairingNonce: string;
}

// ---------------------------------------------------------------------------
// Pairing payload creation
// ---------------------------------------------------------------------------

/**
 * Create a pairing payload and 6-digit code for this device.
 *
 * The pairingData is what gets encoded in the QR code. The pairingCode
 * is a 6-digit numeric string displayed to the user for manual entry fallback.
 */
export function createPairingPayload(
  identity: DeviceIdentity,
): { pairingData: PairingData; pairingCode: string } {
  const nonce = nacl.randomBytes(16);

  const pairingData: PairingData = {
    publicKey: identity.publicKey,
    dhPublicKey: identity.dhPublicKey,
    displayName: identity.displayName,
    pairingNonce: bytesToHex(nonce),
  };

  // Generate a 6-digit numeric code from random bytes
  const codeBuf = nacl.randomBytes(4);
  const codeValue =
    ((codeBuf[0]! << 24) | (codeBuf[1]! << 16) | (codeBuf[2]! << 8) | codeBuf[3]!) >>> 0;
  const pairingCode = (codeValue % 1_000_000).toString().padStart(6, '0');

  return { pairingData, pairingCode };
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Validate that a pairing code is a 6-digit numeric string.
 */
export function validatePairingCode(code: string): boolean {
  return /^\d{6}$/.test(code);
}

// ---------------------------------------------------------------------------
// Key agreement
// ---------------------------------------------------------------------------

/**
 * Derive a shared secret from this device's X25519 private key and the
 * remote device's X25519 public key using Curve25519 Diffie-Hellman.
 *
 * Both sides will derive the same 32-byte shared secret, which can then
 * be used to encrypt sync traffic between the paired devices.
 *
 * @param myDhPrivateKeyHex - This device's X25519 secret key (hex-encoded, 32 bytes)
 * @param theirDhPublicKeyHex - Remote device's X25519 public key (hex-encoded, 32 bytes)
 * @returns Hex-encoded shared secret (32 bytes)
 */
export function derivePairingSharedSecret(
  myDhPrivateKeyHex: string,
  theirDhPublicKeyHex: string,
): string {
  const myPrivateKey = hexToBytes(myDhPrivateKeyHex);
  const theirPublicKey = hexToBytes(theirDhPublicKeyHex);
  const sharedSecret = nacl.box.before(theirPublicKey, myPrivateKey);
  return bytesToHex(sharedSecret);
}

/**
 * Complete the pairing process by deriving a shared secret and constructing
 * a PairedDevice record ready for database insertion.
 *
 * The caller's DH private key is loaded from secure storage via the
 * identity's privateKeyRef. The returned PairedDevice stores only an
 * opaque reference to the derived shared secret.
 */
// ---------------------------------------------------------------------------
// Workspace-scoped pairing
// ---------------------------------------------------------------------------

/** Data exchanged during workspace-scoped pairing (QR code payload). */
export interface WorkspacePairingPayload {
  /** Target workspace ID. */
  workspaceId: string;
  /** Wrapped workspace symmetric key (placeholder until crypto wiring). */
  wrappedWorkspaceKey: string;
  /** Device ID of the inviter (Ed25519 public key, hex-encoded). */
  inviterDeviceId: string;
  /** Ephemeral signature over the payload (placeholder until crypto wiring). */
  ephemeralSig: string;
  /** Random nonce to prevent replay (hex-encoded). */
  nonce: string;
}

/**
 * Create a workspace-scoped pairing payload for QR code display.
 *
 * The inviter generates this payload so the joining device can
 * validate the workspace target and receive the workspace key.
 * Crypto fields use placeholder values until the full key-wrap
 * pipeline is wired in a later phase.
 */
export function createWorkspacePairing(
  workspaceId: string,
  deviceId: string,
): WorkspacePairingPayload {
  const nonce = nacl.randomBytes(16);
  return {
    workspaceId,
    wrappedWorkspaceKey: '<placeholder>',
    inviterDeviceId: deviceId,
    ephemeralSig: '<placeholder>',
    nonce: bytesToHex(nonce),
  };
}

/**
 * Validate that a workspace pairing payload targets the expected workspace.
 *
 * Returns true if the payload's workspaceId matches and the nonce is
 * non-empty. Full signature verification is deferred to the crypto phase.
 */
export function validateWorkspacePairing(
  payload: WorkspacePairingPayload,
  workspaceId: string,
): boolean {
  if (payload.workspaceId !== workspaceId) return false;
  if (!payload.nonce || payload.nonce.length === 0) return false;
  if (!payload.inviterDeviceId || payload.inviterDeviceId.length === 0) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Device-level pairing completion
// ---------------------------------------------------------------------------

export function completePairing(
  identity: DeviceIdentity,
  remotePairingData: PairingData,
): PairedDevice {
  const localDhPrivateKeyHex = extractDhPrivateKeyHex(identity.privateKeyRef);
  if (!localDhPrivateKeyHex) {
    throw new Error('Cannot complete pairing without a local DH private key.');
  }

  const sharedSecretRef = storeSharedSecret(
    identity.publicKey,
    remotePairingData.publicKey,
    derivePairingSharedSecret(localDhPrivateKeyHex, remotePairingData.dhPublicKey),
  );
  const now = new Date().toISOString();

  return {
    deviceId: remotePairingData.publicKey,
    displayName: remotePairingData.displayName,
    dhPublicKey: remotePairingData.dhPublicKey,
    sharedSecretRef,
    lastSeenAt: now,
    lastSyncAt: null,
    lastSyncModule: null,
    bytesSent: 0,
    bytesReceived: 0,
    isActive: true,
    pairedAt: now,
  };
}
