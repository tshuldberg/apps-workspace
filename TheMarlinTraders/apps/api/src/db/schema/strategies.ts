import {
  boolean,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'
import { users } from './users.js'

// ── Enums ──────────────────────────────────────────────────

export const strategyLanguageEnum = pgEnum('strategy_language', [
  'typescript',
  'python',
  'pine',
])

export const strategyRunStatusEnum = pgEnum('strategy_run_status', [
  'pending',
  'running',
  'completed',
  'failed',
])

// ── Strategies ─────────────────────────────────────────────

export const strategies = pgTable('strategies', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.clerkId),
  name: text('name').notNull(),
  description: text('description'),
  language: strategyLanguageEnum('language').notNull().default('typescript'),
  code: text('code').notNull().default(''),
  /** Strategy parameters stored as JSONB array */
  parameters: jsonb('parameters').notNull().default([]),
  /** Whether this strategy is visible to other users */
  isPublic: boolean('is_public').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// ── Strategy Runs ──────────────────────────────────────────

export const strategyRuns = pgTable('strategy_runs', {
  id: uuid('id').defaultRandom().primaryKey(),
  strategyId: uuid('strategy_id')
    .notNull()
    .references(() => strategies.id),
  userId: text('user_id')
    .notNull()
    .references(() => users.clerkId),
  /** Backtest configuration (symbol, timeframe, dates, capital, etc.) */
  config: jsonb('config').notNull(),
  status: strategyRunStatusEnum('status').notNull().default('pending'),
  /** Backtest result (trades, equity curve, metrics) */
  result: jsonb('result'),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
