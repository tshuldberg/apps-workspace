/**
 * Plan 21 Phase 8: DM block (= real local revocation), report (dm_reports), and
 * the feed_opt_in guarded read API (the frozen Plan 19 seam).
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createInMemoryTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import {
  configureSyncSecretStore,
  createDmMessage,
  createInMemorySyncSecretStore,
  createSyncTables,
  generateDeviceIdentity,
  isDeviceRevoked,
  type DeviceIdentity,
} from '@mylife/sync';
import {
  ensureDmTables,
  getFeedSourceMessages,
  listDmReports,
  listFeedOptInConversations,
  mergeDmEvents,
  setDmConversationFeedOptIn,
  upsertDmConversation,
  upsertDmParticipant,
} from '../(root)/data/dm-core';
import {
  blockDmParticipantCore,
  queueDmMessageCore,
  reportDmCore,
  type ParkEnvelopeFn,
} from '../(root)/data/dm-provider-core';

const NOW = '2026-07-02T00:00:00.000Z';

const dbs: InMemoryTestDatabase[] = [];
function freshDb(): InMemoryTestDatabase['adapter'] {
  const db = createInMemoryTestDatabase();
  dbs.push(db);
  createSyncTables(db.adapter);
  ensureDmTables(db.adapter);
  return db.adapter;
}
type Adapter = InMemoryTestDatabase['adapter'];

beforeEach(() => configureSyncSecretStore(createInMemorySyncSecretStore()));
afterEach(() => { for (const db of dbs.splice(0)) db.close(); });

function seedDirect(db: Adapter, cid: string, self: DeviceIdentity, peers: DeviceIdentity[]): void {
  upsertDmConversation(db, {
    id: cid, kind: 'direct', title: null, group_workspace_id: null, admin_device_id: null,
    current_epoch: 0, descriptor_json: null, feed_opt_in: 0, archived: 0, muted: 0,
    created_at: NOW, updated_at: NOW,
  });
  upsertDmParticipant(db, {
    conversation_id: cid, device_id: self.publicKey, identity_anchor: self.publicKey,
    is_self: 1, role: 'member', dh_public_key: self.dhPublicKey, joined_at: NOW, removed_at: null,
  });
  for (const p of peers) {
    upsertDmParticipant(db, {
      conversation_id: cid, device_id: p.publicKey, identity_anchor: p.publicKey,
      is_self: 0, role: 'member', dh_public_key: p.dhPublicKey, joined_at: NOW, removed_at: null,
    });
  }
}

describe('blockDmParticipantCore: a real local revocation', () => {
  it('revokes the device and the DM send no longer addresses it', async () => {
    const db = freshDb();
    const self = generateDeviceIdentity('A');
    const p1 = generateDeviceIdentity('P1');
    const p2 = generateDeviceIdentity('P2');
    const cid = 'conv1';
    seedDirect(db, cid, self, [p1, p2]);

    expect(isDeviceRevoked(db, p1.publicKey)).toBe(false);
    blockDmParticipantCore(db, self, p1.publicKey, 'spam');
    expect(isDeviceRevoked(db, p1.publicKey)).toBe(true);

    const parkedTokens: string[] = [];
    const park: ParkEnvelopeFn = async (token) => { parkedTokens.push(token); return true; };
    const send = await queueDmMessageCore({
      db, identity: self, conversationId: cid, body: 'hi',
      relayAvailable: true,
      resolvePairSecret: (id) => (id === p1.publicKey ? 'ab'.repeat(32) : id === p2.publicKey ? 'cd'.repeat(32) : null),
      parkEnvelope: park, now: () => NOW,
    });
    // Only the non-blocked peer is a recipient; the blocked device is never addressed.
    expect(send.recipients.map((r) => r.deviceId)).toEqual([p2.publicKey]);
    expect(parkedTokens).toHaveLength(1);
  });
});

describe('reportDmCore: local dm_reports ledger', () => {
  it('records a message report and a whole-participant report', () => {
    const db = freshDb();
    const cid = 'conv1';
    reportDmCore(db, { conversationId: cid, messageId: 'm1', reportedDeviceId: 'dev-bad', reason: 'abuse' }, NOW);
    reportDmCore(db, { conversationId: cid, reportedDeviceId: 'dev-bad' }, '2026-07-02T00:01:00.000Z');

    const reports = listDmReports(db, cid);
    expect(reports).toHaveLength(2);
    expect(reports.some((r) => r.message_id === 'm1' && r.reason === 'abuse')).toBe(true);
    expect(reports.some((r) => r.message_id === null && r.reason === null)).toBe(true);
  });
});

describe('feed_opt_in guarded read API (Plan 19 seam)', () => {
  it('lists ONLY opted-in conversations and hard-filters getFeedSourceMessages', () => {
    const db = freshDb();
    const self = generateDeviceIdentity('A');
    const peer = generateDeviceIdentity('B');
    const optedIn = 'conv-in';
    const priv = 'conv-private';
    seedDirect(db, optedIn, self, [peer]);
    seedDirect(db, priv, self, [peer]);

    const m1 = createDmMessage(self, { conversationId: optedIn, body: 'shareable', hlc: { wall: NOW, counter: 0 } });
    const m2 = createDmMessage(self, { conversationId: optedIn, body: 'later', hlc: { wall: NOW, counter: 1 } });
    mergeDmEvents(db, optedIn, [m1, m2]);
    mergeDmEvents(db, priv, [createDmMessage(self, { conversationId: priv, body: 'secret', hlc: { wall: NOW, counter: 0 } })]);

    // Default: nothing is opted in (NC-6).
    expect(listFeedOptInConversations(db)).toEqual([]);
    expect(() => getFeedSourceMessages(db, optedIn, null)).toThrow();

    setDmConversationFeedOptIn(db, optedIn, true, '2026-07-02T00:05:00.000Z');
    const listed = listFeedOptInConversations(db);
    expect(listed.map((c) => c.conversationId)).toEqual([optedIn]);
    expect(listed[0]!.optedInAt).toBe('2026-07-02T00:05:00.000Z');

    // The opted-in conversation exposes its messages; a private one still throws.
    expect(getFeedSourceMessages(db, optedIn, null).map((e) => e.body).sort()).toEqual(['later', 'shareable']);
    expect(getFeedSourceMessages(db, optedIn, { wall: NOW, counter: 0 }).map((e) => e.body)).toEqual(['later']);
    expect(() => getFeedSourceMessages(db, priv, null)).toThrow();
  });
});
