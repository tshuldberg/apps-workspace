// Community feed P1: rolling snapshot import + warm incremental cursor.
//
// Proven by TWO independent web nodes over a REAL relay (the P0 harness), with a
// shared InMemorySeederPieceStore standing in for the always-on host that serves
// opaque sealed pieces. Every assertion is on real cm_messages / cm_feed_cursor
// rows and real return counts; nothing is stubbed.
//
// Acceptance:
//   1. A channel's rolling snapshot import reconstructs the FULL RESOLVED feed
//      (an edit collapsed) on node B, which did NOT author it.
//   2. A WARM pull transfers only events AFTER the per-(community,channel)
//      cursor (the cold-start snapshot covers the rest, the tail covers warm).

import { afterEach, describe, expect, it } from 'vitest';
import {
  createChannelMessage,
  createCommunity,
  createCommunityInvite,
  getCurrentEpochKey,
  joinCommunityFromLink,
  reviseCommunity,
  resolveChannelMessages,
  commitMemberAdd,
  type ChannelMessageEvent,
  type RecordKeyWrapChange,
} from '@mylife/sync';
import { InMemorySeederPieceStore } from '@mylife/meerkat-relay';
import {
  CM_MESSAGES_TABLE,
  buildCommunitySnapshotsForId,
  buildOwnedCommunitySnapshots,
  channelMessageRowFromEvent,
  getFeedCursor,
  getSnapshotRecord,
  importChannelSnapshot,
  insertMessageRow,
  listChannelMessages,
  listChannelMessageEvents,
  putSnapshotRecord,
  storeOwnedCommunity,
} from '../meerkat-data';
import {
  buildWebNode,
  destroyNode,
  harnessToken,
  pairNodes,
  readChannelRows,
  runRelaySession,
  withRelay,
  type WebNode,
} from './support/web-node-harness';

const PHRASE = 'community-feed-p1-shared-phrase-01';
const TOKEN = harnessToken(PHRASE);
const CHANNEL = 'general';

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

/** Author + record a live message on A (so it rides the relay session too). */
function postMessage(
  node: WebNode,
  communityId: string,
  body: string,
  wall: string,
  supersedes?: { id: string; deleted: boolean },
): ChannelMessageEvent {
  const event = createChannelMessage(node.identity, {
    communityId,
    channelId: CHANNEL,
    body,
    hlc: { wall, counter: 0 },
    supersedes,
  });
  insertMessageRow(node.db, event);
  node.engine.recordChange(CM_MESSAGES_TABLE, 'INSERT', event.id, { ...channelMessageRowFromEvent(event) });
  return event;
}

/**
 * Owner A founds a community with B already in the descriptor, mints epoch 1,
 * then hands B a real invite. ONE relay session distributes the epoch key to B
 * (the P0 flow), so B can decrypt snapshots A seals under that key.
 */
function foundCommunityWithB(A: WebNode, B: WebNode): string {
  // Genesis owner-only (current epoch members with DH keys = [A]).
  const signed = createCommunity(A.identity, {
    name: 'Feed Club P1',
    channels: [{ id: CHANNEL, name: CHANNEL }],
    historyScope: 'full',
    now: '2026-06-16T00:00:00.000Z',
  });
  const communityId = signed.descriptor.communityId;
  storeOwnedCommunity(A.db, A.identity, signed, undefined, recorderFor(A));

  // Add B as a new epoch (epoch 2) so B holds a current epoch key after sync.
  commitMemberAdd(A.db, {
    workspaceId: communityId,
    committer: A.identity,
    members: [{ deviceId: A.identity.publicKey, dhPublicKey: A.identity.dhPublicKey }],
    added: { deviceId: B.identity.publicKey, dhPublicKey: B.identity.dhPublicKey },
    role: 'member',
    historyScope: 'full',
    recordChange: recorderFor(A),
    now: '2026-06-16T00:00:01.000Z',
  });

  // Revise the descriptor to include B, then B joins from a real invite link so
  // B's local descriptor carries the same channels (importChannelSnapshot reads
  // the descriptor's channels via buildCommunitySnapshotsForId on the owner).
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
  }, '2026-06-16T00:00:02.000Z');
  const { link } = createCommunityInvite(A.identity, withB);
  const join = joinCommunityFromLink(B.db, B.identity, link);
  expect(join.ok).toBe(true);

  return communityId;
}

describe('community feed P1: rolling snapshot import + warm cursor', () => {
  it('reconstructs the full resolved feed (edit collapsed) on a node that did not author it', async () => {
    await withRelay(async (url) => {
      nodeA = await buildWebNode('Owner A');
      nodeB = await buildWebNode('Member B');
      pairNodes(nodeA, nodeB);

      const communityId = foundCommunityWithB(nodeA, nodeB);

      // A authors e1, an edit of e1 (supersede), and e3 (another message). A's
      // resolved feed is [edited e1, e3]: the edit keeps e1's slot.
      const e1 = postMessage(nodeA, communityId, 'first message', '2026-06-16T00:00:10.000Z');
      const e1edit = postMessage(
        nodeA,
        communityId,
        'first message (edited)',
        '2026-06-16T00:00:11.000Z',
        { id: e1.id, deleted: false },
      );
      const e3 = postMessage(nodeA, communityId, 'third message', '2026-06-16T00:00:12.000Z');

      // Distribute the epoch key (and the live messages) to B over a real relay.
      const session = await runRelaySession(url, TOKEN, nodeA, nodeB);
      expect(session.status).toBe('completed');
      expect(getCurrentEpochKey(nodeB.db, communityId, nodeB.identity)?.epoch).toBe(2);

      // Wipe B's live cm_messages so the ONLY path to a feed is the snapshot.
      // (Proves the snapshot import alone reconstructs the resolved feed.)
      nodeB.db.execute('DELETE FROM cm_messages WHERE community_id = ?', [communityId]);
      expect(readChannelRows(nodeB, communityId, CHANNEL)).toHaveLength(0);

      // A (the owner) builds the rolling snapshot into the shared host store.
      const host = new InMemorySeederPieceStore();
      const built = await buildCommunitySnapshotsForId(nodeA.db, nodeA.identity, communityId, host);
      expect(built.records).toHaveLength(1);
      const ownerRecord = built.records[0];
      expect(ownerRecord.eventCount).toBe(3); // all three raw events are in the snapshot

      // B learns the snapshot metadata (manifest) the way a host/descriptor would
      // surface it, then imports from the SAME host store.
      putSnapshotRecord(nodeB.db, { ...ownerRecord });
      const result = await importChannelSnapshot(nodeB.db, nodeB.identity, communityId, CHANNEL, host);
      expect(result.ok).toBe(true);
      expect(result.inserted).toBe(3);

      // Real proof: B's cm_messages now hold all three raw events, and the
      // RESOLVED feed is [edited first, third] with the edit collapsed.
      expect(readChannelRows(nodeB, communityId, CHANNEL)).toHaveLength(3);
      const resolvedB = listChannelMessages(nodeB.db, communityId, CHANNEL);
      expect(resolvedB.map((e) => e.body)).toEqual(['first message (edited)', 'third message']);

      // It equals exactly what the author A renders (same resolved feed).
      const resolvedA = resolveChannelMessages(
        listChannelMessageEvents(nodeA.db, communityId, CHANNEL),
      );
      expect(resolvedB.map((e) => e.id)).toEqual(resolvedA.map((e) => e.id));
      // The edit keeps e1's SLOT but the visible event in that slot is the edit
      // event (e1edit); e3 follows. The raw e1 is collapsed under e1edit.
      expect(resolvedB.map((e) => e.id)).toEqual([e1edit.id, e3.id]);
      void e1;

      // The cursor advanced to the highest HLC the snapshot carried (e3).
      expect(getFeedCursor(nodeB.db, communityId, CHANNEL)).toEqual(e3.hlc);
    });
  });

  it('warm pull transfers only events after the cursor (tail), not the whole snapshot', async () => {
    await withRelay(async (url) => {
      nodeA = await buildWebNode('Owner A');
      nodeB = await buildWebNode('Member B');
      pairNodes(nodeA, nodeB);

      const communityId = foundCommunityWithB(nodeA, nodeB);

      const e1 = postMessage(nodeA, communityId, 'm1', '2026-06-16T00:01:00.000Z');
      const e2 = postMessage(nodeA, communityId, 'm2', '2026-06-16T00:01:01.000Z');
      const e3 = postMessage(nodeA, communityId, 'm3', '2026-06-16T00:01:02.000Z');

      await runRelaySession(url, TOKEN, nodeA, nodeB);
      expect(getCurrentEpochKey(nodeB.db, communityId, nodeB.identity)?.epoch).toBe(2);

      nodeB.db.execute('DELETE FROM cm_messages WHERE community_id = ?', [communityId]);

      // Cold start: A builds a snapshot covering e1..e3; B imports it whole.
      const host = new InMemorySeederPieceStore();
      const cold = await buildCommunitySnapshotsForId(nodeA.db, nodeA.identity, communityId, host);
      putSnapshotRecord(nodeB.db, { ...cold.records[0] });
      const coldImport = await importChannelSnapshot(nodeB.db, nodeB.identity, communityId, CHANNEL, host);
      expect(coldImport.ok).toBe(true);
      expect(coldImport.newEvents).toBe(3);
      expect(getFeedCursor(nodeB.db, communityId, CHANNEL)).toEqual(e3.hlc);

      // A authors e4 (the tail) and rebuilds the rolling snapshot (now e1..e4).
      const e4 = postMessage(nodeA, communityId, 'm4', '2026-06-16T00:01:03.000Z');
      const warm = await buildOwnedCommunitySnapshots(nodeA.db, nodeA.identity, host);
      const warmRecord = warm.records.find((r) => r.channelId === CHANNEL);
      expect(warmRecord).toBeDefined();
      expect(warmRecord!.eventCount).toBe(4);

      // Compaction: one rolling snapshot per channel. The owner's stored record
      // points at the new content id; the old one is gone.
      const ownerStored = getSnapshotRecord(nodeA.db, communityId, CHANNEL);
      expect(ownerStored?.infoHash).toBe(warmRecord!.infoHash);

      // B learns the new snapshot metadata and does a WARM import. Because B's
      // cursor sits at e3, only e4 crosses, even though the snapshot holds 4.
      putSnapshotRecord(nodeB.db, { ...warmRecord! });
      const warmImport = await importChannelSnapshot(nodeB.db, nodeB.identity, communityId, CHANNEL, host);
      expect(warmImport.ok).toBe(true);
      expect(warmImport.newEvents).toBe(1); // ONLY the tail (e4) transferred
      expect(warmImport.inserted).toBe(1);

      // B now holds all four; the cursor advanced to e4.
      expect(readChannelRows(nodeB, communityId, CHANNEL)).toHaveLength(4);
      const bodies = listChannelMessages(nodeB.db, communityId, CHANNEL).map((e) => e.body);
      expect(bodies).toEqual(['m1', 'm2', 'm3', 'm4']);
      expect(getFeedCursor(nodeB.db, communityId, CHANNEL)).toEqual(e4.hlc);
      void e1;
      void e2;
    });
  });
});
