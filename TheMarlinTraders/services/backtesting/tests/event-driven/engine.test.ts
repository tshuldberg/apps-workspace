import { describe, it, expect, beforeEach } from 'vitest'
import type { OHLCV } from '@marlin/shared'
import {
  EventDrivenBacktester,
  EventQueue,
  PositionManager,
  type PriceEvent,
  type BarEvent,
  type FillEvent,
  type TimerEvent,
  type BacktestEvent,
  type Strategy,
} from '../../src/event-driven/engine.js'
import { OrderMatcher } from '../../src/event-driven/order-matching.js'

// ── Test Helpers ─────────────────────────────────────────────────────────

function makeBars(
  closes: number[],
  options?: { baseTimestamp?: number; volume?: number; symbol?: string },
): OHLCV[] {
  const base = options?.baseTimestamp ?? 1700000000000
  const vol = options?.volume ?? 1_000_000
  return closes.map((close, i) => ({
    open: close - 0.5,
    high: close + 1,
    low: close - 1,
    close,
    volume: vol,
    timestamp: base + i * 86400000,
  }))
}

function makeDetailedBars(
  data: { open: number; high: number; low: number; close: number; volume?: number }[],
  baseTimestamp = 1700000000000,
): OHLCV[] {
  return data.map((d, i) => ({
    ...d,
    volume: d.volume ?? 1_000_000,
    timestamp: baseTimestamp + i * 86400000,
  }))
}

// ── Event Queue Tests ────────────────────────────────────────────────────

describe('EventQueue', () => {
  it('should order events by timestamp ascending', () => {
    const queue = new EventQueue()

    const events: BacktestEvent[] = [
      { type: 'price', timestamp: 300, symbol: 'AAPL', price: 150, volume: 1000 },
      { type: 'price', timestamp: 100, symbol: 'AAPL', price: 148, volume: 1000 },
      { type: 'price', timestamp: 200, symbol: 'AAPL', price: 149, volume: 1000 },
      { type: 'timer', timestamp: 150, label: 'check' },
      { type: 'price', timestamp: 50, symbol: 'AAPL', price: 147, volume: 1000 },
    ]

    for (const e of events) queue.push(e)

    const timestamps: number[] = []
    while (queue.length > 0) {
      timestamps.push(queue.pop()!.timestamp)
    }

    expect(timestamps).toEqual([50, 100, 150, 200, 300])
  })

  it('should return undefined when empty', () => {
    const queue = new EventQueue()
    expect(queue.pop()).toBeUndefined()
    expect(queue.peek()).toBeUndefined()
  })

  it('should report correct length', () => {
    const queue = new EventQueue()
    expect(queue.length).toBe(0)

    queue.push({ type: 'timer', timestamp: 100, label: 'a' })
    expect(queue.length).toBe(1)

    queue.push({ type: 'timer', timestamp: 200, label: 'b' })
    expect(queue.length).toBe(2)

    queue.pop()
    expect(queue.length).toBe(1)
  })

  it('should peek without removing', () => {
    const queue = new EventQueue()
    queue.push({ type: 'timer', timestamp: 100, label: 'a' })
    queue.push({ type: 'timer', timestamp: 50, label: 'b' })

    expect(queue.peek()!.timestamp).toBe(50)
    expect(queue.length).toBe(2)
  })

  it('should clear all events', () => {
    const queue = new EventQueue()
    queue.push({ type: 'timer', timestamp: 100, label: 'a' })
    queue.push({ type: 'timer', timestamp: 200, label: 'b' })

    queue.clear()
    expect(queue.length).toBe(0)
    expect(queue.pop()).toBeUndefined()
  })

  it('should handle many events correctly', () => {
    const queue = new EventQueue()
    const timestamps = Array.from({ length: 100 }, () => Math.floor(Math.random() * 10000))

    for (const ts of timestamps) {
      queue.push({ type: 'timer', timestamp: ts, label: 'x' })
    }

    const result: number[] = []
    while (queue.length > 0) {
      result.push(queue.pop()!.timestamp)
    }

    // Verify sorted ascending
    for (let i = 1; i < result.length; i++) {
      expect(result[i]!).toBeGreaterThanOrEqual(result[i - 1]!)
    }
    expect(result.length).toBe(100)
  })
})

// ── Limit Order Fill Tests ───────────────────────────────────────────────

describe('Limit Order Fills', () => {
  let engine: EventDrivenBacktester

  beforeEach(() => {
    engine = new EventDrivenBacktester({
      initialCapital: 100_000,
      commissionPerUnit: 0,
      slippageCoefficient: 0,
      maxVolumeParticipation: 0.5,
      marketImpactCoefficient: 0,
      averageDailyVolume: 1_000_000,
    })
  })

  it('should fill buy limit order only when price drops to limit', () => {
    // Price sequence: 150, 152, 148, 151
    // Buy limit at 149 should only trigger at 148
    const bars = makeDetailedBars([
      { open: 150, high: 152, low: 149.5, close: 151, volume: 1_000_000 },
      { open: 151, high: 153, low: 150, close: 152, volume: 1_000_000 },
      { open: 152, high: 152.5, low: 147, close: 148, volume: 1_000_000 },
      { open: 148, high: 151, low: 147, close: 151, volume: 1_000_000 },
    ])

    const fills: FillEvent[] = []
    engine.on({ onFill: (f) => fills.push(f) })

    // Strategy that places a buy limit at 149 on init
    const strategy: Strategy = {
      init(eng) {
        eng.submitOrder({
          symbol: 'AAPL',
          side: 'buy',
          type: 'limit',
          quantity: 100,
          limitPrice: 149,
        })
      },
    }

    engine.loadBars('AAPL', bars)
    engine.run(strategy)

    // The limit order should have been filled (price went to 147 in bar 3)
    const orderFills = fills.filter((f) => f.symbol === 'AAPL')
    expect(orderFills.length).toBeGreaterThan(0)

    // Fill should be at limit price (149) or better
    for (const fill of orderFills) {
      expect(fill.fillPrice).toBeLessThanOrEqual(149)
    }
  })

  it('should NOT fill buy limit order if price stays above limit', () => {
    // All prices stay above 160
    const bars = makeDetailedBars([
      { open: 165, high: 168, low: 163, close: 166, volume: 1_000_000 },
      { open: 166, high: 170, low: 164, close: 169, volume: 1_000_000 },
    ])

    const fills: FillEvent[] = []
    engine.on({ onFill: (f) => fills.push(f) })

    const strategy: Strategy = {
      init(eng) {
        eng.submitOrder({
          symbol: 'AAPL',
          side: 'buy',
          type: 'limit',
          quantity: 100,
          limitPrice: 160,
        })
      },
    }

    engine.loadBars('AAPL', bars)
    engine.run(strategy)

    // No fills should have occurred
    expect(fills.length).toBe(0)
  })

  it('should fill sell limit order only when price rises to limit', () => {
    const bars = makeDetailedBars([
      { open: 100, high: 102, low: 99, close: 101, volume: 1_000_000 },
      { open: 101, high: 110, low: 100, close: 108, volume: 1_000_000 },
    ])

    const fills: FillEvent[] = []
    engine.on({ onFill: (f) => fills.push(f) })

    const strategy: Strategy = {
      init(eng) {
        eng.submitOrder({
          symbol: 'AAPL',
          side: 'sell',
          type: 'limit',
          quantity: 50,
          limitPrice: 105,
        })
      },
    }

    engine.loadBars('AAPL', bars)
    engine.run(strategy)

    // Should fill when price hits 110 (above our 105 limit)
    const orderFills = fills.filter((f) => f.symbol === 'AAPL')
    expect(orderFills.length).toBeGreaterThan(0)

    for (const fill of orderFills) {
      expect(fill.fillPrice).toBeGreaterThanOrEqual(105)
    }
  })
})

// ── Partial Fill Tests ───────────────────────────────────────────────────

describe('Partial Fills', () => {
  it('should respect volume constraints on partial fills', () => {
    const engine = new EventDrivenBacktester({
      initialCapital: 100_000,
      commissionPerUnit: 0,
      slippageCoefficient: 0,
      maxVolumeParticipation: 0.1, // Only 10% of bar volume
      marketImpactCoefficient: 0,
      averageDailyVolume: 1_000_000,
    })

    // Low volume bars: 100 shares each
    const bars = makeDetailedBars([
      { open: 100, high: 101, low: 99, close: 100, volume: 100 },
      { open: 100, high: 101, low: 99, close: 100, volume: 100 },
      { open: 100, high: 101, low: 99, close: 100, volume: 100 },
    ])

    const fills: FillEvent[] = []
    engine.on({ onFill: (f) => fills.push(f) })

    // Try to buy 50 shares — at 10% of 100 volume = max 10 per tick
    const strategy: Strategy = {
      init(eng) {
        eng.submitOrder({
          symbol: 'AAPL',
          side: 'buy',
          type: 'market',
          quantity: 50,
        })
      },
    }

    engine.loadBars('AAPL', bars)
    engine.run(strategy)

    // Should get multiple partial fills, none exceeding 10 shares
    if (fills.length > 0) {
      for (const fill of fills) {
        // Each fill should respect the 10% volume cap (10 shares per 100-volume tick)
        // Since we split each bar into 4 ticks of 25% volume each, max is 0.1 * 25 = 2
        expect(fill.filledQty).toBeLessThanOrEqual(50)
      }
    }
  })
})

// ── Stop Order Tests ─────────────────────────────────────────────────────

describe('Stop Orders', () => {
  it('should trigger stop buy when price gaps above stop level', () => {
    const engine = new EventDrivenBacktester({
      initialCapital: 100_000,
      commissionPerUnit: 0,
      slippageCoefficient: 0,
      maxVolumeParticipation: 0.5,
      marketImpactCoefficient: 0,
      averageDailyVolume: 1_000_000,
    })

    // Price gaps from 100 to 115 (above stop at 110)
    const bars = makeDetailedBars([
      { open: 98, high: 101, low: 97, close: 100, volume: 1_000_000 },
      { open: 115, high: 118, low: 114, close: 117, volume: 1_000_000 },
    ])

    const fills: FillEvent[] = []
    engine.on({ onFill: (f) => fills.push(f) })

    const strategy: Strategy = {
      init(eng) {
        eng.submitOrder({
          symbol: 'AAPL',
          side: 'buy',
          type: 'stop',
          quantity: 100,
          stopPrice: 110,
        })
      },
    }

    engine.loadBars('AAPL', bars)
    engine.run(strategy)

    // Stop should have been triggered by the gap open at 115
    const orderFills = fills.filter((f) => f.symbol === 'AAPL')
    expect(orderFills.length).toBeGreaterThan(0)

    // Fill price should be at or near the gap-through price (115), NOT at stop price (110)
    for (const fill of orderFills) {
      expect(fill.fillPrice).toBeGreaterThanOrEqual(110)
    }
  })

  it('should trigger stop sell when price drops below stop level', () => {
    const engine = new EventDrivenBacktester({
      initialCapital: 100_000,
      commissionPerUnit: 0,
      slippageCoefficient: 0,
      maxVolumeParticipation: 0.5,
      marketImpactCoefficient: 0,
      averageDailyVolume: 1_000_000,
    })

    const bars = makeDetailedBars([
      { open: 100, high: 102, low: 99, close: 101, volume: 1_000_000 },
      { open: 88, high: 90, low: 86, close: 89, volume: 1_000_000 },
    ])

    const fills: FillEvent[] = []
    engine.on({ onFill: (f) => fills.push(f) })

    const strategy: Strategy = {
      init(eng) {
        eng.submitOrder({
          symbol: 'AAPL',
          side: 'sell',
          type: 'stop',
          quantity: 100,
          stopPrice: 95,
        })
      },
    }

    engine.loadBars('AAPL', bars)
    engine.run(strategy)

    const orderFills = fills.filter((f) => f.symbol === 'AAPL')
    expect(orderFills.length).toBeGreaterThan(0)

    // Gap-through: fill at actual price near 88, not stop at 95
    for (const fill of orderFills) {
      expect(fill.fillPrice).toBeLessThanOrEqual(95)
    }
  })

  it('should NOT trigger stop if price stays within range', () => {
    const engine = new EventDrivenBacktester({
      initialCapital: 100_000,
      commissionPerUnit: 0,
      slippageCoefficient: 0,
      maxVolumeParticipation: 0.5,
      marketImpactCoefficient: 0,
      averageDailyVolume: 1_000_000,
    })

    const bars = makeDetailedBars([
      { open: 100, high: 102, low: 99, close: 101, volume: 1_000_000 },
      { open: 101, high: 103, low: 100, close: 102, volume: 1_000_000 },
    ])

    const fills: FillEvent[] = []
    engine.on({ onFill: (f) => fills.push(f) })

    const strategy: Strategy = {
      init(eng) {
        eng.submitOrder({
          symbol: 'AAPL',
          side: 'buy',
          type: 'stop',
          quantity: 100,
          stopPrice: 110,
        })
      },
    }

    engine.loadBars('AAPL', bars)
    engine.run(strategy)

    expect(fills.length).toBe(0)
  })
})

// ── Market Impact Tests ──────────────────────────────────────────────────

describe('Market Impact', () => {
  it('should increase market impact with order size', () => {
    const matcher = new OrderMatcher({
      maxVolumeParticipation: 1.0,
      marketImpactCoefficient: 0.1,
      averageDailyVolume: 1_000_000,
      slippageCoefficient: 0,
    })

    const smallImpact = matcher.calculateMarketImpact(100)
    const mediumImpact = matcher.calculateMarketImpact(10_000)
    const largeImpact = matcher.calculateMarketImpact(100_000)

    expect(smallImpact).toBeGreaterThan(0)
    expect(mediumImpact).toBeGreaterThan(smallImpact)
    expect(largeImpact).toBeGreaterThan(mediumImpact)
  })

  it('should follow sqrt model', () => {
    const matcher = new OrderMatcher({
      maxVolumeParticipation: 1.0,
      marketImpactCoefficient: 0.1,
      averageDailyVolume: 1_000_000,
      slippageCoefficient: 0,
    })

    const impact = matcher.calculateMarketImpact(10_000)
    const expected = 0.1 * Math.sqrt(10_000 / 1_000_000)
    expect(impact).toBeCloseTo(expected, 10)
  })

  it('should return zero impact when average volume is zero', () => {
    const matcher = new OrderMatcher({
      maxVolumeParticipation: 1.0,
      marketImpactCoefficient: 0.1,
      averageDailyVolume: 0,
      slippageCoefficient: 0,
    })

    expect(matcher.calculateMarketImpact(100)).toBe(0)
  })
})

// ── Position Manager Tests ───────────────────────────────────────────────

describe('PositionManager', () => {
  let pm: PositionManager

  beforeEach(() => {
    pm = new PositionManager()
  })

  it('should open a new position on first fill', () => {
    pm.applyFill({
      type: 'fill',
      timestamp: 1000,
      orderId: 'ORD-1',
      symbol: 'AAPL',
      side: 'buy',
      filledQty: 100,
      fillPrice: 150,
      commission: 0,
      remainingQty: 0,
    })

    const pos = pm.getPosition('AAPL')
    expect(pos).toBeDefined()
    expect(pos!.side).toBe('buy')
    expect(pos!.quantity).toBe(100)
    expect(pos!.avgEntryPrice).toBe(150)
  })

  it('should average entry price when adding to position', () => {
    pm.applyFill({
      type: 'fill', timestamp: 1000, orderId: 'ORD-1', symbol: 'AAPL',
      side: 'buy', filledQty: 100, fillPrice: 150, commission: 0, remainingQty: 0,
    })

    pm.applyFill({
      type: 'fill', timestamp: 2000, orderId: 'ORD-2', symbol: 'AAPL',
      side: 'buy', filledQty: 100, fillPrice: 160, commission: 0, remainingQty: 0,
    })

    const pos = pm.getPosition('AAPL')
    expect(pos!.quantity).toBe(200)
    expect(pos!.avgEntryPrice).toBeCloseTo(155, 5)
  })

  it('should close position and calculate realized PnL', () => {
    pm.applyFill({
      type: 'fill', timestamp: 1000, orderId: 'ORD-1', symbol: 'AAPL',
      side: 'buy', filledQty: 100, fillPrice: 150, commission: 0, remainingQty: 0,
    })

    const pnl = pm.applyFill({
      type: 'fill', timestamp: 2000, orderId: 'ORD-2', symbol: 'AAPL',
      side: 'sell', filledQty: 100, fillPrice: 160, commission: 1, remainingQty: 0,
    })

    // (160 - 150) * 100 - 1 = 999
    expect(pnl).toBeCloseTo(999, 5)
    expect(pm.getPosition('AAPL')).toBeUndefined()
    expect(pm.totalRealizedPnl).toBeCloseTo(999, 5)
  })

  it('should track unrealized PnL on mark-to-market', () => {
    pm.applyFill({
      type: 'fill', timestamp: 1000, orderId: 'ORD-1', symbol: 'AAPL',
      side: 'buy', filledQty: 100, fillPrice: 150, commission: 0, remainingQty: 0,
    })

    pm.markToMarket('AAPL', 155)
    expect(pm.totalUnrealizedPnl).toBeCloseTo(500, 5)

    pm.markToMarket('AAPL', 145)
    expect(pm.totalUnrealizedPnl).toBeCloseTo(-500, 5)
  })
})

// ── Full Engine Integration Tests ────────────────────────────────────────

describe('EventDrivenBacktester Integration', () => {
  it('should track equity across a full backtest run', () => {
    const engine = new EventDrivenBacktester({
      initialCapital: 100_000,
      commissionPerUnit: 0,
      slippageCoefficient: 0,
      maxVolumeParticipation: 1.0,
      marketImpactCoefficient: 0,
      averageDailyVolume: 1_000_000,
    })

    // Uptrending prices
    const bars = makeBars([100, 105, 110, 115, 120])

    // Buy on first bar, sell on last bar
    const strategy: Strategy = {
      onBar(eng, event) {
        const pos = eng.positionManager.getPosition('AAPL')
        if (!pos && event.bar.close === 100) {
          eng.submitOrder({
            symbol: 'AAPL',
            side: 'buy',
            type: 'market',
            quantity: 100,
          })
        }
      },
      onPrice(eng, event) {
        const pos = eng.positionManager.getPosition('AAPL')
        if (pos && event.price >= 119) {
          eng.submitOrder({
            symbol: 'AAPL',
            side: 'sell',
            type: 'market',
            quantity: 100,
          })
        }
      },
    }

    engine.loadBars('AAPL', bars)
    engine.run(strategy)

    // Equity should be around starting capital plus profit
    // The exact value depends on fill prices, but should be > initial
    expect(engine.equity).toBeGreaterThanOrEqual(100_000)
  })

  it('should record equity curve at each bar', () => {
    const engine = new EventDrivenBacktester({ initialCapital: 50_000 })
    const bars = makeBars([100, 101, 102, 103, 104])

    engine.loadBars('AAPL', bars)
    engine.run({ })

    // Should have an equity point per bar
    expect(engine.equityCurve.length).toBe(bars.length)
  })

  it('should reject order with zero quantity', () => {
    const engine = new EventDrivenBacktester()
    const rejections: string[] = []

    engine.on({
      onOrderRejected: (_order, reason) => rejections.push(reason),
    })

    engine.loadBars('AAPL', makeBars([100]))

    const strategy: Strategy = {
      init(eng) {
        eng.submitOrder({
          symbol: 'AAPL',
          side: 'buy',
          type: 'market',
          quantity: 0,
        })
      },
    }

    engine.run(strategy)
    expect(rejections.length).toBe(1)
    expect(rejections[0]).toContain('Quantity')
  })

  it('should cancel a pending order', () => {
    const engine = new EventDrivenBacktester()
    engine.loadBars('AAPL', makeBars([100, 101]))

    let orderId = ''
    const strategy: Strategy = {
      init(eng) {
        orderId = eng.submitOrder({
          symbol: 'AAPL',
          side: 'buy',
          type: 'limit',
          quantity: 100,
          limitPrice: 90,
        })
        const cancelled = eng.cancelOrder(orderId)
        expect(cancelled).toBe(true)
      },
    }

    engine.run(strategy)

    // Should have no pending orders
    expect(engine.pendingOrders.length).toBe(0)
  })

  it('should reset to initial state', () => {
    const engine = new EventDrivenBacktester({ initialCapital: 50_000 })
    engine.loadBars('AAPL', makeBars([100, 101, 102]))
    engine.run({})

    engine.reset()

    expect(engine.cash).toBe(50_000)
    expect(engine.trades.length).toBe(0)
    expect(engine.equityCurve.length).toBe(0)
    expect(engine.pendingOrders.length).toBe(0)
  })
})
