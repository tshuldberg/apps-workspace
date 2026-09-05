// Web twin of apps/meerkat/app/__tests__/community-core-reactions.test.ts.
// Proves reaction read-model hygiene (T0.3) and listChannelReactions aggregation
// (T0.4) behave identically on the web data layer.

import { afterEach, describe, expect, it } from 'vitest';
import {
  createChannelMessage,
  createChannelMessageV2,
  generateDeviceIdentity,
  nextHlc,
  type ChannelMessageEvent,
  type DeviceIdentity,
} from '@mylife/sync';
import {
  buildWebNode,
  teardownNode,
  type WebNode,
} from './support/web-node-harness';
import {
  countUnreadChannelMessages,
  createChannelPostEvent,
  createChannelPostReplyEvent,
  highestHlc,
  insertMessageRow,
  insertPostHeaderRow,
  isChannelPostEvent,
  isReactionEvent,
  listChannelMessages,
  listChannelPostCards,
  listChannelPostThread,
  listChannelReactions,
  markChannelReadRow,
} from '../meerkat-data';
import { blockCommunityPerson } from '../community-safety';

let node: WebNode | null = null;
const communityId = 'c1';
const channelId = 'general';

afterEach(async () => {
  await teardownNode(node);
  node = null;
});

let counter = 0;
function stamp() {
  return new Date(1_800_000_000_000 + counter++ * 1000).toISOString();
}

function reaction(
  n: WebNode,
  author: DeviceIdentity,
  target: { eventId: string; postId?: string },
  emoji: string,
  supersedes?: { id: string; deleted: boolean },
): ChannelMessageEvent {
  const event = createChannelMessageV2(author, {
    communityId,
    channelId,
    body: supersedes?.deleted ? '' : emoji,
    hlc: nextHlc(highestHlc(n.db, communityId, channelId), stamp()),
    parentId: target.eventId,
    postId: target.postId,
    intent: 'react',
    authorKind: 'human',
    supersedes,
  });
  insertMessageRow(n.db, event);
  return event;
}

function chatMessage(n: WebNode, body: string): ChannelMessageEvent {
  const event = createChannelMessage(n.identity, {
    communityId,
    channelId,
    body,
    hlc: nextHlc(highestHlc(n.db, communityId, channelId), stamp()),
  });
  insertMessageRow(n.db, event);
  return event;
}

describe('web reaction read-model hygiene (T0.3)', () => {
  it('excludes reacts from bubbles, unread, posts, and thread nodes', async () => {
    node = await buildWebNode('Reactor');
    const userB = generateDeviceIdentity('User B');

    const post = createChannelPostEvent(node.identity, {
      communityId,
      channelId,
      body: 'Discussion post',
      hlc: nextHlc(highestHlc(node.db, communityId, channelId), stamp()),
    });
    insertMessageRow(node.db, post);
    insertPostHeaderRow(node.db, post);

    const reply = createChannelPostReplyEvent(userB, {
      parent: post,
      body: 'A reply',
      hlc: nextHlc(highestHlc(node.db, communityId, channelId), stamp()),
    });
    insertMessageRow(node.db, reply);

    const chat = chatMessage(node, 'hello world');
    markChannelReadRow(node.db, communityId, channelId, highestHlc(node.db, communityId, channelId)!);
    expect(countUnreadChannelMessages(node.db, communityId, channelId)).toBe(0);

    const react = reaction(node, userB, { eventId: chat.id }, '👍');
    reaction(node, node.identity, { eventId: reply.id, postId: post.postId }, '❤️');

    expect(isReactionEvent(react)).toBe(true);
    expect(isChannelPostEvent(react)).toBe(false);

    // No react renders as a bubble, and none bumps the unread badge.
    const bubbles = listChannelMessages(node.db, communityId, channelId).map((e) => e.id);
    expect(bubbles).toContain(chat.id);
    expect(bubbles).not.toContain(react.id);
    expect(countUnreadChannelMessages(node.db, communityId, channelId)).toBe(0);

    // No react touches reply counts or thread nodes.
    const cards = listChannelPostCards(node.db, communityId, channelId);
    expect(cards[0]!.replyCount).toBe(1);
    expect(cards[0]!.lastAuthorDeviceId).toBe(reply.authorDeviceId);

    const thread = listChannelPostThread(node.db, communityId, channelId, post.postId!);
    expect(thread!.replyCount).toBe(1);
    expect(thread!.replies).toHaveLength(1);
    expect(thread!.replies[0]!.event.id).toBe(reply.id);
  });
});

describe('web listChannelReactions aggregation (T0.4)', () => {
  it('aggregates, toggles off via tombstone, and excludes blocked authors', async () => {
    node = await buildWebNode('Aggregator');
    const userB = generateDeviceIdentity('User B');
    const message = chatMessage(node, 'react to me');

    const mine = reaction(node, node.identity, { eventId: message.id }, '❤️');
    reaction(node, userB, { eventId: message.id }, '❤️');

    let groups = listChannelReactions(node.db, communityId, channelId, node.identity.publicKey).get(message.id)!;
    let heart = groups.find((g) => g.emoji === '❤️')!;
    expect(heart.count).toBe(2);
    expect(heart.mine).toBe(true);
    expect(heart.myEventId).toBe(mine.id);

    // Block userB: their reaction drops out, count falls to 1.
    blockCommunityPerson(node.db, communityId, userB.publicKey);
    heart = listChannelReactions(node.db, communityId, channelId, node.identity.publicKey)
      .get(message.id)!.find((g) => g.emoji === '❤️')!;
    expect(heart.count).toBe(1);

    // Un-react my own: the group disappears entirely.
    reaction(node, node.identity, { eventId: message.id }, '❤️', { id: mine.id, deleted: true });
    expect(
      listChannelReactions(node.db, communityId, channelId, node.identity.publicKey).get(message.id),
    ).toBeUndefined();
  });
});

describe('web supersede author-binding (Finding 1) + thread integrity (Finding 2)', () => {
  it('a cross-author forged un-react tombstone does not remove my reaction', async () => {
    node = await buildWebNode('Keeper');
    const userB = generateDeviceIdentity('User B');
    const message = chatMessage(node, 'mine to keep');
    const mine = reaction(node, node.identity, { eventId: message.id }, '❤️');

    // userB forges an un-react tombstone naming my reaction id.
    reaction(node, userB, { eventId: message.id }, '❤️', { id: mine.id, deleted: true });

    const heart = listChannelReactions(node.db, communityId, channelId, node.identity.publicKey)
      .get(message.id)!.find((g) => g.emoji === '❤️')!;
    expect(heart.count).toBe(1);
    expect(heart.myEventId).toBe(mine.id);
  });

  it('a react tombstone superseding a post root leaves the thread and card intact', async () => {
    node = await buildWebNode('Threader');
    const userB = generateDeviceIdentity('User B');
    const post = createChannelPostEvent(node.identity, {
      communityId,
      channelId,
      body: 'Openable post',
      hlc: nextHlc(highestHlc(node.db, communityId, channelId), stamp()),
    });
    insertMessageRow(node.db, post);
    insertPostHeaderRow(node.db, post);

    const hostile = createChannelMessageV2(userB, {
      communityId,
      channelId,
      body: '',
      hlc: nextHlc(highestHlc(node.db, communityId, channelId), stamp()),
      parentId: post.id,
      intent: 'react',
      authorKind: 'human',
      supersedes: { id: post.id, deleted: true },
    });
    insertMessageRow(node.db, hostile);

    const thread = listChannelPostThread(node.db, communityId, channelId, post.postId!);
    expect(thread).not.toBeNull();
    expect(thread!.root.id).toBe(post.id);
    const cards = listChannelPostCards(node.db, communityId, channelId);
    expect(cards.map((c) => c.postId)).toContain(post.postId);
  });
});
