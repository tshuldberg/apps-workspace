/**
 * Signed identity bundles + trust-on-first-use pinning (MK-015).
 *
 * A pairing payload that is merely typed in is trivially spoofable: a
 * man-in-the-middle (the Yearn F1 precedent: a key-directory swap) can hand a
 * victim its own DH key under a friend's name. The defense is twofold:
 *
 *  - Authenticate the payload. A SignedIdentityBundle binds {deviceId,
 *    dhPublicKey, displayName, relayHints, issuedAt} under the holder's Ed25519
 *    key. deviceId IS that key, so a valid signature proves the bundle was
 *    produced by whoever controls the device id.
 *  - Pin on first use. The first bundle seen for a device id is remembered; a
 *    later bundle that keeps the id but swaps the DH key is a key change and is
 *    surfaced as a warning, never silently accepted.
 *
 * Pure (no DB, no I/O). The pin store lives in queries.ts.
 */

import type { DeviceIdentity } from '../types';
import {
  extractSigningPrivateKeyHex,
  signMessage,
  verifySignature,
} from '../identity/device-identity';
import { bytesToHex, hexToBytes } from '../encryption/keys';

const encoder = new TextEncoder();

/** The authenticated identity claim. deviceId is the Ed25519 public key. */
export interface IdentityBundle {
  version: 1;
  deviceId: string;
  dhPublicKey: string;
  displayName: string;
  /** Relay URLs this device can be reached at (hints, not secrets). */
  relayHints: string[];
  /** ISO 8601 issue time; lets a fresher bundle supersede an older one. */
  issuedAt: string;
}

export interface SignedIdentityBundle {
  bundle: IdentityBundle;
  /** Ed25519 signature (hex) over the canonical bundle, by bundle.deviceId. */
  signature: string;
}

/** Trust verdict from comparing an incoming bundle against the pinned one. */
export type TrustStatus = 'first_seen' | 'matches' | 'key_changed' | 'invalid_signature';

/** Canonical bytes signed/verified -- field order is fixed and explicit. */
function canonicalBundle(bundle: IdentityBundle): Uint8Array {
  return encoder.encode(
    JSON.stringify([
      'meerkat-identity-bundle',
      bundle.version,
      bundle.deviceId,
      bundle.dhPublicKey,
      bundle.displayName,
      [...bundle.relayHints],
      bundle.issuedAt,
    ]),
  );
}

/** Build and sign this device's identity bundle. */
export function createSignedIdentityBundle(
  identity: DeviceIdentity,
  relayHints: string[] = [],
  issuedAt: string = new Date().toISOString(),
): SignedIdentityBundle {
  const bundle: IdentityBundle = {
    version: 1,
    deviceId: identity.publicKey,
    dhPublicKey: identity.dhPublicKey,
    displayName: identity.displayName,
    relayHints: [...relayHints],
    issuedAt,
  };
  const privateKeyHex = extractSigningPrivateKeyHex(identity.privateKeyRef);
  const signature = bytesToHex(signMessage(privateKeyHex, canonicalBundle(bundle)));
  return { bundle, signature };
}

/** Verify a bundle's self-signature (deviceId signs the bundle). */
export function verifySignedIdentityBundle(signed: SignedIdentityBundle): boolean {
  if (!signed?.bundle || typeof signed.signature !== 'string') return false;
  const { bundle } = signed;
  if (
    bundle.version !== 1
    || typeof bundle.deviceId !== 'string'
    || typeof bundle.dhPublicKey !== 'string'
    || typeof bundle.displayName !== 'string'
    || !Array.isArray(bundle.relayHints)
    || typeof bundle.issuedAt !== 'string'
  ) {
    return false;
  }
  try {
    return verifySignature(bundle.deviceId, canonicalBundle(bundle), hexToBytes(signed.signature));
  } catch {
    return false;
  }
}

/** What was previously pinned for a device id (subset of the pin row). */
export interface PinnedIdentity {
  deviceId: string;
  dhPublicKey: string;
}

/**
 * Decide trust for an incoming bundle against the pin store. Invalid signatures
 * are rejected outright; a never-seen device is first-seen (pin it); a known
 * device with the same DH key matches; a known device with a different DH key
 * is a key change (warn the user, do not auto-trust).
 */
export function evaluateBundleTrust(
  signed: SignedIdentityBundle,
  pinned: PinnedIdentity | null,
): TrustStatus {
  if (!verifySignedIdentityBundle(signed)) return 'invalid_signature';
  if (!pinned) return 'first_seen';
  if (pinned.deviceId !== signed.bundle.deviceId) return 'first_seen';
  return pinned.dhPublicKey === signed.bundle.dhPublicKey ? 'matches' : 'key_changed';
}
