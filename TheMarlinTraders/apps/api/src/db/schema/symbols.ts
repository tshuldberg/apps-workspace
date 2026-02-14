import { boolean, numeric, pgEnum, pgTable, serial, text, timestamp, varchar } from 'drizzle-orm/pg-core'

export const symbolTypeEnum = pgEnum('symbol_type', [
  'stock',
  'etf',
  'crypto',
  'forex',
  'future',
  'option',
])

export const symbols = pgTable('symbols', {
  id: serial('id').primaryKey(),
  symbol: varchar('symbol', { length: 10 }).notNull().unique(),
  name: text('name').notNull(),
  exchange: text('exchange'),
  type: symbolTypeEnum('type').notNull().default('stock'),
  currency: varchar('currency', { length: 3 }).notNull().default('USD'),
  marketCap: numeric('market_cap'),
  sector: text('sector'),
  industry: text('industry'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
