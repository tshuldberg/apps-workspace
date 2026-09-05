import type { DatabaseAdapter } from '@mylife/db';
import {
  DEFAULT_SOCIAL_PRIVACY,
  FEED_PAGE_SIZE,
  applyPrivacyFilter,
  buildWorkoutSummary,
  enrichPost,
  getWorkoutSessions,
  getWorkouts,
  getWorkoutCategoryColor,
  isPostVisible,
  normalizePrivacySettings,
  paginateFeed,
  sortFeedChronological,
  type SocialPost,
  type SocialPostEnriched,
  type SocialPrivacySettings,
  type SocialUserProfile,
  type WorkoutDefinition,
  type WorkoutSession,
  type WorkoutSummaryCard,
} from '@mylife/workouts';

export const LOCAL_SOCIAL_PROFILE_ID = 'local-athlete';
export const DEFAULT_SOCIAL_PROFILE_ID = 'marcus-chen';
export const WORKOUT_SOCIAL_PAGE_BATCH = Math.min(FEED_PAGE_SIZE, 6);

export type WorkoutSocialSegment = 'for-you' | 'following' | 'trending';
export type WorkoutSocialReactionKey = 'fire' | 'muscle' | 'clap';
export type WorkoutSocialPrivacyLevel = 'public' | 'friends' | 'private';

export interface WorkoutSocialCommentPreview {
  id: string;
  authorName: string;
  body: string;
}

export interface WorkoutSocialProfile extends SocialUserProfile {
  bio: string;
  privacySettings: Partial<SocialPrivacySettings>;
}

export interface WorkoutSocialFeedItem extends SocialPostEnriched {
  comments: WorkoutSocialCommentPreview[];
  focusLabel: string;
  focusAccent: string;
  privacyLevel: WorkoutSocialPrivacyLevel;
  privacyLabel: string;
  privacyAccent: string;
  privacyIcon: string;
  segmentHints: WorkoutSocialSegment[];
  coverVariant: 'metric' | 'hero' | 'recovery';
  coverValue: string;
  coverUnit: string;
  coverCaption: string;
  caption: string;
  hasNewPr: boolean;
  profile: WorkoutSocialProfile;
  reactionCounts: Record<WorkoutSocialReactionKey, number>;
}

export interface WorkoutSocialSnapshot {
  composerSessionId: string | null;
  feed: WorkoutSocialFeedItem[];
  profiles: Record<string, WorkoutSocialProfile>;
}

interface FixtureProfileInput {
  userId: string;
  displayName: string;
  bio: string;
  memberSince: string;
  totalWorkouts: number;
  currentStreak: number;
  followerCount: number;
  followingCount: number;
  isFollowedByMe: boolean;
  privacySettings?: Partial<SocialPrivacySettings>;
}

interface FixturePostInput {
  id: string;
  userId: string;
  createdAt: string;
  privacyLevel: WorkoutSocialPrivacyLevel;
  focusLabel: string;
  coverVariant: WorkoutSocialFeedItem['coverVariant'];
  coverValue: string;
  coverUnit: string;
  coverCaption: string;
  caption: string;
  content: WorkoutSummaryCard;
  comments: WorkoutSocialCommentPreview[];
  reactionCounts: Record<WorkoutSocialReactionKey, number>;
}

const LOCAL_PROFILE: WorkoutSocialProfile = {
  userId: LOCAL_SOCIAL_PROFILE_ID,
  displayName: 'You',
  avatarUrl: null,
  memberSince: '2024-01-01T08:00:00.000Z',
  totalWorkouts: 0,
  currentStreak: 0,
  followerCount: 48,
  followingCount: 17,
  isFollowedByMe: false,
  bio: 'Building a sharper training rhythm, one clean session at a time.',
  privacySettings: DEFAULT_SOCIAL_PRIVACY,
};

const FIXTURE_PROFILES: WorkoutSocialProfile[] = [
  {
    userId: 'marcus-chen',
    displayName: 'Marcus Chen',
    avatarUrl: null,
    memberSince: '2023-09-08T08:00:00.000Z',
    totalWorkouts: 184,
    currentStreak: 16,
    followerCount: 1240,
    followingCount: 214,
    isFollowedByMe: true,
    bio: 'Powerlifting coach dialing in triples, tempo work, and brutally honest recovery days.',
    privacySettings: DEFAULT_SOCIAL_PRIVACY,
  },
  {
    userId: 'sarah-miller',
    displayName: 'Sarah J. Miller',
    avatarUrl: null,
    memberSince: '2024-02-11T08:00:00.000Z',
    totalWorkouts: 128,
    currentStreak: 9,
    followerCount: 684,
    followingCount: 91,
    isFollowedByMe: false,
    bio: 'Trail runner. Endurance block loyalist. Sunset miles over everything.',
    privacySettings: {
      ...DEFAULT_SOCIAL_PRIVACY,
      shareWeightDetails: false,
      sharePrs: false,
      profileVisible: false,
    },
  },
  {
    userId: 'elena-rodriguez',
    displayName: 'Elena Rodriguez',
    avatarUrl: null,
    memberSince: '2024-05-20T08:00:00.000Z',
    totalWorkouts: 212,
    currentStreak: 21,
    followerCount: 932,
    followingCount: 136,
    isFollowedByMe: true,
    bio: 'HIIT coach mixing pace work, circuit blocks, and deliberate off-days.',
    privacySettings: {
      ...DEFAULT_SOCIAL_PRIVACY,
      shareWeightDetails: false,
    },
  },
  {
    userId: 'micah-lee',
    displayName: 'Micah Lee',
    avatarUrl: null,
    memberSince: '2025-01-03T08:00:00.000Z',
    totalWorkouts: 72,
    currentStreak: 5,
    followerCount: 188,
    followingCount: 64,
    isFollowedByMe: true,
    bio: 'Mobility-first athlete working on longevity, posture, and steady strength.',
    privacySettings: DEFAULT_SOCIAL_PRIVACY,
  },
];

function buildFixtureProfile(input: FixtureProfileInput): WorkoutSocialProfile {
  return {
    ...input,
    avatarUrl: null,
    privacySettings: input.privacySettings ?? DEFAULT_SOCIAL_PRIVACY,
  };
}

function buildPrivacySettings(level: WorkoutSocialPrivacyLevel): Partial<SocialPrivacySettings> {
  if (level === 'private') {
    return {
      ...DEFAULT_SOCIAL_PRIVACY,
      shareExercises: false,
      shareWeightDetails: false,
      sharePrs: false,
      profileVisible: false,
    };
  }

  if (level === 'friends') {
    return {
      ...DEFAULT_SOCIAL_PRIVACY,
      shareWeightDetails: false,
    };
  }

  return DEFAULT_SOCIAL_PRIVACY;
}

export function getPrivacyPresentation(
  settings: Partial<SocialPrivacySettings>,
): Pick<WorkoutSocialFeedItem, 'privacyLevel' | 'privacyLabel' | 'privacyAccent' | 'privacyIcon'> {
  const normalized = normalizePrivacySettings(settings);

  if (!normalized.profileVisible) {
    return {
      privacyLevel: 'private',
      privacyLabel: 'Private',
      privacyAccent: '#EF4444',
      privacyIcon: 'lock',
    };
  }

  if (!normalized.shareWeightDetails) {
    return {
      privacyLevel: 'friends',
      privacyLabel: 'Friends',
      privacyAccent: '#30D158',
      privacyIcon: 'groups',
    };
  }

  return {
    privacyLevel: 'public',
    privacyLabel: 'Public',
    privacyAccent: '#8BCFF0',
    privacyIcon: 'public',
  };
}

function getProfileMap(): Record<string, WorkoutSocialProfile> {
  return [LOCAL_PROFILE, ...FIXTURE_PROFILES].reduce<Record<string, WorkoutSocialProfile>>(
    (accumulator, profile) => {
      accumulator[profile.userId] = {
        ...profile,
        privacySettings: { ...profile.privacySettings },
      };
      return accumulator;
    },
    {},
  );
}

function toRelativeIso(hoursAgo: number): string {
  return new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString();
}

function formatTitleFromWorkout(workout: WorkoutDefinition | null | undefined): string {
  const value = workout?.title?.trim();
  return value && value.length > 0 ? value : 'Workout';
}

function buildFallbackSummary(
  session: WorkoutSession,
  workoutTitle: string,
): WorkoutSummaryCard {
  const completedExercises = session.exercisesCompleted.filter((exercise) => !exercise.skipped);
  const durationMinutes =
    session.completedAt == null
      ? 0
      : Math.max(
          0,
          Math.round(
            (Date.parse(session.completedAt) - Date.parse(session.startedAt)) / 60000,
          ),
        );

  const totalSets = completedExercises.reduce(
    (sum, exercise) => sum + Math.max(0, exercise.setsCompleted ?? 0),
    0,
  );
  const totalReps = completedExercises.reduce(
    (sum, exercise) => sum + Math.max(0, exercise.repsCompleted ?? 0),
    0,
  );

  return {
    sessionId: session.id,
    title: workoutTitle,
    date: session.completedAt ?? session.startedAt,
    durationMinutes,
    exerciseCount: completedExercises.length,
    totalSets,
    totalReps,
    totalVolume: totalReps * 10,
    prsHit: [],
    muscleGroups: [],
  };
}

function safeGetCompletedSessions(db: DatabaseAdapter): WorkoutSession[] {
  try {
    return getWorkoutSessions(db, { onlyCompleted: true, limit: 36 });
  } catch {
    return [];
  }
}

function safeGetWorkouts(db: DatabaseAdapter): WorkoutDefinition[] {
  try {
    return getWorkouts(db, { limit: 60 });
  } catch {
    return [];
  }
}

function safeBuildSummary(
  db: DatabaseAdapter,
  session: WorkoutSession,
  workoutTitle: string,
): WorkoutSummaryCard {
  try {
    return buildWorkoutSummary(db, session.id) ?? buildFallbackSummary(session, workoutTitle);
  } catch {
    return buildFallbackSummary(session, workoutTitle);
  }
}

function getFocusMeta(
  workout: WorkoutDefinition | null | undefined,
  card: WorkoutSummaryCard,
): Pick<WorkoutSocialFeedItem, 'focusLabel' | 'focusAccent'> {
  const category = workout?.exercises[0]?.category ?? null;
  if (category) {
    return {
      focusLabel: category.replace('_', ' ').replace(/\b\w/g, (value) => value.toUpperCase()),
      focusAccent: getWorkoutCategoryColor(category),
    };
  }

  if (card.durationMinutes >= 40) {
    return {
      focusLabel: 'Endurance',
      focusAccent: getWorkoutCategoryColor('cardio'),
    };
  }

  if (card.prsHit.length > 0) {
    return {
      focusLabel: 'Strength',
      focusAccent: getWorkoutCategoryColor('strength'),
    };
  }

  return {
    focusLabel: 'Hypertrophy',
    focusAccent: getWorkoutCategoryColor('hypertrophy'),
  };
}

function buildLocalComments(card: WorkoutSummaryCard): WorkoutSocialCommentPreview[] {
  const focusLine =
    card.prsHit.length > 0
      ? 'Huge PR energy on this one.'
      : card.totalVolume > 0
        ? `Volume climbed to ${formatCompact(card.totalVolume)} lbs.`
        : 'Clean session. Strong consistency.';

  return [
    {
      id: `${card.sessionId}-comment-1`,
      authorName: 'Marcus Chen',
      body: focusLine,
    },
    {
      id: `${card.sessionId}-comment-2`,
      authorName: 'Elena Rodriguez',
      body: 'The pacing on these sets looks locked in.',
    },
  ];
}

function buildLocalFeedItems(
  db: DatabaseAdapter,
  profiles: Record<string, WorkoutSocialProfile>,
): WorkoutSocialFeedItem[] {
  const sessions = safeGetCompletedSessions(db);
  const workouts = safeGetWorkouts(db);
  const workoutMap = new Map(workouts.map((workout) => [workout.id, workout]));
  const localProfile = profiles[LOCAL_SOCIAL_PROFILE_ID] ?? LOCAL_PROFILE;

  if (sessions.length === 0) {
    return [];
  }

  localProfile.totalWorkouts = sessions.length;
  localProfile.currentStreak = Math.min(14, sessions.length);

  return sessions.map((session, index) => {
    const workout = workoutMap.get(session.workoutId);
    const summary = safeBuildSummary(db, session, formatTitleFromWorkout(workout));
    const privacySettings =
      index % 3 === 0 ? DEFAULT_SOCIAL_PRIVACY : buildPrivacySettings('friends');
    const filteredCard = applyPrivacyFilter(summary, privacySettings);
    const focus = getFocusMeta(workout, summary);
    const reactions = {
      fire: 18 + index * 3,
      muscle: 9 + index * 2,
      clap: 4 + index,
    };
    const enriched = enrichPost(
      {
        id: `local-${session.id}`,
        userId: LOCAL_SOCIAL_PROFILE_ID,
        sessionId: session.id,
        content: filteredCard,
        privacySettings,
        createdAt: session.completedAt ?? session.startedAt,
      },
      reactions.fire + reactions.muscle + reactions.clap,
      2 + (index % 3),
      false,
      localProfile.displayName,
      localProfile.avatarUrl,
    );
    const privacy = getPrivacyPresentation(privacySettings);

    return {
      ...enriched,
      comments: buildLocalComments(summary),
      focusLabel: focus.focusLabel,
      focusAccent: focus.focusAccent,
      privacyLevel: privacy.privacyLevel,
      privacyLabel: privacy.privacyLabel,
      privacyAccent: privacy.privacyAccent,
      privacyIcon: privacy.privacyIcon,
      segmentHints: ['for-you'],
      coverVariant: summary.prsHit.length > 0 ? 'metric' : 'hero',
      coverValue:
        summary.prsHit[0]?.estimated1rm != null && summary.prsHit[0]?.estimated1rm > 0
          ? String(summary.prsHit[0].estimated1rm)
          : String(Math.max(1, summary.exerciseCount)),
      coverUnit:
        summary.prsHit[0]?.estimated1rm != null && summary.prsHit[0]?.estimated1rm > 0
          ? 'lbs'
          : 'moves',
      coverCaption:
        summary.prsHit.length > 0
          ? summary.prsHit[0]?.exerciseName ?? 'Peak set'
          : `${summary.totalSets} sets completed`,
      caption:
        summary.prsHit.length > 0
          ? 'Logged a clean PR and kept the rest intervals tight.'
          : 'Session posted from your latest completed workout.',
      hasNewPr: summary.prsHit.length > 0,
      profile: localProfile,
      reactionCounts: reactions,
    };
  });
}

function buildFixturePosts(
  profiles: Record<string, WorkoutSocialProfile>,
): WorkoutSocialFeedItem[] {
  const fixtures: FixturePostInput[] = [
    {
      id: 'fixture-heavy-squat',
      userId: 'marcus-chen',
      createdAt: toRelativeIso(2),
      privacyLevel: 'public',
      focusLabel: 'Strength',
      coverVariant: 'metric',
      coverValue: '425',
      coverUnit: 'lbs',
      coverCaption: 'Top triple',
      caption: 'Peaked this block exactly how I wanted. Smooth descent, no panic on the ascent.',
      content: {
        sessionId: 'fixture-session-1',
        title: 'Heavy Squat Session',
        date: toRelativeIso(2),
        durationMinutes: 78,
        exerciseCount: 5,
        totalSets: 18,
        totalReps: 42,
        totalVolume: 12400,
        prsHit: [{ exerciseName: 'Back Squat', estimated1rm: 468 }],
        muscleGroups: ['quads', 'glutes', 'hamstrings'],
      },
      comments: [
        { id: 'fixture-heavy-squat-c1', authorName: 'You', body: 'That bar speed still looks fast.' },
        { id: 'fixture-heavy-squat-c2', authorName: 'Micah Lee', body: 'Crazy composure under load.' },
      ],
      reactionCounts: { fire: 242, muscle: 128, clap: 54 },
    },
    {
      id: 'fixture-sunset-run',
      userId: 'sarah-miller',
      createdAt: toRelativeIso(5),
      privacyLevel: 'private',
      focusLabel: 'Cardio',
      coverVariant: 'hero',
      coverValue: '12.4',
      coverUnit: 'km',
      coverCaption: '4:52 /km pace',
      caption: 'Sunset miles with a long steady climb and zero headphones.',
      content: {
        sessionId: 'fixture-session-2',
        title: 'Sunset Trail Run',
        date: toRelativeIso(5),
        durationMinutes: 61,
        exerciseCount: 1,
        totalSets: 0,
        totalReps: 0,
        totalVolume: 0,
        prsHit: [],
        muscleGroups: ['calves', 'glutes', 'core'],
      },
      comments: [
        { id: 'fixture-sunset-run-c1', authorName: 'Elena Rodriguez', body: 'That trail looks unreal.' },
        { id: 'fixture-sunset-run-c2', authorName: 'Marcus Chen', body: 'Strong pace control on the climb.' },
      ],
      reactionCounts: { fire: 76, muscle: 24, clap: 18 },
    },
    {
      id: 'fixture-full-body-burn',
      userId: 'elena-rodriguez',
      createdAt: toRelativeIso(8),
      privacyLevel: 'friends',
      focusLabel: 'Hypertrophy',
      coverVariant: 'metric',
      coverValue: '624',
      coverUnit: 'cal',
      coverCaption: '45 min circuit',
      caption: 'Pushed hard on the burpee ladder. Heart rate stayed in the red for over fifteen minutes.',
      content: {
        sessionId: 'fixture-session-3',
        title: 'Full Body Burn',
        date: toRelativeIso(8),
        durationMinutes: 45,
        exerciseCount: 6,
        totalSets: 21,
        totalReps: 126,
        totalVolume: 6840,
        prsHit: [],
        muscleGroups: ['shoulders', 'core', 'glutes'],
      },
      comments: [
        { id: 'fixture-full-body-burn-c1', authorName: 'You', body: 'This pacing is filthy.' },
        { id: 'fixture-full-body-burn-c2', authorName: 'Sarah J. Miller', body: 'Saving this for Friday.' },
      ],
      reactionCounts: { fire: 88, muscle: 42, clap: 19 },
    },
    {
      id: 'fixture-recovery-flow',
      userId: 'micah-lee',
      createdAt: toRelativeIso(11),
      privacyLevel: 'public',
      focusLabel: 'Recovery',
      coverVariant: 'recovery',
      coverValue: '92',
      coverUnit: '%',
      coverCaption: 'Readiness',
      caption: 'Swapped intensity for breath work and controlled tempo. Back feels much better today.',
      content: {
        sessionId: 'fixture-session-4',
        title: 'Recovery Flow',
        date: toRelativeIso(11),
        durationMinutes: 34,
        exerciseCount: 4,
        totalSets: 12,
        totalReps: 48,
        totalVolume: 1440,
        prsHit: [],
        muscleGroups: ['back', 'hip_flexors', 'core'],
      },
      comments: [
        { id: 'fixture-recovery-flow-c1', authorName: 'Marcus Chen', body: 'Smart pivot instead of forcing load.' },
        { id: 'fixture-recovery-flow-c2', authorName: 'You', body: 'Need more sessions like this.' },
      ],
      reactionCounts: { fire: 44, muscle: 20, clap: 17 },
    },
  ];

  return fixtures.map((fixture) => {
    const profile = profiles[fixture.userId] ?? buildFixtureProfile({
      userId: fixture.userId,
      displayName: fixture.userId,
      bio: '',
      memberSince: fixture.createdAt,
      totalWorkouts: 0,
      currentStreak: 0,
      followerCount: 0,
      followingCount: 0,
      isFollowedByMe: false,
    });
    const privacySettings = buildPrivacySettings(fixture.privacyLevel);
    const filteredCard = applyPrivacyFilter(fixture.content, privacySettings);
    const enriched = enrichPost(
      {
        id: fixture.id,
        userId: fixture.userId,
        sessionId: fixture.content.sessionId,
        content: filteredCard,
        privacySettings,
        createdAt: fixture.createdAt,
      },
      fixture.reactionCounts.fire + fixture.reactionCounts.muscle + fixture.reactionCounts.clap,
      fixture.comments.length,
      false,
      profile.displayName,
      profile.avatarUrl,
    );
    const privacy = getPrivacyPresentation(privacySettings);

    return {
      ...enriched,
      comments: fixture.comments,
      focusLabel: fixture.focusLabel,
      focusAccent: getWorkoutCategoryColor(fixture.focusLabel.toLowerCase()),
      privacyLevel: privacy.privacyLevel,
      privacyLabel: privacy.privacyLabel,
      privacyAccent: privacy.privacyAccent,
      privacyIcon: privacy.privacyIcon,
      segmentHints:
        fixture.privacyLevel === 'public'
          ? ['for-you', 'trending']
          : fixture.privacyLevel === 'friends'
            ? ['for-you', 'following']
            : ['for-you'],
      coverVariant: fixture.coverVariant,
      coverValue: fixture.coverValue,
      coverUnit: fixture.coverUnit,
      coverCaption: fixture.coverCaption,
      caption: fixture.caption,
      hasNewPr: fixture.content.prsHit.length > 0,
      profile,
      reactionCounts: fixture.reactionCounts,
    };
  });
}

function scoreTrendingPost(item: WorkoutSocialFeedItem): number {
  return (
    item.likeCount +
    item.commentCount * 6 +
    (item.hasNewPr ? 48 : 0) +
    Math.min(32, Math.round(item.content.totalVolume / 500))
  );
}

export function filterFeedItemsBySegment(
  items: WorkoutSocialFeedItem[],
  segment: WorkoutSocialSegment,
): WorkoutSocialFeedItem[] {
  if (segment === 'following') {
    return items.filter((item) => item.profile.isFollowedByMe);
  }

  if (segment === 'trending') {
    return [...items].sort((left, right) => scoreTrendingPost(right) - scoreTrendingPost(left));
  }

  return items;
}

export function paginateSocialFeed(
  items: WorkoutSocialFeedItem[],
  page: number,
): WorkoutSocialFeedItem[] {
  return paginateFeed(
    items as SocialPost[],
    0,
    (page + 1) * WORKOUT_SOCIAL_PAGE_BATCH,
  ) as WorkoutSocialFeedItem[];
}

export function getSocialProfile(
  snapshot: WorkoutSocialSnapshot,
  userId?: string | null,
): WorkoutSocialProfile {
  if (userId && snapshot.profiles[userId]) {
    return snapshot.profiles[userId];
  }

  return (
    snapshot.profiles[DEFAULT_SOCIAL_PROFILE_ID] ??
    snapshot.profiles[LOCAL_SOCIAL_PROFILE_ID] ??
    LOCAL_PROFILE
  );
}

export function getProfileFeedItems(
  snapshot: WorkoutSocialSnapshot,
  userId: string,
): WorkoutSocialFeedItem[] {
  return snapshot.feed.filter((item) => item.userId === userId);
}

export function formatSocialRelativeTime(value: string): string {
  const diffMs = Date.now() - Date.parse(value);
  if (!Number.isFinite(diffMs) || diffMs <= 0) return 'Just now';

  const diffMinutes = Math.round(diffMs / 60000);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.round(diffHours / 24);
  return `${diffDays}d ago`;
}

export function buildWorkoutSocialSnapshot(
  db: DatabaseAdapter,
): WorkoutSocialSnapshot {
  const profiles = getProfileMap();
  const localItems = buildLocalFeedItems(db, profiles);
  const fixtureItems = buildFixturePosts(profiles);
  const visibleFeed = [...localItems, ...fixtureItems].filter((item) =>
    isPostVisible(item.content),
  );

  return {
    composerSessionId: localItems[0]?.sessionId ?? null,
    feed: sortFeedChronological(visibleFeed as SocialPost[]) as WorkoutSocialFeedItem[],
    profiles,
  };
}

function formatCompact(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '0';
  if (value >= 1000) {
    return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k`;
  }
  return String(Math.round(value));
}
