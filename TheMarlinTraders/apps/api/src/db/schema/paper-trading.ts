import {
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'
import { users } from './users.js'

export const orderSideEnum = pgEnum('order_side', ['buy', 'sell'])

export const orderTypeEnum = pgEnum('order_type', ['market', 'limit', 'stop'])

export const orderStatusEnum = pgEnum('order_status', [
  'pending',
  'filled',
  'partially_filled',
  'cancelled',
])

export const paperPortfolios = pgTable('paper_portfolios', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.clerkId),
  name: text('name').notNull(),
  cashBalance: numeric('cash_balance', { precision: 18, scale: 4 })
    .notNull()
    .default('100000.0000'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const paperOrders = pgTable('paper_orders', {
  id: uuid('id').defaultRandom().primaryKey(),
  portfolioId: uuid('portfolio_id')
    .notNull()
    .references(() => paperPortfolios.id),
  symbol: text('symbol').notNull(),
  side: orderSideEnum('side').notNull(),
  type: orderTypeEnum('type').notNull(),
  quantity: integer('quantity').notNull(),
  limitPrice: numeric('limit_price', { precision: 18, scale: 4 }),
  stopPrice: numeric('stop_price', { precision: 18, scale: 4 }),
  status: orderStatusEnum('status').notNull().default('pending'),
  filledAt: timestamp('filled_at', { withTimezone: true }),
  filledPrice: numeric('filled_price', { precision: 18, scale: 4 }),
  filledQuantity: integer('filled_quantity').default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const paperPositions = pgTable('paper_positions', {
  id: uuid('id').defaultRandom().primaryKey(),
  portfolioId: uuid('portfolio_id')
    .notNull()
    .references(() => paperPortfolios.id),
  symbol: text('symbol').notNull(),
  quantity: integer('quantity').notNull().default(0),
  averageCost: numeric('average_cost', { precision: 18, scale: 4 }).notNull(),
  currentPrice: numeric('current_price', { precision: 18, scale: 4 }).notNull().default('0'),
})

export const paperFills = pgTable('paper_fills', {
  id: uuid('id').defaultRandom().primaryKey(),
  orderId: uuid('order_id')
    .notNull()
    .references(() => paperOrders.id),
  quantity: integer('quantity').notNull(),
  price: numeric('price', { precision: 18, scale: 4 }).notNull(),
  filledAt: timestamp('filled_at', { withTimezone: true }).notNull().defaultNow(),
})
