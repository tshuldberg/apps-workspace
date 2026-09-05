/**
 * Owner-side invite -> join key-handoff CORE (community feed P7).
 *
 * This is the verify-on-BOTH-sides heart of the handoff, as drain handlers that
 * compose into MailboxEnvelopeHandlers (so the foreground AND background drains
 * serve + apply the handoff the same way -- one dispatcher, no drift). It is
 * PURE: a DatabaseAdapter + injected deps (a relay-park function, a clock), no
 * native modules and NO imports from any app or from meerkat-relay. Everything is
 * reused from @mylife/sync primitives; it adds NO new crypto scheme.
 *
 * THE GAP THIS CLOSES: joinCommunityFromLink stores the link's descriptor but
 * never tells the OWNER who joined, so a normal invite -> join never minted an
 * epoch key for the newcomer nor added it to the descriptor membership. Now:
 *
 *   buildJoinRequest (joiner B): seal B's signed bundle + the signed invite to
 *     the OWNER, addressed by deriveCommunityJoinToken(genesisNonce, communityId,
 *     ownerDeviceId). B parks it; the owner drains it.
 *
 *   processJoinRequest (owner): on a verified request --
 *     a. the owner must actually be this community's owner;
 *     b. re-verify the invite against the owner's OWN current descriptor (NOT a
 *        B-supplied one): signature, inviter authority, community id, expiry;
 *     c. verify B's bundle AND bundle.deviceId === the envelope sender (bind the
 *        DH key to the signing identity); TOFU vs the pin store -- key_changed is
 *        DROPPED (never re-key a changed identity), first_seen is pinned;
 *     d. if B is already an active member with the same DH key: idempotent --
 *        re-package + re-park the grant, do NOT re-mint;
 *     e. else: reviseCommunity to add B + upsertCommunity, then commitMemberAdd
 *        (mints a new epoch, back-wraps history per historyScope, replicates
 *        new-epoch wraps to already-paired members over the engine via
 *        recordChange);
 *     f. pair owner <-> B (derivePairingSharedSecret + insertPairedDevice) so
 *        future epoch rotations reach B over the engine;
 *     g. collect the key-wrap rows addressed to B (full history -> every epoch
 *        1..current B can open; join_point -> only the current epoch);
 *     h. seal a join-grant {newSigned descriptor, those wraps, owner bundle} to B
 *        and park it on deriveCommunityJoinToken(genesisNonce, communityId, B).
 *        Return true iff parked.
 *
 *   applyJoinGrant (joiner B): on a verified grant --
 *     a. the grant's descriptor names this community, the envelope sender is the
 *        descriptor's ownerDeviceId, the owner signature verifies, and the new
 *        descriptor LISTS me; drop on any failure;
 *     b. if I already have a stored community, the new descriptor's ownerDeviceId
 *        MUST equal my stored ownerDeviceId (a stranger cannot grant me into a
 *        different owner's community);
 *     c. upsertCommunity(new descriptor);
 *     d. storeReceivedKeyWrap for each wrap (recipient-gated; skip parse failures);
 *     e. pair me <-> owner (verify owner bundle === sender, pin first-seen);
 *     f. return true iff getCurrentEpochKey is now non-null (I can read the feed).
 *
 * Honesty: a request/grant is parked only when the relay park really succeeds; a
 * handler returns true only when it applied something real. Zero-knowledge: the
 * relay sees only the opaque sealed envelope + the opaque community-derived token.
 */

import type { DatabaseAdapter } from '@mylife/db';
import type { DeviceIdentity, HistoryScope } from '../types';
import { extractDhPrivateKeyHex } from '../identity/device-identity';
import { derivePairingSharedSecret } from '../identity/pairing';
import {
  createSignedIdentityBundle,
  evaluateBundleTrust,
  type SignedIdentityBundle,
} from './identity-bundle';
import {
  communityRole,
  getCommunity,
  reviseCommunity,
  upsertCommunity,
  verifyDescriptorOwnerSignature,
  type CommunityMember,
  type ParsedInviteLink,
  type SignedCommunityDescriptor,
} from './community';
import {
  commitMemberAdd,
  getCurrentEpochKey,
  getWorkspaceEpoch,
  keyWrapFromSyncedRow,
  keyWrapToSyncedRow,
  storeReceivedKeyWrap,
  type GroupMemberKey,
  type RecordKeyWrapChange,
} from './group-keys';
import {
  createWorkspace,
  getKeyWraps,
  getPinnedIdentity,
  getWorkspace,
  insertPairedDevice,
  pinIdentity,
} from '../db/queries';
import { storeSharedSecret } from '../secrets/sync-secret-store';
import {
  deriveCommunityJoinToken,
  sealJoinGrantMailbox,
  sealJoinRequestMailbox,
  verifyJoinInviteAgainstOwnerDescriptor,
  JOIN_GRANT_MAILBOX_KIND,
  JOIN_REQUEST_MAILBOX_KIND,
  type JoinGrantPayload,
  type JoinRequestPayload,
} from './join-handoff-mailbox';
import type { MailboxEnvelope } from './mailbox';
import type { MailboxEnvelopeHandlers } from './mailbox-dispatch';

// ---------------------------------------------------------------------------
// buildJoinRequest (joiner B): seal the request to the OWNER.
// ---------------------------------------------------------------------------

export interface BuildJoinRequestResult {
  token: string;
  envelope: MailboxEnvelope;
  payload: JoinRequestPayload;
}

/**
 * Build the join-request a joiner parks for the owner. The owner's device id +
 * DH public key come from the OWNER member in the parsed invite's descriptor
 * (the communityRole 'owner' member). The token is derived from the descriptor's
 * genesisNonce and the owner device id, so only the owner can drain it (and only
 * the owner can open the sealed box inside). Returns null if the descriptor has
 * no owner member or that owner has no DH public key (cannot seal to it).
 */
export function buildJoinRequest(
  identity: DeviceIdentity,
  parsedInvite: ParsedInviteLink,
  now?: string,
): BuildJoinRequestResult | null {
  const descriptor = parsedInvite.descriptor.descriptor;
  const ownerMember = descriptor.members.find((m) => m.deviceId === descriptor.ownerDeviceId);
  if (!ownerMember || !ownerMember.dhPublicKey) return null;

  const token = deriveCommunityJoinToken(
    descriptor.genesisNonce,
    descriptor.communityId,
    descriptor.ownerDeviceId,
  );
  const payload: JoinRequestPayload = {
    kind: JOIN_REQUEST_MAILBOX_KIND,
    version: 1,
    communityId: descriptor.communityId,
    invite: parsedInvite.invite,
    bundle: createSignedIdentityBundle(identity),
  };
  const sealed = sealJoinRequestMailbox({
    sender: identity,
    recipient: { deviceId: descriptor.ownerDeviceId, dhPublicKey: ownerMember.dhPublicKey },
    token,
    payload,
    now,
  });
  return { token: sealed.token, envelope: sealed.envelope, payload };
}

// ---------------------------------------------------------------------------
// processJoinRequest (owner): the SERVE side handler factory.
// ---------------------------------------------------------------------------

export interface ProcessJoinRequestDeps {
  db: DatabaseAdapter;
  /** This device's identity (the would-be owner). */
  owner: DeviceIdentity;
  /**
   * Park an already-sealed envelope on a mailbox token (the relay store-and-
   * forward). Injected so this file stays testable. Returns true iff the park
   * really happened. A grant is parked ONLY when this returns true.
   */
  parkEnvelope: (token: string, envelope: MailboxEnvelope) => boolean | Promise<boolean>;
  /**
   * Replication seam: pass `engine.recordChange` so the new-epoch wraps minted by
   * commitMemberAdd replicate to ALREADY-paired members over the engine. Omit for
   * local-only / unit use.
   */
  recordChange?: RecordKeyWrapChange;
  /**
   * Optional fail-closed transport gate (Plan 27 P3). When present, the owner
   * refuses to SERVE a join for a community whose signed policy forbids the
   * carrier the request arrived over (a local_only community's join handoff never
   * rides a non-local connection). Returns true iff the carrier is permitted for
   * that community. The relay drain path leaves this undefined (a relay carrier
   * only ever holds `any` / `local_preferred` community handoffs, which the row
   * gates already protect); the local-connection path (local-join-handoff.ts)
   * supplies it so the gate holds even if a caller wires the wrong connection.
   */
  transportGate?: (communityId: string) => boolean;
  /** Clock for the sealed grant timestamp + revision (test injection). */
  now?: () => string;
}

/**
 * Build the per-kind join-request drain handler (the owner SERVE side). Returns a
 * PARTIAL MailboxEnvelopeHandlers so it composes with the channel/file/history
 * handlers.
 */
export function processJoinRequest(
  deps: ProcessJoinRequestDeps,
): Pick<MailboxEnvelopeHandlers, 'joinRequest'> {
  const { db, owner } = deps;
  const nowFn = deps.now ?? (() => new Date().toISOString());

  return {
    joinRequest: async (senderDeviceId: string, payload: JoinRequestPayload): Promise<boolean> => {
      const communityId = payload.communityId;

      // a. The owner must actually be THIS community's owner. Bind to the owner's
      //    OWN current stored descriptor, never a request-supplied one.
      const stored = getCommunity(db, communityId);
      if (!stored) return false;
      if (communityRole(stored.descriptor, owner.publicKey) !== 'owner') return false;
      // Plan 27 P3: fail-closed transport gate. Refuse to serve a join whose
      // community forbids the carrier this request arrived over.
      if (deps.transportGate && !deps.transportGate(communityId)) return false;
      const prevSigned: SignedCommunityDescriptor = {
        descriptor: stored.descriptor,
        signature: stored.signature,
      };

      // b. Re-verify the invite against the owner's current descriptor (signature,
      //    inviter authority, community id, expiry). Drop on any failure.
      if (verifyJoinInviteAgainstOwnerDescriptor(payload.invite, prevSigned, new Date(nowFn())) !== 'ok') {
        return false;
      }
      if (payload.invite.invite.communityId !== communityId) return false;

      // c-h. Bundle verify + TOFU, add B to the descriptor, mint/back-wrap the
      //      epoch key, pair, and park the grant. This is the SHARED owner-gated
      //      grant rail (also used by approvePublicJoinRequest); the only thing
      //      unique to the invite path is the invite re-verification gate above.
      return grantMembershipAndParkKey(deps, prevSigned, communityId, senderDeviceId, payload.bundle, nowFn);
    },
  };
}

/**
 * The SHARED owner-gated membership + key-handoff rail (steps c-h of the invite
 * flow), factored out so the invite path (processJoinRequest) and the public-join
 * approve path (approvePublicJoinRequest) mint + hand off the epoch key through the
 * EXACT SAME mechanism. The two paths differ ONLY in their authorization gate
 * (invite re-verification vs publication grant-id match); once a request is
 * authorized, this is the one and only way a key is minted and parked.
 *
 * On a verified joiner bundle (bound to `senderDeviceId`, TOFU-checked) it:
 *   c. binds B's DH key to its signing identity; key_changed / invalid drop;
 *      first_seen pins;
 *   d. idempotent when B is already an active member with the SAME DH key (re-park
 *      from the current descriptor, do NOT re-mint);
 *   e. else adds B to the descriptor (re-sign + store) and commitMemberAdd (mint a
 *      new epoch wrapped for the existing members PLUS B, back-wrap history per
 *      historyScope, replicate to already-paired members);
 *   f. pairs owner <-> B so future rotations reach B;
 *   g+h. packages B's openable wraps and parks the JOIN_GRANT.
 * Returns true iff the grant was really parked. NEVER serializes a raw/epoch key
 * anywhere but the owner-gated wrap rail. The caller has ALREADY bound the request
 * to the owner's OWN current descriptor (`prevSigned`) and confirmed owner-ship.
 */
export async function grantMembershipAndParkKey(
  deps: ProcessJoinRequestDeps,
  prevSigned: SignedCommunityDescriptor,
  communityId: string,
  senderDeviceId: string,
  bundle: SignedIdentityBundle,
  nowFn: () => string,
): Promise<boolean> {
  const { db, owner } = deps;

  // c. Verify B's bundle AND bind its DH key to the signing identity that authored
  //    the request. TOFU: key_changed DROPS (never re-key a changed identity);
  //    first_seen pins; matches is fine.
  if (bundle.bundle.deviceId !== senderDeviceId) return false;
  // Validate the DH key SHAPE before anything trusts/uses it: a malformed key would
  // otherwise throw deep in wrapSecret (hexToBytes) and abort the whole drain (a
  // remote DoS). 32-byte X25519 = 64 hex.
  if (!/^[0-9a-f]{64}$/i.test(bundle.bundle.dhPublicKey)) return false;
  const pinnedRow = getPinnedIdentity(db, senderDeviceId);
  const trust = evaluateBundleTrust(
    bundle,
    pinnedRow ? { deviceId: pinnedRow.deviceId, dhPublicKey: pinnedRow.dhPublicKey } : null,
  );
  if (trust === 'invalid_signature' || trust === 'key_changed') return false;
  if (trust === 'first_seen') {
    pinIdentity(db, {
      deviceId: senderDeviceId,
      dhPublicKey: bundle.bundle.dhPublicKey,
      displayName: bundle.bundle.displayName,
      bundleJson: JSON.stringify(bundle.bundle),
      bundleSignature: bundle.signature,
      now: nowFn(),
    });
  }

  const joinerDhPublicKey = bundle.bundle.dhPublicKey;
  const joinerDisplayName = bundle.bundle.displayName;
  const historyScope: HistoryScope = prevSigned.descriptor.historyScope ?? 'full';

  const existingMember = prevSigned.descriptor.members.find((m) => m.deviceId === senderDeviceId);

  // A member already listed with a DIFFERENT DH key is a key change in the SIGNED
  // roster: drop it (mirror the TOFU key_changed refusal above; never silently
  // re-key a listed device).
  if (existingMember && existingMember.dhPublicKey && existingMember.dhPublicKey !== joinerDhPublicKey) {
    return false;
  }

  // d. Idempotent: B is already an active member with the SAME DH key. Re-package +
  //    re-park the grant from the CURRENT descriptor; do NOT re-mint.
  if (existingMember && existingMember.dhPublicKey === joinerDhPublicKey) {
    return parkGrant(
      deps,
      prevSigned,
      communityId,
      senderDeviceId,
      joinerDhPublicKey,
      historyScope,
      nowFn(),
    );
  }

  // Quota: enforce maxMembers, but only when actually adding a NEW device (a re-key
  // of an already-listed keyless member does not grow the roster).
  if (!existingMember && prevSigned.descriptor.members.length >= prevSigned.descriptor.quotas.maxMembers) {
    return false;
  }

  // e. Add B to the descriptor (re-sign) + store it, then mint a new epoch wrapped
  //    for the existing members PLUS B, back-wrapping history per historyScope and
  //    replicating new-epoch wraps to already-paired members. REPLACE any stale row
  //    for this device (e.g. listed without a DH key) rather than appending a dup.
  const newMembers: CommunityMember[] = [
    ...prevSigned.descriptor.members.filter((m) => m.deviceId !== senderDeviceId),
    {
      deviceId: senderDeviceId,
      role: existingMember?.role ?? 'member',
      displayName: joinerDisplayName,
      dhPublicKey: joinerDhPublicKey,
    },
  ];
  const newSigned = reviseCommunity(owner, prevSigned, { members: newMembers }, nowFn());
  upsertCommunity(db, newSigned, owner.publicKey, nowFn());

  const currentMembers: GroupMemberKey[] = prevSigned.descriptor.members
    .filter((m): m is CommunityMember & { dhPublicKey: string } => Boolean(m.dhPublicKey))
    .map((m) => ({ deviceId: m.deviceId, dhPublicKey: m.dhPublicKey }));
  commitMemberAdd(db, {
    workspaceId: communityId,
    committer: owner,
    members: currentMembers,
    added: { deviceId: senderDeviceId, dhPublicKey: joinerDhPublicKey },
    role: 'member',
    historyScope,
    recordChange: deps.recordChange,
    now: nowFn(),
  });

  // f. Pair owner <-> B so future epoch rotations reach B over the engine.
  pairJoiner(db, owner, senderDeviceId, joinerDisplayName, joinerDhPublicKey, nowFn());

  // g + h. Package B's openable wraps and park the grant.
  return parkGrant(
    deps,
    newSigned,
    communityId,
    senderDeviceId,
    joinerDhPublicKey,
    historyScope,
    nowFn(),
  );
}

/**
 * Pair the owner with a joiner: derive the X25519 shared secret and insert a
 * paired-device row, so future epoch rotations replicate to B over the engine.
 * Idempotent: if B is already paired, skip (insertPairedDevice would PK-collide).
 */
function pairJoiner(
  db: DatabaseAdapter,
  owner: DeviceIdentity,
  joinerDeviceId: string,
  joinerDisplayName: string,
  joinerDhPublicKey: string,
  now: string,
): void {
  // Already paired? Do not double-insert.
  const existing = db.query<{ device_id: string }>(
    'SELECT device_id FROM sync_paired_devices WHERE device_id = ?',
    [joinerDeviceId],
  );
  if (existing.length > 0) return;

  const dhPrivateKeyHex = extractDhPrivateKeyHex(owner.privateKeyRef);
  if (!dhPrivateKeyHex) return;
  const sharedSecretHex = derivePairingSharedSecret(dhPrivateKeyHex, joinerDhPublicKey);
  // Canonical secret-store ref (NOT the inline local:shared: form): only this ref
  // resolves in BOTH the engine-session path AND the mailbox drain (getSharedSecretHex),
  // so the handoff-paired device is a first-class peer for every flow.
  const sharedSecretRef = storeSharedSecret(owner.publicKey, joinerDeviceId, sharedSecretHex);
  insertPairedDevice(db, {
    deviceId: joinerDeviceId,
    displayName: joinerDisplayName,
    dhPublicKey: joinerDhPublicKey,
    sharedSecretRef,
    lastSeenAt: now,
    lastSyncAt: null,
    lastSyncModule: null,
    bytesSent: 0,
    bytesReceived: 0,
    isActive: true,
    pairedAt: now,
  });
}

/**
 * Collect B's openable key-wrap rows and seal + park the join-grant. Full history
 * packages every epoch 1..current that has a wrap for B; join_point packages only
 * the current epoch. Returns true iff the grant was really parked.
 */
async function parkGrant(
  deps: ProcessJoinRequestDeps,
  signedDescriptor: SignedCommunityDescriptor,
  communityId: string,
  joinerDeviceId: string,
  joinerDhPublicKey: string,
  historyScope: HistoryScope,
  now: string,
): Promise<boolean> {
  const { db, owner, parkEnvelope } = deps;
  const currentEpoch = getWorkspaceEpoch(db, communityId);
  if (currentEpoch < 1) return false;

  const fromEpoch = historyScope === 'full' ? 1 : currentEpoch;
  const wraps: Record<string, unknown>[] = [];
  for (let epoch = fromEpoch; epoch <= currentEpoch; epoch += 1) {
    for (const wrap of getKeyWraps(db, communityId, epoch)) {
      if (wrap.wrappedForDeviceId === joinerDeviceId) {
        wraps.push(keyWrapToSyncedRow(wrap));
      }
    }
  }
  // No openable wrap for B: nothing real to grant (do not park an empty grant).
  if (wraps.length === 0) return false;

  const grantPayload: JoinGrantPayload = {
    kind: JOIN_GRANT_MAILBOX_KIND,
    version: 1,
    communityId,
    descriptor: signedDescriptor,
    keyWraps: wraps,
    ownerBundle: createSignedIdentityBundle(owner),
  };
  const token = deriveCommunityJoinToken(
    signedDescriptor.descriptor.genesisNonce,
    communityId,
    joinerDeviceId,
  );
  const sealed = sealJoinGrantMailbox({
    sender: owner,
    recipient: { deviceId: joinerDeviceId, dhPublicKey: joinerDhPublicKey },
    token,
    payload: grantPayload,
    now,
  });
  const parked = await parkEnvelope(sealed.token, sealed.envelope);
  return parked === true;
}

// ---------------------------------------------------------------------------
// applyJoinGrant (joiner B): the APPLY side handler factory.
// ---------------------------------------------------------------------------

export interface ApplyJoinGrantDeps {
  db: DatabaseAdapter;
  /** This device's identity (the joiner). */
  self: DeviceIdentity;
  /** Clock for pin/pair timestamps (test injection). */
  now?: () => string;
}

/**
 * Build the per-kind join-grant drain handler (the joiner APPLY side). Returns a
 * PARTIAL MailboxEnvelopeHandlers so it composes with the other handlers.
 */
export function applyJoinGrant(
  deps: ApplyJoinGrantDeps,
): Pick<MailboxEnvelopeHandlers, 'joinGrant'> {
  const { db, self } = deps;
  const nowFn = deps.now ?? (() => new Date().toISOString());

  return {
    joinGrant: (senderDeviceId: string, payload: JoinGrantPayload): boolean => {
      const communityId = payload.communityId;
      const descriptor = payload.descriptor.descriptor;

      // a. The grant must name this community, come from the OWNER named in the
      //    descriptor, verify under the owner signature, and LIST me.
      if (descriptor.communityId !== communityId) return false;
      if (senderDeviceId !== descriptor.ownerDeviceId) return false;
      if (!verifyDescriptorOwnerSignature(payload.descriptor)) return false;
      if (communityRole(descriptor, self.publicKey) === null) return false;

      // b. If I already hold this community, a stranger cannot grant me into it
      //    under a DIFFERENT owner.
      const existing = getCommunity(db, communityId);
      if (existing && existing.descriptor.ownerDeviceId !== descriptor.ownerDeviceId) return false;

      // c. Store the new descriptor (now lists me) + bridge the workspace/roster
      //    so the channel-post gate and group membership see me and the others
      //    (joinCommunityFromLink does the same; a cold grant may arrive before it).
      upsertCommunity(db, payload.descriptor, self.publicKey, nowFn());
      if (!getWorkspace(db, communityId)) {
        createWorkspace(db, {
          id: communityId,
          displayName: descriptor.name,
          workspaceType: 'community',
          createdByDeviceId: descriptor.ownerDeviceId,
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
          [communityId, member.deviceId, member.role, descriptor.ownerDeviceId, nowFn()],
        );
      }

      // d. Store each recipient-gated wrap (skip rows that fail to parse OR that
      //    name a DIFFERENT community: a grant for community A must never touch
      //    another community B's epoch state). Only a wrap addressed to me and
      //    openable with my DH key advances my epoch.
      for (const row of payload.keyWraps) {
        const wrap = keyWrapFromSyncedRow(row);
        if (!wrap) continue;
        if (wrap.workspaceId !== communityId) continue;
        storeReceivedKeyWrap(db, wrap, self);
      }

      // e. Pair me <-> owner so the owner's future rotations reach me. The owner
      //    bundle must verify AND name the envelope sender (the descriptor owner).
      const ownerBundle = payload.ownerBundle;
      const pinnedRow = getPinnedIdentity(db, senderDeviceId);
      const trust = evaluateBundleTrust(
        ownerBundle,
        pinnedRow ? { deviceId: pinnedRow.deviceId, dhPublicKey: pinnedRow.dhPublicKey } : null,
      );
      if (
        ownerBundle.bundle.deviceId === senderDeviceId
        && /^[0-9a-f]{64}$/i.test(ownerBundle.bundle.dhPublicKey)
        && trust !== 'invalid_signature'
        && trust !== 'key_changed'
      ) {
        if (trust === 'first_seen') {
          pinIdentity(db, {
            deviceId: senderDeviceId,
            dhPublicKey: ownerBundle.bundle.dhPublicKey,
            displayName: ownerBundle.bundle.displayName,
            bundleJson: JSON.stringify(ownerBundle.bundle),
            bundleSignature: ownerBundle.signature,
            now: nowFn(),
          });
        }
        pairOwner(db, self, senderDeviceId, ownerBundle.bundle.displayName, ownerBundle.bundle.dhPublicKey, nowFn());
      }

      // f. Real success: I can now read the feed (a current epoch key opens).
      return getCurrentEpochKey(db, communityId, self) !== null;
    },
  };
}

/**
 * Pair the joiner with the owner. Idempotent: skip if already paired. Mirrors
 * pairJoiner but from the joiner's side (my DH private key + the owner's DH key).
 */
function pairOwner(
  db: DatabaseAdapter,
  self: DeviceIdentity,
  ownerDeviceId: string,
  ownerDisplayName: string,
  ownerDhPublicKey: string,
  now: string,
): void {
  const existing = db.query<{ device_id: string }>(
    'SELECT device_id FROM sync_paired_devices WHERE device_id = ?',
    [ownerDeviceId],
  );
  if (existing.length > 0) return;

  const dhPrivateKeyHex = extractDhPrivateKeyHex(self.privateKeyRef);
  if (!dhPrivateKeyHex) return;
  const sharedSecretHex = derivePairingSharedSecret(dhPrivateKeyHex, ownerDhPublicKey);
  // Canonical secret-store ref (see pairJoiner): resolvable by the mailbox drain
  // + the engine session, so future epoch rotations from the owner reach me.
  const sharedSecretRef = storeSharedSecret(self.publicKey, ownerDeviceId, sharedSecretHex);
  insertPairedDevice(db, {
    deviceId: ownerDeviceId,
    displayName: ownerDisplayName,
    dhPublicKey: ownerDhPublicKey,
    sharedSecretRef,
    lastSeenAt: now,
    lastSyncAt: null,
    lastSyncModule: null,
    bytesSent: 0,
    bytesReceived: 0,
    isActive: true,
    pairedAt: now,
  });
}
