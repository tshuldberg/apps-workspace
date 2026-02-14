import { z } from 'zod'
import { eq, and, desc } from 'drizzle-orm'
import { TRPCError } from '@trpc/server'
import { router, protectedProcedure } from '../trpc.js'
import { db } from '../db/connection.js'
import { contentReports } from '../db/schema/moderation.js'
import { users } from '../db/schema/users.js'
import {
  reportContent as reportContentService,
  getModerationQueueItems,
  moderateItem as moderateItemService,
} from '../services/moderation.js'

// ── Input Schemas ────────────────────────────────────────────────────────────

const ReportContentSchema = z.object({
  contentType: z.enum(['idea', 'comment', 'chat_message', 'profile']),
  contentId: z.string().uuid(),
  authorId: z.string().min(1),
  reason: z.enum([
    'spam',
    'harassment',
    'hate_speech',
    'misinformation',
    'inappropriate',
    'self_harm',
    'other',
  ]),
  description: z.string().max(2000).optional(),
})

const GetModerationQueueSchema = z.object({
  status: z
    .enum(['pending', 'approved', 'rejected', 'auto_flagged', 'escalated'])
    .optional(),
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).default(0),
})

const ModerateItemSchema = z.object({
  queueItemId: z.string().uuid(),
  action: z.enum(['approve', 'reject', 'warn', 'mute', 'ban']),
  note: z.string().max(2000).optional(),
})

const GetUserReportsSchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.number().int().min(1).max(100).default(20),
})

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Check if a user has admin privileges.
 * In production this would check against a roles table or Clerk metadata;
 * for now we check the `institutional` tier as a proxy for admin access.
 */
async function requireAdmin(userId: string): Promise<void> {
  const [user] = await db
    .select({ tier: users.tier })
    .from(users)
    .where(eq(users.clerkId, userId))
    .limit(1)

  // Admin access requires institutional tier (placeholder for a proper roles system)
  if (user?.tier !== 'institutional') {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Admin access required',
    })
  }
}

// ── Router ───────────────────────────────────────────────────────────────────

export const moderationRouter = router({
  /**
   * Report an idea, comment, or chat message for moderation.
   * One report per user per content item (deduplicated).
   */
  reportContent: protectedProcedure
    .input(ReportContentSchema)
    .mutation(async ({ ctx, input }) => {
      // Prevent self-reports
      if (input.authorId === ctx.userId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'You cannot report your own content',
        })
      }

      const result = await reportContentService({
        reporterId: ctx.userId,
        contentType: input.contentType,
        contentId: input.contentId,
        authorId: input.authorId,
        reason: input.reason,
        description: input.description,
      })

      return result
    }),

  /**
   * Get the moderation queue (admin only).
   * Returns flagged/escalated items pending review.
   */
  getModerationQueue: protectedProcedure
    .input(GetModerationQueueSchema.optional())
    .query(async ({ ctx, input }) => {
      await requireAdmin(ctx.userId)

      const params = input ?? {}
      return getModerationQueueItems({
        status: params.status,
        limit: params.limit ?? 50,
        offset: params.offset ?? 0,
      })
    }),

  /**
   * Take a moderation action on a queued item (admin only).
   * Actions: approve, reject, warn, mute, ban.
   */
  moderateItem: protectedProcedure
    .input(ModerateItemSchema)
    .mutation(async ({ ctx, input }) => {
      await requireAdmin(ctx.userId)

      return moderateItemService({
        queueItemId: input.queueItemId,
        moderatorId: ctx.userId,
        action: input.action,
        note: input.note,
      })
    }),

  /**
   * Get reports submitted by the current user.
   * Users can see the status of their own reports.
   */
  getUserReports: protectedProcedure
    .input(GetUserReportsSchema.optional())
    .query(async ({ ctx, input }) => {
      const limit = input?.limit ?? 20
      const conditions = [eq(contentReports.reporterId, ctx.userId)]

      if (input?.cursor) {
        const cursorReport = await db
          .select({ createdAt: contentReports.createdAt })
          .from(contentReports)
          .where(eq(contentReports.id, input.cursor))
          .limit(1)

        if (cursorReport[0]?.createdAt) {
          const { sql } = await import('drizzle-orm')
          conditions.push(
            sql`${contentReports.createdAt} < ${cursorReport[0].createdAt}`,
          )
        }
      }

      const results = await db
        .select()
        .from(contentReports)
        .where(and(...conditions))
        .orderBy(desc(contentReports.createdAt))
        .limit(limit + 1)

      const hasMore = results.length > limit
      const items = hasMore ? results.slice(0, limit) : results
      const nextCursor = hasMore ? items[items.length - 1]?.id : undefined

      return { items, nextCursor }
    }),
})
