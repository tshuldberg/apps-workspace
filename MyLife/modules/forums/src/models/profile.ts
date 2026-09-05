import { z } from 'zod';

// ── User Profile ────────────────────────────────────────────────────

export const UsernameSchema = z
  .string()
  .min(3)
  .max(30)
  .regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/, 'Lowercase alphanumeric and hyphens only');

export const UserProfileSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  displayName: z.string().min(1).max(100),
  username: UsernameSchema,
  bio: z.string().max(500).default(''),
  avatarUrl: z.string().url().nullable(),
  bannerUrl: z.string().url().nullable(),
  statusText: z.string().max(100).default(''),
  statusEmoji: z.string().max(10).default(''),
  location: z.string().max(100).default(''),
  websiteUrl: z.string().url().nullable(),
  karma: z.number().int().default(0),
  threadCount: z.number().int().nonnegative().default(0),
  replyCount: z.number().int().nonnegative().default(0),
  communitiesJoined: z.number().int().nonnegative().default(0),
  isVerified: z.boolean().default(false),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type UserProfile = z.infer<typeof UserProfileSchema>;

export const CreateProfileInputSchema = z.object({
  displayName: z.string().min(1).max(100),
  username: UsernameSchema,
  bio: z.string().max(500).optional(),
  avatarUrl: z.string().url().optional(),
});
export type CreateProfileInput = z.infer<typeof CreateProfileInputSchema>;

export const UpdateProfileInputSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  bio: z.string().max(500).optional(),
  avatarUrl: z.string().url().nullable().optional(),
  bannerUrl: z.string().url().nullable().optional(),
  statusText: z.string().max(100).optional(),
  statusEmoji: z.string().max(10).optional(),
  location: z.string().max(100).optional(),
  websiteUrl: z.string().url().nullable().optional(),
});
export type UpdateProfileInput = z.infer<typeof UpdateProfileInputSchema>;

// ── Profile Badges ──────────────────────────────────────────────────

export const BadgeTypeSchema = z.enum([
  'first_post',
  'first_reply',
  'karma_100',
  'karma_1000',
  'karma_10000',
  'veteran',
  'moderator',
  'prolific',
]);
export type BadgeType = z.infer<typeof BadgeTypeSchema>;

export const ProfileBadgeSchema = z.object({
  id: z.string().uuid(),
  profileId: z.string().uuid(),
  badgeType: BadgeTypeSchema,
  badgeLabel: z.string(),
  earnedAt: z.string().datetime(),
});
export type ProfileBadge = z.infer<typeof ProfileBadgeSchema>;
