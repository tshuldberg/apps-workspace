import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildActivityFeedPage,
  getActivityGroupLabel,
  markActivityReadInList,
  markAllActivityReadInList,
} from '../activity/logic';
import type { ForumActivity } from '../models/activity';

const NOW = new Date('2026-04-06T18:00:00.000Z');

const SAMPLE_ITEMS: ForumActivity[] = [
  {
    id: 'activity-1',
    profileId: 'profile-1',
    actorProfileId: 'actor-1',
    actorName: 'Maya Chen',
    actorTrustTier: 'trusted',
    type: 'mention',
    verb: 'mentioned you in',
    context: 'Design Club weekly critique',
    detail: 'Called out your note about feed pacing.',
    targetType: 'thread',
    targetId: 'thread-1',
    communityId: 'community-1',
    threadId: 'thread-1',
    conversationId: null,
    targetProfileId: null,
    createdAt: '2026-04-06T15:00:00.000Z',
    readAt: null,
  },
  {
    id: 'activity-2',
    profileId: 'profile-1',
    actorProfileId: 'actor-2',
    actorName: 'Leo Park',
    actorTrustTier: 'highly_trusted',
    type: 'reply',
    verb: 'replied to',
    context: 'Offline caching pitfalls',
    detail: 'Added a note about conflict resolution.',
    targetType: 'thread',
    targetId: 'thread-2',
    communityId: 'community-2',
    threadId: 'thread-2',
    conversationId: null,
    targetProfileId: null,
    createdAt: '2026-04-05T12:00:00.000Z',
    readAt: null,
  },
  {
    id: 'activity-3',
    profileId: 'profile-1',
    actorProfileId: 'actor-3',
    actorName: 'Nina Alvarez',
    actorTrustTier: 'mod',
    type: 'invite',
    verb: 'invited you to',
    context: 'Moderation roundtable',
    detail: 'Review the humans-only onboarding checklist.',
    targetType: 'community',
    targetId: 'community-3',
    communityId: 'community-3',
    threadId: null,
    conversationId: null,
    targetProfileId: null,
    createdAt: '2026-04-02T18:00:00.000Z',
    readAt: '2026-04-03T08:00:00.000Z',
  },
];

describe('forums activity helpers', () => {
  beforeEach(() => {
    // Pin "now" so the relative-date grouping (Today/Yesterday/This Week)
    // matches the SAMPLE_ITEMS dates regardless of when the suite runs.
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('builds grouped activity pages with unread counts', () => {
    const page = buildActivityFeedPage(SAMPLE_ITEMS, 'all', 0, 24);

    expect(page.unreadCounts.all).toBe(2);
    expect(page.unreadCounts.mentions).toBe(1);
    expect(page.unreadCounts.replies).toBe(1);
    expect(page.unreadCounts.invites).toBe(0);
    expect(page.groups.map((group) => group.label)).toEqual([
      'Today',
      'Yesterday',
      'This Week',
    ]);
  });

  it('marks one row as read without touching other items', () => {
    const updated = markActivityReadInList(SAMPLE_ITEMS, 'activity-1', '2026-04-06T18:30:00.000Z');

    expect(updated[0].readAt).toBe('2026-04-06T18:30:00.000Z');
    expect(updated[1].readAt).toBeNull();
  });

  it('marks only the filtered unread items as read', () => {
    const updated = markAllActivityReadInList(
      SAMPLE_ITEMS,
      'mentions',
      '2026-04-06T18:30:00.000Z',
    );

    expect(updated[0].readAt).toBe('2026-04-06T18:30:00.000Z');
    expect(updated[1].readAt).toBeNull();
    expect(updated[2].readAt).toBe('2026-04-03T08:00:00.000Z');
  });

  it('maps dates into the expected time buckets', () => {
    expect(getActivityGroupLabel('2026-04-06T08:00:00.000Z', NOW)).toBe('Today');
    expect(getActivityGroupLabel('2026-04-05T08:00:00.000Z', NOW)).toBe('Yesterday');
    expect(getActivityGroupLabel('2026-04-03T08:00:00.000Z', NOW)).toBe('This Week');
    expect(getActivityGroupLabel('2026-03-20T08:00:00.000Z', NOW)).toBe('Earlier');
  });
});
