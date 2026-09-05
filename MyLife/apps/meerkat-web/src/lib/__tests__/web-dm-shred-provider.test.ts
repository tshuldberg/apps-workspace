/**
 * Plan 21 Phase 8: DM disappearing-message shred provider (queueDmShredCore +
 * buildDmShredHandler). Delete-for-everyone of the author's OWN messages, with the
 * two-layer author guarantee proven end to end.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createInMemoryTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import {
  configureSyncSecretStore,
  createDmMessage,
  createDmShred,
  createInMemorySyncSecretStore,
  createSyncTables,
  encodeMailboxEnvelope,
  generateDeviceIdentity,
  runMailboxDrainJob,
  sealDmShred,
  type DeviceIdentity,
  type MailboxDrainPeer,
  type RelayBackend,
  type RelaySession,
} from '@mylife/sync';
import {
  ensureDmTables,
  listDmMessages,
  mergeDmEvents,
  upsertDmConversation,
  upsertDmParticipant,
} from '../dm-core';
import {
  buildDmShredHandler,
  queueDmShredCore,
  type ParkEnvelopeFn,
} from '../dm-provider-core';

const NOW = '2026-07-02T00:00:00.000Z';

class MailboxRelayBackend implements RelayBackend {
  private readonly mailbox = new Map<string, Uint8Array[]>();
  destroyed = false;
  park(token: string, bytes: Uint8Array): void {
    const q = this.mailbox.get(token) ?? [];
    q.push(bytes);
    this.mailbox.set(token, q);
  }
  async connect(_url: string, token: string): Promise<RelaySession> {
    const drained = this.mailbox.get(token) ?? [];
    this.mailbox.delete(token);
    return {
      async send(): Promise<void> {},
      onMessage: (h) => { for (const b of drained) h(new Uint8Array(b)); },
      close: async () => {},
    };
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
    current_epoch: 0, descriptor_json: null, feed_opt_in: 0, archived: 0, muted: 0,
    created_at: NOW, updated_at: NOW,
  });
  for (const [id, isSelf] of [[self, 1], [peer, 0]] as const) {
    upsertDmParticipant(db, {
      conversation_id: cid, device_id: id.publicKey, identity_anchor: id.publicKey,
      is_self: isSelf, role: 'member', dh_public_key: id.dhPublicKey, joined_at: NOW, removed_at: null,
    });
  }
}

const parkTo = (backend: MailboxRelayBackend): ParkEnvelopeFn =>
  async (token, envelope) => { backend.park(token, encodeMailboxEnvelope(envelope)); return true; };

function drainShred(db: Adapter, identity: DeviceIdentity, backend: MailboxRelayBackend, senderId: string, pairSecret: string, deleteBlob?: (h: string) => void) {
  const peer: MailboxDrainPeer = { deviceId: senderId, pairSharedSecretHex: pairSecret, revoked: false, isActive: true };
  return runMailboxDrainJob({
      nowMs: Date.parse(NOW),
    identity, backend, relayUrl: 'ws://test', peers: [peer],
    handlers: buildDmShredHandler({ db, identity, deleteBlob }),
    waitForDrain: () => Promise.resolve(),
  });
}

describe('queueDmShredCore + buildDmShredHandler: delete-for-everyone of my own messages', () => {
  it('author shreds its message; a converged recipient drains the shred and deletes its copy', async () => {
    const dbA = freshDb();
    const dbB = freshDb();
    const a = generateDeviceIdentity('A');
    const b = generateDeviceIdentity('B');
    const cid = 'conv1';
    const secretAB = 'ab'.repeat(32);
    seedDirect(dbA, cid, a, b);
    seedDirect(dbB, cid, b, a);

    // A authors a message; both A and B hold it locally.
    const msg = createDmMessage(a, { conversationId: cid, body: 'delete me', hlc: { wall: NOW, counter: 0 } });
    mergeDmEvents(dbA, cid, [msg]);
    mergeDmEvents(dbB, cid, [msg]);
    expect(listDmMessages(dbA, cid)).toHaveLength(1);
    expect(listDmMessages(dbB, cid)).toHaveLength(1);

    const backend = new MailboxRelayBackend();
    const shredResult = await queueDmShredCore({
      db: dbA, identity: a, conversationId: cid, messageIds: [msg.id],
      relayAvailable: true, resolvePairSecret: (id) => (id === b.publicKey ? secretAB : null),
      parkEnvelope: parkTo(backend), now: () => NOW,
    });
    expect(shredResult.shred).not.toBeNull();
    expect(shredResult.deletedLocally).toBe(1);
    expect(shredResult.recipients).toEqual([{ deviceId: b.publicKey, parked: true }]);
    // A's own copy is gone.
    expect(listDmMessages(dbA, cid)).toHaveLength(0);

    // B drains the shred and its copy is deleted too.
    const drain = await drainShred(dbB, b, backend, a.publicKey, secretAB);
    expect(drain.dmShreds).toBe(1);
    expect(listDmMessages(dbB, cid)).toHaveLength(0);
  });

  it('ignores ids this device did not author (cannot shred someone else message via send)', async () => {
    const dbA = freshDb();
    const a = generateDeviceIdentity('A');
    const b = generateDeviceIdentity('B');
    const cid = 'conv1';
    seedDirect(dbA, cid, a, b);
    // A holds a message authored by B.
    const bMsg = createDmMessage(b, { conversationId: cid, body: 'B says hi', hlc: { wall: NOW, counter: 0 } });
    mergeDmEvents(dbA, cid, [bMsg]);

    const backend = new MailboxRelayBackend();
    const result = await queueDmShredCore({
      db: dbA, identity: a, conversationId: cid, messageIds: [bMsg.id],
      relayAvailable: true, resolvePairSecret: () => 'ab'.repeat(32),
      parkEnvelope: parkTo(backend), now: () => NOW,
    });
    // Nothing shreddable: B's message is untouched.
    expect(result.shred).toBeNull();
    expect(result.deletedLocally).toBe(0);
    expect(listDmMessages(dbA, cid)).toHaveLength(1);
  });

  it('the apply guard refuses to delete a message NOT authored by the shred author', async () => {
    const dbB = freshDb();
    const a = generateDeviceIdentity('A');
    const b = generateDeviceIdentity('B');
    const c = generateDeviceIdentity('C');
    const cid = 'conv1';
    seedDirect(dbB, cid, b, a);
    // B holds a message authored by C.
    const cMsg = createDmMessage(c, { conversationId: cid, body: 'C wrote this', hlc: { wall: NOW, counter: 0 } });
    mergeDmEvents(dbB, cid, [cMsg]);

    // A crafts an author-signed shred that (dishonestly) lists C's message id.
    const forgedTargetShred = createDmShred(a, { conversationId: cid, messageIds: [cMsg.id], at: NOW });
    const handler = buildDmShredHandler({ db: dbB, identity: b });
    const applied = await handler.dmShred!(a.publicKey, forgedTargetShred, NOW);
    // The local row is authored by C, not A: the guard refuses. C's message survives.
    expect(applied).toBe(false);
    expect(listDmMessages(dbB, cid)).toHaveLength(1);
  });

  it('a forged shred sealed by a non-author is dropped by the drain (message survives)', async () => {
    const dbB = freshDb();
    const a = generateDeviceIdentity('A');
    const b = generateDeviceIdentity('B');
    const x = generateDeviceIdentity('X');
    const cid = 'conv1';
    const secretXB = 'ef'.repeat(32);
    seedDirect(dbB, cid, b, a);
    const aMsg = createDmMessage(a, { conversationId: cid, body: 'keep me', hlc: { wall: NOW, counter: 0 } });
    mergeDmEvents(dbB, cid, [aMsg]);

    // A-signed shred, but X seals + parks the envelope (relay/forwarder). openDmShredMailbox
    // binds the envelope signer to the shred author, so B rejects it.
    const shred = createDmShred(a, { conversationId: cid, messageIds: [aMsg.id], at: NOW });
    const backend = new MailboxRelayBackend();
    const sealed = sealDmShred({
      sender: x, recipient: { deviceId: b.publicKey, dhPublicKey: b.dhPublicKey },
      pairSharedSecretHex: secretXB, shred, now: NOW,
    });
    backend.park(sealed.token, encodeMailboxEnvelope(sealed.envelope));

    const drain = await drainShred(dbB, b, backend, x.publicKey, secretXB);
    expect(drain.dmShreds).toBe(0);
    expect(drain.rejected).toBeGreaterThanOrEqual(1);
    expect(listDmMessages(dbB, cid)).toHaveLength(1);
  });

  it('unpins cached attachment blobs on shred', async () => {
    const dbA = freshDb();
    const a = generateDeviceIdentity('A');
    const b = generateDeviceIdentity('B');
    const cid = 'conv1';
    seedDirect(dbA, cid, a, b);
    const msg = createDmMessage(a, {
      conversationId: cid, body: 'photo',
      attachments: [{ id: 'att1', blobHash: 'hash-abc', name: 'p.jpg', mimeType: 'image/jpeg', size: 10 }],
      hlc: { wall: NOW, counter: 0 },
    });
    mergeDmEvents(dbA, cid, [msg]);

    const unpinned: string[] = [];
    const backend = new MailboxRelayBackend();
    await queueDmShredCore({
      db: dbA, identity: a, conversationId: cid, messageIds: [msg.id],
      relayAvailable: false, resolvePairSecret: () => null, parkEnvelope: parkTo(backend),
      deleteBlob: (h) => { unpinned.push(h); }, now: () => NOW,
    });
    expect(unpinned).toEqual(['hash-abc']);
    expect(listDmMessages(dbA, cid)).toHaveLength(0);
  });
});
