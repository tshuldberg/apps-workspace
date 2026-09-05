// ── Module Definition ────────────────────────────────────────────────
export { FORUMS_MODULE } from './definition';

// ── Types & Schemas (V1) ────────────────────────────────────────────
export {
  CommunityTypeSchema,
  CommunitySchema,
  CreateCommunityInputSchema,
  MemberRoleSchema,
  MemberStatusSchema,
  CommunityMemberSchema,
  ThreadStatusSchema,
  ThreadSchema,
  CreateThreadInputSchema,
  ReplySchema,
  CreateReplyInputSchema,
  VoteTargetTypeSchema,
  VoteDirectionSchema,
  VoteSchema,
  BookmarkSchema,
  UserStatsSchema,
  ModActionTypeSchema,
  ModActionSchema,
  ForumReportReasonSchema,
  ForumReportSchema,
  ForumBlockSchema,
  CommunityRuleSchema,
  TagSchema,
} from './types';
export type {
  CommunityType,
  Community,
  CreateCommunityInput,
  MemberRole,
  MemberStatus,
  CommunityMember,
  ThreadStatus,
  Thread,
  CreateThreadInput,
  Reply,
  CreateReplyInput,
  VoteTargetType,
  VoteDirection,
  Vote,
  Bookmark,
  UserStats,
  ModActionType,
  ModAction,
  ForumReportReason,
  ForumReport,
  ForumBlock,
  CommunityRule,
  Tag,
} from './types';

// ── V2 Models: B+C Features ────────────────────────────────────────
export * from './models/index';

// ── SQLite Cache Schema ──────────────────────────────────────────────
export { CACHE_TABLES, CACHE_INDEXES, V2_CACHE_TABLES, V2_CACHE_INDEXES, V3_CACHE_TABLES, V3_CACHE_INDEXES } from './db/schema';
export { V4_CACHE_TABLES, V4_CACHE_INDEXES } from './db/schema';

// ── Local CRUD (SQLite cache) ────────────────────────────────────────
export type { DatabaseAdapter } from './db/crud';
export {
  // V1 CRUD
  getCachedCommunities,
  getCachedCommunityById,
  getCachedCommunityByName,
  getCachedCommunityByModule,
  upsertCachedCommunity,
  getCachedCommunityMembers,
  upsertCachedCommunityMember,
  getCachedThreads,
  getCachedThreadById,
  upsertCachedThread,
  deleteCachedThread,
  getCachedReplies,
  upsertCachedReply,
  getCachedBookmarks,
  upsertCachedBookmark,
  deleteCachedBookmark,
  getCachedTags,
  upsertCachedTag,
  // V2 CRUD
  getCachedProfileById,
  getCachedProfileByUsername,
  getCachedProfileByUserId,
  upsertCachedProfile,
  getCachedConversations,
  getCachedConversationById,
  upsertCachedConversation,
  getCachedMessages,
  upsertCachedMessage,
  getCachedActivity,
  getCachedActivityById,
  upsertCachedActivity,
  markCachedActivityRead,
  markAllCachedActivityRead,
} from './db/crud';

// ── Cloud Client (Supabase) ──────────────────────────────────────────
export {
  // V1 cloud
  cloudGetCommunities,
  cloudGetCommunityById,
  cloudGetCommunityByName,
  cloudCreateCommunity,
  cloudGetCommunityByModule,
  cloudSearchCommunities,
  cloudJoinCommunity,
  cloudLeaveCommunity,
  cloudGetThreads,
  cloudGetThreadById,
  cloudCreateThread,
  cloudSearchThreads,
  cloudGetReplies,
  cloudCreateReply,
  cloudCastVote,
  cloudRemoveVote,
  cloudGetBookmarks,
  cloudToggleBookmark,
  cloudGetUserStats,
  cloudGetModLog,
  cloudCreateReport,
  cloudGetCommunityRules,
  cloudGetTags,
  // V2 cloud: profiles
  cloudGetProfile,
  cloudGetProfileByUsername,
  cloudGetMyProfile,
  cloudCreateProfile,
  cloudUpdateProfile,
  cloudGetProfileBadges,
  cloudGetProfileActivity,
  // V2 cloud: media
  cloudUploadMedia,
  cloudGetMediaForTarget,
  cloudDeleteMedia,
  cloudGetLinkPreview,
  // V2 cloud: messaging
  cloudGetConversations,
  cloudCreateConversation,
  cloudGetMessages,
  cloudSendMessage,
  cloudUpdateLastRead,
  cloudGetParticipants,
} from './cloud/client';
// Voice and federation cloud functions cut from Beta scope (GP-17-8a CEO review)

// ── Engines ──────────────────────────────────────────────────────────
export {
  validateUsername,
  getDefaultAvatarColor,
  getEligibleBadges,
  getBadgeLabel,
  getBadgeColor,
} from './profile/engine';
export {
  calculateResizeDimensions,
  calculateThumbnailDimensions,
  buildStoragePath,
  detectMediaType,
  validateAttachmentCount,
} from './media/engine';
export {
  buildThreadChannel,
  buildCommunityPresenceChannel,
  buildFeedChannel,
  buildDMChannel,
  formatTypingText,
  pruneExpiredTypers,
  countOnlineMembers,
} from './realtime/engine';
export {
  findExisting1to1,
  isUserBlocked,
  validateMessageBody,
  getCharacterCountInfo,
  sortConversationsByLastMessage,
} from './messaging/engine';
// Voice engine and federation engine cut from Beta scope (GP-17-8a CEO review)

// ── Activity Feed ───────────────────────────────────────────────────
export {
  getActivityFeed,
  markActivityRead,
  markAllActivityRead,
  subscribeToActivity,
} from './activity/store';
export {
  isActivityUnread,
  matchesActivityFilter,
  getActivityGroupLabel,
  countUnreadActivityByFilter,
  groupActivityFeed,
  buildActivityFeedPage,
  markActivityReadInList,
  markAllActivityReadInList,
} from './activity/logic';

// ── Trust & Verification ───────────────────────────────────────────────
export {
  HumanVerificationMethodSchema,
  HumanVerificationSchema,
  CommunityHealthSchema,
  CommunityTemplateSchema,
  ContentCardTargetSchema,
  ContentCardSchema,
} from './trust/types';
export type {
  HumanVerificationMethod,
  HumanVerification,
  CommunityHealth,
  CommunityTemplate,
  ContentCardTarget,
  ContentCard,
} from './trust/types';
export {
  isHumanVerified,
  canParticipateInHumansOnly,
  calculateCommunityHealth,
  MODULE_COMMUNITY_TEMPLATES,
} from './trust/engine';

// ── Shared UI ────────────────────────────────────────────────────────
// `./ui/index.ts` exports only web-safe design tokens; the full RN component
// surface lives in `./ui/index.native.ts` which Metro picks on mobile. Web
// bundlers ignore `.native.ts` and see tokens only.
// See modules/budget/src/index.ts for the documented pattern.
export * from './ui';
