/**
 * Community member-removal APPLY side (Plan 28 P2).
 *
 * The survivor's drain handler for a MEMBER_REMOVAL envelope, composed into
 * MailboxEnvelopeHandlers exactly like applyJoinGrant so the foreground and
 * background drains apply a removal the same way (one dispatcher, no drift).
 * PURE: a DatabaseAdapter + this device's identity, no native modules, no app
 * imports, no new crypto.
 *
 * openMemberRemovalMailbox already enforced the envelope signature, recipient
 * match, decrypt, and payload shape. This handler re-verifies AUTHORITY
 * fail-closed before anything is written:
 *   a. the payload names the descriptor's own community, and the envelope
 *      SENDER is the descriptor's ownerDeviceId (only the owner removes);
 *   b. this device already holds the community (a removal never introduces
 *      one -- joining is via invite/grant, not removal);
 *   c. the stored community has the SAME owner (a stranger cannot swap owners);
 *   d. the revision is STRICTLY newer and verifies (owner signature + chain
 *      hash + stable id) against the local predecessor -- a forged, older, or
 *      replayed descriptor is dropped (AC-5);
 *   e. the new descriptor actually drops the removed device and still lists
 *      ME (the removed device is never a recipient; a misdelivered
 *      self-removal envelope never applies).
 *
 * Then it applies, in order: upsertCommunity (the signed revision becomes the
 * stored truth), roster reconcile to the DESCRIPTOR's membership (close
 * removed_at for every device the new descriptor no longer lists -- this is
 * what flips the outbound session gate and resolveInboundAuth's
 * `removed_at IS NULL` check on THIS device, so old-epoch sessions with the
 * removed device are refused; reopen rows the descriptor re-lists), and
 * storeReceivedKeyWrap for each recipient-gated, community-scoped wrap (the
 * survivor's new-epoch key). The paired-device row for the removed device is
 * NOT touched: pairing is global (DMs, other communities); community dial
 * eligibility is exactly the roster row this closes.
 *
 * The owner bundle in the payload is PIN MATERIAL ONLY (first-seen TOFU pin of
 * the owner as the signer); it never gates the apply -- the descriptor chain
 * is the authority.
 */

import type { DatabaseAdapter } from '@mylife/db';
import type { DeviceIdentity } from '../types';
import {
  communityRole,
  getCommunity,
  reconcileCommunityRosterFromDescriptor,
  removeMemberRevision,
  upsertCommunity,
  verifyCommunityDescriptor,
  type CommunityMember,
  type SignedCommunityDescriptor,
} from './community';
import {
  commitMemberRemoval,
  keyWrapFromSyncedRow,
  storeReceivedKeyWrap,
  type GroupMemberKey,
  type RecordKeyWrapChange,
} from './group-keys';
import { getKeyWraps, getPinnedIdentity, pinIdentity } from '../db/queries';
import { createSignedIdentityBundle, evaluateBundleTrust } from './identity-bundle';
import {
  sealMemberRemovalFanOut,
  type MemberRemovalPayload,
  type MemberRemovalRecipient,
} from './member-removal-mailbox';
import type { MailboxEnvelope } from './mailbox';
import type { MailboxEnvelopeHandlers } from './mailbox-dispatch';

export interface ApplyMemberRemovalDeps {
  db: DatabaseAdapter;
  /** This device's identity (a surviving member). */
  self: DeviceIdentity;
  /** Clock for roster/pin timestamps (test injection). */
  now?: () => string;
}

/**
 * Build the per-kind member-removal drain handler (the survivor APPLY side).
 * Returns a PARTIAL MailboxEnvelopeHandlers so it composes with the other
 * handlers. Returns true iff the signed revision really took local effect.
 */
export function applyMemberRemoval(
  deps: ApplyMemberRemovalDeps,
): Pick<MailboxEnvelopeHandlers, 'memberRemoval'> {
  const { db, self } = deps;
  const nowFn = deps.now ?? (() => new Date().toISOString());

  return {
    memberRemoval: (senderDeviceId: string, payload: MemberRemovalPayload): boolean => {
      const communityId = payload.communityId;
      const descriptor = payload.descriptor.descriptor;

      // a. Names its own community; only the descriptor's OWNER may remove.
      if (descriptor.communityId !== communityId) return false;
      if (senderDeviceId !== descriptor.ownerDeviceId) return false;

      // b. Known community only: a removal never introduces one.
      const existing = getCommunity(db, communityId);
      if (!existing) return false;

      // c. Same owner as stored (no owner swap through a removal).
      if (existing.descriptor.ownerDeviceId !== descriptor.ownerDeviceId) return false;

      // d. Strictly newer + owner signature + chain against the local
      //    predecessor (the monotonic guard that makes replay/rollback dead).
      if (descriptor.revision <= existing.descriptor.revision) return false;
      if (!verifyCommunityDescriptor(payload.descriptor, {
        descriptor: existing.descriptor,
        signature: existing.signature,
      })) {
        return false;
      }

      // e. The revision actually removes the named device, and still lists me
      //    (the removed device is never a recipient of this mailbox).
      if (descriptor.members.some((m) => m.deviceId === payload.removedDeviceId)) return false;
      if (communityRole(descriptor, self.publicKey) === null) return false;

      const now = nowFn();

      // The signed revision becomes the stored truth (monotonic upsert).
      upsertCommunity(db, payload.descriptor, self.publicKey, now);

      // Roster reconcile to the DESCRIPTOR (authoritative membership): close
      // every row the new descriptor no longer lists -- this flips the session
      // gates on THIS device -- and make sure every listed member has an open
      // row (a survivor that missed an earlier ADD revision still converges).
      // The SAME helper backs descriptor gossip so a removal takes an identical
      // roster effect whichever path delivered the revision (AM7).
      reconcileCommunityRosterFromDescriptor(db, descriptor, now);

      // Store the recipient-gated wraps (skip rows that fail to parse OR that
      // name a different community). Only a wrap addressed to me and openable
      // with my DH key advances my epoch -- storeReceivedKeyWrap enforces that.
      for (const row of payload.keyWraps) {
        const wrap = keyWrapFromSyncedRow(row);
        if (!wrap) continue;
        if (wrap.workspaceId !== communityId) continue;
        storeReceivedKeyWrap(db, wrap, self);
      }

      // Pin the owner bundle first-seen (pin material only, never a gate: the
      // descriptor chain above is the authority for this removal).
      const ownerBundle = payload.ownerBundle;
      if (
        ownerBundle.bundle.deviceId === senderDeviceId
        && /^[0-9a-f]{64}$/i.test(ownerBundle.bundle.dhPublicKey)
      ) {
        const pinnedRow = getPinnedIdentity(db, senderDeviceId);
        const trust = evaluateBundleTrust(
          ownerBundle,
          pinnedRow ? { deviceId: pinnedRow.deviceId, dhPublicKey: pinnedRow.dhPublicKey } : null,
        );
        if (trust === 'first_seen') {
          pinIdentity(db, {
            deviceId: senderDeviceId,
            dhPublicKey: ownerBundle.bundle.dhPublicKey,
            displayName: ownerBundle.bundle.displayName,
            bundleJson: JSON.stringify(ownerBundle.bundle),
            bundleSignature: ownerBundle.signature,
            now,
          });
        }
      }

      return true;
    },
  };
}

// ---------------------------------------------------------------------------
// removeCommunityMember (Plan 28 P3): the OWNER-side end-to-end orchestration.
// ---------------------------------------------------------------------------

export interface RemoveCommunityMemberDeps {
  db: DatabaseAdapter;
  /** This device's identity (must be the community owner). */
  owner: DeviceIdentity;
  /**
   * Park an already-sealed envelope on a mailbox token (the relay store-and-
   * forward). Returns true iff the park really happened; a false/throw is
   * counted honestly as not-parked, never faked.
   */
  parkEnvelope: (token: string, envelope: MailboxEnvelope) => boolean | Promise<boolean>;
  /**
   * Republish the revised descriptor to one community-node base url (the hosted
   * enforcement surface: the node's next feed challenge then rejects the removed
   * member as not_member). Injected so this file stays fetch-free; wire it to
   * republishCommunityDescriptor. Omit when no node client is available.
   */
  republishDescriptor?: (
    nodeUrl: string,
    descriptor: SignedCommunityDescriptor,
  ) => boolean | Promise<boolean>;
  /**
   * Replication seam: pass `engine.recordChange` so the new-epoch wraps minted by
   * commitMemberRemoval ALSO replicate to already-paired members over the engine
   * (the mailbox fan-out is the offline-direct path; this is the session path).
   */
  recordChange?: RecordKeyWrapChange;
  /** Clock (test injection). */
  now?: () => string;
}

export type RemoveCommunityMemberResult =
  | {
      ok: true;
      /** The new descriptor revision the removal signed. */
      revision: number;
      /** The fresh epoch minted for the survivors. */
      epoch: number;
      /** Keyed survivors addressed by the mailbox fan-out (excluding this owner device). */
      survivorsToNotify: number;
      /** Envelopes that REALLY parked on the relay (honest count, may be < survivorsToNotify). */
      envelopesParked: number;
      /** http(s) node hosts a republish was attempted against (0 when no client injected). */
      nodesAttempted: number;
      /** Node hosts that REALLY accepted the revised descriptor. */
      nodesRepublished: number;
    }
  | {
      ok: false;
      reason: 'unknown_community' | 'not_owner' | 'not_a_member' | 'cannot_remove_owner';
    };

/**
 * Remove a member from a community FOR REAL, end to end, in one owner action:
 *   1. sign a descriptor revision that drops the member (removeMemberRevision)
 *      and store it (upsertCommunity, monotonic);
 *   2. close the roster row + mint a fresh epoch wrapped ONLY for the keyed
 *      survivors (commitMemberRemoval -- the removed device holds no wrap for
 *      the new secret, so post-removal content is unreadable to it), with
 *      recordChange replicating the wraps over the engine to paired members;
 *   3. fan out one sealed MEMBER_REMOVAL envelope per keyed survivor (never the
 *      removed device, never this device) carrying the revised descriptor +
 *      that survivor's new-epoch wraps, parked on its per-recipient removal
 *      token (the P2 drain applies it);
 *   4. republish the revised descriptor to every http(s) node host so the
 *      hosted enforcement surface converges in the SAME action (AC-3).
 * Every count in the result is what actually happened -- a failed park or
 * republish is reported, never claimed. Removal is EPOCH-BOUNDARY honest:
 * convergence is per device as survivors drain; UI copy must say exactly that.
 */
export async function removeCommunityMember(
  deps: RemoveCommunityMemberDeps,
  communityId: string,
  removedDeviceId: string,
): Promise<RemoveCommunityMemberResult> {
  const { db, owner } = deps;
  const nowFn = deps.now ?? (() => new Date().toISOString());

  const stored = getCommunity(db, communityId);
  if (!stored) return { ok: false, reason: 'unknown_community' };
  if (communityRole(stored.descriptor, owner.publicKey) !== 'owner') {
    return { ok: false, reason: 'not_owner' };
  }
  if (removedDeviceId === owner.publicKey) return { ok: false, reason: 'cannot_remove_owner' };
  if (!stored.descriptor.members.some((m) => m.deviceId === removedDeviceId)) {
    return { ok: false, reason: 'not_a_member' };
  }
  const prevSigned: SignedCommunityDescriptor = {
    descriptor: stored.descriptor,
    signature: stored.signature,
  };

  const now = nowFn();

  // 1. The owner-signed removal revision becomes the stored truth.
  const revised = removeMemberRevision(owner, prevSigned, removedDeviceId, now);
  upsertCommunity(db, revised, owner.publicKey, now);

  // 2. REAL rotation. Survivors to wrap = members holding key material
  //    (Boolean(dhPublicKey)), never blindly descriptor.members: FF3 public
  //    joiners can hold roster rows with zero key material (AC-7).
  //    commitMemberRemoval itself excludes the removed device and closes its
  //    local roster row.
  const memberKeys: GroupMemberKey[] = prevSigned.descriptor.members
    .filter((m): m is CommunityMember & { dhPublicKey: string } => Boolean(m.dhPublicKey))
    .map((m) => ({ deviceId: m.deviceId, dhPublicKey: m.dhPublicKey }));
  const commit = commitMemberRemoval(db, {
    workspaceId: communityId,
    committer: owner,
    members: memberKeys,
    removedDeviceId,
    recordChange: deps.recordChange,
    now,
  });

  // 3. Fan out to every keyed survivor except this device (the owner already
  //    applied locally). Each envelope carries ONLY that survivor's wraps.
  const recipients: MemberRemovalRecipient[] = revised.descriptor.members
    .filter((m): m is CommunityMember & { dhPublicKey: string } =>
      Boolean(m.dhPublicKey) && m.deviceId !== owner.publicKey)
    .map((m) => ({
      deviceId: m.deviceId,
      dhPublicKey: m.dhPublicKey,
      keyWraps: getKeyWraps(db, communityId, commit.epoch)
        .filter((w) => w.wrappedForDeviceId === m.deviceId),
    }));
  const sealed = sealMemberRemovalFanOut({
    owner,
    communityId,
    communitySecret: revised.descriptor.genesisNonce,
    descriptor: revised,
    removedDeviceId,
    ownerBundle: createSignedIdentityBundle(owner),
    recipients,
    now,
  });
  let envelopesParked = 0;
  for (const entry of sealed) {
    try {
      if ((await deps.parkEnvelope(entry.token, entry.envelope)) === true) envelopesParked += 1;
    } catch {
      // Honest count: a failed park is simply not counted.
    }
  }

  // 4. Hosted enforcement in the same action: republish the revised descriptor
  //    to every http(s) node host so the node's next feed challenge rejects the
  //    removed member (not_member).
  const nodeHosts = deps.republishDescriptor
    ? revised.descriptor.hosts.filter((h) => /^https?:\/\//i.test(h))
    : [];
  let nodesRepublished = 0;
  for (const host of nodeHosts) {
    try {
      const republished = await deps.republishDescriptor!(host.replace(/\/+$/, ''), revised);
      if (republished === true) nodesRepublished += 1;
    } catch {
      // Honest count: a failed republish is reported, never claimed.
    }
  }

  return {
    ok: true,
    revision: revised.descriptor.revision,
    epoch: commit.epoch,
    survivorsToNotify: recipients.length,
    envelopesParked,
    nodesAttempted: nodeHosts.length,
    nodesRepublished,
  };
}
