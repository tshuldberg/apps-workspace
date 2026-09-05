/**
 * @mylife/social -- Core types and Zod schemas for the social/community layer.
 *
 * Privacy-first: all social features are opt-in. Users start with zero
 * social presence and explicitly create a profile to participate.
 */

import { z } from 'zod';
import type { ModuleId } from '@mylife/module-registry';
import { ModuleIdSchema } from '@mylife/module-registry';

// ── Module IDs ────────────────────────────────────────────────────────

/** Modules that can emit social activities. */
export const SOCIAL_CAPABLE_MODULES: readonly ModuleId[] = [
  'books',
  'budget',
  'fast',
  'forums',
  'habits',
  'health',
  'manhattan',
  'market',
  'meds',
  'recipes',
  'surf',
  'words',
  'workouts',
] as const;

// ── Privacy & Visibility ──────────────────────────────────────────────

/** Who can see a piece of social content. */
export type Visibility = 'public' | 'followers' | 'private';

export const VisibilitySchema = z.enum(['public', 'followers', 'private']);

/** Per-module privacy setting: controls what gets shared from each module. */
export const ModulePrivacySettingSchema = z.object({
  moduleId: ModuleIdSchema,
  /** Whether activity auto-posting is enabled for this module. */
  autoPost: z.boolean(),
  /** Default visibility for activities from this module. */
  defaultVisibility: VisibilitySchema,
});

export type ModulePrivacySetting = z.infer<typeof ModulePrivacySettingSchema>;

/** Top-level privacy settings for a user's social presence. */
export const PrivacySettingsSchema = z.object({
  /** Whether the user's profile is discoverable via search. */
  discoverable: z.boolean(),
  /** Whether to show which modules the user has enabled. */
  showModules: z.boolean(),
  /** Whether to show activity streaks on the profile. */
  showStreaks: z.boolean(),
  /** Whether to allow follow requests from anyone (false = approval required). */
  openFollows: z.boolean(),
  /** Per-module privacy overrides. */
  moduleSettings: z.array(ModulePrivacySettingSchema),
});

export type PrivacySettings = z.infer<typeof PrivacySettingsSchema>;

export const DEFAULT_PRIVACY_SETTINGS: PrivacySettings = {
  discoverable: false,
  showModules: false,
  showStreaks: false,
  openFollows: false,
  moduleSettings: [],
};

// ── Social Profile ────────────────────────────────────────────────────

export const SocialProfileSchema = z.object({
  id: z.string().uuid(),
  /** Supabase auth user ID (references auth.users). */
  userId: z.string().uuid(),
  /** Unique handle (lowercase, alphanumeric + underscores, 3-30 chars). */
  handle: z.string().regex(/^[a-z0-9_]{3,30}$/),
  /** Display name shown on the profile. */
  displayName: z.string().min(1).max(64),
  /** Optional short bio. */
  bio: z.string().max(280).nullable(),
  /** Avatar URL (Supabase Storage or external). */
  avatarUrl: z.string().url().nullable(),
  /** Privacy settings blob. */
  privacySettings: PrivacySettingsSchema,
  /** Follower count (denormalized for fast reads). */
  followerCount: z.number().int().nonnegative(),
  /** Following count (denormalized for fast reads). */
  followingCount: z.number().int().nonnegative(),
  /** Which modules this user has enabled (only shown if privacy allows). */
  enabledModules: z.array(ModuleIdSchema),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type SocialProfile = z.infer<typeof SocialProfileSchema>;

export const CreateProfileInputSchema = z.object({
  handle: z.string().regex(/^[a-z0-9_]{3,30}$/, 'Handle must be 3-30 lowercase alphanumeric characters or underscores.'),
  displayName: z.string().min(1).max(64),
  bio: z.string().max(280).optional(),
  avatarUrl: z.string().url().optional(),
});

export type CreateProfileInput = z.infer<typeof CreateProfileInputSchema>;

// ── Secure Friend Links ───────────────────────────────────────────────

/**
 * Friend links create a symmetric trusted connection after the recipient
 * confirms the shared out-of-band code.
 */
export type FriendLinkStatus = 'pending' | 'confirmed' | 'expired' | 'cancelled';

export const FriendLinkStatusSchema = z.enum(['pending', 'confirmed', 'expired', 'cancelled']);

export const FriendLinkCodeSchema = z.string().regex(/^[A-Z2-9]{4}(?:-[A-Z2-9]{4}){2}$/);

export const FriendLinkSchema = z.object({
  id: z.string().uuid(),
  creatorProfileId: z.string().uuid(),
  friendProfileId: z.string().uuid().nullable(),
  status: FriendLinkStatusSchema,
  codeHint: z.string().min(2).max(12),
  note: z.string().max(200).nullable(),
  expiresAt: z.string().datetime().nullable(),
  confirmedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type FriendLink = z.infer<typeof FriendLinkSchema>;

export const CreateFriendLinkInputSchema = z.object({
  note: z.string().max(200).optional(),
  expiresAt: z.string().datetime().optional(),
});

export type CreateFriendLinkInput = z.infer<typeof CreateFriendLinkInputSchema>;

export const IssuedFriendLinkSchema = z.object({
  link: FriendLinkSchema,
  code: FriendLinkCodeSchema,
});

export type IssuedFriendLink = z.infer<typeof IssuedFriendLinkSchema>;

export const FriendshipSchema = z.object({
  id: z.string().uuid(),
  profileAId: z.string().uuid(),
  profileBId: z.string().uuid(),
  createdByProfileId: z.string().uuid(),
  sourceLinkId: z.string().uuid().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Friendship = z.infer<typeof FriendshipSchema>;

// ── Follow System ─────────────────────────────────────────────────────

export type FollowStatus = 'active' | 'pending';

export const FollowStatusSchema = z.enum(['active', 'pending']);

export const FollowSchema = z.object({
  id: z.string().uuid(),
  /** The user who initiated the follow. */
  followerId: z.string().uuid(),
  /** The user being followed. */
  followeeId: z.string().uuid(),
  /** Status: active (accepted) or pending (awaiting approval). */
  status: FollowStatusSchema,
  createdAt: z.string().datetime(),
});

export type Follow = z.infer<typeof FollowSchema>;

// ── Activity Feed ─────────────────────────────────────────────────────

/**
 * Activity types emitted by each module.
 *
 * Format: module_action (e.g., books_finished, workouts_completed).
 * Each module defines its own set of actions via the ActivityEmitter.
 */
export const ActivityTypeSchema = z.enum([
  // Books
  'books_started',
  'books_finished',
  'books_reviewed',
  'books_goal_reached',
  // Budget
  'budget_goal_met',
  'budget_streak',
  // Fast
  'fast_completed',
  'fast_streak',
  'fast_personal_best',
  // Forums
  'forums_thread_created',
  'forums_reply_posted',
  'forums_community_created',
  'forums_karma_milestone',
  // Habits
  'habits_completed',
  'habits_streak',
  'habits_milestone',
  // Health
  'health_milestone',
  // Manhattan
  'manhattan_event_saved',
  'manhattan_plan_shared',
  // Market
  'market_listing_created',
  'market_listing_sold',
  'market_review_received',
  'market_seller_milestone',
  // Meds
  'meds_adherence_streak',
  // Recipes
  'recipes_cooked',
  'recipes_created',
  // Surf
  'surf_session_logged',
  'surf_spot_discovered',
  // Words
  'words_learned',
  'words_streak',
  'words_milestone',
  // Workouts
  'workouts_completed',
  'workouts_personal_best',
  'workouts_streak',
  'workouts_volume_milestone',
  // Challenges
  'challenge_joined',
  'challenge_completed',
  'challenge_milestone',
  // General
  'profile_created',
  'milestone_reached',
]);

export type ActivityType = z.infer<typeof ActivityTypeSchema>;

/**
 * Module-specific metadata attached to an activity.
 * Intentionally flexible -- each module defines its own shape.
 */
export const ActivityMetadataSchema = z.record(z.string(), z.unknown());

export type ActivityMetadata = z.infer<typeof ActivityMetadataSchema>;

export const ActivitySchema = z.object({
  id: z.string().uuid(),
  /** Profile ID of the user who performed the activity. */
  profileId: z.string().uuid(),
  /** Which module generated this activity. */
  moduleId: ModuleIdSchema.nullable(),
  /** Type of activity (module_action format). */
  type: ActivityTypeSchema,
  /** Human-readable summary (e.g., "Finished reading Dune"). */
  title: z.string().max(200),
  /** Optional longer description. */
  description: z.string().max(1000).nullable(),
  /** Module-specific structured metadata. */
  metadata: ActivityMetadataSchema,
  /** Visibility of this activity. */
  visibility: VisibilitySchema,
  /** Kudos count (denormalized for fast reads). */
  kudosCount: z.number().int().nonnegative(),
  /** Comment count (denormalized for fast reads). */
  commentCount: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
});

export type Activity = z.infer<typeof ActivitySchema>;

export const CreateActivityInputSchema = z.object({
  moduleId: ModuleIdSchema.nullable(),
  type: ActivityTypeSchema,
  title: z.string().max(200),
  description: z.string().max(1000).optional(),
  metadata: ActivityMetadataSchema.optional(),
  visibility: VisibilitySchema.optional(),
});

export type CreateActivityInput = z.infer<typeof CreateActivityInputSchema>;

// ── Kudos (Likes/Reactions) ───────────────────────────────────────────

/** Emoji-based reactions. Simple and fun. */
export const KudosEmojiSchema = z.enum([
  'fire',     // General hype
  'clap',     // Congrats / well done
  'muscle',   // Strength / effort
  'heart',    // Love
  'mind_blown', // Impressive
  'wave',     // Surf / water
]);

export type KudosEmoji = z.infer<typeof KudosEmojiSchema>;

export const KudosSchema = z.object({
  id: z.string().uuid(),
  /** Activity that received the kudos. */
  activityId: z.string().uuid(),
  /** Profile that gave the kudos. */
  giverId: z.string().uuid(),
  /** Emoji reaction type. */
  emoji: KudosEmojiSchema,
  createdAt: z.string().datetime(),
});

export type Kudos = z.infer<typeof KudosSchema>;

// ── Comments ──────────────────────────────────────────────────────────

export const CommentSchema = z.object({
  id: z.string().uuid(),
  activityId: z.string().uuid(),
  profileId: z.string().uuid(),
  body: z.string().min(1).max(500),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Comment = z.infer<typeof CommentSchema>;

// ── Challenges ────────────────────────────────────────────────────────

/**
 * Challenges can span multiple modules. Example:
 * "March Madness: 20 workouts + 5 books + 30-day habit streak"
 *
 * Each challenge has goals, and each goal targets a specific module + metric.
 */

export type ChallengeStatus = 'upcoming' | 'active' | 'completed' | 'cancelled';

export const ChallengeStatusSchema = z.enum(['upcoming', 'active', 'completed', 'cancelled']);

export const ChallengeGoalSchema = z.object({
  id: z.string().uuid(),
  challengeId: z.string().uuid(),
  /** Which module this goal tracks. */
  moduleId: ModuleIdSchema,
  /** What activity type to count. */
  activityType: ActivityTypeSchema,
  /** Target count to reach. */
  targetCount: z.number().int().positive(),
  /** Unit label for display (e.g., "workouts", "books", "days"). */
  unit: z.string().max(30),
  /** Description of this specific goal. */
  description: z.string().max(200),
});

export type ChallengeGoal = z.infer<typeof ChallengeGoalSchema>;

export const ChallengeSchema = z.object({
  id: z.string().uuid(),
  /** Display title (e.g., "March Madness"). */
  title: z.string().min(1).max(100),
  /** Longer description of the challenge. */
  description: z.string().max(1000).nullable(),
  /** Profile ID of the challenge creator. */
  creatorId: z.string().uuid(),
  /** Challenge status. */
  status: ChallengeStatusSchema,
  /** Start date (ISO string). */
  startsAt: z.string().datetime(),
  /** End date (ISO string). */
  endsAt: z.string().datetime(),
  /** Goals that make up this challenge. */
  goals: z.array(ChallengeGoalSchema),
  /** Number of participants (denormalized). */
  memberCount: z.number().int().nonnegative(),
  /** Visibility of this challenge. */
  visibility: VisibilitySchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Challenge = z.infer<typeof ChallengeSchema>;

export type ChallengeMemberStatus = 'joined' | 'completed' | 'dropped';

export const ChallengeMemberStatusSchema = z.enum(['joined', 'completed', 'dropped']);

export const ChallengeMemberSchema = z.object({
  id: z.string().uuid(),
  challengeId: z.string().uuid(),
  profileId: z.string().uuid(),
  status: ChallengeMemberStatusSchema,
  /** Progress per goal: goalId -> current count. */
  progress: z.record(z.string(), z.number().int().nonnegative()),
  joinedAt: z.string().datetime(),
  completedAt: z.string().datetime().nullable(),
});

export type ChallengeMember = z.infer<typeof ChallengeMemberSchema>;

export const CreateChallengeInputSchema = z.object({
  title: z.string().min(1).max(100),
  description: z.string().max(1000).optional(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  goals: z.array(z.object({
    moduleId: ModuleIdSchema,
    activityType: ActivityTypeSchema,
    targetCount: z.number().int().positive(),
    unit: z.string().max(30),
    description: z.string().max(200),
  })).min(1),
  visibility: VisibilitySchema.optional(),
});

export type CreateChallengeInput = z.infer<typeof CreateChallengeInputSchema>;

// ── Groups ────────────────────────────────────────────────────────────

export type GroupRole = 'owner' | 'admin' | 'member';

export const GroupRoleSchema = z.enum(['owner', 'admin', 'member']);

export const GroupSchema = z.object({
  id: z.string().uuid(),
  /** Group name (e.g., "SF Morning Surfers"). */
  name: z.string().min(1).max(100),
  /** Group description. */
  description: z.string().max(1000).nullable(),
  /** Avatar/cover image URL. */
  avatarUrl: z.string().url().nullable(),
  /** Profile ID of the group creator. */
  creatorId: z.string().uuid(),
  /** Number of members (denormalized). */
  memberCount: z.number().int().nonnegative(),
  /** Whether the group is public (anyone can join) or private (invite/approval). */
  isPublic: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Group = z.infer<typeof GroupSchema>;

export const GroupMemberSchema = z.object({
  id: z.string().uuid(),
  groupId: z.string().uuid(),
  profileId: z.string().uuid(),
  role: GroupRoleSchema,
  joinedAt: z.string().datetime(),
});

export type GroupMember = z.infer<typeof GroupMemberSchema>;

// ── Leaderboards ──────────────────────────────────────────────────────

/**
 * Leaderboards aggregate scores across modules over a time window.
 *
 * Scoring is configurable: each module+activityType combo has a point value.
 * Default scoring weights common activities equally (1 point each).
 */

export type LeaderboardScope = 'global' | 'group' | 'challenge' | 'friends';
export type LeaderboardTimeframe = 'daily' | 'weekly' | 'monthly' | 'all_time';

export const LeaderboardScopeSchema = z.enum(['global', 'group', 'challenge', 'friends']);
export const LeaderboardTimeframeSchema = z.enum(['daily', 'weekly', 'monthly', 'all_time']);

export const LeaderboardConfigSchema = z.object({
  id: z.string().uuid(),
  /** Display name for this leaderboard. */
  name: z.string().min(1).max(100),
  /** Scope: global, group-specific, challenge-specific, or friends-only. */
  scope: LeaderboardScopeSchema,
  /** Associated group or challenge ID (null for global/friends). */
  scopeId: z.string().uuid().nullable(),
  /** Time window for scoring. */
  timeframe: LeaderboardTimeframeSchema,
  /** Scoring rules: activityType -> points per occurrence. */
  scoring: z.record(ActivityTypeSchema, z.number().positive()),
  /** Which modules contribute to this leaderboard. */
  modules: z.array(ModuleIdSchema),
  createdAt: z.string().datetime(),
});

export type LeaderboardConfig = z.infer<typeof LeaderboardConfigSchema>;

export const LeaderboardEntrySchema = z.object({
  profileId: z.string().uuid(),
  handle: z.string(),
  displayName: z.string(),
  avatarUrl: z.string().url().nullable(),
  score: z.number().nonnegative(),
  rank: z.number().int().positive(),
  /** Breakdown of score by module. */
  moduleScores: z.record(ModuleIdSchema, z.number().nonnegative()).optional(),
});

export type LeaderboardEntry = z.infer<typeof LeaderboardEntrySchema>;

// ── Share Cards ───────────────────────────────────────────────────────

/**
 * Data model for generating shareable cards (for social media, iMessage, etc.).
 * The card data is generated server-side or locally, then rendered by the UI layer.
 */

export type ShareCardType = 'activity' | 'challenge_complete' | 'streak' | 'year_in_review' | 'profile' | 'forum_thread' | 'market_listing' | 'manhattan_plan';

export const ShareCardTypeSchema = z.enum([
  'activity',
  'challenge_complete',
  'streak',
  'year_in_review',
  'profile',
  'forum_thread',
  'market_listing',
  'manhattan_plan',
]);

export const ShareCardSchema = z.object({
  id: z.string().uuid(),
  type: ShareCardTypeSchema,
  /** Profile of the user sharing. */
  profileId: z.string().uuid(),
  /** Module context for theming the card. */
  moduleId: ModuleIdSchema.nullable(),
  /** Headline text on the card. */
  headline: z.string().max(100),
  /** Subheadline / supporting text. */
  subtext: z.string().max(200).nullable(),
  /** Key stat to highlight (e.g., "42 books read"). */
  statValue: z.string().max(20).nullable(),
  /** Label for the stat (e.g., "books read"). */
  statLabel: z.string().max(50).nullable(),
  /** Additional structured data for card rendering. */
  data: z.record(z.string(), z.unknown()),
  createdAt: z.string().datetime(),
});

export type ShareCard = z.infer<typeof ShareCardSchema>;

export const GenerateShareCardInputSchema = z.object({
  type: ShareCardTypeSchema,
  moduleId: ModuleIdSchema.optional(),
  /** Reference ID (activity ID, challenge ID, etc.) */
  referenceId: z.string().uuid().optional(),
  /** Custom headline override. */
  headline: z.string().max(100).optional(),
});

export type GenerateShareCardInput = z.infer<typeof GenerateShareCardInputSchema>;
