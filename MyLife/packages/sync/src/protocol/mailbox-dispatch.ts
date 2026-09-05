/**
 * Mailbox kind-dispatcher (Files & Sharing Phase 3).
 *
 * A single device mailbox now carries more than channel-message deltas: it also
 * carries file-request and file-grant payloads (all sealed to the same
 * pair-private token). This dispatcher is the ONE place that opens a drained
 * envelope and routes it by its sealed inner payload kind, so the foreground
 * drain and the background drain cannot drift on how they handle each kind.
 *
 * Fail-closed (Critical): the kind is read ONLY AFTER openMailboxDelta verifies
 * the envelope (signature over the ciphertext, recipient match, decrypt). An
 * unknown or malformed kind is DROPPED and counted as rejected; nothing is
 * written. This preserves runMailboxDrainJob's rejected-count contract: an
 * envelope either applies something real or is counted rejected, never silently
 * swallowed.
 *
 * Each per-kind handler returns whether it APPLIED something real. The channel
 * handler keeps its exact existing verify+merge semantics (an all-duplicate
 * batch counts as not-applied -> rejected, as before).
 *
 * RN-safe: no expo/native imports. Handlers are injected by the caller.
 */

import type { DeviceIdentity } from '../types';
import { decodeMailboxEnvelope, openMailboxDelta, type MailboxEnvelope } from './mailbox';
import {
  PERSON_GROUP_ACCEPT_MAILBOX_KIND,
  PERSON_GROUP_ANNOUNCE_MAILBOX_KIND,
  PERSON_GROUP_PROPOSE_MAILBOX_KIND,
  parsePersonGroupAcceptPayload,
  parsePersonGroupAnnouncePayload,
  parsePersonGroupProposePayload,
  verifyPersonGroupAccept,
  verifyPersonGroupAnnouncePayload,
  verifyPersonGroupProposePayload,
  type PersonGroupAcceptPayload,
  type PersonGroupAnnouncePayload,
  type PersonGroupProposePayload,
} from './person-group-mailbox';
import {
  CHANNEL_MESSAGE_MAILBOX_KIND,
  openChannelMessageMailboxDelta,
} from './channel-mailbox';
import {
  FILE_GRANT_MAILBOX_KIND,
  FILE_REQUEST_MAILBOX_KIND,
  openFileGrantMailbox,
  openFileRequestMailbox,
  type FileGrantMailboxPayload,
  type FileRequestMailboxPayload,
} from './file-request-mailbox';
import {
  HISTORY_GRANT_MAILBOX_KIND,
  HISTORY_REQUEST_MAILBOX_KIND,
  openHistoryGrantMailbox,
  openHistoryRequestMailbox,
  type HistoryGrantMailboxPayload,
  type HistoryRequestMailboxPayload,
} from './history-backfill-mailbox';
import {
  JOIN_GRANT_MAILBOX_KIND,
  JOIN_REQUEST_MAILBOX_KIND,
  openJoinGrantMailbox,
  openJoinRequestMailbox,
  type JoinGrantPayload,
  type JoinRequestPayload,
} from './join-handoff-mailbox';
import {
  PUBLIC_JOIN_REQUEST_MAILBOX_KIND,
  openPublicJoinRequest,
  type PublicJoinRequestPayload,
} from './public-join';
import {
  DM_MESSAGE_MAILBOX_KIND,
  openDmMailbox,
  parseDmGroupMailboxPayload,
  type DmGroupSealedEvents,
} from './dm-mailbox';
import {
  DM_RECEIPT_MAILBOX_KIND,
  openDmReceiptMailbox,
  type DmReceiptEvent,
} from './dm-receipt';
import {
  DM_GROUP_COMMIT_KIND,
  openDmGroupCommit,
  type DmGroupCommitPayload,
} from './dm-group-handoff-mailbox';
import {
  DM_SHRED_MAILBOX_KIND,
  openDmShredMailbox,
  type DmShredEvent,
} from './dm-shred';
import {
  MEMBER_REMOVAL_MAILBOX_KIND,
  openMemberRemovalMailbox,
  type MemberRemovalPayload,
} from './member-removal-mailbox';
import {
  PRESENCE_BEACON_MAILBOX_KIND,
  openPresenceBeaconMailbox,
  type PresenceBeacon,
} from './presence-beacon';
import { verifyChannelMessage, type ChannelMessageEvent } from './channel-message';
import type { DmMessageEvent } from './dm-message';
import type { BlobDataPayload } from './blob-transfer';
import type { ApplyChannelEvents } from './mailbox-drain';

/**
 * What a single envelope's dispatch resolved to:
 *  - 'channel-message' / 'file-request' / 'file-grant' / 'history-request' /
 *    'history-grant' when a handler applied something real;
 *  - 'rejected' when the envelope was malformed/forged/undecryptable, named an
 *    unknown kind, or its handler applied nothing (e.g. all-duplicate events).
 */
export type MailboxDispatchOutcome =
  | { kind: 'channel-message'; applied: number }
  | { kind: 'file-request' }
  | { kind: 'file-grant' }
  | { kind: 'history-request' }
  | { kind: 'history-grant' }
  | { kind: 'join-request' }
  | { kind: 'join-grant' }
  | { kind: 'public-join-request' }
  | { kind: 'dm-message' }
  | { kind: 'dm-receipt' }
  | { kind: 'dm-group-commit' }
  | { kind: 'dm-shred' }
  | { kind: 'member-removal' }
  | { kind: 'presence-beacon' }
  | { kind: 'person-group-propose' }
  | { kind: 'person-group-accept' }
  | { kind: 'person-group-announce' }
  | { kind: 'rejected' };

/**
 * The verified DM delta handed to the dmMessage handler (Plan 21 Phase 2 + 6).
 * `mode: 'direct'` carries fully verified events (1:1). `mode: 'group'` carries
 * NO cleartext events -- the events are epoch-content-key-sealed, so the handler
 * (which holds the epoch key) decrypts `sealedEvents` under `epoch` itself
 * (decryptDmGroupEvents). `events` is empty for group mode.
 */
export interface DmMessageDispatchPayload {
  conversationId: string;
  mode: 'direct' | 'group';
  events: DmMessageEvent[];
  blocks: BlobDataPayload[];
  createdAt: string;
  /** Group mode only: the epoch the events were sealed under. */
  epoch?: number;
  /** Group mode only: the epoch-sealed events blob (handler decrypts with its epoch key). */
  sealedEvents?: DmGroupSealedEvents;
}

/** The verified DM delivery/read receipt handed to the dmReceipt handler (Plan 21 Phase 2). */
export interface DmReceiptDispatchPayload {
  receipt: DmReceiptEvent;
  createdAt: string;
}

/** Per-kind handlers. Any may be omitted; a missing handler drops that kind. */
export interface MailboxEnvelopeHandlers {
  /** Apply verified channel events (mergeChannelMessageEvents). */
  channelMessage?: ApplyChannelEvents;
  /** Handle a verified incoming file-request. Return true iff a row was written. */
  fileRequest?: (
    senderDeviceId: string,
    payload: FileRequestMailboxPayload,
    createdAt: string,
  ) => boolean | Promise<boolean>;
  /** Handle a verified incoming file-grant. Return true iff it applied (restored or recorded a decline). */
  fileGrant?: (
    senderDeviceId: string,
    payload: FileGrantMailboxPayload,
    createdAt: string,
  ) => boolean | Promise<boolean>;
  /**
   * SERVE side: handle a verified incoming history-request (a peer asking for
   * channel backfill). Return true iff a grant was actually parked for them.
   */
  historyRequest?: (
    senderDeviceId: string,
    payload: HistoryRequestMailboxPayload,
    createdAt: string,
  ) => boolean | Promise<boolean>;
  /**
   * APPLY side: handle a verified incoming history-grant (the events a peer
   * served back). Return true iff something real was processed (inserted > 0 or
   * a matched grant was handled).
   */
  historyGrant?: (
    senderDeviceId: string,
    payload: HistoryGrantMailboxPayload,
    createdAt: string,
  ) => boolean | Promise<boolean>;
  /**
   * SERVE side (owner): handle a verified incoming join-request (a joiner asking
   * for an epoch key + descriptor membership). Return true iff a grant was
   * actually parked for them.
   */
  joinRequest?: (
    senderDeviceId: string,
    payload: JoinRequestPayload,
    createdAt: string,
  ) => boolean | Promise<boolean>;
  /**
   * APPLY side (joiner): handle a verified incoming join-grant (the descriptor +
   * key wraps the owner sealed back). Return true iff something real was applied
   * (the joiner now holds a current epoch key).
   */
  joinGrant?: (
    senderDeviceId: string,
    payload: JoinGrantPayload,
    createdAt: string,
  ) => boolean | Promise<boolean>;
  /**
   * SERVE side (owner): handle a verified incoming PUBLIC-join request (a joiner
   * of a request-policy public community asking to be admitted). A public grant is
   * BROADCAST, so this NEVER auto-approves: the handler only RECORDS the verified
   * request into the app's review queue. The epoch key is handed off ONLY by a
   * later, explicit owner APPROVE (approvePublicJoinRequest), never here. Return
   * true iff a real review-queue row was written.
   */
  publicJoinRequest?: (
    senderDeviceId: string,
    payload: PublicJoinRequestPayload,
    createdAt: string,
  ) => boolean | Promise<boolean>;
  /**
   * Handle a verified incoming 1:1 DM delta (Plan 21 Phase 2). The DM local
   * store + the actual apply-to-store write are a LATER phase; this handler
   * receives the fully VERIFIED opened result (conversationId + mode come from
   * inside the sealed payload) so the app can merge it. Return true iff
   * something real was applied (e.g. at least one new event merged).
   */
  dmMessage?: (
    senderDeviceId: string,
    opened: DmMessageDispatchPayload,
  ) => boolean | Promise<boolean>;
  /**
   * Handle a verified incoming DM delivery/read receipt (Plan 21 Phase 2).
   * Return true iff the receipt state was actually recorded.
   */
  dmReceipt?: (
    senderDeviceId: string,
    opened: DmReceiptDispatchPayload,
  ) => boolean | Promise<boolean>;
  /**
   * Handle a verified incoming GROUP DM epoch commit handoff (Plan 21 Phase 6).
   * openDmGroupCommit re-verified the admin-signed descriptor + bound the sender
   * to the admin before this is invoked. The handler stores the recipient-gated
   * wrap(s) + pins the admin (applyDmGroupCommit). Return true iff the member now
   * holds a current epoch key for the group.
   */
  dmGroupCommit?: (
    senderDeviceId: string,
    payload: DmGroupCommitPayload,
    createdAt: string,
  ) => boolean | Promise<boolean>;
  /**
   * Handle a verified incoming DM shred (Plan 21 Phase 8 disappearing extension).
   * openDmShredMailbox already verified the shred signature AND bound the envelope
   * signer to the shred author, so only the author can send it. The handler deletes
   * the referenced local rows + cached blobs, but ONLY messages actually authored by
   * the shred author (a second author-owns-message check). Return true iff at least
   * one local row was really deleted.
   */
  dmShred?: (
    senderDeviceId: string,
    shred: DmShredEvent,
    createdAt: string,
  ) => boolean | Promise<boolean>;
  /**
   * APPLY side (survivor): handle a verified incoming community member-removal
   * (Plan 28 P2). openMemberRemovalMailbox verified the envelope + payload
   * shape; the handler (applyMemberRemoval) re-verifies AUTHORITY fail-closed
   * (sender is the descriptor owner, strictly-newer owner-signed revision
   * chained to the local predecessor) before adopting the descriptor, closing
   * the removed device's roster row, and storing the survivor's new-epoch
   * wrap. Return true iff the signed revision really took local effect.
   */
  memberRemoval?: (
    senderDeviceId: string,
    payload: MemberRemovalPayload,
    createdAt: string,
  ) => boolean | Promise<boolean>;
  /**
   * Handle a verified incoming presence beacon (Plan 29 P6, opt-in presence).
   * openPresenceBeaconMailbox re-verified the beacon's own signature AND bound the
   * envelope signer to the beacon's device (presence is self-asserted, never
   * relayed), and only a FRESH beacon reaches here (an expired one is dropped at
   * the drain, honest TTL). The handler stores it device-local
   * (recordPresenceBeacon) so presenceCounts can validate it against the SIGNED
   * roster. Return true iff the beacon was stored.
   */
  presenceBeacon?: (
    senderDeviceId: string,
    beacon: PresenceBeacon,
    createdAt: string,
  ) => boolean | Promise<boolean>;
  /**
   * Plan 52 P1: an own-device asks this device to co-sign a person-group
   * revision. The handler MUST verify the sender is one of this device's
   * own-device-linked peers and that this device is listed, then sign the SAME
   * canonical bytes and park an accept back. Return true iff an accept parked.
   */
  personGroupPropose?: (
    senderDeviceId: string,
    payload: PersonGroupProposePayload,
    createdAt: string,
  ) => boolean | Promise<boolean>;
  /**
   * Plan 52 P1: a co-signature came back for a pending proposal. The payload's
   * signature is ALREADY verified against the sender over the exact proposed
   * doc before this handler runs. Return true iff the signature was recorded
   * (and, when complete, the doc assembled + stored).
   */
  personGroupAccept?: (
    senderDeviceId: string,
    payload: PersonGroupAcceptPayload,
    createdAt: string,
  ) => boolean | Promise<boolean>;
  /**
   * Plan 52 P2: a DM peer delivered its fully assembled person announce
   * (context derived FOR this device). The announce is verified -- including
   * sender-listed and context-for-recipient -- before this handler runs.
   * Return true iff the link materialization was updated.
   */
  personGroupAnnounce?: (
    senderDeviceId: string,
    payload: PersonGroupAnnouncePayload,
    createdAt: string,
  ) => boolean | Promise<boolean>;
}

/**
 * Peek the sealed inner payload's kind AFTER open+verify, then route. The kind
 * tag is read from inside the verified box, never from the wire frame.
 */
function peekKind(payload: unknown): string | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const kind = (payload as { kind?: unknown }).kind;
  return typeof kind === 'string' ? kind : null;
}

/**
 * Open one drained envelope and route it by kind. Returns a typed outcome; the
 * caller maps it to its applied/rejected counters. Fail-closed on every error.
 */
export async function applyMailboxEnvelope(
  recipient: DeviceIdentity,
  envelopeBytes: Uint8Array,
  handlers: MailboxEnvelopeHandlers,
): Promise<MailboxDispatchOutcome> {
  const envelope = decodeMailboxEnvelope(envelopeBytes);
  if (!envelope) return { kind: 'rejected' };

  // Open+verify ONCE here so the kind read below is on already-verified bytes.
  const opened = openMailboxDelta<unknown>(recipient, envelope);
  if (!opened.ok) return { kind: 'rejected' };

  const kind = peekKind(opened.payload);
  switch (kind) {
    case CHANNEL_MESSAGE_MAILBOX_KIND:
      return dispatchChannelMessage(recipient, envelope, handlers.channelMessage);
    case FILE_REQUEST_MAILBOX_KIND:
      return dispatchFileRequest(recipient, envelope, handlers.fileRequest);
    case FILE_GRANT_MAILBOX_KIND:
      return dispatchFileGrant(recipient, envelope, handlers.fileGrant);
    case HISTORY_REQUEST_MAILBOX_KIND:
      return dispatchHistoryRequest(recipient, envelope, handlers.historyRequest);
    case HISTORY_GRANT_MAILBOX_KIND:
      return dispatchHistoryGrant(recipient, envelope, handlers.historyGrant);
    case JOIN_REQUEST_MAILBOX_KIND:
      return dispatchJoinRequest(recipient, envelope, handlers.joinRequest);
    case JOIN_GRANT_MAILBOX_KIND:
      return dispatchJoinGrant(recipient, envelope, handlers.joinGrant);
    case PUBLIC_JOIN_REQUEST_MAILBOX_KIND:
      return dispatchPublicJoinRequest(recipient, envelope, handlers.publicJoinRequest);
    case DM_MESSAGE_MAILBOX_KIND:
      return dispatchDmMessage(recipient, envelope, handlers.dmMessage);
    case DM_RECEIPT_MAILBOX_KIND:
      return dispatchDmReceipt(recipient, envelope, handlers.dmReceipt);
    case DM_GROUP_COMMIT_KIND:
      return dispatchDmGroupCommit(recipient, envelope, handlers.dmGroupCommit);
    case DM_SHRED_MAILBOX_KIND:
      return dispatchDmShred(recipient, envelope, handlers.dmShred);
    case MEMBER_REMOVAL_MAILBOX_KIND:
      return dispatchMemberRemoval(recipient, envelope, handlers.memberRemoval);
    case PRESENCE_BEACON_MAILBOX_KIND:
      return dispatchPresenceBeacon(recipient, envelope, handlers.presenceBeacon);
    case PERSON_GROUP_PROPOSE_MAILBOX_KIND:
      return dispatchPersonGroupPropose(recipient, envelope, handlers.personGroupPropose);
    case PERSON_GROUP_ACCEPT_MAILBOX_KIND:
      return dispatchPersonGroupAccept(recipient, envelope, handlers.personGroupAccept);
    case PERSON_GROUP_ANNOUNCE_MAILBOX_KIND:
      return dispatchPersonGroupAnnounce(recipient, envelope, handlers.personGroupAnnounce);
    default:
      // Unknown / missing kind: drop fail-closed.
      return { kind: 'rejected' };
  }
}

async function dispatchChannelMessage(
  recipient: DeviceIdentity,
  envelope: MailboxEnvelope,
  apply: ApplyChannelEvents | undefined,
): Promise<MailboxDispatchOutcome> {
  if (!apply) return { kind: 'rejected' };

  const opened = openChannelMessageMailboxDelta(recipient, envelope);
  if (!opened.ok) return { kind: 'rejected' };

  // Defense in depth: re-verify each event's signature before it touches storage.
  const verified = opened.events.filter((event: ChannelMessageEvent) => verifyChannelMessage(event));
  if (verified.length === 0) return { kind: 'rejected' };

  const merged = apply(verified);
  if (merged.inserted <= 0) return { kind: 'rejected' };
  return { kind: 'channel-message', applied: merged.inserted };
}

async function dispatchPersonGroupPropose(
  recipient: DeviceIdentity,
  envelope: MailboxEnvelope,
  handle: MailboxEnvelopeHandlers['personGroupPropose'],
): Promise<MailboxDispatchOutcome> {
  if (!handle) return { kind: 'rejected' };

  const opened = openMailboxDelta<unknown>(recipient, envelope);
  if (!opened.ok) return { kind: 'rejected' };
  const payload = parsePersonGroupProposePayload(opened.payload);
  if (!payload) return { kind: 'rejected' };
  // Symmetric with accept/announce: the proposer must be listed and have
  // signed the exact doc, and this device must be listed, before any app
  // signing logic sees the proposal.
  if (!verifyPersonGroupProposePayload(opened.senderDeviceId, recipient.publicKey, payload)) {
    return { kind: 'rejected' };
  }

  const applied = await handle(opened.senderDeviceId, payload, opened.createdAt);
  return applied ? { kind: 'person-group-propose' } : { kind: 'rejected' };
}

async function dispatchPersonGroupAccept(
  recipient: DeviceIdentity,
  envelope: MailboxEnvelope,
  handle: MailboxEnvelopeHandlers['personGroupAccept'],
): Promise<MailboxDispatchOutcome> {
  if (!handle) return { kind: 'rejected' };

  const opened = openMailboxDelta<unknown>(recipient, envelope);
  if (!opened.ok) return { kind: 'rejected' };
  const payload = parsePersonGroupAcceptPayload(opened.payload);
  if (!payload) return { kind: 'rejected' };
  // The accept's signature must bind the SENDER to the exact proposed doc
  // before the app handler ever sees it (fail-closed at the dispatch layer).
  if (!verifyPersonGroupAccept(opened.senderDeviceId, payload)) {
    return { kind: 'rejected' };
  }

  const applied = await handle(opened.senderDeviceId, payload, opened.createdAt);
  return applied ? { kind: 'person-group-accept' } : { kind: 'rejected' };
}

async function dispatchPersonGroupAnnounce(
  recipient: DeviceIdentity,
  envelope: MailboxEnvelope,
  handle: MailboxEnvelopeHandlers['personGroupAnnounce'],
): Promise<MailboxDispatchOutcome> {
  if (!handle) return { kind: 'rejected' };

  const opened = openMailboxDelta<unknown>(recipient, envelope);
  if (!opened.ok) return { kind: 'rejected' };
  const payload = parsePersonGroupAnnouncePayload(opened.payload);
  if (!payload) return { kind: 'rejected' };
  if (!verifyPersonGroupAnnouncePayload(opened.senderDeviceId, recipient.publicKey, payload)) {
    return { kind: 'rejected' };
  }

  const applied = await handle(opened.senderDeviceId, payload, opened.createdAt);
  return applied ? { kind: 'person-group-announce' } : { kind: 'rejected' };
}

async function dispatchFileRequest(
  recipient: DeviceIdentity,
  envelope: MailboxEnvelope,
  handle: MailboxEnvelopeHandlers['fileRequest'],
): Promise<MailboxDispatchOutcome> {
  if (!handle) return { kind: 'rejected' };

  const opened = openFileRequestMailbox(recipient, envelope);
  if (!opened.ok) return { kind: 'rejected' };

  const applied = await handle(opened.senderDeviceId, opened.payload, opened.createdAt);
  return applied ? { kind: 'file-request' } : { kind: 'rejected' };
}

async function dispatchFileGrant(
  recipient: DeviceIdentity,
  envelope: MailboxEnvelope,
  handle: MailboxEnvelopeHandlers['fileGrant'],
): Promise<MailboxDispatchOutcome> {
  if (!handle) return { kind: 'rejected' };

  const opened = openFileGrantMailbox(recipient, envelope);
  if (!opened.ok) return { kind: 'rejected' };

  const applied = await handle(opened.senderDeviceId, opened.payload, opened.createdAt);
  return applied ? { kind: 'file-grant' } : { kind: 'rejected' };
}

async function dispatchHistoryRequest(
  recipient: DeviceIdentity,
  envelope: MailboxEnvelope,
  handle: MailboxEnvelopeHandlers['historyRequest'],
): Promise<MailboxDispatchOutcome> {
  if (!handle) return { kind: 'rejected' };

  const opened = openHistoryRequestMailbox(recipient, envelope);
  if (!opened.ok) return { kind: 'rejected' };

  const applied = await handle(opened.senderDeviceId, opened.payload, opened.createdAt);
  return applied ? { kind: 'history-request' } : { kind: 'rejected' };
}

async function dispatchHistoryGrant(
  recipient: DeviceIdentity,
  envelope: MailboxEnvelope,
  handle: MailboxEnvelopeHandlers['historyGrant'],
): Promise<MailboxDispatchOutcome> {
  if (!handle) return { kind: 'rejected' };

  const opened = openHistoryGrantMailbox(recipient, envelope);
  if (!opened.ok) return { kind: 'rejected' };

  const applied = await handle(opened.senderDeviceId, opened.payload, opened.createdAt);
  return applied ? { kind: 'history-grant' } : { kind: 'rejected' };
}

async function dispatchJoinRequest(
  recipient: DeviceIdentity,
  envelope: MailboxEnvelope,
  handle: MailboxEnvelopeHandlers['joinRequest'],
): Promise<MailboxDispatchOutcome> {
  if (!handle) return { kind: 'rejected' };

  const opened = openJoinRequestMailbox(recipient, envelope);
  if (!opened.ok) return { kind: 'rejected' };

  const applied = await handle(opened.senderDeviceId, opened.payload, opened.createdAt);
  return applied ? { kind: 'join-request' } : { kind: 'rejected' };
}

async function dispatchJoinGrant(
  recipient: DeviceIdentity,
  envelope: MailboxEnvelope,
  handle: MailboxEnvelopeHandlers['joinGrant'],
): Promise<MailboxDispatchOutcome> {
  if (!handle) return { kind: 'rejected' };

  const opened = openJoinGrantMailbox(recipient, envelope);
  if (!opened.ok) return { kind: 'rejected' };

  const applied = await handle(opened.senderDeviceId, opened.payload, opened.createdAt);
  return applied ? { kind: 'join-grant' } : { kind: 'rejected' };
}

async function dispatchPublicJoinRequest(
  recipient: DeviceIdentity,
  envelope: MailboxEnvelope,
  handle: MailboxEnvelopeHandlers['publicJoinRequest'],
): Promise<MailboxDispatchOutcome> {
  if (!handle) return { kind: 'rejected' };

  // openPublicJoinRequest re-verifies the envelope signature + recipient + decrypt,
  // then structurally validates the payload, re-verifies the joiner bundle, and
  // binds bundle.deviceId === senderDeviceId. Any failure drops fail-closed.
  const opened = openPublicJoinRequest(recipient, envelope);
  if (!opened.ok) return { kind: 'rejected' };

  const applied = await handle(opened.senderDeviceId, opened.payload, opened.createdAt);
  return applied ? { kind: 'public-join-request' } : { kind: 'rejected' };
}

async function dispatchDmMessage(
  recipient: DeviceIdentity,
  envelope: MailboxEnvelope,
  handle: MailboxEnvelopeHandlers['dmMessage'],
): Promise<MailboxDispatchOutcome> {
  if (!handle) return { kind: 'rejected' };

  // Open the mailbox seal ONCE to inspect the mode: 1:1 'direct' and group
  // 'group' share DM_MESSAGE_MAILBOX_KIND (both carry DmMessageEvents), so the
  // discriminator lives inside the verified box. openMailboxDelta already enforced
  // the envelope signature + recipient + decrypt; any failure drops fail-closed.
  const raw = openMailboxDelta<unknown>(recipient, envelope);
  if (!raw.ok) return { kind: 'rejected' };
  const mode = typeof raw.payload === 'object' && raw.payload !== null
    ? (raw.payload as { mode?: unknown }).mode
    : null;

  if (mode === 'group') {
    // Group delta: the events are epoch-content-key-sealed, so the dispatcher
    // (which holds NO epoch key) hands the sealed blob + epoch to the handler,
    // which decrypts with its own key (decryptDmGroupEvents). Structural parse
    // only here; fail-closed on a malformed group payload.
    const parsed = parseDmGroupMailboxPayload(raw.payload);
    if (!parsed.ok) return { kind: 'rejected' };
    const applied = await handle(raw.senderDeviceId, {
      conversationId: parsed.payload.conversationId,
      mode: 'group',
      events: [],
      blocks: parsed.payload.blocks ?? [],
      createdAt: raw.createdAt,
      epoch: parsed.payload.epoch,
      sealedEvents: parsed.payload.sealedEvents,
    });
    return applied ? { kind: 'dm-message' } : { kind: 'rejected' };
  }

  // 1:1 direct (unchanged): openDmMailbox re-verifies every carried event's
  // signature before the handler is invoked.
  const opened = openDmMailbox(recipient, envelope);
  if (!opened.ok) return { kind: 'rejected' };

  const applied = await handle(opened.senderDeviceId, {
    conversationId: opened.payload.conversationId,
    mode: opened.payload.mode,
    events: opened.events,
    blocks: opened.blocks,
    createdAt: opened.createdAt,
  });
  return applied ? { kind: 'dm-message' } : { kind: 'rejected' };
}

async function dispatchDmGroupCommit(
  recipient: DeviceIdentity,
  envelope: MailboxEnvelope,
  handle: MailboxEnvelopeHandlers['dmGroupCommit'],
): Promise<MailboxDispatchOutcome> {
  if (!handle) return { kind: 'rejected' };

  // openDmGroupCommit re-verifies the envelope AND the admin-signed descriptor,
  // binds the envelope signer to the descriptor admin, and re-verifies the admin
  // bundle. Any failure drops fail-closed before the handler is ever invoked.
  const opened = openDmGroupCommit(recipient, envelope);
  if (!opened.ok) return { kind: 'rejected' };

  const applied = await handle(opened.senderDeviceId, opened.payload, opened.createdAt);
  return applied ? { kind: 'dm-group-commit' } : { kind: 'rejected' };
}

async function dispatchDmShred(
  recipient: DeviceIdentity,
  envelope: MailboxEnvelope,
  handle: MailboxEnvelopeHandlers['dmShred'],
): Promise<MailboxDispatchOutcome> {
  if (!handle) return { kind: 'rejected' };

  // openDmShredMailbox re-verifies the envelope AND the shred's author signature,
  // and binds the envelope signer to the shred author; a forged/relayed shred yields
  // ok:false before the handler runs.
  const opened = openDmShredMailbox(recipient, envelope);
  if (!opened.ok) return { kind: 'rejected' };

  const applied = await handle(opened.senderDeviceId, opened.shred, opened.createdAt);
  return applied ? { kind: 'dm-shred' } : { kind: 'rejected' };
}

async function dispatchPresenceBeacon(
  recipient: DeviceIdentity,
  envelope: MailboxEnvelope,
  handle: MailboxEnvelopeHandlers['presenceBeacon'],
): Promise<MailboxDispatchOutcome> {
  if (!handle) return { kind: 'rejected' };

  // openPresenceBeaconMailbox re-verifies the envelope AND the beacon's own
  // signature, and binds the envelope signer to the beacon's device (a
  // forged/relayed beacon yields ok:false). Only a FRESH beacon is forwarded; an
  // expired one is dropped here (honest TTL), never stored.
  const opened = openPresenceBeaconMailbox(recipient, envelope);
  if (!opened.ok || opened.verdict !== 'fresh') return { kind: 'rejected' };

  const applied = await handle(opened.senderDeviceId, opened.beacon, opened.createdAt);
  return applied ? { kind: 'presence-beacon' } : { kind: 'rejected' };
}

async function dispatchMemberRemoval(
  recipient: DeviceIdentity,
  envelope: MailboxEnvelope,
  handle: MailboxEnvelopeHandlers['memberRemoval'],
): Promise<MailboxDispatchOutcome> {
  if (!handle) return { kind: 'rejected' };

  // openMemberRemovalMailbox re-verifies the envelope signature + recipient +
  // decrypt and structurally validates the payload. The owner signature on the
  // descriptor, the sender/owner binding, and each wrap's recipient-gating are
  // re-verified by the handler (applyMemberRemoval), exactly like the join-grant.
  const opened = openMemberRemovalMailbox(recipient, envelope);
  if (!opened.ok) return { kind: 'rejected' };

  const applied = await handle(opened.senderDeviceId, opened.payload, opened.createdAt);
  return applied ? { kind: 'member-removal' } : { kind: 'rejected' };
}

async function dispatchDmReceipt(
  recipient: DeviceIdentity,
  envelope: MailboxEnvelope,
  handle: MailboxEnvelopeHandlers['dmReceipt'],
): Promise<MailboxDispatchOutcome> {
  if (!handle) return { kind: 'rejected' };

  // openDmReceiptMailbox re-verifies the envelope AND the receipt's own
  // signature; a tampered or forged receipt yields ok:false before the handler
  // is ever invoked.
  const opened = openDmReceiptMailbox(recipient, envelope);
  if (!opened.ok) return { kind: 'rejected' };

  const applied = await handle(opened.senderDeviceId, {
    receipt: opened.receipt,
    createdAt: opened.createdAt,
  });
  return applied ? { kind: 'dm-receipt' } : { kind: 'rejected' };
}
