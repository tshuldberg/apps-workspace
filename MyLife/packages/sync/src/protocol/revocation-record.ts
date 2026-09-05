/**
 * Signed, gossipable device revocation (plan 14, MK-019; revocation v2).
 *
 * v1 stored a plain revocation row and checked it in the handshake, but the
 * record was unsigned and never left the device that made it -- so revoking a
 * lost phone protected only the revoker, not the rest of the group. v2 signs the
 * record with the revoker's Ed25519 key so it can be gossiped (over sessions and
 * relay mailboxes) and trusted by anyone: a recipient verifies the signature and
 * that the revoker is authorized, then applies it locally. The existing handshake
 * check (isDeviceRevoked) then rejects the revoked device on the next connection,
 * so one gossip round is enough to lock it out of the whole web of trust.
 *
 * Authorization matters: an unsigned or unauthorized "revocation" must never let
 * a malicious peer evict arbitrary devices. The default authority model (audit
 * P1) is SELF + WORKSPACE-ADMIN: a recipient applies a gossiped revocation only
 * when the device is revoking ITSELF, or the revoker is a current owner/admin of
 * a workspace the target belongs to. A plain member can no longer evict another
 * member network-wide. Callers with a different context (e.g. the user managing
 * their own paired devices) pass an explicit predicate.
 */

import type { DatabaseAdapter } from '@mylife/db';
import type { DeviceIdentity, DeviceRevocation } from '../types';
import {
  extractSigningPrivateKeyHex,
  signMessage,
  verifySignature,
} from '../identity/device-identity';
import { bytesToHex, hexToBytes } from '../encryption/keys';
import {
  getWorkspaces,
  getWorkspaceMembers,
  insertRevocation,
  isDeviceRevoked,
  storeRevocationRecord,
} from '../db/queries';

const encoder = new TextEncoder();

/**
 * Default revoker authority: the revoker is the target (self-revocation), or a
 * current owner/admin of some non-archived workspace the target belongs to.
 */
export function isAdminOrSelfRevoker(
  db: DatabaseAdapter,
  revokerDeviceId: string,
  targetDeviceId: string,
): boolean {
  if (revokerDeviceId === targetDeviceId) return true;
  for (const ws of getWorkspaces(db)) {
    if (ws.archivedAt !== null) continue;
    const members = getWorkspaceMembers(db, ws.id);
    const revoker = members.find((m) => m.deviceId === revokerDeviceId && m.removedAt === null);
    if (!revoker || (revoker.role !== 'owner' && revoker.role !== 'admin')) continue;
    // The admin's authority is bound to a workspace the target is (or was) in.
    if (members.some((m) => m.deviceId === targetDeviceId)) return true;
  }
  return false;
}

export interface SignedRevocation {
  revocation: DeviceRevocation;
  /** Ed25519 signature (hex) over the canonical record, by revokedByDeviceId. */
  signature: string;
}

/** Canonical bytes signed/verified. Field order is fixed and explicit. */
function canonicalRevocation(r: DeviceRevocation): Uint8Array {
  return encoder.encode(
    JSON.stringify([
      'meerkat-revocation',
      r.deviceId,
      r.revokedByDeviceId,
      r.reason ?? null,
      r.revokedAt,
    ]),
  );
}

/** Create a revocation of `targetDeviceId`, signed by the revoker. */
export function createSignedRevocation(
  revoker: DeviceIdentity,
  targetDeviceId: string,
  reason?: string,
  revokedAt: string = new Date().toISOString(),
): SignedRevocation {
  const revocation: DeviceRevocation = {
    deviceId: targetDeviceId,
    revokedByDeviceId: revoker.publicKey,
    reason: reason ?? null,
    revokedAt,
  };
  const privateKeyHex = extractSigningPrivateKeyHex(revoker.privateKeyRef);
  const signature = bytesToHex(signMessage(privateKeyHex, canonicalRevocation(revocation)));
  return { revocation, signature };
}

/** Verify a revocation's signature against its claimed revoker. */
export function verifySignedRevocation(signed: SignedRevocation): boolean {
  if (!signed?.revocation || typeof signed.signature !== 'string') return false;
  const { revocation } = signed;
  if (
    typeof revocation.deviceId !== 'string'
    || typeof revocation.revokedByDeviceId !== 'string'
    || typeof revocation.revokedAt !== 'string'
    || (revocation.reason !== null && typeof revocation.reason !== 'string')
  ) {
    return false;
  }
  try {
    return verifySignature(
      revocation.revokedByDeviceId,
      canonicalRevocation(revocation),
      hexToBytes(signed.signature),
    );
  } catch {
    return false;
  }
}

export type ApplyRevocationResult =
  | { ok: true; applied: boolean; deviceId: string }
  | { ok: false; reason: 'invalid' | 'unauthorized_revoker' };

export interface ApplyRevocationOptions {
  /**
   * Whether the signer is allowed to revoke. Defaults to SELF + WORKSPACE-ADMIN
   * (isAdminOrSelfRevoker): the target revoking itself, or a current owner/admin
   * of a workspace the target is in. Callers in a different trust context (e.g.
   * a user managing their own paired devices) pass an explicit predicate.
   */
  isAuthorizedRevoker?: (revokerDeviceId: string, targetDeviceId: string) => boolean;
}

/**
 * Apply a gossiped signed revocation: verify the signature and the revoker's
 * authority, then record it locally so the handshake rejects the device.
 * Idempotent -- re-applying an already-recorded revocation is a no-op success.
 */
export function applySignedRevocation(
  db: DatabaseAdapter,
  signed: SignedRevocation,
  options: ApplyRevocationOptions = {},
): ApplyRevocationResult {
  if (!verifySignedRevocation(signed)) return { ok: false, reason: 'invalid' };

  const { deviceId, revokedByDeviceId } = signed.revocation;
  const authorized = options.isAuthorizedRevoker
    ? options.isAuthorizedRevoker(revokedByDeviceId, deviceId)
    : isAdminOrSelfRevoker(db, revokedByDeviceId, deviceId);
  if (!authorized) return { ok: false, reason: 'unauthorized_revoker' };

  if (isDeviceRevoked(db, deviceId)) {
    // Already revoked locally, but make sure we keep the signed record so we can
    // forward it (an older code path may have inserted the revocation without it).
    storeRevocationRecord(db, JSON.stringify(signed), deviceId);
    return { ok: true, applied: false, deviceId };
  }

  insertRevocation(db, signed.revocation);
  // Persist the signed form too (MK-019 gossip): self-issued AND received
  // revocations become forwardable over future sessions.
  storeRevocationRecord(db, JSON.stringify(signed), deviceId);
  return { ok: true, applied: true, deviceId };
}
