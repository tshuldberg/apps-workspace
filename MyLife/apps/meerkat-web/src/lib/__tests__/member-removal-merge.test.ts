/**
 * Plan 28 P5: the channel-message apply path enforces the membership boundary
 * (web twin of apps/meerkat/app/__tests__/member-removal-merge.test.ts).
 *
 * The pairwise channel-mailbox delivery is membership-UNCHECKED (any device
 * holding the pair secret can park a signed event), so the APPLY side is the
 * gate: once a member's roster row is CLOSED on this device, events it stamps
 * AFTER its removal are dropped fail-closed. Events from BEFORE the removal
 * stay readable (epoch-boundary honesty), and an author with NO roster row at
 * all is allowed (history from members gone before this device joined must not
 * vanish from snapshot/backfill imports).
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createInMemoryTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import {
  addWorkspaceMember,
  configureSyncSecretStore,
  createChannelMessage,
  createInMemorySyncSecretStore,
  generateDeviceIdentity,
} from '@mylife/sync';
import { ensureSyncSchema } from '../schema';
import {
  listChannelMessageEvents,
  mergeChannelMessageEvents,
} from '../meerkat-data';

const CID = 'community-merge-guard';
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
  ensureSyncSchema(db.adapter);
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

describe('mergeChannelMessageEvents membership cut (Plan 28 P5, web twin)', () => {
  it('accepts an active member author', () => {
    addRosterRow(author.publicKey);
    const result = mergeChannelMessageEvents(db.adapter, [messageAt(AFTER_REMOVAL, 'hello')]);
    expect(result.inserted).toBe(1);
    expect(result.droppedRemoved).toBe(0);
    expect(listChannelMessageEvents(db.adapter, CID, CHANNEL)).toHaveLength(1);
  });

  it('drops an event a REMOVED author stamped after its removal (the channel-mailbox bypass)', () => {
    addRosterRow(author.publicKey);
    closeRosterRow(author.publicKey);
    const result = mergeChannelMessageEvents(db.adapter, [messageAt(AFTER_REMOVAL, 'sneaky')]);
    expect(result.inserted).toBe(0);
    expect(result.droppedRemoved).toBe(1);
    expect(listChannelMessageEvents(db.adapter, CID, CHANNEL)).toHaveLength(0);
  });

  it('keeps an event the removed author stamped BEFORE its removal (epoch-boundary honesty)', () => {
    addRosterRow(author.publicKey);
    closeRosterRow(author.publicKey);
    const result = mergeChannelMessageEvents(db.adapter, [messageAt(BEFORE_REMOVAL, 'legit history')]);
    expect(result.inserted).toBe(1);
    expect(result.droppedRemoved).toBe(0);
  });

  it('allows an author with NO roster row (history from members gone before this device joined)', () => {
    const result = mergeChannelMessageEvents(db.adapter, [messageAt(AFTER_REMOVAL, 'old-timer history')]);
    expect(result.inserted).toBe(1);
    expect(result.droppedRemoved).toBe(0);
  });
});
