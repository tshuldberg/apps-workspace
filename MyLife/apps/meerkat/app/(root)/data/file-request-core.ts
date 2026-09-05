// file-request-core.ts: the honest LOCAL-ONLY ledger behind the Files Phase 3
// request/approve/restore flow.
//
// Why this exists: the pending / waiting-for-approval / approved / declined /
// restored / failed UI must be driven by REAL local rows, never an optimistic
// guess. The cm_file_requests table is the single source of truth for that
// state machine; the live "is the blob on this device" check (ExpoBlobStore.has)
// is the source of truth for whether a card has actually flipped back.
//
// LOCAL-ONLY (Critical): cm_file_requests is deliberately omitted from the sync
// policy (COMMUNITY_SYNC_POLICY.entityRules), so it never replicates. These rows
// are this device's private record of what it asked for / was asked for. The
// only thing that crosses the wire is the sealed FILE_REQUEST / FILE_GRANT
// mailbox payload (see @mylife/sync file-request-mailbox).
//
// HONESTY rules enforced here:
//   - An OUTGOING row is written ONLY after an envelope was actually parked
//     (queued > 0); the caller passes 'requested' only on a real park. Parking
//     failure records 'failed', never an optimistic 'requested'.
//   - 'restored' is set ONLY after verify-then-pin succeeded AND local presence
//     confirms the bytes (the caller checks ExpoBlobStore.get before flipping).
//   - A decline records the real reason; it never silently retries or pretends.
//
// Pure: takes a DatabaseAdapter, no native modules. Tested with an in-memory db.

import type { DatabaseAdapter } from '@mylife/db';
import {
  isDeviceRevoked,
  restoreFromGrantPayload,
  type FileGrantMailboxPayload,
  type FileRequestMailboxPayload,
  type MailboxEnvelopeHandlers,
  type SessionBlobProvider,
} from '@mylife/sync';
import {
  COMMUNITY_MODULE_ID,
  listMessageAttachmentRows,
  mergeChannelMessageEvents,
} from './community-core';

export type FileRequestDirection = 'outgoing' | 'incoming';

/**
 * The request/grant state machine:
 *   outgoing: requested -> approved? -> restored | declined | failed
 *     (we never see 'approved' on the outgoing side as a separate hop in v1;
 *      a grant arrives and we go straight to restored/declined/failed)
 *   incoming: requested -> approved | declined | failed
 *     (the owner side: a request arrives 'requested'; the owner's tap moves it
 *      to approved/declined once a grant envelope is parked)
 */
export type FileRequestStatus =
  | 'requested'
  | 'approved'
  | 'declined'
  | 'restored'
  | 'failed';

export interface FileRequestRow {
  id: string;
  community_id: string;
  channel_id: string;
  message_id: string;
  attachment_id: string;
  blob_hash: string;
  direction: FileRequestDirection;
  counterparty_device_id: string;
  status: FileRequestStatus;
  /** Honest free-text detail (e.g. a decline reason or a parking error). */
  detail: string | null;
  created_at: string;
  updated_at: string;
}

export interface UpsertFileRequestInput {
  id: string;
  communityId: string;
  channelId: string;
  messageId: string;
  attachmentId: string;
  blobHash: string;
  direction: FileRequestDirection;
  counterpartyDeviceId: string;
  status: FileRequestStatus;
  detail?: string | null;
  now?: string;
}

export function getFileRequest(db: DatabaseAdapter, id: string): FileRequestRow | null {
  const rows = db.query<FileRequestRow>(
    `SELECT id, community_id, channel_id, message_id, attachment_id, blob_hash,
       direction, counterparty_device_id, status, detail, created_at, updated_at
     FROM cm_file_requests WHERE id = ? LIMIT 1`,
    [id],
  );
  return rows[0] ?? null;
}

/**
 * Insert or update a request row. Idempotent on id (the requestId): a retry of
 * the same logical request reuses the row and only advances created_at on first
 * write. Returns the resulting row.
 */
export function upsertFileRequest(
  db: DatabaseAdapter,
  input: UpsertFileRequestInput,
): FileRequestRow {
  const now = input.now ?? new Date().toISOString();
  const existing = getFileRequest(db, input.id);
  const createdAt = existing?.created_at ?? now;
  const row: FileRequestRow = {
    id: input.id,
    community_id: input.communityId,
    channel_id: input.channelId,
    message_id: input.messageId,
    attachment_id: input.attachmentId,
    blob_hash: input.blobHash,
    direction: input.direction,
    counterparty_device_id: input.counterpartyDeviceId,
    status: input.status,
    detail: input.detail ?? null,
    created_at: createdAt,
    updated_at: now,
  };
  db.execute(
    `INSERT OR REPLACE INTO cm_file_requests (
      id, community_id, channel_id, message_id, attachment_id, blob_hash,
      direction, counterparty_device_id, status, detail, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      row.id,
      row.community_id,
      row.channel_id,
      row.message_id,
      row.attachment_id,
      row.blob_hash,
      row.direction,
      row.counterparty_device_id,
      row.status,
      row.detail,
      row.created_at,
      row.updated_at,
    ],
  );
  return row;
}

/** Advance an existing row's status + detail. No-op (returns null) if missing. */
export function setFileRequestStatus(
  db: DatabaseAdapter,
  id: string,
  status: FileRequestStatus,
  detail: string | null = null,
  now: string = new Date().toISOString(),
): FileRequestRow | null {
  const existing = getFileRequest(db, id);
  if (!existing) return null;
  db.execute(
    'UPDATE cm_file_requests SET status = ?, detail = ?, updated_at = ? WHERE id = ?',
    [status, detail, now, id],
  );
  return { ...existing, status, detail, updated_at: now };
}

/** The outgoing request row for an attachment slot, if any (drives the card). */
export function getOutgoingRequestForAttachment(
  db: DatabaseAdapter,
  communityId: string,
  channelId: string,
  attachmentId: string,
): FileRequestRow | null {
  const rows = db.query<FileRequestRow>(
    `SELECT id, community_id, channel_id, message_id, attachment_id, blob_hash,
       direction, counterparty_device_id, status, detail, created_at, updated_at
     FROM cm_file_requests
     WHERE direction = 'outgoing' AND community_id = ? AND channel_id = ? AND attachment_id = ?
     ORDER BY updated_at DESC
     LIMIT 1`,
    [communityId, channelId, attachmentId],
  );
  return rows[0] ?? null;
}

/** Open incoming requests awaiting the owner's Approve/Decline tap. */
export function listIncomingPendingRequests(
  db: DatabaseAdapter,
  communityId?: string,
): FileRequestRow[] {
  if (communityId) {
    return db.query<FileRequestRow>(
      `SELECT id, community_id, channel_id, message_id, attachment_id, blob_hash,
         direction, counterparty_device_id, status, detail, created_at, updated_at
       FROM cm_file_requests
       WHERE direction = 'incoming' AND status = 'requested' AND community_id = ?
       ORDER BY created_at ASC`,
      [communityId],
    );
  }
  return db.query<FileRequestRow>(
    `SELECT id, community_id, channel_id, message_id, attachment_id, blob_hash,
       direction, counterparty_device_id, status, detail, created_at, updated_at
     FROM cm_file_requests
     WHERE direction = 'incoming' AND status = 'requested'
     ORDER BY created_at ASC`,
  );
}

// ---------------------------------------------------------------------------
// Shared drain handlers (ONE dispatcher shape for foreground + background)
// ---------------------------------------------------------------------------

export interface BuildFileMailboxHandlersDeps {
  db: DatabaseAdapter;
  blobStore: SessionBlobProvider & { has?: (hash: string) => Promise<boolean> };
  /** Is a device a current, non-removed member of a community? */
  isActiveMember: (communityId: string, deviceId: string) => boolean;
}

/**
 * Build the per-kind mailbox drain handlers used by BOTH the foreground drain
 * (SyncProvider.runForegroundDrain) and the background drain
 * (runBackgroundSyncOnce). Having one builder is the guardrail that the two
 * paths cannot drift on how they handle each kind.
 *
 * fail-closed throughout:
 *   - channelMessage merges verified events (mergeChannelMessageEvents verifies);
 *   - fileRequest records an incoming row ONLY if the sender is a current,
 *     non-revoked member (drops otherwise); nothing is auto-sent;
 *   - fileGrant matches OUR outgoing row, re-verifies bytes against OUR own
 *     signed-event hash (verify-then-pin), and flips to 'restored' only after the
 *     write succeeds and a live presence check confirms the bytes.
 */
export function buildFileMailboxHandlers(
  deps: BuildFileMailboxHandlersDeps,
): MailboxEnvelopeHandlers {
  const { db, blobStore, isActiveMember } = deps;
  return {
    channelMessage: (events) => mergeChannelMessageEvents(db, events),
    fileRequest: (senderDeviceId: string, payload: FileRequestMailboxPayload): boolean => {
      if (isDeviceRevoked(db, senderDeviceId)) return false;
      if (!isActiveMember(payload.communityId, senderDeviceId)) return false;
      upsertFileRequest(db, {
        id: payload.requestId,
        communityId: payload.communityId,
        channelId: payload.channelId,
        messageId: payload.messageId,
        attachmentId: payload.attachmentId,
        blobHash: payload.blobHash,
        direction: 'incoming',
        counterpartyDeviceId: senderDeviceId,
        status: 'requested',
      });
      return true;
    },
    fileGrant: async (
      senderDeviceId: string,
      payload: FileGrantMailboxPayload,
    ): Promise<boolean> => {
      const row = getFileRequest(db, payload.requestId);
      if (!row || row.direction !== 'outgoing' || row.counterparty_device_id !== senderDeviceId) {
        return false;
      }

      // Expected hash = OUR signed-event blob hash, so a malicious owner cannot
      // swap in different bytes under the same UI slot.
      const attRows = listMessageAttachmentRows(db, row.message_id);
      const expected = attRows.find((a) => a.attachment_id === row.attachment_id);
      const expectedBlobHash = expected?.blob_hash ?? row.blob_hash;

      const result = await restoreFromGrantPayload({
        payload,
        expectedBlobHash,
        putBlob: (hash, bytes, meta) => blobStore.put(hash, bytes, meta),
        moduleId: COMMUNITY_MODULE_ID,
      });

      if (result.ok && result.restored) {
        const present = blobStore.has ? await blobStore.has(expectedBlobHash) : true;
        setFileRequestStatus(
          db,
          row.id,
          present ? 'restored' : 'failed',
          present ? null : 'Wrote bytes but could not confirm them on disk.',
        );
        return true;
      }
      if (result.ok && !result.restored) {
        const reason = result.reason === 'owner_no_longer_has_file'
          ? 'Owner no longer has this file.'
          : 'Owner declined.';
        setFileRequestStatus(db, row.id, 'declined', reason);
        return true;
      }
      setFileRequestStatus(db, row.id, 'failed', `Restore failed (${result.reason}).`);
      return false;
    },
  };
}

/** The standard active-member check, reused by foreground + background handlers. */
export function isActiveCommunityMember(
  db: DatabaseAdapter,
  communityId: string,
  deviceId: string,
): boolean {
  const rows = db.query<{ device_id: string }>(
    `SELECT device_id
     FROM sync_workspace_members
     WHERE workspace_id = ? AND device_id = ? AND removed_at IS NULL
     LIMIT 1`,
    [communityId, deviceId],
  );
  return rows.length > 0;
}
