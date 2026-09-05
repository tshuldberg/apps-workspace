// Plan 32 T1.1: pure feed-view mapping tests (Node-only, no render harness) plus
// the findPostRootEventId DB lookup used by the engagement heart's add path.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createInMemoryTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import {
  createAudienceRule,
  createCommunityAudienceRule,
  generateDeviceIdentity,
} from '@mylife/sync';
import {
  createChannelPostEvent,
  ensureCommunityTables,
  insertMessageRow,
  type MessageReactionGroup,
} from '../(root)/data/community-core';
import type { FeedItem } from '../(root)/data/feed-core';
import {
  FEED_KIND_CONTROL,
  FEED_KIND_LABEL,
  FEED_REEVAL_MIN_INTERVAL_MS,
  HEART_EMOJI,
  buildPublicShareMessage,
  createKeyedMemo,
  decideFeedThrottle,
  feedAvatarInitial,
  feedContext,
  feedEngagement,
  feedHeart,
  findPostRootEventId,
  formatFeedTime,
  nextRenderWindow,
  toFeedCardView,
} from '../(root)/data/feed-view-core';

function feedItem(overrides: Partial<FeedItem> = {}): FeedItem {
  return {
    id: 'post:p1',
    kind: 'post',
    communityId: 'c1',
    communityName: 'Book club',
    channelId: 'general',
    channelName: 'general',
    authorDeviceId: 'devA',
    title: 'Road trip packing list',
    body: 'What should we bring?',
    reason: 'A community post from #general.',
    quickActionLabel: 'Open thread',
    audienceRule: createCommunityAudienceRule('c1'),
    sortAt: { wall: '2026-07-03T12:00:00.000Z', counter: 0 },
    rankScore: 300,
    postId: 'p1',
    replyCount: 3,
    reactions: [],
    media: null,
    ...overrides,
  };
}

const NOW = new Date('2026-07-03T12:00:00.000Z').getTime();

describe('feedAvatarInitial', () => {
  it('uppercases the first letter', () => {
    expect(feedAvatarInitial('peer')).toBe('P');
    expect(feedAvatarInitial('  åsa')).toBe('Å');
  });
  it('skips leading punctuation and falls back to ?', () => {
    expect(feedAvatarInitial('  ...!')).toBe('?');
    expect(feedAvatarInitial('')).toBe('?');
    expect(feedAvatarInitial('7-day plan')).toBe('7');
  });
});

describe('formatFeedTime', () => {
  it('renders now / minutes / hours / days and a stable date past a week', () => {
    expect(formatFeedTime('2026-07-03T11:59:30.000Z', NOW)).toBe('now');
    expect(formatFeedTime('2026-07-03T11:45:00.000Z', NOW)).toBe('15m');
    expect(formatFeedTime('2026-07-03T09:00:00.000Z', NOW)).toBe('3h');
    expect(formatFeedTime('2026-07-01T12:00:00.000Z', NOW)).toBe('2d');
    expect(formatFeedTime('2026-06-01T12:00:00.000Z', NOW)).toBe('2026-06-01');
  });
  it('treats a future timestamp as now and echoes an unparseable value', () => {
    expect(formatFeedTime('2026-07-03T12:05:00.000Z', NOW)).toBe('now');
    expect(formatFeedTime('not-a-date', NOW)).toBe('not-a-date');
  });
});

describe('feedContext', () => {
  it('uses community + channel for community items', () => {
    expect(feedContext(feedItem())).toEqual({ community: 'Book club', channel: 'general' });
  });
  it('drops the channel for public items', () => {
    const item = feedItem({
      kind: 'public',
      communityName: 'Trail Cooks',
      channelName: '',
      audienceRule: createAudienceRule({ type: 'public' }),
    });
    expect(feedContext(item)).toEqual({ community: 'Trail Cooks', channel: null });
  });
});

describe('feedHeart + feedEngagement', () => {
  const heartGroup: MessageReactionGroup = { emoji: HEART_EMOJI, count: 2, mine: true, myEventId: 'r1' };

  it('reads the heart summary from the verified read model only', () => {
    expect(feedHeart(feedItem({ reactions: [heartGroup] }))).toEqual({ count: 2, mine: true });
    expect(feedHeart(feedItem({ reactions: [] }))).toEqual({ count: 0, mine: false });
    // A non-heart reaction never inflates the heart count.
    expect(feedHeart(feedItem({ reactions: [{ emoji: '👍', count: 5, mine: false, myEventId: null }] })))
      .toEqual({ count: 0, mine: false });
  });

  it('shows replies + heart on post roots, never Share', () => {
    const eng = feedEngagement(feedItem({ replyCount: 3, reactions: [heartGroup] }));
    expect(eng).toMatchObject({
      hasAny: true,
      showReplies: true,
      replyCount: 3,
      showHeart: true,
      showShare: false,
    });
    expect(eng.heart).toEqual({ count: 2, mine: true });
  });

  it('shows Share only on public items and no reply/heart', () => {
    const eng = feedEngagement(feedItem({
      kind: 'public',
      postId: undefined,
      replyCount: undefined,
      reactions: undefined,
    }));
    expect(eng).toMatchObject({ hasAny: true, showShare: true, showReplies: false, showHeart: false });
  });

  it('renders no engagement row for file / mention / unread', () => {
    for (const kind of ['file', 'mention', 'unread'] as const) {
      const eng = feedEngagement(feedItem({ kind, postId: undefined, replyCount: undefined, reactions: undefined }));
      expect(eng.hasAny).toBe(false);
    }
  });
});

describe('buildPublicShareMessage', () => {
  it('joins title, description and a real reachable host url', () => {
    const item = feedItem({
      kind: 'public',
      title: 'Trail Cooks',
      body: 'Open fire recipes',
      public: {
        publication_id: 'pub-1',
        kind: 'community',
        title: 'Trail Cooks',
        description: 'Open fire recipes',
        category: 'hobbies',
        owner_device_id: 'owner',
        content_id: 'content-1',
        public_key_hex: 'ab'.repeat(16),
        host_urls: JSON.stringify(['https://host.example', 'not-a-url']),
        announcing_hosts: 3,
        event_count: 0,
        latest_wall: '2026-07-03T10:00:00.000Z',
        source_host: 'wss://dir.example',
        fetched_at: '2026-07-03T10:05:00.000Z',
        verified: true,
      },
    });
    expect(buildPublicShareMessage(item)).toBe('Trail Cooks\n\nOpen fire recipes\n\nhttps://host.example');
  });

  it('omits the host line when host_urls is malformed', () => {
    const item = feedItem({
      kind: 'public',
      title: 'T',
      body: 'D',
      public: {
        publication_id: 'p', kind: 'community', title: 'T', description: 'D', category: 'x',
        owner_device_id: 'o', content_id: 'c', public_key_hex: 'ab',
        host_urls: 'not json', announcing_hosts: 1, event_count: 0,
        latest_wall: '2026-07-03T10:00:00.000Z', source_host: 's', fetched_at: 'f', verified: true,
      },
    });
    expect(buildPublicShareMessage(item)).toBe('T\n\nD');
  });
});

describe('toFeedCardView', () => {
  it('composes the display model from an evaluated item', () => {
    const view = toFeedCardView(
      feedItem({ media: { blobHash: 'a'.repeat(128), mimeType: 'image/jpeg' } }),
      { authorName: 'Peer', nowMs: NOW },
    );
    expect(view).toMatchObject({
      kind: 'post',
      authorName: 'Peer',
      initial: 'P',
      community: 'Book club',
      channel: 'general',
      time: 'now',
      title: 'Road trip packing list',
    });
    expect(view.media?.mimeType).toBe('image/jpeg');
    expect(view.engagement.showReplies).toBe(true);
  });
});

describe('kind maps', () => {
  it('maps every kind to a label and a controlling source toggle', () => {
    for (const kind of ['mention', 'reply', 'unread', 'post', 'file', 'public'] as const) {
      expect(FEED_KIND_LABEL[kind]).toBeTruthy();
      expect(FEED_KIND_CONTROL[kind]).toBeTruthy();
    }
    expect(FEED_KIND_CONTROL.public).toBe('public');
    expect(FEED_KIND_CONTROL.file).toBe('files');
    expect(FEED_KIND_CONTROL.mention).toBe('messages');
  });
});

describe('findPostRootEventId', () => {
  let db: InMemoryTestDatabase;
  beforeEach(() => {
    db = createInMemoryTestDatabase();
    ensureCommunityTables(db.adapter);
  });
  afterEach(() => db.close());

  it('returns the signed root event id for a post', () => {
    const self = generateDeviceIdentity('Me');
    const root = createChannelPostEvent(self, {
      communityId: 'c1',
      channelId: 'general',
      body: 'Road trip packing list',
      hlc: { wall: '2026-07-03T10:00:00.000Z', counter: 0 },
    });
    insertMessageRow(db.adapter, root);
    const postId = root.postId ?? '';
    expect(findPostRootEventId(db.adapter, 'c1', 'general', postId)).toBe(root.id);
    expect(findPostRootEventId(db.adapter, 'c1', 'general', 'missing')).toBeNull();
  });
});

describe('toFeedCardView linkPreview mapping (Plan 32 T5.1)', () => {
  it('surfaces the post root link-preview reference and defaults to null', () => {
    const withPreview = toFeedCardView(
      feedItem({ linkPreview: { blobHash: 'a'.repeat(128), mimeType: 'application/x-meerkat-link-preview+json' } }),
      { authorName: 'Peer', nowMs: NOW },
    );
    expect(withPreview.linkPreview).toEqual({
      blobHash: 'a'.repeat(128),
      mimeType: 'application/x-meerkat-link-preview+json',
    });
    // A post with no link-preview attachment maps to null (no card renders).
    expect(toFeedCardView(feedItem(), { authorName: 'Peer', nowMs: NOW }).linkPreview).toBeNull();
  });
});

describe('nextRenderWindow (Plan 32 T5.1 perf)', () => {
  it('grows by the step until it covers the list, then stays put', () => {
    expect(nextRenderWindow(20, 100, 20)).toBe(40);
    expect(nextRenderWindow(40, 100, 20)).toBe(60);
    // Overshoot past total is harmless (the slice caps at the real length).
    expect(nextRenderWindow(20, 25, 20)).toBe(40);
    // Already covers the whole list: no growth.
    expect(nextRenderWindow(100, 100, 20)).toBe(100);
    expect(nextRenderWindow(120, 100, 20)).toBe(120);
  });
});

describe('createKeyedMemo (Plan 32 T5.1 avatar memo)', () => {
  it('computes once per key+version and returns the same reference on repeat', () => {
    const memo = createKeyedMemo<{ uri: string }>();
    let calls = 0;
    const compute = () => {
      calls += 1;
      return { uri: 'data:image/jpeg;base64,AAAA' };
    };
    const first = memo.get('c1:devA', 1, compute);
    const second = memo.get('c1:devA', 1, compute);
    expect(calls).toBe(1); // repeated same key+version: no re-decode
    expect(second).toBe(first); // same reference (no per-frame re-decode)
  });

  it('recomputes when the version advances and isolates distinct keys', () => {
    const memo = createKeyedMemo<number>();
    let calls = 0;
    const compute = () => (calls += 1);
    memo.get('devA', 1, compute); // calls -> 1
    memo.get('devA', 2, compute); // version bump -> recompute -> 2
    memo.get('devB', 1, compute); // new key -> compute -> 3
    memo.get('devB', 1, compute); // cached
    expect(calls).toBe(3);
  });
});

describe('decideFeedThrottle (Plan 32 T5.1 reaction re-eval)', () => {
  const base = { appliedRevision: 5, lastAppliedAt: 1_000, minIntervalMs: FEED_REEVAL_MIN_INTERVAL_MS };

  it('is a no-op when the feed already reflects the latest revision', () => {
    expect(decideFeedThrottle({ ...base, latestRevision: 5, now: 5_000 })).toEqual({ action: 'noop' });
  });

  it('applies immediately on the leading edge when the last apply is old enough', () => {
    expect(
      decideFeedThrottle({ ...base, latestRevision: 6, now: 1_000 + FEED_REEVAL_MIN_INTERVAL_MS }),
    ).toEqual({ action: 'apply' });
  });

  it('schedules a single trailing apply during a burst (never drops the change)', () => {
    const decision = decideFeedThrottle({ ...base, latestRevision: 6, now: 1_050 });
    expect(decision).toEqual({ action: 'schedule', delayMs: FEED_REEVAL_MIN_INTERVAL_MS - 50 });
  });
});
