// Two proofs:
//  1. Unread counting over cm_read_state (pure, no relay): empty -> count;
//     markRead at the top -> 0; a later arrival -> 1.
//  2. READ-STATE ISOLATION (critical): cm_read_state is personal, per-device UX
//     and must NEVER reach another community member. The web protection is that
//     the provider's markChannelRead writes the cm_read_state ROW ONLY and never
//     calls engine.recordChange, so the read position never enters the sync
//     change log and cannot cross a session. This test exercises exactly that
//     path (row write, no recordChange) and asserts node B receives the channel
//     message but ZERO cm_read_state rows after a real relay session.
//
//     NOTE: the engine's scope filter is NOT relied on here. A generic paired
//     relay session is personal_replica scoped, which would CARRY a recorded
//     read-state row (verified separately: forcing engine.recordChange on
//     cm_read_state does cross). So the "never recordChange read-state" rule in
//     MeerkatProvider.markChannelRead is load-bearing, not decorative.

import { afterEach, describe, expect, it } from 'vitest';
import {
  createChannelMessage,
  createCommunity,
  createCommunityInvite,
  joinCommunityFromLink,
  nextHlc,
} from '@mylife/sync';
import {
  buildWebNode,
  pairNodes,
  readChannelRows,
  runRelaySession,
  teardownNode,
  withRelay,
  type WebNode,
} from './support/web-node-harness';
import {
  CM_READ_STATE_TABLE,
  channelMessageRowFromEvent,
  countUnreadChannelMessages,
  highestHlc,
  insertMessageRow,
  markChannelReadRow,
  storeOwnedCommunity,
} from '../meerkat-data';

let node: WebNode | null = null;
let nodeB: WebNode | null = null;

afterEach(async () => {
  await teardownNode(node);
  await teardownNode(nodeB);
  node = null;
  nodeB = null;
});

function localCommunity(n: WebNode): string {
  const signed = createCommunity(n.identity, {
    name: 'Unread Club',
    channels: [{ id: 'general', name: 'general' }],
    now: '2026-06-15T00:00:00.000Z',
  });
  storeOwnedCommunity(n.db, n.identity, signed);
  return signed.descriptor.communityId;
}

function post(n: WebNode, communityId: string, body: string, wall: string): void {
  const event = createChannelMessage(n.identity, {
    communityId,
    channelId: 'general',
    body,
    hlc: nextHlc(highestHlc(n.db, communityId, 'general'), wall),
  });
  insertMessageRow(n.db, event);
}

describe('unread counting over cm_read_state', () => {
  it('counts all visible until marked read, then counts only later arrivals', async () => {
    node = await buildWebNode('Solo');
    const communityId = localCommunity(node);

    expect(countUnreadChannelMessages(node.db, communityId, 'general')).toBe(0);

    post(node, communityId, 'm1', '2026-06-15T00:00:01.000Z');
    post(node, communityId, 'm2', '2026-06-15T00:00:02.000Z');
    post(node, communityId, 'm3', '2026-06-15T00:00:03.000Z');
    expect(countUnreadChannelMessages(node.db, communityId, 'general')).toBe(3);

    const top = highestHlc(node.db, communityId, 'general')!;
    const result = markChannelReadRow(node.db, communityId, 'general', top);
    expect(result.changed).toBe(true);
    expect(countUnreadChannelMessages(node.db, communityId, 'general')).toBe(0);

    post(node, communityId, 'm4', '2026-06-15T00:00:04.000Z');
    expect(countUnreadChannelMessages(node.db, communityId, 'general')).toBe(1);
  });
});

describe('read-state isolation over a real relay (row-only, never recorded)', () => {
  it('the web mark-read path (no recordChange) never crosses to a community member', async () => {
    await withRelay(async (url) => {
      node = await buildWebNode('Owner');
      nodeB = await buildWebNode('Member');
      pairNodes(node, nodeB);

      const signed = createCommunity(node.identity, {
        name: 'Iso Club',
        channels: [{ id: 'general', name: 'general' }],
        members: [
          { deviceId: nodeB.identity.publicKey, role: 'member', displayName: nodeB.identity.displayName },
        ],
        now: '2026-06-15T00:00:00.000Z',
      });
      const communityId = signed.descriptor.communityId;
      storeOwnedCommunity(node.db, node.identity, signed);
      const { link } = createCommunityInvite(node.identity, signed);
      expect(joinCommunityFromLink(nodeB.db, nodeB.identity, link).ok).toBe(true);

      // A posts a real channel message (this SHOULD cross).
      const msg = createChannelMessage(node.identity, {
        communityId,
        channelId: 'general',
        body: 'hello',
        hlc: { wall: '2026-06-15T00:00:01.000Z', counter: 0 },
      });
      insertMessageRow(node.db, msg);
      node.engine.recordChange('cm_messages', 'INSERT', msg.id, { ...channelMessageRowFromEvent(msg) });

      // A marks the channel read the EXACT way the web provider does: write the
      // cm_read_state row only, never engine.recordChange. So it never enters the
      // change log and cannot cross the session.
      const top = highestHlc(node.db, communityId, 'general')!;
      const read = markChannelReadRow(node.db, communityId, 'general', top);
      expect(read.row).not.toBeNull();
      // Locally, A has its own read-state row.
      expect(node.db.query(`SELECT id FROM ${CM_READ_STATE_TABLE}`)).toHaveLength(1);

      const session = await runRelaySession(url, node, nodeB);
      expect(session.status).toBe('completed');

      // B got the channel message...
      expect(readChannelRows(nodeB, communityId, 'general')).toHaveLength(1);
      // ...but NOT the personal_replica read-state row. The engine scope filter
      // dropped it from the shared_workspace session.
      const bReadState = nodeB.db.query<{ id: string }>(
        `SELECT id FROM ${CM_READ_STATE_TABLE}`,
      );
      expect(bReadState).toHaveLength(0);
    });
  });
});
