// Direct-message local store (Plan 21 Phase 3): the device-local SQLite store +
// helpers for 1:1 (and future group) DMs.
//
// CRITICAL: dm_ tables are LOCAL-ONLY, never replicate. `dm` is deliberately
// ABSENT from MEERKAT_SYNC_PREFIXES and MEERKAT_SYNC_POLICIES (sync-core.ts):
// because dm_ resolves to no module under the real prefix map,
// applyReceivedDocumentChanges rejects any inbound dm_ row (unknown_table).
// DM confidentiality comes from the mailbox seal in flight (dm-mailbox.ts,
// dm-receipt.ts) plus the platform secure store at rest, not from session
// replication. Do not add a dm entry to the sync prefix/policy maps.

import type { DatabaseAdapter } from '@mylife/db';
import {
  resolveDmMessages,
  verifyDmMessage,
  type DmMessageAttachment,
  type DmMessageEvent,
  type Hlc,
} from '@mylife/sync';

// --- table name constants ---

export const DM_CONVERSATIONS_TABLE = 'dm_conversations';
export const DM_PARTICIPANTS_TABLE = 'dm_participants';
export const DM_OWN_DEVICES_TABLE = 'dm_own_devices';
export const DM_MESSAGES_TABLE = 'dm_messages';
export const DM_MESSAGE_ATTACHMENTS_TABLE = 'dm_message_attachments';
export const DM_DELIVERY_TABLE = 'dm_delivery';
export const DM_READ_STATE_TABLE = 'dm_read_state';
export const DM_REPORTS_TABLE = 'dm_reports';

const CREATE_DM_CONVERSATIONS = `
CREATE TABLE IF NOT EXISTS dm_conversations (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('direct','group')),
  title TEXT,
  group_workspace_id TEXT,
  admin_device_id TEXT,
  current_epoch INTEGER NOT NULL DEFAULT 0,
  descriptor_json TEXT,
  feed_opt_in INTEGER NOT NULL DEFAULT 0,
  archived INTEGER NOT NULL DEFAULT 0,
  muted INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
)`;

const CREATE_DM_PARTICIPANTS = `
CREATE TABLE IF NOT EXISTS dm_participants (
  conversation_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  identity_anchor TEXT NOT NULL,
  is_self INTEGER NOT NULL DEFAULT 0,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member','admin')),
  dh_public_key TEXT NOT NULL,
  joined_at TEXT NOT NULL,
  removed_at TEXT,
  PRIMARY KEY (conversation_id, device_id)
)`;

const CREATE_DM_OWN_DEVICES = `
CREATE TABLE IF NOT EXISTS dm_own_devices (
  device_id TEXT PRIMARY KEY,
  identity_anchor TEXT NOT NULL,
  dh_public_key TEXT NOT NULL,
  linked_at TEXT NOT NULL
)`;

const CREATE_DM_MESSAGES = `
CREATE TABLE IF NOT EXISTS dm_messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  author_device_id TEXT NOT NULL,
  body TEXT NOT NULL,
  attachments_json TEXT NOT NULL DEFAULT '[]',
  hlc_wall TEXT NOT NULL,
  hlc_counter INTEGER NOT NULL,
  supersedes_id TEXT,
  supersedes_deleted INTEGER,
  intent TEXT,
  signature TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
)`;

const CREATE_DM_MESSAGES_INDEX = `
CREATE INDEX IF NOT EXISTS dm_messages_conv
  ON dm_messages (conversation_id, hlc_wall, hlc_counter, author_device_id)`;

const CREATE_DM_MESSAGE_ATTACHMENTS = `
CREATE TABLE IF NOT EXISTS dm_message_attachments (
  id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL,
  conversation_id TEXT NOT NULL,
  attachment_id TEXT NOT NULL,
  blob_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size INTEGER NOT NULL,
  updated_at TEXT NOT NULL
)`;

const CREATE_DM_DELIVERY = `
CREATE TABLE IF NOT EXISTS dm_delivery (
  message_id TEXT NOT NULL,
  peer_device_id TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('queued','parked','delivered','read','failed')),
  state_at TEXT NOT NULL,
  receipt_sig TEXT,
  PRIMARY KEY (message_id, peer_device_id)
)`;

const CREATE_DM_READ_STATE = `
CREATE TABLE IF NOT EXISTS dm_read_state (
  conversation_id TEXT PRIMARY KEY,
  last_read_hlc_wall TEXT NOT NULL DEFAULT '',
  last_read_hlc_counter INTEGER NOT NULL DEFAULT 0,
  read_receipts_enabled INTEGER NOT NULL DEFAULT 1
)`;

const CREATE_DM_REPORTS = `
CREATE TABLE IF NOT EXISTS dm_reports (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  message_id TEXT,
  reported_device_id TEXT NOT NULL,
  reason TEXT,
  created_at TEXT NOT NULL
)`;

/** Create every dm_ table. Idempotent. */
export function ensureDmTables(db: DatabaseAdapter): void {
  db.execute(CREATE_DM_CONVERSATIONS);
  db.execute(CREATE_DM_PARTICIPANTS);
  db.execute(CREATE_DM_OWN_DEVICES);
  db.execute(CREATE_DM_MESSAGES);
  db.execute(CREATE_DM_MESSAGES_INDEX);
  db.execute(CREATE_DM_MESSAGE_ATTACHMENTS);
  db.execute(CREATE_DM_DELIVERY);
  db.execute(CREATE_DM_READ_STATE);
  db.execute(CREATE_DM_REPORTS);
}

// ---------------------------------------------------------------------------
// Conversations
// ---------------------------------------------------------------------------

export interface DmConversationRow {
  id: string;
  kind: 'direct' | 'group';
  title: string | null;
  group_workspace_id: string | null;
  admin_device_id: string | null;
  current_epoch: number;
  descriptor_json: string | null;
  feed_opt_in: number;
  archived: number;
  muted: number;
  created_at: string;
  updated_at: string;
}

export function upsertDmConversation(db: DatabaseAdapter, conv: DmConversationRow): void {
  db.execute(
    `INSERT OR REPLACE INTO dm_conversations (
      id, kind, title, group_workspace_id, admin_device_id, current_epoch,
      descriptor_json, feed_opt_in, archived, muted, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      conv.id,
      conv.kind,
      conv.title,
      conv.group_workspace_id,
      conv.admin_device_id,
      conv.current_epoch,
      conv.descriptor_json,
      conv.feed_opt_in,
      conv.archived,
      conv.muted,
      conv.created_at,
      conv.updated_at,
    ],
  );
}

export function getDmConversation(db: DatabaseAdapter, id: string): DmConversationRow | null {
  const rows = db.query<DmConversationRow>(
    `SELECT id, kind, title, group_workspace_id, admin_device_id, current_epoch,
       descriptor_json, feed_opt_in, archived, muted, created_at, updated_at
     FROM dm_conversations WHERE id = ?`,
    [id],
  );
  return rows[0] ?? null;
}

export function listDmConversations(
  db: DatabaseAdapter,
  options: { includeArchived?: boolean } = {},
): DmConversationRow[] {
  const sql = options.includeArchived
    ? `SELECT id, kind, title, group_workspace_id, admin_device_id, current_epoch,
         descriptor_json, feed_opt_in, archived, muted, created_at, updated_at
       FROM dm_conversations ORDER BY updated_at DESC`
    : `SELECT id, kind, title, group_workspace_id, admin_device_id, current_epoch,
         descriptor_json, feed_opt_in, archived, muted, created_at, updated_at
       FROM dm_conversations WHERE archived = 0 ORDER BY updated_at DESC`;
  return db.query<DmConversationRow>(sql);
}

function touchDmConversation(db: DatabaseAdapter, conversationId: string, now: string): void {
  db.execute(`UPDATE dm_conversations SET updated_at = ? WHERE id = ?`, [now, conversationId]);
}

export function setDmConversationArchived(
  db: DatabaseAdapter,
  conversationId: string,
  archived: boolean,
  now: string = new Date().toISOString(),
): void {
  db.execute(`UPDATE dm_conversations SET archived = ?, updated_at = ? WHERE id = ?`, [
    archived ? 1 : 0,
    now,
    conversationId,
  ]);
}

export function setDmConversationMuted(
  db: DatabaseAdapter,
  conversationId: string,
  muted: boolean,
  now: string = new Date().toISOString(),
): void {
  db.execute(`UPDATE dm_conversations SET muted = ?, updated_at = ? WHERE id = ?`, [
    muted ? 1 : 0,
    now,
    conversationId,
  ]);
}

export function setDmConversationFeedOptIn(
  db: DatabaseAdapter,
  conversationId: string,
  optIn: boolean,
  now: string = new Date().toISOString(),
): void {
  db.execute(`UPDATE dm_conversations SET feed_opt_in = ?, updated_at = ? WHERE id = ?`, [
    optIn ? 1 : 0,
    now,
    conversationId,
  ]);
}

// ---------------------------------------------------------------------------
// Participants
// ---------------------------------------------------------------------------

export interface DmParticipantRow {
  conversation_id: string;
  device_id: string;
  identity_anchor: string;
  is_self: number;
  role: 'member' | 'admin';
  dh_public_key: string;
  joined_at: string;
  removed_at: string | null;
}

export function upsertDmParticipant(db: DatabaseAdapter, row: DmParticipantRow): void {
  db.execute(
    `INSERT OR REPLACE INTO dm_participants (
      conversation_id, device_id, identity_anchor, is_self, role, dh_public_key, joined_at, removed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      row.conversation_id,
      row.device_id,
      row.identity_anchor,
      row.is_self,
      row.role,
      row.dh_public_key,
      row.joined_at,
      row.removed_at,
    ],
  );
}

export function listDmParticipants(
  db: DatabaseAdapter,
  conversationId: string,
  options: { includeRemoved?: boolean } = {},
): DmParticipantRow[] {
  const sql = options.includeRemoved
    ? `SELECT conversation_id, device_id, identity_anchor, is_self, role, dh_public_key, joined_at, removed_at
       FROM dm_participants WHERE conversation_id = ?`
    : `SELECT conversation_id, device_id, identity_anchor, is_self, role, dh_public_key, joined_at, removed_at
       FROM dm_participants WHERE conversation_id = ? AND removed_at IS NULL`;
  return db.query<DmParticipantRow>(sql, [conversationId]);
}

export function setDmParticipantRemoved(
  db: DatabaseAdapter,
  conversationId: string,
  deviceId: string,
  removedAt: string = new Date().toISOString(),
): void {
  db.execute(
    `UPDATE dm_participants SET removed_at = ? WHERE conversation_id = ? AND device_id = ?`,
    [removedAt, conversationId, deviceId],
  );
}

// ---------------------------------------------------------------------------
// Own devices (fan-out targets for this user's other devices)
// ---------------------------------------------------------------------------

export interface DmOwnDeviceRow {
  device_id: string;
  identity_anchor: string;
  dh_public_key: string;
  linked_at: string;
}

export function upsertDmOwnDevice(db: DatabaseAdapter, row: DmOwnDeviceRow): void {
  db.execute(
    `INSERT OR REPLACE INTO dm_own_devices (device_id, identity_anchor, dh_public_key, linked_at)
     VALUES (?, ?, ?, ?)`,
    [row.device_id, row.identity_anchor, row.dh_public_key, row.linked_at],
  );
}

/**
 * Revoke an own-device link. Plan 52: expelling a device from the person group
 * MUST also drop this row, otherwise the expelled device still counts as "one
 * of your devices" at the person-group trust gate and can propose itself back
 * in -- defeating rotation-on-removal entirely.
 */
export function removeDmOwnDevice(db: DatabaseAdapter, deviceId: string): void {
  db.execute(`DELETE FROM dm_own_devices WHERE device_id = ?`, [deviceId]);
}

export function listDmOwnDevices(db: DatabaseAdapter): DmOwnDeviceRow[] {
  return db.query<DmOwnDeviceRow>(
    `SELECT device_id, identity_anchor, dh_public_key, linked_at FROM dm_own_devices ORDER BY linked_at ASC`,
  );
}

/**
 * The list of this user's OTHER own devices a sent DM should be re-sealed to
 * (the fan-out target list). A pure read from dm_own_devices, excluding
 * selfDeviceId.
 */
export function resolveOwnDeviceMirrorTargets(
  db: DatabaseAdapter,
  selfDeviceId: string,
): DmOwnDeviceRow[] {
  return listDmOwnDevices(db).filter((row) => row.device_id !== selfDeviceId);
}

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

export interface DmMessageRow {
  id: string;
  conversation_id: string;
  author_device_id: string;
  body: string;
  attachments_json: string;
  hlc_wall: string;
  hlc_counter: number;
  supersedes_id: string | null;
  supersedes_deleted: number | null;
  intent: string | null;
  signature: string;
  created_at: string;
  updated_at: string;
}

export interface DmMessageAttachmentRow {
  id: string;
  message_id: string;
  conversation_id: string;
  attachment_id: string;
  blob_hash: string;
  name: string;
  mime_type: string;
  size: number;
  updated_at: string;
}

export interface MergeDmEventsResult {
  inserted: number;
  skipped: number;
  invalid: number;
}

function isDmMessageAttachmentValue(value: unknown): value is DmMessageAttachment {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.id === 'string'
    && typeof candidate.blobHash === 'string'
    && typeof candidate.name === 'string'
    && typeof candidate.mimeType === 'string'
    && typeof candidate.size === 'number'
    && Number.isFinite(candidate.size)
    && candidate.size >= 0;
}

function parseDmAttachmentsJson(json: string): DmMessageAttachment[] {
  try {
    const value = JSON.parse(json) as unknown;
    if (!Array.isArray(value)) return [];
    return value.filter(isDmMessageAttachmentValue);
  } catch {
    return [];
  }
}

export function dmMessageRowFromEvent(event: DmMessageEvent): DmMessageRow {
  return {
    id: event.id,
    conversation_id: event.conversationId,
    author_device_id: event.authorDeviceId,
    body: event.body,
    attachments_json: JSON.stringify(event.attachments ?? []),
    hlc_wall: event.hlc.wall,
    hlc_counter: event.hlc.counter,
    supersedes_id: event.supersedes?.id ?? null,
    supersedes_deleted: event.supersedes ? (event.supersedes.deleted ? 1 : 0) : null,
    intent: event.intent ?? null,
    signature: event.signature,
    created_at: event.hlc.wall,
    updated_at: event.hlc.wall,
  };
}

export function dmMessageEventFromRow(row: DmMessageRow): DmMessageEvent {
  const event: DmMessageEvent = {
    version: 1,
    id: row.id,
    conversationId: row.conversation_id,
    authorDeviceId: row.author_device_id,
    body: row.body,
    attachments: parseDmAttachmentsJson(row.attachments_json),
    hlc: { wall: row.hlc_wall, counter: row.hlc_counter },
    signature: row.signature,
  };
  if (row.supersedes_id) {
    event.supersedes = { id: row.supersedes_id, deleted: row.supersedes_deleted === 1 };
  }
  if (row.intent === 'message' || row.intent === 'react') {
    event.intent = row.intent;
  }
  return event;
}

function insertDmMessageRow(db: DatabaseAdapter, event: DmMessageEvent): void {
  const row = dmMessageRowFromEvent(event);
  db.execute(
    `INSERT OR IGNORE INTO dm_messages (
      id, conversation_id, author_device_id, body, attachments_json,
      hlc_wall, hlc_counter, supersedes_id, supersedes_deleted, intent,
      signature, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      row.id,
      row.conversation_id,
      row.author_device_id,
      row.body,
      row.attachments_json,
      row.hlc_wall,
      row.hlc_counter,
      row.supersedes_id,
      row.supersedes_deleted,
      row.intent,
      row.signature,
      row.created_at,
      row.updated_at,
    ],
  );
}

function insertDmMessageAttachmentRows(db: DatabaseAdapter, event: DmMessageEvent): void {
  for (const attachment of event.attachments ?? []) {
    db.execute(
      `INSERT OR IGNORE INTO dm_message_attachments (
        id, message_id, conversation_id, attachment_id, blob_hash, name, mime_type, size, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        `${event.id}:${attachment.id}`,
        event.id,
        event.conversationId,
        attachment.id,
        attachment.blobHash,
        attachment.name,
        attachment.mimeType,
        attachment.size,
        event.hlc.wall,
      ],
    );
  }
}

/**
 * Merge a batch of DM events into the local store. INSERT OR IGNORE by content
 * id: idempotent on re-merge. Verifies each event's signature and DROPS any
 * that fail (fail-closed). Touches the conversation's updated_at when at least
 * one event is newly inserted.
 */
export function mergeDmEvents(
  db: DatabaseAdapter,
  conversationId: string,
  events: readonly DmMessageEvent[],
): MergeDmEventsResult {
  let inserted = 0;
  let skipped = 0;
  let invalid = 0;
  let latestWall: string | null = null;

  for (const event of events) {
    if (event.conversationId !== conversationId || !verifyDmMessage(event)) {
      invalid += 1;
      continue;
    }

    const existing = db.query<{ id: string }>('SELECT id FROM dm_messages WHERE id = ? LIMIT 1', [event.id]);
    if (existing.length > 0) {
      skipped += 1;
      continue;
    }

    insertDmMessageRow(db, event);
    insertDmMessageAttachmentRows(db, event);
    inserted += 1;
    if (!latestWall || event.hlc.wall > latestWall) latestWall = event.hlc.wall;
  }

  if (inserted > 0 && latestWall) {
    touchDmConversation(db, conversationId, latestWall);
  }

  return { inserted, skipped, invalid };
}

export function listDmMessageAttachmentRows(
  db: DatabaseAdapter,
  messageId: string,
): DmMessageAttachmentRow[] {
  return db.query<DmMessageAttachmentRow>(
    `SELECT id, message_id, conversation_id, attachment_id, blob_hash, name, mime_type, size, updated_at
     FROM dm_message_attachments WHERE message_id = ? ORDER BY id ASC`,
    [messageId],
  );
}

/** A single message row by id, or null. Used to resolve a message's author device for receipts. */
export function getDmMessageRow(db: DatabaseAdapter, messageId: string): DmMessageRow | null {
  const rows = db.query<DmMessageRow>(
    `SELECT id, conversation_id, author_device_id, body, attachments_json,
       hlc_wall, hlc_counter, supersedes_id, supersedes_deleted, intent,
       signature, created_at, updated_at
     FROM dm_messages WHERE id = ? LIMIT 1`,
    [messageId],
  );
  return rows[0] ?? null;
}

/**
 * The highest HLC across a conversation's stored messages, or null when empty.
 * Used to derive the next outbound message's HLC (mirrors community-core's
 * highestHlc for channel messages).
 */
export function highestDmHlc(db: DatabaseAdapter, conversationId: string): Hlc | null {
  const rows = db.query<{ hlc_wall: string; hlc_counter: number }>(
    `SELECT hlc_wall, hlc_counter
     FROM dm_messages
     WHERE conversation_id = ?
     ORDER BY hlc_wall DESC, hlc_counter DESC, author_device_id DESC, id DESC
     LIMIT 1`,
    [conversationId],
  );
  const row = rows[0];
  return row ? { wall: row.hlc_wall, counter: row.hlc_counter } : null;
}

/** Raw, verified DM events for a conversation, in HLC order. Re-verifies on read (fail-closed). */
export function listDmMessageEvents(db: DatabaseAdapter, conversationId: string): DmMessageEvent[] {
  const rows = db.query<DmMessageRow>(
    `SELECT id, conversation_id, author_device_id, body, attachments_json,
       hlc_wall, hlc_counter, supersedes_id, supersedes_deleted, intent,
       signature, created_at, updated_at
     FROM dm_messages WHERE conversation_id = ?`,
    [conversationId],
  );
  return rows
    .map(dmMessageEventFromRow)
    .filter((event) => verifyDmMessage(event));
}

/** The visible message list: raw events with edit/delete supersedes resolved. */
export function listDmMessages(db: DatabaseAdapter, conversationId: string): DmMessageEvent[] {
  return resolveDmMessages(listDmMessageEvents(db, conversationId));
}

export interface DeletedDmMessage {
  messageId: string;
  authorDeviceId: string;
  /** Blob hashes of the deleted message's attachments (so a caller can unpin cached bytes). */
  blobHashes: string[];
}

/**
 * Hard-delete a DM message (Plan 21 Phase 8 disappearing/shred). Overwrites the
 * body + attachments in place first (best-effort local scrub before the row is
 * removed), then deletes the message row, its attachment metadata, and its
 * delivery rows. Returns the deleted row's author + attachment blob hashes, or
 * null if the message did not exist. The blob bytes themselves live in the blob
 * store; the caller unpins them via the returned hashes.
 */
export function deleteDmMessageRow(db: DatabaseAdapter, messageId: string): DeletedDmMessage | null {
  const row = getDmMessageRow(db, messageId);
  if (!row) return null;
  const blobHashes = listDmMessageAttachmentRows(db, messageId).map((a) => a.blob_hash);
  db.execute(`UPDATE dm_messages SET body = '', attachments_json = '[]' WHERE id = ?`, [messageId]);
  db.execute(`DELETE FROM dm_message_attachments WHERE message_id = ?`, [messageId]);
  db.execute(`DELETE FROM dm_messages WHERE id = ?`, [messageId]);
  db.execute(`DELETE FROM dm_delivery WHERE message_id = ?`, [messageId]);
  return { messageId, authorDeviceId: row.author_device_id, blobHashes };
}

// ---------------------------------------------------------------------------
// Delivery / read receipts (per message, per peer device)
// ---------------------------------------------------------------------------

export type DmDeliveryState = 'queued' | 'parked' | 'delivered' | 'read' | 'failed';

export interface DmDeliveryRow {
  message_id: string;
  peer_device_id: string;
  state: DmDeliveryState;
  state_at: string;
  receipt_sig: string | null;
}

// Monotonic progress rank: a transition is applied only when it does not move
// the state backward (e.g. a stale 'delivered' arriving after 'read' is ignored).
const DM_DELIVERY_RANK: Record<DmDeliveryState, number> = {
  queued: 0,
  parked: 1,
  failed: 1,
  delivered: 2,
  read: 3,
};

function findDmDeliveryRow(
  db: DatabaseAdapter,
  messageId: string,
  peerDeviceId: string,
): DmDeliveryRow | null {
  const rows = db.query<DmDeliveryRow>(
    `SELECT message_id, peer_device_id, state, state_at, receipt_sig
     FROM dm_delivery WHERE message_id = ? AND peer_device_id = ? LIMIT 1`,
    [messageId, peerDeviceId],
  );
  return rows[0] ?? null;
}

/**
 * Transition the per-(message, peer) delivery state. Only advances on real
 * forward progress: a transition ranked below the current state is ignored
 * (e.g. 'read' is never regressed back to 'delivered').
 */
export function setDmDelivery(
  db: DatabaseAdapter,
  messageId: string,
  peerDeviceId: string,
  state: DmDeliveryState,
  stateAt: string,
  receiptSig: string | null = null,
): DmDeliveryRow {
  const existing = findDmDeliveryRow(db, messageId, peerDeviceId);
  if (existing && DM_DELIVERY_RANK[state] < DM_DELIVERY_RANK[existing.state]) {
    return existing;
  }

  const row: DmDeliveryRow = {
    message_id: messageId,
    peer_device_id: peerDeviceId,
    state,
    state_at: stateAt,
    receipt_sig: receiptSig,
  };
  db.execute(
    `INSERT OR REPLACE INTO dm_delivery (message_id, peer_device_id, state, state_at, receipt_sig)
     VALUES (?, ?, ?, ?, ?)`,
    [row.message_id, row.peer_device_id, row.state, row.state_at, row.receipt_sig],
  );
  return row;
}

/** Delivery state for a message across every recipient device. */
export function getDmDelivery(db: DatabaseAdapter, messageId: string): DmDeliveryRow[] {
  return db.query<DmDeliveryRow>(
    `SELECT message_id, peer_device_id, state, state_at, receipt_sig
     FROM dm_delivery WHERE message_id = ? ORDER BY peer_device_id ASC`,
    [messageId],
  );
}

// ---------------------------------------------------------------------------
// Read state + unread count
// ---------------------------------------------------------------------------

export interface DmReadStateRow {
  conversation_id: string;
  last_read_hlc_wall: string;
  last_read_hlc_counter: number;
  read_receipts_enabled: number;
}

const DEFAULT_DM_READ_STATE: Omit<DmReadStateRow, 'conversation_id'> = {
  last_read_hlc_wall: '',
  last_read_hlc_counter: 0,
  read_receipts_enabled: 1,
};

/** Read state for a conversation, defaulting to "nothing read yet, receipts on" when absent. */
export function getDmReadState(db: DatabaseAdapter, conversationId: string): DmReadStateRow {
  const rows = db.query<DmReadStateRow>(
    `SELECT conversation_id, last_read_hlc_wall, last_read_hlc_counter, read_receipts_enabled
     FROM dm_read_state WHERE conversation_id = ?`,
    [conversationId],
  );
  return rows[0] ?? { conversation_id: conversationId, ...DEFAULT_DM_READ_STATE };
}

export function setDmReadState(
  db: DatabaseAdapter,
  conversationId: string,
  hlcWall: string,
  hlcCounter: number,
): void {
  const existing = getDmReadState(db, conversationId);
  db.execute(
    `INSERT OR REPLACE INTO dm_read_state (
      conversation_id, last_read_hlc_wall, last_read_hlc_counter, read_receipts_enabled
    ) VALUES (?, ?, ?, ?)`,
    [conversationId, hlcWall, hlcCounter, existing.read_receipts_enabled],
  );
}

export function setDmReadReceiptsEnabled(
  db: DatabaseAdapter,
  conversationId: string,
  enabled: boolean,
): void {
  const existing = getDmReadState(db, conversationId);
  db.execute(
    `INSERT OR REPLACE INTO dm_read_state (
      conversation_id, last_read_hlc_wall, last_read_hlc_counter, read_receipts_enabled
    ) VALUES (?, ?, ?, ?)`,
    [conversationId, existing.last_read_hlc_wall, existing.last_read_hlc_counter, enabled ? 1 : 0],
  );
}

function compareHlc(a: Hlc, b: Hlc): number {
  if (a.wall !== b.wall) return a.wall < b.wall ? -1 : 1;
  return a.counter - b.counter;
}

/**
 * Count of visible dm_messages authored by someone OTHER than selfDeviceId
 * whose HLC is strictly greater than the stored last-read HLC.
 */
export function getDmUnreadCount(
  db: DatabaseAdapter,
  conversationId: string,
  selfDeviceId: string,
): number {
  const readState = getDmReadState(db, conversationId);
  const lastRead: Hlc = { wall: readState.last_read_hlc_wall, counter: readState.last_read_hlc_counter };
  const visible = listDmMessages(db, conversationId);
  return visible.filter(
    (event) => event.authorDeviceId !== selfDeviceId && compareHlc(event.hlc, lastRead) > 0,
  ).length;
}

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

export interface DmReportRow {
  id: string;
  conversation_id: string;
  message_id: string | null;
  reported_device_id: string;
  reason: string | null;
  created_at: string;
}

export function recordDmReport(db: DatabaseAdapter, row: DmReportRow): void {
  db.execute(
    `INSERT OR IGNORE INTO dm_reports (id, conversation_id, message_id, reported_device_id, reason, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [row.id, row.conversation_id, row.message_id, row.reported_device_id, row.reason, row.created_at],
  );
}

export function listDmReports(db: DatabaseAdapter, conversationId: string): DmReportRow[] {
  return db.query<DmReportRow>(
    `SELECT id, conversation_id, message_id, reported_device_id, reason, created_at
     FROM dm_reports WHERE conversation_id = ? ORDER BY created_at DESC`,
    [conversationId],
  );
}

// ---------------------------------------------------------------------------
// feed_opt_in guarded read API (Plan 21 Phase 8, frozen seam for Plan 19).
//
// This is the ONLY surface the public-social layer (Plan 19) may consume from
// the DM store. Both functions HARD-FILTER `WHERE feed_opt_in = 1`: nothing is
// ever auto-included (NC-6). Default feed_opt_in = 0 => an empty set. Plan 19
// NEVER reads dm_messages / dm_conversations directly; any change to these
// signatures is a coordinated edit to both plans.
// ---------------------------------------------------------------------------

export interface FeedOptInConversation {
  conversationId: string;
  kind: 'direct' | 'group';
  title: string | null;
  /** Best-available opt-in time: updated_at, which setDmConversationFeedOptIn stamps on the flip. */
  optedInAt: string;
}

/** Conversations the user explicitly opted into the feed (feed_opt_in = 1). Empty by default. */
export function listFeedOptInConversations(db: DatabaseAdapter): FeedOptInConversation[] {
  return db
    .query<{ id: string; kind: 'direct' | 'group'; title: string | null; updated_at: string }>(
      `SELECT id, kind, title, updated_at
       FROM dm_conversations WHERE feed_opt_in = 1 ORDER BY updated_at DESC`,
    )
    .map((row) => ({ conversationId: row.id, kind: row.kind, title: row.title, optedInAt: row.updated_at }));
}

/**
 * Verified DM events for an opted-in conversation with HLC strictly greater than
 * `sinceHlc` (pass null for all), in HLC order. THROWS if the conversation is not
 * opted in (feed_opt_in != 1 or missing), so a caller can never read a private
 * conversation's messages through this seam.
 */
export function getFeedSourceMessages(
  db: DatabaseAdapter,
  conversationId: string,
  sinceHlc: Hlc | null,
): DmMessageEvent[] {
  const rows = db.query<{ feed_opt_in: number }>(
    'SELECT feed_opt_in FROM dm_conversations WHERE id = ?',
    [conversationId],
  );
  if (rows[0]?.feed_opt_in !== 1) {
    throw new Error('getFeedSourceMessages: conversation is not feed-opted-in');
  }
  const events = listDmMessages(db, conversationId);
  if (!sinceHlc) return events;
  return events.filter((event) => compareHlc(event.hlc, sinceHlc) > 0);
}
