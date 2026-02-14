import {
  boolean,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { users } from './users.js'

// ── Enums ────────────────────────────────────────────────────────────────────

export const badgeTypeEnum = pgEnum('badge_type', [
  'identity_verified',
  'broker_connected',
  'performance_audited',
])

// ── Profiles ─────────────────────────────────────────────────────────────────

export const profiles = pgTable('profiles', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id')
    .notNull()
    .unique()
    .references(() => users.clerkId),
  displayName: text('display_name'),
  bio: text('bio'),
  strategyDescription: text('strategy_description'),
  avatarUrl: text('avatar_url'),
  website: text('website'),
  twitter: text('twitter'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// ── Verification Badges ──────────────────────────────────────────────────────

export const verificationBadges = pgTable(
  'verification_badges',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.clerkId),
    badgeType: badgeTypeEnum('badge_type').notNull(),
    verifiedAt: timestamp('verified_at', { withTimezone: true }).notNull().defaultNow(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
  },
  (table) => [
    uniqueIndex('verification_badges_user_type_idx').on(table.userId, table.badgeType),
  ],
)

// ── Follows ──────────────────────────────────────────────────────────────────

export const follows = pgTable(
  'follows',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    followerId: text('follower_id')
      .notNull()
      .references(() => users.clerkId),
    followingId: text('following_id')
      .notNull()
      .references(() => users.clerkId),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('follows_follower_following_idx').on(table.followerId, table.followingId),
  ],
)

// ── Privacy Settings ─────────────────────────────────────────────────────────

export const privacySettings = pgTable('privacy_settings', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id')
    .notNull()
    .unique()
    .references(() => users.clerkId),
  showStats: boolean('show_stats').notNull().default(true),
  showIdeas: boolean('show_ideas').notNull().default(true),
  showJournal: boolean('show_journal').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})
