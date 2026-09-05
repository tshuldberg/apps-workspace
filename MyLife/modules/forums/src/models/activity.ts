import { z } from 'zod';

export const ForumActivityTrustTierSchema = z.enum([
  'unverified',
  'new',
  'trusted',
  'highly_trusted',
  'mod',
]);
export type ForumActivityTrustTier = z.infer<typeof ForumActivityTrustTierSchema>;

export const ForumActivityTypeSchema = z.enum([
  'mention',
  'reply',
  'vote',
  'invite',
  'mod_action',
]);
export type ForumActivityType = z.infer<typeof ForumActivityTypeSchema>;

export const ForumActivityFilterSchema = z.enum([
  'all',
  'mentions',
  'replies',
  'votes',
  'invites',
  'mod_actions',
]);
export type ForumActivityFilter = z.infer<typeof ForumActivityFilterSchema>;

export const ForumActivityTargetTypeSchema = z.enum([
  'thread',
  'community',
  'conversation',
  'profile',
]);
export type ForumActivityTargetType = z.infer<typeof ForumActivityTargetTypeSchema>;

export const ForumActivityGroupLabelSchema = z.enum([
  'Today',
  'Yesterday',
  'This Week',
  'Earlier',
]);
export type ForumActivityGroupLabel = z.infer<typeof ForumActivityGroupLabelSchema>;

export const FORUM_ACTIVITY_FILTERS = ForumActivityFilterSchema.options;

export const ForumActivitySchema = z.object({
  id: z.string().min(1),
  profileId: z.string().min(1),
  actorProfileId: z.string().min(1).nullable(),
  actorName: z.string().min(1).max(100),
  actorTrustTier: ForumActivityTrustTierSchema,
  type: ForumActivityTypeSchema,
  verb: z.string().min(1).max(80),
  context: z.string().min(1).max(200),
  detail: z.string().max(280).nullable(),
  targetType: ForumActivityTargetTypeSchema,
  targetId: z.string().min(1).nullable(),
  communityId: z.string().min(1).nullable(),
  threadId: z.string().min(1).nullable(),
  conversationId: z.string().min(1).nullable(),
  targetProfileId: z.string().min(1).nullable(),
  createdAt: z.string().datetime(),
  readAt: z.string().datetime().nullable(),
});
export type ForumActivity = z.infer<typeof ForumActivitySchema>;

export type ForumActivityUnreadCounts = Record<ForumActivityFilter, number>;

export interface ForumActivityGroup {
  label: ForumActivityGroupLabel;
  items: ForumActivity[];
}

export interface ForumActivityFeedPage {
  items: ForumActivity[];
  groups: ForumActivityGroup[];
  unreadCounts: ForumActivityUnreadCounts;
  page: number;
  total: number;
  hasMore: boolean;
}
