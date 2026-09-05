/**
 * Plan 21 Phase 7: group DM provider (dm-provider-core group functions +
 * dmGroupCommit / group-mode dmMessage drain handlers).
 *
 * Proves the three review requirements handed forward from the Phase 6 review:
 *  1. The DM_GROUP_COMMIT handoff is delivered by the recipient draining its own
 *     deriveDmGroupCommitToken(cid, self) as an extraToken (the FF3 trap avoided).
 *  2. The persisted admin-signed descriptor is authoritative: message recipients
 *     come from it, a removed member is never addressed, and the local roster is
 *     reconciled (removed members pruned). A replayed older commit never regresses.
 *  3. A group message needs a pair secret per recipient; a member without one is
 *     honestly parked:false.
 * Plus admin-only mutation and no-relay honesty.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createInMemoryTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import {
  applyMailboxEnvelope,
  configureSyncSecretStore,
  createInMemorySyncSecretStore,
  createSyncTables,
  deriveDmGroupCommitToken,
  encodeMailboxEnvelope,
  generateDeviceIdentity,
  getCurrentEpochKey,
  runMailboxDrainJob,
  type DeviceIdentity,
  type MailboxDrainPeer,
  type MailboxEnvelopeHandlers,
  type RelayBackend,
  type RelaySession,
} from '@mylife/sync';
import {
  getDmConversation,
  listDmMessages,
  listDmParticipants,
} from '../(root)/data/dm-core';
import {
  buildDmGroupMailboxHandlers,
  buildDmMailboxHandlers,
  createDmGroupCore,
  dmGroupAddMemberCore,
  dmGroupRemoveMemberCore,
  queueDmMessageCore,
  type ParkEnvelopeFn,
  type ResolvePairSecret,
} from '../(root)/data/dm-provider-core';

const NOW = '2026-07-02T00:00:00.000Z';

/** Store-and-forward mailbox backend (mirrors the relay drain-on-join). */
class MailboxRelayBackend implements RelayBackend {
  private readonly mailbox = new Map<string, Uint8Array[]>();
  destroyed = false;

  park(token: string, bytes: Uint8Array): void {
    const queue = this.mailbox.get(token) ?? [];
    queue.push(bytes);
    this.mailbox.set(token, queue);
  }

  async connect(_url: string, token: string): Promise<RelaySession> {
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

const dbs: InMemoryTestDatabase[] = [];
function freshDb(): InMemoryTestDatabase['adapter'] {
  const db = createInMemoryTestDatabase();
  dbs.push(db);
  // Group DMs write the sync_workspaces / members / keys tables (createDmGroup).
  createSyncTables(db.adapter);
  return db.adapter;
}

beforeEach(() => {
  configureSyncSecretStore(createInMemorySyncSecretStore());
});
afterEach(() => {
  for (const db of dbs.splice(0)) db.close();
});

type Adapter = InMemoryTestDatabase['adapter'];
const member = (id: DeviceIdentity, role: 'member' | 'admin' = 'member') =>
  ({ deviceId: id.publicKey, dhPublicKey: id.dhPublicKey, role });
const secretMap = (pairs: Record<string, string>): ResolvePairSecret =>
  (deviceId: string) => pairs[deviceId] ?? null;
const noWait = () => Promise.resolve();

/** A park that pushes into the shared backend. */
const parkTo = (backend: MailboxRelayBackend): ParkEnvelopeFn =>
  async (token, envelope) => { backend.park(token, encodeMailboxEnvelope(envelope)); return true; };

/** Drain a member's DM_GROUP_COMMIT token (the extraToken the provider must poll). */
function drainGroupCommit(db: Adapter, identity: DeviceIdentity, backend: MailboxRelayBackend, cid: string) {
  return runMailboxDrainJob({
    nowMs: Date.parse(NOW),
    identity, backend, relayUrl: 'ws://test', peers: [],
    handlers: buildDmGroupMailboxHandlers({ db, identity, now: () => NOW }),
    extraTokens: [{ token: deriveDmGroupCommitToken(cid, identity.publicKey), label: 'dm-group' }],
    waitForDrain: noWait,
  });
}

/** Drain a group COMMIT over the sender's pair-private mailbox (the bootstrap path a new member uses). */
function drainPeerCommit(
  db: Adapter, identity: DeviceIdentity, backend: MailboxRelayBackend, senderId: string, pairSecret: string,
) {
  const peer: MailboxDrainPeer = { deviceId: senderId, pairSharedSecretHex: pairSecret, revoked: false, isActive: true };
  return runMailboxDrainJob({
    nowMs: Date.parse(NOW),
    identity, backend, relayUrl: 'ws://test', peers: [peer],
    handlers: buildDmGroupMailboxHandlers({ db, identity, now: () => NOW }),
    waitForDrain: noWait,
  });
}

/** Drain a group MESSAGE over the sender's pair-private mailbox (the 1:1 handler path). */
function drainGroupMessage(
  db: Adapter, identity: DeviceIdentity, backend: MailboxRelayBackend, senderId: string, pairSecret: string,
) {
  const peer: MailboxDrainPeer = { deviceId: senderId, pairSharedSecretHex: pairSecret, revoked: false, isActive: true };
  return runMailboxDrainJob({
    nowMs: Date.parse(NOW),
    identity, backend, relayUrl: 'ws://test', peers: [peer],
    handlers: buildDmMailboxHandlers({
      db, identity,
      resolvePeerDhKey: () => null,
      resolvePairSecret: () => null,
      parkEnvelope: async () => false,
      now: () => NOW,
    }),
    waitForDrain: noWait,
  });
}

describe('createDmGroupCore: persist + handoff, member converges via its extra token', () => {
  it('creates a group, hands off epoch 1, and B drains its own token to hold the key + roster', async () => {
    const dbA = freshDb();
    const dbB = freshDb();
    const dbC = freshDb();
    const a = generateDeviceIdentity('Admin');
    const b = generateDeviceIdentity('Bea');
    const c = generateDeviceIdentity('Cal');
    const backend = new MailboxRelayBackend();

    const created = await createDmGroupCore({
      db: dbA, identity: a, title: 'Trip crew', members: [member(b), member(c)],
      relayAvailable: true, resolvePairSecret: () => null, parkEnvelope: parkTo(backend), now: () => NOW,
    });
    const cid = created.conversationId;

    // Admin local state: group conversation + authoritative descriptor + roster.
    const convA = getDmConversation(dbA, cid)!;
    expect(convA.kind).toBe('group');
    expect(convA.admin_device_id).toBe(a.publicKey);
    expect(convA.current_epoch).toBe(1);
    expect(convA.descriptor_json).toBeTruthy();
    expect(listDmParticipants(dbA, cid).map((p) => p.device_id).sort())
      .toEqual([a.publicKey, b.publicKey, c.publicKey].sort());
    // Handoffs really parked to the two other members.
    expect(created.handoffs.map((h) => h.deviceId).sort()).toEqual([b.publicKey, c.publicKey].sort());
    expect(created.handoffs.every((h) => h.parked)).toBe(true);

    // B drains ITS OWN deriveDmGroupCommitToken and converges on epoch 1.
    const drainB = await drainGroupCommit(dbB, b, backend, cid);
    expect(drainB.dmGroupCommits).toBe(1);
    expect(drainB.rejected).toBe(0);
    expect(getCurrentEpochKey(dbB, cid, b)?.epoch).toBe(1);
    expect(getCurrentEpochKey(dbB, cid, b)?.secret).toEqual(getCurrentEpochKey(dbA, cid, a)?.secret);
    const convB = getDmConversation(dbB, cid)!;
    expect(convB.kind).toBe('group');
    expect(convB.current_epoch).toBe(1);
    expect(listDmParticipants(dbB, cid).map((p) => p.device_id).sort())
      .toEqual([a.publicKey, b.publicKey, c.publicKey].sort());
    expect(listDmParticipants(dbB, cid).find((p) => p.device_id === b.publicKey)?.is_self).toBe(1);

    // C likewise converges.
    const drainC = await drainGroupCommit(dbC, c, backend, cid);
    expect(drainC.dmGroupCommits).toBe(1);
    expect(getCurrentEpochKey(dbC, cid, c)?.epoch).toBe(1);
  });

  it('bootstrap: a member with NO prior knowledge of the conversation id converges via its pair mailbox', async () => {
    const dbA = freshDb();
    const dbB = freshDb();
    const a = generateDeviceIdentity('Admin');
    const b = generateDeviceIdentity('Bea');
    const backend = new MailboxRelayBackend();
    const secretAB = 'ab'.repeat(32);

    const created = await createDmGroupCore({
      db: dbA, identity: a, title: 'Trip crew', members: [member(b)],
      relayAvailable: true,
      resolvePairSecret: secretMap({ [b.publicKey]: secretAB }),
      parkEnvelope: parkTo(backend), now: () => NOW,
    });

    // B drains ONLY its pair-private mailbox (the normal peer drain) - it has no
    // dm_conversations row for this group yet, so it could not derive the
    // conversation-scoped token. This is the real bootstrap path.
    const drainB = await drainPeerCommit(dbB, b, backend, a.publicKey, secretAB);
    expect(drainB.dmGroupCommits).toBe(1);
    expect(getDmConversation(dbB, created.conversationId)?.kind).toBe('group');
    expect(getCurrentEpochKey(dbB, created.conversationId, b)?.epoch).toBe(1);
  });

  it('dedup: the same epoch delivered on BOTH the pair token and the conversation token applies once', async () => {
    const dbA = freshDb();
    const dbB = freshDb();
    const a = generateDeviceIdentity('Admin');
    const b = generateDeviceIdentity('Bea');
    const backend = new MailboxRelayBackend();
    const secretAB = 'ab'.repeat(32);

    const created = await createDmGroupCore({
      db: dbA, identity: a, title: 'Trip crew', members: [member(b)],
      relayAvailable: true,
      resolvePairSecret: secretMap({ [b.publicKey]: secretAB }),
      parkEnvelope: parkTo(backend), now: () => NOW,
    });
    const cid = created.conversationId;

    // First: the pair-token copy applies (the bootstrap).
    const first = await drainPeerCommit(dbB, b, backend, a.publicKey, secretAB);
    expect(first.dmGroupCommits).toBe(1);
    // Second: the conversation-token copy is the SAME epoch - deduped to rejected.
    const second = await drainGroupCommit(dbB, b, backend, cid);
    expect(second.dmGroupCommits).toBe(0);
    expect(second.rejected).toBeGreaterThanOrEqual(1);
    expect(getCurrentEpochKey(dbB, cid, b)?.epoch).toBe(1);
  });

  it('no relay: the group is still created locally, handoffs report parked:false', async () => {
    const dbA = freshDb();
    const a = generateDeviceIdentity('Admin');
    const b = generateDeviceIdentity('Bea');
    let parkCalls = 0;
    const created = await createDmGroupCore({
      db: dbA, identity: a, title: 'Solo-ish', members: [member(b)],
      relayAvailable: false,
      resolvePairSecret: () => null,
      parkEnvelope: async () => { parkCalls += 1; return true; },
      now: () => NOW,
    });
    expect(getDmConversation(dbA, created.conversationId)?.kind).toBe('group');
    expect(created.handoffs).toEqual([{ deviceId: b.publicKey, parked: false }]);
    expect(parkCalls).toBe(0);
  });
});

describe('group messages: sealed under the epoch, delivered over the pair mailbox', () => {
  it('A sends a group message; B (converged) reads it', async () => {
    const dbA = freshDb();
    const dbB = freshDb();
    const a = generateDeviceIdentity('Admin');
    const b = generateDeviceIdentity('Bea');
    const c = generateDeviceIdentity('Cal');
    const backend = new MailboxRelayBackend();
    const secretAB = 'ab'.repeat(32);
    const secretAC = 'cd'.repeat(32);

    const created = await createDmGroupCore({
      db: dbA, identity: a, title: 'Trip crew', members: [member(b), member(c)],
      relayAvailable: true, resolvePairSecret: () => null, parkEnvelope: parkTo(backend), now: () => NOW,
    });
    const cid = created.conversationId;
    await drainGroupCommit(dbB, b, backend, cid);

    const send = await queueDmMessageCore({
      db: dbA, identity: a, conversationId: cid, body: 'dinner at 8?',
      relayAvailable: true,
      resolvePairSecret: secretMap({ [b.publicKey]: secretAB, [c.publicKey]: secretAC }),
      parkEnvelope: parkTo(backend), now: () => NOW,
    });
    // Recipients come from the descriptor (B + C), all parked.
    expect(send.recipients.map((r) => r.deviceId).sort()).toEqual([b.publicKey, c.publicKey].sort());
    expect(send.recipients.every((r) => r.parked)).toBe(true);
    expect(send.ownDeviceMirrors).toEqual([]);

    const drainMsg = await drainGroupMessage(dbB, b, backend, a.publicKey, secretAB);
    expect(drainMsg.dmMessages).toBe(1);
    const messages = listDmMessages(dbB, cid);
    expect(messages).toHaveLength(1);
    expect(messages[0]!.body).toBe('dinner at 8?');
  });

  it('a member with no pair secret is honestly parked:false', async () => {
    const dbA = freshDb();
    const a = generateDeviceIdentity('Admin');
    const b = generateDeviceIdentity('Bea');
    const backend = new MailboxRelayBackend();
    const created = await createDmGroupCore({
      db: dbA, identity: a, title: 'Trip crew', members: [member(b)],
      relayAvailable: true, resolvePairSecret: () => null, parkEnvelope: parkTo(backend), now: () => NOW,
    });
    const send = await queueDmMessageCore({
      db: dbA, identity: a, conversationId: created.conversationId, body: 'hi',
      relayAvailable: true,
      resolvePairSecret: () => null, // B not usably paired
      parkEnvelope: parkTo(backend), now: () => NOW,
    });
    expect(send.recipients).toEqual([{ deviceId: b.publicKey, parked: false }]);
    // The local echo is still written honestly.
    expect(listDmMessages(dbA, created.conversationId)).toHaveLength(1);
  });
});

describe('add / remove: admin-only, descriptor-authoritative recipients, roster reconciliation', () => {
  it('remove prunes the member locally and stops addressing them; only remaining members are handed off', async () => {
    const dbA = freshDb();
    const dbB = freshDb();
    const a = generateDeviceIdentity('Admin');
    const b = generateDeviceIdentity('Bea');
    const c = generateDeviceIdentity('Cal');
    const backend = new MailboxRelayBackend();

    const created = await createDmGroupCore({
      db: dbA, identity: a, title: 'Trip crew', members: [member(b), member(c)],
      relayAvailable: true, resolvePairSecret: () => null, parkEnvelope: parkTo(backend), now: () => NOW,
    });
    const cid = created.conversationId;
    await drainGroupCommit(dbB, b, backend, cid);

    const removed = await dmGroupRemoveMemberCore({
      db: dbA, identity: a, conversationId: cid, removedDeviceId: c.publicKey,
      relayAvailable: true, resolvePairSecret: () => null, parkEnvelope: parkTo(backend), now: () => NOW,
    });
    expect(removed.ok).toBe(true);
    if (!removed.ok) return;
    expect(removed.epoch).toBe(2);
    // Only the remaining member (B) is handed off the new epoch; C is never addressed.
    expect(removed.handoffs.map((h) => h.deviceId)).toEqual([b.publicKey]);
    // Admin roster: C pruned (removed_at set), still visible with includeRemoved.
    expect(listDmParticipants(dbA, cid).map((p) => p.device_id).sort()).toEqual([a.publicKey, b.publicKey].sort());
    expect(listDmParticipants(dbA, cid, { includeRemoved: true }).find((p) => p.device_id === c.publicKey)?.removed_at)
      .toBeTruthy();

    // B applies the removal and its roster reconciles (C pruned locally too).
    const drainB2 = await drainGroupCommit(dbB, b, backend, cid);
    expect(drainB2.dmGroupCommits).toBe(1);
    expect(getCurrentEpochKey(dbB, cid, b)?.epoch).toBe(2);
    expect(listDmParticipants(dbB, cid).map((p) => p.device_id).sort()).toEqual([a.publicKey, b.publicKey].sort());

    // A new message after removal addresses ONLY B (recipients from the epoch-2 descriptor).
    const send = await queueDmMessageCore({
      db: dbA, identity: a, conversationId: cid, body: 'C is out',
      relayAvailable: true,
      resolvePairSecret: secretMap({ [b.publicKey]: 'ab'.repeat(32), [c.publicKey]: 'cd'.repeat(32) }),
      parkEnvelope: parkTo(backend), now: () => NOW,
    });
    expect(send.recipients.map((r) => r.deviceId)).toEqual([b.publicKey]);
  });

  it('add advances the epoch and hands off to every current member', async () => {
    const dbA = freshDb();
    const a = generateDeviceIdentity('Admin');
    const b = generateDeviceIdentity('Bea');
    const newbie = generateDeviceIdentity('Newbie');
    const backend = new MailboxRelayBackend();

    const created = await createDmGroupCore({
      db: dbA, identity: a, title: 'Trip crew', members: [member(b)],
      relayAvailable: true, resolvePairSecret: () => null, parkEnvelope: parkTo(backend), now: () => NOW,
    });
    const added = await dmGroupAddMemberCore({
      db: dbA, identity: a, conversationId: created.conversationId, added: member(newbie),
      relayAvailable: true, resolvePairSecret: () => null, parkEnvelope: parkTo(backend), now: () => NOW,
    });
    expect(added.ok).toBe(true);
    if (!added.ok) return;
    expect(added.epoch).toBe(2);
    expect(added.handoffs.map((h) => h.deviceId).sort()).toEqual([b.publicKey, newbie.publicKey].sort());
    expect(listDmParticipants(dbA, created.conversationId).map((p) => p.device_id).sort())
      .toEqual([a.publicKey, b.publicKey, newbie.publicKey].sort());
  });

  it('a non-admin member cannot add or remove (not_admin)', async () => {
    const dbA = freshDb();
    const dbB = freshDb();
    const a = generateDeviceIdentity('Admin');
    const b = generateDeviceIdentity('Bea');
    const stranger = generateDeviceIdentity('Stranger');
    const backend = new MailboxRelayBackend();

    const created = await createDmGroupCore({
      db: dbA, identity: a, title: 'Trip crew', members: [member(b)],
      relayAvailable: true, resolvePairSecret: () => null, parkEnvelope: parkTo(backend), now: () => NOW,
    });
    await drainGroupCommit(dbB, b, backend, created.conversationId);

    // B holds the descriptor but is NOT the admin.
    const attempt = await dmGroupAddMemberCore({
      db: dbB, identity: b, conversationId: created.conversationId, added: member(stranger),
      relayAvailable: true, resolvePairSecret: () => null, parkEnvelope: parkTo(backend), now: () => NOW,
    });
    expect(attempt).toEqual({ ok: false, reason: 'not_admin' });
  });
});

describe('monotonic roster guard: a replayed older commit never resurrects a removed member', () => {
  it('re-applying the captured stale epoch-1 handoff after removal keeps C pruned', async () => {
    const dbA = freshDb();
    const dbB = freshDb();
    const a = generateDeviceIdentity('Admin');
    const b = generateDeviceIdentity('Bea');
    const c = generateDeviceIdentity('Cal');
    const backend = new MailboxRelayBackend();

    // Capture every parked handoff (token -> bytes) so we can replay the stale one.
    const parked = new Map<string, Uint8Array>();
    const capturingPark: ParkEnvelopeFn = async (token, envelope) => {
      const bytes = encodeMailboxEnvelope(envelope);
      parked.set(token, bytes);
      backend.park(token, bytes);
      return true;
    };

    const created = await createDmGroupCore({
      db: dbA, identity: a, title: 'Trip crew', members: [member(b), member(c)],
      relayAvailable: true, resolvePairSecret: () => null, parkEnvelope: capturingPark, now: () => NOW,
    });
    const cid = created.conversationId;
    const staleEpoch1Bytes = parked.get(deriveDmGroupCommitToken(cid, b.publicKey))!;
    expect(staleEpoch1Bytes).toBeTruthy();

    // B converges on epoch 1, then A removes C (epoch 2) and B converges on 2.
    await drainGroupCommit(dbB, b, backend, cid);
    expect(getCurrentEpochKey(dbB, cid, b)?.epoch).toBe(1);
    await dmGroupRemoveMemberCore({
      db: dbA, identity: a, conversationId: cid, removedDeviceId: c.publicKey,
      relayAvailable: true, resolvePairSecret: () => null, parkEnvelope: parkTo(backend), now: () => NOW,
    });
    await drainGroupCommit(dbB, b, backend, cid);
    expect(getCurrentEpochKey(dbB, cid, b)?.epoch).toBe(2);
    expect(listDmParticipants(dbB, cid).map((p) => p.device_id).sort()).toEqual([a.publicKey, b.publicKey].sort());

    // Replay the STALE epoch-1 handoff (descriptor lists C) directly onto B. The
    // stale descriptor.epoch (1) is at/below B's stored epoch (2), so it applies
    // nothing new (honestly counted 'rejected') and, critically, the roster is NOT
    // regressed: C stays pruned.
    const handlersB = buildDmGroupMailboxHandlers({ db: dbB, identity: b, now: () => NOW });
    const outcome = await applyMailboxEnvelope(b, staleEpoch1Bytes, handlersB as MailboxEnvelopeHandlers);
    expect(outcome).toEqual({ kind: 'rejected' });
    expect(getCurrentEpochKey(dbB, cid, b)?.epoch).toBe(2);
    expect(listDmParticipants(dbB, cid).map((p) => p.device_id).sort()).toEqual([a.publicKey, b.publicKey].sort());
    expect(listDmParticipants(dbB, cid, { includeRemoved: true }).find((p) => p.device_id === c.publicKey)?.removed_at)
      .toBeTruthy();
  });
});
