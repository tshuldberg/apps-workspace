import {
  boolean,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'
import { users } from './users.js'
import { paperFills } from './paper-trading.js'

export const setupTypeEnum = pgEnum('setup_type', [
  'breakout',
  'pullback',
  'reversal',
  'range',
  'momentum',
  'other',
])

export const emotionalStateEnum = pgEnum('emotional_state', [
  'calm',
  'fomo',
  'fearful',
  'greedy',
  'disciplined',
  'other',
])

export const marketConditionEnum = pgEnum('market_condition', [
  'trending_up',
  'trending_down',
  'ranging',
  'volatile',
  'low_volume',
])

export const tradeGradeEnum = pgEnum('trade_grade', ['A', 'B', 'C', 'D', 'F'])

export const tradeSideEnum = pgEnum('trade_side', ['buy', 'sell'])

export const journalEntries = pgTable('journal_entries', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.clerkId),
  tradeId: uuid('trade_id').references(() => paperFills.id),
  symbol: text('symbol').notNull(),
  side: tradeSideEnum('side').notNull(),
  entryPrice: numeric('entry_price', { precision: 18, scale: 4 }).notNull(),
  exitPrice: numeric('exit_price', { precision: 18, scale: 4 }),
  quantity: numeric('quantity', { precision: 18, scale: 4 }).notNull(),
  pnl: numeric('pnl', { precision: 18, scale: 4 }),
  rMultiple: numeric('r_multiple', { precision: 8, scale: 3 }),
  setupType: setupTypeEnum('setup_type').notNull().default('other'),
  emotionalState: emotionalStateEnum('emotional_state').notNull().default('calm'),
  marketCondition: marketConditionEnum('market_condition').notNull().default('ranging'),
  grade: tradeGradeEnum('grade'),
  notes: text('notes'),
  chartSnapshotUrl: text('chart_snapshot_url'),
  tags: text('tags').array().notNull().default([]),
  entryDate: timestamp('entry_date', { withTimezone: true }).notNull(),
  exitDate: timestamp('exit_date', { withTimezone: true }),
  isDeleted: boolean('is_deleted').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const journalTags = pgTable('journal_tags', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.clerkId),
  name: text('name').notNull(),
  color: text('color').notNull().default('#3b82f6'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
