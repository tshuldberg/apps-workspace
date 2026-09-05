import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createInMemoryTestDatabase,
  type DatabaseAdapter,
  type InMemoryTestDatabase,
} from '@mylife/db';
import {
  createChannelMessage,
  createChannelMessageV2,
  createSyncTables,
  generateDeviceIdentity,
  nextHlc,
  type ChannelMessageEvent,
} from '@mylife/sync';
import {
  countUnreadChannelMessages,
  createChannelPostEvent,
  createChannelPostReplyEvent,
  ensureCommunityTables,
  highestHlc,
  insertMessageRow,
  insertPostHeaderRow,
  isChannelPostEvent,
  isReactionEvent,
  listChannelMessages,
  listChannelPostCards,
  listChannelPostThread,
  listChannelReactions,
  markChannelRead,
  mergeChannelMessageEvents,
} from '../(root)/data/community-core';
import { blockCommunityPerson } from '../(root)/data/community-safety';

let db: InMemoryTestDatabase;
const userA = generateDeviceIdentity('User A');
const userB = generateDeviceIdentity('User B');
const communityId = 'c1';
const channelId = 'general';

beforeEach(() => {
  db = createInMemoryTestDatabase();
  ensureCommunityTables(db.adapter);
});

afterEach(() => {
  db.close();
});

let counter = 0;
function stamp() {
  // Deterministic monotonically increasing wall clock for stable ordering.
  return new Date(1_800_000_000_000 + counter++ * 1000).toISOString();
}

function authorReaction(
  author: typeof userA,
  target: { eventId: string; postId?: string },
  emoji: string,
  supersedes?: { id: string; deleted: boolean },
): ChannelMessageEvent {
  const event = createChannelMessageV2(author, {
    communityId,
    channelId,
    body: supersedes?.deleted ? '' : emoji,
    hlc: nextHlc(highestHlc(db.adapter, communityId, channelId), stamp()),
    parentId: target.eventId,
    postId: target.postId,
    intent: 'react',
    authorKind: 'human',
    supersedes,
  });
  insertMessageRow(db.adapter, event);
  return event;
}

function authorChatMessage(body: string): ChannelMessageEvent {
  const event = createChannelMessage(userA, {
    communityId,
    channelId,
    body,
    hlc: nextHlc(highestHlc(db.adapter, communityId, channelId), stamp()),
  });
  insertMessageRow(db.adapter, event);
  return event;
}

function countQueries(adapter: DatabaseAdapter): {
  adapter: DatabaseAdapter;
  read: () => number;
} {
  let queries = 0;
  return {
    adapter: {
      execute: (sql, params) => adapter.execute(sql, params),
      query: <T>(sql: string, params?: unknown[]) => {
        queries += 1;
        return adapter.query<T>(sql, params);
      },
      transaction: (fn) => adapter.transaction(fn),
    },
    read: () => queries,
  };
}

describe('reaction read-model hygiene (T0.3)', () => {
  it('keeps post-card metadata reads constant as the number of posts grows', () => {
    for (let index = 0; index < 80; index += 1) {
      const post = createChannelPostEvent(userA, {
        communityId,
        channelId,
        body: `Post ${index}`,
        hlc: nextHlc(highestHlc(db.adapter, communityId, channelId), stamp()),
      });
      insertMessageRow(db.adapter, post);
      insertPostHeaderRow(db.adapter, post);
    }
    const measured = countQueries(db.adapter);

    expect(listChannelPostCards(measured.adapter, communityId, channelId)).toHaveLength(80);
    expect(measured.read()).toBe(2);
  });

  it('loads reaction safety state once instead of once per event', () => {
    const message = authorChatMessage('react here');
    for (let index = 0; index < 80; index += 1) {
      authorReaction(userB, { eventId: message.id }, '👍');
    }
    const measured = countQueries(db.adapter);

    expect(listChannelReactions(
      measured.adapter,
      communityId,
      channelId,
      userA.publicKey,
    ).get(message.id)).toHaveLength(1);
    expect(measured.read()).toBe(2);
  });

  it('isReactionEvent flags intent=react and isChannelPostEvent excludes reacts', () => {
    const post = createChannelPostEvent(userA, {
      communityId,
      channelId,
      body: 'Post body',
      hlc: nextHlc(highestHlc(db.adapter, communityId, channelId), stamp()),
    });
    insertMessageRow(db.adapter, post);
    insertPostHeaderRow(db.adapter, post);
    const react = authorReaction(userB, { eventId: post.id, postId: post.postId }, '❤️');

    expect(isReactionEvent(react)).toBe(true);
    expect(isReactionEvent(post)).toBe(false);
    // A react carrying postId/parentId must NOT classify as a post event.
    expect(isChannelPostEvent(react)).toBe(false);
    expect(isChannelPostEvent(post)).toBe(true);
  });

  it('a react on a chat message renders no bubble and bumps no unread', () => {
    const message = authorChatMessage('hello world');
    markChannelRead(db.adapter, communityId, channelId, message.hlc, message.authorDeviceId);
    expect(countUnreadChannelMessages(db.adapter, communityId, channelId)).toBe(0);

    authorReaction(userB, { eventId: message.id }, '👍');
    authorReaction(userA, { eventId: message.id }, '❤️');

    const visible = listChannelMessages(db.adapter, communityId, channelId);
    expect(visible.map((event) => event.id)).toEqual([message.id]);
    // Reactions never inflate the unread badge.
    expect(countUnreadChannelMessages(db.adapter, communityId, channelId)).toBe(0);
  });

  it('a react on a thread reply changes no replyCount, card order, or thread node', () => {
    const post = createChannelPostEvent(userA, {
      communityId,
      channelId,
      body: 'Discussion post',
      hlc: nextHlc(highestHlc(db.adapter, communityId, channelId), stamp()),
    });
    insertMessageRow(db.adapter, post);
    insertPostHeaderRow(db.adapter, post);

    const reply = createChannelPostReplyEvent(userB, {
      parent: post,
      body: 'A reply',
      hlc: nextHlc(highestHlc(db.adapter, communityId, channelId), stamp()),
    });
    insertMessageRow(db.adapter, reply);

    const cardsBefore = listChannelPostCards(db.adapter, communityId, channelId);
    const threadBefore = listChannelPostThread(db.adapter, communityId, channelId, post.postId!);

    // Many reactions on the reply must not touch reply counts or thread nodes.
    authorReaction(userA, { eventId: reply.id, postId: post.postId }, '❤️');
    authorReaction(userB, { eventId: reply.id, postId: post.postId }, '🎉');

    const cardsAfter = listChannelPostCards(db.adapter, communityId, channelId);
    const threadAfter = listChannelPostThread(db.adapter, communityId, channelId, post.postId!);

    expect(cardsAfter[0]!.replyCount).toBe(1);
    expect(cardsAfter[0]!.replyCount).toBe(cardsBefore[0]!.replyCount);
    expect(cardsAfter[0]!.lastAuthorDeviceId).toBe(reply.authorDeviceId);
    expect(cardsAfter.map((c) => c.postId)).toEqual(cardsBefore.map((c) => c.postId));

    expect(threadAfter!.replyCount).toBe(1);
    expect(threadAfter!.replies).toHaveLength(1);
    expect(threadAfter!.replies[0]!.event.id).toBe(reply.id);
    expect(threadAfter!.replyCount).toBe(threadBefore!.replyCount);
  });
});

describe('listChannelReactions aggregation (T0.4)', () => {
  it('aggregates distinct authors per emoji with a self-aware mine flag', () => {
    const message = authorChatMessage('react to me');
    const rA = authorReaction(userA, { eventId: message.id }, '❤️');
    authorReaction(userB, { eventId: message.id }, '❤️');
    authorReaction(userB, { eventId: message.id }, '👍');

    const map = listChannelReactions(db.adapter, communityId, channelId, userA.publicKey);
    const groups = map.get(message.id)!;
    expect(groups).toHaveLength(2);

    const heart = groups.find((g) => g.emoji === '❤️')!;
    expect(heart.count).toBe(2);
    expect(heart.mine).toBe(true);
    expect(heart.myEventId).toBe(rA.id);

    const thumbs = groups.find((g) => g.emoji === '👍')!;
    expect(thumbs.count).toBe(1);
    expect(thumbs.mine).toBe(false);
    expect(thumbs.myEventId).toBeNull();
  });

  it('drops a reaction removed by its author own un-react tombstone', () => {
    const message = authorChatMessage('toggle me');
    const react = authorReaction(userA, { eventId: message.id }, '❤️');

    let map = listChannelReactions(db.adapter, communityId, channelId, userA.publicKey);
    expect(map.get(message.id)!.find((g) => g.emoji === '❤️')!.count).toBe(1);

    authorReaction(userA, { eventId: message.id }, '❤️', { id: react.id, deleted: true });

    map = listChannelReactions(db.adapter, communityId, channelId, userA.publicKey);
    expect(map.get(message.id)).toBeUndefined();
  });

  it('excludes a blocked author reaction', () => {
    const message = authorChatMessage('blocked reacts here');
    authorReaction(userA, { eventId: message.id }, '❤️');
    authorReaction(userB, { eventId: message.id }, '❤️');

    blockCommunityPerson(db.adapter, communityId, userB.publicKey);

    const map = listChannelReactions(db.adapter, communityId, channelId, userA.publicKey);
    const heart = map.get(message.id)!.find((g) => g.emoji === '❤️')!;
    expect(heart.count).toBe(1);
    expect(heart.mine).toBe(true);
  });
});

describe('supersede author-binding at the read models (Finding 1)', () => {
  it('a cross-author forged un-react tombstone does not remove my reaction', () => {
    const message = authorChatMessage('mine to keep');
    const mine = authorReaction(userA, { eventId: message.id }, '❤️');

    // userB forges an un-react tombstone naming userA's reaction id.
    authorReaction(userB, { eventId: message.id }, '❤️', { id: mine.id, deleted: true });

    const heart = listChannelReactions(db.adapter, communityId, channelId, userA.publicKey)
      .get(message.id)!.find((g) => g.emoji === '❤️')!;
    expect(heart.count).toBe(1);
    expect(heart.mine).toBe(true);
    expect(heart.myEventId).toBe(mine.id);
  });

  it('a hostile tombstone arriving via the merge path is stored but never takes effect', () => {
    createSyncTables(db.adapter);
    const message = authorChatMessage('censor-resistant');
    const mine = authorReaction(userA, { eventId: message.id }, '❤️');

    // A well-formed but hostile un-react from userB (verifies on its own signature,
    // so the merge path STORES it), naming userA's reaction id.
    const forged = createChannelMessageV2(userB, {
      communityId,
      channelId,
      body: '',
      hlc: nextHlc(highestHlc(db.adapter, communityId, channelId), stamp()),
      parentId: message.id,
      intent: 'react',
      authorKind: 'human',
      supersedes: { id: mine.id, deleted: true },
    });
    const result = mergeChannelMessageEvents(db.adapter, [forged]);
    expect(result).toEqual({ inserted: 1, skipped: 0, invalid: 0, droppedRemoved: 0, insertedEvents: [forged] });

    // Stored, yet resolve-time author-binding refuses it: the reaction survives.
    const heart = listChannelReactions(db.adapter, communityId, channelId, userA.publicKey)
      .get(message.id)!.find((g) => g.emoji === '❤️')!;
    expect(heart.count).toBe(1);
    expect(heart.myEventId).toBe(mine.id);
  });

  it('a cross-author forged message delete does not remove my message', () => {
    const message = authorChatMessage('do not censor me');

    const forgedDelete = createChannelMessage(userB, {
      communityId,
      channelId,
      body: '',
      hlc: nextHlc(highestHlc(db.adapter, communityId, channelId), stamp()),
      supersedes: { id: message.id, deleted: true },
    });
    insertMessageRow(db.adapter, forgedDelete);

    const visible = listChannelMessages(db.adapter, communityId, channelId);
    expect(visible.map((e) => e.id)).toContain(message.id);
  });
});

describe('reaction never perturbs a post thread (Finding 2)', () => {
  it('a react tombstone superseding a post root leaves the thread and card intact', () => {
    const post = createChannelPostEvent(userA, {
      communityId,
      channelId,
      body: 'Openable post',
      hlc: nextHlc(highestHlc(db.adapter, communityId, channelId), stamp()),
    });
    insertMessageRow(db.adapter, post);
    insertPostHeaderRow(db.adapter, post);

    // A hostile react tombstone naming the post ROOT id.
    const hostile = createChannelMessageV2(userB, {
      communityId,
      channelId,
      body: '',
      hlc: nextHlc(highestHlc(db.adapter, communityId, channelId), stamp()),
      parentId: post.id,
      intent: 'react',
      authorKind: 'human',
      supersedes: { id: post.id, deleted: true },
    });
    insertMessageRow(db.adapter, hostile);

    const thread = listChannelPostThread(db.adapter, communityId, channelId, post.postId!);
    expect(thread).not.toBeNull();
    expect(thread!.root.id).toBe(post.id);

    const cards = listChannelPostCards(db.adapter, communityId, channelId);
    expect(cards.map((c) => c.postId)).toContain(post.postId);
  });
});
