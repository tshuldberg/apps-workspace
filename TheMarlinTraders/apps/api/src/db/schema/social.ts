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

export const ideaSentimentEnum = pgEnum('idea_sentiment', [
  'bullish',
  'bearish',
  'neutral',
])

export const ideaVoteTypeEnum = pgEnum('idea_vote_type', ['up', 'down'])

// ── Ideas ────────────────────────────────────────────────────────────────────

export const ideas = pgTable('ideas', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.clerkId),
  title: text('title').notNull(),
  body: text('body').notNull(),
  symbol: text('symbol').notNull(),
  chartSnapshotUrl: text('chart_snapshot_url'),
  timeframe: text('timeframe'),
  tags: text('tags').array().notNull().default([]),
  sentiment: ideaSentimentEnum('sentiment').notNull().default('neutral'),
  upvotes: integer('upvotes').notNull().default(0),
  downvotes: integer('downvotes').notNull().default(0),
  commentCount: integer('comment_count').notNull().default(0),
  isPublished: boolean('is_published').notNull().default(false),
  isDeleted: boolean('is_deleted').notNull().default(false),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// ── Idea Comments ────────────────────────────────────────────────────────────

export const ideaComments = pgTable('idea_comments', {
  id: uuid('id').defaultRandom().primaryKey(),
  ideaId: uuid('idea_id')
    .notNull()
    .references(() => ideas.id),
  userId: text('user_id')
    .notNull()
    .references(() => users.clerkId),
  parentId: uuid('parent_id'),
  body: text('body').notNull(),
  upvotes: integer('upvotes').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// ── Idea Votes ───────────────────────────────────────────────────────────────

export const ideaVotes = pgTable(
  'idea_votes',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ideaId: uuid('idea_id')
      .notNull()
      .references(() => ideas.id),
    userId: text('user_id')
      .notNull()
      .references(() => users.clerkId),
    voteType: ideaVoteTypeEnum('vote_type').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('idea_votes_idea_user_idx').on(table.ideaId, table.userId),
  ],
)
