import { integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { users } from './users.js'
import { symbols } from './symbols.js'

export const watchlists = pgTable('watchlists', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  position: integer('position').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const watchlistItems = pgTable('watchlist_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  watchlistId: uuid('watchlist_id')
    .notNull()
    .references(() => watchlists.id, { onDelete: 'cascade' }),
  symbolId: integer('symbol_id')
    .notNull()
    .references(() => symbols.id, { onDelete: 'cascade' }),
  position: integer('position').notNull().default(0),
  addedAt: timestamp('added_at', { withTimezone: true }).notNull().defaultNow(),
})
