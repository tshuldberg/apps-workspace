// Plan 21 Phase 9 (WEB twin of apps/meerkat/app/(root)/data/dm-view-core.ts):
// pure mapping between the local dm_ store and the shared chat kit + the
// conversation-list rows. The panes wire providers + effects; every honest
// decision worth testing lives here so the node vitest covers it without a React
// harness. No provider imports beyond the pure chat-kit core. The ONLY difference
// from the mobile twin is the chat-kit-core import path (web colocates it in lib/).
//
// HONESTY (Critical): the send/receipt labels here are derived ONLY from real
// dm_delivery rows (a park result, or a verified signed receipt). Nothing maps a
// timer or an optimistic guess to "Delivered"/"Read". A message with no delivery
// row yet reads "Sending…"; a message whose park did not succeed reads "Not
// sent"; "Delivered"/"Read" appear ONLY when a real receipt row backs them.

import { dmConversationId, type DeviceIdentity, type DmMessageEvent, type DmReceiptState, type Hlc } from '@mylife/sync';
import type { DatabaseAdapter } from '@mylife/db';
import { formatClockTime, type ChatKitMessage } from './chat-kit-core';
import {
  ensureDmTables,
  getDmConversation,
  setDmConversationArchived,
  upsertDmConversation,
  upsertDmParticipant,
  type DmDeliveryRow,
  type DmDeliveryState,
} from './dm-core';

// ---------------------------------------------------------------------------
// Honest copy (single source of truth for the DM surface strings).
// ---------------------------------------------------------------------------

export const DM_NO_CONVERSATIONS_EMPTY_STATE =
  'No conversations yet. Add a friend, then tap New to start a private chat.';

export const DM_EMPTY_THREAD_STATE =
  'No messages yet. Say hello. This chat is end-to-end encrypted.';

export const DM_NOT_SENT_NO_RELAY =
  'Not sent. Set a connection server in Sync to send messages.';

export const DM_NOT_SENT_UNREACHABLE =
  'Not sent. Could not reach a connection server.';

// ---------------------------------------------------------------------------
// HLC compare (dm-core keeps its own private copy; this is the pure twin).
// ---------------------------------------------------------------------------

export function compareDmHlc(a: Hlc, b: Hlc): number {
  if (a.wall !== b.wall) return a.wall < b.wall ? -1 : 1;
  return a.counter - b.counter;
}

// ---------------------------------------------------------------------------
// Message -> chat-kit mapping.
// ---------------------------------------------------------------------------

/**
 * Map a stored, verified DM event to the normalized ChatKitMessage the kit
 * renders. A DM row is always a real persisted event (the optimistic echo writes
 * it immediately), so status is always 'sent'; the honest send/receipt state
 * lives in the separate delivery line, never in the bubble status. "edited" marks
 * an event that supersedes a prior one and is not a deletion.
 */
export function mapDmEventToKit(event: DmMessageEvent, selfDeviceId: string): ChatKitMessage {
  return {
    id: event.id,
    authorId: event.authorDeviceId,
    wall: event.hlc.wall,
    isMine: event.authorDeviceId === selfDeviceId,
    body: event.body,
    status: 'sent',
    edited: !!event.supersedes && !event.supersedes.deleted,
    errorText: null,
    replyTo: null,
  };
}

// ---------------------------------------------------------------------------
// Delivery summary (the honest receipt state, from real dm_delivery rows only).
// ---------------------------------------------------------------------------

export type DmSendState = 'sending' | 'sent' | 'delivered' | 'read' | 'not_sent';

export interface DmDeliverySummary {
  state: DmSendState;
  /** Wall time of the strongest backing receipt (delivered/read); null otherwise. */
  atWall: string | null;
  /** Recipient device count (one row per target device). */
  recipients: number;
  /** How many reached at least 'parked' (parked | delivered | read). */
  parked: number;
  /** How many reached at least 'delivered' (delivered | read). */
  delivered: number;
  /** How many reached 'read'. */
  read: number;
}

const AT_LEAST_PARKED: ReadonlySet<DmDeliveryState> = new Set(['parked', 'delivered', 'read']);
const AT_LEAST_DELIVERED: ReadonlySet<DmDeliveryState> = new Set(['delivered', 'read']);

/**
 * Fold a message's per-device delivery rows into an honest summary. No rows means
 * the park has not recorded an outcome yet ("Sending…"). Rows that never reached
 * 'parked' mean the send did not land ("Not sent"). 'delivered'/'read' are set
 * ONLY when a real receipt row carries them (setDmDelivery stores the signature).
 *
 * `ownDeviceIds` are THIS user's own linked mirror devices (dm_own_devices) and is
 * REQUIRED (no fail-open default): the display filter must never silently fabricate
 * a Delivered/Read from one of my own devices. Their delivery rows are excluded from
 * every count (Plan 21 Phase 10 item 5). This is load-bearing for BOTH kinds, not a
 * 1:1 no-op: a linked own device can ack my 1:1 message (the D2 -> D1 receipt), which
 * writes a real own-device dm_delivery row that must not read as the peer's Delivered.
 * The primary honesty guarantee is at the EMIT layer (own devices never emit a receipt
 * for my own message); this exclusion is defense-in-depth on the display side.
 */
export function summarizeDmDelivery(
  rows: readonly DmDeliveryRow[],
  _kind: 'direct' | 'group',
  ownDeviceIds: ReadonlySet<string>,
): DmDeliverySummary {
  const counted = ownDeviceIds.size === 0
    ? rows
    : rows.filter((row) => !ownDeviceIds.has(row.peer_device_id));
  const recipients = counted.length;
  if (recipients === 0) {
    return { state: 'sending', atWall: null, recipients: 0, parked: 0, delivered: 0, read: 0 };
  }
  let parked = 0;
  let delivered = 0;
  let read = 0;
  let deliveredWall: string | null = null;
  let readWall: string | null = null;
  for (const row of counted) {
    if (AT_LEAST_PARKED.has(row.state)) parked += 1;
    if (AT_LEAST_DELIVERED.has(row.state)) {
      delivered += 1;
      if (!deliveredWall || row.state_at > deliveredWall) deliveredWall = row.state_at;
    }
    if (row.state === 'read') {
      read += 1;
      if (!readWall || row.state_at > readWall) readWall = row.state_at;
    }
  }

  let state: DmSendState;
  let atWall: string | null = null;
  if (read > 0) {
    state = 'read';
    atWall = readWall;
  } else if (delivered > 0) {
    state = 'delivered';
    atWall = deliveredWall;
  } else if (parked > 0) {
    state = 'sent';
  } else {
    state = 'not_sent';
  }
  return { state, atWall, recipients, parked, delivered, read };
}

/**
 * The honest per-message receipt line for the thread. Direct conversations show a
 * single state; group conversations show the real aggregate counts. Only a
 * backing dm_delivery row can produce "Delivered"/"Read".
 */
export function dmDeliveryLabel(
  summary: DmDeliverySummary,
  kind: 'direct' | 'group',
  opts: { relayConfigured: boolean },
): string {
  if (kind === 'group') {
    if (summary.recipients === 0) return 'Sending…';
    if (summary.parked === 0) {
      return opts.relayConfigured ? DM_NOT_SENT_UNREACHABLE : DM_NOT_SENT_NO_RELAY;
    }
    let label = `Sent to ${summary.parked}`;
    if (summary.delivered > 0) label += ` · Delivered to ${summary.delivered}`;
    if (summary.read > 0) label += ` · Read by ${summary.read}`;
    return label;
  }
  switch (summary.state) {
    case 'sending':
      return 'Sending…';
    case 'sent':
      return 'Sent';
    case 'delivered': {
      const time = summary.atWall ? formatClockTime(summary.atWall) : '';
      return time ? `Delivered ${time}` : 'Delivered';
    }
    case 'read': {
      const time = summary.atWall ? formatClockTime(summary.atWall) : '';
      return time ? `Read ${time}` : 'Read';
    }
    case 'not_sent':
      return opts.relayConfigured ? DM_NOT_SENT_UNREACHABLE : DM_NOT_SENT_NO_RELAY;
  }
}

/**
 * Whether a Retry affordance should be offered for one of MY messages (Plan 21
 * Phase 10 item 3). Retry is offered ONLY when this is my own message AND its
 * honest state is 'not_sent' (no recipient device reached at least 'parked'), so
 * re-running the real send path cannot duplicate a message that already reached
 * someone. It is never offered while 'sending' (in flight, no rows yet) or once
 * any real park landed ('sent'/'delivered'/'read'). Retry itself re-runs the real
 * queueDmMessage park path; state advances only on a real park, never a timer.
 */
export function dmRetryAvailable(summary: DmDeliverySummary, isMine: boolean): boolean {
  return isMine && summary.state === 'not_sent';
}

/**
 * Re-entrancy guard for the Retry control (Plan 21 Phase 10 Fix 2). A second tap
 * while a retry (or send) is already in flight must be a no-op, so queueDmMessage
 * cannot mint two distinct messages from two fast taps. The screen holds the
 * in-flight flag in a synchronous ref (state updates are async and would race).
 */
export function shouldStartDmRetry(inFlight: boolean): boolean {
  return !inFlight;
}

/** The short honest chip for a conversation-list row (last outgoing message only). */
export function dmListChipLabel(summary: DmDeliverySummary): string {
  switch (summary.state) {
    case 'sending':
      return 'Sending…';
    case 'sent':
      return 'Sent';
    case 'delivered':
      return 'Delivered';
    case 'read':
      return 'Read';
    case 'not_sent':
      return 'Not sent';
  }
}

// ---------------------------------------------------------------------------
// Conversation-list rows.
// ---------------------------------------------------------------------------

const PREVIEW_MAX = 90;

function messagePreview(event: DmMessageEvent): string {
  const body = event.body.replace(/\s+/gu, ' ').trim();
  if (body.length > 0) {
    return body.length > PREVIEW_MAX ? `${body.slice(0, PREVIEW_MAX - 1)}…` : body;
  }
  const attachments = event.attachments ?? [];
  if (attachments.length > 0) return attachments.length === 1 ? 'Attachment' : `${attachments.length} attachments`;
  return 'Message';
}

export interface DmListRow {
  id: string;
  kind: 'direct' | 'group';
  title: string;
  subtitle: string;
  unreadCount: number;
  lastActivityWall: string;
  isGroup: boolean;
  memberCount: number | null;
  /** Honest chip for the LAST message only, and only when I authored it. */
  chip: string | null;
}

export interface BuildDmListRowInput {
  conversationId: string;
  kind: 'direct' | 'group';
  title: string | null;
  updatedAt: string;
  selfDeviceId: string;
  /** Peer display name for a direct conversation. */
  peerName: string;
  lastMessage: DmMessageEvent | null;
  lastDelivery: readonly DmDeliveryRow[];
  /** This user's own linked devices, excluded from the chip's delivery counts (item 5). Required (fail-closed). */
  ownDeviceIds: ReadonlySet<string>;
  unreadCount: number;
  memberCount: number | null;
  relayConfigured: boolean;
}

/** Build one conversation-list row from already-read local data (pure). */
export function buildDmListRow(input: BuildDmListRowInput): DmListRow {
  const isGroup = input.kind === 'group';
  const title = isGroup ? (input.title?.trim() || 'Group') : input.peerName;
  const subtitle = input.lastMessage ? messagePreview(input.lastMessage) : 'No messages yet';
  const mine = input.lastMessage != null && input.lastMessage.authorDeviceId === input.selfDeviceId;
  const chip = mine
    ? dmListChipLabel(summarizeDmDelivery(input.lastDelivery, input.kind, input.ownDeviceIds))
    : null;
  return {
    id: input.conversationId,
    kind: input.kind,
    title,
    subtitle,
    unreadCount: input.unreadCount,
    lastActivityWall: input.lastMessage?.hlc.wall ?? input.updatedAt,
    isGroup,
    memberCount: input.memberCount,
    chip,
  };
}

/** Sort conversation rows newest-activity first (stable on ties by id). */
export function sortDmListRows(rows: readonly DmListRow[]): DmListRow[] {
  return [...rows].sort((a, b) => {
    if (a.lastActivityWall !== b.lastActivityWall) return a.lastActivityWall < b.lastActivityWall ? 1 : -1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

// ---------------------------------------------------------------------------
// Read receipts to emit (the honest, non-spammy set).
// ---------------------------------------------------------------------------

export interface DmReceiptsToEmit {
  /** One receipt per newly-seen peer message. 'read' when receipts are enabled, else 'delivered'. */
  toEmit: { messageId: string; state: DmReceiptState }[];
  /** The advanced local read marker (max HLC across all visible messages), or null if unchanged. */
  nextLastRead: Hlc | null;
}

/**
 * Decide which delivery/read receipts to emit when a thread is viewed. A receipt
 * is emitted once per peer-authored message newer than the local read marker;
 * with read receipts disabled a 'delivered' (never 'read') is emitted, honoring
 * NC-5 at the emit side. The read marker advances to the newest visible message
 * (mine or theirs), so a re-focus with nothing new emits nothing.
 *
 * PRIVACY (Critical): `isBlocked` suppresses the OUTBOUND receipt for any message
 * whose author this device has blocked/revoked, so opening a thread after blocking
 * someone never parks activity metadata back to them. The read marker STILL
 * advances (unread clears locally), so blocking stops the signal, not the local
 * read state. Blocking a peer must stop all outbound signal (mirrors the send
 * path, which already filters revoked recipients).
 *
 * `isOwnDevice` (Plan 21 Phase 10 Fix 1): a message authored by one of THIS user's
 * OWN linked devices (a mirrored copy of my own message) must NEVER emit a receipt.
 * Its author key differs from selfDeviceId (different device, same identity anchor),
 * so the selfDeviceId check alone does not catch it; without this, opening a thread
 * would emit a real signed delivered/read receipt to my own other device for my own
 * message. The read marker still advances so unread clears.
 */
export function computeDmReceiptsToEmit(
  messages: readonly DmMessageEvent[],
  selfDeviceId: string,
  lastRead: Hlc,
  readReceiptsEnabled: boolean,
  isBlocked: (deviceId: string) => boolean = () => false,
  isOwnDevice: (deviceId: string) => boolean = () => false,
): DmReceiptsToEmit {
  const state: DmReceiptState = readReceiptsEnabled ? 'read' : 'delivered';
  const toEmit: { messageId: string; state: DmReceiptState }[] = [];
  let maxHlc: Hlc = lastRead;
  let changed = false;
  for (const message of messages) {
    if (compareDmHlc(message.hlc, maxHlc) > 0) {
      maxHlc = message.hlc;
      changed = true;
    }
    if (message.authorDeviceId === selfDeviceId) continue;
    // Never emit a receipt for a message one of my OWN linked devices authored.
    if (isOwnDevice(message.authorDeviceId)) continue;
    if (compareDmHlc(message.hlc, lastRead) <= 0) continue;
    // Never park a receipt to a blocked/revoked author (activity-metadata leak).
    if (isBlocked(message.authorDeviceId)) continue;
    toEmit.push({ messageId: message.id, state });
  }
  return { toEmit, nextLastRead: changed ? maxHlc : null };
}

// ---------------------------------------------------------------------------
// ensureDirectConversation: open (or create) the 1:1 conversation.
//
// There is no SyncProvider method to open a 1:1 conversation (queueDmMessage
// assumes the conversation + participants already exist), so the screen composes
// one here from the exported dm-core primitives + the pure @mylife/sync
// dmConversationId. dm_ stays device-local; nothing is replicated. For a
// single-device friend the identity anchor is the device key (plan §Data Model),
// which is exactly what the receiving bootstrap uses, so the ids converge.
// ---------------------------------------------------------------------------

export interface DirectPeer {
  deviceId: string;
  dhPublicKey: string;
}

export function ensureDirectConversation(
  db: DatabaseAdapter,
  self: DeviceIdentity,
  peer: DirectPeer,
  now: string = new Date().toISOString(),
): string {
  ensureDmTables(db);
  const conversationId = dmConversationId(self.publicKey, peer.deviceId);
  const existing = getDmConversation(db, conversationId);
  if (!existing) {
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
      created_at: now,
      updated_at: now,
    });
  } else if (existing.archived) {
    setDmConversationArchived(db, conversationId, false, now);
  }

  upsertDmParticipant(db, {
    conversation_id: conversationId,
    device_id: self.publicKey,
    identity_anchor: self.publicKey,
    is_self: 1,
    role: 'member',
    dh_public_key: self.dhPublicKey,
    joined_at: now,
    removed_at: null,
  });
  upsertDmParticipant(db, {
    conversation_id: conversationId,
    device_id: peer.deviceId,
    identity_anchor: peer.deviceId,
    is_self: 0,
    role: 'member',
    dh_public_key: peer.dhPublicKey,
    joined_at: now,
    removed_at: null,
  });
  return conversationId;
}
