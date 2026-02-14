import { eq, and, gte, lte } from 'drizzle-orm'
import type { NormalizedBar, Timeframe } from '@marlin/shared'
import { ohlcvBars } from '../db/schema/ohlcv.js'
import { getAggregates } from '../adapters/polygon-rest.js'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'

export class MarketDataService {
  constructor(private db: PostgresJsDatabase) {}

  async getBars(
    symbol: string,
    timeframe: Timeframe,
    from: string,
    to: string,
  ): Promise<NormalizedBar[]> {
    const fromDate = new Date(from)
    const toDate = new Date(to)

    // Check DB cache first
    const cached = await this.db
      .select()
      .from(ohlcvBars)
      .where(
        and(
          eq(ohlcvBars.symbol, symbol),
          eq(ohlcvBars.timeframe, timeframe),
          gte(ohlcvBars.timestamp, fromDate),
          lte(ohlcvBars.timestamp, toDate),
        ),
      )
      .orderBy(ohlcvBars.timestamp)

    if (cached.length > 0) {
      return cached.map((row) => this.rowToBar(row, symbol, timeframe))
    }

    // Fetch from Polygon
    const bars = await getAggregates(symbol, timeframe, from, to)

    if (bars.length > 0) {
      // Store in DB (upsert-like: ignore conflicts on the unique index)
      await this.db
        .insert(ohlcvBars)
        .values(
          bars.map((bar) => ({
            symbol: bar.symbol,
            timeframe: bar.timeframe,
            timestamp: new Date(bar.timestamp),
            open: bar.open.toString(),
            high: bar.high.toString(),
            low: bar.low.toString(),
            close: bar.close.toString(),
            volume: bar.volume.toString(),
          })),
        )
        .onConflictDoNothing()
    }

    return bars
  }

  private rowToBar(
    row: {
      symbol: string
      timeframe: string
      timestamp: Date
      open: string
      high: string
      low: string
      close: string
      volume: string
    },
    symbol: string,
    timeframe: Timeframe,
  ): NormalizedBar {
    return {
      symbol,
      timeframe,
      open: parseFloat(row.open),
      high: parseFloat(row.high),
      low: parseFloat(row.low),
      close: parseFloat(row.close),
      volume: parseFloat(row.volume),
      timestamp: row.timestamp.getTime(),
    }
  }
}
