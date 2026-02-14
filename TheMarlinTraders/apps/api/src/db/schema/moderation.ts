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

export const contentTypeEnum = pgEnum('moderation_content_type', [
  'idea',
  'comment',
  'chat_message',
  'profile',
])

export const reportReasonEnum = pgEnum('report_reason', [
  'spam',
  'harassment',
  'hate_speech',
  'misinformation',
  'inappropriate',
  'self_harm',
  'other',
])

export const moderationStatusEnum = pgEnum('moderation_status', [
  'pending',
  'approved',
  'rejected',
  'auto_flagged',
  'escalated',
])

export const moderationActionEnum = pgEnum('moderation_action', [
  'approve',
  'reject',
  'warn',
  'mute',
  'ban',
])

// ── Content Reports ─────────────────────────────────────────────────────────

export const contentReports = pgTable(
  'content_reports',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    reporterId: text('reporter_id')
      .notNull()
      .references(() => users.clerkId),
    contentType: contentTypeEnum('content_type').notNull(),
    contentId: uuid('content_id').notNull(),
    reason: reportReasonEnum('reason').notNull(),
    description: text('description'),
    status: moderationStatusEnum('status').notNull().default('pending'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('content_reports_reporter_content_idx').on(
      table.reporterId,
      table.contentType,
      table.contentId,
    ),
  ],
)

// ── Moderation Queue ────────────────────────────────────────────────────────

export const moderationQueue = pgTable('moderation_queue', {
  id: uuid('id').defaultRandom().primaryKey(),
  contentType: contentTypeEnum('content_type').notNull(),
  contentId: uuid('content_id').notNull(),
  authorId: text('author_id')
    .notNull()
    .references(() => users.clerkId),
  reason: text('reason').notNull(),
  reportCount: integer('report_count').notNull().default(1),
  status: moderationStatusEnum('status').notNull().default('pending'),
  moderatorId: text('moderator_id').references(() => users.clerkId),
  moderatorAction: moderationActionEnum('moderator_action'),
  moderatorNote: text('moderator_note'),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// ── User Moderation State ───────────────────────────────────────────────────

export const userModerationState = pgTable('user_moderation_state', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id')
    .notNull()
    .unique()
    .references(() => users.clerkId),
  warnings: integer('warnings').notNull().default(0),
  isMuted: boolean('is_muted').notNull().default(false),
  isBanned: boolean('is_banned').notNull().default(false),
  mutedUntil: timestamp('muted_until', { withTimezone: true }),
  bannedAt: timestamp('banned_at', { withTimezone: true }),
  banReason: text('ban_reason'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})
