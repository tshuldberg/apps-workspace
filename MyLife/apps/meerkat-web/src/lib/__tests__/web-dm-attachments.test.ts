/**
 * Plan 21 Phase 8: DM attachment send (blocks) + verify-then-pin on receive.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createInMemoryTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import {
  blobContentHash,
  configureSyncSecretStore,
  createDmMessage,
  createInMemorySyncSecretStore,
  createSyncTables,
  encodeMailboxEnvelope,
  generateDeviceIdentity,
  runMailboxDrainJob,
  splitBlobForTransfer,
  type DeviceIdentity,
  type MailboxDrainPeer,
  type RelayBackend,
  type RelaySession,
} from '@mylife/sync';
import {
  ensureDmTables,
  listDmMessages,
  upsertDmConversation,
  upsertDmParticipant,
} from '../dm-core';
import {
  buildDmMailboxHandlers,
  queueDmMessageCore,
  verifyAndPinDmAttachments,
  type ParkEnvelopeFn,
} from '../dm-provider-core';

const NOW = '2026-07-02T00:00:00.000Z';
const bytes = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
const HASH = blobContentHash(bytes);
const attachment = { id: 'att1', blobHash: HASH, name: 'p.png', mimeType: 'image/png', size: bytes.length };

class MailboxRelayBackend implements RelayBackend {
  private readonly mailbox = new Map<string, Uint8Array[]>();
  destroyed = false;
  park(token: string, b: Uint8Array): void {
    const q = this.mailbox.get(token) ?? [];
    q.push(b);
    this.mailbox.set(token, q);
  }
  async connect(_url: string, token: string): Promise<RelaySession> {
    const drained = this.mailbox.get(token) ?? [];
    this.mailbox.delete(token);
    return { async send() {}, onMessage: (h) => { for (const x of drained) h(new Uint8Array(x)); }, close: async () => {} };
  }
  destroy(): void { this.destroyed = true; }
}

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

function seedDirect(db: Adapter, cid: string, self: DeviceIdentity, peer: DeviceIdentity): void {
  upsertDmConversation(db, {
    id: cid, kind: 'direct', title: null, group_workspace_id: null, admin_device_id: null,
    current_epoch: 0, descriptor_json: null, feed_opt_in: 0, archived: 0, muted: 0, created_at: NOW, updated_at: NOW,
  });
  for (const [id, isSelf] of [[self, 1], [peer, 0]] as const) {
    upsertDmParticipant(db, {
      conversation_id: cid, device_id: id.publicKey, identity_anchor: id.publicKey,
      is_self: isSelf, role: 'member', dh_public_key: id.dhPublicKey, joined_at: NOW, removed_at: null,
    });
  }
}

describe('verifyAndPinDmAttachments (pure)', () => {
  const author = () => generateDeviceIdentity('A');

  it('pins a blob referenced by a verified event', async () => {
    const event = createDmMessage(author(), { conversationId: 'c1', body: 'pic', attachments: [attachment], hlc: { wall: NOW, counter: 0 } });
    const blocks = splitBlobForTransfer(bytes, HASH, 'dm', 'image/png');
    const pinned = new Map<string, Uint8Array>();
    const n = await verifyAndPinDmAttachments([event], blocks, (hash, b) => { pinned.set(hash, b); });
    expect(n).toBe(1);
    expect(pinned.get(HASH)).toEqual(bytes);
  });

  it('never pins tampered bytes (assembled hash mismatch)', async () => {
    const event = createDmMessage(author(), { conversationId: 'c1', body: 'pic', attachments: [attachment], hlc: { wall: NOW, counter: 0 } });
    const blocks = splitBlobForTransfer(bytes, HASH, 'dm', 'image/png').map((b) => ({ ...b, dataHex: b.dataHex.replace(/^../, 'ff') }));
    const pinned: string[] = [];
    const n = await verifyAndPinDmAttachments([event], blocks, (hash) => { pinned.push(hash); });
    expect(n).toBe(0);
    expect(pinned).toHaveLength(0);
  });

  it('ignores blocks no verified event references', async () => {
    const event = createDmMessage(author(), { conversationId: 'c1', body: 'no attachment', hlc: { wall: NOW, counter: 0 } });
    const blocks = splitBlobForTransfer(bytes, HASH, 'dm', 'image/png');
    const n = await verifyAndPinDmAttachments([event], blocks, () => { throw new Error('should not pin'); });
    expect(n).toBe(0);
  });
});

describe('send + drain: attachment blocks verify-then-pin on the recipient', () => {
  it('A sends an attachment; B drains and pins the exact bytes', async () => {
    const dbA = freshDb();
    const dbB = freshDb();
    const a = generateDeviceIdentity('A');
    const b = generateDeviceIdentity('B');
    const cid = 'conv1';
    const secretAB = 'ab'.repeat(32);
    seedDirect(dbA, cid, a, b);
    seedDirect(dbB, cid, b, a);

    const backend = new MailboxRelayBackend();
    const park: ParkEnvelopeFn = async (token, env) => { backend.park(token, encodeMailboxEnvelope(env)); return true; };
    const blocks = splitBlobForTransfer(bytes, HASH, 'dm', 'image/png');

    const send = await queueDmMessageCore({
      db: dbA, identity: a, conversationId: cid, body: 'photo', attachments: [attachment],
      blocks, relayAvailable: true,
      resolvePairSecret: (id) => (id === b.publicKey ? secretAB : null),
      parkEnvelope: park, now: () => NOW,
    });
    expect(send.recipients).toEqual([{ deviceId: b.publicKey, parked: true }]);

    const pinned = new Map<string, Uint8Array>();
    const peer: MailboxDrainPeer = { deviceId: a.publicKey, pairSharedSecretHex: secretAB, revoked: false, isActive: true };
    const drain = await runMailboxDrainJob({
    nowMs: Date.parse(NOW),
      identity: b, backend, relayUrl: 'ws://test', peers: [peer],
      handlers: buildDmMailboxHandlers({
        db: dbB, identity: b,
        resolvePeerDhKey: (id) => (id === a.publicKey ? a.dhPublicKey : null),
        resolvePairSecret: () => null,
        parkEnvelope: async () => false,
        pinAttachments: (hash, bts) => { pinned.set(hash, bts); },
        now: () => NOW,
      }),
      waitForDrain: () => Promise.resolve(),
    });

    expect(drain.dmMessages).toBe(1);
    expect(listDmMessages(dbB, cid)).toHaveLength(1);
    expect(pinned.get(HASH)).toEqual(bytes);
  });
});
