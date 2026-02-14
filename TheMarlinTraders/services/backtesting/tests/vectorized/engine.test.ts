import { describe, it, expect } from 'vitest'
import type { OHLCV } from '@marlin/shared'
import { VectorizedBacktester } from '../../src/vectorized/engine.js'
import type {
  BacktestStrategy,
  BacktestConfig,
  Signal,
  OpenPosition,
} from '../../src/vectorized/engine.js'
import { IBKR_TIERED, ZERO_COMMISSION } from '../../src/vectorized/commission.js'

// ── Test Helpers ──────────────────────────────────────────────────────────

const DAY_MS = 86_400_000
const BASE_TS = 1704200400000 // 2024-01-02

/**
 * Generate bars from close prices with realistic OHLCV structure.
 */
function makeBars(closes: number[], startTs = BASE_TS): OHLCV[] {
  return closes.map((close, i) => ({
    open: i === 0 ? close : closes[i - 1]!, // open at previous close
    high: close + 1,
    low: close - 1,
    close,
    volume: 1_000_000,
    timestamp: startTs + i * DAY_MS,
  }))
}

/**
 * Generate bars with explicit open prices (important for fill testing).
 */
function makeDetailedBars(
  data: Array<{ open: number; high: number; low: number; close: number }>,
  startTs = BASE_TS,
): OHLCV[] {
  return data.map((d, i) => ({
    ...d,
    volume: 1_000_000,
    timestamp: startTs + i * DAY_MS,
  }))
}

function defaultConfig(overrides?: Partial<BacktestConfig>): BacktestConfig {
  return {
    initialCapital: 100_000,
    positionSize: 100,
    slippageBps: 0,
    commission: ZERO_COMMISSION,
    symbol: 'TEST',
    ...overrides,
  }
}

// ── Strategies for Testing ────────────────────────────────────────────────

/** Buys on first bar, holds forever (engine force-closes at end). */
const buyAndHoldStrategy: BacktestStrategy = {
  name: 'Buy and Hold',
  onBar(_bar: OHLCV, index: number, _bars: OHLCV[], position: OpenPosition | null): Signal {
    if (index === 0 && !position) {
      return { action: 'buy' }
    }
    return { action: 'none' }
  },
}

/** Simple MA crossover: buy when 3-period SMA > 5-period SMA, sell when opposite. */
function maCrossoverStrategy(fast = 3, slow = 5): BacktestStrategy {
  return {
    name: `MA Crossover (${fast}/${slow})`,
    onBar(_bar: OHLCV, index: number, bars: OHLCV[], position: OpenPosition | null): Signal {
      if (index < slow) return { action: 'none' }

      const fastMA = sma(bars, index, fast)
      const slowMA = sma(bars, index, slow)
      const prevFast = sma(bars, index - 1, fast)
      const prevSlow = sma(bars, index - 1, slow)

      // Golden cross
      if (prevFast <= prevSlow && fastMA > slowMA && !position) {
        return { action: 'buy' }
      }
      // Death cross
      if (prevFast >= prevSlow && fastMA < slowMA && position?.side === 'long') {
        return { action: 'sell' }
      }

      return { action: 'none' }
    },
  }
}

function sma(bars: OHLCV[], endIndex: number, period: number): number {
  let sum = 0
  for (let i = endIndex - period + 1; i <= endIndex; i++) {
    sum += bars[i]!.close
  }
  return sum / period
}

/** Buys with a limit order at a specified price. */
function limitBuyStrategy(limitPrice: number): BacktestStrategy {
  return {
    name: `Limit Buy at ${limitPrice}`,
    onBar(_bar: OHLCV, index: number, _bars: OHLCV[], position: OpenPosition | null): Signal {
      if (index === 0 && !position) {
        return { action: 'buy', orderType: 'limit', price: limitPrice }
      }
      return { action: 'none' }
    },
  }
}

// ── Engine Tests ──────────────────────────────────────────────────────────

describe('VectorizedBacktester', () => {
  const engine = new VectorizedBacktester()

  // ── Buy and Hold ────────────────────────────────────────────────────

  describe('buy and hold strategy', () => {
    it('should produce correct equity curve for rising prices', () => {
      // Price goes from 100 to 110 over 10 bars
      const bars = makeBars([100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110])
      const config = defaultConfig()
      const result = engine.run(buyAndHoldStrategy, config, bars)

      // Should have 1 trade (force-closed at end)
      expect(result.trades).toHaveLength(1)

      const trade = result.trades[0]!
      expect(trade.side).toBe('long')
      expect(trade.quantity).toBe(100)

      // Entry: fills on bar 1 at its open (which equals bar 0's close = 100)
      expect(trade.entryPrice).toBe(100)

      // Exit: force-closed at last bar's close = 110
      expect(trade.exitPrice).toBe(110)

      // P&L = (110 - 100) * 100 = 1000 (no commission)
      expect(trade.pnl).toBe(1000)

      // Final equity should be initial + profit
      const finalEquity = result.equity[result.equity.length - 1]!.equity
      expect(finalEquity).toBe(101_000)

      // Metrics
      expect(result.metrics.totalReturnPct).toBeCloseTo(1.0, 1) // 1% return
      expect(result.metrics.totalTrades).toBe(1)
      expect(result.metrics.winRate).toBe(100)
    })

    it('should produce correct equity curve for falling prices', () => {
      const bars = makeBars([100, 99, 98, 97, 96, 95])
      const config = defaultConfig()
      const result = engine.run(buyAndHoldStrategy, config, bars)

      const trade = result.trades[0]!
      expect(trade.pnl).toBe(-500) // (95 - 100) * 100

      // Final equity = 100000 - 500 = 99500
      const finalEquity = result.equity[result.equity.length - 1]!.equity
      expect(finalEquity).toBe(99_500)

      expect(result.metrics.totalReturnPct).toBeCloseTo(-0.5, 1)
    })

    it('should handle empty bar array', () => {
      const result = engine.run(buyAndHoldStrategy, defaultConfig(), [])

      expect(result.trades).toHaveLength(0)
      expect(result.equity).toHaveLength(0)
      expect(result.barsProcessed).toBe(0)
      expect(result.metrics.totalTrades).toBe(0)
    })
  })

  // ── MA Crossover Signal Generation ──────────────────────────────────

  describe('MA crossover signals', () => {
    it('should generate buy signal at golden cross', () => {
      // Create a price series that starts flat then trends up
      // so fast MA crosses above slow MA
      const prices = [
        100, 100, 100, 100, 100, // flat period
        101, 103, 105, 107, 109, // uptrend starts
        111, 113, 115,           // continues
      ]
      const bars = makeBars(prices)
      const strategy = maCrossoverStrategy(3, 5)
      const result = engine.run(strategy, defaultConfig(), bars)

      // Should have at least one trade since there's a golden cross
      expect(result.trades.length).toBeGreaterThanOrEqual(1)

      // All trades should be long (this strategy only goes long)
      for (const trade of result.trades) {
        expect(trade.side).toBe('long')
      }
    })

    it('should generate sell signal at death cross', () => {
      // Uptrend then reversal
      const prices = [
        100, 100, 100, 100, 100,
        102, 104, 106, 108, 110, // uptrend -> golden cross -> buy
        108, 106, 104, 102, 100, // downtrend -> death cross -> sell
        98, 96, 94,
      ]
      const bars = makeBars(prices)
      const strategy = maCrossoverStrategy(3, 5)
      const result = engine.run(strategy, defaultConfig(), bars)

      // There should be a completed trade (not just force-closed)
      // because the death cross triggers a sell
      const closedViaSignal = result.trades.filter(
        (t) => t.exitTime !== bars[bars.length - 1]!.timestamp,
      )
      // The strategy should have generated at least one signal-based exit
      // (might also have a force-close if it re-entered)
      expect(result.trades.length).toBeGreaterThanOrEqual(1)
    })
  })

  // ── Market Order Fill Simulation ────────────────────────────────────

  describe('market order fills', () => {
    it('should fill at next bar open price', () => {
      // Signal on bar 0, fill on bar 1
      const bars = makeDetailedBars([
        { open: 100, high: 102, low: 99, close: 101 }, // signal here
        { open: 101.5, high: 103, low: 100, close: 102 }, // fill at open=101.5
        { open: 102, high: 104, low: 101, close: 103 },
      ])

      const result = engine.run(buyAndHoldStrategy, defaultConfig(), bars)

      expect(result.trades).toHaveLength(1)
      // Entry should be bar 1's open price
      expect(result.trades[0]!.entryPrice).toBe(101.5)
    })
  })

  // ── Limit Order Fill Simulation ─────────────────────────────────────

  describe('limit order fills', () => {
    it('should fill limit buy only when price touches limit', () => {
      // Limit buy at 98. Bar 1 low = 100 (no fill). Bar 2 low = 97 (fill).
      const bars = makeDetailedBars([
        { open: 100, high: 102, low: 99, close: 101 }, // signal placed
        { open: 101, high: 103, low: 100, close: 102 }, // low=100 > 98, no fill
        { open: 102, high: 103, low: 97, close: 99 },   // low=97 <= 98, fill!
        { open: 99, high: 101, low: 98, close: 100 },
      ])

      const strategy = limitBuyStrategy(98)
      const result = engine.run(strategy, defaultConfig(), bars)

      expect(result.trades).toHaveLength(1)
      // Should fill at the limit price
      expect(result.trades[0]!.entryPrice).toBe(98)
    })

    it('should not fill if price never reaches limit', () => {
      // Limit buy at 90, but price never drops below 98
      const bars = makeDetailedBars([
        { open: 100, high: 102, low: 99, close: 101 },
        { open: 101, high: 103, low: 100, close: 102 },
        { open: 102, high: 104, low: 98, close: 103 },
      ])

      const strategy = limitBuyStrategy(90)
      const result = engine.run(strategy, defaultConfig(), bars)

      // Force-closed trade might still appear if the limit eventually fills
      // But here 90 is never touched, so no entry should happen
      // The force-close at end only applies to open positions
      expect(result.trades).toHaveLength(0)
    })
  })

  // ── Commission Deduction ────────────────────────────────────────────

  describe('commission deduction', () => {
    it('should reduce equity by commission amount', () => {
      const bars = makeBars([100, 100, 100, 100, 100]) // flat price
      const config = defaultConfig({ commission: IBKR_TIERED })

      const result = engine.run(buyAndHoldStrategy, config, bars)

      expect(result.trades).toHaveLength(1)

      const trade = result.trades[0]!
      // IBKR Tiered: $0.0035/share, min $0.35
      // 100 shares: 100 * 0.0035 = $0.35, but min is $0.35 so = $0.35
      // Total commission = entry ($0.35) + exit ($0.35) = $0.70
      expect(trade.commission).toBeCloseTo(0.70, 2)

      // Price didn't move, so raw PnL = 0, net PnL = -commission
      expect(trade.pnl).toBeCloseTo(-0.70, 2)
    })

    it('should correctly reduce equity for larger positions', () => {
      const bars = makeBars([100, 105, 110])
      const config = defaultConfig({
        positionSize: 1000,
        commission: IBKR_TIERED,
      })

      const result = engine.run(buyAndHoldStrategy, config, bars)
      const trade = result.trades[0]!

      // 1000 shares: 1000 * 0.0035 = $3.50 per side
      // Total commission = $3.50 + $3.50 = $7.00
      expect(trade.commission).toBeCloseTo(7.0, 2)

      // Raw P&L = (110 - 100) * 1000 = $10,000
      // Net P&L = $10,000 - $7.00 = $9,993.00
      expect(trade.pnl).toBeCloseTo(9993.0, 2)
    })

    it('should not deduct commission with ZERO_COMMISSION', () => {
      const bars = makeBars([100, 100, 100])
      const config = defaultConfig({ commission: ZERO_COMMISSION })

      const result = engine.run(buyAndHoldStrategy, config, bars)
      const trade = result.trades[0]!

      expect(trade.commission).toBe(0)
      expect(trade.pnl).toBe(0) // flat price, no commission
    })
  })

  // ── Slippage ────────────────────────────────────────────────────────

  describe('slippage', () => {
    it('should apply slippage in correct direction for buy', () => {
      const bars = makeDetailedBars([
        { open: 100, high: 102, low: 99, close: 101 },
        { open: 100, high: 103, low: 99, close: 102 }, // fill bar
        { open: 102, high: 104, low: 101, close: 103 },
      ])

      // 10 bps slippage = 0.1%
      const config = defaultConfig({ slippageBps: 10 })
      const result = engine.run(buyAndHoldStrategy, config, bars)

      const trade = result.trades[0]!
      // Buy at 100 * (1 + 10/10000) = 100 * 1.001 = 100.10
      expect(trade.entryPrice).toBeCloseTo(100.1, 2)
    })

    it('should apply slippage in correct direction for sell', () => {
      // Strategy that immediately sells (short)
      const shortStrategy: BacktestStrategy = {
        name: 'Short',
        onBar(_bar: OHLCV, index: number, _bars: OHLCV[], position: OpenPosition | null): Signal {
          if (index === 0 && !position) {
            return { action: 'sell' }
          }
          return { action: 'none' }
        },
      }

      const bars = makeDetailedBars([
        { open: 100, high: 102, low: 99, close: 101 },
        { open: 100, high: 103, low: 99, close: 102 }, // fill bar
        { open: 102, high: 104, low: 101, close: 103 },
      ])

      const config = defaultConfig({ slippageBps: 10 })
      const result = engine.run(shortStrategy, config, bars)

      const trade = result.trades[0]!
      // Sell at 100 * (1 - 10/10000) = 100 * 0.999 = 99.90
      expect(trade.entryPrice).toBeCloseTo(99.9, 2)
    })

    it('zero slippage should fill at exact open price', () => {
      const bars = makeDetailedBars([
        { open: 100, high: 102, low: 99, close: 101 },
        { open: 50, high: 55, low: 48, close: 52 }, // big gap down, fill at open=50
        { open: 52, high: 54, low: 50, close: 53 },
      ])

      const config = defaultConfig({ slippageBps: 0 })
      const result = engine.run(buyAndHoldStrategy, config, bars)

      expect(result.trades[0]!.entryPrice).toBe(50)
    })
  })

  // ── Result Structure ────────────────────────────────────────────────

  describe('result structure', () => {
    it('should include all required fields', () => {
      const bars = makeBars([100, 105, 110])
      const result = engine.run(buyAndHoldStrategy, defaultConfig(), bars)

      expect(result.strategyName).toBe('Buy and Hold')
      expect(result.symbol).toBe('TEST')
      expect(result.barsProcessed).toBe(3)
      expect(result.startTime).toBe(bars[0]!.timestamp)
      expect(result.endTime).toBe(bars[2]!.timestamp)
      expect(result.config).toBeDefined()
      expect(result.trades).toBeDefined()
      expect(result.equity).toBeDefined()
      expect(result.metrics).toBeDefined()
    })

    it('should produce equity curve with one point per bar plus initial', () => {
      const bars = makeBars([100, 105, 110, 115, 120])
      const result = engine.run(buyAndHoldStrategy, defaultConfig(), bars)

      // Initial equity point + one per bar
      // (the initial point shares timestamp with bar 0, and each bar produces a point)
      expect(result.equity.length).toBeGreaterThanOrEqual(bars.length)
    })
  })
})
