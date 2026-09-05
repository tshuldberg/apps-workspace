// Web twin of the Plan 32 T0.1 enrichment tests in
// apps/meerkat/app/__tests__/feed-core.test.ts. Proves the web feed-core decorates
// post items with media / replyCount / reactions from the same verified local rows,
// never reorders the ranking (TC-2), and never lets reactions create feed items or
// inflate counts (Plan 30 T0.3 at the feed level), identically to mobile.

import { describe, expect, it } from 'vitest';
import { createInMemoryTestDatabase } from '@mylife/db';
import {
  createChannelMessage,
  createChannelMessageV2,
  createCommunity,
  generateDeviceIdentity,
  type DeviceIdentity,
  type StoredCommunity,
} from '@mylife/sync';
import {
  createChannelPostEvent,
  createChannelPostReplyEvent,
  insertMessageRow,
} from '../meerkat-data';
import {
  DEFAULT_FEED_CONTROLS,
  evaluateLocalFeed,
  parseFeedControls,
  serializeFeedControls,
} from '../feed-core';
import { LINK_PREVIEW_MIME_TYPE } from '../link-preview';
import { ensureSyncSchema } from '../schema';

const IMG_HASH = 'd'.repeat(128);
const LINK_HASH = 'ab'.repeat(64);

function newDb() {
  const { adapter } = createInMemoryTestDatabase();
  ensureSyncSchema(adapter);
  return adapter;
}

function storedCommunity(): {
  community: StoredCommunity;
  self: DeviceIdentity;
  peer: DeviceIdentity;
} {
  const self = generateDeviceIdentity('Me');
  const peer = generateDeviceIdentity('Peer');
  const signed = createCommunity(self, {
    name: 'Book club',
    channels: [{ id: 'general', name: 'general' }],
    members: [{ deviceId: peer.publicKey, role: 'member', displayName: 'Peer', dhPublicKey: peer.dhPublicKey }],
    now: '2026-06-24T10:00:00.000Z',
  });
  return {
    self,
    peer,
    community: {
      communityId: signed.descriptor.communityId,
      descriptor: signed.descriptor,
      signature: signed.signature,
      myRole: 'owner',
      joinedAt: '2026-06-24T10:00:00.000Z',
      updatedAt: '2026-06-24T10:00:00.000Z',
    },
  };
}

function imagePost(
  db: ReturnType<typeof newDb>,
  author: DeviceIdentity,
  communityId: string,
  postId: string,
  body: string,
  wall: string,
  mimeType = 'image/jpeg',
) {
  const root = createChannelMessageV2(author, {
    communityId,
    channelId: 'general',
    body,
    hlc: { wall, counter: 0 },
    postId,
    parentId: postId,
    branchId: postId,
    authorKind: 'human',
    intent: 'message',
    attachments: [{ id: 'att-img', blobHash: IMG_HASH, name: 'photo.jpg', mimeType, size: 4096 }],
  });
  insertMessageRow(db, root);
  return root;
}

function linkPost(
  db: ReturnType<typeof newDb>,
  author: DeviceIdentity,
  communityId: string,
  postId: string,
  body: string,
  wall: string,
) {
  const root = createChannelMessageV2(author, {
    communityId,
    channelId: 'general',
    body,
    hlc: { wall, counter: 0 },
    postId,
    parentId: postId,
    branchId: postId,
    authorKind: 'human',
    intent: 'message',
    attachments: [{ id: 'att-link', blobHash: LINK_HASH, name: 'link-preview', mimeType: LINK_PREVIEW_MIME_TYPE, size: 512 }],
  });
  insertMessageRow(db, root);
  return root;
}

function reactTo(
  db: ReturnType<typeof newDb>,
  author: DeviceIdentity,
  root: { communityId: string; channelId: string; id: string; postId?: string },
  emoji: string,
  wall: string,
) {
  const react = createChannelMessageV2(author, {
    communityId: root.communityId,
    channelId: root.channelId,
    body: emoji,
    hlc: { wall, counter: 0 },
    postId: root.postId,
    parentId: root.id,
    intent: 'react',
    authorKind: 'human',
  });
  insertMessageRow(db, react);
  return react;
}

describe('web feed-core Plan 32 T0.1 enrichment (twin)', () => {
  it('enriches post items with media, replyCount, and reactions; leaves file items untouched', () => {
    const db = newDb();
    const { community, self, peer } = storedCommunity();
    const communityId = community.communityId;
    const other = generateDeviceIdentity('Other');

    const p1 = imagePost(db, peer, communityId, 'post_p1', 'Sunset over the ridge', '2026-06-24T10:01:00.000Z');
    const reply = createChannelPostReplyEvent(self, {
      parent: p1,
      body: 'Beautiful shot',
      hlc: { wall: '2026-06-24T10:02:00.000Z', counter: 0 },
    });
    insertMessageRow(db, reply);
    reactTo(db, peer, p1, '❤️', '2026-06-24T10:03:00.000Z');
    reactTo(db, other, p1, '❤️', '2026-06-24T10:03:30.000Z');
    reactTo(db, self, p1, '👍', '2026-06-24T10:04:00.000Z');

    const p2 = createChannelPostEvent(peer, {
      communityId,
      channelId: 'general',
      body: 'Anyone up for a hike?',
      hlc: { wall: '2026-06-24T10:00:00.000Z', counter: 0 },
    });
    insertMessageRow(db, p2);

    const file = createChannelMessage(peer, {
      communityId,
      channelId: 'general',
      body: 'Trail map',
      attachments: [{ id: 'att-map', blobHash: 'e'.repeat(128), name: 'map.pdf', mimeType: 'application/pdf', size: 2048 }],
      hlc: { wall: '2026-06-24T09:59:00.000Z', counter: 0 },
    });
    insertMessageRow(db, file);

    const feed = evaluateLocalFeed({ db, communities: [community], selfDeviceId: self.publicKey });

    const item1 = feed.items.find((item) => item.id === 'post:post_p1');
    expect(item1?.kind).toBe('post');
    expect(item1?.media).toEqual({ blobHash: IMG_HASH, mimeType: 'image/jpeg' });
    expect(item1?.replyCount).toBe(1);
    const emojis = (item1?.reactions ?? []).map((group) => group.emoji);
    expect(emojis).toContain('❤️');
    expect(emojis).toContain('👍');
    expect(item1?.reactions?.find((group) => group.emoji === '❤️')?.count).toBe(2);
    expect(item1?.reactions?.find((group) => group.emoji === '👍')?.mine).toBe(true);

    const item2 = feed.items.find((item) => item.id === `post:${p2.postId}`);
    expect(item2?.media).toBeNull();
    expect(item2?.replyCount).toBe(0);
    expect(item2?.reactions).toEqual([]);

    const fileItem = feed.items.find((item) => item.kind === 'file');
    expect(fileItem).toBeDefined();
    expect(fileItem?.media).toBeUndefined();
    expect(fileItem?.reactions).toBeUndefined();
  });

  it('does not reorder the feed when posts gain reactions (TC-2 ranking snapshot)', () => {
    const db = newDb();
    const { community, self, peer } = storedCommunity();
    const communityId = community.communityId;

    const pa = createChannelPostEvent(peer, { communityId, channelId: 'general', body: 'oldest', hlc: { wall: '2026-06-24T10:00:00.000Z', counter: 0 } });
    const pb = createChannelPostEvent(peer, { communityId, channelId: 'general', body: 'middle', hlc: { wall: '2026-06-24T10:01:00.000Z', counter: 0 } });
    const pc = createChannelPostEvent(peer, { communityId, channelId: 'general', body: 'newest', hlc: { wall: '2026-06-24T10:02:00.000Z', counter: 0 } });
    for (const post of [pa, pb, pc]) insertMessageRow(db, post);
    const file = createChannelMessage(peer, {
      communityId,
      channelId: 'general',
      body: 'Map',
      attachments: [{ id: 'att-map', blobHash: 'f'.repeat(128), name: 'map.pdf', mimeType: 'application/pdf', size: 1024 }],
      hlc: { wall: '2026-06-24T10:03:00.000Z', counter: 0 },
    });
    insertMessageRow(db, file);

    const controls = { unread: false } as const;
    const before = evaluateLocalFeed({ db, communities: [community], selfDeviceId: self.publicKey, controls });
    expect(before.items.map((item) => item.kind)).toEqual(['post', 'post', 'post', 'file']);
    expect(before.items.slice(0, 3).map((item) => item.id)).toEqual([`post:${pc.postId}`, `post:${pb.postId}`, `post:${pa.postId}`]);
    const orderBefore = before.items.map((item) => item.id);

    reactTo(db, generateDeviceIdentity('R1'), pa, '🔥', '2026-06-24T11:00:00.000Z');
    reactTo(db, generateDeviceIdentity('R2'), pa, '🔥', '2026-06-24T11:00:01.000Z');
    reactTo(db, generateDeviceIdentity('R3'), pa, '🔥', '2026-06-24T11:00:02.000Z');

    const after = evaluateLocalFeed({ db, communities: [community], selfDeviceId: self.publicKey, controls });
    expect(after.items.map((item) => item.id)).toEqual(orderBefore);

    const paItem = after.items.find((item) => item.id === `post:${pa.postId}`);
    expect(paItem?.reactions?.find((group) => group.emoji === '🔥')?.count).toBe(3);
    expect(paItem?.sortAt).toEqual(pa.hlc);
  });

  it('detects image media case-insensitively (MIME is case-insensitive)', () => {
    const db = newDb();
    const { community, self, peer } = storedCommunity();
    const communityId = community.communityId;
    imagePost(db, peer, communityId, 'post_upper', 'Uppercase mime', '2026-06-24T10:00:00.000Z', 'IMAGE/JPEG');

    const feed = evaluateLocalFeed({ db, communities: [community], selfDeviceId: self.publicKey });
    const item = feed.items.find((entry) => entry.id === 'post:post_upper');
    expect(item?.media).toEqual({ blobHash: IMG_HASH, mimeType: 'IMAGE/JPEG' });
  });

  it('reactions create no feed items and never inflate replyCount, unread, or lastActivity', () => {
    const db = newDb();
    const { community, self, peer } = storedCommunity();
    const communityId = community.communityId;

    const post = createChannelPostEvent(peer, { communityId, channelId: 'general', body: 'Question of the day', hlc: { wall: '2026-06-24T10:00:00.000Z', counter: 0 } });
    insertMessageRow(db, post);
    const reply = createChannelPostReplyEvent(peer, { parent: post, body: 'a real reply', hlc: { wall: '2026-06-24T10:01:00.000Z', counter: 0 } });
    insertMessageRow(db, reply);

    const before = evaluateLocalFeed({ db, communities: [community], selfDeviceId: self.publicKey });
    const idsBefore = before.items.map((item) => item.id).sort();
    const postBefore = before.items.find((item) => item.id === `post:${post.postId}`);
    const unreadBefore = before.items.find((item) => item.kind === 'unread');

    reactTo(db, generateDeviceIdentity('R1'), post, '🎉', '2026-06-24T12:00:00.000Z');
    reactTo(db, generateDeviceIdentity('R2'), post, '🎉', '2026-06-24T12:00:01.000Z');
    reactTo(db, self, post, '🎉', '2026-06-24T12:00:02.000Z');

    const after = evaluateLocalFeed({ db, communities: [community], selfDeviceId: self.publicKey });

    expect(after.items.map((item) => item.id).sort()).toEqual(idsBefore);
    expect(after.items.some((item) => item.id.startsWith('react'))).toBe(false);

    const postAfter = after.items.find((item) => item.id === `post:${post.postId}`);
    expect(postAfter?.replyCount).toBe(1);
    expect(postAfter?.replyCount).toBe(postBefore?.replyCount);
    expect(postAfter?.sortAt).toEqual(postBefore?.sortAt);

    const unreadAfter = after.items.find((item) => item.kind === 'unread');
    expect(unreadAfter?.unreadCount).toBe(unreadBefore?.unreadCount);

    expect(postAfter?.reactions?.find((group) => group.emoji === '🎉')?.count).toBe(3);
  });

  it('surfaces link previews and never lets them reorder the feed (Plan 32 T5.1 twin, TC-2)', () => {
    const db = newDb();
    const { community, self, peer } = storedCommunity();
    const communityId = community.communityId;
    const pa = createChannelPostEvent(peer, { communityId, channelId: 'general', body: 'oldest', hlc: { wall: '2026-06-24T10:00:00.000Z', counter: 0 } });
    const pc = createChannelPostEvent(peer, { communityId, channelId: 'general', body: 'newest', hlc: { wall: '2026-06-24T10:02:00.000Z', counter: 0 } });
    insertMessageRow(db, pa);
    insertMessageRow(db, pc);
    const pb = linkPost(db, peer, communityId, 'post_pb', 'middle https://example.com', '2026-06-24T10:01:00.000Z');

    const controls = { unread: false } as const;
    const feed = evaluateLocalFeed({ db, communities: [community], selfDeviceId: self.publicKey, controls });
    expect(feed.items.map((item) => item.id)).toEqual([`post:${pc.postId}`, `post:${pb.postId}`, `post:${pa.postId}`]);
    const pbItem = feed.items.find((item) => item.id === `post:${pb.postId}`);
    const paItem = feed.items.find((item) => item.id === `post:${pa.postId}`);
    expect(pbItem?.linkPreview).toEqual({ blobHash: LINK_HASH, mimeType: LINK_PREVIEW_MIME_TYPE });
    expect(pbItem?.media).toBeNull();
    expect(pbItem?.rankScore).toBe(paItem?.rankScore); // enrichment adds no rank weight (NC-5)
    // A link-preview blob is a decoration, never a shared file: no Files feed item.
    expect(feed.items.some((item) => item.kind === 'file')).toBe(false);
  });
});

describe('web feed control persistence (composition Phase 0)', () => {
  it('round-trips controls through serialize/parse', () => {
    const controls = { ...DEFAULT_FEED_CONTROLS, posts: false, public: true };
    expect(parseFeedControls(serializeFeedControls(controls))).toEqual(controls);
  });

  it('fails safe to defaults on null, malformed JSON, and non-object payloads', () => {
    expect(parseFeedControls(null)).toEqual(DEFAULT_FEED_CONTROLS);
    expect(parseFeedControls('not json')).toEqual(DEFAULT_FEED_CONTROLS);
    expect(parseFeedControls('[true]')).toEqual(DEFAULT_FEED_CONTROLS);
    expect(parseFeedControls('null')).toEqual(DEFAULT_FEED_CONTROLS);
  });

  it('drops unknown keys and wrong-typed values, keeps defaults for missing keys', () => {
    const parsed = parseFeedControls(JSON.stringify({ posts: false, bogus: true, files: 'yes' }));
    expect(parsed.posts).toBe(false);
    expect(parsed.files).toBe(DEFAULT_FEED_CONTROLS.files);
    expect('bogus' in parsed).toBe(false);
  });
});
