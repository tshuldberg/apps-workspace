/**
 * Device revocation for the P2P sync trust model.
 *
 * When a device is lost, stolen, or compromised, any trusted device can
 * create a signed revocation record. Revoked devices are rejected during
 * the handshake and cannot participate in further sync sessions.
 */

import type { DatabaseAdapter } from '@mylife/db';
import type { DeviceIdentity, DeviceRevocation } from '../types';
import { isDeviceRevoked, insertRevocation, invalidateKeyVersion } from '../db/queries';

/**
 * Create a signed revocation record for a target device.
 *
 * The revocation is attributed to the local device (the one creating it).
 * In a full implementation, this record would be signed with the local
 * device's Ed25519 key and gossiped to all peers.
 *
 * @param identity - The local device's identity (the revoker)
 * @param targetDeviceId - The public key / device ID being revoked
 * @param reason - Optional human-readable reason for revocation
 */
export function createRevocation(
  identity: DeviceIdentity,
  targetDeviceId: string,
  reason?: string,
): DeviceRevocation {
  return {
    deviceId: targetDeviceId,
    revokedByDeviceId: identity.publicKey,
    reason: reason ?? null,
    revokedAt: new Date().toISOString(),
  };
}

/**
 * Check whether a device has been revoked.
 *
 * Delegates to the database query layer to look up revocation records.
 */
export function isRevoked(db: DatabaseAdapter, deviceId: string): boolean {
  return isDeviceRevoked(db, deviceId);
}

// ---------------------------------------------------------------------------
// Workspace-scoped revocation
// ---------------------------------------------------------------------------

/** Explicit opt-in for the deprecated v1 rotation paths (Plan 28 P5, NC-2). */
export interface LegacyRotationOptions {
  /**
   * The v1 integer-bump "rotation" mints NO real key: a removed device keeps
   * every secret it ever held, so nothing actually changes for an attacker.
   * Real removal is removeCommunityMember / commitMemberRemoval
   * (protocol/member-removal-core.ts + protocol/group-keys.ts). Pass true ONLY
   * for pre-group-key compatibility data; production code must never reach
   * these functions.
   */
  legacyOk?: boolean;
}

function assertLegacyOk(fn: string, options?: LegacyRotationOptions): void {
  if (options?.legacyOk === true) return;
  throw new Error(
    `${fn} is the deprecated v1 FAKE rotation (no real key is minted; a removed device keeps every `
    + 'secret it ever held). Use removeCommunityMember / commitMemberRemoval for a real removal + '
    + 'epoch rotation, or pass { legacyOk: true } only for pre-group-key compatibility data.',
  );
}

/**
 * Remove a member from a workspace and mark a key rotation as pending.
 *
 * @deprecated Plan 28 P5 (NC-2): this is the v1 FAKE rotation path -- it closes
 * the roster row and bumps current_key_version but mints NO real key, so the
 * removed device can still read everything. THROWS unless { legacyOk: true } is
 * passed explicitly. Real removal: removeCommunityMember (owner orchestration)
 * / commitMemberRemoval (fresh epoch wrapped for survivors only).
 *
 * @param db - Database adapter
 * @param workspaceId - Workspace to revoke from
 * @param deviceId - Device being removed
 * @param revokedByDeviceId - Device performing the revocation
 * @param options - Must carry legacyOk: true (pre-group-key compatibility only)
 */
export function revokeFromWorkspace(
  db: DatabaseAdapter,
  workspaceId: string,
  deviceId: string,
  revokedByDeviceId: string,
  options?: LegacyRotationOptions,
): void {
  assertLegacyOk('revokeFromWorkspace', options);
  // Remove the member
  db.execute(
    "UPDATE sync_workspace_members SET removed_at = datetime('now') WHERE workspace_id = ? AND device_id = ? AND removed_at IS NULL",
    [workspaceId, deviceId],
  );

  // Bump key version to trigger rotation on next sync
  db.execute(
    'UPDATE sync_workspaces SET current_key_version = current_key_version + 1, rotated_at = datetime(\'now\') WHERE id = ?',
    [workspaceId],
  );

  // Record the revocation for audit
  const revocation: DeviceRevocation = {
    deviceId,
    revokedByDeviceId,
    reason: `Removed from workspace ${workspaceId}`,
    revokedAt: new Date().toISOString(),
  };
  insertRevocation(db, revocation);
}

/**
 * Rotate the workspace symmetric key to a new version.
 *
 * @deprecated v1 integer-bump rotation: it advances current_key_version and
 * invalidates wraps but mints no real key, so nothing actually changes for an
 * attacker. Superseded by MK-023 membership commits (`commitMemberRemoval` /
 * `commitMemberAdd` in protocol/group-keys.ts), which generate a fresh epoch
 * secret and wrap it for the surviving members only. Kept for pre-group-key
 * compatibility paths.
 *
 * THROWS unless { legacyOk: true } is passed explicitly (Plan 28 P5, NC-2).
 *
 * @param db - Database adapter
 * @param workspaceId - Workspace whose key is being rotated
 * @param newKeyVersion - The new key version number
 * @param options - Must carry legacyOk: true (pre-group-key compatibility only)
 */
export function rotateWorkspaceKey(
  db: DatabaseAdapter,
  workspaceId: string,
  newKeyVersion: number,
  options?: LegacyRotationOptions,
): void {
  assertLegacyOk('rotateWorkspaceKey', options);
  // Invalidate old key wraps
  const oldVersion = newKeyVersion - 1;
  if (oldVersion >= 1) {
    invalidateKeyVersion(db, workspaceId, oldVersion);
  }

  // Update workspace to new key version
  db.execute(
    "UPDATE sync_workspaces SET current_key_version = ?, rotated_at = datetime('now') WHERE id = ?",
    [newKeyVersion, workspaceId],
  );
}
