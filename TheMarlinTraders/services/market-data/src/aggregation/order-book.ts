import type { OrderBook, Level2Update, Level2Entry, DOMLevel } from '@marlin/shared'

/**
 * Apply a single Level 2 update to an existing order book.
 * Returns a new OrderBook (immutable — does not mutate the input).
 */
export function applyUpdate(book: OrderBook, update: Level2Update): OrderBook {
  const side = update.side === 'bid' ? 'bids' : 'asks'
  const entries = [...book[side]]

  const idx = entries.findIndex((e) => e.price === update.price)

  switch (update.action) {
    case 'remove':
      if (idx !== -1) entries.splice(idx, 1)
      break

    case 'update':
      if (idx !== -1) {
        entries[idx] = { ...entries[idx]!, size: update.size }
      } else {
        // Treat as add if level doesn't exist yet
        entries.push({ price: update.price, size: update.size })
      }
      break

    case 'add':
      if (idx !== -1) {
        // Level already exists — update the size
        entries[idx] = { ...entries[idx]!, size: update.size }
      } else {
        entries.push({ price: update.price, size: update.size })
      }
      break
  }

  // Re-sort: bids descending, asks ascending
  if (update.side === 'bid') {
    entries.sort((a, b) => b.price - a.price)
  } else {
    entries.sort((a, b) => a.price - b.price)
  }

  return {
    ...book,
    [side]: entries,
    timestamp: Date.now(),
  }
}

/**
 * Apply a batch of Level 2 updates to an order book.
 */
export function applyUpdates(book: OrderBook, updates: Level2Update[]): OrderBook {
  let current = book
  for (const update of updates) {
    current = applyUpdate(current, update)
  }
  return current
}

/**
 * Build a DOM (Depth of Market) view from an order book.
 *
 * The DOM is a fixed-size price ladder centered around the midpoint,
 * with `levels` rows above and below. Each row shows the bid and ask
 * sizes at that price, along with cumulative totals.
 *
 * @param book   - The current order book
 * @param levels - Number of price levels to show per side
 * @param tickSize - Minimum price increment for grouping (e.g. 0.01)
 */
export function getDOM(book: OrderBook, levels: number, tickSize: number): DOMLevel[] {
  const bestBid = book.bids[0]?.price ?? 0
  const bestAsk = book.asks[0]?.price ?? 0

  // Build a map of price -> aggregated sizes for quick lookup
  const bidMap = aggregateBySide(book.bids, tickSize)
  const askMap = aggregateBySide(book.asks, tickSize)

  // Center the ladder on the midpoint between best bid and best ask
  const midPrice = bestBid > 0 && bestAsk > 0 ? (bestBid + bestAsk) / 2 : bestBid || bestAsk
  const centerTick = roundToTick(midPrice, tickSize)

  // Generate price levels: `levels` above and below the center
  const domLevels: DOMLevel[] = []
  const totalRows = levels * 2 + 1

  for (let i = 0; i < totalRows; i++) {
    const offset = levels - i // positive = above center, negative = below
    const price = roundToTick(centerTick + offset * tickSize, tickSize)
    const bidSize = bidMap.get(price) ?? 0
    const askSize = askMap.get(price) ?? 0

    domLevels.push({
      price,
      bidSize,
      askSize,
      cumulativeBidSize: 0, // computed below
      cumulativeAskSize: 0, // computed below
      isBestBid: price === roundToTick(bestBid, tickSize),
      isBestAsk: price === roundToTick(bestAsk, tickSize),
    })
  }

  // Compute cumulative bid sizes (bottom-up: from lowest to highest price)
  let cumBid = 0
  for (let i = domLevels.length - 1; i >= 0; i--) {
    cumBid += domLevels[i]!.bidSize
    domLevels[i]!.cumulativeBidSize = cumBid
  }

  // Compute cumulative ask sizes (top-down: from highest to lowest price)
  let cumAsk = 0
  for (let i = 0; i < domLevels.length; i++) {
    cumAsk += domLevels[i]!.askSize
    domLevels[i]!.cumulativeAskSize = cumAsk
  }

  return domLevels
}

/**
 * Calculate the current bid-ask spread.
 * Returns spread in absolute price and basis points.
 */
export function calculateSpread(book: OrderBook): {
  spread: number
  spreadBps: number
  bidPrice: number
  askPrice: number
  midPrice: number
} {
  const bidPrice = book.bids[0]?.price ?? 0
  const askPrice = book.asks[0]?.price ?? 0
  const spread = askPrice - bidPrice
  const midPrice = bidPrice > 0 && askPrice > 0 ? (bidPrice + askPrice) / 2 : 0
  const spreadBps = midPrice > 0 ? (spread / midPrice) * 10_000 : 0

  return { spread, spreadBps, bidPrice, askPrice, midPrice }
}

/**
 * Calculate the volume-weighted mid-price.
 * Weights the midpoint by the imbalance between best bid and ask sizes.
 */
export function volumeWeightedMidPrice(book: OrderBook): number {
  const bestBid = book.bids[0]
  const bestAsk = book.asks[0]

  if (!bestBid || !bestAsk) return bestBid?.price ?? bestAsk?.price ?? 0

  const totalSize = bestBid.size + bestAsk.size
  if (totalSize === 0) return (bestBid.price + bestAsk.price) / 2

  // Weight towards the side with more volume
  return (bestBid.price * bestAsk.size + bestAsk.price * bestBid.size) / totalSize
}

/**
 * Aggregate entries by price level, grouping by tick size.
 * Useful when the raw book has sub-tick granularity across exchanges.
 */
export function aggregateBySide(entries: Level2Entry[], tickSize: number): Map<number, number> {
  const map = new Map<number, number>()
  for (const entry of entries) {
    const key = roundToTick(entry.price, tickSize)
    map.set(key, (map.get(key) ?? 0) + entry.size)
  }
  return map
}

/**
 * Round a price to the nearest tick.
 */
function roundToTick(price: number, tickSize: number): number {
  return Math.round(price / tickSize) * tickSize
}

/**
 * Create an empty order book for a symbol.
 */
export function emptyOrderBook(symbol: string): OrderBook {
  return {
    symbol,
    bids: [],
    asks: [],
    timestamp: Date.now(),
  }
}
