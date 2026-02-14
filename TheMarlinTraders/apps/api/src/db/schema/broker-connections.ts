import {
  boolean,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'
import { users } from './users.js'

// ── Enums ──────────────────────────────────────────────────

export const brokerProviderEnum = pgEnum('broker_provider', [
  'alpaca',
  'ibkr',
  'tradier',
])

export const liveOrderSideEnum = pgEnum('live_order_side', ['buy', 'sell'])

export const liveOrderTypeEnum = pgEnum('live_order_type', [
  'market',
  'limit',
  'stop',
  'stop_limit',
  'trailing_stop',
])

export const liveOrderStatusEnum = pgEnum('live_order_status', [
  'new',
  'accepted',
  'pending_new',
  'partially_filled',
  'filled',
  'cancelled',
  'expired',
  'rejected',
  'replaced',
])

// ── Broker Connections ─────────────────────────────────────

export const brokerConnections = pgTable('broker_connections', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.clerkId),
  provider: brokerProviderEnum('provider').notNull(),
  /** Encrypted OAuth access token */
  accessToken: text('access_token').notNull(),
  /** Encrypted OAuth refresh token */
  refreshToken: text('refresh_token'),
  /** Broker-assigned account identifier */
  accountId: text('account_id').notNull(),
  /** Whether this connection is currently active */
  isActive: boolean('is_active').notNull().default(true),
  /** Paper vs live trading */
  isPaper: boolean('is_paper').notNull().default(false),
  /** IBKR: session token expiration */
  sessionExpiresAt: timestamp('session_expires_at', { withTimezone: true }),
  /** IBKR: last keep-alive ping timestamp */
  lastPingAt: timestamp('last_ping_at', { withTimezone: true }),
  connectedAt: timestamp('connected_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// ── IBKR Sub-Accounts ────────────────────────────────────

export const ibkrSubAccounts = pgTable('ibkr_sub_accounts', {
  id: uuid('id').defaultRandom().primaryKey(),
  connectionId: uuid('connection_id')
    .notNull()
    .references(() => brokerConnections.id),
  userId: text('user_id')
    .notNull()
    .references(() => users.clerkId),
  /** IBKR account identifier (e.g. U1234567) */
  ibkrAccountId: text('ibkr_account_id').notNull(),
  /** User-defined alias (e.g. "Main", "IRA", "Paper") */
  alias: text('alias'),
  /** Account type from IBKR (INDIVIDUAL, IRA, etc.) */
  accountType: text('account_type'),
  /** Trading permissions */
  tradingType: text('trading_type'),
  /** Whether this is the default account for orders */
  isDefault: boolean('is_default').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// ── Live Orders ────────────────────────────────────────────

export const liveOrders = pgTable('live_orders', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.clerkId),
  brokerId: uuid('broker_id')
    .notNull()
    .references(() => brokerConnections.id),
  /** Broker-assigned order ID */
  brokerOrderId: text('broker_order_id').notNull(),
  symbol: text('symbol').notNull(),
  side: liveOrderSideEnum('side').notNull(),
  type: liveOrderTypeEnum('type').notNull(),
  quantity: integer('quantity').notNull(),
  limitPrice: numeric('limit_price', { precision: 18, scale: 4 }),
  stopPrice: numeric('stop_price', { precision: 18, scale: 4 }),
  status: liveOrderStatusEnum('status').notNull().default('new'),
  filledQty: integer('filled_qty').notNull().default(0),
  avgFillPrice: numeric('avg_fill_price', { precision: 18, scale: 4 }),
  /** IBKR: contract ID */
  conid: integer('conid'),
  /** IBKR: OCA group identifier (links OCA orders together) */
  ocaGroup: text('oca_group'),
  /** IBKR: parent order ID (for bracket child orders) */
  parentOrderId: text('parent_order_id'),
  /** IBKR: sub-account ID this order was submitted under */
  ibkrAccountId: text('ibkr_account_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// ── Live Positions ─────────────────────────────────────────

export const livePositions = pgTable('live_positions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.clerkId),
  brokerId: uuid('broker_id')
    .notNull()
    .references(() => brokerConnections.id),
  symbol: text('symbol').notNull(),
  quantity: integer('quantity').notNull().default(0),
  avgEntryPrice: numeric('avg_entry_price', { precision: 18, scale: 4 }).notNull(),
  currentPrice: numeric('current_price', { precision: 18, scale: 4 }).notNull().default('0'),
  unrealizedPnl: numeric('unrealized_pnl', { precision: 18, scale: 4 }).notNull().default('0'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})
