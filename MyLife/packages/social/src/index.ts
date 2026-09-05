/**
 * @mylife/social -- Social/community layer for MyLife.
 *
 * Privacy-first social features: profiles, follows, activity feed,
 * kudos, comments, challenges, groups, leaderboards, and share cards.
 *
 * All social features are opt-in. Users start with zero social presence.
 */

// ── Types & Schemas ───────────────────────────────────────────────────

export type {
  Visibility,
  ModulePrivacySetting,
  PrivacySettings,
  SocialProfile,
  CreateProfileInput,
  FriendLinkStatus,
  FriendLink,
  CreateFriendLinkInput,
  IssuedFriendLink,
  Friendship,
  FollowStatus,
  Follow,
  ActivityType,
  ActivityMetadata,
  Activity,
  CreateActivityInput,
  KudosEmoji,
  Kudos,
  Comment,
  ChallengeStatus,
  ChallengeGoal,
  Challenge,
  ChallengeMemberStatus,
  ChallengeMember,
  CreateChallengeInput,
  GroupRole,
  Group,
  GroupMember,
  LeaderboardScope,
  LeaderboardTimeframe,
  LeaderboardConfig,
  LeaderboardEntry,
  ShareCardType,
  ShareCard,
  GenerateShareCardInput,
} from './types';

export {
  SOCIAL_CAPABLE_MODULES,
  VisibilitySchema,
  ModulePrivacySettingSchema,
  PrivacySettingsSchema,
  DEFAULT_PRIVACY_SETTINGS,
  SocialProfileSchema,
  CreateProfileInputSchema,
  FriendLinkStatusSchema,
  FriendLinkCodeSchema,
  FriendLinkSchema,
  CreateFriendLinkInputSchema,
  IssuedFriendLinkSchema,
  FriendshipSchema,
  FollowStatusSchema,
  FollowSchema,
  ActivityTypeSchema,
  ActivityMetadataSchema,
  ActivitySchema,
  CreateActivityInputSchema,
  KudosEmojiSchema,
  KudosSchema,
  CommentSchema,
  ChallengeStatusSchema,
  ChallengeGoalSchema,
  ChallengeSchema,
  ChallengeMemberStatusSchema,
  ChallengeMemberSchema,
  CreateChallengeInputSchema,
  GroupRoleSchema,
  GroupSchema,
  GroupMemberSchema,
  LeaderboardScopeSchema,
  LeaderboardTimeframeSchema,
  LeaderboardConfigSchema,
  LeaderboardEntrySchema,
  ShareCardTypeSchema,
  ShareCardSchema,
  GenerateShareCardInputSchema,
} from './types';

// ── Client ────────────────────────────────────────────────────────────

export { SocialClient } from './client';
export type { SocialResult } from './client';

// ── React Hooks ───────────────────────────────────────────────────────

export {
  setSocialClient,
  getSocialClient,
  resetSocialClient,
} from './client-store';

export {
  useMyProfile,
  useHasProfile,
  useProfile,
  useProfileSearch,
  useProfilesByIds,
  useMyFriendLinks,
  useMyFriendships,
  useMyFriends,
  useFollowers,
  useFollowing,
  usePendingFollowRequests,
  useActivityFeed,
  useProfileActivities,
  useKudos,
  useMyKudosForActivities,
  useKudosMutation,
  useComments,
  useChallenges,
  useChallengeProgress,
  useLeaderboard,
  useFriendsLeaderboard,
  useMyGroups,
  useDiscoverGroups,
} from './hooks';

// ── Activity Emitter ──────────────────────────────────────────────────

export {
  emitActivity,
  onActivityEmitted,
  emitWorkoutCompleted,
  emitBookFinished,
  emitFastCompleted,
  emitHabitStreak,
  emitSurfSession,
  emitRecipeCooked,
  emitWordsMilestone,
  emitMedsStreak,
  emitForumThreadCreated,
  emitForumReplyPosted,
  emitForumCommunityCreated,
  emitForumKarmaMilestone,
  emitMarketListingCreated,
  emitMarketListingSold,
  emitManhattanEventSaved,
  emitManhattanPlanShared,
} from './activity-emitter';
export type { EmitActivityInput, EmitResult } from './activity-emitter';

// ── Privacy ───────────────────────────────────────────────────────────

export {
  isAutoPostEnabled,
  getModuleVisibility,
  setModulePrivacy,
  enableAutoPost,
  disableAutoPost,
  createDefaultPrivacySettings,
  isSocialOptedIn,
  optOutOfSocial,
  validatePrivacySettings,
} from './privacy';

// ── Share Cards ───────────────────────────────────────────────────────

export type { ShareCardData } from './share-card';
export {
  generateActivityCard,
  generateChallengeCompleteCard,
  generateStreakCard,
  generateYearInReviewCard,
  generateProfileCard,
  generateForumThreadCard,
  generateMarketListingCard,
  generateManhattanPlanCard,
} from './share-card';
export {
  calculateChallengeProgressPercent,
  describeSocialActivity,
  getPrimaryChallengeModuleId,
  getSocialModulePresentation,
  suggestSocialHandle,
} from './presentation';
