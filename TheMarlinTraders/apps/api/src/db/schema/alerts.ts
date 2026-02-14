import { pgEnum, pgTable, text, timestamp, uuid, index } from 'drizzle-orm/pg-core'
import { users } from './users.js'

export const alertConditionTypeEnum = pgEnum('alert_condition_type', [
  'price_above',
  'price_below',
  'price_crossing_up',
  'price_crossing_down',
  'volume_above',
  'rvol_above',
  'rsi_above',
  'rsi_below',
  'macd_crossover',
  'ma_crossover',
])

export const alertDeliveryMethodEnum = pgEnum('alert_delivery_method', [
  'in_app',
  'email',
  'webhook',
  'push',
])

export const alertStatusEnum = pgEnum('alert_status', [
  'active',
  'paused',
  'triggered',
])

export const alerts = pgTable(
  'alerts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    symbol: text('symbol').notNull(),
    conditionType: alertConditionTypeEnum('condition_type').notNull(),
    threshold: text('threshold').notNull(),
    deliveryMethod: alertDeliveryMethodEnum('delivery_method').notNull().default('in_app'),
    webhookUrl: text('webhook_url'),
    status: alertStatusEnum('status').notNull().default('active'),
    message: text('message'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('alerts_user_id_idx').on(table.userId),
    index('alerts_symbol_idx').on(table.symbol),
    index('alerts_status_idx').on(table.status),
  ],
)
