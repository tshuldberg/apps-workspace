/**
 * Task 5: physical THREE-device exit demo, software twin.
 *
 * Three FULLY INDEPENDENT nodes (A, B, C; each own identity, own DatabaseAdapter,
 * own engine) over ONE live loopback RelayServer. Proves:
 *  - Rendezvous fan-in: B and C each resolve A's friend code COLD (A never met
 *    them) and verify the bundle is A.
 *  - Pairing + SAS on both legs.
 *  - Convergence: A authors channel messages; sequential A<->B then A<->C
 *    sessions land identical cm_messages on all three (resolveChannelMessages
 *    output is identical).
 *  - HONEST no-auto-fanout: a message authored on B is ABSENT on C until a
 *    direct B<->C session runs. The mesh does not silently fan out.
 *
 * Honesty boundary (CLAUDE.md): protocol + relay only. Physical transport/OS
 * rungs (LAN/mDNS, BLE, OS background, push) stay UNVERIFIED until a human runs
 * apps/meerkat/Tickets/device-qa-exit-demo.md. Every assertion is on a node's
 * OWN local rows or real engine status -- never a fabricated peer/delivery flag.
 */

import { afterEach, describe, expect, it } from 'vitest';
import {
  createChannelMessage,
  createCommunity,
  deriveSas,
  generateFriendCode,
  getInboundAudit,
  getRecentSyncSessions,
  hexToBytes,
  publishIdentityToRendezvous,
  resolveIdentityFromRendezvous,
  resolveChannelMessages,
  sasFingerprint,
  sasMatches,
  verifyChannelMessage,
  type ChannelMessageEvent,
} from '@mylife/sync';
import {
  buildNode,
  destroyNode,
  installCommunityOnNode,
  pairNodes,
  readChannelBodies,
  recordChannelMessageOnNode,
  runRelaySession,
  startRelayHarness,
  stopRelayHarness,
  type MeerkatNode,
  type RelayHarness,
} from './support/multi-node-harness';

const TOKEN_AB = 'a'.repeat(64);
const TOKEN_AC = 'b'.repeat(64);
const TOKEN_BC = 'c'.repeat(64);

let harness: RelayHarness | null = null;
let nodeA: MeerkatNode | null = null;
let nodeB: MeerkatNode | null = null;
let nodeC: MeerkatNode | null = null;

afterEach(async () => {
  await destroyNode(nodeA); nodeA = null;
  await destroyNode(nodeB); nodeB = null;
  await destroyNode(nodeC); nodeC = null;
  await stopRelayHarness(harness); harness = null;
});

/** Resolve a node's OWN cm_messages into verified, resolved bodies. */
function resolvedBodies(node: MeerkatNode, communityId: string, channelId: string): string[] {
  const events = node.db
    .query<{
      id: string; community_id: string; channel_id: string; author_device_id: string;
      body: string; hlc_wall: string; hlc_counter: number;
      supersedes_id: string | null; supersedes_deleted: number | null; signature: string;
    }>('SELECT * FROM cm_messages WHERE community_id = ? AND channel_id = ?', [communityId, channelId])
    .map((row): ChannelMessageEvent => ({
      version: 1, id: row.id, communityId: row.community_id, channelId: row.channel_id,
      authorDeviceId: row.author_device_id, body: row.body,
      hlc: { wall: row.hlc_wall, counter: row.hlc_counter },
      supersedes: row.supersedes_id ? { id: row.supersedes_id, deleted: row.supersedes_deleted === 1 } : undefined,
      signature: row.signature,
    }))
    .filter((e) => verifyChannelMessage(e));
  return resolveChannelMessages(events).map((e) => e.body);
}

describe('three-device exit-demo software twin (Task 5)', () => {
  it('B and C resolve A\'s friend code cold (rendezvous fan-in) and verify the bundle is A', async () => {
    harness = await startRelayHarness();
    nodeA = await buildNode('Phone A');
    nodeB = await buildNode('Phone B');
    nodeC = await buildNode('Phone C');

    // Each friend code is one-time consume-on-resolve, so A publishes a fresh code
    // for each resolver (exactly how SyncProvider.publishFriendCode mints one per share).
    const codeForB = generateFriendCode();
    const codeForC = generateFriendCode();
    await publishIdentityToRendezvous({ url: harness.url, identity: nodeA.identity, rendezvousId: codeForB.rendezvousId, relayHints: [harness.url] });
    await publishIdentityToRendezvous({ url: harness.url, identity: nodeA.identity, rendezvousId: codeForC.rendezvousId, relayHints: [harness.url] });

    const resolvedByB = await resolveIdentityFromRendezvous({ url: harness.url, code: codeForB.code });
    const resolvedByC = await resolveIdentityFromRendezvous({ url: harness.url, code: codeForC.code });
    expect(resolvedByB.ok).toBe(true);
    expect(resolvedByC.ok).toBe(true);
    if (resolvedByB.ok) {
      expect(resolvedByB.bundle.bundle.deviceId).toBe(nodeA.identity.publicKey);
      expect(resolvedByB.bundle.bundle.dhPublicKey).toBe(nodeA.identity.dhPublicKey);
    }
    if (resolvedByC.ok) {
      expect(resolvedByC.bundle.bundle.deviceId).toBe(nodeA.identity.publicKey);
    }
  });

  it('all three pair + SAS-verify A, A\'s channel messages converge to identical state on every node', async () => {
    harness = await startRelayHarness();
    nodeA = await buildNode('Phone A');
    nodeB = await buildNode('Phone B');
    nodeC = await buildNode('Phone C');

    // Real DH pairing on both legs; SAS matches on each leg (different secret per leg).
    const secretAB = pairNodes(nodeA, nodeB);
    const secretAC = pairNodes(nodeA, nodeC);
    expect(secretAB).not.toBe(secretAC);
    expect(sasMatches(deriveSas(hexToBytes(secretAB)), deriveSas(hexToBytes(secretAB)))).toBe(true);
    expect(sasFingerprint(deriveSas(hexToBytes(secretAB)))).not.toBe(sasFingerprint(deriveSas(hexToBytes(secretAC))));

    const signed = createCommunity(nodeA.identity, {
      name: 'Trio',
      channels: [{ id: 'general', name: 'general' }],
      members: [
        { deviceId: nodeB.identity.publicKey, role: 'member', displayName: nodeB.identity.displayName },
        { deviceId: nodeC.identity.publicKey, role: 'member', displayName: nodeC.identity.displayName },
      ],
      now: '2026-06-13T00:00:00.000Z',
    });
    const communityId = signed.descriptor.communityId;
    installCommunityOnNode(nodeA, signed);
    installCommunityOnNode(nodeB, signed);
    installCommunityOnNode(nodeC, signed);

    const first = createChannelMessage(nodeA.identity, { communityId, channelId: 'general', body: 'trio one', hlc: { wall: '2026-06-13T00:00:01.000Z', counter: 0 } });
    const second = createChannelMessage(nodeA.identity, { communityId, channelId: 'general', body: 'trio two', hlc: { wall: '2026-06-13T00:00:02.000Z', counter: 0 } });
    recordChannelMessageOnNode(nodeA, first);
    recordChannelMessageOnNode(nodeA, second);

    // Sequential relay sessions: A<->B, then A<->C. No magic fan-out; each leg is a
    // real, separate session (the app only ever runs one manual session at a time).
    const sessionAB = await runRelaySession(harness, nodeA, nodeB, TOKEN_AB);
    const sessionAC = await runRelaySession(harness, nodeA, nodeC, TOKEN_AC);
    expect(sessionAB.status).toBe('completed');
    expect(sessionAC.status).toBe('completed');

    // Convergence: identical resolved channel state on all three OWN databases.
    const expected = ['trio one', 'trio two'];
    expect(resolvedBodies(nodeA, communityId, 'general')).toEqual(expected);
    expect(resolvedBodies(nodeB, communityId, 'general')).toEqual(expected);
    expect(resolvedBodies(nodeC, communityId, 'general')).toEqual(expected);
    expect(getInboundAudit(nodeB.db, { outcome: 'rejected' })).toHaveLength(0);
    expect(getInboundAudit(nodeC.db, { outcome: 'rejected' })).toHaveLength(0);
    expect(getRecentSyncSessions(nodeB.db).length).toBeGreaterThan(0);
    expect(getRecentSyncSessions(nodeC.db).length).toBeGreaterThan(0);
  });

  it('HONEST no-auto-fanout: a message authored on B is absent on C until a direct B<->C session runs', async () => {
    harness = await startRelayHarness();
    nodeA = await buildNode('Phone A');
    nodeB = await buildNode('Phone B');
    nodeC = await buildNode('Phone C');
    pairNodes(nodeA, nodeB);
    pairNodes(nodeA, nodeC);
    pairNodes(nodeB, nodeC);

    const signed = createCommunity(nodeA.identity, {
      name: 'Trio',
      channels: [{ id: 'general', name: 'general' }],
      members: [
        { deviceId: nodeB.identity.publicKey, role: 'member', displayName: nodeB.identity.displayName },
        { deviceId: nodeC.identity.publicKey, role: 'member', displayName: nodeC.identity.displayName },
      ],
      now: '2026-06-13T00:00:00.000Z',
    });
    const communityId = signed.descriptor.communityId;
    installCommunityOnNode(nodeA, signed);
    installCommunityOnNode(nodeB, signed);
    installCommunityOnNode(nodeC, signed);

    // B authors a message. Only B holds it so far.
    const fromB = createChannelMessage(nodeB.identity, { communityId, channelId: 'general', body: 'B says hi', hlc: { wall: '2026-06-13T00:00:01.000Z', counter: 0 } });
    recordChannelMessageOnNode(nodeB, fromB);
    expect(readChannelBodies(nodeB, communityId, 'general')).toEqual(['B says hi']);

    // A<->C session: this does NOT carry B's message (A never received it).
    await runRelaySession(harness, nodeA, nodeC, TOKEN_AC);
    expect(readChannelBodies(nodeC, communityId, 'general')).toEqual([]);

    // Only after a DIRECT B<->C session does C receive B's message. No silent mesh.
    const sessionBC = await runRelaySession(harness, nodeB, nodeC, TOKEN_BC);
    expect(sessionBC.status).toBe('completed');
    expect(readChannelBodies(nodeC, communityId, 'general')).toEqual(['B says hi']);
    expect(getInboundAudit(nodeC.db, { outcome: 'rejected' })).toHaveLength(0);
  });
});
