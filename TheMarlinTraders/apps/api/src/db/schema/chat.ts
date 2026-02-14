import {
  boolean,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { users } from './users.js'

// ── Enums ────────────────────────────────────────────────────────────────────

export const chatRoomTypeEnum = pgEnum('chat_room_type', [
  'ticker',
  'strategy',
  'general',
])

// ── Chat Rooms ──────────────────────────────────────────────────────────────

export const chatRooms = pgTable('chat_rooms', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  type: chatRoomTypeEnum('type').notNull().default('general'),
  symbol: text('symbol'),
  description: text('description'),
  minAccountAgeDays: integer('min_account_age_days').notNull().default(0),
  minKarma: integer('min_karma').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// ── Chat Messages ───────────────────────────────────────────────────────────

export const chatMessages = pgTable('chat_messages', {
  id: uuid('id').defaultRandom().primaryKey(),
  roomId: uuid('room_id')
    .notNull()
    .references(() => chatRooms.id),
  userId: text('user_id')
    .notNull()
    .references(() => users.clerkId),
  parentId: uuid('parent_id'),
  body: text('body').notNull(),
  isDeleted: boolean('is_deleted').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// ── Chat Reactions ──────────────────────────────────────────────────────────

export const chatReactions = pgTable(
  'chat_reactions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    messageId: uuid('message_id')
      .notNull()
      .references(() => chatMessages.id),
    userId: text('user_id')
      .notNull()
      .references(() => users.clerkId),
    emoji: text('emoji').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('chat_reactions_msg_user_emoji_idx').on(
      table.messageId,
      table.userId,
      table.emoji,
    ),
  ],
)
