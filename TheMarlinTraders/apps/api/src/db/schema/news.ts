import {
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'

// ── Enums ────────────────────────────────────────────────────────────────────

export const newsSourceEnum = pgEnum('news_source', ['benzinga', 'custom'])

export const economicImpactEnum = pgEnum('economic_impact', [
  'low',
  'medium',
  'high',
])

// ── News Articles ───────────────────────────────────────────────────────────

export const newsArticles = pgTable('news_articles', {
  id: uuid('id').defaultRandom().primaryKey(),
  externalId: text('external_id').notNull().unique(),
  source: newsSourceEnum('source').notNull(),
  title: text('title').notNull(),
  summary: text('summary').notNull(),
  url: text('url').notNull(),
  imageUrl: text('image_url'),
  symbols: text('symbols').array().notNull().default([]),
  categories: text('categories').array().notNull().default([]),
  publishedAt: timestamp('published_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// ── Economic Events ─────────────────────────────────────────────────────────

export const economicEvents = pgTable('economic_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  eventDate: timestamp('event_date', { withTimezone: true }).notNull(),
  impact: economicImpactEnum('impact').notNull(),
  actual: text('actual'),
  forecast: text('forecast'),
  previous: text('previous'),
  country: text('country').notNull().default('US'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// ── Earnings Events ─────────────────────────────────────────────────────────

export const earningsEvents = pgTable('earnings_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  symbol: text('symbol').notNull(),
  companyName: text('company_name').notNull(),
  reportDate: timestamp('report_date', { withTimezone: true }).notNull(),
  quarter: text('quarter').notNull(),
  estimatedEps: text('estimated_eps'),
  actualEps: text('actual_eps'),
  estimatedRevenue: text('estimated_revenue'),
  actualRevenue: text('actual_revenue'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
