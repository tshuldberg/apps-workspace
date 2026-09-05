/**
 * Community feed P6 item 2 acceptance: a restart-safe descriptor store enforces
 * revision monotonicity ACROSS node restarts, so an owner-signed OLDER roster
 * cannot re-grant a removed member after a restart wipes the in-memory guard.
 *
 * Everything is real: real Ed25519 identities, a real signed CommunityDescriptor
 * chain (createCommunity + reviseCommunity), real per-member signed feed auth. The
 * "restart" is modeled by a SECOND CommunityNode constructed over the SAME shared
 * InMemoryCommunityDescriptorStore (the file store has identical semantics; this
 * keeps the test socket-free + deterministic).
 *
 * Acceptance:
 *  1. Node1 accepts revision 2 (the roster that DROPPED the removed member); the
 *     store records highest revision = 2.
 *  2. A SECOND node sharing the SAME store rejects a re-published revision 1 (the
 *     OLD roster that still includes the removed member) with stale_revision --
 *     the restart attack fails closed.
 *  3. After the restart, a CURRENT member still authenticates once the owner
 *     re-publishes the latest (revision 2) descriptor.
 */

import { describe, expect, it } from 'vitest';
import {
  createCommunity,
  reviseCommunity,
  signFeedAuth,
  type DeviceIdentity,
  type SignedCommunityDescriptor,
} from '@mylife/sync';
import { generateDeviceIdentity } from '@mylife/sync';
import {
  CommunityNode,
  InMemoryCommunityDescriptorStore,
  InMemorySeederPieceStore,
} from '../index';

const CHANNEL = 'general';
const NOW = '2026-06-16T00:00:00.000Z';
const NOW_MS = Date.parse(NOW);

interface Fixture {
  owner: DeviceIdentity;
  member: DeviceIdentity;
  removed: DeviceIdentity;
  communityId: string;
  /** Revision 1: owner + member + removed in the roster. */
  rev1: SignedCommunityDescriptor;
  /** Revision 2: removed member dropped (the current roster). */
  rev2: SignedCommunityDescriptor;
}

function buildFixture(): Fixture {
  const owner = generateDeviceIdentity('Owner');
  const member = generateDeviceIdentity('Member');
  const removed = generateDeviceIdentity('Removed');

  const rev1 = createCommunity(owner, {
    name: 'Durable Club',
    channels: [{ id: CHANNEL, name: CHANNEL }],
    members: [
      { deviceId: member.publicKey, role: 'member', displayName: member.displayName, dhPublicKey: member.dhPublicKey },
      { deviceId: removed.publicKey, role: 'member', displayName: removed.displayName, dhPublicKey: removed.dhPublicKey },
    ],
    now: NOW,
  });
  const rev2 = reviseCommunity(owner, rev1, {
    members: rev1.descriptor.members.filter((m) => m.deviceId !== removed.publicKey),
  }, '2026-06-16T00:00:05.000Z');

  return { owner, member, removed, communityId: rev1.descriptor.communityId, rev1, rev2 };
}

/** Owner authenticates + publishes a descriptor (no snapshots). Returns the verdict. */
async function ownerPublish(node: CommunityNode, fx: Fixture, descriptor: SignedCommunityDescriptor): Promise<{ ok: boolean; status?: number; reason?: string }> {
  const challenge = (await node.issueChallenge(fx.communityId))!;
  const auth = {
    deviceId: fx.owner.publicKey,
    nonce: challenge.nonce,
    ts: NOW,
    signature: signFeedAuth(fx.owner, { communityId: fx.communityId, nonce: challenge.nonce, ts: NOW }),
  };
  const verdict = await node.publish(fx.communityId, { descriptor, snapshots: [] }, auth);
  return verdict.ok ? { ok: true } : { ok: false, status: verdict.status, reason: verdict.reason };
}

/** A member authenticates against the node (manifest pull verdict). */
async function memberAuth(node: CommunityNode, fx: Fixture, identity: DeviceIdentity): Promise<{ ok: boolean; reason?: string }> {
  const challenge = (await node.issueChallenge(fx.communityId))!;
  const auth = {
    deviceId: identity.publicKey,
    nonce: challenge.nonce,
    ts: NOW,
    signature: signFeedAuth(identity, { communityId: fx.communityId, nonce: challenge.nonce, ts: NOW }),
  };
  const verdict = await node.verifyRequest(fx.communityId, auth);
  return verdict.ok ? { ok: true } : { ok: false, reason: verdict.reason };
}

describe('community feed P6 item 2: durable descriptor store + restart-safe monotonicity', () => {
  it('a restarted node rejects a re-published older roster (stale_revision) and keeps the current member', async () => {
    const fx = buildFixture();
    const store = new InMemoryCommunityDescriptorStore();

    // Node1: owner publishes rev1 (with removed), then rev2 (removed dropped).
    const node1 = new CommunityNode({ pieceStore: new InMemorySeederPieceStore(), descriptorStore: store, now: () => NOW_MS });
    expect((await ownerPublish(node1, fx, fx.rev1)).ok).toBe(true);
    expect((await ownerPublish(node1, fx, fx.rev2)).ok).toBe(true);

    // The store recorded the highest revision = 2 (durable across the "restart").
    expect(store.getHighestRevision(fx.communityId)).toMatchObject({ revision: 2 });

    // RESTART: a fresh node over the SAME store (no in-memory descriptor at all).
    const node2 = new CommunityNode({ pieceStore: new InMemorySeederPieceStore(), descriptorStore: store, now: () => NOW_MS });

    // The restart attack: the owner re-publishes the OLD revision 1 (which still
    // grants the removed member). The durable store, not in-memory state, catches
    // it: revision 1 <= highest 2 with a different hash -> stale_revision.
    const replay = await ownerPublish(node2, fx, fx.rev1);
    expect(replay.ok).toBe(false);
    expect(replay.reason).toBe('stale_revision');

    // Re-publishing the LATEST (rev2) succeeds (idempotent: same revision+hash).
    expect((await ownerPublish(node2, fx, fx.rev2)).ok).toBe(true);

    // A current member authenticates against the latest roster; the removed member
    // is rejected (not in rev2's roster).
    expect((await memberAuth(node2, fx, fx.member)).ok).toBe(true);
    expect(await memberAuth(node2, fx, fx.removed)).toEqual({ ok: false, reason: 'not_member' });
  });

  it('allows re-publishing the EXACT same revision+hash (idempotent re-announce)', async () => {
    const fx = buildFixture();
    const store = new InMemoryCommunityDescriptorStore();
    const node1 = new CommunityNode({ pieceStore: new InMemorySeederPieceStore(), descriptorStore: store, now: () => NOW_MS });
    expect((await ownerPublish(node1, fx, fx.rev1)).ok).toBe(true);

    // A second node re-announces the SAME rev1 (same revision, same hash): accepted.
    const node2 = new CommunityNode({ pieceStore: new InMemorySeederPieceStore(), descriptorStore: store, now: () => NOW_MS });
    expect((await ownerPublish(node2, fx, fx.rev1)).ok).toBe(true);
  });
});
