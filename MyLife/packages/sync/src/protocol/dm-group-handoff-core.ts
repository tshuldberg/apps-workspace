/**
 * Group DM commit APPLY side (Plan 21 Phase 6) -- the db-touching half of the
 * epoch handoff, kept out of the pure dm-group-handoff-mailbox.ts so the mailbox
 * dispatcher can import the open path without a cycle (mirrors the
 * join-handoff-mailbox / join-handoff-core split).
 *
 * applyDmGroupCommit builds the per-kind `dmGroupCommit` drain handler (the
 * recipient side). On a verified handoff it:
 *   - binds the sender to the descriptor admin and requires I am listed,
 *   - bridges the dm_group workspace + roster locally (so the epoch pointer has a
 *     parent row it can advance),
 *   - stores each recipient-gated wrap for THIS conversation only
 *     (storeReceivedKeyWrap defends epoch fast-forward + self-wrap poison), and
 *   - pins the admin identity (TOFU) so a later commit's signer is anchored.
 * It returns true iff I now hold a CURRENT epoch key for the group (a real read).
 * Fail-closed on every mismatch; nothing is written on rejection.
 */

import type { DatabaseAdapter } from '@mylife/db';
import type { DeviceIdentity } from '../types';
import { createWorkspace, getPinnedIdentity, getWorkspace, pinIdentity } from '../db/queries';
import {
  getCurrentEpochKey,
  keyWrapFromSyncedRow,
  keyWrapOpensForDevice,
  storeReceivedKeyWrap,
} from './group-keys';
import { evaluateBundleTrust } from './identity-bundle';
import type { DmGroupCommitPayload } from './dm-group-handoff-mailbox';
import type { MailboxEnvelopeHandlers } from './mailbox-dispatch';

export interface ApplyDmGroupCommitDeps {
  db: DatabaseAdapter;
  /** This device's identity (the group member receiving the handoff). */
  self: DeviceIdentity;
  /** Clock for pin/bridge timestamps (test injection). */
  now?: () => string;
}

/**
 * Build the per-kind dm_group commit drain handler (the recipient APPLY side).
 * Returns a PARTIAL MailboxEnvelopeHandlers so it composes with the others.
 */
export function applyDmGroupCommit(
  deps: ApplyDmGroupCommitDeps,
): Pick<MailboxEnvelopeHandlers, 'dmGroupCommit'> {
  const { db, self } = deps;
  const nowFn = deps.now ?? (() => new Date().toISOString());

  return {
    dmGroupCommit: (senderDeviceId: string, payload: DmGroupCommitPayload): boolean => {
      const descriptor = payload.descriptor;
      const conversationId = payload.conversationId;

      // openDmGroupCommit already re-verified the descriptor signature + bound the
      // sender to the admin; re-assert here as defense in depth before any write.
      if (descriptor.conversationId !== conversationId) return false;
      if (senderDeviceId !== descriptor.adminDeviceId) return false;
      if (!descriptor.members.some((m) => m.deviceId === self.publicKey)) return false;

      // AM4: pre-validate the self-addressed key wrap BEFORE any write. Parse the
      // wraps for THIS conversation and require at least one addressed to me that
      // actually OPENS with my DH key. A valid-but-unopenable handoff (a member I
      // can't derive a shared secret with, a poisoned/foreign wrap slot) must
      // leave ZERO state -- no orphan workspace, roster, or admin pin that a later
      // real commit would then treat as pre-existing. This is a pure read; the
      // writes below run only past it, and transactionally so a mid-apply throw
      // never leaves a torn partial handoff.
      const conversationWraps = payload.keyWraps
        .map(keyWrapFromSyncedRow)
        .filter((wrap): wrap is NonNullable<typeof wrap> => wrap !== null && wrap.workspaceId === conversationId);
      const canOpen = conversationWraps.some(
        (wrap) => wrap.wrappedForDeviceId === self.publicKey && keyWrapOpensForDevice(wrap, self),
      );
      if (!canOpen) return false;

      db.transaction(() => {
        // Bridge the dm_group workspace + roster so the epoch pointer can advance.
        if (!getWorkspace(db, conversationId)) {
          createWorkspace(db, {
            id: conversationId,
            displayName: descriptor.title,
            workspaceType: 'dm_group',
            createdByDeviceId: descriptor.adminDeviceId,
            createdAt: descriptor.createdAt,
            rotatedAt: null,
            currentKeyVersion: 0,
            archivedAt: null,
          });
        }
        for (const member of descriptor.members) {
          db.execute(
            `INSERT OR IGNORE INTO sync_workspace_members
               (workspace_id, device_id, role, invited_by_device_id, invited_at, removed_at)
             VALUES (?, ?, ?, ?, ?, NULL)`,
            [conversationId, member.deviceId, member.role === 'admin' ? 'admin' : 'member', descriptor.adminDeviceId, nowFn()],
          );
        }

        // Store each recipient-gated wrap (already filtered to THIS conversation).
        // Only a wrap addressed to me and openable with my DH key advances my epoch
        // pointer; the pre-check above guaranteed at least one does.
        for (const wrap of conversationWraps) {
          storeReceivedKeyWrap(db, wrap, self);
        }

        // Pin the admin (TOFU) so a later commit's signer is anchored. A key change
        // or invalid signature is NEVER silently pinned.
        const adminBundle = payload.adminBundle;
        const pinnedRow = getPinnedIdentity(db, senderDeviceId);
        const trust = evaluateBundleTrust(
          adminBundle,
          pinnedRow ? { deviceId: pinnedRow.deviceId, dhPublicKey: pinnedRow.dhPublicKey } : null,
        );
        if (
          trust === 'first_seen'
          && adminBundle.bundle.deviceId === senderDeviceId
          && /^[0-9a-f]{64}$/i.test(adminBundle.bundle.dhPublicKey)
        ) {
          pinIdentity(db, {
            deviceId: senderDeviceId,
            dhPublicKey: adminBundle.bundle.dhPublicKey,
            displayName: adminBundle.bundle.displayName,
            bundleJson: JSON.stringify(adminBundle.bundle),
            bundleSignature: adminBundle.signature,
            now: nowFn(),
          });
        }
      });

      // Real success: a current epoch key for the group now opens.
      return getCurrentEpochKey(db, conversationId, self) !== null;
    },
  };
}
