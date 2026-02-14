import { z } from 'zod'
import { eq, and, desc, sql } from 'drizzle-orm'
import { router, protectedProcedure, publicProcedure } from '../trpc.js'
import { db } from '../db/connection.js'
import { profiles, verificationBadges, follows, privacySettings } from '../db/schema/profiles.js'
import { users } from '../db/schema/users.js'

// ── Input Schemas ────────────────────────────────────────────────────────────

const UpdateProfileSchema = z.object({
  displayName: z.string().max(100).optional(),
  bio: z.string().max(2000).optional(),
  strategyDescription: z.string().max(5000).optional(),
  website: z.string().url().max(500).optional().nullable(),
  twitter: z.string().max(100).optional().nullable(),
})

const UpdatePrivacySchema = z.object({
  showStats: z.boolean().optional(),
  showIdeas: z.boolean().optional(),
  showJournal: z.boolean().optional(),
})

const FollowSchema = z.object({
  userId: z.string().min(1),
})

const PaginatedFollowSchema = z.object({
  userId: z.string().min(1),
  cursor: z.string().uuid().optional(),
  limit: z.number().int().min(1).max(100).default(20),
})

// ── Router ───────────────────────────────────────────────────────────────────

export const profilesRouter = router({
  /**
   * Get a user's public profile with stats, badges, and follow counts.
   */
  getProfile: publicProcedure
    .input(z.object({ userId: z.string().min(1) }))
    .query(async ({ input }) => {
      // Get user
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.clerkId, input.userId))
        .limit(1)

      if (!user) {
        throw new Error('User not found')
      }

      // Get profile (may not exist yet)
      const [profile] = await db
        .select()
        .from(profiles)
        .where(eq(profiles.userId, input.userId))
        .limit(1)

      // Get verification badges
      const badges = await db
        .select()
        .from(verificationBadges)
        .where(eq(verificationBadges.userId, input.userId))

      // Get follow counts
      const [followerCount] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(follows)
        .where(eq(follows.followingId, input.userId))

      const [followingCount] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(follows)
        .where(eq(follows.followerId, input.userId))

      // Get privacy settings
      const [privacy] = await db
        .select()
        .from(privacySettings)
        .where(eq(privacySettings.userId, input.userId))
        .limit(1)

      return {
        user: {
          clerkId: user.clerkId,
          email: user.email,
          displayName: profile?.displayName ?? user.displayName,
          avatarUrl: profile?.avatarUrl ?? user.avatarUrl,
          tier: user.tier,
          createdAt: user.createdAt,
        },
        profile: profile
          ? {
              bio: profile.bio,
              strategyDescription: profile.strategyDescription,
              website: profile.website,
              twitter: profile.twitter,
            }
          : null,
        badges: badges.map((b) => ({
          badgeType: b.badgeType,
          verifiedAt: b.verifiedAt,
          metadata: b.metadata,
        })),
        followerCount: followerCount?.count ?? 0,
        followingCount: followingCount?.count ?? 0,
        privacy: {
          showStats: privacy?.showStats ?? true,
          showIdeas: privacy?.showIdeas ?? true,
          showJournal: privacy?.showJournal ?? false,
        },
      }
    }),

  /**
   * Update the authenticated user's profile.
   */
  updateProfile: protectedProcedure
    .input(UpdateProfileSchema)
    .mutation(async ({ ctx, input }) => {
      // Upsert profile: insert if not exists, update if exists
      const [existing] = await db
        .select()
        .from(profiles)
        .where(eq(profiles.userId, ctx.userId))
        .limit(1)

      if (existing) {
        const [updated] = await db
          .update(profiles)
          .set({
            ...input,
            updatedAt: new Date(),
          })
          .where(eq(profiles.userId, ctx.userId))
          .returning()

        return updated
      }

      const [created] = await db
        .insert(profiles)
        .values({
          userId: ctx.userId,
          ...input,
        })
        .returning()

      return created
    }),

  /**
   * Update privacy settings for the authenticated user.
   */
  updatePrivacy: protectedProcedure
    .input(UpdatePrivacySchema)
    .mutation(async ({ ctx, input }) => {
      const [existing] = await db
        .select()
        .from(privacySettings)
        .where(eq(privacySettings.userId, ctx.userId))
        .limit(1)

      if (existing) {
        const [updated] = await db
          .update(privacySettings)
          .set({
            ...input,
            updatedAt: new Date(),
          })
          .where(eq(privacySettings.userId, ctx.userId))
          .returning()

        return updated
      }

      const [created] = await db
        .insert(privacySettings)
        .values({
          userId: ctx.userId,
          showStats: input.showStats ?? true,
          showIdeas: input.showIdeas ?? true,
          showJournal: input.showJournal ?? false,
        })
        .returning()

      return created
    }),

  /**
   * Follow a user.
   */
  follow: protectedProcedure
    .input(FollowSchema)
    .mutation(async ({ ctx, input }) => {
      if (ctx.userId === input.userId) {
        throw new Error('You cannot follow yourself')
      }

      // Check if already following
      const [existing] = await db
        .select()
        .from(follows)
        .where(
          and(
            eq(follows.followerId, ctx.userId),
            eq(follows.followingId, input.userId),
          ),
        )
        .limit(1)

      if (existing) {
        return { action: 'already_following' as const }
      }

      await db
        .insert(follows)
        .values({
          followerId: ctx.userId,
          followingId: input.userId,
        })

      return { action: 'followed' as const }
    }),

  /**
   * Unfollow a user.
   */
  unfollow: protectedProcedure
    .input(FollowSchema)
    .mutation(async ({ ctx, input }) => {
      const deleted = await db
        .delete(follows)
        .where(
          and(
            eq(follows.followerId, ctx.userId),
            eq(follows.followingId, input.userId),
          ),
        )
        .returning()

      if (deleted.length === 0) {
        return { action: 'not_following' as const }
      }

      return { action: 'unfollowed' as const }
    }),

  /**
   * Check if the current user follows a target user.
   */
  isFollowing: protectedProcedure
    .input(z.object({ userId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const [existing] = await db
        .select()
        .from(follows)
        .where(
          and(
            eq(follows.followerId, ctx.userId),
            eq(follows.followingId, input.userId),
          ),
        )
        .limit(1)

      return { isFollowing: !!existing }
    }),

  /**
   * Get a user's followers with cursor pagination.
   */
  getFollowers: publicProcedure
    .input(PaginatedFollowSchema)
    .query(async ({ input }) => {
      const limit = input.limit
      const conditions = [eq(follows.followingId, input.userId)]

      if (input.cursor) {
        const cursorFollow = await db
          .select({ createdAt: follows.createdAt })
          .from(follows)
          .where(eq(follows.id, input.cursor))
          .limit(1)

        if (cursorFollow[0]?.createdAt) {
          conditions.push(
            sql`${follows.createdAt} < ${cursorFollow[0].createdAt}`,
          )
        }
      }

      const results = await db
        .select({
          id: follows.id,
          followerId: follows.followerId,
          createdAt: follows.createdAt,
          displayName: users.displayName,
          avatarUrl: users.avatarUrl,
        })
        .from(follows)
        .innerJoin(users, eq(users.clerkId, follows.followerId))
        .where(and(...conditions))
        .orderBy(desc(follows.createdAt))
        .limit(limit + 1)

      const hasMore = results.length > limit
      const items = hasMore ? results.slice(0, limit) : results
      const nextCursor = hasMore ? items[items.length - 1]?.id : undefined

      return { items, nextCursor }
    }),

  /**
   * Get users that a user is following with cursor pagination.
   */
  getFollowing: publicProcedure
    .input(PaginatedFollowSchema)
    .query(async ({ input }) => {
      const limit = input.limit
      const conditions = [eq(follows.followerId, input.userId)]

      if (input.cursor) {
        const cursorFollow = await db
          .select({ createdAt: follows.createdAt })
          .from(follows)
          .where(eq(follows.id, input.cursor))
          .limit(1)

        if (cursorFollow[0]?.createdAt) {
          conditions.push(
            sql`${follows.createdAt} < ${cursorFollow[0].createdAt}`,
          )
        }
      }

      const results = await db
        .select({
          id: follows.id,
          followingId: follows.followingId,
          createdAt: follows.createdAt,
          displayName: users.displayName,
          avatarUrl: users.avatarUrl,
        })
        .from(follows)
        .innerJoin(users, eq(users.clerkId, follows.followingId))
        .where(and(...conditions))
        .orderBy(desc(follows.createdAt))
        .limit(limit + 1)

      const hasMore = results.length > limit
      const items = hasMore ? results.slice(0, limit) : results
      const nextCursor = hasMore ? items[items.length - 1]?.id : undefined

      return { items, nextCursor }
    }),
})
