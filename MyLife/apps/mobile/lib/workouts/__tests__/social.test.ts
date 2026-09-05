import { describe, expect, it } from 'vitest';
import {
  filterFeedItemsBySegment,
  getPrivacyPresentation,
  paginateSocialFeed,
  type WorkoutSocialFeedItem,
  type WorkoutSocialProfile,
} from '../social';

const baseProfile: WorkoutSocialProfile = {
  userId: 'coach-1',
  displayName: 'Coach One',
  avatarUrl: null,
  memberSince: '2026-01-01T00:00:00.000Z',
  totalWorkouts: 120,
  currentStreak: 8,
  followerCount: 320,
  followingCount: 40,
  isFollowedByMe: true,
  bio: 'Testing profile',
  privacySettings: {},
};

function makeItem(
  id: string,
  overrides: Partial<WorkoutSocialFeedItem> = {},
): WorkoutSocialFeedItem {
  return {
    id,
    userId: baseProfile.userId,
    sessionId: `session-${id}`,
    content: {
      sessionId: `session-${id}`,
      title: `Workout ${id}`,
      date: '2026-04-06T10:00:00.000Z',
      durationMinutes: 45,
      exerciseCount: 5,
      totalSets: 15,
      totalReps: 60,
      totalVolume: 5000,
      prsHit: [],
      muscleGroups: ['chest'],
    },
    privacySettings: {},
    createdAt: `2026-04-${String(10 + Number(id.replace(/\D/g, '') || '0')).padStart(2, '0')}T10:00:00.000Z`,
    likeCount: 12,
    commentCount: 2,
    isLikedByMe: false,
    authorName: baseProfile.displayName,
    authorAvatarUrl: null,
    comments: [],
    focusLabel: 'Strength',
    focusAccent: '#FFB877',
    privacyLevel: 'public',
    privacyLabel: 'Public',
    privacyAccent: '#8BCFF0',
    privacyIcon: 'public',
    segmentHints: ['for-you'],
    coverVariant: 'metric',
    coverValue: '225',
    coverUnit: 'lbs',
    coverCaption: 'Top set',
    caption: 'Testing feed item',
    hasNewPr: false,
    profile: baseProfile,
    reactionCounts: {
      fire: 8,
      muscle: 3,
      clap: 1,
    },
    ...overrides,
  };
}

describe('workout social helpers', () => {
  it('filters following posts from followed profiles only', () => {
    const followed = makeItem('1');
    const notFollowed = makeItem('2', {
      userId: 'coach-2',
      authorName: 'Coach Two',
      profile: {
        ...baseProfile,
        userId: 'coach-2',
        displayName: 'Coach Two',
        isFollowedByMe: false,
      },
    });

    const result = filterFeedItemsBySegment([followed, notFollowed], 'following');

    expect(result).toHaveLength(1);
    expect(result[0]?.userId).toBe('coach-1');
  });

  it('sorts trending posts by engagement and PR weight', () => {
    const quiet = makeItem('1', { likeCount: 10, commentCount: 1 });
    const loud = makeItem('2', { likeCount: 30, commentCount: 8, hasNewPr: true });

    const result = filterFeedItemsBySegment([quiet, loud], 'trending');

    expect(result[0]?.id).toBe('2');
  });

  it('paginates feed items in six-card batches', () => {
    const items = Array.from({ length: 9 }, (_, index) => makeItem(String(index + 1)));

    expect(paginateSocialFeed(items, 0)).toHaveLength(6);
    expect(paginateSocialFeed(items, 1)).toHaveLength(9);
  });

  it('marks hidden profiles as private', () => {
    expect(
      getPrivacyPresentation({
        profileVisible: false,
      }),
    ).toMatchObject({
      privacyLevel: 'private',
      privacyLabel: 'Private',
    });
  });
});
