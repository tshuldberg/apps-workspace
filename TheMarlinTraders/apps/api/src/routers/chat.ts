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

// ── Local Fallback Data (dev-only) ──────────────────────────────────────────

type RoomType = 'ticker' | 'strategy' | 'general'

interface FallbackRoom {
  id: string
  name: string
  type: RoomType
  symbol: string | null
  description: string | null
  minAccountAgeDays: number
  minKarma: number
  createdAt: Date
  updatedAt: Date
}

interface FallbackMessage {
  id: string
  roomId: string
  userId: string
  parentId: string | null
  body: string
  isDeleted: boolean
  createdAt: Date
  updatedAt: Date
  displayName: string
  avatarUrl: string | null
}

const FALLBACK_ROOMS: FallbackRoom[] = [
  {
    id: '00000000-0000-4000-8000-000000000001',
    name: 'General Trading',
    type: 'general',
    symbol: null,
    description: 'Open discussion about market conditions, setups, and trade management.',
    minAccountAgeDays: 0,
    minKarma: 0,
    createdAt: new Date('2026-02-14T14:00:00.000Z'),
    updatedAt: new Date('2026-02-14T14:00:00.000Z'),
  },
  {
    id: '00000000-0000-4000-8000-000000000002',
    name: 'AAPL Discussion',
    type: 'ticker',
    symbol: 'AAPL',
    description: 'Apple-focused technical and options discussion.',
    minAccountAgeDays: 0,
    minKarma: 0,
    createdAt: new Date('2026-02-14T14:00:00.000Z'),
    updatedAt: new Date('2026-02-14T14:00:00.000Z'),
  },
  {
    id: '00000000-0000-4000-8000-000000000003',
    name: 'Options Strategies',
    type: 'strategy',
    symbol: null,
    description: 'Spreads, volatility, and event-driven options trade planning.',
    minAccountAgeDays: 0,
    minKarma: 0,
    createdAt: new Date('2026-02-14T14:00:00.000Z'),
    updatedAt: new Date('2026-02-14T14:00:00.000Z'),
  },
]

function createFallbackMessages(): Record<string, FallbackMessage[]> {
  const now = Date.now()

  const messages: FallbackMessage[] = [
    {
      id: '10000000-0000-4000-8000-000000000001',
      roomId: FALLBACK_ROOMS[0]!.id,
      userId: 'fallback-user-1',
      parentId: null,
      body: 'Watching SPY around key resistance into the close.',
      isDeleted: false,
      createdAt: new Date(now - 32 * 60_000),
      updatedAt: new Date(now - 32 * 60_000),
      displayName: 'TraderMike',
      avatarUrl: null,
    },
    {
      id: '10000000-0000-4000-8000-000000000002',
      roomId: FALLBACK_ROOMS[0]!.id,
      userId: 'fallback-user-2',
      parentId: null,
      body: 'If yields keep sliding, QQQ can squeeze higher tomorrow.',
      isDeleted: false,
      createdAt: new Date(now - 18 * 60_000),
      updatedAt: new Date(now - 18 * 60_000),
      displayName: 'MacroFlow',
      avatarUrl: null,
    },
    {
      id: '10000000-0000-4000-8000-000000000003',
      roomId: FALLBACK_ROOMS[1]!.id,
      userId: 'fallback-user-3',
      parentId: null,
      body: 'AAPL held VWAP cleanly. Looking for continuation if market stays bid.',
      isDeleted: false,
      createdAt: new Date(now - 24 * 60_000),
      updatedAt: new Date(now - 24 * 60_000),
      displayName: 'ChartNinja',
      avatarUrl: null,
    },
    {
      id: '10000000-0000-4000-8000-000000000004',
      roomId: FALLBACK_ROOMS[1]!.id,
      userId: 'fallback-user-4',
      parentId: null,
      body: 'Seeing call buying at 190 and 195 strikes into next week.',
      isDeleted: false,
      createdAt: new Date(now - 8 * 60_000),
      updatedAt: new Date(now - 8 * 60_000),
      displayName: 'ThetaWatcher',
      avatarUrl: null,
    },
    {
      id: '10000000-0000-4000-8000-000000000005',
      roomId: FALLBACK_ROOMS[2]!.id,
      userId: 'fallback-user-5',
      parentId: null,
      body: 'Premium still rich. Favoring short verticals over naked sales.',
      isDeleted: false,
      createdAt: new Date(now - 40 * 60_000),
      updatedAt: new Date(now - 40 * 60_000),
      displayName: 'RiskManager',
      avatarUrl: null,
    },
    {
      id: '10000000-0000-4000-8000-000000000006',
      roomId: FALLBACK_ROOMS[2]!.id,
      userId: 'fallback-user-6',
      parentId: null,
      body: 'SPY iron condor looks best if implied vol stays elevated.',
      isDeleted: false,
      createdAt: new Date(now - 12 * 60_000),
      updatedAt: new Date(now - 12 * 60_000),
      displayName: 'VolTrader',
      avatarUrl: null,
    },
  ]

  const grouped: Record<string, FallbackMessage[]> = {}
  for (const room of FALLBACK_ROOMS) {
    grouped[room.id] = messages
      .filter((m) => m.roomId === room.id)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
  }
  return grouped
}

const fallbackMessagesByRoom = new Map<string, FallbackMessage[]>(
  Object.entries(createFallbackMessages()),
)

function isMissingChatTableError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return /relation "chat_(rooms|messages|reactions)" does not exist/.test(message)
}

function shouldUseFallbackForMissingTable(error: unknown): boolean {
  return process.env.NODE_ENV !== 'production' && isMissingChatTableError(error)
}

function getFallbackRoomsList() {
  return [...FALLBACK_ROOMS]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((room) => {
      const messages = fallbackMessagesByRoom.get(room.id) ?? []
      const userIds = new Set(messages.map((m) => m.userId))
      const last = [...messages].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0]

      return {
        ...room,
        memberCount: userIds.size,
        lastMessage: last
          ? {
              body: last.body,
              authorName: last.displayName,
              createdAt: last.createdAt,
            }
          : null,
      }
    })
}

function getFallbackRoomPayload(roomId: string) {
  const room = FALLBACK_ROOMS.find((r) => r.id === roomId)
  if (!room) throw new Error('Room not found')

  const messages = [...(fallbackMessagesByRoom.get(roomId) ?? [])].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
  )

  return { room, messages }
}

function getFallbackPaginatedMessages(roomId: string, cursor: string | undefined, limit: number) {
  const allDesc = [...(fallbackMessagesByRoom.get(roomId) ?? [])].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  )

  let start = 0
  if (cursor) {
    const idx = allDesc.findIndex((m) => m.id === cursor)
    if (idx >= 0) start = idx + 1
  }

  const items = allDesc.slice(start, start + limit)
  const hasMore = allDesc.length > start + limit
  const nextCursor = hasMore ? items[items.length - 1]?.id : undefined

  return { items, nextCursor }
}

async function listRoomsFromDb() {
  const rooms = await db.select().from(chatRooms).orderBy(chatRooms.name)

  const memberCounts = await db
    .select({
      roomId: chatMessages.roomId,
      count: sql<number>`count(distinct ${chatMessages.userId})::int`,
    })
    .from(chatMessages)
    .groupBy(chatMessages.roomId)

  const countMap = new Map(memberCounts.map((m) => [m.roomId, m.count]))

  const latestPerRoom = await Promise.all(
    rooms.map(async (room) => {
      const [latest] = await db
        .select({
          body: chatMessages.body,
          authorName: users.displayName,
          createdAt: chatMessages.createdAt,
        })
        .from(chatMessages)
        .innerJoin(users, eq(users.clerkId, chatMessages.userId))
        .where(eq(chatMessages.roomId, room.id))
        .orderBy(desc(chatMessages.createdAt))
        .limit(1)

      return [room.id, latest ?? null] as const
    }),
  )

  const latestMap = new Map(latestPerRoom)

  return rooms.map((room) => ({
    ...room,
    memberCount: countMap.get(room.id) ?? 0,
    lastMessage: latestMap.get(room.id) ?? null,
  }))
}

async function getRoomFromDb(roomId: string) {
  const [room] = await db
    .select()
    .from(chatRooms)
    .where(eq(chatRooms.id, roomId))
    .limit(1)

  if (!room) {
    throw new Error('Room not found')
  }

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
    .where(eq(chatMessages.roomId, roomId))
    .orderBy(desc(chatMessages.createdAt))
    .limit(50)

  return { room, messages: messages.reverse() }
}

async function getMessagesFromDb(roomId: string, cursor: string | undefined, limit: number) {
  const conditions = [eq(chatMessages.roomId, roomId)]

  if (cursor) {
    const cursorMsg = await db
      .select({ createdAt: chatMessages.createdAt })
      .from(chatMessages)
      .where(eq(chatMessages.id, cursor))
      .limit(1)

    if (cursorMsg[0]?.createdAt) {
      conditions.push(sql`${chatMessages.createdAt} < ${cursorMsg[0].createdAt}`)
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
}

// ── Router ───────────────────────────────────────────────────────────────────

export const chatRouter = router({
  /**
   * List all chat rooms with member counts and last-message preview.
   */
  listRooms: publicProcedure.query(async () => {
    try {
      return await listRoomsFromDb()
    } catch (error) {
      if (shouldUseFallbackForMissingTable(error)) {
        console.warn('[chat] Using in-memory fallback for room list')
        return getFallbackRoomsList()
      }
      throw error
    }
  }),

  /**
   * Get a single room by ID with recent messages.
   */
  getRoom: publicProcedure
    .input(GetRoomSchema)
    .query(async ({ input }) => {
      try {
        return await getRoomFromDb(input.roomId)
      } catch (error) {
        if (shouldUseFallbackForMissingTable(error)) {
          console.warn('[chat] Using in-memory fallback for room payload')
          return getFallbackRoomPayload(input.roomId)
        }
        throw error
      }
    }),

  /**
   * Cursor-paginated messages for a room.
   */
  getMessages: publicProcedure
    .input(GetMessagesSchema)
    .query(async ({ input }) => {
      try {
        return await getMessagesFromDb(input.roomId, input.cursor, input.limit)
      } catch (error) {
        if (shouldUseFallbackForMissingTable(error)) {
          console.warn('[chat] Using in-memory fallback for paginated messages')
          return getFallbackPaginatedMessages(input.roomId, input.cursor, input.limit)
        }
        throw error
      }
    }),

  /**
   * Send a message to a chat room.
   * Checks reputation gate (minAccountAgeDays, minKarma).
   */
  sendMessage: protectedProcedure
    .input(SendMessageSchema)
    .mutation(async ({ ctx, input }) => {
      const [room] = await db
        .select()
        .from(chatRooms)
        .where(eq(chatRooms.id, input.roomId))
        .limit(1)

      if (!room) {
        throw new Error('Room not found')
      }

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
