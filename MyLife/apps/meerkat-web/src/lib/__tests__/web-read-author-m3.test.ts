// Plan 30 Phase 4 (m3): the web mark-read write site must pass the newest visible
// event's authorDeviceId so the (wall, counter, author) tiebreak is LIVE, not inert.
// This exercises the exact sequence MeerkatProvider.markChannelReadLatest runs
// (newestVisibleEventId over the resolved stream -> markChannelReadRow with the
// author), then proves a distinct remote event at the same (wall, counter) still
// counts as unread instead of being silently treated as read.

import { afterEach, describe, expect, it } from 'vitest';
import {
  createChannelMessage,
  generateDeviceIdentity,
  nextHlc,
  type ChannelMessageEvent,
} from '@mylife/sync';
import { buildWebNode, teardownNode, type WebNode } from './support/web-node-harness';
import {
  countUnreadChannelMessages,
  getChannelReadState,
  highestHlc,
  insertMessageRow,
  listChannelMessages,
  markChannelReadRow,
} from '../meerkat-data';
import { newestVisibleEventId } from '../channel-view-core';

let node: WebNode | null = null;
const communityId = 'c1';
const channelId = 'general';

afterEach(async () => {
  await teardownNode(node);
  node = null;
});

let counter = 0;
function stamp(): string {
  return new Date(1_800_000_000_000 + counter++ * 1000).toISOString();
}

function message(n: WebNode, author: Parameters<typeof createChannelMessage>[0], body: string): ChannelMessageEvent {
  const event = createChannelMessage(author, {
    communityId,
    channelId,
    body,
    hlc: nextHlc(highestHlc(n.db, communityId, channelId), stamp()),
  });
  insertMessageRow(n.db, event);
  return event;
}

// Mirror MeerkatProvider.markChannelReadLatest exactly (newest visible + author).
function markLatest(n: WebNode): void {
  const events = listChannelMessages(n.db, communityId, channelId);
  const newestId = newestVisibleEventId(events, () => false);
  const newest = newestId ? events.find((e) => e.id === newestId) : null;
  if (!newest) return;
  markChannelReadRow(n.db, communityId, channelId, newest.hlc, newest.authorDeviceId);
}

describe('web mark-read stores the boundary author (m3)', () => {
  it('markLatest writes last_read_author and clears unread', async () => {
    node = await buildWebNode('Reader');
    const userB = generateDeviceIdentity('User B');
    message(node, userB, 'first');
    const newest = message(node, userB, 'second');

    markLatest(node);
    const row = getChannelReadState(node.db, communityId, channelId);
    expect(row?.last_read_author).toBe(newest.authorDeviceId);
    expect(countUnreadChannelMessages(node.db, communityId, channelId)).toBe(0);
  });

  it('a distinct remote event at the boundary (wall,counter) whose author sorts after stays unread', async () => {
    node = await buildWebNode('Reader2');
    const userB = generateDeviceIdentity('User B');
    const boundaryEvent = message(node, userB, 'boundary');
    markLatest(node);
    expect(countUnreadChannelMessages(node.db, communityId, channelId)).toBe(0);

    // Forge a second event sharing the EXACT (wall, counter) with a device id that
    // sorts AFTER userB's. Without the author tiebreak this would count as read.
    let tiebreakAuthor = generateDeviceIdentity('Tiebreak');
    while (tiebreakAuthor.publicKey <= boundaryEvent.authorDeviceId) {
      tiebreakAuthor = generateDeviceIdentity('Tiebreak');
    }
    const collision = createChannelMessage(tiebreakAuthor, {
      communityId,
      channelId,
      body: 'same-hlc arrival',
      hlc: { wall: boundaryEvent.hlc.wall, counter: boundaryEvent.hlc.counter },
    });
    insertMessageRow(node.db, collision);

    expect(countUnreadChannelMessages(node.db, communityId, channelId)).toBe(1);
  });
});
