import { eq, and, gte, lte, sql } from 'drizzle-orm'
import type { NormalizedBar, Timeframe } from '@marlin/shared'
import { ohlcvBars } from '../db/schema/ohlcv.js'
import { getAggregates } from '../adapters/polygon-rest.js'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'

export class MarketDataService {
  constructor(private db: PostgresJsDatabase) {}

  private async persistBars(bars: NormalizedBar[]): Promise<void> {
    if (bars.length === 0) return

    try {
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
        .onConflictDoUpdate({
          target: [ohlcvBars.symbol, ohlcvBars.timeframe, ohlcvBars.timestamp],
          set: {
            open: sql`excluded.open`,
            high: sql`excluded.high`,
            low: sql`excluded.low`,
            close: sql`excluded.close`,
            volume: sql`excluded.volume`,
          },
        })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const isMissingTable = message.includes('relation "ohlcv_bars" does not exist')
      if (process.env.NODE_ENV === 'production' && !isMissingTable) {
        throw error
      }
      console.warn(`[market-data] Skipping DB cache write: ${message}`)
    }
  }

  async getBars(
    symbol: string,
    timeframe: Timeframe,
    from: string,
    to: string,
  ): Promise<NormalizedBar[]> {
    const fromDate = new Date(from)
    const toDate = new Date(to)
    const preferLiveInDev = process.env.NODE_ENV !== 'production' && Boolean(process.env.POLYGON_API_KEY)

    if (preferLiveInDev) {
      try {
        const liveBars = await getAggregates(symbol, timeframe, from, to)
        if (liveBars.length > 0) {
          await this.persistBars(liveBars)
          return liveBars
        }
      } catch (error) {
        console.warn(
          `[market-data] Live fetch failed, falling back to cache: ${
            error instanceof Error ? error.message : String(error)
          }`,
        )
      }
    }

    // Check DB cache first (best-effort in local dev).
    let cached: typeof ohlcvBars.$inferSelect[] = []
    try {
      cached = await this.db
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
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const isMissingTable = message.includes('relation "ohlcv_bars" does not exist')
      if (process.env.NODE_ENV === 'production' && !isMissingTable) {
        throw error
      }
      console.warn(`[market-data] Skipping DB cache read: ${message}`)
    }

    if (cached.length > 0) {
      return cached.map((row) => this.rowToBar(row, symbol, timeframe))
    }

    // Fetch from Polygon
    const bars = await getAggregates(symbol, timeframe, from, to)

    await this.persistBars(bars)

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
