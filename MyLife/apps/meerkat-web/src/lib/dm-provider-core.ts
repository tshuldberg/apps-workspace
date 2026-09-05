// dm-provider-core.ts (Plan 21 Phase 9, WEB twin of the mobile
// apps/meerkat/app/(root)/data/dm-provider-core.ts): the pure,
// injectable-dependency core behind MeerkatProvider's DM send/receipt methods
// and the dmMessage/dmReceipt drain handlers. Byte-identical logic to the mobile
// file (both depend only on @mylife/db + @mylife/sync + ./dm-core);
// check-meerkat-parity.mjs byte-locks the two.
//
// Mirrors the established pattern (file-request-core.ts,
// history-backfill-core.ts): a DatabaseAdapter + injected identity/relay/park
// dependencies, no native modules, so this file is testable in isolation and
// SHARED verbatim by the foreground drain (SyncProvider.buildDrainHandlers)
// and the background drain (background-sync.ts), so the two cannot drift.
//
// HONESTY (Critical):
//  - A message is 'parked' per recipient device ONLY when a real park() call
//    returned true. No relay configured, the device not usably paired, or a
//    relay attempt that fails to park, all leave the row 'queued' (never a
//    fabricated success). Nothing here ever writes 'delivered' or 'read' --
//    those states are set ONLY by the dmReceipt drain handler, backed by a
//    real, independently-verified inbound receipt signature (setDmDelivery
//    already stores that signature for audit).
//  - The own-device mirror re-seals the SAME signed event/receipt to this
//    user's OTHER paired devices (from dm_own_devices), so a real pairing
//    secret is required for each; with no linked own device this is a
//    genuine no-op (zero extra seals, zero extra parks).
//  - The inbound dmReceipt handler additionally re-seals a receipt it just
//    applied onward to this user's own OTHER devices (the original sender
//    only addressed THIS device's mailbox, so without this relay the user's
//    other devices would never learn the delivery/read state).

import type { DatabaseAdapter } from '@mylife/db';
import {
  applyDmGroupCommit,
  applySignedRevocation,
  assembleGrantBlocks,
  blobContentHash,
  createDmGroup,
  createDmMessage,
  createDmReceipt,
  createDmShred,
  createSignedIdentityBundle,
  createSignedRevocation,
  decryptDmGroupEvents,
  deriveMailboxToken,
  mailboxSealNowMs,
  dmGroupAdd,
  dmGroupRemove,
  getCurrentEpochKey,
  getKeyWraps,
  isDeviceRevoked,
  nextHlc,
  sealDmDirect,
  sealDmGroup,
  sealDmGroupCommit,
  sealDmReceipt,
  sealDmShred,
  sha512Hex,
  unwrapEpochSecret,
  verifyDmGroupDescriptor,
  type BlobDataPayload,
  type DeviceIdentity,
  type DmDirectRecipient,
  type DmGroupCommitRecipient,
  type DmGroupMember,
  type DmMessageAttachment,
  type DmMessageEvent,
  type DmReceiptEvent,
  type DmReceiptState,
  type DmShredEvent,
  type MailboxEnvelope,
  type MailboxEnvelopeHandlers,
  type SignedDmGroupDescriptor,
} from '@mylife/sync';
import {
  deleteDmMessageRow,
  ensureDmTables,
  getDmConversation,
  getDmDelivery,
  getDmMessageRow,
  getDmReadState,
  highestDmHlc,
  listDmConversations,
  listDmParticipants,
  mergeDmEvents,
  recordDmReport,
  resolveOwnDeviceMirrorTargets,
  setDmDelivery,
  setDmParticipantRemoved,
  upsertDmConversation,
  upsertDmOwnDevice,
  upsertDmParticipant,
  type DmDeliveryState,
  type DmOwnDeviceRow,
} from './dm-core';

/** Resolve a device's pairing shared secret (hex), or null when not usably paired. */
export type ResolvePairSecret = (deviceId: string) => string | null;

/** Park an already-sealed envelope on a mailbox token. Returns true iff it really parked. */
export type ParkEnvelopeFn = (token: string, envelope: MailboxEnvelope) => boolean | Promise<boolean>;

/** Resolve a paired device's DH public key (for bootstrapping a new participant row). */
export type ResolvePeerDhKey = (deviceId: string) => string | null;

// ---------------------------------------------------------------------------
// Send: queueDmMessage
// ---------------------------------------------------------------------------

export interface QueueDmDeviceOutcome {
  deviceId: string;
  parked: boolean;
}

export interface QueueDmMessageDeps {
  db: DatabaseAdapter;
  identity: DeviceIdentity;
  conversationId: string;
  body: string;
  attachments?: DmMessageAttachment[];
  /** Attachment blob blocks referenced by the message (splitBlobForTransfer output). */
  blocks?: readonly BlobDataPayload[];
  /** Whether a relay is actually configured/reachable right now (effectiveRelayUrl). */
  relayAvailable: boolean;
  resolvePairSecret: ResolvePairSecret;
  parkEnvelope: ParkEnvelopeFn;
  now?: () => string;
}

export interface QueueDmMessageResult {
  ok: true;
  event: DmMessageEvent;
  /** One outcome per non-self participant device (the real peer fan-out). */
  recipients: QueueDmDeviceOutcome[];
  /** One outcome per linked own device (the convergence fan-out). Empty with no link. */
  ownDeviceMirrors: QueueDmDeviceOutcome[];
}

async function sealAndParkToTargets(
  identity: DeviceIdentity,
  conversationId: string,
  event: DmMessageEvent,
  targets: readonly { deviceId: string; dhPublicKey: string }[],
  relayAvailable: boolean,
  resolvePairSecret: ResolvePairSecret,
  parkEnvelope: ParkEnvelopeFn,
  blocks?: readonly BlobDataPayload[],
  now?: string,
): Promise<QueueDmDeviceOutcome[]> {
  if (targets.length === 0) return [];
  if (!relayAvailable) return targets.map((t) => ({ deviceId: t.deviceId, parked: false }));

  const outcomes: QueueDmDeviceOutcome[] = [];
  const usable: DmDirectRecipient[] = [];
  for (const target of targets) {
    const pairSecret = resolvePairSecret(target.deviceId);
    if (!pairSecret) {
      outcomes.push({ deviceId: target.deviceId, parked: false });
      continue;
    }
    usable.push({ deviceId: target.deviceId, dhPublicKey: target.dhPublicKey, pairSecret });
  }
  if (usable.length === 0) return outcomes;

  const sealed = sealDmDirect({ sender: identity, conversationId, events: [event], recipients: usable, blocks, now });
  if (!sealed.ok) {
    for (const target of usable) outcomes.push({ deviceId: target.deviceId, parked: false });
    return outcomes;
  }

  for (const item of sealed.sealed) {
    const parked = await parkEnvelope(item.token, item.envelope);
    outcomes.push({ deviceId: item.recipientDeviceId, parked: parked === true });
  }
  return outcomes;
}

/**
 * Build + locally echo a signed DM event, then seal + park it to every peer
 * participant device AND (separately) to this user's own other paired devices.
 * The local echo is written FIRST (optimistic), before any network attempt, so
 * the composer's own view is never blocked on relay reachability.
 */
export async function queueDmMessageCore(deps: QueueDmMessageDeps): Promise<QueueDmMessageResult> {
  const nowFn = deps.now ?? (() => new Date().toISOString());
  const nowIso = nowFn();
  const { db, identity, conversationId, body, attachments } = deps;

  ensureDmTables(db);

  const hlc = nextHlc(highestDmHlc(db, conversationId), nowIso);
  const event = createDmMessage(identity, { conversationId, body, attachments, hlc });

  // Optimistic local echo before any network attempt.
  mergeDmEvents(db, conversationId, [event]);

  // Group conversations seal the SAME signed event under the current epoch content
  // key (sealDmGroup) and fan out to members from the admin-signed descriptor, not
  // the raw participant roster (so a removed member is never addressed).
  const conversation = getDmConversation(db, conversationId);
  if (conversation?.kind === 'group') {
    const recipients = await sealAndParkGroupMessage(
      db, identity, conversationId, event,
      deps.relayAvailable, deps.resolvePairSecret, deps.parkEnvelope, deps.blocks, nowIso,
    );
    for (const outcome of recipients) {
      const state: DmDeliveryState = outcome.parked ? 'parked' : 'queued';
      setDmDelivery(db, event.id, outcome.deviceId, state, nowIso);
    }
    // Any of this user's other devices that are group members are already in the
    // descriptor and receive the delta above, so a group has no separate mirror.
    return { ok: true, event, recipients, ownDeviceMirrors: [] };
  }

  const participantTargets = listDmParticipants(db, conversationId)
    .filter((p) => p.is_self === 0 && !isDeviceRevoked(db, p.device_id))
    .map((p) => ({ deviceId: p.device_id, dhPublicKey: p.dh_public_key }));

  const recipients = await sealAndParkToTargets(
    identity, conversationId, event, participantTargets,
    deps.relayAvailable, deps.resolvePairSecret, deps.parkEnvelope, deps.blocks, nowIso,
  );
  for (const outcome of recipients) {
    const state: DmDeliveryState = outcome.parked ? 'parked' : 'queued';
    setDmDelivery(db, event.id, outcome.deviceId, state, nowIso);
  }

  const ownTargets = resolveOwnDeviceMirrorTargets(db, identity.publicKey)
    .map((d) => ({ deviceId: d.device_id, dhPublicKey: d.dh_public_key }));
  const ownDeviceMirrors = await sealAndParkToTargets(
    identity, conversationId, event, ownTargets,
    deps.relayAvailable, deps.resolvePairSecret, deps.parkEnvelope, deps.blocks, nowIso,
  );

  return { ok: true, event, recipients, ownDeviceMirrors };
}

// ---------------------------------------------------------------------------
// Send: queueDmReceipt
// ---------------------------------------------------------------------------

export type QueueDmReceiptResult =
  | {
      ok: true;
      skipped: false;
      /** Whether the receipt really parked to the message's author device. */
      authorParked: boolean;
      /** One outcome per linked own device. Empty with no link. */
      ownDeviceMirrors: QueueDmDeviceOutcome[];
    }
  | { ok: true; skipped: true; reason: 'read_receipts_disabled' | 'self_authored' | 'message_unknown' };

export interface QueueDmReceiptDeps {
  db: DatabaseAdapter;
  identity: DeviceIdentity;
  conversationId: string;
  messageId: string;
  state: DmReceiptState;
  relayAvailable: boolean;
  resolvePairSecret: ResolvePairSecret;
  parkEnvelope: ParkEnvelopeFn;
  now?: () => string;
}

async function sealReceiptAndPark(
  identity: DeviceIdentity,
  receipt: DmReceiptEvent,
  target: { deviceId: string; dhPublicKey: string },
  relayAvailable: boolean,
  resolvePairSecret: ResolvePairSecret,
  parkEnvelope: ParkEnvelopeFn,
  now: string,
): Promise<boolean> {
  if (!relayAvailable) return false;
  const pairSecret = resolvePairSecret(target.deviceId);
  if (!pairSecret) return false;
  const sealed = sealDmReceipt({
    sender: identity,
    recipient: { deviceId: target.deviceId, dhPublicKey: target.dhPublicKey },
    pairSharedSecretHex: pairSecret,
    receipt,
    now,
  });
  const parked = await parkEnvelope(sealed.token, sealed.envelope);
  return parked === true;
}

/**
 * Build a signed delivery/read receipt for a message and park it to the
 * message's author device, plus mirror it to this user's own other devices.
 * Honors the conversation's read_receipts_enabled: a 'read' receipt is never
 * built or sent when the conversation has read receipts disabled.
 */
export async function queueDmReceiptCore(deps: QueueDmReceiptDeps): Promise<QueueDmReceiptResult> {
  const nowFn = deps.now ?? (() => new Date().toISOString());
  const nowIso = nowFn();
  const { db, identity, conversationId, messageId, state } = deps;

  ensureDmTables(db);

  if (state === 'read' && getDmReadState(db, conversationId).read_receipts_enabled === 0) {
    return { ok: true, skipped: true, reason: 'read_receipts_disabled' };
  }

  const message = getDmMessageRow(db, messageId);
  if (!message || message.conversation_id !== conversationId) {
    return { ok: true, skipped: true, reason: 'message_unknown' };
  }
  if (message.author_device_id === identity.publicKey) {
    return { ok: true, skipped: true, reason: 'self_authored' };
  }

  const receipt = createDmReceipt(identity, { conversationId, messageId, state, at: nowIso });

  // Revoked-recipient filter (Plan 21 Phase 10, item 4): never address a receipt
  // envelope to a blocked/revoked author, exactly as the message send paths filter
  // revoked recipients. This is engine-path defense-in-depth: it holds no matter
  // which caller emits (thread-open, delivered-on-drain, or a future path), not
  // just the per-thread UI's isBlocked gate. Own-device mirrors below are this
  // user's OWN devices (never revoked) and address only self.
  const authorParticipant = isDeviceRevoked(db, message.author_device_id)
    ? undefined
    : listDmParticipants(db, conversationId).find((p) => p.device_id === message.author_device_id);
  const authorParked = authorParticipant
    ? await sealReceiptAndPark(
        identity, receipt,
        { deviceId: authorParticipant.device_id, dhPublicKey: authorParticipant.dh_public_key },
        deps.relayAvailable, deps.resolvePairSecret, deps.parkEnvelope, nowIso,
      )
    : false;

  const ownDeviceMirrors: QueueDmDeviceOutcome[] = [];
  for (const own of resolveOwnDeviceMirrorTargets(db, identity.publicKey)) {
    const parked = await sealReceiptAndPark(
      identity, receipt,
      { deviceId: own.device_id, dhPublicKey: own.dh_public_key },
      deps.relayAvailable, deps.resolvePairSecret, deps.parkEnvelope, nowIso,
    );
    ownDeviceMirrors.push({ deviceId: own.device_id, parked });
  }

  return { ok: true, skipped: false, authorParked, ownDeviceMirrors };
}

// ---------------------------------------------------------------------------
// linkOwnDevice
// ---------------------------------------------------------------------------

export interface LinkOwnDeviceInput {
  deviceId: string;
  identityAnchor: string;
  dhPublicKey: string;
}

/**
 * Record another device of this SAME user as a mirror target (the pairing
 * secret already exists via the normal Meerkat device-pairing flow; this only
 * marks the relationship for DM fan-out). Also adds a self-participant row for
 * this device on every conversation this user already participates in, so the
 * participant list stays accurate without waiting for a future message.
 */
export function linkOwnDeviceCore(db: DatabaseAdapter, input: LinkOwnDeviceInput, now: string = new Date().toISOString()): DmOwnDeviceRow {
  ensureDmTables(db);
  const row: DmOwnDeviceRow = {
    device_id: input.deviceId,
    identity_anchor: input.identityAnchor,
    dh_public_key: input.dhPublicKey,
    linked_at: now,
  };
  upsertDmOwnDevice(db, row);

  for (const conversation of listDmConversations(db, { includeArchived: true })) {
    const existing = listDmParticipants(db, conversation.id, { includeRemoved: true });
    const iAmAParticipant = existing.some((p) => p.is_self === 1);
    const alreadyListed = existing.some((p) => p.device_id === input.deviceId);
    if (iAmAParticipant && !alreadyListed) {
      upsertDmParticipant(db, {
        conversation_id: conversation.id,
        device_id: input.deviceId,
        identity_anchor: input.identityAnchor,
        is_self: 1,
        role: 'member',
        dh_public_key: input.dhPublicKey,
        joined_at: now,
        removed_at: null,
      });
    }
  }

  return row;
}

// ---------------------------------------------------------------------------
// Attachments (Plan 21 Phase 8): verify-then-pin.
// ---------------------------------------------------------------------------

/** Pin verified blob bytes into the blob store (blobStore.put re-verifies the hash). */
export type PinBlobFn = (hash: string, bytes: Uint8Array, mimeType: string | null) => void | Promise<void>;

/**
 * Verify-then-pin attachment blobs carried alongside verified DM events. Only a
 * blob HASH referenced by one of the (already signature-verified) events is
 * considered; its blocks are reassembled and hash-checked before pinBlob is
 * called (which re-verifies the hash and throws on mismatch), so a tampered or
 * unreferenced block is NEVER pinned. An incomplete block set is skipped (a later
 * re-request pulls it). Returns the number of blobs pinned.
 */
export async function verifyAndPinDmAttachments(
  events: readonly DmMessageEvent[],
  blocks: readonly BlobDataPayload[],
  pinBlob: PinBlobFn,
): Promise<number> {
  const wantedMime = new Map<string, string | null>();
  for (const event of events) {
    for (const attachment of event.attachments ?? []) {
      wantedMime.set(attachment.blobHash, attachment.mimeType ?? null);
    }
  }
  if (wantedMime.size === 0 || blocks.length === 0) return 0;

  const byHash = new Map<string, BlobDataPayload[]>();
  for (const block of blocks) {
    if (!wantedMime.has(block.hash)) continue; // ignore blocks no verified event references
    const arr = byHash.get(block.hash) ?? [];
    arr.push(block);
    byHash.set(block.hash, arr);
  }

  let pinned = 0;
  for (const [hash, hashBlocks] of byHash) {
    const bytes = assembleGrantBlocks(hashBlocks);
    if (!bytes) continue; // incomplete: a re-request pulls the rest later
    if (blobContentHash(bytes) !== hash) continue; // fail-closed: tampered bytes never pinned
    try {
      await pinBlob(hash, bytes, wantedMime.get(hash) ?? null);
      pinned += 1;
    } catch {
      // pinBlob (blobStore.put) re-verifies the hash and throws on mismatch: never pin junk.
    }
  }
  return pinned;
}

// ---------------------------------------------------------------------------
// Drain (receive): the dmMessage / dmReceipt handler pair
// ---------------------------------------------------------------------------

export interface BuildDmMailboxHandlersDeps {
  db: DatabaseAdapter;
  /** This device's identity (used to bootstrap the self participant row). */
  identity: DeviceIdentity;
  /** Resolve a paired device's DH public key (bootstraps a new participant row). */
  resolvePeerDhKey: ResolvePeerDhKey;
  resolvePairSecret: ResolvePairSecret;
  parkEnvelope: ParkEnvelopeFn;
  /** Verify-then-pin attachment blobs into the blob store (omit to skip pinning). */
  pinAttachments?: PinBlobFn;
  now?: () => string;
}

function bootstrapConversationAndSelf(
  db: DatabaseAdapter,
  identity: DeviceIdentity,
  conversationId: string,
  createdAt: string,
): void {
  if (!getDmConversation(db, conversationId)) {
    upsertDmConversation(db, {
      id: conversationId,
      kind: 'direct',
      title: null,
      group_workspace_id: null,
      admin_device_id: null,
      current_epoch: 0,
      descriptor_json: null,
      feed_opt_in: 0,
      archived: 0,
      muted: 0,
      created_at: createdAt,
      updated_at: createdAt,
    });
  }

  const participants = listDmParticipants(db, conversationId, { includeRemoved: true });
  if (!participants.some((p) => p.device_id === identity.publicKey)) {
    upsertDmParticipant(db, {
      conversation_id: conversationId,
      device_id: identity.publicKey,
      identity_anchor: identity.publicKey,
      is_self: 1,
      role: 'member',
      dh_public_key: identity.dhPublicKey,
      joined_at: createdAt,
      removed_at: null,
    });
  }
}

function bootstrapSenderParticipant(
  db: DatabaseAdapter,
  senderDeviceId: string,
  conversationId: string,
  resolvePeerDhKey: ResolvePeerDhKey,
  createdAt: string,
): void {
  const participants = listDmParticipants(db, conversationId, { includeRemoved: true });
  if (participants.some((p) => p.device_id === senderDeviceId)) return;
  const dhPublicKey = resolvePeerDhKey(senderDeviceId);
  if (!dhPublicKey) return; // Unknown DH key: skip the row, still merge the (independently verified) event.
  upsertDmParticipant(db, {
    conversation_id: conversationId,
    device_id: senderDeviceId,
    identity_anchor: senderDeviceId,
    is_self: 0,
    role: 'member',
    dh_public_key: dhPublicKey,
    joined_at: createdAt,
    removed_at: null,
  });
}

/**
 * Decide which just-applied inbound messages warrant a 'delivered' receipt on
 * drain. Pure + fail-closed. A receipt is planned for a peer-authored message
 * this device actually inserted this pass; NEVER for THIS device's own message
 * (author === self), NEVER for a message one of this user's OTHER linked devices
 * authored (isOwnDevice: a mirrored copy of my own message carries a different
 * author key but the same identity anchor, so the self check alone misses it),
 * and NEVER for a blocked/revoked author (a mirror of the send path's revoked
 * filter). The caller passes only the events the merge inserted this pass, so a
 * re-drain (which inserts nothing) plans nothing and no second receipt is emitted
 * (persisted-state dedup, TC-6).
 *
 * This is the EMIT-layer honesty guarantee (Plan 21 Phase 10 Fix 1): the own-device
 * skip lives here, not only in the display filter, so no signed receipt is ever
 * produced for my own message on any device.
 *
 * NC-5 boundary (delivered vs read): the per-conversation read_receipts_enabled
 * setting is READ-ONLY by design. It governs only the 'read' state
 * (queueDmReceiptCore skips a 'read' receipt when disabled, and the thread-open
 * path computeDmReceiptsToEmit downgrades read->delivered rather than suppressing
 * it). A 'delivered' receipt is a separate, always-honest "the bytes landed"
 * proof, so delivered-on-drain is emitted unconditionally by design; disabling
 * read receipts is still a real privacy guarantee for the 'read' state only.
 */
export function planDrainDeliveredReceipts(
  self: DeviceIdentity,
  insertedEvents: readonly DmMessageEvent[],
  isOwnDevice: (deviceId: string) => boolean,
  isBlocked: (deviceId: string) => boolean,
): { messageId: string; authorDeviceId: string }[] {
  const seen = new Set<string>();
  const plans: { messageId: string; authorDeviceId: string }[] = [];
  for (const event of insertedEvents) {
    if (event.authorDeviceId === self.publicKey) continue; // never receipt my own message
    if (isOwnDevice(event.authorDeviceId)) continue; // never receipt my own device's mirrored copy
    if (isBlocked(event.authorDeviceId)) continue; // a blocked peer gets NOTHING
    if (seen.has(event.id)) continue;
    seen.add(event.id);
    plans.push({ messageId: event.id, authorDeviceId: event.authorDeviceId });
  }
  return plans;
}

/** The subset of `events` that already have a persisted dm_messages row (read from the DB, not memory). */
function existingDmMessageIds(db: DatabaseAdapter, events: readonly DmMessageEvent[]): Set<string> {
  const ids = new Set<string>();
  for (const event of events) {
    if (getDmMessageRow(db, event.id)) ids.add(event.id);
  }
  return ids;
}

/** Events newly persisted by this merge pass: present now, absent before, so verified + inserted. */
function newlyInsertedDmEvents(
  db: DatabaseAdapter,
  events: readonly DmMessageEvent[],
  preExistingIds: ReadonlySet<string>,
): DmMessageEvent[] {
  return events.filter((event) => !preExistingIds.has(event.id) && getDmMessageRow(db, event.id) !== null);
}

/**
 * Emit a real, signed 'delivered' receipt for every message this drain pass just
 * inserted (delivered-on-drain, Plan 21 Phase 10 item 2). Runs through the SAME
 * queueDmReceiptCore park discipline as the thread-open path, so a receipt is only
 * ever a verifiable signed proof and only converges the sender on a real park. The
 * decision is the pure planDrainDeliveredReceipts; the loop is the only impure part.
 * relayAvailable is true here because a drain runs only over a live relay; the real
 * park (parkEnvelope) remains the honest gate (it returns false if the relay drops).
 */
async function emitDrainDeliveredReceipts(
  db: DatabaseAdapter,
  identity: DeviceIdentity,
  conversationId: string,
  insertedEvents: readonly DmMessageEvent[],
  resolvePairSecret: ResolvePairSecret,
  parkEnvelope: ParkEnvelopeFn,
  now: () => string,
): Promise<void> {
  // Fix 3 hardening: the plan step (which now reads dm_own_devices + revocations)
  // must NEVER undo the message application that already succeeded. A throw here
  // degrades honestly to the lower state instead of failing the drain.
  let plans: { messageId: string; authorDeviceId: string }[];
  try {
    const ownDeviceIds = new Set(
      resolveOwnDeviceMirrorTargets(db, identity.publicKey).map((d) => d.device_id),
    );
    plans = planDrainDeliveredReceipts(
      identity,
      insertedEvents,
      (id) => ownDeviceIds.has(id),
      (id) => isDeviceRevoked(db, id),
    );
  } catch {
    return; // honest degradation to the lower state, never a failed drain
  }
  for (const plan of plans) {
    // Best-effort, exactly like the thread-open receipt loop: a receipt that
    // cannot build or park must NEVER undo the message application that already
    // succeeded (the bytes truly landed). The sender simply stays at "Sent".
    try {
      await queueDmReceiptCore({
        db,
        identity,
        conversationId,
        messageId: plan.messageId,
        state: 'delivered',
        relayAvailable: true,
        resolvePairSecret,
        parkEnvelope,
        now,
      });
    } catch {
      // Swallow: honest degradation to the lower state, never a failed drain.
    }
  }
}

/**
 * Build the dmMessage + dmReceipt drain handlers. Returns a PARTIAL
 * MailboxEnvelopeHandlers so it composes with the channel/file/history/join
 * handlers, exactly like buildFileMailboxHandlers / buildHistoryBackfillHandlers.
 * SHARED verbatim by SyncProvider.buildDrainHandlers and background-sync.ts so
 * the foreground and background drains cannot diverge on DM handling (TC-8): the
 * delivered-on-drain emission lives inside this shared builder, so both drains run
 * the identical decision + park path with zero drift.
 */
export function buildDmMailboxHandlers(
  deps: BuildDmMailboxHandlersDeps,
): Pick<MailboxEnvelopeHandlers, 'dmMessage' | 'dmReceipt'> {
  const { db, identity, resolvePeerDhKey, resolvePairSecret, parkEnvelope, pinAttachments } = deps;
  const nowFn = deps.now ?? (() => new Date().toISOString());

  return {
    dmMessage: async (senderDeviceId, opened) => {
      ensureDmTables(db);
      const createdAt = opened.createdAt ?? nowFn();

      // Group delta: the events are epoch-content-key-sealed, so decrypt with this
      // device's own epoch secret. A device holding no wrap for `epoch` (not yet
      // converged, or removed) gets NOTHING (fail-closed) and the envelope re-drains
      // on a later pass. The group conversation + roster already exist here because
      // holding an epoch key means a DM_GROUP_COMMIT converged first.
      if (opened.mode === 'group') {
        if (opened.epoch == null || !opened.sealedEvents) return false;
        const secret = unwrapEpochSecret(db, opened.conversationId, opened.epoch, identity);
        if (!secret) return false;
        const events = decryptDmGroupEvents(
          { conversationId: opened.conversationId, epoch: opened.epoch, sealedEvents: opened.sealedEvents },
          secret,
        );
        if (!events || events.length === 0) return false;
        const preExisting = existingDmMessageIds(db, events);
        const merged = mergeDmEvents(db, opened.conversationId, events);
        if (pinAttachments) await verifyAndPinDmAttachments(events, opened.blocks, pinAttachments);
        await emitDrainDeliveredReceipts(
          db, identity, opened.conversationId,
          newlyInsertedDmEvents(db, events, preExisting),
          resolvePairSecret, parkEnvelope, nowFn,
        );
        return merged.inserted > 0;
      }

      bootstrapConversationAndSelf(db, identity, opened.conversationId, createdAt);
      bootstrapSenderParticipant(db, senderDeviceId, opened.conversationId, resolvePeerDhKey, createdAt);
      const preExisting = existingDmMessageIds(db, opened.events);
      const merged = mergeDmEvents(db, opened.conversationId, opened.events);
      if (pinAttachments) await verifyAndPinDmAttachments(opened.events, opened.blocks, pinAttachments);
      await emitDrainDeliveredReceipts(
        db, identity, opened.conversationId,
        newlyInsertedDmEvents(db, opened.events, preExisting),
        resolvePairSecret, parkEnvelope, nowFn,
      );
      return merged.inserted > 0;
    },

    dmReceipt: async (senderDeviceId, opened) => {
      ensureDmTables(db);
      const { messageId, state, recipientDeviceId } = opened.receipt;
      const before = getDmDelivery(db, messageId).find((r) => r.peer_device_id === recipientDeviceId) ?? null;
      const after = setDmDelivery(db, messageId, recipientDeviceId, state, opened.createdAt, opened.receipt.signature);
      const applied = !before || after.state !== before.state || after.state_at !== before.state_at;

      if (applied) {
        // Re-seal onward to this user's OTHER own devices so they converge:
        // the original signer only addressed THIS device's mailbox.
        for (const own of resolveOwnDeviceMirrorTargets(db, identity.publicKey)) {
          if (own.device_id === senderDeviceId) continue;
          await sealReceiptAndPark(
            identity,
            opened.receipt,
            { deviceId: own.device_id, dhPublicKey: own.dh_public_key },
            true, resolvePairSecret, parkEnvelope, nowFn(),
          );
        }
      }

      return applied;
    },
  };
}

// ---------------------------------------------------------------------------
// Group DMs (Plan 21 Phase 6 primitives -> Phase 7 provider).
//
// A group DM is an admin-signed SignedDmGroupDescriptor backed by a real epoch
// key (createDmGroup / dmGroupAdd / dmGroupRemove in @mylife/sync, each with NO
// recordChange so the wraps never replicate - NC-9). Members learn each new epoch
// ONLY through an explicit per-recipient DM_GROUP_COMMIT handoff parked on the
// conversation-scoped deriveDmGroupCommitToken mailbox. Group MESSAGES ride the
// same DM_MESSAGE_MAILBOX_KIND as 1:1, epoch-content-key-sealed under the current
// epoch (sealDmGroup), fanned per member over each member's pair-private token.
//
// HONESTY: a group message is 'parked' per member device only on a real park; no
// relay, no epoch key (not converged / removed), or no pair secret for a member
// all leave that device 'queued'. The signed descriptor persisted in
// dm_conversations.descriptor_json is the AUTHORITATIVE membership: message
// recipients come from it, never the raw dm_participants roster, so a removed
// member is never addressed. applyDmGroupCommit reconciles the local roster
// against it (prunes removed members).

/** One member device's handoff-park outcome. */
export interface DmGroupHandoffOutcome {
  deviceId: string;
  parked: boolean;
}

export type DmGroupMutationRejectReason =
  | 'conversation_unknown'
  | 'not_a_group'
  | 'descriptor_invalid'
  | 'not_admin';

/** Parse + verify the persisted admin-signed descriptor for a group conversation. */
function readGroupDescriptor(db: DatabaseAdapter, conversationId: string): SignedDmGroupDescriptor | null {
  const conv = getDmConversation(db, conversationId);
  if (!conv || conv.kind !== 'group' || !conv.descriptor_json) return null;
  let descriptor: SignedDmGroupDescriptor;
  try {
    descriptor = JSON.parse(conv.descriptor_json) as SignedDmGroupDescriptor;
  } catch {
    return null;
  }
  return verifyDmGroupDescriptor(descriptor) ? descriptor : null;
}

/** The current member set from the persisted, verified descriptor (empty if absent/invalid). */
function readGroupDescriptorMembers(db: DatabaseAdapter, conversationId: string): DmGroupMember[] {
  return readGroupDescriptor(db, conversationId)?.members ?? [];
}

/**
 * Persist the admin-signed descriptor as the authoritative local group state:
 * the dm_conversations row (kind, title, admin, current_epoch, descriptor_json)
 * and the dm_participants roster reconciled against descriptor.members - added
 * members upserted, members no longer listed marked removed. created_at,
 * joined_at, feed/archive/mute flags are preserved across updates.
 */
function persistGroupConversationAndRoster(
  db: DatabaseAdapter,
  identity: DeviceIdentity,
  descriptor: SignedDmGroupDescriptor,
  epoch: number,
  now: string,
): void {
  const conversationId = descriptor.conversationId;
  const existing = getDmConversation(db, conversationId);
  upsertDmConversation(db, {
    id: conversationId,
    kind: 'group',
    title: descriptor.title,
    group_workspace_id: conversationId,
    admin_device_id: descriptor.adminDeviceId,
    current_epoch: epoch,
    descriptor_json: JSON.stringify(descriptor),
    feed_opt_in: existing?.feed_opt_in ?? 0,
    archived: existing?.archived ?? 0,
    muted: existing?.muted ?? 0,
    created_at: existing?.created_at ?? now,
    updated_at: now,
  });

  const priorParticipants = new Map(
    listDmParticipants(db, conversationId, { includeRemoved: true }).map((p) => [p.device_id, p]),
  );
  const memberIds = new Set(descriptor.members.map((m) => m.deviceId));
  for (const m of descriptor.members) {
    const prior = priorParticipants.get(m.deviceId);
    upsertDmParticipant(db, {
      conversation_id: conversationId,
      device_id: m.deviceId,
      identity_anchor: prior?.identity_anchor ?? m.deviceId,
      is_self: m.deviceId === identity.publicKey ? 1 : 0,
      role: m.role === 'admin' ? 'admin' : 'member',
      dh_public_key: m.dhPublicKey,
      joined_at: prior?.joined_at ?? now,
      removed_at: null,
    });
  }
  for (const [deviceId, prior] of priorParticipants) {
    if (!memberIds.has(deviceId) && prior.removed_at === null) {
      setDmParticipantRemoved(db, conversationId, deviceId, now);
    }
  }
}

/**
 * Seal a DM_GROUP_COMMIT epoch handoff to each recipient member device and park
 * it on TWO mailbox tokens:
 *  - the conversation-scoped dm-group token (steady state: converged members poll
 *    deriveDmGroupCommitToken from their persisted state), and
 *  - the member's pair-private token (bootstrap: a member not yet tracking this
 *    conversation cannot derive the conversation token, but the normal peer drain
 *    already polls deriveMailboxToken(pairSecret, self), so this is how a NEWLY
 *    added member ever learns the group exists). The same sealed envelope is used
 *    for both; applyDmGroupCommit is idempotent, so a double delivery is deduped.
 * The recipient's wrap rows for `epoch` are read from this device's
 * sync_workspace_keys (freshly minted by the commit). Honest: no relay ->
 * parked:false for every recipient. (Known metadata tradeoff: parking the same
 * ciphertext on both tokens lets the relay correlate the conversation token to a
 * pair by size + timing; padding/jitter hardening is deferred to Plan 27.)
 */
async function sealAndParkGroupHandoff(
  db: DatabaseAdapter,
  identity: DeviceIdentity,
  conversationId: string,
  descriptor: SignedDmGroupDescriptor,
  epoch: number,
  recipientMembers: readonly DmGroupMember[],
  relayAvailable: boolean,
  resolvePairSecret: ResolvePairSecret,
  parkEnvelope: ParkEnvelopeFn,
  now?: string,
): Promise<DmGroupHandoffOutcome[]> {
  if (recipientMembers.length === 0) return [];
  if (!relayAvailable) return recipientMembers.map((m) => ({ deviceId: m.deviceId, parked: false }));

  const allWraps = getKeyWraps(db, conversationId, epoch);
  const recipients: DmGroupCommitRecipient[] = recipientMembers.map((m) => ({
    deviceId: m.deviceId,
    dhPublicKey: m.dhPublicKey,
    keyWraps: allWraps.filter((w) => w.wrappedForDeviceId === m.deviceId),
  }));
  const sealed = sealDmGroupCommit({
    admin: identity,
    conversationId,
    descriptor,
    adminBundle: createSignedIdentityBundle(identity),
    recipients,
  });
  const byDevice = new Map(sealed.map((s) => [s.recipientDeviceId, s]));

  const outcomes: DmGroupHandoffOutcome[] = [];
  for (const m of recipientMembers) {
    const item = byDevice.get(m.deviceId);
    if (!item) {
      outcomes.push({ deviceId: m.deviceId, parked: false });
      continue;
    }
    let parked = (await parkEnvelope(item.token, item.envelope)) === true;
    const pairSecret = resolvePairSecret(m.deviceId);
    if (pairSecret) {
      const pairParked = (await parkEnvelope(deriveMailboxToken(pairSecret, m.deviceId, mailboxSealNowMs(now)), item.envelope)) === true;
      parked = parked || pairParked;
    }
    outcomes.push({ deviceId: m.deviceId, parked });
  }
  return outcomes;
}

/** Seal + park a group MESSAGE to the descriptor's members (never the raw roster). */
async function sealAndParkGroupMessage(
  db: DatabaseAdapter,
  identity: DeviceIdentity,
  conversationId: string,
  event: DmMessageEvent,
  relayAvailable: boolean,
  resolvePairSecret: ResolvePairSecret,
  parkEnvelope: ParkEnvelopeFn,
  blocks?: readonly BlobDataPayload[],
  now?: string,
): Promise<QueueDmDeviceOutcome[]> {
  // Recipients from the admin-signed descriptor, minus self and anyone this device
  // has locally blocked (revoked): I never send to someone I blocked.
  const targets = readGroupDescriptorMembers(db, conversationId)
    .filter((m) => m.deviceId !== identity.publicKey && !isDeviceRevoked(db, m.deviceId));
  if (targets.length === 0) return [];
  if (!relayAvailable) return targets.map((m) => ({ deviceId: m.deviceId, parked: false }));

  // The content key is this device's CURRENT epoch secret. Without it (not
  // converged, or removed) nothing seals: honest parked:false for every member.
  const epochKey = getCurrentEpochKey(db, conversationId, identity);
  if (!epochKey) return targets.map((m) => ({ deviceId: m.deviceId, parked: false }));

  const outcomes: QueueDmDeviceOutcome[] = [];
  const usable: DmDirectRecipient[] = [];
  for (const target of targets) {
    const pairSecret = resolvePairSecret(target.deviceId);
    if (!pairSecret) {
      outcomes.push({ deviceId: target.deviceId, parked: false });
      continue;
    }
    usable.push({ deviceId: target.deviceId, dhPublicKey: target.dhPublicKey, pairSecret });
  }
  if (usable.length === 0) return outcomes;

  const sealed = sealDmGroup({
    sender: identity,
    conversationId,
    epoch: epochKey.epoch,
    epochSecret: epochKey.secret,
    events: [event],
    recipients: usable,
    blocks,
    now,
  });
  if (!sealed.ok) {
    for (const t of usable) outcomes.push({ deviceId: t.deviceId, parked: false });
    return outcomes;
  }
  for (const item of sealed.sealed) {
    const parked = await parkEnvelope(item.token, item.envelope);
    outcomes.push({ deviceId: item.recipientDeviceId, parked: parked === true });
  }
  return outcomes;
}

export interface CreateDmGroupCoreDeps {
  db: DatabaseAdapter;
  identity: DeviceIdentity;
  title: string;
  /** The other members (deviceId + X25519 dhPublicKey). The admin is added automatically. */
  members: DmGroupMember[];
  relayAvailable: boolean;
  /** Resolve a member's pairing secret so the handoff also parks on its pair-private mailbox (bootstrap). */
  resolvePairSecret: ResolvePairSecret;
  parkEnvelope: ParkEnvelopeFn;
  now?: () => string;
}

export interface CreateDmGroupCoreResult {
  ok: true;
  conversationId: string;
  descriptor: SignedDmGroupDescriptor;
  epoch: number;
  handoffs: DmGroupHandoffOutcome[];
}

/**
 * Create a group DM: mint epoch 1 (createDmGroup, NO recordChange), persist the
 * conversation + descriptor + roster locally, and seal+park a DM_GROUP_COMMIT
 * handoff to every other member.
 */
export async function createDmGroupCore(deps: CreateDmGroupCoreDeps): Promise<CreateDmGroupCoreResult> {
  const nowFn = deps.now ?? (() => new Date().toISOString());
  const nowIso = nowFn();
  const { db, identity } = deps;
  ensureDmTables(db);

  const { descriptor, commit, conversationId } = createDmGroup(db, {
    admin: identity,
    title: deps.title,
    members: deps.members,
    now: nowIso,
  });

  persistGroupConversationAndRoster(db, identity, descriptor, commit.epoch, nowIso);

  const recipientMembers = descriptor.members.filter((m) => m.deviceId !== identity.publicKey);
  const handoffs = await sealAndParkGroupHandoff(
    db, identity, conversationId, descriptor, commit.epoch, recipientMembers,
    deps.relayAvailable, deps.resolvePairSecret, deps.parkEnvelope, nowIso,
  );

  return { ok: true, conversationId, descriptor, epoch: commit.epoch, handoffs };
}

export interface DmGroupMutationCoreDeps {
  db: DatabaseAdapter;
  identity: DeviceIdentity;
  conversationId: string;
  relayAvailable: boolean;
  /** Resolve a member's pairing secret so the handoff also parks on its pair-private mailbox (bootstrap). */
  resolvePairSecret: ResolvePairSecret;
  parkEnvelope: ParkEnvelopeFn;
  now?: () => string;
}

export type DmGroupMutationCoreResult =
  | { ok: true; descriptor: SignedDmGroupDescriptor; epoch: number; handoffs: DmGroupHandoffOutcome[] }
  | { ok: false; reason: DmGroupMutationRejectReason };

/** Shared admin-only guard: load + verify the current descriptor and assert I am the admin. */
function loadAdminDescriptor(
  db: DatabaseAdapter,
  identity: DeviceIdentity,
  conversationId: string,
): SignedDmGroupDescriptor | DmGroupMutationRejectReason {
  const conv = getDmConversation(db, conversationId);
  if (!conv) return 'conversation_unknown';
  if (conv.kind !== 'group') return 'not_a_group';
  const descriptor = readGroupDescriptor(db, conversationId);
  if (!descriptor) return 'descriptor_invalid';
  if (descriptor.adminDeviceId !== identity.publicKey) return 'not_admin';
  return descriptor;
}

/**
 * Add a member: advance the epoch (dmGroupAdd, NO recordChange), re-persist the
 * new descriptor + roster, then hand off the new epoch to EVERY current member
 * (all need the new wrap). Admin-only.
 */
export async function dmGroupAddMemberCore(
  deps: DmGroupMutationCoreDeps & { added: DmGroupMember },
): Promise<DmGroupMutationCoreResult> {
  const nowFn = deps.now ?? (() => new Date().toISOString());
  const nowIso = nowFn();
  const { db, identity, conversationId } = deps;
  ensureDmTables(db);

  const loaded = loadAdminDescriptor(db, identity, conversationId);
  if (typeof loaded === 'string') return { ok: false, reason: loaded };

  const { descriptor, commit } = dmGroupAdd(db, {
    admin: identity,
    descriptor: loaded,
    added: deps.added,
    now: nowIso,
  });
  persistGroupConversationAndRoster(db, identity, descriptor, commit.epoch, nowIso);

  const recipientMembers = descriptor.members.filter((m) => m.deviceId !== identity.publicKey);
  const handoffs = await sealAndParkGroupHandoff(
    db, identity, conversationId, descriptor, commit.epoch, recipientMembers,
    deps.relayAvailable, deps.resolvePairSecret, deps.parkEnvelope, nowIso,
  );
  return { ok: true, descriptor, epoch: commit.epoch, handoffs };
}

/**
 * Remove a member: advance the epoch wrapped for everyone EXCEPT the removed
 * device (dmGroupRemove, forward secrecy, NO recordChange), re-persist the new
 * descriptor + roster (the removed member is pruned), then hand off the new epoch
 * to the REMAINING members. The removed device is never addressed. Admin-only.
 */
export async function dmGroupRemoveMemberCore(
  deps: DmGroupMutationCoreDeps & { removedDeviceId: string },
): Promise<DmGroupMutationCoreResult> {
  const nowFn = deps.now ?? (() => new Date().toISOString());
  const nowIso = nowFn();
  const { db, identity, conversationId } = deps;
  ensureDmTables(db);

  const loaded = loadAdminDescriptor(db, identity, conversationId);
  if (typeof loaded === 'string') return { ok: false, reason: loaded };

  const { descriptor, commit } = dmGroupRemove(db, {
    admin: identity,
    descriptor: loaded,
    removedDeviceId: deps.removedDeviceId,
    now: nowIso,
  });
  persistGroupConversationAndRoster(db, identity, descriptor, commit.epoch, nowIso);

  const recipientMembers = descriptor.members.filter((m) => m.deviceId !== identity.publicKey);
  const handoffs = await sealAndParkGroupHandoff(
    db, identity, conversationId, descriptor, commit.epoch, recipientMembers,
    deps.relayAvailable, deps.resolvePairSecret, deps.parkEnvelope, nowIso,
  );
  return { ok: true, descriptor, epoch: commit.epoch, handoffs };
}

export interface BuildDmGroupMailboxHandlersDeps {
  db: DatabaseAdapter;
  /** This device's identity (the group member receiving the handoff). */
  identity: DeviceIdentity;
  now?: () => string;
}

/**
 * Build the dmGroupCommit drain handler: the shipped @mylife/sync applyDmGroupCommit
 * (bridge sync_workspace_*, store the recipient-gated wrap, pin the admin) PLUS the
 * app-level persistence of the authoritative descriptor + roster reconciliation.
 * Composes with the dmMessage/dmReceipt handlers. Fail-closed: nothing is
 * persisted unless this device really gained a current epoch key, and a STALE
 * descriptor (epoch below what is already stored) never regresses the local roster
 * (an old add-handoff replay cannot resurrect a removed member).
 */
export function buildDmGroupMailboxHandlers(
  deps: BuildDmGroupMailboxHandlersDeps,
): Pick<MailboxEnvelopeHandlers, 'dmGroupCommit'> {
  const { db, identity } = deps;
  const nowFn = deps.now ?? (() => new Date().toISOString());
  const syncHandler = applyDmGroupCommit({ db, self: identity, now: nowFn });

  return {
    dmGroupCommit: (senderDeviceId, payload, createdAt) => {
      ensureDmTables(db);
      const descriptor = payload.descriptor;
      const before = getDmConversation(db, descriptor.conversationId);
      const beforeEpoch = before && before.kind === 'group' ? before.current_epoch : 0;

      const gained = syncHandler.dmGroupCommit!(senderDeviceId, payload, createdAt);
      if (!gained) return false;

      // Duplicate or stale: I already hold this epoch (or a newer one). Nothing new
      // to apply, and the roster must NOT regress - an old add-handoff replayed after
      // a removal cannot resurrect a removed member. Honest: this counts as rejected,
      // not a fresh delivery, so the bootstrap double-park (conversation + pair token)
      // never double-counts.
      if (before && descriptor.epoch <= beforeEpoch) return false;

      persistGroupConversationAndRoster(db, identity, descriptor, descriptor.epoch, createdAt ?? nowFn());
      return true;
    },
  };
}

// ---------------------------------------------------------------------------
// Block + report (Plan 21 Phase 8).
// ---------------------------------------------------------------------------

/**
 * Block a device: a REAL local revocation (sync_device_revocations), authored and
 * signed by THIS device (local authority only, never a gossiped record through
 * this path). Once revoked the mailbox drain skips it (no inbound DMs from it) and
 * the DM send paths never address it. The signed record is gossip-ready like any
 * revocation. Idempotent.
 */
export function blockDmParticipantCore(
  db: DatabaseAdapter,
  self: DeviceIdentity,
  deviceId: string,
  reason?: string,
): void {
  const signed = createSignedRevocation(self, deviceId, reason);
  applySignedRevocation(db, signed, { isAuthorizedRevoker: (revoker) => revoker === self.publicKey });
}

export interface ReportDmInput {
  conversationId: string;
  /** The specific message being reported, or null for a whole-participant report. */
  messageId?: string | null;
  reportedDeviceId: string;
  reason?: string;
}

/**
 * Record a LOCAL report row (dm_reports). Local-only ledger: nothing is sent, and
 * a group-admin review path can read it later. Idempotent by a content-derived id
 * (a re-report at the same instant collapses; a later one is a distinct row).
 */
export function reportDmCore(
  db: DatabaseAdapter,
  input: ReportDmInput,
  now: string = new Date().toISOString(),
): void {
  ensureDmTables(db);
  const messageId = input.messageId ?? null;
  const idSource = `${input.conversationId}|${messageId ?? ''}|${input.reportedDeviceId}|${now}`;
  const id = sha512Hex(new TextEncoder().encode(idSource)).slice(0, 32);
  recordDmReport(db, {
    id,
    conversation_id: input.conversationId,
    message_id: messageId,
    reported_device_id: input.reportedDeviceId,
    reason: input.reason ?? null,
    created_at: now,
  });
}

// ---------------------------------------------------------------------------
// Disappearing messages: the author-signed DM_SHRED (Plan 21 Phase 8).
// ---------------------------------------------------------------------------

/** A blob unpin callback (the blob bytes live in the blob store, not the DB). */
export type DeleteBlobFn = (blobHash: string) => void | Promise<void>;

/** Resolve the shred/message send targets for a conversation (descriptor for a group, roster for a direct), minus self and blocked. */
function resolveDmSendTargets(
  db: DatabaseAdapter,
  identity: DeviceIdentity,
  conversationId: string,
): { deviceId: string; dhPublicKey: string }[] {
  const conv = getDmConversation(db, conversationId);
  if (conv?.kind === 'group') {
    return readGroupDescriptorMembers(db, conversationId)
      .filter((m) => m.deviceId !== identity.publicKey && !isDeviceRevoked(db, m.deviceId))
      .map((m) => ({ deviceId: m.deviceId, dhPublicKey: m.dhPublicKey }));
  }
  return listDmParticipants(db, conversationId)
    .filter((p) => p.is_self === 0 && !isDeviceRevoked(db, p.device_id))
    .map((p) => ({ deviceId: p.device_id, dhPublicKey: p.dh_public_key }));
}

export interface QueueDmShredDeps {
  db: DatabaseAdapter;
  identity: DeviceIdentity;
  conversationId: string;
  /** Message ids to shred. Only ids THIS device authored are shredded (delete-for-everyone of my own). */
  messageIds: string[];
  relayAvailable: boolean;
  resolvePairSecret: ResolvePairSecret;
  parkEnvelope: ParkEnvelopeFn;
  /** Unpin the cached blob bytes for a shredded attachment. */
  deleteBlob?: DeleteBlobFn;
  now?: () => string;
}

export interface QueueDmShredResult {
  ok: true;
  /** The signed shred that was fanned out, or null when nothing was shreddable. */
  shred: DmShredEvent | null;
  /** One outcome per recipient device. */
  recipients: QueueDmDeviceOutcome[];
  /** How many local rows this device deleted (its own copies). */
  deletedLocally: number;
}

/**
 * Shred (disappear) one or more of THIS device's own DM messages: build an
 * author-signed DM_SHRED, fan it to every conversation recipient's pair-private
 * mailbox, and delete the local copies (delete-for-everyone includes me). Only
 * messages this device actually authored in this conversation are shreddable; ids
 * it did not author are ignored (you cannot shred someone else's message).
 */
export async function queueDmShredCore(deps: QueueDmShredDeps): Promise<QueueDmShredResult> {
  const nowFn = deps.now ?? (() => new Date().toISOString());
  const nowIso = nowFn();
  const { db, identity, conversationId } = deps;
  ensureDmTables(db);

  const ownable = deps.messageIds.filter((id) => {
    const row = getDmMessageRow(db, id);
    return !!row && row.conversation_id === conversationId && row.author_device_id === identity.publicKey;
  });
  if (ownable.length === 0) return { ok: true, shred: null, recipients: [], deletedLocally: 0 };

  const shred = createDmShred(identity, { conversationId, messageIds: ownable, at: nowIso });

  const targets = resolveDmSendTargets(db, identity, conversationId);
  const recipients: QueueDmDeviceOutcome[] = [];
  if (!deps.relayAvailable) {
    for (const t of targets) recipients.push({ deviceId: t.deviceId, parked: false });
  } else {
    for (const t of targets) {
      const pairSecret = deps.resolvePairSecret(t.deviceId);
      if (!pairSecret) {
        recipients.push({ deviceId: t.deviceId, parked: false });
        continue;
      }
      const sealed = sealDmShred({
        sender: identity,
        recipient: { deviceId: t.deviceId, dhPublicKey: t.dhPublicKey },
        pairSharedSecretHex: pairSecret,
        shred,
        now: nowIso,
      });
      const parked = await deps.parkEnvelope(sealed.token, sealed.envelope);
      recipients.push({ deviceId: t.deviceId, parked: parked === true });
    }
  }

  let deletedLocally = 0;
  for (const id of ownable) {
    const deleted = deleteDmMessageRow(db, id);
    if (!deleted) continue;
    deletedLocally += 1;
    for (const hash of deleted.blobHashes) await deps.deleteBlob?.(hash);
  }

  return { ok: true, shred, recipients, deletedLocally };
}

export interface BuildDmShredHandlerDeps {
  db: DatabaseAdapter;
  identity: DeviceIdentity;
  deleteBlob?: DeleteBlobFn;
}

/**
 * Build the dmShred drain handler. openDmShredMailbox already verified the shred
 * signature AND bound the envelope signer to the shred author. This SECOND layer
 * only deletes a referenced message whose LOCAL row's author matches the shred
 * author, so a valid shred can delete only the author's OWN messages, never
 * someone else's. Returns true iff at least one local row was really deleted.
 */
export function buildDmShredHandler(
  deps: BuildDmShredHandlerDeps,
): Pick<MailboxEnvelopeHandlers, 'dmShred'> {
  const { db, identity } = deps;
  void identity;
  return {
    dmShred: async (_senderDeviceId, shred) => {
      ensureDmTables(db);
      let deleted = 0;
      for (const id of shred.messageIds) {
        const row = getDmMessageRow(db, id);
        if (!row || row.conversation_id !== shred.conversationId) continue;
        if (row.author_device_id !== shred.authorDeviceId) continue; // never delete another author's message
        const removed = deleteDmMessageRow(db, id);
        if (!removed) continue;
        deleted += 1;
        for (const hash of removed.blobHashes) await deps.deleteBlob?.(hash);
      }
      return deleted > 0;
    },
  };
}
