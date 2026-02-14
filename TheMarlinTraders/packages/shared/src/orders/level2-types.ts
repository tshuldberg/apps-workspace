import { z } from 'zod'

// ── Level 2 Entry ──────────────────────────────────────────────────────────

export const Level2EntrySchema = z.object({
  price: z.number().nonnegative(),
  size: z.number().nonnegative(),
  /** Number of individual orders at this price level */
  numOrders: z.number().int().nonnegative().optional(),
  /** Originating exchange MIC code */
  exchange: z.string().optional(),
})
export type Level2Entry = z.infer<typeof Level2EntrySchema>

// ── Order Book ─────────────────────────────────────────────────────────────

export const OrderBookSchema = z.object({
  symbol: z.string().min(1),
  bids: z.array(Level2EntrySchema),
  asks: z.array(Level2EntrySchema),
  timestamp: z.number(),
})
export type OrderBook = z.infer<typeof OrderBookSchema>

// ── Level 2 Update ─────────────────────────────────────────────────────────

export const Level2UpdateSchema = z.object({
  side: z.enum(['bid', 'ask']),
  price: z.number().nonnegative(),
  size: z.number().nonnegative(),
  action: z.enum(['add', 'remove', 'update']),
})
export type Level2Update = z.infer<typeof Level2UpdateSchema>

// ── DOM Level (computed for visualization) ─────────────────────────────────

export interface DOMLevel {
  price: number
  bidSize: number
  askSize: number
  cumulativeBidSize: number
  cumulativeAskSize: number
  isBestBid: boolean
  isBestAsk: boolean
}

// ── Depth Configuration ────────────────────────────────────────────────────

export const DepthConfigSchema = z.object({
  levels: z.enum(['5', '10', '20', '50']).transform(Number).default('20'),
  tickSize: z.number().positive().default(0.01),
})
export type DepthConfig = z.infer<typeof DepthConfigSchema>
