/**
 * H1 (Plan 31 Phase 2 fix): history-import replication must NOT re-inject a
 * removed member's post-removal messages. mergeChannelMessageEvents drops them
 * (Plan 28 membership cut); the replication set is now merge.insertedEvents ONLY,
 * so a device never recordLocalChanges an event it fail-closed dropped (peers
 * gate on the sending peer, not the row author). Also proves the shared helper
 * writes exactly the two tables the old inline loop did for a normal event.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createInMemoryTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import {
  addWorkspaceMember,
  configureSyncSecretStore,
  createChannelMessage,
  createChannelMessageV2,
  createInMemorySyncSecretStore,
  createSyncTables,
  generateDeviceIdentity,
} from '@mylife/sync';
import {
  CM_MESSAGES_TABLE,
  CM_MESSAGE_ATTACHMENTS_TABLE,
  channelMessageAttachmentRowsFromEvent,
  channelMessageRowFromEvent,
  ensureCommunityTables,
  mergeChannelMessageEvents,
} from '../(root)/data/community-core';
import { replicateImportedHistoryEvents } from '../(root)/data/channel-history-import';

const CID = 'community-import-guard';
const CHANNEL = 'general';
const JOINED_AT = '2026-07-01T00:00:00.000Z';
const REMOVED_AT = '2026-07-02T01:00:00.000Z';
const BEFORE_REMOVAL = '2026-07-02T00:30:00.000Z';
const AFTER_REMOVAL = '2026-07-02T02:00:00.000Z';

let db: InMemoryTestDatabase;
type Identity = ReturnType<typeof generateDeviceIdentity>;
let author: Identity;

beforeEach(() => {
  configureSyncSecretStore(createInMemorySyncSecretStore());
  db = createInMemoryTestDatabase();
  createSyncTables(db.adapter);
  ensureCommunityTables(db.adapter);
  author = generateDeviceIdentity('Author');
});

afterEach(() => {
  db.close();
});

function addRosterRow(deviceId: string): void {
  addWorkspaceMember(db.adapter, {
    workspaceId: CID,
    deviceId,
    role: 'member',
    invitedByDeviceId: 'owner-device',
    invitedAt: JOINED_AT,
    removedAt: null,
  });
}

function closeRosterRow(deviceId: string): void {
  db.adapter.execute(
    'UPDATE sync_workspace_members SET removed_at = ? WHERE workspace_id = ? AND device_id = ?',
    [REMOVED_AT, CID, deviceId],
  );
}

function messageAt(wall: string, body: string) {
  return createChannelMessage(author, {
    communityId: CID,
    channelId: CHANNEL,
    body,
    hlc: { wall, counter: 0 },
  });
}

describe('H1: replication set excludes removed-member post-removal events', () => {
  it('mergeChannelMessageEvents.insertedEvents omits the dropped-removed event', () => {
    addRosterRow(author.publicKey);
    closeRosterRow(author.publicKey);
    const pre = messageAt(BEFORE_REMOVAL, 'legit history');
    const post = messageAt(AFTER_REMOVAL, 'sneaky post-removal');

    const merge = mergeChannelMessageEvents(db.adapter, [pre, post]);

    expect(merge.inserted).toBe(1);
    expect(merge.droppedRemoved).toBe(1);
    expect(merge.insertedEvents.map((e) => e.id)).toEqual([pre.id]);
  });

  it('replicates ONLY merge-inserted events, so the removed message is never re-injected', () => {
    addRosterRow(author.publicKey);
    closeRosterRow(author.publicKey);
    const pre = messageAt(BEFORE_REMOVAL, 'legit history');
    const post = messageAt(AFTER_REMOVAL, 'sneaky post-removal');

    const merge = mergeChannelMessageEvents(db.adapter, [pre, post]);
    const recorded: Array<{ table: string; op: string; rowId: string }> = [];
    replicateImportedHistoryEvents(
      (table, op, rowId) => recorded.push({ table, op, rowId }),
      merge.insertedEvents,
    );

    const ids = recorded.map((r) => r.rowId);
    expect(ids).toContain(pre.id);
    expect(ids).not.toContain(post.id);
    expect(recorded.filter((r) => r.table === CM_MESSAGES_TABLE)).toHaveLength(1);
  });
});

describe('replicateImportedHistoryEvents writes exactly the two tables (helper parity)', () => {
  it('records the message row and each attachment row for a normal event', () => {
    const attachment = { id: 'a1', blobHash: 'h1'.repeat(32), name: 'f.txt', mimeType: 'text/plain', size: 12 };
    const event = createChannelMessageV2(author, {
      communityId: CID,
      channelId: CHANNEL,
      body: 'has a file',
      hlc: { wall: BEFORE_REMOVAL, counter: 1 },
      attachments: [attachment],
    });

    const recorded: Array<{ table: string; op: string; rowId: string; data: unknown }> = [];
    replicateImportedHistoryEvents(
      (table, op, rowId, data) => recorded.push({ table, op, rowId, data }),
      [event],
    );

    const [attRow] = channelMessageAttachmentRowsFromEvent(event);
    expect(recorded).toHaveLength(2);
    expect(recorded[0]).toMatchObject({
      table: CM_MESSAGES_TABLE,
      op: 'INSERT',
      rowId: event.id,
      data: { ...channelMessageRowFromEvent(event) },
    });
    expect(recorded[1]).toMatchObject({
      table: CM_MESSAGE_ATTACHMENTS_TABLE,
      op: 'INSERT',
      rowId: attRow!.id,
      data: { ...attRow! },
    });
  });
});
