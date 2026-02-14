import type { InferSelectModel } from 'drizzle-orm'
import { db } from '../db/connection.js'
import { journalEntries } from '../db/schema/journal.js'
import type { paperFills, paperOrders, paperPositions } from '../db/schema/paper-trading.js'

type PaperFill = InferSelectModel<typeof paperFills>
type PaperOrder = InferSelectModel<typeof paperOrders>

export interface FillWithOrder {
  fill: PaperFill
  order: PaperOrder
  userId: string
}

/**
 * Automatically creates journal entries from paper trade fills.
 * Pre-fills trade data so the user only needs to add notes, grade, and tags.
 */
export class JournalAutoLogService {
  /**
   * Auto-creates a journal entry from a completed paper trade fill.
   * Entry is created with minimal metadata; user enriches it later.
   */
  async autoLogFromFill(data: FillWithOrder): Promise<InferSelectModel<typeof journalEntries>> {
    const { fill, order, userId } = data

    const entryPrice = parseFloat(fill.price)
    const quantity = fill.quantity

    const [entry] = await db
      .insert(journalEntries)
      .values({
        userId,
        tradeId: fill.id,
        symbol: order.symbol,
        side: order.side as 'buy' | 'sell',
        entryPrice: fill.price,
        quantity: String(quantity),
        entryDate: fill.filledAt,
      })
      .returning()

    return entry
  }

  /**
   * Generates a chart snapshot URL placeholder.
   * In production this would upload a screenshot to Cloudflare R2
   * and return the CDN URL.
   */
  async captureChartSnapshot(symbol: string, timeframe: string): Promise<string> {
    const timestamp = Date.now()
    return `https://r2.marlintraders.com/snapshots/${symbol}/${timeframe}/${timestamp}.png`
  }

  /**
   * Calculates R-multiple given entry, exit, and stop prices.
   * R-multiple = (exit - entry) / (entry - stop) for longs
   * R-multiple = (entry - exit) / (stop - entry) for shorts
   * Returns null if stop distance is zero or invalid.
   */
  calculateRMultiple(
    side: 'buy' | 'sell',
    entryPrice: number,
    exitPrice: number,
    stopPrice: number,
  ): number | null {
    if (side === 'buy') {
      const risk = entryPrice - stopPrice
      if (risk <= 0) return null
      return (exitPrice - entryPrice) / risk
    } else {
      const risk = stopPrice - entryPrice
      if (risk <= 0) return null
      return (entryPrice - exitPrice) / risk
    }
  }
}
