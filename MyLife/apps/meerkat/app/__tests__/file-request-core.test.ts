/**
 * file-request-core (Files Phase 3): the LOCAL-ONLY cm_file_requests ledger and
 * the shared mailbox drain handlers.
 *
 * Asserts:
 *   - cm_file_requests state transitions: requested -> approved -> restored and
 *     requested -> declined; idempotent on requestId; created_at stable;
 *   - the shared drain handlers write an INCOMING row only for a current,
 *     non-revoked member (drop otherwise), and restore an OUTGOING row only after
 *     verify-then-pin against OUR own signed-event hash (adversarial bytes are
 *     rejected without a write);
 *   - the table is NOT in the sync prefix map (local-only by construction).
 */

import { afterEach, describe, expect, it } from 'vitest';
import { createInMemoryTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import {
  blobContentHash,
  buildFileGrant,
  createChannelMessage,
  createInMemorySyncSecretStore,
  configureSyncSecretStore,
  fileRequestId,
  generateDeviceIdentity,
  sealFileGrantMailbox,
  type ChannelMessageAttachment,
  type FileGrantMailboxPayload,
  type FileRequestMailboxPayload,
  type SessionBlobProvider,
} from '@mylife/sync';
import {
  COMMUNITY_SYNC_POLICY,
  CM_FILE_REQUESTS_TABLE,
  insertMessageAttachmentRows,
  insertMessageRow,
} from '../(root)/data/community-core';
import { ensureSyncSchema } from '../(root)/data/sync-core';
import { ensureMeerkatTables } from '../(root)/data/db';
import { MEERKAT_SYNC_PREFIXES } from '../(root)/data/sync-core';
import {
  buildFileMailboxHandlers,
  getFileRequest,
  getOutgoingRequestForAttachment,
  isActiveCommunityMember,
  listIncomingPendingRequests,
  setFileRequestStatus,
  upsertFileRequest,
} from '../(root)/data/file-request-core';

const MODULE_ID = 'community';

let testDb: InMemoryTestDatabase | null = null;
afterEach(() => {
  testDb?.close();
  testDb = null;
});

function freshDb(): InMemoryTestDatabase['adapter'] {
  configureSyncSecretStore(createInMemorySyncSecretStore());
  testDb = createInMemoryTestDatabase();
  const db = testDb.adapter;
  ensureMeerkatTables(db);
  ensureSyncSchema(db);
  return db;
}

/** In-memory blob store implementing the SessionBlobProvider + has() seam. */
class MemBlobStore implements SessionBlobProvider {
  private readonly map = new Map<string, Uint8Array>();
  seed(bytes: Uint8Array): string {
    const hash = blobContentHash(bytes);
    this.map.set(hash, bytes);
    return hash;
  }
  get(hash: string): Uint8Array | null {
    return this.map.get(hash) ?? null;
  }
  put(hash: string, bytes: Uint8Array): void {
    if (blobContentHash(bytes) !== hash) throw new Error('hash mismatch');
    this.map.set(hash, bytes);
  }
  async has(hash: string): Promise<boolean> {
    return this.map.has(hash);
  }
}

function addMember(db: InMemoryTestDatabase['adapter'], communityId: string, deviceId: string, removed = false): void {
  db.execute(
    `INSERT OR REPLACE INTO sync_workspace_members
      (workspace_id, device_id, role, invited_by_device_id, invited_at, removed_at)
     VALUES (?, ?, 'member', 'self', '2026-06-14T00:00:00.000Z', ?)`,
    [communityId, deviceId, removed ? '2026-06-14T01:00:00.000Z' : null],
  );
}

function attachment(over: Partial<ChannelMessageAttachment> & { id: string; blobHash: string }): ChannelMessageAttachment {
  return { name: 'doc.txt', mimeType: 'text/plain', size: 100, ...over };
}

describe('cm_file_requests is LOCAL-ONLY (never replicates)', () => {
  it('carries an EXPLICIT device_local rule so it never replicates', () => {
    // Wave-1 audit fix: cm_file_requests was previously "local by OMISSION", but the
    // community module maps to the cm_ prefix and an omitted table fell back to the
    // module defaultScope -- which was shared_workspace, so it actually LEAKED. It now
    // carries an EXPLICIT device_local rule (and the module default is device_local),
    // so this private request/approve/restore state machine never crosses a session.
    expect(MEERKAT_SYNC_PREFIXES.get('community')).toBe('cm_');
    const rule = COMMUNITY_SYNC_POLICY.entityRules.find((r) => r.tableName === CM_FILE_REQUESTS_TABLE);
    expect(rule).toBeDefined();
    expect(rule?.maxScope).toBe('device_local');
    expect(rule?.defaultScope).toBe('device_local');
  });
});

describe('cm_file_requests state transitions', () => {
  it('requested -> approved -> restored, idempotent on requestId, created_at stable', () => {
    const db = freshDb();
    const id = 'req_1';
    const first = upsertFileRequest(db, {
      id, communityId: 'c1', channelId: 'general', messageId: 'm1', attachmentId: 'a1',
      blobHash: 'ab'.repeat(64), direction: 'outgoing', counterpartyDeviceId: 'owner', status: 'requested',
      now: '2026-06-14T00:00:00.000Z',
    });
    expect(first.status).toBe('requested');

    // A retry of the SAME logical request reuses the row + keeps created_at.
    const retry = upsertFileRequest(db, {
      id, communityId: 'c1', channelId: 'general', messageId: 'm1', attachmentId: 'a1',
      blobHash: 'ab'.repeat(64), direction: 'outgoing', counterpartyDeviceId: 'owner', status: 'requested',
      now: '2026-06-14T00:05:00.000Z',
    });
    expect(retry.created_at).toBe('2026-06-14T00:00:00.000Z');
    expect(retry.updated_at).toBe('2026-06-14T00:05:00.000Z');

    setFileRequestStatus(db, id, 'restored', null, '2026-06-14T00:10:00.000Z');
    const final = getFileRequest(db, id);
    expect(final?.status).toBe('restored');
    expect(final?.created_at).toBe('2026-06-14T00:00:00.000Z');
  });

  it('records a decline with the honest reason', () => {
    const db = freshDb();
    upsertFileRequest(db, {
      id: 'req_2', communityId: 'c1', channelId: 'general', messageId: 'm1', attachmentId: 'a1',
      blobHash: 'cd'.repeat(64), direction: 'outgoing', counterpartyDeviceId: 'owner', status: 'requested',
    });
    setFileRequestStatus(db, 'req_2', 'declined', 'Owner no longer has this file.');
    const row = getFileRequest(db, 'req_2');
    expect(row?.status).toBe('declined');
    expect(row?.detail).toBe('Owner no longer has this file.');
  });

  it('getOutgoingRequestForAttachment finds the latest outgoing row for a slot', () => {
    const db = freshDb();
    upsertFileRequest(db, {
      id: 'req_3', communityId: 'c1', channelId: 'general', messageId: 'm1', attachmentId: 'a1',
      blobHash: 'ef'.repeat(64), direction: 'outgoing', counterpartyDeviceId: 'owner', status: 'requested',
    });
    const found = getOutgoingRequestForAttachment(db, 'c1', 'general', 'a1');
    expect(found?.id).toBe('req_3');
    expect(getOutgoingRequestForAttachment(db, 'c1', 'general', 'nope')).toBeNull();
  });

  it('isActiveCommunityMember reflects removed_at IS NULL', () => {
    const db = freshDb();
    addMember(db, 'c1', 'active-dev');
    addMember(db, 'c1', 'removed-dev', true);
    expect(isActiveCommunityMember(db, 'c1', 'active-dev')).toBe(true);
    expect(isActiveCommunityMember(db, 'c1', 'removed-dev')).toBe(false);
    expect(isActiveCommunityMember(db, 'c1', 'stranger')).toBe(false);
  });
});

describe('shared drain handlers (owner + requester sides)', () => {
  it('fileRequest writes an INCOMING row only for a current, non-revoked member', () => {
    const db = freshDb();
    const blobStore = new MemBlobStore();
    const requester = generateDeviceIdentity('Phone');
    addMember(db, 'c1', requester.publicKey);

    const handlers = buildFileMailboxHandlers({
      db, blobStore, isActiveMember: (cid, did) => isActiveCommunityMember(db, cid, did),
    });

    const payload: FileRequestMailboxPayload = {
      kind: 'meerkat.file-request-v1', version: 1,
      communityId: 'c1', channelId: 'general', messageId: 'm1', attachmentId: 'a1',
      blobHash: 'ab'.repeat(64), requestId: 'req_in_1',
    };
    expect(handlers.fileRequest!(requester.publicKey, payload, '2026-06-14T00:00:00.000Z')).toBe(true);
    const incoming = listIncomingPendingRequests(db, 'c1');
    expect(incoming).toHaveLength(1);
    expect(incoming[0]!.direction).toBe('incoming');
    expect(incoming[0]!.counterparty_device_id).toBe(requester.publicKey);

    // A non-member request is dropped: no row written.
    const stranger = generateDeviceIdentity('Stranger');
    const dropped: FileRequestMailboxPayload = { ...payload, requestId: 'req_in_2' };
    expect(handlers.fileRequest!(stranger.publicKey, dropped, '2026-06-14T00:00:01.000Z')).toBe(false);
    expect(getFileRequest(db, 'req_in_2')).toBeNull();
  });

  it('fileGrant restores an OUTGOING row only after verify-then-pin against our signed hash', async () => {
    const db = freshDb();
    const blobStore = new MemBlobStore();
    const owner = generateDeviceIdentity('Desktop');
    const me = generateDeviceIdentity('Phone');

    // Our verified local signed event names the blob we removed.
    const bytes = new TextEncoder().encode('restore these exact bytes');
    const blobHash = blobContentHash(bytes);
    const event = createChannelMessage(owner, {
      communityId: 'c1', channelId: 'general', body: 'file',
      attachments: [attachment({ id: 'a1', blobHash, name: 'doc.txt', size: bytes.length })],
      hlc: { wall: '2026-06-14T00:00:01.000Z', counter: 0 },
    });
    insertMessageRow(db, event);
    insertMessageAttachmentRows(db, event);

    // Our outgoing request row (written when we asked).
    const base = { communityId: 'c1', channelId: 'general', messageId: event.id, attachmentId: 'a1', blobHash };
    const requestId = fileRequestId(base, me.publicKey);
    upsertFileRequest(db, { id: requestId, ...base, direction: 'outgoing', counterpartyDeviceId: owner.publicKey, status: 'requested' });

    // The owner's real approve grant carrying the bytes.
    const grant = await buildFileGrant({
      owner,
      recipient: { deviceId: me.publicKey, dhPublicKey: me.dhPublicKey },
      pairSharedSecretHex: 'ab'.repeat(32),
      request: { ...base, requestId },
      moduleId: MODULE_ID,
      getBlobBytes: () => bytes,
      mimeType: 'text/plain',
    });

    const handlers = buildFileMailboxHandlers({
      db, blobStore, isActiveMember: (cid, did) => isActiveCommunityMember(db, cid, did),
    });
    const applied = await handlers.fileGrant!(owner.publicKey, grant.payload, '2026-06-14T00:01:00.000Z');
    expect(applied).toBe(true);
    expect((await blobStore.has(blobHash))).toBe(true);
    expect(getFileRequest(db, requestId)?.status).toBe('restored');
  });

  it('ADVERSARIAL fileGrant: a grant with different bytes is rejected, no write, row marked failed', async () => {
    const db = freshDb();
    const blobStore = new MemBlobStore();
    const owner = generateDeviceIdentity('Desktop');
    const me = generateDeviceIdentity('Phone');

    const realBytes = new TextEncoder().encode('the bytes I signed');
    const blobHash = blobContentHash(realBytes);
    const event = createChannelMessage(owner, {
      communityId: 'c1', channelId: 'general', body: 'file',
      attachments: [attachment({ id: 'a1', blobHash, name: 'doc.txt', size: realBytes.length })],
      hlc: { wall: '2026-06-14T00:00:01.000Z', counter: 0 },
    });
    insertMessageRow(db, event);
    insertMessageAttachmentRows(db, event);

    const base = { communityId: 'c1', channelId: 'general', messageId: event.id, attachmentId: 'a1', blobHash };
    const requestId = fileRequestId(base, me.publicKey);
    upsertFileRequest(db, { id: requestId, ...base, direction: 'outgoing', counterpartyDeviceId: owner.publicKey, status: 'requested' });

    // Owner ships attacker bytes but claims our blobHash in the grant header.
    const attackerBytes = new TextEncoder().encode('attacker chosen content');
    const grant = sealFileGrantMailbox({
      sender: owner,
      recipient: { deviceId: me.publicKey, dhPublicKey: me.dhPublicKey },
      pairSharedSecretHex: 'ab'.repeat(32),
      payload: {
        kind: 'meerkat.file-grant-v1', version: 1, ...base, requestId,
        decision: 'approve',
        blocks: [{
          hash: blobHash, moduleId: MODULE_ID, index: 0, total: 1,
          totalBytes: attackerBytes.length, mimeType: 'text/plain',
          dataHex: Buffer.from(attackerBytes).toString('hex'),
        }],
      } as FileGrantMailboxPayload,
    });

    const handlers = buildFileMailboxHandlers({
      db, blobStore, isActiveMember: (cid, did) => isActiveCommunityMember(db, cid, did),
    });
    const applied = await handlers.fileGrant!(owner.publicKey, grant.payload, '2026-06-14T00:01:00.000Z');
    expect(applied).toBe(false);
    expect((await blobStore.has(blobHash))).toBe(false);
    expect(getFileRequest(db, requestId)?.status).toBe('failed');
  });

  it('fileGrant ignores a grant that does not match an OUTGOING row we made', async () => {
    const db = freshDb();
    const blobStore = new MemBlobStore();
    const owner = generateDeviceIdentity('Desktop');
    const me = generateDeviceIdentity('Phone');
    const bytes = new TextEncoder().encode('orphan grant');
    const blobHash = blobContentHash(bytes);
    const base = { communityId: 'c1', channelId: 'general', messageId: 'm_unknown', attachmentId: 'a1', blobHash };
    const requestId = fileRequestId(base, me.publicKey);
    const grant = await buildFileGrant({
      owner,
      recipient: { deviceId: me.publicKey, dhPublicKey: me.dhPublicKey },
      pairSharedSecretHex: 'ab'.repeat(32),
      request: { ...base, requestId },
      moduleId: MODULE_ID,
      getBlobBytes: () => bytes,
    });
    const handlers = buildFileMailboxHandlers({
      db, blobStore, isActiveMember: () => true,
    });
    // No outgoing row exists for this requestId -> dropped, nothing written.
    expect(await handlers.fileGrant!(owner.publicKey, grant.payload, 'now')).toBe(false);
    expect(await blobStore.has(blobHash)).toBe(false);
  });
});
