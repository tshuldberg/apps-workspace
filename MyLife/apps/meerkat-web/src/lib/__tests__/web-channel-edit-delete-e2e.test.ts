// Proof: an EDIT (supersede) and a DELETE (tombstone) authored on web node A
// propagate to web node B over a real relay, and resolveChannelMessages on B
// reflects them exactly. Edits keep the slot with the new body; deletes remove
// the slot. The tombstone row is still a verifiable signed event on B.

import { afterEach, describe, expect, it } from 'vitest';
import {
  createChannelMessage,
  createCommunity,
  createCommunityInvite,
  joinCommunityFromLink,
  nextHlc,
  resolveChannelMessages,
  verifyChannelMessage,
  type ChannelMessageEvent,
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
  channelMessageEventFromRow,
  channelMessageRowFromEvent,
  highestHlc,
  insertMessageRow,
  storeOwnedCommunity,
} from '../meerkat-data';

let nodeA: WebNode | null = null;
let nodeB: WebNode | null = null;

afterEach(async () => {
  await teardownNode(nodeA);
  await teardownNode(nodeB);
  nodeA = null;
  nodeB = null;
});

/** Author an event on A, persist + record it, exactly as the provider does. */
function authorOnA(a: WebNode, partial: Parameters<typeof createChannelMessage>[1]): ChannelMessageEvent {
  const event = createChannelMessage(a.identity, partial);
  insertMessageRow(a.db, event);
  a.engine.recordChange('cm_messages', 'INSERT', event.id, { ...channelMessageRowFromEvent(event) });
  return event;
}

function resolvedBodiesOnB(b: WebNode, communityId: string): { id: string; body: string }[] {
  const events = readChannelRows(b, communityId, 'general').map(channelMessageEventFromRow);
  expect(events.every((e) => verifyChannelMessage(e))).toBe(true);
  return resolveChannelMessages(events).map((e) => ({ id: e.id, body: e.body }));
}

describe('edit + delete propagate over a real relay', () => {
  it('an edit keeps the slot with the new body; a delete removes the slot, on node B', async () => {
    await withRelay(async (url) => {
      nodeA = await buildWebNode('Owner');
      nodeB = await buildWebNode('Member');
      pairNodes(nodeA, nodeB);

      const signed = createCommunity(nodeA.identity, {
        name: 'Edit Club',
        channels: [{ id: 'general', name: 'general' }],
        members: [
          { deviceId: nodeB.identity.publicKey, role: 'member', displayName: nodeB.identity.displayName },
        ],
        now: '2026-06-15T00:00:00.000Z',
      });
      const communityId = signed.descriptor.communityId;
      storeOwnedCommunity(nodeA.db, nodeA.identity, signed);
      const { link } = createCommunityInvite(nodeA.identity, signed);
      expect(joinCommunityFromLink(nodeB.db, nodeB.identity, link).ok).toBe(true);

      // Two original messages.
      const first = authorOnA(nodeA, {
        communityId,
        channelId: 'general',
        body: 'first message',
        hlc: { wall: '2026-06-15T00:00:01.000Z', counter: 0 },
      });
      const second = authorOnA(nodeA, {
        communityId,
        channelId: 'general',
        body: 'second message',
        hlc: nextHlc(highestHlc(nodeA.db, communityId, 'general'), '2026-06-15T00:00:02.000Z'),
      });

      // Edit the first; delete the second (supersede + tombstone).
      authorOnA(nodeA, {
        communityId,
        channelId: 'general',
        body: 'first message (edited)',
        hlc: nextHlc(highestHlc(nodeA.db, communityId, 'general'), '2026-06-15T00:00:03.000Z'),
        supersedes: { id: first.id, deleted: false },
      });
      authorOnA(nodeA, {
        communityId,
        channelId: 'general',
        body: '',
        hlc: nextHlc(highestHlc(nodeA.db, communityId, 'general'), '2026-06-15T00:00:04.000Z'),
        supersedes: { id: second.id, deleted: true },
      });

      const session = await runRelaySession(url, nodeA, nodeB);
      expect(session.status).toBe('completed');

      // B resolves to ONE visible message: the edited first; the second is gone.
      // resolveChannelMessages returns the superseding (edit) event, which has
      // its own id and the new body, occupying the original's slot.
      const resolved = resolvedBodiesOnB(nodeB, communityId);
      expect(resolved).toHaveLength(1);
      expect(resolved[0].body).toBe('first message (edited)');
      // The deleted message's body is gone from the visible set entirely.
      expect(resolved.map((r) => r.body)).not.toContain('second message');

      // The raw tombstone + edit events DID cross (4 rows on B), all verifiable.
      expect(readChannelRows(nodeB, communityId, 'general')).toHaveLength(4);
    });
  });
});
