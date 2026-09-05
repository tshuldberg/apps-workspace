import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createInMemoryTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import {
  createChannelMessage,
  createChannelMessageV2,
  createCommunity,
  createPublication,
  generateDeviceIdentity,
  type DirectoryEntry,
  type StoredCommunity,
} from '@mylife/sync';
import {
  createChannelPostEvent,
  createChannelPostReplyEvent,
  ensureCommunityTables,
  insertMessageRow,
} from '../(root)/data/community-core';
import {
  DEFAULT_FEED_CONTROLS,
  VISIBLE_FEED_CONTROLS,
  evaluateLocalFeed,
  getVisibleFeedControls,
  parseFeedControls,
  serializeFeedControls,
} from '../(root)/data/feed-core';
import { LINK_PREVIEW_MIME_TYPE } from '../(root)/data/link-preview';
import {
  getDirectoryCacheEntries,
  probePublicDirectory,
  type VerifiedPublicEntry,
} from '../(root)/data/public-directory-client';
import { ensureMeerkatTables, setSetting } from '../(root)/data/db';
import { PUBLIC_DIRECTORY_URL_SETTING } from '../(root)/data/sync-core';
import {
  blockCommunityPerson,
  reportCommunityContent,
} from '../(root)/data/community-safety';

function publicEntry(overrides: Partial<VerifiedPublicEntry> = {}): VerifiedPublicEntry {
  return {
    publication_id: 'pub-1',
    kind: 'community',
    title: 'Trail Cooks',
    description: 'Open fire recipes',
    category: 'hobbies',
    owner_device_id: 'owner-device',
    content_id: 'content-1',
    public_key_hex: 'ab'.repeat(16),
    host_urls: JSON.stringify(['https://host.example']),
    announcing_hosts: 3,
    event_count: 0,
    latest_wall: '2026-06-24T10:00:00.000Z',
    source_host: 'wss://dir.example',
    fetched_at: '2026-06-24T10:05:00.000Z',
    verified: true,
    ...overrides,
  };
}

let db: InMemoryTestDatabase;

beforeEach(() => {
  db = createInMemoryTestDatabase();
  ensureCommunityTables(db.adapter);
});

afterEach(() => {
  db.close();
});

function storedCommunity(): {
  community: StoredCommunity;
  self: ReturnType<typeof generateDeviceIdentity>;
  peer: ReturnType<typeof generateDeviceIdentity>;
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

describe('feed-core Prompt 05 local feed engine', () => {
  it('combines mentions, replies, unread channel highlights, posts, and files from real rows', () => {
    const { community, self, peer } = storedCommunity();
    const communityId = community.communityId;

    const root = createChannelPostEvent(self, {
      communityId,
      channelId: 'general',
      body: 'Road trip packing list',
      hlc: { wall: '2026-06-24T10:01:00.000Z', counter: 0 },
    });
    const reply = createChannelPostReplyEvent(peer, {
      parent: root,
      body: 'I added the tent.',
      hlc: { wall: '2026-06-24T10:02:00.000Z', counter: 0 },
    });
    const mention = createChannelMessageV2(peer, {
      communityId,
      channelId: 'general',
      body: 'Can you review this?',
      hlc: { wall: '2026-06-24T10:03:00.000Z', counter: 0 },
      authorKind: 'human',
      mentions: [self.publicKey],
      intent: 'message',
    });
    const file = createChannelMessage(peer, {
      communityId,
      channelId: 'general',
      body: 'Packing PDF',
      attachments: [{
        id: 'att-pack',
        blobHash: 'a'.repeat(128),
        name: 'packing.pdf',
        mimeType: 'application/pdf',
        size: 2048,
      }],
      hlc: { wall: '2026-06-24T10:04:00.000Z', counter: 0 },
    });

    for (const event of [root, reply, mention, file]) {
      insertMessageRow(db.adapter, event);
    }

    const feed = evaluateLocalFeed({
      db: db.adapter,
      communities: [community],
      selfDeviceId: self.publicKey,
    });

    expect(feed.publicSourcesAvailable).toBe(false);
    expect(VISIBLE_FEED_CONTROLS).not.toContain('public');
    expect(feed.controls.public).toBe(false);
    expect(feed.items.map((item) => item.kind)).toEqual(['mention', 'reply', 'unread', 'file']);
    expect(feed.items[0]?.reason).toBe('You were mentioned in #general.');
    expect(feed.items[1]).toMatchObject({
      kind: 'reply',
      postId: root.postId,
      authorDeviceId: peer.publicKey,
      reason: 'Someone replied to your post.',
    });
    expect(feed.items.find((item) => item.kind === 'file')?.file?.name).toBe('packing.pdf');
    expect(feed.items.every((item) => item.audienceRule.type === 'this_community')).toBe(true);
  });

  it('applies source toggles deterministically', () => {
    const { community, self, peer } = storedCommunity();
    const post = createChannelPostEvent(peer, {
      communityId: community.communityId,
      channelId: 'general',
      body: 'Community lunch',
      hlc: { wall: '2026-06-24T11:00:00.000Z', counter: 0 },
    });
    const file = createChannelMessage(peer, {
      communityId: community.communityId,
      channelId: 'general',
      body: 'menu',
      attachments: [{
        id: 'att-menu',
        blobHash: 'b'.repeat(128),
        name: 'menu.txt',
        mimeType: 'text/plain',
        size: 18,
      }],
      hlc: { wall: '2026-06-24T11:01:00.000Z', counter: 0 },
    });
    insertMessageRow(db.adapter, post);
    insertMessageRow(db.adapter, file);

    const withoutPosts = evaluateLocalFeed({
      db: db.adapter,
      communities: [community],
      selfDeviceId: self.publicKey,
      controls: { posts: false },
    });
    expect(withoutPosts.items.some((item) => item.kind === 'post')).toBe(false);
    expect(withoutPosts.items.some((item) => item.kind === 'file')).toBe(true);

    const withoutCommunities = evaluateLocalFeed({
      db: db.adapter,
      communities: [community],
      selfDeviceId: self.publicKey,
      controls: { communities: false },
    });
    expect(withoutCommunities.items).toEqual([]);
  });

  it('filters locally muted channels', () => {
    const { community, self, peer } = storedCommunity();
    const post = createChannelPostEvent(peer, {
      communityId: community.communityId,
      channelId: 'general',
      body: 'Muted announcement',
      hlc: { wall: '2026-06-24T12:00:00.000Z', counter: 0 },
    });
    insertMessageRow(db.adapter, post);
    db.adapter.execute(
      `INSERT INTO cm_read_state (
        id, community_id, channel_id, last_read_wall, last_read_counter, updated_at, mute
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        `${community.communityId}:general`,
        community.communityId,
        'general',
        null,
        null,
        '2026-06-24T12:01:00.000Z',
        1,
      ],
    );

    const feed = evaluateLocalFeed({
      db: db.adapter,
      communities: [community],
      selfDeviceId: self.publicKey,
      now: new Date('2026-06-24T12:02:00.000Z'),
    });

    expect(feed.items).toEqual([]);
  });

  it('filters blocked authors from local feed items', () => {
    const { community, self, peer } = storedCommunity();
    const post = createChannelPostEvent(peer, {
      communityId: community.communityId,
      channelId: 'general',
      body: 'Blocked announcement',
      hlc: { wall: '2026-06-24T13:00:00.000Z', counter: 0 },
    });
    insertMessageRow(db.adapter, post);
    blockCommunityPerson(db.adapter, community.communityId, peer.publicKey, 'Peer');

    const feed = evaluateLocalFeed({
      db: db.adapter,
      communities: [community],
      selfDeviceId: self.publicKey,
    });

    expect(feed.items).toEqual([]);
  });

  it('filters report-hidden posts and files from local feed items', () => {
    const { community, self, peer } = storedCommunity();
    const post = createChannelPostEvent(peer, {
      communityId: community.communityId,
      channelId: 'general',
      body: 'Reported post',
      hlc: { wall: '2026-06-24T14:00:00.000Z', counter: 0 },
    });
    const file = createChannelMessage(peer, {
      communityId: community.communityId,
      channelId: 'general',
      body: 'reported attachment',
      attachments: [{
        id: 'att-report',
        blobHash: 'c'.repeat(128),
        name: 'reported.txt',
        mimeType: 'text/plain',
        size: 42,
      }],
      hlc: { wall: '2026-06-24T14:01:00.000Z', counter: 0 },
    });
    insertMessageRow(db.adapter, post);
    insertMessageRow(db.adapter, file);
    reportCommunityContent(db.adapter, {
      communityId: community.communityId,
      channelId: 'general',
      targetKind: 'post',
      targetId: post.postId!,
      targetAuthorDeviceId: peer.publicKey,
      targetLabel: 'Reported post',
      reason: 'Reported from test',
    });
    reportCommunityContent(db.adapter, {
      communityId: community.communityId,
      channelId: 'general',
      targetKind: 'file',
      targetId: 'general:att-report',
      targetAuthorDeviceId: peer.publicKey,
      targetLabel: 'reported.txt',
      reason: 'Reported from test',
    });

    const feed = evaluateLocalFeed({
      db: db.adapter,
      communities: [community],
      selfDeviceId: self.publicKey,
    });

    expect(feed.items.some((item) => item.kind === 'post')).toBe(false);
    expect(feed.items.some((item) => item.kind === 'file')).toBe(false);
  });
});

describe('feed-core Plan 19 public source wiring', () => {
  it('hides the public control and builds no public items when no source is supplied', () => {
    const { community, self } = storedCommunity();
    const feed = evaluateLocalFeed({
      db: db.adapter,
      communities: [community],
      selfDeviceId: self.publicKey,
    });
    expect(feed.publicSourcesAvailable).toBe(false);
    expect(getVisibleFeedControls(feed.publicSourcesAvailable)).not.toContain('public');
    expect(feed.controls.public).toBe(false);
    expect(feed.items.some((item) => item.kind === 'public')).toBe(false);
    expect(feed.excludedSources).toContain(
      'Public hosted sources are hidden because no public source is available.',
    );
  });

  it('exposes the public control and builds verified public items when a source responds', () => {
    const { community, self } = storedCommunity();
    const entry = publicEntry({ announcing_hosts: 4, event_count: 0 });
    const feed = evaluateLocalFeed({
      db: db.adapter,
      communities: [community],
      selfDeviceId: self.publicKey,
      controls: { public: true },
      publicSource: { configured: true, respondedAt: '2026-06-24T10:05:00.000Z', entries: [entry] },
    });
    expect(feed.publicSourcesAvailable).toBe(true);
    expect(getVisibleFeedControls(feed.publicSourcesAvailable)).toContain('public');
    expect(feed.controls.public).toBe(true);
    const publicItem = feed.items.find((item) => item.kind === 'public');
    expect(publicItem).toBeDefined();
    expect(publicItem?.public?.announcing_hosts).toBe(4);
    expect(publicItem?.public?.event_count).toBe(0);
    expect(publicItem?.title).toBe(entry.title);
    expect(publicItem?.audienceRule.type).toBe('public');
    expect(feed.excludedSources).not.toContain(
      'Public hosted sources are hidden because no public source is available.',
    );
  });

  it('keeps the public control hidden when a configured source responded with zero entries (TC-5)', () => {
    const { community, self } = storedCommunity();
    const feed = evaluateLocalFeed({
      db: db.adapter,
      communities: [community],
      selfDeviceId: self.publicKey,
      controls: { public: true },
      publicSource: { configured: true, respondedAt: '2026-06-24T10:05:00.000Z', entries: [] },
    });
    expect(feed.publicSourcesAvailable).toBe(false);
    expect(getVisibleFeedControls(feed.publicSourcesAvailable)).not.toContain('public');
    expect(feed.controls.public).toBe(false);
    expect(feed.items.some((item) => item.kind === 'public')).toBe(false);
  });

  it('keeps the public control hidden when a configured source did not respond (unreachable)', () => {
    const { community, self } = storedCommunity();
    const feed = evaluateLocalFeed({
      db: db.adapter,
      communities: [community],
      selfDeviceId: self.publicKey,
      controls: { public: true },
      publicSource: { configured: true, respondedAt: null, entries: [publicEntry()] },
    });
    expect(feed.publicSourcesAvailable).toBe(false);
    expect(getVisibleFeedControls(feed.publicSourcesAvailable)).not.toContain('public');
    expect(feed.controls.public).toBe(false);
    expect(feed.items.some((item) => item.kind === 'public')).toBe(false);
  });
});

describe('public-directory-client probe service', () => {
  beforeEach(() => {
    ensureMeerkatTables(db.adapter);
  });

  function signedDirectoryEntry(sourceHost: string): DirectoryEntry {
    const owner = generateDeviceIdentity('Publisher');
    const signed = createPublication(owner, {
      kind: 'community',
      communityId: 'comm-1',
      title: 'Backcountry Cooks',
      description: 'Open fire recipes and trail meals',
      category: 'hobbies',
      contentId: 'content-hash-1',
      publicKeyHex: 'cd'.repeat(16),
      hostUrls: ['https://seed.example'],
      now: '2026-06-24T09:00:00.000Z',
    });
    return {
      descriptor: signed.descriptor,
      signature: signed.signature,
      announcingHosts: 5,
      eventCount: 0,
      latestWall: '',
      sourceHost,
      verified: true,
    };
  }

  it('returns configured:false when no directory URL is set', async () => {
    const result = await probePublicDirectory(db.adapter, { category: 'hobbies' });
    expect(result).toEqual({ configured: false, respondedAt: null, entries: [] });
  });

  it('upserts verified entries with real announcing_hosts and event_count=0', async () => {
    setSetting(db.adapter, PUBLIC_DIRECTORY_URL_SETTING, 'wss://dir.example');
    const entry = signedDirectoryEntry('wss://dir.example');
    const result = await probePublicDirectory(db.adapter, {
      category: 'hobbies',
      now: () => '2026-06-24T10:00:00.000Z',
      browseFn: async () => [entry],
    });
    expect(result.configured).toBe(true);
    expect(result.respondedAt).toBe('2026-06-24T10:00:00.000Z');
    expect(result.entries).toHaveLength(1);
    const mapped = result.entries[0]!;
    expect(mapped.announcing_hosts).toBe(5);
    expect(mapped.event_count).toBe(0);
    expect(mapped.latest_wall).toBe('2026-06-24T09:00:00.000Z');
    expect(mapped.verified).toBe(true);
    expect(mapped.publication_id).toBe(entry.descriptor.publicationId);

    const cached = getDirectoryCacheEntries(db.adapter, 'hobbies');
    expect(cached).toHaveLength(1);
    expect(cached[0]?.announcing_hosts).toBe(5);
    expect(cached[0]?.publication_id).toBe(entry.descriptor.publicationId);
  });

  it('reports responded-but-empty honestly when a configured source returns nothing', async () => {
    setSetting(db.adapter, PUBLIC_DIRECTORY_URL_SETTING, 'wss://dir.example');
    const result = await probePublicDirectory(db.adapter, {
      category: 'hobbies',
      now: () => '2026-06-24T10:00:00.000Z',
      browseFn: async () => [],
    });
    expect(result.configured).toBe(true);
    expect(result.respondedAt).toBe('2026-06-24T10:00:00.000Z');
    expect(result.entries).toEqual([]);
  });

  it('returns configured:true respondedAt:null on a directory network failure', async () => {
    setSetting(db.adapter, PUBLIC_DIRECTORY_URL_SETTING, 'wss://dir.example');
    const result = await probePublicDirectory(db.adapter, {
      category: 'hobbies',
      browseFn: async () => {
        throw new Error('unreachable');
      },
    });
    expect(result).toEqual({ configured: true, respondedAt: null, entries: [] });
  });
});

describe('feed-core Plan 32 T0.1 enrichment', () => {
  const IMG_HASH = 'd'.repeat(128);

  // A signed post ROOT carrying an image attachment. The attachment rides the
  // event's own attachments_json, so post.root.attachments round-trips through the
  // row. A custom postId is legal (isChannelPostRootEvent only needs parentId ===
  // postId); channelPostId excludes attachments, so the id is stable regardless.
  function imagePost(
    author: ReturnType<typeof generateDeviceIdentity>,
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
      attachments: [{
        id: 'att-img',
        blobHash: IMG_HASH,
        name: 'photo.jpg',
        mimeType,
        size: 4096,
      }],
    });
    insertMessageRow(db.adapter, root);
    return root;
  }

  // A signed reaction (v2, intent 'react') targeting a post root's event id.
  function reactTo(
    author: ReturnType<typeof generateDeviceIdentity>,
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
    insertMessageRow(db.adapter, react);
    return react;
  }

  it('enriches post items with media, replyCount, and reactions; leaves file items untouched', () => {
    const { community, self, peer } = storedCommunity();
    const communityId = community.communityId;
    const other = generateDeviceIdentity('Other');

    // P1: image post by peer, one real reply (self), and three reactions.
    const p1 = imagePost(peer, communityId, 'post_p1', 'Sunset over the ridge', '2026-06-24T10:01:00.000Z');
    const reply = createChannelPostReplyEvent(self, {
      parent: p1,
      body: 'Beautiful shot',
      hlc: { wall: '2026-06-24T10:02:00.000Z', counter: 0 },
    });
    insertMessageRow(db.adapter, reply);
    reactTo(peer, p1, '❤️', '2026-06-24T10:03:00.000Z');
    reactTo(other, p1, '❤️', '2026-06-24T10:03:30.000Z');
    reactTo(self, p1, '👍', '2026-06-24T10:04:00.000Z');

    // P2: text-only post by peer, no replies, no reactions.
    const p2 = createChannelPostEvent(peer, {
      communityId,
      channelId: 'general',
      body: 'Anyone up for a hike?',
      hlc: { wall: '2026-06-24T10:00:00.000Z', counter: 0 },
    });
    insertMessageRow(db.adapter, p2);

    // A file item, unchanged by enrichment.
    const file = createChannelMessage(peer, {
      communityId,
      channelId: 'general',
      body: 'Trail map',
      attachments: [{
        id: 'att-map',
        blobHash: 'e'.repeat(128),
        name: 'map.pdf',
        mimeType: 'application/pdf',
        size: 2048,
      }],
      hlc: { wall: '2026-06-24T09:59:00.000Z', counter: 0 },
    });
    insertMessageRow(db.adapter, file);

    const feed = evaluateLocalFeed({
      db: db.adapter,
      communities: [community],
      selfDeviceId: self.publicKey,
    });

    const item1 = feed.items.find((item) => item.id === 'post:post_p1');
    expect(item1?.kind).toBe('post');
    expect(item1?.media).toEqual({ blobHash: IMG_HASH, mimeType: 'image/jpeg' });
    expect(item1?.replyCount).toBe(1);
    const emojis = (item1?.reactions ?? []).map((group) => group.emoji);
    expect(emojis).toContain('❤️');
    expect(emojis).toContain('👍');
    expect(item1?.reactions?.find((group) => group.emoji === '❤️')?.count).toBe(2); // peer + other
    expect(item1?.reactions?.find((group) => group.emoji === '👍')?.mine).toBe(true); // self

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
    const { community, self, peer } = storedCommunity();
    const communityId = community.communityId;

    // Three plain posts by peer at increasing times (equal post rankScore, so the
    // deterministic order is newest-first: pc, pb, pa) plus a file (lower kind
    // rank) so the snapshot also locks CROSS-KIND ordering (posts above files).
    const pa = createChannelPostEvent(peer, { communityId, channelId: 'general', body: 'oldest', hlc: { wall: '2026-06-24T10:00:00.000Z', counter: 0 } });
    const pb = createChannelPostEvent(peer, { communityId, channelId: 'general', body: 'middle', hlc: { wall: '2026-06-24T10:01:00.000Z', counter: 0 } });
    const pc = createChannelPostEvent(peer, { communityId, channelId: 'general', body: 'newest', hlc: { wall: '2026-06-24T10:02:00.000Z', counter: 0 } });
    for (const post of [pa, pb, pc]) insertMessageRow(db.adapter, post);
    const file = createChannelMessage(peer, {
      communityId,
      channelId: 'general',
      body: 'Map',
      attachments: [{ id: 'att-map', blobHash: 'f'.repeat(128), name: 'map.pdf', mimeType: 'application/pdf', size: 1024 }],
      hlc: { wall: '2026-06-24T10:03:00.000Z', counter: 0 },
    });
    insertMessageRow(db.adapter, file);

    // Unread OFF so the snapshot is exactly the three posts (rank 300, newest
    // first) followed by the file (rank 200).
    const controls = { unread: false } as const;
    const before = evaluateLocalFeed({ db: db.adapter, communities: [community], selfDeviceId: self.publicKey, controls });
    expect(before.items.map((item) => item.kind)).toEqual(['post', 'post', 'post', 'file']);
    expect(before.items.slice(0, 3).map((item) => item.id)).toEqual([`post:${pc.postId}`, `post:${pb.postId}`, `post:${pa.postId}`]);
    const orderBefore = before.items.map((item) => item.id);

    // Pile reactions on the OLDEST post with the LATEST wall clocks. If reactions
    // fed ranking or bumped lastActivity, pa would jump to the top.
    reactTo(generateDeviceIdentity('R1'), pa, '🔥', '2026-06-24T11:00:00.000Z');
    reactTo(generateDeviceIdentity('R2'), pa, '🔥', '2026-06-24T11:00:01.000Z');
    reactTo(generateDeviceIdentity('R3'), pa, '🔥', '2026-06-24T11:00:02.000Z');

    const after = evaluateLocalFeed({ db: db.adapter, communities: [community], selfDeviceId: self.publicKey, controls });
    expect(after.items.map((item) => item.id)).toEqual(orderBefore); // no drift, cross-kind order preserved

    const paItem = after.items.find((item) => item.id === `post:${pa.postId}`);
    expect(paItem?.reactions?.find((group) => group.emoji === '🔥')?.count).toBe(3);
    expect(paItem?.sortAt).toEqual(pa.hlc); // lastActivity NOT bumped by the later reactions
  });

  it('detects image media case-insensitively (MIME is case-insensitive)', () => {
    const { community, self, peer } = storedCommunity();
    const communityId = community.communityId;
    // An uppercase declared MIME still resolves as inline media; the original
    // declared value is preserved (only the comparison is lowercased).
    imagePost(peer, communityId, 'post_upper', 'Uppercase mime', '2026-06-24T10:00:00.000Z', 'IMAGE/JPEG');

    const feed = evaluateLocalFeed({ db: db.adapter, communities: [community], selfDeviceId: self.publicKey });
    const item = feed.items.find((entry) => entry.id === 'post:post_upper');
    expect(item?.media).toEqual({ blobHash: IMG_HASH, mimeType: 'IMAGE/JPEG' });
  });

  it('reactions create no feed items and never inflate replyCount, unread, or lastActivity', () => {
    const { community, self, peer } = storedCommunity();
    const communityId = community.communityId;

    const post = createChannelPostEvent(peer, { communityId, channelId: 'general', body: 'Question of the day', hlc: { wall: '2026-06-24T10:00:00.000Z', counter: 0 } });
    insertMessageRow(db.adapter, post);
    const reply = createChannelPostReplyEvent(peer, { parent: post, body: 'a real reply', hlc: { wall: '2026-06-24T10:01:00.000Z', counter: 0 } });
    insertMessageRow(db.adapter, reply);

    const before = evaluateLocalFeed({ db: db.adapter, communities: [community], selfDeviceId: self.publicKey });
    const idsBefore = before.items.map((item) => item.id).sort();
    const postBefore = before.items.find((item) => item.id === `post:${post.postId}`);
    const unreadBefore = before.items.find((item) => item.kind === 'unread');

    // Reactions with LATER wall clocks than every message.
    reactTo(generateDeviceIdentity('R1'), post, '🎉', '2026-06-24T12:00:00.000Z');
    reactTo(generateDeviceIdentity('R2'), post, '🎉', '2026-06-24T12:00:01.000Z');
    reactTo(self, post, '🎉', '2026-06-24T12:00:02.000Z');

    const after = evaluateLocalFeed({ db: db.adapter, communities: [community], selfDeviceId: self.publicKey });

    // Same feed items: reactions add ZERO items (there is no react-kind item).
    expect(after.items.map((item) => item.id).sort()).toEqual(idsBefore);
    expect(after.items.some((item) => item.id.startsWith('react'))).toBe(false);

    const postAfter = after.items.find((item) => item.id === `post:${post.postId}`);
    expect(postAfter?.replyCount).toBe(1);
    expect(postAfter?.replyCount).toBe(postBefore?.replyCount);
    expect(postAfter?.sortAt).toEqual(postBefore?.sortAt); // lastActivity unchanged

    const unreadAfter = after.items.find((item) => item.kind === 'unread');
    expect(unreadAfter?.unreadCount).toBe(unreadBefore?.unreadCount); // reactions not counted as unread

    // The reactions ARE surfaced as decoration on the post.
    expect(postAfter?.reactions?.find((group) => group.emoji === '🎉')?.count).toBe(3);
  });
});

describe('feed-core Plan 32 T5.1 link-preview enrichment', () => {
  const LINK_HASH = 'ab'.repeat(64); // 128 hex chars

  // A signed post ROOT carrying a link-preview attachment (the sender-generated
  // JSON blob), parallel to imagePost. The blob bytes are NOT read here (feed-core
  // only surfaces the attachment reference); the render layer parses them lazily.
  function linkPost(
    author: ReturnType<typeof generateDeviceIdentity>,
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
      attachments: [{
        id: 'att-link',
        blobHash: LINK_HASH,
        name: 'link-preview',
        mimeType: LINK_PREVIEW_MIME_TYPE,
        size: 512,
      }],
    });
    insertMessageRow(db.adapter, root);
    return root;
  }

  it('surfaces the first link-preview attachment as linkPreview, never as inline media', () => {
    const { community, self, peer } = storedCommunity();
    linkPost(peer, community.communityId, 'post_link', 'Check this out https://example.com', '2026-06-24T10:00:00.000Z');
    const feed = evaluateLocalFeed({ db: db.adapter, communities: [community], selfDeviceId: self.publicKey });
    const item = feed.items.find((entry) => entry.id === 'post:post_link');
    expect(item?.linkPreview).toEqual({ blobHash: LINK_HASH, mimeType: LINK_PREVIEW_MIME_TYPE });
    expect(item?.media).toBeNull(); // a link-preview blob is never inline image media
    // A link-preview blob is a decoration, never a shared file: it must not appear
    // as a Files feed item (it is filtered from aggregateCommunityFiles).
    expect(feed.items.some((entry) => entry.kind === 'file')).toBe(false);
  });

  it('leaves linkPreview null on a post with no link-preview attachment', () => {
    const { community, self, peer } = storedCommunity();
    const post = createChannelPostEvent(peer, {
      communityId: community.communityId,
      channelId: 'general',
      body: 'plain post, no link',
      hlc: { wall: '2026-06-24T10:00:00.000Z', counter: 0 },
    });
    insertMessageRow(db.adapter, post);
    const feed = evaluateLocalFeed({ db: db.adapter, communities: [community], selfDeviceId: self.publicKey });
    const item = feed.items.find((entry) => entry.id === `post:${post.postId}`);
    expect(item?.linkPreview).toBeNull();
  });

  it('does not change ranking order or rankScore when a post carries a link preview (TC-2)', () => {
    const { community, self, peer } = storedCommunity();
    const communityId = community.communityId;
    const pa = createChannelPostEvent(peer, { communityId, channelId: 'general', body: 'oldest', hlc: { wall: '2026-06-24T10:00:00.000Z', counter: 0 } });
    const pc = createChannelPostEvent(peer, { communityId, channelId: 'general', body: 'newest', hlc: { wall: '2026-06-24T10:02:00.000Z', counter: 0 } });
    insertMessageRow(db.adapter, pa);
    insertMessageRow(db.adapter, pc);
    // The MIDDLE post carries a link preview. If enrichment fed ranking, it would
    // reorder; it must not.
    const pb = linkPost(peer, communityId, 'post_pb', 'middle https://example.com', '2026-06-24T10:01:00.000Z');

    const controls = { unread: false } as const;
    const feed = evaluateLocalFeed({ db: db.adapter, communities: [community], selfDeviceId: self.publicKey, controls });
    // Deterministic newest-first order (all rank 300), independent of the preview.
    expect(feed.items.map((entry) => entry.id)).toEqual([`post:${pc.postId}`, `post:${pb.postId}`, `post:${pa.postId}`]);
    const pbItem = feed.items.find((entry) => entry.id === `post:${pb.postId}`);
    const paItem = feed.items.find((entry) => entry.id === `post:${pa.postId}`);
    expect(pbItem?.rankScore).toBe(paItem?.rankScore); // enrichment adds no rank weight (NC-5)
    expect(pbItem?.linkPreview).toEqual({ blobHash: LINK_HASH, mimeType: LINK_PREVIEW_MIME_TYPE });
  });
});

describe('feed control persistence (composition Phase 0)', () => {
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
