import { z } from 'zod'
import { eq, and, desc, sql, inArray } from 'drizzle-orm'
import { router, protectedProcedure, publicProcedure } from '../trpc.js'
import { db } from '../db/connection.js'
import { ideas, ideaComments, ideaVotes } from '../db/schema/social.js'

// ── Input Schemas ────────────────────────────────────────────────────────────

const CreateIdeaSchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(50000),
  symbol: z.string().min(1).max(10).transform((s) => s.toUpperCase()),
  sentiment: z.enum(['bullish', 'bearish', 'neutral']).default('neutral'),
  tags: z.array(z.string().max(50)).max(10).default([]),
  chartSnapshotUrl: z.string().url().optional(),
  timeframe: z.string().max(20).optional(),
})

const ListIdeasSchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.number().int().min(1).max(100).default(20),
  filter: z
    .object({
      symbol: z.string().max(10).optional(),
      sentiment: z.enum(['bullish', 'bearish', 'neutral']).optional(),
      tag: z.string().max(50).optional(),
      sort: z.enum(['recent', 'top', 'hot']).default('recent'),
    })
    .optional(),
})

const VoteSchema = z.object({
  ideaId: z.string().uuid(),
  voteType: z.enum(['up', 'down']),
})

const CommentSchema = z.object({
  ideaId: z.string().uuid(),
  body: z.string().min(1).max(10000),
  parentId: z.string().uuid().optional(),
})

const ListCommentsSchema = z.object({
  ideaId: z.string().uuid(),
  cursor: z.string().uuid().optional(),
  limit: z.number().int().min(1).max(100).default(50),
})

const PaginatedUserIdeas = z.object({
  userId: z.string().min(1),
  cursor: z.string().uuid().optional(),
  limit: z.number().int().min(1).max(100).default(20),
})

// ── Router ───────────────────────────────────────────────────────────────────

export const ideasRouter = router({
  /**
   * Create a new idea (draft by default).
   */
  create: protectedProcedure
    .input(CreateIdeaSchema)
    .mutation(async ({ ctx, input }) => {
      const [idea] = await db
        .insert(ideas)
        .values({
          userId: ctx.userId,
          title: input.title,
          body: input.body,
          symbol: input.symbol,
          sentiment: input.sentiment,
          tags: input.tags,
          chartSnapshotUrl: input.chartSnapshotUrl,
          timeframe: input.timeframe,
        })
        .returning()

      return idea
    }),

  /**
   * Publish a draft idea.
   */
  publish: protectedProcedure
    .input(z.object({ ideaId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await db
        .update(ideas)
        .set({
          isPublished: true,
          publishedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(ideas.id, input.ideaId),
            eq(ideas.userId, ctx.userId),
            eq(ideas.isDeleted, false),
          ),
        )
        .returning()

      if (!updated) {
        throw new Error('Idea not found or not owned by you')
      }

      return updated
    }),

  /**
   * Paginated idea feed with filtering and sorting.
   */
  list: publicProcedure
    .input(ListIdeasSchema.optional())
    .query(async ({ input }) => {
      const limit = input?.limit ?? 20
      const filter = input?.filter
      const sort = filter?.sort ?? 'recent'

      const conditions = [
        eq(ideas.isPublished, true),
        eq(ideas.isDeleted, false),
      ]

      if (filter?.symbol) {
        conditions.push(eq(ideas.symbol, filter.symbol.toUpperCase()))
      }
      if (filter?.sentiment) {
        conditions.push(eq(ideas.sentiment, filter.sentiment))
      }

      // Determine sort order
      let orderBy
      switch (sort) {
        case 'top':
          orderBy = desc(ideas.upvotes)
          break
        case 'hot':
          // Hot = upvotes weighted by recency (simple: upvotes - downvotes, then recency)
          orderBy = desc(sql`(${ideas.upvotes} - ${ideas.downvotes})`)
          break
        case 'recent':
        default:
          orderBy = desc(ideas.publishedAt)
          break
      }

      // Cursor-based pagination: fetch ideas older than cursor
      if (input?.cursor) {
        const cursorIdea = await db
          .select({ publishedAt: ideas.publishedAt })
          .from(ideas)
          .where(eq(ideas.id, input.cursor))
          .limit(1)

        if (cursorIdea[0]?.publishedAt) {
          conditions.push(
            sql`${ideas.publishedAt} < ${cursorIdea[0].publishedAt}`,
          )
        }
      }

      const results = await db
        .select()
        .from(ideas)
        .where(and(...conditions))
        .orderBy(orderBy)
        .limit(limit + 1)

      const hasMore = results.length > limit
      const items = hasMore ? results.slice(0, limit) : results
      const nextCursor = hasMore ? items[items.length - 1]?.id : undefined

      // Filter by tag in application if needed (array containment)
      let filtered = items
      if (filter?.tag) {
        filtered = items.filter((i) => i.tags.includes(filter.tag!))
      }

      return { items: filtered, nextCursor }
    }),

  /**
   * Get a single idea by ID.
   */
  getById: publicProcedure
    .input(z.object({ ideaId: z.string().uuid() }))
    .query(async ({ input }) => {
      const [idea] = await db
        .select()
        .from(ideas)
        .where(
          and(
            eq(ideas.id, input.ideaId),
            eq(ideas.isDeleted, false),
          ),
        )
        .limit(1)

      if (!idea) {
        throw new Error('Idea not found')
      }

      return idea
    }),

  /**
   * Upvote or downvote an idea. Toggles if same vote type already exists.
   */
  vote: protectedProcedure
    .input(VoteSchema)
    .mutation(async ({ ctx, input }) => {
      // Check for existing vote
      const [existing] = await db
        .select()
        .from(ideaVotes)
        .where(
          and(
            eq(ideaVotes.ideaId, input.ideaId),
            eq(ideaVotes.userId, ctx.userId),
          ),
        )
        .limit(1)

      if (existing) {
        if (existing.voteType === input.voteType) {
          // Same vote — remove it (toggle off)
          await db
            .delete(ideaVotes)
            .where(eq(ideaVotes.id, existing.id))

          // Decrement the counter
          const field = input.voteType === 'up' ? ideas.upvotes : ideas.downvotes
          await db
            .update(ideas)
            .set({
              [input.voteType === 'up' ? 'upvotes' : 'downvotes']: sql`${field} - 1`,
              updatedAt: new Date(),
            })
            .where(eq(ideas.id, input.ideaId))

          return { action: 'removed' as const, voteType: input.voteType }
        } else {
          // Different vote — switch it
          await db
            .update(ideaVotes)
            .set({ voteType: input.voteType })
            .where(eq(ideaVotes.id, existing.id))

          // Adjust counters: increment new, decrement old
          const incrField = input.voteType === 'up' ? 'upvotes' : 'downvotes'
          const decrField = input.voteType === 'up' ? 'downvotes' : 'upvotes'
          await db
            .update(ideas)
            .set({
              [incrField]: sql`${input.voteType === 'up' ? ideas.upvotes : ideas.downvotes} + 1`,
              [decrField]: sql`${input.voteType === 'up' ? ideas.downvotes : ideas.upvotes} - 1`,
              updatedAt: new Date(),
            })
            .where(eq(ideas.id, input.ideaId))

          return { action: 'switched' as const, voteType: input.voteType }
        }
      }

      // New vote
      await db
        .insert(ideaVotes)
        .values({
          ideaId: input.ideaId,
          userId: ctx.userId,
          voteType: input.voteType,
        })

      const field = input.voteType === 'up' ? 'upvotes' : 'downvotes'
      await db
        .update(ideas)
        .set({
          [field]: sql`${input.voteType === 'up' ? ideas.upvotes : ideas.downvotes} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(ideas.id, input.ideaId))

      return { action: 'added' as const, voteType: input.voteType }
    }),

  /**
   * Add a comment to an idea (supports threading via parentId).
   */
  comment: protectedProcedure
    .input(CommentSchema)
    .mutation(async ({ ctx, input }) => {
      const [comment] = await db
        .insert(ideaComments)
        .values({
          ideaId: input.ideaId,
          userId: ctx.userId,
          body: input.body,
          parentId: input.parentId ?? null,
        })
        .returning()

      // Increment comment count on the idea
      await db
        .update(ideas)
        .set({
          commentCount: sql`${ideas.commentCount} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(ideas.id, input.ideaId))

      return comment
    }),

  /**
   * List comments for an idea with cursor pagination.
   * Returns top-level comments; replies are nested client-side.
   */
  listComments: publicProcedure
    .input(ListCommentsSchema)
    .query(async ({ input }) => {
      const limit = input.limit
      const conditions = [eq(ideaComments.ideaId, input.ideaId)]

      if (input.cursor) {
        const cursorComment = await db
          .select({ createdAt: ideaComments.createdAt })
          .from(ideaComments)
          .where(eq(ideaComments.id, input.cursor))
          .limit(1)

        if (cursorComment[0]?.createdAt) {
          conditions.push(
            sql`${ideaComments.createdAt} < ${cursorComment[0].createdAt}`,
          )
        }
      }

      const results = await db
        .select()
        .from(ideaComments)
        .where(and(...conditions))
        .orderBy(desc(ideaComments.createdAt))
        .limit(limit + 1)

      const hasMore = results.length > limit
      const items = hasMore ? results.slice(0, limit) : results
      const nextCursor = hasMore ? items[items.length - 1]?.id : undefined

      return { items, nextCursor }
    }),

  /**
   * Soft-delete an idea (owner only).
   */
  delete: protectedProcedure
    .input(z.object({ ideaId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [deleted] = await db
        .update(ideas)
        .set({ isDeleted: true, updatedAt: new Date() })
        .where(
          and(
            eq(ideas.id, input.ideaId),
            eq(ideas.userId, ctx.userId),
          ),
        )
        .returning()

      if (!deleted) {
        throw new Error('Idea not found or not owned by you')
      }

      return deleted
    }),

  /**
   * List ideas by a specific user (published only).
   */
  listByUser: publicProcedure
    .input(PaginatedUserIdeas)
    .query(async ({ input }) => {
      const limit = input.limit
      const conditions = [
        eq(ideas.userId, input.userId),
        eq(ideas.isPublished, true),
        eq(ideas.isDeleted, false),
      ]

      if (input.cursor) {
        const cursorIdea = await db
          .select({ publishedAt: ideas.publishedAt })
          .from(ideas)
          .where(eq(ideas.id, input.cursor))
          .limit(1)

        if (cursorIdea[0]?.publishedAt) {
          conditions.push(
            sql`${ideas.publishedAt} < ${cursorIdea[0].publishedAt}`,
          )
        }
      }

      const results = await db
        .select()
        .from(ideas)
        .where(and(...conditions))
        .orderBy(desc(ideas.publishedAt))
        .limit(limit + 1)

      const hasMore = results.length > limit
      const items = hasMore ? results.slice(0, limit) : results
      const nextCursor = hasMore ? items[items.length - 1]?.id : undefined

      return { items, nextCursor }
    }),
})
