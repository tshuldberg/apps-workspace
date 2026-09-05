// Integration proof: two independent WEB nodes (real browser storage adapters +
// real NativeSyncEngine) carry a real signed channel message over a REAL
// @mylife/meerkat-relay server. The regression anchor for the browser storage
// layer end to end. Now built on the shared harness (support/web-node-harness.ts).

import { afterEach, describe, expect, it } from 'vitest';
import {
  createChannelMessage,
  createCommunity,
  createCommunityInvite,
  joinCommunityFromLink,
  resolveChannelMessages,
  verifyChannelMessage,
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

describe('web node <-> web node over a real relay (browser adapters end to end)', () => {
  it('a channel message authored on web node A lands in web node B after a relay session', async () => {
    await withRelay(async (url) => {
      nodeA = await buildWebNode('Web Owner');
      nodeB = await buildWebNode('Web Member');
      pairNodes(nodeA, nodeB);

      const signed = createCommunity(nodeA.identity, {
        name: 'Web Club',
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

      const event = createChannelMessage(nodeA.identity, {
        communityId,
        channelId: 'general',
        body: 'hello from web A',
        hlc: { wall: '2026-06-15T00:00:01.000Z', counter: 0 },
      });
      insertMessageRow(nodeA.db, event);
      nodeA.engine.recordChange('cm_messages', 'INSERT', event.id, {
        ...channelMessageRowFromEvent(event),
      });

      expect(readChannelRows(nodeB, communityId, 'general')).toHaveLength(0);

      const session = await runRelaySession(url, nodeA, nodeB);
      expect(session.status).toBe('completed');

      const bRows = readChannelRows(nodeB, communityId, 'general');
      expect(bRows).toHaveLength(1);
      const bEvents = bRows.map(channelMessageEventFromRow);
      expect(bEvents.every((e) => verifyChannelMessage(e))).toBe(true);
      expect(resolveChannelMessages(bEvents).map((e) => e.body)).toEqual(['hello from web A']);

      expect(nodeA.engine.getStatus().lastSyncAt).not.toBeNull();
      expect(nodeB.engine.getStatus().lastSyncAt).not.toBeNull();
    });
  });
});
