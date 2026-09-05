import { z } from 'zod';

// ── Community ────────────────────────────────────────────────────────

export const CommunityTypeSchema = z.enum(['public', 'restricted', 'private']);
export type CommunityType = z.infer<typeof CommunityTypeSchema>;

export const CommunitySchema = z.object({
  id: z.string().uuid(),
  creatorId: z.string().uuid(),
  name: z.string().regex(/^[a-z0-9][a-z0-9-]{1,98}[a-z0-9]$/),
  displayName: z.string().min(1).max(100),
  description: z.string().max(1000).nullable(),
  iconUrl: z.string().url().nullable(),
  bannerUrl: z.string().url().nullable(),
  communityType: CommunityTypeSchema,
  humansOnly: z.boolean().default(false),
  linkedModuleId: z.string().nullable(),
  memberCount: z.number().int().nonnegative(),
  threadCount: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Community = z.infer<typeof CommunitySchema>;

export const CreateCommunityInputSchema = z.object({
  name: z.string().regex(/^[a-z0-9][a-z0-9-]{1,98}[a-z0-9]$/),
  displayName: z.string().min(1).max(100),
  description: z.string().max(1000).optional(),
  communityType: CommunityTypeSchema.optional(),
  humansOnly: z.boolean().optional(),
  linkedModuleId: z.string().optional(),
});
export type CreateCommunityInput = z.infer<typeof CreateCommunityInputSchema>;

// ── Community Members ────────────────────────────────────────────────

export const MemberRoleSchema = z.enum(['owner', 'admin', 'moderator', 'member']);
export type MemberRole = z.infer<typeof MemberRoleSchema>;

export const MemberStatusSchema = z.enum(['active', 'pending', 'banned', 'muted']);
export type MemberStatus = z.infer<typeof MemberStatusSchema>;

export const CommunityMemberSchema = z.object({
  id: z.string().uuid(),
  communityId: z.string().uuid(),
  profileId: z.string().uuid(),
  role: MemberRoleSchema,
  status: MemberStatusSchema,
  joinedAt: z.string().datetime(),
});
export type CommunityMember = z.infer<typeof CommunityMemberSchema>;

// ── Threads ──────────────────────────────────────────────────────────

export const ThreadStatusSchema = z.enum(['open', 'locked', 'removed']);
export type ThreadStatus = z.infer<typeof ThreadStatusSchema>;

export const ThreadSchema = z.object({
  id: z.string().uuid(),
  communityId: z.string().uuid(),
  authorId: z.string().uuid(),
  title: z.string().min(3).max(300),
  body: z.string().max(40000),
  status: ThreadStatusSchema,
  isPinned: z.boolean(),
  voteScore: z.number().int(),
  replyCount: z.number().int().nonnegative(),
  viewCount: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Thread = z.infer<typeof ThreadSchema>;

export const CreateThreadInputSchema = z.object({
  communityId: z.string().uuid(),
  title: z.string().min(3).max(300),
  body: z.string().max(40000),
});
export type CreateThreadInput = z.infer<typeof CreateThreadInputSchema>;

// ── Replies ──────────────────────────────────────────────────────────

export const ReplySchema = z.object({
  id: z.string().uuid(),
  threadId: z.string().uuid(),
  parentReplyId: z.string().uuid().nullable(),
  authorId: z.string().uuid(),
  body: z.string().min(1).max(10000),
  voteScore: z.number().int(),
  depth: z.number().int().nonnegative(),
  status: ThreadStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Reply = z.infer<typeof ReplySchema>;

export const CreateReplyInputSchema = z.object({
  threadId: z.string().uuid(),
  parentReplyId: z.string().uuid().optional(),
  body: z.string().min(1).max(10000),
});
export type CreateReplyInput = z.infer<typeof CreateReplyInputSchema>;

// ── Votes ────────────────────────────────────────────────────────────

export const VoteTargetTypeSchema = z.enum(['thread', 'reply']);
export type VoteTargetType = z.infer<typeof VoteTargetTypeSchema>;

export const VoteDirectionSchema = z.enum(['up', 'down']);
export type VoteDirection = z.infer<typeof VoteDirectionSchema>;

export const VoteSchema = z.object({
  id: z.string().uuid(),
  profileId: z.string().uuid(),
  targetType: VoteTargetTypeSchema,
  targetId: z.string().uuid(),
  direction: VoteDirectionSchema,
  createdAt: z.string().datetime(),
});
export type Vote = z.infer<typeof VoteSchema>;

// ── Bookmarks ────────────────────────────────────────────────────────

export const BookmarkSchema = z.object({
  id: z.string().uuid(),
  profileId: z.string().uuid(),
  threadId: z.string().uuid(),
  createdAt: z.string().datetime(),
});
export type Bookmark = z.infer<typeof BookmarkSchema>;

// ── User Stats ───────────────────────────────────────────────────────

export const UserStatsSchema = z.object({
  profileId: z.string().uuid(),
  threadCount: z.number().int().nonnegative(),
  replyCount: z.number().int().nonnegative(),
  karma: z.number().int(),
  communitiesJoined: z.number().int().nonnegative(),
});
export type UserStats = z.infer<typeof UserStatsSchema>;

// ── Moderation ───────────────────────────────────────────────────────

export const ModActionTypeSchema = z.enum([
  'remove_thread',
  'remove_reply',
  'lock_thread',
  'unlock_thread',
  'pin_thread',
  'unpin_thread',
  'ban_user',
  'unban_user',
  'mute_user',
  'unmute_user',
  'edit_community',
]);
export type ModActionType = z.infer<typeof ModActionTypeSchema>;

export const ModActionSchema = z.object({
  id: z.string().uuid(),
  communityId: z.string().uuid(),
  moderatorId: z.string().uuid(),
  actionType: ModActionTypeSchema,
  targetId: z.string().uuid().nullable(),
  reason: z.string().max(500).nullable(),
  createdAt: z.string().datetime(),
});
export type ModAction = z.infer<typeof ModActionSchema>;

// ── Reports ──────────────────────────────────────────────────────────

export const ForumReportReasonSchema = z.enum([
  'spam',
  'harassment',
  'misinformation',
  'off_topic',
  'nsfw',
  'other',
]);
export type ForumReportReason = z.infer<typeof ForumReportReasonSchema>;

export const ForumReportSchema = z.object({
  id: z.string().uuid(),
  reporterId: z.string().uuid(),
  communityId: z.string().uuid(),
  targetType: VoteTargetTypeSchema,
  targetId: z.string().uuid(),
  reason: ForumReportReasonSchema,
  details: z.string().max(1000).nullable(),
  createdAt: z.string().datetime(),
});
export type ForumReport = z.infer<typeof ForumReportSchema>;

// ── Blocks ───────────────────────────────────────────────────────────

export const ForumBlockSchema = z.object({
  id: z.string().uuid(),
  blockerId: z.string().uuid(),
  blockedId: z.string().uuid(),
  createdAt: z.string().datetime(),
});
export type ForumBlock = z.infer<typeof ForumBlockSchema>;

// ── Community Rules ──────────────────────────────────────────────────

export const CommunityRuleSchema = z.object({
  id: z.string().uuid(),
  communityId: z.string().uuid(),
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(1000),
  position: z.number().int().nonnegative(),
});
export type CommunityRule = z.infer<typeof CommunityRuleSchema>;

// ── Tags ─────────────────────────────────────────────────────────────

export const TagSchema = z.object({
  id: z.string().uuid(),
  communityId: z.string().uuid(),
  name: z.string().min(1).max(50),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).nullable(),
});
export type Tag = z.infer<typeof TagSchema>;
