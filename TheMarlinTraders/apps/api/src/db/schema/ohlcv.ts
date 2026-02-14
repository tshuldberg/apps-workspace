import { pgTable, varchar, numeric, timestamp, uniqueIndex } from 'drizzle-orm/pg-core'

export const ohlcvBars = pgTable(
  'ohlcv_bars',
  {
    symbol: varchar('symbol', { length: 20 }).notNull(),
    timeframe: varchar('timeframe', { length: 10 }).notNull(),
    timestamp: timestamp('timestamp', { withTimezone: true }).notNull(),
    open: numeric('open', { precision: 18, scale: 8 }).notNull(),
    high: numeric('high', { precision: 18, scale: 8 }).notNull(),
    low: numeric('low', { precision: 18, scale: 8 }).notNull(),
    close: numeric('close', { precision: 18, scale: 8 }).notNull(),
    volume: numeric('volume', { precision: 20, scale: 2 }).notNull(),
  },
  (table) => [
    uniqueIndex('ohlcv_symbol_tf_ts_idx').on(table.symbol, table.timeframe, table.timestamp),
  ],
)
