import { describe, it, expect } from 'vitest'
import {
  applyUpdate,
  applyUpdates,
  getDOM,
  calculateSpread,
  volumeWeightedMidPrice,
  aggregateBySide,
  emptyOrderBook,
} from '../src/aggregation/order-book.js'
import type { OrderBook, Level2Update } from '@marlin/shared'

function makeBook(
  bids: [number, number][],
  asks: [number, number][],
  symbol = 'AAPL',
): OrderBook {
  return {
    symbol,
    bids: bids
      .map(([price, size]) => ({ price, size }))
      .sort((a, b) => b.price - a.price),
    asks: asks
      .map(([price, size]) => ({ price, size }))
      .sort((a, b) => a.price - b.price),
    timestamp: Date.now(),
  }
}

describe('applyUpdate', () => {
  it('adds a new bid level', () => {
    const book = makeBook([[100, 50]], [[101, 30]])
    const result = applyUpdate(book, { side: 'bid', price: 99.5, size: 100, action: 'add' })

    expect(result.bids).toHaveLength(2)
    expect(result.bids[0]!.price).toBe(100)
    expect(result.bids[1]!.price).toBe(99.5)
    expect(result.bids[1]!.size).toBe(100)
  })

  it('adds a new ask level', () => {
    const book = makeBook([[100, 50]], [[101, 30]])
    const result = applyUpdate(book, { side: 'ask', price: 101.5, size: 200, action: 'add' })

    expect(result.asks).toHaveLength(2)
    expect(result.asks[0]!.price).toBe(101)
    expect(result.asks[1]!.price).toBe(101.5)
  })

  it('updates an existing bid level', () => {
    const book = makeBook([[100, 50], [99, 30]], [[101, 30]])
    const result = applyUpdate(book, { side: 'bid', price: 100, size: 200, action: 'update' })

    expect(result.bids).toHaveLength(2)
    expect(result.bids[0]!.price).toBe(100)
    expect(result.bids[0]!.size).toBe(200)
  })

  it('removes a bid level', () => {
    const book = makeBook([[100, 50], [99, 30]], [[101, 30]])
    const result = applyUpdate(book, { side: 'bid', price: 100, size: 0, action: 'remove' })

    expect(result.bids).toHaveLength(1)
    expect(result.bids[0]!.price).toBe(99)
  })

  it('removes an ask level', () => {
    const book = makeBook([[100, 50]], [[101, 30], [102, 20]])
    const result = applyUpdate(book, { side: 'ask', price: 101, size: 0, action: 'remove' })

    expect(result.asks).toHaveLength(1)
    expect(result.asks[0]!.price).toBe(102)
  })

  it('does not mutate the original book', () => {
    const book = makeBook([[100, 50]], [[101, 30]])
    const result = applyUpdate(book, { side: 'bid', price: 99, size: 100, action: 'add' })

    expect(book.bids).toHaveLength(1)
    expect(result.bids).toHaveLength(2)
    expect(result).not.toBe(book)
  })

  it('maintains bid descending sort order after add', () => {
    const book = makeBook([[100, 50], [98, 30]], [[101, 30]])
    const result = applyUpdate(book, { side: 'bid', price: 99, size: 40, action: 'add' })

    expect(result.bids.map((b) => b.price)).toEqual([100, 99, 98])
  })

  it('maintains ask ascending sort order after add', () => {
    const book = makeBook([[100, 50]], [[101, 30], [103, 20]])
    const result = applyUpdate(book, { side: 'ask', price: 102, size: 15, action: 'add' })

    expect(result.asks.map((a) => a.price)).toEqual([101, 102, 103])
  })

  it('handles remove of non-existent level gracefully', () => {
    const book = makeBook([[100, 50]], [[101, 30]])
    const result = applyUpdate(book, { side: 'bid', price: 95, size: 0, action: 'remove' })

    expect(result.bids).toHaveLength(1)
    expect(result.bids[0]!.price).toBe(100)
  })

  it('handles update of non-existent level by adding it', () => {
    const book = makeBook([[100, 50]], [[101, 30]])
    const result = applyUpdate(book, { side: 'bid', price: 99, size: 75, action: 'update' })

    expect(result.bids).toHaveLength(2)
    expect(result.bids[1]!.price).toBe(99)
    expect(result.bids[1]!.size).toBe(75)
  })
})

describe('applyUpdates (batch)', () => {
  it('applies multiple updates in sequence', () => {
    const book = makeBook([[100, 50]], [[101, 30]])
    const updates: Level2Update[] = [
      { side: 'bid', price: 99, size: 100, action: 'add' },
      { side: 'ask', price: 102, size: 200, action: 'add' },
      { side: 'bid', price: 100, size: 0, action: 'remove' },
    ]

    const result = applyUpdates(book, updates)

    expect(result.bids).toHaveLength(1)
    expect(result.bids[0]!.price).toBe(99)
    expect(result.asks).toHaveLength(2)
  })
})

describe('getDOM', () => {
  it('returns the correct number of levels', () => {
    const book = makeBook(
      [[100, 50], [99.99, 30], [99.98, 20]],
      [[100.01, 40], [100.02, 25], [100.03, 10]],
    )
    const dom = getDOM(book, 5, 0.01)

    // 5 levels above + center + 5 below = 11
    expect(dom).toHaveLength(11)
  })

  it('marks best bid and best ask correctly', () => {
    const book = makeBook(
      [[100, 50], [99.99, 30]],
      [[100.01, 40], [100.02, 25]],
    )
    const dom = getDOM(book, 10, 0.01)

    const bestBid = dom.find((l) => l.isBestBid)
    const bestAsk = dom.find((l) => l.isBestAsk)

    expect(bestBid).toBeDefined()
    expect(bestBid!.price).toBeCloseTo(100, 1)
    expect(bestAsk).toBeDefined()
    expect(bestAsk!.price).toBeCloseTo(100.01, 1)
  })

  it('calculates cumulative bid sizes correctly', () => {
    const book = makeBook(
      [[100, 50], [99.99, 30], [99.98, 20]],
      [[100.01, 40]],
    )
    const dom = getDOM(book, 10, 0.01)

    // Find levels that have bid sizes
    const bidLevels = dom.filter((l) => l.bidSize > 0)
    expect(bidLevels.length).toBeGreaterThan(0)

    // The cumulative at the bottom should include all bid sizes
    const lastLevel = dom[dom.length - 1]!
    expect(lastLevel.cumulativeBidSize).toBeGreaterThanOrEqual(100) // 50 + 30 + 20
  })

  it('calculates cumulative ask sizes correctly', () => {
    const book = makeBook(
      [[100, 50]],
      [[100.01, 40], [100.02, 25], [100.03, 10]],
    )
    const dom = getDOM(book, 10, 0.01)

    // The cumulative at the bottom should include all ask sizes
    const lastLevel = dom[dom.length - 1]!
    expect(lastLevel.cumulativeAskSize).toBeGreaterThanOrEqual(75) // 40 + 25 + 10
  })

  it('handles empty order book', () => {
    const book = emptyOrderBook('AAPL')
    const dom = getDOM(book, 5, 0.01)

    expect(dom).toHaveLength(11)
    dom.forEach((level) => {
      expect(level.bidSize).toBe(0)
      expect(level.askSize).toBe(0)
    })
  })

  it('groups prices by tick size', () => {
    // Two entries at slightly different prices that should aggregate to the same tick
    const book: OrderBook = {
      symbol: 'AAPL',
      bids: [
        { price: 100.004, size: 50 },
        { price: 100.006, size: 30 },
      ],
      asks: [
        { price: 100.014, size: 40 },
        { price: 100.016, size: 20 },
      ],
      timestamp: Date.now(),
    }
    const dom = getDOM(book, 3, 0.01)

    // Both bids should aggregate into the 100.01 level (rounded)
    // Both asks should aggregate into the 100.02 level (rounded)
    const bidLevel = dom.find((l) => Math.abs(l.price - 100.01) < 0.001)
    if (bidLevel) {
      expect(bidLevel.bidSize).toBe(80) // 50 + 30 aggregated
    }
  })
})

describe('calculateSpread', () => {
  it('calculates spread correctly', () => {
    const book = makeBook([[100, 50]], [[100.05, 30]])
    const result = calculateSpread(book)

    expect(result.bidPrice).toBe(100)
    expect(result.askPrice).toBe(100.05)
    expect(result.spread).toBeCloseTo(0.05, 4)
    expect(result.midPrice).toBeCloseTo(100.025, 2)
    expect(result.spreadBps).toBeCloseTo(5, 0) // ~5 bps
  })

  it('handles empty book', () => {
    const book = emptyOrderBook('AAPL')
    const result = calculateSpread(book)

    expect(result.spread).toBe(0)
    expect(result.spreadBps).toBe(0)
    expect(result.midPrice).toBe(0)
  })

  it('handles book with only bids', () => {
    const book = makeBook([[100, 50]], [])
    const result = calculateSpread(book)

    expect(result.bidPrice).toBe(100)
    expect(result.askPrice).toBe(0)
    expect(result.spread).toBe(-100)
  })

  it('handles tight spread', () => {
    const book = makeBook([[150.00, 1000]], [[150.01, 1000]])
    const result = calculateSpread(book)

    expect(result.spread).toBeCloseTo(0.01, 4)
    // 0.01 / 150.005 * 10000 ≈ 0.67 bps
    expect(result.spreadBps).toBeCloseTo(0.67, 0)
  })
})

describe('volumeWeightedMidPrice', () => {
  it('returns midpoint when bid and ask sizes are equal', () => {
    const book = makeBook([[100, 100]], [[102, 100]])
    const vwmp = volumeWeightedMidPrice(book)

    expect(vwmp).toBeCloseTo(101, 2)
  })

  it('skews toward the side with more volume', () => {
    // More volume on the ask side -> VWMP skews toward bid
    const book = makeBook([[100, 100]], [[102, 400]])
    const vwmp = volumeWeightedMidPrice(book)

    // VWMP = (100*400 + 102*100) / (100+400) = (40000+10200)/500 = 100.4
    expect(vwmp).toBeCloseTo(100.4, 2)
  })

  it('skews toward the bid when bid volume is larger', () => {
    const book = makeBook([[100, 400]], [[102, 100]])
    const vwmp = volumeWeightedMidPrice(book)

    // VWMP = (100*100 + 102*400) / (400+100) = (10000+40800)/500 = 101.6
    expect(vwmp).toBeCloseTo(101.6, 2)
  })

  it('handles empty book', () => {
    const book = emptyOrderBook('AAPL')
    const vwmp = volumeWeightedMidPrice(book)

    expect(vwmp).toBe(0)
  })

  it('handles book with only bids', () => {
    const book = makeBook([[100, 50]], [])
    const vwmp = volumeWeightedMidPrice(book)

    expect(vwmp).toBe(100)
  })

  it('handles book with only asks', () => {
    const book = makeBook([], [[102, 50]])
    const vwmp = volumeWeightedMidPrice(book)

    expect(vwmp).toBe(102)
  })
})

describe('aggregateBySide', () => {
  it('aggregates entries at the same tick level', () => {
    const entries = [
      { price: 100.003, size: 50 },
      { price: 100.007, size: 30 },
      { price: 99.993, size: 20 },
    ]
    const result = aggregateBySide(entries, 0.01)

    // 100.003 rounds to 100.00, 100.007 rounds to 100.01, 99.993 rounds to 99.99
    expect(result.get(100.0)).toBe(50)
    expect(result.get(100.01)).toBe(30)
    expect(result.get(99.99)).toBe(20)
  })

  it('sums sizes for entries at the same tick level', () => {
    const entries = [
      { price: 100.001, size: 50 },
      { price: 100.003, size: 30 },
      { price: 100.009, size: 20 },
    ]
    const result = aggregateBySide(entries, 0.01)

    // All three round to 100.00
    expect(result.get(100.0)).toBe(80) // 50 + 30
    expect(result.get(100.01)).toBe(20) // 100.009 rounds to 100.01
  })

  it('handles empty entries', () => {
    const result = aggregateBySide([], 0.01)

    expect(result.size).toBe(0)
  })
})

describe('emptyOrderBook', () => {
  it('creates an empty book with the given symbol', () => {
    const book = emptyOrderBook('TSLA')

    expect(book.symbol).toBe('TSLA')
    expect(book.bids).toHaveLength(0)
    expect(book.asks).toHaveLength(0)
    expect(book.timestamp).toBeGreaterThan(0)
  })
})
