/**
 * @mylife/social -- Shareable card data generation.
 *
 * Generates structured data for shareable cards that can be rendered
 * as images (for social media, iMessage, etc.) by the UI layer.
 *
 * This module produces the DATA for cards, not the visual rendering.
 * The UI layer (@mylife/ui or app-specific components) handles rendering.
 */

import type { ModuleId } from '@mylife/module-registry';
import type {
  Activity,
  Challenge,
  SocialProfile,
} from './types';

/** Data structure for a share card (without DB-generated fields). */
export interface ShareCardData {
  type: 'activity' | 'challenge_complete' | 'streak' | 'year_in_review' | 'profile' | 'forum_thread' | 'market_listing' | 'manhattan_plan';
  profileId: string;
  moduleId: ModuleId | null;
  headline: string;
  subtext: string | null;
  statValue: string | null;
  statLabel: string | null;
  data: Record<string, unknown>;
}

// ── Card Generators ───────────────────────────────────────────────────

/** Generate a share card for a completed activity. */
export function generateActivityCard(
  activity: Activity,
  profile: SocialProfile,
): ShareCardData {
  return {
    type: 'activity',
    profileId: profile.id,
    moduleId: activity.moduleId,
    headline: activity.title,
    subtext: activity.description,
    statValue: formatKudosCount(activity.kudosCount),
    statLabel: activity.kudosCount === 1 ? 'kudos' : 'kudos',
    data: {
      activityId: activity.id,
      activityType: activity.type,
      metadata: activity.metadata,
      handle: profile.handle,
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
    },
  };
}

/** Generate a share card for completing a challenge. */
export function generateChallengeCompleteCard(
  challenge: Challenge,
  profile: SocialProfile,
): ShareCardData {
  const goalSummary = challenge.goals
    .map((g) => `${g.targetCount} ${g.unit}`)
    .join(' + ');

  return {
    type: 'challenge_complete',
    profileId: profile.id,
    moduleId: null,
    headline: `Completed: ${challenge.title}`,
    subtext: goalSummary,
    statValue: String(challenge.goals.length),
    statLabel: challenge.goals.length === 1 ? 'goal crushed' : 'goals crushed',
    data: {
      challengeId: challenge.id,
      challengeTitle: challenge.title,
      goals: challenge.goals,
      handle: profile.handle,
      displayName: profile.displayName,
    },
  };
}

/** Generate a share card for a streak milestone. */
export function generateStreakCard(
  moduleId: ModuleId,
  streakDays: number,
  streakLabel: string,
  profile: SocialProfile,
): ShareCardData {
  return {
    type: 'streak',
    profileId: profile.id,
    moduleId,
    headline: `${streakDays}-Day Streak`,
    subtext: streakLabel,
    statValue: String(streakDays),
    statLabel: 'days',
    data: {
      moduleId,
      streakDays,
      streakLabel,
      handle: profile.handle,
      displayName: profile.displayName,
    },
  };
}

/** Generate a year-in-review share card. */
export function generateYearInReviewCard(
  year: number,
  profile: SocialProfile,
  stats: {
    totalActivities: number;
    topModule: ModuleId;
    topModuleCount: number;
    highlights: string[];
  },
): ShareCardData {
  return {
    type: 'year_in_review',
    profileId: profile.id,
    moduleId: null,
    headline: `${year} Year in Review`,
    subtext: `${stats.totalActivities} activities across all modules`,
    statValue: String(stats.totalActivities),
    statLabel: 'activities',
    data: {
      year,
      totalActivities: stats.totalActivities,
      topModule: stats.topModule,
      topModuleCount: stats.topModuleCount,
      highlights: stats.highlights,
      handle: profile.handle,
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
    },
  };
}

/** Generate a profile summary share card. */
export function generateProfileCard(
  profile: SocialProfile,
  stats?: {
    totalActivities?: number;
    activeModules?: number;
    longestStreak?: number;
  },
): ShareCardData {
  return {
    type: 'profile',
    profileId: profile.id,
    moduleId: null,
    headline: profile.displayName,
    subtext: profile.bio,
    statValue: stats?.totalActivities != null ? String(stats.totalActivities) : null,
    statLabel: stats?.totalActivities != null ? 'activities' : null,
    data: {
      handle: profile.handle,
      displayName: profile.displayName,
      bio: profile.bio,
      avatarUrl: profile.avatarUrl,
      followerCount: profile.followerCount,
      followingCount: profile.followingCount,
      enabledModules: profile.enabledModules,
      activeModules: stats?.activeModules,
      longestStreak: stats?.longestStreak,
    },
  };
}

/** Generate a share card for a forum thread. */
export function generateForumThreadCard(
  profile: SocialProfile,
  thread: {
    title: string;
    communityName: string;
    voteScore: number;
    replyCount: number;
  },
): ShareCardData {
  return {
    type: 'forum_thread',
    profileId: profile.id,
    moduleId: 'forums',
    headline: thread.title,
    subtext: `in ${thread.communityName}`,
    statValue: formatVoteScore(thread.voteScore),
    statLabel: thread.replyCount === 1 ? 'reply' : 'replies',
    data: {
      communityName: thread.communityName,
      voteScore: thread.voteScore,
      replyCount: thread.replyCount,
      handle: profile.handle,
      displayName: profile.displayName,
    },
  };
}

/** Generate a share card for a marketplace listing. */
export function generateMarketListingCard(
  profile: SocialProfile,
  listing: {
    title: string;
    priceCents: number | null;
    condition?: string | null;
    listingType?: string;
    photoUrl?: string;
  },
): ShareCardData {
  const priceText = listing.priceCents != null
    ? `$${(listing.priceCents / 100).toFixed(2)}`
    : 'Free';
  const conditionLabel = listing.condition
    ?? (listing.listingType?.startsWith('service_') ? 'Service' : 'Listing');

  return {
    type: 'market_listing',
    profileId: profile.id,
    moduleId: 'market',
    headline: listing.title,
    subtext: `${priceText} · ${conditionLabel}`,
    statValue: priceText,
    statLabel: conditionLabel,
    data: {
      listingTitle: listing.title,
      priceCents: listing.priceCents,
      condition: conditionLabel,
      listingType: listing.listingType,
      photoUrl: listing.photoUrl,
      handle: profile.handle,
      displayName: profile.displayName,
    },
  };
}

/** Generate a share card for a Manhattan plan. */
export function generateManhattanPlanCard(
  profile: SocialProfile,
  plan: {
    title: string;
    location: string;
    eventCount: number;
    duration?: string;
  },
): ShareCardData {
  return {
    type: 'manhattan_plan',
    profileId: profile.id,
    moduleId: 'manhattan',
    headline: plan.title,
    subtext: plan.location,
    statValue: String(plan.eventCount),
    statLabel: plan.eventCount === 1 ? 'event' : 'events',
    data: {
      planTitle: plan.title,
      location: plan.location,
      eventCount: plan.eventCount,
      duration: plan.duration,
      handle: profile.handle,
      displayName: profile.displayName,
    },
  };
}

// ── Helpers ───────────────────────────────────────────────────────────

function formatVoteScore(score: number): string {
  if (score >= 1000) {
    return `${(score / 1000).toFixed(1)}k`;
  }
  return String(score);
}

function formatKudosCount(count: number): string {
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}k`;
  }
  return String(count);
}
