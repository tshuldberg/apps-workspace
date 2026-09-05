/**
 * Signed change batches (MK-013).
 *
 * Every SYNC_DATA batch is signed with the sender's Ed25519 identity key over
 * a canonical digest of (module, snapshot bytes, covered change ids). The
 * responder verifies against the handshake-authenticated device id before
 * applying, so a tampered or forged batch is rejected even when the channel
 * itself is unencrypted, and authorship is cryptographically bound to the
 * batch rather than inferred from the connection. This is the authorship
 * primitive group mode (M3/MLS) builds on, where the channel key is shared
 * and can no longer identify the author.
 *
 * RN-safe, pure.
 */

import type { DeviceIdentity } from '../types';
import {
  extractSigningPrivateKeyHex,
  signMessage,
  verifySignature,
} from '../identity/device-identity';
import { bytesToHex, hexToBytes } from '../encryption/keys';
import { sha512Hex } from '../node/hkdf';

const encoder = new TextEncoder();

function canonicalBatchMessage(
  moduleId: string,
  syncData: Uint8Array,
  changeIds: readonly string[],
): Uint8Array {
  return encoder.encode(
    `meerkat-batch:v1:${moduleId}:${sha512Hex(syncData)}:${changeIds.join(',')}`,
  );
}

/** Sign a batch with the sender identity. Null when no signing key resolves. */
export function signBatch(
  identity: DeviceIdentity,
  moduleId: string,
  syncData: Uint8Array,
  changeIds: readonly string[],
): string | null {
  const privateKeyHex = extractSigningPrivateKeyHex(identity.privateKeyRef);
  if (!privateKeyHex) return null;
  try {
    return bytesToHex(
      signMessage(privateKeyHex, canonicalBatchMessage(moduleId, syncData, changeIds)),
    );
  } catch {
    return null;
  }
}

/** Verify a batch signature against the claimed author's device id. */
export function verifyBatch(
  authorDeviceId: string,
  moduleId: string,
  syncData: Uint8Array,
  changeIds: readonly string[],
  signatureHex: string,
): boolean {
  try {
    return verifySignature(
      authorDeviceId,
      canonicalBatchMessage(moduleId, syncData, changeIds),
      hexToBytes(signatureHex),
    );
  } catch {
    return false;
  }
}
