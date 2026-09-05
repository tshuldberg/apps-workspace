import { afterEach, describe, expect, it } from 'vitest';
import { createInMemoryTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import {
  createChannelMessage,
  createChannelMessageV2,
  generateDeviceIdentity,
  nextHlc,
  verifyChannelMessage,
} from '@mylife/sync';
import {
  buildEditedChannelMessage,
  buildOutgoingChannelMessage,
  buildReactionEvent,
  buildUnreactionEvent,
  sendOptsNeedV2,
} from '../(root)/data/chat-compose';
import {
  ensureCommunityTables,
  getChannelMessageEventById,
  highestHlc,
  insertMessageRow,
  listActiveOwnReactionEventIds,
  listChannelMessages,
  listChannelReactions,
} from '../(root)/data/community-core';

const identity = generateDeviceIdentity('Composer');
const hlc = { wall: '2026-07-03T00:00:00.000Z', counter: 0 };
const base = { communityId: 'c1', channelId: 'general', body: 'hello', attachments: [], hlc };

describe('sendOptsNeedV2 (T0.5)', () => {
  it('is false when no v2 field is present', () => {
    expect(sendOptsNeedV2(undefined)).toBe(false);
    expect(sendOptsNeedV2({})).toBe(false);
    expect(sendOptsNeedV2({ mentions: [] })).toBe(false);
  });

  it('is true when any v2 field is present', () => {
    expect(sendOptsNeedV2({ mentions: ['device-x'] })).toBe(true);
    expect(sendOptsNeedV2({ parentId: 'p1' })).toBe(true);
    expect(sendOptsNeedV2({ postId: 'post-1' })).toBe(true);
    expect(sendOptsNeedV2({ branchId: 'b1' })).toBe(true);
  });
});

describe('buildOutgoingChannelMessage (T0.5)', () => {
  it('is byte-identical to the v1 builder when no v2 opts are supplied', () => {
    const viaBuilder = buildOutgoingChannelMessage(identity, base);
    const viaV1 = createChannelMessage(identity, {
      communityId: 'c1',
      channelId: 'general',
      body: 'hello',
      attachments: undefined,
      hlc,
    });
    expect(viaBuilder).toEqual(viaV1);
    expect(viaBuilder.version).toBe(1);
    expect(verifyChannelMessage(viaBuilder)).toBe(true);
  });

  it('builds a signed v2 message carrying mentions and threading fields', () => {
    const event = buildOutgoingChannelMessage(identity, {
      ...base,
      opts: { mentions: ['device-x'], parentId: 'p1', postId: 'post-1', branchId: 'b1' },
    });
    expect(event.version).toBe(2);
    expect(event.intent).toBe('message');
    expect(event.mentions).toEqual(['device-x']);
    expect(event.parentId).toBe('p1');
    expect(event.postId).toBe('post-1');
    expect(event.branchId).toBe('b1');
    expect(verifyChannelMessage(event)).toBe(true);
  });

  it('omits an empty mentions array from the signed v2 event', () => {
    const event = buildOutgoingChannelMessage(identity, {
      ...base,
      opts: { parentId: 'p1', mentions: [] },
    });
    expect(event.version).toBe(2);
    expect(event.mentions).toBeUndefined();
    expect(verifyChannelMessage(event)).toBe(true);
  });
});

describe('buildEditedChannelMessage (MAJOR-1: edit preserves v2 fields)', () => {
  const nextEditHlc = { wall: '2026-07-03T00:05:00.000Z', counter: 5 };

  it('keeps parentId, mentions, branchId, and intent when editing a v2 reply', () => {
    const reply = createChannelMessageV2(identity, {
      communityId: 'c1',
      channelId: 'general',
      body: 'original reply',
      hlc,
      parentId: 'target-1',
      branchId: 'branch-1',
      authorKind: 'human',
      mentions: ['device-x'],
      intent: 'message',
    });
    const edited = buildEditedChannelMessage(identity, { event: reply, body: 'edited reply', hlc: nextEditHlc });
    expect(edited.version).toBe(2);
    expect(edited.body).toBe('edited reply');
    expect(edited.parentId).toBe('target-1');
    expect(edited.branchId).toBe('branch-1');
    expect(edited.mentions).toEqual(['device-x']);
    expect(edited.intent).toBe('message');
    expect(edited.supersedes).toEqual({ id: reply.id, deleted: false });
    expect(verifyChannelMessage(edited)).toBe(true);
  });

  it('keeps the postId when editing a v2 post reply', () => {
    const postReply = createChannelMessageV2(identity, {
      communityId: 'c1',
      channelId: 'general',
      body: 'post reply',
      hlc,
      postId: 'post-1',
      parentId: 'post-1',
      authorKind: 'human',
      intent: 'message',
    });
    const edited = buildEditedChannelMessage(identity, { event: postReply, body: 'edited', hlc: nextEditHlc });
    expect(edited.version).toBe(2);
    expect(edited.postId).toBe('post-1');
    expect(edited.parentId).toBe('post-1');
    expect(verifyChannelMessage(edited)).toBe(true);
  });

  it('stays a byte-clean v1 edit for a v1 message', () => {
    const v1 = createChannelMessage(identity, { communityId: 'c1', channelId: 'general', body: 'plain', hlc });
    const edited = buildEditedChannelMessage(identity, { event: v1, body: 'plain edited', hlc: nextEditHlc });
    expect(edited.version).toBe(1);
    expect(edited.parentId).toBeUndefined();
    expect(edited.supersedes).toEqual({ id: v1.id, deleted: false });
    expect(verifyChannelMessage(edited)).toBe(true);
  });
});

describe('deleting a v2 reply resolves (deleteMessage tombstone confirm)', () => {
  let db: InMemoryTestDatabase;
  const communityId = 'c1';
  const channelId = 'general';

  afterEach(() => db?.close());

  it('a v1 tombstone of a v2 reply removes it from the resolved stream', () => {
    db = createInMemoryTestDatabase();
    ensureCommunityTables(db.adapter);

    const reply = createChannelMessageV2(identity, {
      communityId,
      channelId,
      body: 'reply to delete',
      hlc: nextHlc(highestHlc(db.adapter, communityId, channelId), '2026-07-03T00:00:00.000Z'),
      parentId: 'root-evt',
      authorKind: 'human',
      intent: 'message',
    });
    insertMessageRow(db.adapter, reply);
    expect(listChannelMessages(db.adapter, communityId, channelId).some((e) => e.id === reply.id)).toBe(true);

    // deleteMessage's branch for a reply (no postId -> isChannelPostEvent false -> v1 tombstone).
    const tombstone = createChannelMessage(identity, {
      communityId,
      channelId,
      body: '',
      hlc: nextHlc(highestHlc(db.adapter, communityId, channelId), '2026-07-03T00:00:01.000Z'),
      supersedes: { id: reply.id, deleted: true },
    });
    insertMessageRow(db.adapter, tombstone);

    expect(listChannelMessages(db.adapter, communityId, channelId).some((e) => e.id === reply.id)).toBe(false);
  });
});

describe('buildReactionEvent / buildUnreactionEvent (T0.6)', () => {
  it('builds a verifiable react targeting a message', () => {
    const event = buildReactionEvent(identity, {
      communityId: 'c1',
      channelId: 'general',
      targetEventId: 'target-1',
      emoji: '❤️',
      hlc,
    });
    expect(event.intent).toBe('react');
    expect(event.parentId).toBe('target-1');
    expect(event.body).toBe('❤️');
    expect(verifyChannelMessage(event)).toBe(true);
  });

  it('carries the target postId when reacting inside a post thread', () => {
    const event = buildReactionEvent(identity, {
      communityId: 'c1',
      channelId: 'general',
      targetEventId: 'reply-1',
      targetPostId: 'post-1',
      emoji: '👍',
      hlc,
    });
    expect(event.postId).toBe('post-1');
    expect(verifyChannelMessage(event)).toBe(true);
  });

  it('throws on a non-single-emoji reaction body (pre-flight fail-closed)', () => {
    expect(() => buildReactionEvent(identity, {
      communityId: 'c1',
      channelId: 'general',
      targetEventId: 'target-1',
      emoji: 'lol',
      hlc,
    })).toThrow();
  });

  it('builds a verifiable un-react tombstone of a prior reaction', () => {
    const event = buildUnreactionEvent(identity, {
      communityId: 'c1',
      channelId: 'general',
      parentId: 'target-1',
      reactionEventId: 'my-react-1',
      hlc,
    });
    expect(event.intent).toBe('react');
    expect(event.supersedes).toEqual({ id: 'my-react-1', deleted: true });
    expect(event.body).toBe('');
    expect(verifyChannelMessage(event)).toBe(true);
  });
});

describe('reaction provider flow (T0.6, build -> record -> aggregate)', () => {
  let db: InMemoryTestDatabase;
  const communityId = 'c1';
  const channelId = 'general';

  afterEach(() => db?.close());

  it('records a reaction that aggregates, then an un-react that removes it', () => {
    db = createInMemoryTestDatabase();
    ensureCommunityTables(db.adapter);

    const message = createChannelMessage(identity, {
      communityId,
      channelId,
      body: 'react to me',
      hlc: nextHlc(highestHlc(db.adapter, communityId, channelId), '2026-07-03T00:00:00.000Z'),
    });
    insertMessageRow(db.adapter, message);

    // Provider's sendReaction path: build via chat-compose, then record the row.
    const react = buildReactionEvent(identity, {
      communityId,
      channelId,
      targetEventId: message.id,
      emoji: '❤️',
      hlc: nextHlc(highestHlc(db.adapter, communityId, channelId), '2026-07-03T00:00:01.000Z'),
    });
    insertMessageRow(db.adapter, react);

    let map = listChannelReactions(db.adapter, communityId, channelId, identity.publicKey);
    const heart = map.get(message.id)!.find((g) => g.emoji === '❤️')!;
    expect(heart.count).toBe(1);
    expect(heart.mine).toBe(true);
    expect(heart.myEventId).toBe(react.id);

    // Provider's removeReaction path: build the un-react tombstone, then record it.
    const unreact = buildUnreactionEvent(identity, {
      communityId,
      channelId,
      parentId: message.id,
      reactionEventId: react.id,
      hlc: nextHlc(highestHlc(db.adapter, communityId, channelId), '2026-07-03T00:00:02.000Z'),
    });
    insertMessageRow(db.adapter, unreact);

    map = listChannelReactions(db.adapter, communityId, channelId, identity.publicKey);
    expect(map.get(message.id)).toBeUndefined();
  });
});

describe('double-tap dedupe (Finding 3, provider flow replicated)', () => {
  let db: InMemoryTestDatabase;
  const communityId = 'c1';
  const channelId = 'general';
  let ticks = 0;
  const tick = () => new Date(1_800_000_000_000 + ticks++ * 1000).toISOString();

  afterEach(() => db?.close());

  // Mirror ChatProvider.sendReaction: idempotent — no duplicate when one is active.
  function providerSendReaction(target: { eventId: string; postId?: string }, emoji: string) {
    const existing = listActiveOwnReactionEventIds(
      db.adapter, communityId, channelId, identity.publicKey, target.eventId, emoji,
    );
    if (existing.length > 0) return getChannelMessageEventById(db.adapter, existing[0]!);
    const event = buildReactionEvent(identity, {
      communityId, channelId, targetEventId: target.eventId, targetPostId: target.postId, emoji,
      hlc: nextHlc(highestHlc(db.adapter, communityId, channelId), tick()),
    });
    insertMessageRow(db.adapter, event);
    return event;
  }

  // Mirror ChatProvider.removeReaction: tombstone EVERY active own react for the pair.
  function providerRemoveReaction(myEventId: string) {
    const original = getChannelMessageEventById(db.adapter, myEventId)!;
    const targets = listActiveOwnReactionEventIds(
      db.adapter, communityId, channelId, identity.publicKey, original.parentId!, original.body,
    );
    for (const id of targets) {
      const t = buildUnreactionEvent(identity, {
        communityId, channelId, parentId: original.parentId!, postId: original.postId,
        reactionEventId: id, hlc: nextHlc(highestHlc(db.adapter, communityId, channelId), tick()),
      });
      insertMessageRow(db.adapter, t);
    }
  }

  function activeCount(parentId: string, emoji: string) {
    return listActiveOwnReactionEventIds(db.adapter, communityId, channelId, identity.publicKey, parentId, emoji).length;
  }

  it('double-tap sends once (dedupe), then a single un-tap leaves zero active', () => {
    db = createInMemoryTestDatabase();
    ensureCommunityTables(db.adapter);
    const message = createChannelMessage(identity, {
      communityId, channelId, body: 'tap me',
      hlc: nextHlc(highestHlc(db.adapter, communityId, channelId), tick()),
    });
    insertMessageRow(db.adapter, message);

    const first = providerSendReaction({ eventId: message.id }, '❤️')!;
    providerSendReaction({ eventId: message.id }, '❤️'); // second tap: no-op
    expect(activeCount(message.id, '❤️')).toBe(1);

    providerRemoveReaction(first.id);
    expect(activeCount(message.id, '❤️')).toBe(0);
  });

  it('un-tap is total even if two active reacts somehow slipped through', () => {
    db = createInMemoryTestDatabase();
    ensureCommunityTables(db.adapter);
    const message = createChannelMessage(identity, {
      communityId, channelId, body: 'dup me',
      hlc: nextHlc(highestHlc(db.adapter, communityId, channelId), tick()),
    });
    insertMessageRow(db.adapter, message);

    // Two raw reacts, bypassing dedupe (e.g. an offline race).
    const r1 = buildReactionEvent(identity, {
      communityId, channelId, targetEventId: message.id, emoji: '❤️',
      hlc: nextHlc(highestHlc(db.adapter, communityId, channelId), tick()),
    });
    insertMessageRow(db.adapter, r1);
    const r2 = buildReactionEvent(identity, {
      communityId, channelId, targetEventId: message.id, emoji: '❤️',
      hlc: nextHlc(highestHlc(db.adapter, communityId, channelId), tick()),
    });
    insertMessageRow(db.adapter, r2);
    expect(activeCount(message.id, '❤️')).toBe(2);

    providerRemoveReaction(r1.id);
    expect(activeCount(message.id, '❤️')).toBe(0);
  });
});
