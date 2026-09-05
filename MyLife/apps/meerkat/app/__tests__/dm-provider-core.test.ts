/**
 * Plan 21 Phase 4: dm-provider-core.ts, the pure send/drain/link core wired
 * into SyncProvider.tsx and background-sync.ts.
 *
 * Verifies:
 *  - queueDmMessageCore parks a signed event per participant device ONLY on a
 *    real park; with no relay it is a genuine no-op-park (state stays
 *    'queued', the local echo is still written honestly);
 *  - multi-device peer fan-out: one dm_delivery row per recipient device;
 *  - the own-device mirror re-seals the SAME event/receipt to a linked own
 *    device and is a genuine zero-park no-op with no link;
 *  - the dmMessage/dmReceipt drain handlers bootstrap conversation +
 *    participant rows, merge/apply through REAL seal+open+verify (never
 *    trusting an unverified claim), are idempotent on re-drain, and never
 *    fabricate 'delivered'/'read' outside a real inbound receipt signature;
 *  - the TC-12 own-device convergence spine end-to-end over the in-process
 *    MailboxRelayBackend (mirrors background-sync.test.ts / the P7 e2e test).
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { createInMemoryTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import {
  applyMailboxEnvelope,
  configureSyncSecretStore,
  createInMemorySyncSecretStore,
  createSyncTables,
  createDmMessage,
  createDmReceipt,
  dmConversationId,
  encodeMailboxEnvelope,
  generateDeviceIdentity,
  insertPairedDevice,
  runMailboxDrainJob,
  sealDmDirect,
  sealDmReceipt,
  storeSharedSecret,
  type DeviceIdentity,
  type MailboxEnvelopeHandlers,
  type RelayBackend,
  type RelaySession,
} from '@mylife/sync';
import {
  ensureDmTables,
  getDmConversation,
  getDmDelivery,
  listDmMessages,
  listDmParticipants,
  resolveOwnDeviceMirrorTargets,
  upsertDmConversation,
  upsertDmParticipant,
} from '../(root)/data/dm-core';
import {
  blockDmParticipantCore,
  buildDmMailboxHandlers,
  linkOwnDeviceCore,
  planDrainDeliveredReceipts,
  queueDmMessageCore,
  queueDmReceiptCore,
  type ParkEnvelopeFn,
  type ResolvePairSecret,
} from '../(root)/data/dm-provider-core';
import { runBackgroundSyncCore } from '../(root)/data/background-sync';

type Adapter = InMemoryTestDatabase['adapter'];

const NOW = '2026-07-01T00:00:00.000Z';

/** Store-and-forward mailbox backend (mirrors the relay drain-on-join). */
class MailboxRelayBackend implements RelayBackend {
  private readonly mailbox = new Map<string, Uint8Array[]>();
  destroyed = false;
  connectCount = 0;

  park(token: string, bytes: Uint8Array): void {
    const queue = this.mailbox.get(token) ?? [];
    queue.push(bytes);
    this.mailbox.set(token, queue);
  }

  async connect(_url: string, token: string): Promise<RelaySession> {
    this.connectCount += 1;
    const drained = this.mailbox.get(token) ?? [];
    this.mailbox.delete(token);
    return {
      async send(): Promise<void> {},
      onMessage: (handler) => { for (const b of drained) handler(new Uint8Array(b)); },
      close: async () => {},
    };
  }

  destroy(): void { this.destroyed = true; }
}

function seedConversation(
  db: Adapter,
  conversationId: string,
  self: DeviceIdentity,
  peers: readonly DeviceIdentity[],
  now = NOW,
): void {
  ensureDmTables(db);
  upsertDmConversation(db, {
    id: conversationId, kind: 'direct', title: null, group_workspace_id: null,
    admin_device_id: null, current_epoch: 0, descriptor_json: null,
    feed_opt_in: 0, archived: 0, muted: 0, created_at: now, updated_at: now,
  });
  upsertDmParticipant(db, {
    conversation_id: conversationId, device_id: self.publicKey, identity_anchor: self.publicKey,
    is_self: 1, role: 'member', dh_public_key: self.dhPublicKey, joined_at: now, removed_at: null,
  });
  for (const peer of peers) {
    upsertDmParticipant(db, {
      conversation_id: conversationId, device_id: peer.publicKey, identity_anchor: peer.publicKey,
      is_self: 0, role: 'member', dh_public_key: peer.dhPublicKey, joined_at: now, removed_at: null,
    });
  }
}

/** A simple deterministic pairwise-secret map for tests (real DH is not needed here). */
function secretMap(pairs: Record<string, string>): ResolvePairSecret {
  return (deviceId: string) => pairs[deviceId] ?? null;
}

let testDb: InMemoryTestDatabase | null = null;
let testDb2: InMemoryTestDatabase | null = null;

afterEach(() => {
  testDb?.close();
  testDb = null;
  testDb2?.close();
  testDb2 = null;
});

function freshDb(): Adapter {
  configureSyncSecretStore(createInMemorySyncSecretStore());
  testDb = createInMemoryTestDatabase();
  // The DM send paths consult sync_device_revocations (block-awareness), which the
  // real app always creates via ensureSyncSchema before any DM.
  createSyncTables(testDb.adapter);
  return testDb.adapter;
}

describe('queueDmMessageCore (send)', () => {
  it('writes the local echo immediately and parks to the peer ONLY on a real park', async () => {
    const db = freshDb();
    const self = generateDeviceIdentity('A');
    const friend = generateDeviceIdentity('F');
    const conversationId = dmConversationId(self.publicKey, friend.publicKey);
    seedConversation(db, conversationId, self, [friend]);

    const parkEnvelope: ParkEnvelopeFn = vi.fn(async () => true);
    const result = await queueDmMessageCore({
      db, identity: self, conversationId, body: 'hello friend',
      relayAvailable: true,
      resolvePairSecret: secretMap({ [friend.publicKey]: 'ab'.repeat(32) }),
      parkEnvelope,
      now: () => NOW,
    });

    expect(result.event.body).toBe('hello friend');
    expect(listDmMessages(db, conversationId)).toHaveLength(1);

    expect(result.recipients).toEqual([{ deviceId: friend.publicKey, parked: true }]);
    const delivery = getDmDelivery(db, result.event.id);
    expect(delivery).toHaveLength(1);
    expect(delivery[0]!.state).toBe('parked');
    expect(parkEnvelope).toHaveBeenCalledTimes(1);
  });

  it('with no relay: a genuine no-op-park, state stays queued, local echo still written, parkEnvelope never called', async () => {
    const db = freshDb();
    const self = generateDeviceIdentity('A');
    const friend = generateDeviceIdentity('F');
    const conversationId = dmConversationId(self.publicKey, friend.publicKey);
    seedConversation(db, conversationId, self, [friend]);

    const parkEnvelope: ParkEnvelopeFn = vi.fn(async () => true);
    const result = await queueDmMessageCore({
      db, identity: self, conversationId, body: 'no relay yet',
      relayAvailable: false,
      resolvePairSecret: secretMap({ [friend.publicKey]: 'ab'.repeat(32) }),
      parkEnvelope,
      now: () => NOW,
    });

    expect(listDmMessages(db, conversationId)).toHaveLength(1);
    expect(result.recipients).toEqual([{ deviceId: friend.publicKey, parked: false }]);
    expect(getDmDelivery(db, result.event.id)[0]!.state).toBe('queued');
    expect(parkEnvelope).not.toHaveBeenCalled();
  });

  it('a peer with two device rows produces two parks, one dm_delivery row per device', async () => {
    const db = freshDb();
    const self = generateDeviceIdentity('A');
    const friendPhone = generateDeviceIdentity('F-Phone');
    const friendDesktop = generateDeviceIdentity('F-Desktop');
    const conversationId = dmConversationId(self.publicKey, friendPhone.publicKey);
    seedConversation(db, conversationId, self, [friendPhone, friendDesktop]);

    const parkedTokens: string[] = [];
    const parkEnvelope: ParkEnvelopeFn = async (token) => { parkedTokens.push(token); return true; };
    const result = await queueDmMessageCore({
      db, identity: self, conversationId, body: 'multi-device fan-out',
      relayAvailable: true,
      resolvePairSecret: secretMap({
        [friendPhone.publicKey]: 'ab'.repeat(32),
        [friendDesktop.publicKey]: 'cd'.repeat(32),
      }),
      parkEnvelope,
      now: () => NOW,
    });

    expect(result.recipients).toHaveLength(2);
    expect(result.recipients.every((r) => r.parked)).toBe(true);
    expect(parkedTokens).toHaveLength(2);
    expect(new Set(parkedTokens).size).toBe(2); // distinct per-device tokens

    const delivery = getDmDelivery(db, result.event.id);
    expect(delivery).toHaveLength(2);
    expect(delivery.map((d) => d.peer_device_id).sort()).toEqual(
      [friendPhone.publicKey, friendDesktop.publicKey].sort(),
    );
  });

  it('own-device mirror re-seals to a linked own device; with no link it is a genuine zero-park no-op', async () => {
    const db = freshDb();
    const self = generateDeviceIdentity('A-Phone');
    const ownLaptop = generateDeviceIdentity('A-Laptop');
    const friend = generateDeviceIdentity('F');
    const conversationId = dmConversationId(self.publicKey, friend.publicKey);
    seedConversation(db, conversationId, self, [friend]);

    const parkEnvelope: ParkEnvelopeFn = vi.fn(async () => true);
    const secrets = secretMap({
      [friend.publicKey]: 'ab'.repeat(32),
      [ownLaptop.publicKey]: 'ef'.repeat(32),
    });

    // No dm_own_devices link yet: zero extra parks.
    const before = await queueDmMessageCore({
      db, identity: self, conversationId, body: 'before link',
      relayAvailable: true, resolvePairSecret: secrets, parkEnvelope, now: () => NOW,
    });
    expect(before.ownDeviceMirrors).toEqual([]);
    expect(parkEnvelope).toHaveBeenCalledTimes(1); // only the friend

    linkOwnDeviceCore(db, {
      deviceId: ownLaptop.publicKey, identityAnchor: ownLaptop.publicKey, dhPublicKey: ownLaptop.dhPublicKey,
    }, NOW);
    expect(resolveOwnDeviceMirrorTargets(db, self.publicKey)).toHaveLength(1);

    const after = await queueDmMessageCore({
      db, identity: self, conversationId, body: 'after link',
      relayAvailable: true, resolvePairSecret: secrets, parkEnvelope, now: () => NOW,
    });
    expect(after.ownDeviceMirrors).toEqual([{ deviceId: ownLaptop.publicKey, parked: true }]);
    // 1 (friend) again + 1 (own device) = 2 more park calls this round.
    expect(parkEnvelope).toHaveBeenCalledTimes(3);
  });
});

describe('queueDmReceiptCore (send)', () => {
  it('parks a delivered receipt to the message author only on a real park', async () => {
    const db = freshDb();
    const self = generateDeviceIdentity('A');
    const friend = generateDeviceIdentity('F');
    const conversationId = dmConversationId(self.publicKey, friend.publicKey);
    seedConversation(db, conversationId, self, [friend]);

    const event = createDmMessage(friend, { conversationId, body: 'hi', hlc: { wall: NOW, counter: 0 } });
    const { mergeDmEvents } = await import('../(root)/data/dm-core');
    mergeDmEvents(db, conversationId, [event]);

    const parkEnvelope: ParkEnvelopeFn = vi.fn(async () => true);
    const result = await queueDmReceiptCore({
      db, identity: self, conversationId, messageId: event.id, state: 'delivered',
      relayAvailable: true,
      resolvePairSecret: secretMap({ [friend.publicKey]: 'ab'.repeat(32) }),
      parkEnvelope, now: () => NOW,
    });

    expect(result).toMatchObject({ ok: true, skipped: false, authorParked: true });
    expect(parkEnvelope).toHaveBeenCalledTimes(1);
  });

  it('skips a read receipt when the conversation has read receipts disabled', async () => {
    const db = freshDb();
    const self = generateDeviceIdentity('A');
    const friend = generateDeviceIdentity('F');
    const conversationId = dmConversationId(self.publicKey, friend.publicKey);
    seedConversation(db, conversationId, self, [friend]);

    const event = createDmMessage(friend, { conversationId, body: 'hi', hlc: { wall: NOW, counter: 0 } });
    const { mergeDmEvents, setDmReadReceiptsEnabled } = await import('../(root)/data/dm-core');
    mergeDmEvents(db, conversationId, [event]);
    setDmReadReceiptsEnabled(db, conversationId, false);

    const parkEnvelope: ParkEnvelopeFn = vi.fn(async () => true);
    const result = await queueDmReceiptCore({
      db, identity: self, conversationId, messageId: event.id, state: 'read',
      relayAvailable: true,
      resolvePairSecret: secretMap({ [friend.publicKey]: 'ab'.repeat(32) }),
      parkEnvelope, now: () => NOW,
    });

    expect(result).toEqual({ ok: true, skipped: true, reason: 'read_receipts_disabled' });
    expect(parkEnvelope).not.toHaveBeenCalled();
  });

  it('skips when the message was authored by self (you cannot receipt your own message)', async () => {
    const db = freshDb();
    const self = generateDeviceIdentity('A');
    const friend = generateDeviceIdentity('F');
    const conversationId = dmConversationId(self.publicKey, friend.publicKey);
    seedConversation(db, conversationId, self, [friend]);

    const event = createDmMessage(self, { conversationId, body: 'hi', hlc: { wall: NOW, counter: 0 } });
    const { mergeDmEvents } = await import('../(root)/data/dm-core');
    mergeDmEvents(db, conversationId, [event]);

    const result = await queueDmReceiptCore({
      db, identity: self, conversationId, messageId: event.id, state: 'delivered',
      relayAvailable: true,
      resolvePairSecret: secretMap({ [friend.publicKey]: 'ab'.repeat(32) }),
      parkEnvelope: vi.fn(async () => true), now: () => NOW,
    });
    expect(result).toEqual({ ok: true, skipped: true, reason: 'self_authored' });
  });
});

describe('queueDmReceiptCore revoked-recipient filter (Plan 21 Phase 10 item 4)', () => {
  it('parks NO receipt envelope to a blocked message author (engine-path defense-in-depth)', async () => {
    const db = freshDb();
    const self = generateDeviceIdentity('A');
    const friend = generateDeviceIdentity('F');
    const conversationId = dmConversationId(self.publicKey, friend.publicKey);
    seedConversation(db, conversationId, self, [friend]);

    const event = createDmMessage(friend, { conversationId, body: 'hi', hlc: { wall: NOW, counter: 0 } });
    const { mergeDmEvents } = await import('../(root)/data/dm-core');
    mergeDmEvents(db, conversationId, [event]);

    // Block the author, then try to emit a delivered receipt for their message.
    blockDmParticipantCore(db, self, friend.publicKey, 'blocked');

    const parkEnvelope: ParkEnvelopeFn = vi.fn(async () => true);
    const result = await queueDmReceiptCore({
      db, identity: self, conversationId, messageId: event.id, state: 'delivered',
      relayAvailable: true,
      resolvePairSecret: secretMap({ [friend.publicKey]: 'ab'.repeat(32) }),
      parkEnvelope, now: () => NOW,
    });

    expect(result).toMatchObject({ ok: true, skipped: false, authorParked: false });
    expect(parkEnvelope).not.toHaveBeenCalled();
  });
});

describe('planDrainDeliveredReceipts (Plan 21 Phase 10 item 2 + Fix 1, pure decision)', () => {
  it('excludes self-authored, own-device-authored, and blocked authors, and dedups by message id', () => {
    const self = generateDeviceIdentity('A');
    const ownLaptop = generateDeviceIdentity('A-Laptop');
    const friend = generateDeviceIdentity('F');
    const blocked = generateDeviceIdentity('B');
    const conversationId = dmConversationId(self.publicKey, friend.publicKey);
    const mine = createDmMessage(self, { conversationId, body: 'mine', hlc: { wall: NOW, counter: 0 } });
    const fromOwnDevice = createDmMessage(ownLaptop, { conversationId, body: 'from my laptop', hlc: { wall: NOW, counter: 1 } });
    const theirs = createDmMessage(friend, { conversationId, body: 'theirs', hlc: { wall: NOW, counter: 2 } });
    const fromBlocked = createDmMessage(blocked, { conversationId, body: 'x', hlc: { wall: NOW, counter: 3 } });

    const ownIds = new Set([ownLaptop.publicKey]);
    const plans = planDrainDeliveredReceipts(
      self,
      [mine, fromOwnDevice, theirs, theirs, fromBlocked],
      (id) => ownIds.has(id),
      (id) => id === blocked.publicKey,
    );
    // Only the real peer message plans a receipt: not mine, not my own device's, not the blocked author's.
    expect(plans).toEqual([{ messageId: theirs.id, authorDeviceId: friend.publicKey }]);
  });
});

describe('delivered-on-drain (Plan 21 Phase 10 item 2)', () => {
  it('emits a REAL delivered receipt when the drain applies an inbound message (recipient never opens the thread)', async () => {
    const dbSelf = freshDb();
    testDb2 = createInMemoryTestDatabase();
    createSyncTables(testDb2.adapter);
    const dbFriend = testDb2.adapter;

    const self = generateDeviceIdentity('A');
    const friend = generateDeviceIdentity('F');
    const conversationId = dmConversationId(self.publicKey, friend.publicKey);
    const secret = 'ab'.repeat(32);

    // Friend's side: the message exists and is tracked as 'parked' to self.
    seedConversation(dbFriend, conversationId, friend, [self]);
    const event = createDmMessage(friend, { conversationId, body: 'catch up', hlc: { wall: NOW, counter: 0 } });
    const { mergeDmEvents, setDmDelivery, getDmDelivery } = await import('../(root)/data/dm-core');
    mergeDmEvents(dbFriend, conversationId, [event]);
    setDmDelivery(dbFriend, event.id, self.publicKey, 'parked', NOW);
    expect(getDmDelivery(dbFriend, event.id)[0]!.state).toBe('parked');

    const sealed = sealDmDirect({
      sender: friend, conversationId, events: [event],
      recipients: [{ deviceId: self.publicKey, dhPublicKey: self.dhPublicKey, pairSecret: secret }],
    });
    expect(sealed.ok).toBe(true);
    if (!sealed.ok) return;

    const backend = new MailboxRelayBackend();
    // Self drains the message; the handler must emit a delivered receipt back to friend.
    const selfHandlers = buildDmMailboxHandlers({
      db: dbSelf, identity: self,
      resolvePeerDhKey: (id) => (id === friend.publicKey ? friend.dhPublicKey : null),
      resolvePairSecret: secretMap({ [friend.publicKey]: secret }),
      parkEnvelope: async (token, envelope) => { backend.park(token, encodeMailboxEnvelope(envelope)); return true; },
      now: () => NOW,
    });
    const outcome = await applyMailboxEnvelope(self, encodeMailboxEnvelope(sealed.sealed[0]!.envelope), selfHandlers as MailboxEnvelopeHandlers);
    expect(outcome).toEqual({ kind: 'dm-message' });
    expect(listDmMessages(dbSelf, conversationId)).toHaveLength(1);

    // Friend drains: the delivered receipt self parked converges friend to 'delivered'
    // WITHOUT self having opened the thread.
    const friendHandlers = buildDmMailboxHandlers({
      db: dbFriend, identity: friend,
      resolvePeerDhKey: () => null,
      resolvePairSecret: () => null,
      parkEnvelope: async () => false,
      now: () => NOW,
    });
    const drain = await runMailboxDrainJob({
      nowMs: Date.parse(NOW),
      identity: friend, backend, relayUrl: 'ws://relay',
      peers: [{ deviceId: self.publicKey, pairSharedSecretHex: secret, revoked: false, isActive: true }],
      handlers: friendHandlers as MailboxEnvelopeHandlers,
      waitForDrain: async () => {},
    });
    expect(drain.dmReceipts).toBe(1);
    const converged = getDmDelivery(dbFriend, event.id)[0]!;
    expect(converged.state).toBe('delivered');
    expect(converged.receipt_sig).not.toBeNull();
  });

  it('is idempotent: a re-drain that inserts 0 emits no second delivered receipt (TC-6)', async () => {
    const dbSelf = freshDb();
    const self = generateDeviceIdentity('A');
    const friend = generateDeviceIdentity('F');
    const conversationId = dmConversationId(self.publicKey, friend.publicKey);
    const secret = 'ab'.repeat(32);

    const event = createDmMessage(friend, { conversationId, body: 'once', hlc: { wall: NOW, counter: 0 } });
    const sealed = sealDmDirect({
      sender: friend, conversationId, events: [event],
      recipients: [{ deviceId: self.publicKey, dhPublicKey: self.dhPublicKey, pairSecret: secret }],
    });
    expect(sealed.ok).toBe(true);
    if (!sealed.ok) return;

    const parkEnvelope = vi.fn(async () => true);
    const handlers = buildDmMailboxHandlers({
      db: dbSelf, identity: self,
      resolvePeerDhKey: (id) => (id === friend.publicKey ? friend.dhPublicKey : null),
      resolvePairSecret: secretMap({ [friend.publicKey]: secret }),
      parkEnvelope,
      now: () => NOW,
    });
    const bytes = encodeMailboxEnvelope(sealed.sealed[0]!.envelope);
    await applyMailboxEnvelope(self, bytes, handlers as MailboxEnvelopeHandlers);
    expect(parkEnvelope).toHaveBeenCalledTimes(1); // one delivered receipt to the author
    await applyMailboxEnvelope(self, bytes, handlers as MailboxEnvelopeHandlers);
    expect(parkEnvelope).toHaveBeenCalledTimes(1); // re-drain inserts 0 => no second receipt
  });

  it('emits NO delivered receipt when the drained message was authored by my OWN linked device (Fix 1, EMIT layer)', async () => {
    const dbSelf = freshDb();
    const self = generateDeviceIdentity('A-Phone');
    const ownLaptop = generateDeviceIdentity('A-Laptop');
    const conversationId = dmConversationId(self.publicKey, generateDeviceIdentity('F').publicKey);
    const secret = 'ab'.repeat(32);
    // Link my laptop as an own device (a real dm_own_devices row).
    linkOwnDeviceCore(dbSelf, {
      deviceId: ownLaptop.publicKey, identityAnchor: self.publicKey, dhPublicKey: ownLaptop.dhPublicKey,
    }, NOW);

    // A message my laptop authored, mirrored to this phone.
    const event = createDmMessage(ownLaptop, { conversationId, body: 'from my laptop', hlc: { wall: NOW, counter: 0 } });
    const sealed = sealDmDirect({
      sender: ownLaptop, conversationId, events: [event],
      recipients: [{ deviceId: self.publicKey, dhPublicKey: self.dhPublicKey, pairSecret: secret }],
    });
    expect(sealed.ok).toBe(true);
    if (!sealed.ok) return;

    const parkEnvelope = vi.fn(async () => true);
    const handlers = buildDmMailboxHandlers({
      db: dbSelf, identity: self,
      resolvePeerDhKey: (id) => (id === ownLaptop.publicKey ? ownLaptop.dhPublicKey : null),
      resolvePairSecret: secretMap({ [ownLaptop.publicKey]: secret }),
      parkEnvelope, now: () => NOW,
    });
    const outcome = await applyMailboxEnvelope(self, encodeMailboxEnvelope(sealed.sealed[0]!.envelope), handlers as MailboxEnvelopeHandlers);
    // The message still converges onto this device...
    expect(outcome).toEqual({ kind: 'dm-message' });
    expect(listDmMessages(dbSelf, conversationId)).toHaveLength(1);
    // ...but NO delivered receipt is emitted to my own other device for my own message.
    expect(parkEnvelope).not.toHaveBeenCalled();
  });

  it('emits NO delivered receipt for a blocked author on drain', async () => {
    const dbSelf = freshDb();
    const self = generateDeviceIdentity('A');
    const friend = generateDeviceIdentity('F');
    const conversationId = dmConversationId(self.publicKey, friend.publicKey);
    const secret = 'ab'.repeat(32);
    blockDmParticipantCore(dbSelf, self, friend.publicKey, 'blocked');

    const event = createDmMessage(friend, { conversationId, body: 'hi', hlc: { wall: NOW, counter: 0 } });
    const sealed = sealDmDirect({
      sender: friend, conversationId, events: [event],
      recipients: [{ deviceId: self.publicKey, dhPublicKey: self.dhPublicKey, pairSecret: secret }],
    });
    expect(sealed.ok).toBe(true);
    if (!sealed.ok) return;

    const parkEnvelope = vi.fn(async () => true);
    const handlers = buildDmMailboxHandlers({
      db: dbSelf, identity: self,
      resolvePeerDhKey: (id) => (id === friend.publicKey ? friend.dhPublicKey : null),
      resolvePairSecret: secretMap({ [friend.publicKey]: secret }),
      parkEnvelope,
      now: () => NOW,
    });
    await applyMailboxEnvelope(self, encodeMailboxEnvelope(sealed.sealed[0]!.envelope), handlers as MailboxEnvelopeHandlers);
    expect(parkEnvelope).not.toHaveBeenCalled();
  });
});

describe('buildDmMailboxHandlers - dmMessage (drain apply, real seal + open + verify)', () => {
  it('bootstraps the conversation + sender participant row and merges verified events', async () => {
    const dbA = freshDb();
    const self = generateDeviceIdentity('A');
    const friend = generateDeviceIdentity('F');
    const conversationId = dmConversationId(self.publicKey, friend.publicKey);
    const secret = 'ab'.repeat(32);

    const event = createDmMessage(friend, { conversationId, body: 'hello from F', hlc: { wall: NOW, counter: 0 } });
    const sealed = sealDmDirect({
      sender: friend, conversationId, events: [event],
      recipients: [{ deviceId: self.publicKey, dhPublicKey: self.dhPublicKey, pairSecret: secret }],
    });
    expect(sealed.ok).toBe(true);
    if (!sealed.ok) return;

    const handlers = buildDmMailboxHandlers({
      db: dbA, identity: self,
      resolvePeerDhKey: (id) => (id === friend.publicKey ? friend.dhPublicKey : null),
      resolvePairSecret: () => null,
      parkEnvelope: async () => false,
      now: () => NOW,
    });

    const envelopeBytes = encodeMailboxEnvelope(sealed.sealed[0]!.envelope);
    const outcome = await applyMailboxEnvelope(self, envelopeBytes, handlers as MailboxEnvelopeHandlers);
    expect(outcome).toEqual({ kind: 'dm-message' });

    expect(getDmConversation(dbA, conversationId)).not.toBeNull();
    const participants = listDmParticipants(dbA, conversationId);
    expect(participants.map((p) => p.device_id).sort()).toEqual([friend.publicKey, self.publicKey].sort());
    expect(listDmMessages(dbA, conversationId)).toHaveLength(1);
    expect(listDmMessages(dbA, conversationId)[0]!.body).toBe('hello from F');
  });

  it('idempotent re-drain: draining the same parked message twice never duplicates', async () => {
    const dbA = freshDb();
    const self = generateDeviceIdentity('A');
    const friend = generateDeviceIdentity('F');
    const conversationId = dmConversationId(self.publicKey, friend.publicKey);
    const secret = 'ab'.repeat(32);

    const event = createDmMessage(friend, { conversationId, body: 'once', hlc: { wall: NOW, counter: 0 } });
    const sealed = sealDmDirect({
      sender: friend, conversationId, events: [event],
      recipients: [{ deviceId: self.publicKey, dhPublicKey: self.dhPublicKey, pairSecret: secret }],
    });
    expect(sealed.ok).toBe(true);
    if (!sealed.ok) return;

    const handlers = buildDmMailboxHandlers({
      db: dbA, identity: self,
      resolvePeerDhKey: (id) => (id === friend.publicKey ? friend.dhPublicKey : null),
      resolvePairSecret: () => null,
      parkEnvelope: async () => false,
      now: () => NOW,
    });

    const envelopeBytes = encodeMailboxEnvelope(sealed.sealed[0]!.envelope);
    const first = await applyMailboxEnvelope(self, envelopeBytes, handlers as MailboxEnvelopeHandlers);
    const second = await applyMailboxEnvelope(self, envelopeBytes, handlers as MailboxEnvelopeHandlers);
    expect(first).toEqual({ kind: 'dm-message' });
    // A pure duplicate re-merge inserts nothing new: the dispatcher counts it rejected.
    expect(second).toEqual({ kind: 'rejected' });
    expect(listDmMessages(dbA, conversationId)).toHaveLength(1);
  });
});

describe('buildDmMailboxHandlers - dmReceipt (drain apply, real seal + open + verify)', () => {
  it('advances delivery state on a real inbound receipt and stores the receipt signature', async () => {
    const dbA = freshDb();
    const self = generateDeviceIdentity('A');
    const friend = generateDeviceIdentity('F');
    const conversationId = dmConversationId(self.publicKey, friend.publicKey);
    const secret = 'ab'.repeat(32);

    const event = createDmMessage(self, { conversationId, body: 'to friend', hlc: { wall: NOW, counter: 0 } });
    const receipt = createDmReceipt(friend, { conversationId, messageId: event.id, state: 'delivered', at: NOW });
    const sealed = sealDmReceipt({
      sender: friend, recipient: { deviceId: self.publicKey, dhPublicKey: self.dhPublicKey },
      pairSharedSecretHex: secret, receipt, now: NOW,
    });

    const handlers = buildDmMailboxHandlers({
      db: dbA, identity: self,
      resolvePeerDhKey: () => null,
      resolvePairSecret: () => null,
      parkEnvelope: async () => false,
      now: () => NOW,
    });

    const outcome = await applyMailboxEnvelope(self, encodeMailboxEnvelope(sealed.envelope), handlers as MailboxEnvelopeHandlers);
    expect(outcome).toEqual({ kind: 'dm-receipt' });

    const delivery = getDmDelivery(dbA, event.id);
    expect(delivery).toHaveLength(1);
    expect(delivery[0]!.state).toBe('delivered');
    expect(delivery[0]!.receipt_sig).toBe(receipt.signature);
  });

  it('never fabricates delivered/read without a real verified inbound receipt (a tampered receipt is dropped)', async () => {
    const dbA = freshDb();
    ensureDmTables(dbA);
    const self = generateDeviceIdentity('A');
    const friend = generateDeviceIdentity('F');
    const conversationId = dmConversationId(self.publicKey, friend.publicKey);
    const secret = 'ab'.repeat(32);

    const event = createDmMessage(self, { conversationId, body: 'to friend', hlc: { wall: NOW, counter: 0 } });
    const receipt = createDmReceipt(friend, { conversationId, messageId: event.id, state: 'read', at: NOW });
    // Tamper with the state AFTER signing: the receipt's own signature no longer verifies.
    const tampered = { ...receipt, state: 'delivered' as const };
    const sealed = sealDmReceipt({
      sender: friend, recipient: { deviceId: self.publicKey, dhPublicKey: self.dhPublicKey },
      pairSharedSecretHex: secret, receipt: tampered, now: NOW,
    });

    const handlers = buildDmMailboxHandlers({
      db: dbA, identity: self,
      resolvePeerDhKey: () => null,
      resolvePairSecret: () => null,
      parkEnvelope: async () => false,
      now: () => NOW,
    });

    const outcome = await applyMailboxEnvelope(self, encodeMailboxEnvelope(sealed.envelope), handlers as MailboxEnvelopeHandlers);
    expect(outcome).toEqual({ kind: 'rejected' });
    expect(getDmDelivery(dbA, event.id)).toHaveLength(0);
  });
});

describe('TC-12: own-device mirror spine (two engines under one identity anchor + one friend)', () => {
  it('an outbound message and a verified inbound receipt both re-seal to the own device, which converges by draining', async () => {
    const dbA1 = freshDb();
    testDb2 = createInMemoryTestDatabase();
    const dbA2 = testDb2.adapter;
    // The real app always boots the sync schema (block-awareness) before any
    // drain; provision it here so the DM drain's revocation check has its table.
    createSyncTables(dbA2);
    ensureDmTables(dbA2);

    const a1 = generateDeviceIdentity('A-Phone');
    const a2 = generateDeviceIdentity('A-Laptop');
    const friend = generateDeviceIdentity('F');
    const conversationId = dmConversationId(a1.publicKey, friend.publicKey);
    const secretA1F = 'ab'.repeat(32);
    const secretA1A2 = 'cd'.repeat(32);

    seedConversation(dbA1, conversationId, a1, [friend]);
    linkOwnDeviceCore(dbA1, {
      deviceId: a2.publicKey, identityAnchor: a2.publicKey, dhPublicKey: a2.dhPublicKey,
    }, NOW);

    const backend = new MailboxRelayBackend();

    // A1 sends a message to F; it must ALSO re-seal to A2 (the own-device mirror).
    const sendResult = await queueDmMessageCore({
      db: dbA1, identity: a1, conversationId, body: 'hi from phone',
      relayAvailable: true,
      resolvePairSecret: secretMap({ [friend.publicKey]: secretA1F, [a2.publicKey]: secretA1A2 }),
      parkEnvelope: async (token, envelope) => { backend.park(token, encodeMailboxEnvelope(envelope)); return true; },
      now: () => NOW,
    });
    expect(sendResult.ownDeviceMirrors).toEqual([{ deviceId: a2.publicKey, parked: true }]);

    // A2 drains its own mailbox (addressed by deriveMailboxToken(secretA1A2, a2.publicKey)),
    // bootstraps the conversation locally, and converges via mergeDmEvents.
    const a2Handlers = buildDmMailboxHandlers({
      db: dbA2, identity: a2,
      resolvePeerDhKey: (id) => (id === a1.publicKey ? a1.dhPublicKey : null),
      resolvePairSecret: () => null,
      parkEnvelope: async () => false,
      now: () => NOW,
    });
    const drainA2 = await runMailboxDrainJob({
      nowMs: Date.parse(NOW),
      identity: a2, backend, relayUrl: 'ws://relay',
      peers: [{ deviceId: a1.publicKey, pairSharedSecretHex: secretA1A2, revoked: false, isActive: true }],
      handlers: a2Handlers as MailboxEnvelopeHandlers,
      waitForDrain: async () => {},
    });
    expect(drainA2.dmMessages).toBe(1);
    expect(listDmMessages(dbA2, conversationId)).toHaveLength(1);
    expect(listDmMessages(dbA2, conversationId)[0]!.body).toBe('hi from phone');

    // F acknowledges: seals a 'read' receipt back to A1's device specifically
    // (F never learned about A2 directly).
    const messageId = sendResult.event.id;
    const receipt = createDmReceipt(friend, { conversationId, messageId, state: 'read', at: NOW });
    const receiptSealed = sealDmReceipt({
      sender: friend, recipient: { deviceId: a1.publicKey, dhPublicKey: a1.dhPublicKey },
      pairSharedSecretHex: secretA1F, receipt, now: NOW,
    });
    backend.park(receiptSealed.token, encodeMailboxEnvelope(receiptSealed.envelope));

    // A1 drains F's receipt: applies it locally AND re-seals it onward to A2.
    const a1Handlers = buildDmMailboxHandlers({
      db: dbA1, identity: a1,
      resolvePeerDhKey: (id) => (id === friend.publicKey ? friend.dhPublicKey : null),
      resolvePairSecret: secretMap({ [a2.publicKey]: secretA1A2 }),
      parkEnvelope: async (token, envelope) => { backend.park(token, encodeMailboxEnvelope(envelope)); return true; },
      now: () => NOW,
    });
    const drainA1 = await runMailboxDrainJob({
      nowMs: Date.parse(NOW),
      identity: a1, backend, relayUrl: 'ws://relay',
      peers: [{ deviceId: friend.publicKey, pairSharedSecretHex: secretA1F, revoked: false, isActive: true }],
      handlers: a1Handlers as MailboxEnvelopeHandlers,
      waitForDrain: async () => {},
    });
    expect(drainA1.dmReceipts).toBe(1);
    expect(getDmDelivery(dbA1, messageId)[0]!.state).toBe('read');

    // A2 now drains its own mailbox again and picks up the FORWARDED receipt.
    const drainA2Receipt = await runMailboxDrainJob({
      nowMs: Date.parse(NOW),
      identity: a2, backend, relayUrl: 'ws://relay',
      peers: [{ deviceId: a1.publicKey, pairSharedSecretHex: secretA1A2, revoked: false, isActive: true }],
      handlers: a2Handlers as MailboxEnvelopeHandlers,
      waitForDrain: async () => {},
    });
    expect(drainA2Receipt.dmReceipts).toBe(1);
    expect(getDmDelivery(dbA2, messageId)[0]!.state).toBe('read');
  });

  it('with no dm_own_devices link, the mirror is a genuine no-op: zero extra parks', async () => {
    const dbA1 = freshDb();
    const a1 = generateDeviceIdentity('A-Phone');
    const friend = generateDeviceIdentity('F');
    const conversationId = dmConversationId(a1.publicKey, friend.publicKey);
    seedConversation(dbA1, conversationId, a1, [friend]);

    let parkCount = 0;
    const result = await queueDmMessageCore({
      db: dbA1, identity: a1, conversationId, body: 'no mirror configured',
      relayAvailable: true,
      resolvePairSecret: secretMap({ [friend.publicKey]: 'ab'.repeat(32) }),
      parkEnvelope: async () => { parkCount += 1; return true; },
      now: () => NOW,
    });

    expect(result.ownDeviceMirrors).toEqual([]);
    expect(parkCount).toBe(1); // the friend only
  });
});

describe('background-sync parity: the SAME buildDmMailboxHandlers drains a DM message headlessly', () => {
  it('runBackgroundSyncCore applies a parked DM message into dm_messages', async () => {
    const db = freshDb();
    const { ensureMeerkatTables, setSetting } = await import('../(root)/data/db');
    const { ensureSyncSchema, RELAY_URL_SETTING_KEY } = await import('../(root)/data/sync-core');
    ensureMeerkatTables(db);
    ensureSyncSchema(db);
    setSetting(db, RELAY_URL_SETTING_KEY, 'ws://relay');

    const self = generateDeviceIdentity('A');
    const friend = generateDeviceIdentity('F');
    const conversationId = dmConversationId(self.publicKey, friend.publicKey);
    const secret = 'ab'.repeat(32);

    const sharedSecretRef = storeSharedSecret(self.publicKey, friend.publicKey, secret);
    insertPairedDevice(db, {
      deviceId: friend.publicKey, displayName: friend.displayName, dhPublicKey: friend.dhPublicKey,
      sharedSecretRef, isActive: true, pairedAt: NOW, bytesSent: 0, bytesReceived: 0,
      lastSeenAt: null, lastSyncAt: null, lastSyncModule: null,
    } as unknown as import('@mylife/sync').PairedDevice);

    const event = createDmMessage(friend, { conversationId, body: 'headless drain', hlc: { wall: NOW, counter: 0 } });
    const sealed = sealDmDirect({
      sender: friend, conversationId, events: [event],
      recipients: [{ deviceId: self.publicKey, dhPublicKey: self.dhPublicKey, pairSecret: secret }],
    });
    expect(sealed.ok).toBe(true);
    if (!sealed.ok) return;

    const backend = new MailboxRelayBackend();
    backend.park(sealed.sealed[0]!.token, encodeMailboxEnvelope(sealed.sealed[0]!.envelope));

    const result = await runBackgroundSyncCore({
      db,
      configureCrypto: () => {},
      getIdentity: () => self,
      backend,
      buildHandlers: (identity) => ({
        ...buildDmMailboxHandlers({
          db, identity,
          resolvePeerDhKey: (id) => (id === friend.publicKey ? friend.dhPublicKey : null),
          resolvePairSecret: () => null,
          parkEnvelope: async () => false,
        }),
      }),
      now: () => NOW,
    });

    expect(result.ran).toBe(true);
    expect(result.drain?.dmMessages).toBe(1);
    expect(listDmMessages(db, conversationId)).toHaveLength(1);
  });
});
