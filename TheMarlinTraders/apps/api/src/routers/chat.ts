import { z } from 'zod'
import { eq, and, desc, sql } from 'drizzle-orm'
import { router, protectedProcedure, publicProcedure } from '../trpc.js'
import { db } from '../db/connection.js'
import { chatRooms, chatMessages, chatReactions } from '../db/schema/chat.js'
import { users } from '../db/schema/users.js'

// ── Input Schemas ────────────────────────────────────────────────────────────

const GetRoomSchema = z.object({
  roomId: z.string().uuid(),
})

const GetMessagesSchema = z.object({
  roomId: z.string().uuid(),
  cursor: z.string().uuid().optional(),
  limit: z.number().int().min(1).max(100).default(50),
})

const SendMessageSchema = z.object({
  roomId: z.string().uuid(),
  body: z.string().min(1).max(10000),
  parentId: z.string().uuid().optional(),
})

const DeleteMessageSchema = z.object({
  messageId: z.string().uuid(),
})

const ReactionSchema = z.object({
  messageId: z.string().uuid(),
  emoji: z.string().min(1).max(8),
})

// ── Router ───────────────────────────────────────────────────────────────────

export const chatRouter = router({
  /**
   * List all chat rooms with member counts (unique message authors).
   */
  listRooms: publicProcedure.query(async () => {
    const rooms = await db.select().from(chatRooms).orderBy(chatRooms.name)

    // Get unique author count per room as a proxy for "member count"
    const memberCounts = await db
      .select({
        roomId: chatMessages.roomId,
        count: sql<number>`count(distinct ${chatMessages.userId})::int`,
      })
      .from(chatMessages)
      .groupBy(chatMessages.roomId)

    const countMap = new Map(memberCounts.map((m) => [m.roomId, m.count]))

    return rooms.map((room) => ({
      ...room,
      memberCount: countMap.get(room.id) ?? 0,
    }))
  }),

  /**
   * Get a single room by ID with recent messages.
   */
  getRoom: publicProcedure
    .input(GetRoomSchema)
    .query(async ({ input }) => {
      const [room] = await db
        .select()
        .from(chatRooms)
        .where(eq(chatRooms.id, input.roomId))
        .limit(1)

      if (!room) {
        throw new Error('Room not found')
      }

      // Fetch recent messages
      const messages = await db
        .select({
          id: chatMessages.id,
          roomId: chatMessages.roomId,
          userId: chatMessages.userId,
          parentId: chatMessages.parentId,
          body: chatMessages.body,
          isDeleted: chatMessages.isDeleted,
          createdAt: chatMessages.createdAt,
          updatedAt: chatMessages.updatedAt,
          displayName: users.displayName,
          avatarUrl: users.avatarUrl,
        })
        .from(chatMessages)
        .innerJoin(users, eq(users.clerkId, chatMessages.userId))
        .where(eq(chatMessages.roomId, input.roomId))
        .orderBy(desc(chatMessages.createdAt))
        .limit(50)

      return { room, messages: messages.reverse() }
    }),

  /**
   * Cursor-paginated messages for a room.
   */
  getMessages: publicProcedure
    .input(GetMessagesSchema)
    .query(async ({ input }) => {
      const limit = input.limit
      const conditions = [eq(chatMessages.roomId, input.roomId)]

      if (input.cursor) {
        const cursorMsg = await db
          .select({ createdAt: chatMessages.createdAt })
          .from(chatMessages)
          .where(eq(chatMessages.id, input.cursor))
          .limit(1)

        if (cursorMsg[0]?.createdAt) {
          conditions.push(
            sql`${chatMessages.createdAt} < ${cursorMsg[0].createdAt}`,
          )
        }
      }

      const results = await db
        .select({
          id: chatMessages.id,
          roomId: chatMessages.roomId,
          userId: chatMessages.userId,
          parentId: chatMessages.parentId,
          body: chatMessages.body,
          isDeleted: chatMessages.isDeleted,
          createdAt: chatMessages.createdAt,
          updatedAt: chatMessages.updatedAt,
          displayName: users.displayName,
          avatarUrl: users.avatarUrl,
        })
        .from(chatMessages)
        .innerJoin(users, eq(users.clerkId, chatMessages.userId))
        .where(and(...conditions))
        .orderBy(desc(chatMessages.createdAt))
        .limit(limit + 1)

      const hasMore = results.length > limit
      const items = hasMore ? results.slice(0, limit) : results
      const nextCursor = hasMore ? items[items.length - 1]?.id : undefined

      return { items, nextCursor }
    }),

  /**
   * Send a message to a chat room.
   * Checks reputation gate (minAccountAgeDays, minKarma).
   */
  sendMessage: protectedProcedure
    .input(SendMessageSchema)
    .mutation(async ({ ctx, input }) => {
      // Fetch room for reputation gates
      const [room] = await db
        .select()
        .from(chatRooms)
        .where(eq(chatRooms.id, input.roomId))
        .limit(1)

      if (!room) {
        throw new Error('Room not found')
      }

      // Check reputation gate: account age
      if (room.minAccountAgeDays > 0) {
        const [user] = await db
          .select({ createdAt: users.createdAt })
          .from(users)
          .where(eq(users.clerkId, ctx.userId))
          .limit(1)

        if (user) {
          const accountAgeDays = Math.floor(
            (Date.now() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60 * 24),
          )
          if (accountAgeDays < room.minAccountAgeDays) {
            throw new Error(
              `Your account must be at least ${room.minAccountAgeDays} days old to post in this room`,
            )
          }
        }
      }

      // TODO: Check minKarma when karma system is implemented

      const [message] = await db
        .insert(chatMessages)
        .values({
          roomId: input.roomId,
          userId: ctx.userId,
          body: input.body,
          parentId: input.parentId ?? null,
        })
        .returning()

      return message
    }),

  /**
   * Soft-delete a message. Only the message author can delete.
   * TODO: Add admin role check.
   */
  deleteMessage: protectedProcedure
    .input(DeleteMessageSchema)
    .mutation(async ({ ctx, input }) => {
      const [updated] = await db
        .update(chatMessages)
        .set({ isDeleted: true, updatedAt: new Date() })
        .where(
          and(
            eq(chatMessages.id, input.messageId),
            eq(chatMessages.userId, ctx.userId),
          ),
        )
        .returning()

      if (!updated) {
        throw new Error('Message not found or not owned by you')
      }

      return updated
    }),

  /**
   * Add a reaction to a message. Upserts (unique on messageId+userId+emoji).
   */
  addReaction: protectedProcedure
    .input(ReactionSchema)
    .mutation(async ({ ctx, input }) => {
      // Check if reaction already exists
      const [existing] = await db
        .select()
        .from(chatReactions)
        .where(
          and(
            eq(chatReactions.messageId, input.messageId),
            eq(chatReactions.userId, ctx.userId),
            eq(chatReactions.emoji, input.emoji),
          ),
        )
        .limit(1)

      if (existing) {
        return { action: 'already_exists' as const, reaction: existing }
      }

      const [reaction] = await db
        .insert(chatReactions)
        .values({
          messageId: input.messageId,
          userId: ctx.userId,
          emoji: input.emoji,
        })
        .returning()

      return { action: 'added' as const, reaction }
    }),

  /**
   * Remove a reaction from a message.
   */
  removeReaction: protectedProcedure
    .input(ReactionSchema)
    .mutation(async ({ ctx, input }) => {
      const deleted = await db
        .delete(chatReactions)
        .where(
          and(
            eq(chatReactions.messageId, input.messageId),
            eq(chatReactions.userId, ctx.userId),
            eq(chatReactions.emoji, input.emoji),
          ),
        )
        .returning()

      if (deleted.length === 0) {
        return { action: 'not_found' as const }
      }

      return { action: 'removed' as const }
    }),
})
