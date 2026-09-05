// Community feed P0: key-wrap distribution + historyScope + full back-wrap.
//
// Proven by TWO independent web nodes over a REAL relay, asserting on real
// sync_workspace_keys + cm_messages rows in each node's own sql.js DatabaseAdapter
// (no stubs, no fabricated status). Flow per case:
//   1. owner A founds a community (epoch 1) and posts an epoch-1 message + snapshot,
//   2. A adds member B as a NEW epoch (epoch 2) with the chosen historyScope,
//   3. A posts an epoch-2 message + snapshot,
//   4. A revises the descriptor to include B and B joins from the real invite link,
//   5. ONE real relay session replicates the key wraps (+ live messages) to B,
//   6. assert what B can and cannot decrypt.
// full   -> B opens BOTH the epoch-1 and epoch-2 snapshots (true feed).
// join_point -> B opens only the epoch-2 snapshot; epoch 1 stays unreadable.
// removal -> a removed device receives no wrap for the new epoch (forward secret).

import { afterEach, describe, expect, it } from 'vitest';
import {
  buildChannelHistory,
  commitMemberAdd,
  commitMemberRemoval,
  createChannelMessage,
  createCommunity,
  createCommunityInvite,
  getCurrentEpochKey,
  joinCommunityFromLink,
  parseChannelHistory,
  reviseCommunity,
  unwrapEpochSecret,
  type RecordKeyWrapChange,
  type SignedCommunityDescriptor,
} from '@mylife/sync';
import {
  CM_MESSAGES_TABLE,
  channelMessageRowFromEvent,
  insertMessageRow,
  storeOwnedCommunity,
} from '../meerkat-data';
import {
  buildWebNode,
  destroyNode,
  harnessToken,
  pairNodes,
  readChannelRows,
  readKeyWrapRows,
  runRelaySession,
  withRelay,
  type WebNode,
} from './support/web-node-harness';

const PHRASE = 'community-feed-p0-shared-phrase-01';
const TOKEN = harnessToken(PHRASE);

let nodeA: WebNode | null = null;
let nodeB: WebNode | null = null;

afterEach(async () => {
  await destroyNode(nodeA);
  await destroyNode(nodeB);
  nodeA = null;
  nodeB = null;
});

const recorderFor = (node: WebNode): RecordKeyWrapChange =>
  (table, op, rowId, data) => node.engine.recordChange(table, op, rowId, data);

function postMessage(node: WebNode, communityId: string, body: string, wall: string) {
  const event = createChannelMessage(node.identity, {
    communityId,
    channelId: 'general',
    body,
    hlc: { wall, counter: 0 },
  });
  insertMessageRow(node.db, event);
  node.engine.recordChange(CM_MESSAGES_TABLE, 'INSERT', event.id, { ...channelMessageRowFromEvent(event) });
  return event;
}

function snapshotFor(
  node: WebNode,
  communityId: string,
  epoch: number,
  secret: Uint8Array,
  events: ReturnType<typeof createChannelMessage>[],
) {
  return buildChannelHistory({
    communityId,
    channelId: 'general',
    workspaceId: communityId,
    epoch,
    events,
    groupKey: secret,
    signer: node.identity,
  });
}

interface FeedFixture {
  communityId: string;
  signed: SignedCommunityDescriptor;
  snap1: ReturnType<typeof buildChannelHistory>;
  snap2: ReturnType<typeof buildChannelHistory>;
}

/**
 * Owner A founds a community, posts an epoch-1 message + snapshot, adds B as a
 * new epoch with `historyScope`, posts an epoch-2 message + snapshot, then
 * revises the descriptor to include B and hands B a real invite link.
 */
function buildOwnerFeed(A: WebNode, B: WebNode, historyScope: 'full' | 'join_point'): FeedFixture {
  const signed = createCommunity(A.identity, {
    name: 'Feed Club',
    channels: [{ id: 'general', name: 'general' }],
    historyScope,
    now: '2026-06-16T00:00:00.000Z',
  });
  const communityId = signed.descriptor.communityId;
  storeOwnedCommunity(A.db, A.identity, signed, undefined, recorderFor(A));

  const epoch1 = getCurrentEpochKey(A.db, communityId, A.identity);
  if (!epoch1) throw new Error('owner has no epoch-1 key after create');
  const m1 = postMessage(A, communityId, 'epoch-1 message', '2026-06-16T00:00:01.000Z');
  const snap1 = snapshotFor(A, communityId, epoch1.epoch, epoch1.secret, [m1]);

  // Add B as a NEW epoch (epoch 2). Current epoch members with DH keys = [A].
  commitMemberAdd(A.db, {
    workspaceId: communityId,
    committer: A.identity,
    members: [{ deviceId: A.identity.publicKey, dhPublicKey: A.identity.dhPublicKey }],
    added: { deviceId: B.identity.publicKey, dhPublicKey: B.identity.dhPublicKey },
    role: 'member',
    historyScope,
    recordChange: recorderFor(A),
    now: '2026-06-16T00:00:02.000Z',
  });

  const epoch2 = getCurrentEpochKey(A.db, communityId, A.identity);
  if (!epoch2) throw new Error('owner has no epoch-2 key after member add');
  expect(epoch2.epoch).toBe(2);
  const m2 = postMessage(A, communityId, 'epoch-2 message', '2026-06-16T00:00:03.000Z');
  const snap2 = snapshotFor(A, communityId, epoch2.epoch, epoch2.secret, [m2]);

  // Revise the descriptor to include B (so B's join bridges B's workspace) and
  // issue B a real invite bound to that revision.
  const withB = reviseCommunity(A.identity, signed, {
    members: [
      ...signed.descriptor.members,
      {
        deviceId: B.identity.publicKey,
        role: 'member',
        displayName: B.identity.displayName,
        dhPublicKey: B.identity.dhPublicKey,
      },
    ],
  }, '2026-06-16T00:00:04.000Z');
  const { link } = createCommunityInvite(A.identity, withB);
  const join = joinCommunityFromLink(B.db, B.identity, link);
  expect(join.ok).toBe(true);

  return { communityId, signed, snap1, snap2 };
}

function openSnapshot(
  communityId: string,
  epoch: number,
  secret: Uint8Array,
  snap: ReturnType<typeof buildChannelHistory>,
) {
  return parseChannelHistory({
    communityId,
    channelId: 'general',
    workspaceId: communityId,
    epoch,
    manifest: snap.catalog.manifest,
    pieces: snap.pieces,
    groupKey: secret,
  });
}

describe('community feed P0: epoch key distribution over a real relay', () => {
  it('full history: a new member decrypts ALL snapshots after one sync', async () => {
    await withRelay(async (url) => {
      nodeA = await buildWebNode('Owner A');
      nodeB = await buildWebNode('Member B');
      pairNodes(nodeA, nodeB);

      const { communityId, snap1, snap2 } = buildOwnerFeed(nodeA, nodeB, 'full');

      // Before the session B holds no epoch key for this community.
      expect(getCurrentEpochKey(nodeB.db, communityId, nodeB.identity)).toBeNull();

      const session = await runRelaySession(url, TOKEN, nodeA, nodeB);
      expect(session.status).toBe('completed');

      // B now holds the CURRENT epoch (2) and, under full, the prior epoch (1).
      const bCurrent = getCurrentEpochKey(nodeB.db, communityId, nodeB.identity);
      expect(bCurrent?.epoch).toBe(2);
      const bEpoch1 = unwrapEpochSecret(nodeB.db, communityId, 1, nodeB.identity);
      expect(bEpoch1).not.toBeNull();

      // Real proof: B opens BOTH snapshots with its OWN unwrapped epoch secrets.
      const opened1 = openSnapshot(communityId, 1, bEpoch1!, snap1);
      const opened2 = openSnapshot(communityId, 2, bCurrent!.secret, snap2);
      expect(opened1.ok).toBe(true);
      expect(opened2.ok).toBe(true);
      if (opened1.ok) expect(opened1.events.map((e) => e.body)).toContain('epoch-1 message');
      if (opened2.ok) expect(opened2.events.map((e) => e.body)).toContain('epoch-2 message');

      // Real key-wrap rows: B holds a wrap for itself at BOTH epochs.
      expect(readKeyWrapRows(nodeB, communityId, 1).map((r) => r.wrapped_for_device_id))
        .toContain(nodeB.identity.publicKey);
      expect(readKeyWrapRows(nodeB, communityId, 2).map((r) => r.wrapped_for_device_id))
        .toContain(nodeB.identity.publicKey);

      // The live feed rode the same session: B has both real signed messages.
      expect(readChannelRows(nodeB, communityId, 'general')).toHaveLength(2);
    });
  });

  it('join_point: a new member decrypts only from-join, never prior epochs', async () => {
    await withRelay(async (url) => {
      nodeA = await buildWebNode('Owner A');
      nodeB = await buildWebNode('Member B');
      pairNodes(nodeA, nodeB);

      const { communityId, snap1, snap2 } = buildOwnerFeed(nodeA, nodeB, 'join_point');

      const session = await runRelaySession(url, TOKEN, nodeA, nodeB);
      expect(session.status).toBe('completed');

      const bCurrent = getCurrentEpochKey(nodeB.db, communityId, nodeB.identity);
      expect(bCurrent?.epoch).toBe(2);

      // No back-wrap: B has NO epoch-1 key and cannot open the epoch-1 snapshot.
      expect(unwrapEpochSecret(nodeB.db, communityId, 1, nodeB.identity)).toBeNull();
      expect(readKeyWrapRows(nodeB, communityId, 1).map((r) => r.wrapped_for_device_id))
        .not.toContain(nodeB.identity.publicKey);

      // But the current epoch opens.
      const opened2 = openSnapshot(communityId, 2, bCurrent!.secret, snap2);
      expect(opened2.ok).toBe(true);
      if (opened2.ok) expect(opened2.events.map((e) => e.body)).toContain('epoch-2 message');
      // Sanity: snap1 stays sealed to B (it never derived the epoch-1 key).
      void snap1;
    });
  });

  it('removal stays forward-secret: the removed device gets no new-epoch wrap', async () => {
    await withRelay(async (url) => {
      nodeA = await buildWebNode('Owner A');
      nodeB = await buildWebNode('Member B');
      pairNodes(nodeA, nodeB);

      const { communityId } = buildOwnerFeed(nodeA, nodeB, 'full');
      await runRelaySession(url, TOKEN, nodeA, nodeB);

      // B can read epoch 2 at this point.
      expect(getCurrentEpochKey(nodeB.db, communityId, nodeB.identity)?.epoch).toBe(2);

      // A removes B -> epoch 3 wrapped for A only.
      commitMemberRemoval(nodeA.db, {
        workspaceId: communityId,
        committer: nodeA.identity,
        members: [
          { deviceId: nodeA.identity.publicKey, dhPublicKey: nodeA.identity.dhPublicKey },
          { deviceId: nodeB.identity.publicKey, dhPublicKey: nodeB.identity.dhPublicKey },
        ],
        removedDeviceId: nodeB.identity.publicKey,
        recordChange: recorderFor(nodeA),
        now: '2026-06-16T00:01:00.000Z',
      });

      await runRelaySession(url, TOKEN, nodeA, nodeB);

      // B holds NO epoch-3 wrap for itself -> cannot read the new epoch.
      expect(readKeyWrapRows(nodeB, communityId, 3).map((r) => r.wrapped_for_device_id))
        .not.toContain(nodeB.identity.publicKey);
      expect(unwrapEpochSecret(nodeB.db, communityId, 3, nodeB.identity)).toBeNull();
      // Prior access is unchanged: B can still open epoch 2 it legitimately held.
      expect(unwrapEpochSecret(nodeB.db, communityId, 2, nodeB.identity)).not.toBeNull();
    });
  });
});
