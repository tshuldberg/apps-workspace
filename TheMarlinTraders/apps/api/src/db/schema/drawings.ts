import { pgTable, text, timestamp, uuid, jsonb, index } from 'drizzle-orm/pg-core'
import { users } from './users.js'

export const drawings = pgTable(
  'drawings',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    symbol: text('symbol').notNull(),
    timeframe: text('timeframe').notNull(),
    toolType: text('tool_type').notNull(),
    points: jsonb('points').notNull().$type<{ time: number; price: number }[]>(),
    style: jsonb('style').notNull().$type<{
      color: string
      lineWidth: number
      lineStyle: string
      fillColor?: string
      fillOpacity?: number
      fontSize?: number
      fontFamily?: string
      textColor?: string
    }>(),
    text: text('text'),
    locked: text('locked').notNull().default('false'),
    visible: text('visible').notNull().default('true'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('drawings_user_symbol_idx').on(table.userId, table.symbol),
    index('drawings_user_symbol_tf_idx').on(table.userId, table.symbol, table.timeframe),
  ],
)
