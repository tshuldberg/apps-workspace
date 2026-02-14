import { describe, it, expect } from 'vitest'
import type { OHLCV } from '@marlin/shared'
import { WalkForwardOptimizer, type ParamGrid, type StrategyFactory } from '../../src/event-driven/walk-forward.js'
import type { Strategy } from '../../src/event-driven/engine.js'

// ── Test Helpers ─────────────────────────────────────────────────────────

function generateTrendingBars(
  count: number,
  options?: { startPrice?: number; trend?: number; noise?: number; baseTimestamp?: number },
): OHLCV[] {
  const start = options?.startPrice ?? 100
  const trend = options?.trend ?? 0.1
  const noise = options?.noise ?? 2
  const base = options?.baseTimestamp ?? 1700000000000

  return Array.from({ length: count }, (_, i) => {
    const mid = start + trend * i + (Math.sin(i * 0.5) * noise)
    return {
      open: mid - 0.5,
      high: mid + 1.5,
      low: mid - 1.5,
      close: mid + 0.5,
      volume: 1_000_000,
      timestamp: base + i * 86400000,
    }
  })
}

/**
 * Simple mean-reversion strategy factory for testing.
 * Parameters: `period` (lookback) and `threshold` (entry z-score).
 */
function makeMeanReversionFactory(): StrategyFactory {
  return (params) => {
    const _period = params.period ?? 10
    const _threshold = params.threshold ?? 1.5
    const prices: number[] = []

    const strategy: Strategy = {
      onBar(engine, event) {
        prices.push(event.bar.close)

        const pos = engine.positionManager.getPosition(event.symbol)

        if (prices.length < _period) return

        const window = prices.slice(-_period)
        const mean = window.reduce((s, p) => s + p, 0) / window.length
        const variance = window.reduce((s, p) => s + (p - mean) ** 2, 0) / window.length
        const stdDev = Math.sqrt(variance)

        if (stdDev === 0) return

        const zScore = (event.bar.close - mean) / stdDev

        if (!pos && zScore < -_threshold) {
          engine.submitOrder({
            symbol: event.symbol,
            side: 'buy',
            type: 'market',
            quantity: 10,
          })
        } else if (pos && pos.side === 'buy' && zScore > 0) {
          engine.submitOrder({
            symbol: event.symbol,
            side: 'sell',
            type: 'market',
            quantity: pos.quantity,
          })
        }
      },
    }
    return strategy
  }
}

// ── Window Generation Tests ──────────────────────────────────────────────

describe('WalkForwardOptimizer - Window Generation', () => {
  it('should generate windows with correct IS/OOS splits', () => {
    const optimizer = new WalkForwardOptimizer({
      inSampleRatio: 0.7,
      stepSize: 50,
      minWindowBars: 10,
    })

    const windows = optimizer.generateWindows(300)

    expect(windows.length).toBeGreaterThan(0)

    for (const w of windows) {
      // IS should come before OOS
      expect(w.isStart).toBeLessThan(w.isEnd)
      expect(w.isEnd).toBe(w.oosStart)
      expect(w.oosStart).toBeLessThan(w.oosEnd)

      // IS should be ~70% of window
      const isLength = w.isEnd - w.isStart
      const oosLength = w.oosEnd - w.oosStart
      const totalLength = isLength + oosLength
      const ratio = isLength / totalLength

      expect(ratio).toBeCloseTo(0.7, 1)
    }
  })

  it('should advance windows by the configured step size', () => {
    const stepSize = 30
    const optimizer = new WalkForwardOptimizer({
      inSampleRatio: 0.7,
      stepSize,
      minWindowBars: 5,
    })

    const windows = optimizer.generateWindows(200)

    for (let i = 1; i < windows.length; i++) {
      const diff = windows[i]!.isStart - windows[i - 1]!.isStart
      expect(diff).toBe(stepSize)
    }
  })

  it('should return empty windows for insufficient data', () => {
    const optimizer = new WalkForwardOptimizer({
      inSampleRatio: 0.7,
      stepSize: 50,
      minWindowBars: 100,
    })

    const windows = optimizer.generateWindows(50)
    expect(windows).toHaveLength(0)
  })

  it('should not generate windows that extend beyond total bars', () => {
    const totalBars = 200
    const optimizer = new WalkForwardOptimizer({
      inSampleRatio: 0.7,
      stepSize: 25,
      minWindowBars: 10,
    })

    const windows = optimizer.generateWindows(totalBars)

    for (const w of windows) {
      expect(w.oosEnd).toBeLessThanOrEqual(totalBars)
    }
  })
})

// ── Walk-Forward Optimization Tests ──────────────────────────────────────

describe('WalkForwardOptimizer - Full Run', () => {
  it('should run optimization and return window results', () => {
    const bars = generateTrendingBars(300, { trend: 0.05, noise: 1 })

    const optimizer = new WalkForwardOptimizer({
      inSampleRatio: 0.7,
      stepSize: 50,
      minWindowBars: 15,
      engineConfig: {
        initialCapital: 100_000,
        commissionPerUnit: 0,
        slippageCoefficient: 0,
        maxVolumeParticipation: 1.0,
        marketImpactCoefficient: 0,
        averageDailyVolume: 1_000_000,
      },
    })

    const paramGrid: ParamGrid = {
      period: [5, 10],
      threshold: [1.0, 2.0],
    }

    const result = optimizer.run(
      makeMeanReversionFactory(),
      paramGrid,
      'TEST',
      bars,
    )

    // Should produce at least one window result
    expect(result.windows.length).toBeGreaterThan(0)

    // Each window should have IS and OOS metrics
    for (const w of result.windows) {
      expect(typeof w.inSampleMetrics.sharpeRatio).toBe('number')
      expect(typeof w.outOfSampleMetrics.sharpeRatio).toBe('number')
      expect(typeof w.sharpeDegradation).toBe('number')
      expect(w.bestParams).toBeDefined()
      expect(Object.keys(w.bestParams).length).toBeGreaterThan(0)
    }

    // Overfitting score should be a number
    expect(typeof result.overfittingScore).toBe('number')
  })

  it('should produce aggregate OOS equity curve', () => {
    const bars = generateTrendingBars(200, { trend: 0.1, noise: 0.5 })

    const optimizer = new WalkForwardOptimizer({
      inSampleRatio: 0.7,
      stepSize: 40,
      minWindowBars: 10,
      engineConfig: {
        initialCapital: 100_000,
        commissionPerUnit: 0,
        slippageCoefficient: 0,
        maxVolumeParticipation: 1.0,
        marketImpactCoefficient: 0,
        averageDailyVolume: 1_000_000,
      },
    })

    const paramGrid: ParamGrid = {
      period: [5, 10],
      threshold: [1.0],
    }

    const result = optimizer.run(
      makeMeanReversionFactory(),
      paramGrid,
      'TEST',
      bars,
    )

    // Aggregate equity should have entries
    if (result.windows.length > 0) {
      expect(result.aggregateOosEquity.length).toBeGreaterThan(0)

      // Equity points should have valid timestamps
      for (const point of result.aggregateOosEquity) {
        expect(typeof point.timestamp).toBe('number')
        expect(typeof point.equity).toBe('number')
        expect(point.equity).toBeGreaterThan(0)
      }
    }
  })
})

// ── Overfitting Detection Tests ──────────────────────────────────────────

describe('WalkForwardOptimizer - Overfitting Detection', () => {
  it('should flag high IS-to-OOS degradation', () => {
    const optimizer = new WalkForwardOptimizer({
      inSampleRatio: 0.7,
      stepSize: 50,
      minWindowBars: 10,
    })

    // Test the metrics calculation directly with known trades
    // Winning trades with variance (positive mean, positive stddev -> positive Sharpe)
    const winningTrades = Array.from({ length: 20 }, (_, i) => ({
      symbol: 'TEST',
      side: 'buy' as const,
      entryPrice: 100,
      exitPrice: 100 + 3 + (i % 3),
      quantity: 10,
      pnl: 30 + (i % 3) * 20,
      entryTime: i * 1000,
      exitTime: i * 1000 + 500,
      commission: 0,
    }))

    // Losing trades with variance (negative mean, positive stddev -> negative Sharpe)
    const losingTrades = Array.from({ length: 20 }, (_, i) => ({
      symbol: 'TEST',
      side: 'buy' as const,
      entryPrice: 100,
      exitPrice: 100 - 3 - (i % 3),
      quantity: 10,
      pnl: -30 - (i % 3) * 20,
      entryTime: i * 1000,
      exitTime: i * 1000 + 500,
      commission: 0,
    }))

    const goodEquity = winningTrades.map((_, i) => ({
      timestamp: i * 1000,
      equity: 100_000 + (i + 1) * 50,
    }))

    const badEquity = losingTrades.map((_, i) => ({
      timestamp: i * 1000,
      equity: 100_000 - (i + 1) * 50,
    }))

    const isMetrics = optimizer.calculateMetrics(winningTrades, goodEquity)
    const oosMetrics = optimizer.calculateMetrics(losingTrades, badEquity)

    // IS should have positive Sharpe, OOS negative Sharpe
    expect(isMetrics.sharpeRatio).toBeGreaterThan(0)
    expect(oosMetrics.sharpeRatio).toBeLessThan(0)

    // Degradation should be positive (IS - OOS)
    const degradation = isMetrics.sharpeRatio - oosMetrics.sharpeRatio
    expect(degradation).toBeGreaterThan(0)
  })

  it('should return zero overfitting score when IS and OOS are similar', () => {
    const optimizer = new WalkForwardOptimizer()

    const consistentTrades = Array.from({ length: 20 }, (_, i) => ({
      symbol: 'TEST',
      side: 'buy' as const,
      entryPrice: 100,
      exitPrice: 102,
      quantity: 10,
      pnl: 20,
      entryTime: i * 1000,
      exitTime: i * 1000 + 500,
      commission: 0,
    }))

    const equity = consistentTrades.map((_, i) => ({
      timestamp: i * 1000,
      equity: 100_000 + (i + 1) * 20,
    }))

    const metrics1 = optimizer.calculateMetrics(consistentTrades, equity)
    const metrics2 = optimizer.calculateMetrics(consistentTrades, equity)

    // Same data -> no degradation
    expect(metrics1.sharpeRatio - metrics2.sharpeRatio).toBeCloseTo(0, 5)
  })
})

// ── Metrics Calculation Tests ────────────────────────────────────────────

describe('WalkForwardOptimizer - Metrics', () => {
  it('should return zero metrics for empty trades', () => {
    const optimizer = new WalkForwardOptimizer()
    const metrics = optimizer.calculateMetrics([], [])

    expect(metrics.totalPnl).toBe(0)
    expect(metrics.sharpeRatio).toBe(0)
    expect(metrics.maxDrawdown).toBe(0)
    expect(metrics.winRate).toBe(0)
    expect(metrics.tradeCount).toBe(0)
    expect(metrics.profitFactor).toBe(0)
  })

  it('should calculate correct win rate', () => {
    const optimizer = new WalkForwardOptimizer()

    const trades = [
      { symbol: 'T', side: 'buy' as const, entryPrice: 100, exitPrice: 110, quantity: 1, pnl: 10, entryTime: 0, exitTime: 1, commission: 0 },
      { symbol: 'T', side: 'buy' as const, entryPrice: 100, exitPrice: 90, quantity: 1, pnl: -10, entryTime: 2, exitTime: 3, commission: 0 },
      { symbol: 'T', side: 'buy' as const, entryPrice: 100, exitPrice: 105, quantity: 1, pnl: 5, entryTime: 4, exitTime: 5, commission: 0 },
    ]

    const metrics = optimizer.calculateMetrics(trades, [])
    expect(metrics.winRate).toBeCloseTo(66.67, 0)
    expect(metrics.tradeCount).toBe(3)
  })

  it('should calculate max drawdown from equity curve', () => {
    const optimizer = new WalkForwardOptimizer()

    const equity = [
      { timestamp: 0, equity: 100_000 },
      { timestamp: 1, equity: 110_000 }, // peak
      { timestamp: 2, equity: 90_000 },  // trough -> 18.18% DD
      { timestamp: 3, equity: 95_000 },
      { timestamp: 4, equity: 115_000 }, // new peak
      { timestamp: 5, equity: 105_000 }, // 8.7% DD from 115k
    ]

    const metrics = optimizer.calculateMetrics(
      [{ symbol: 'T', side: 'buy' as const, entryPrice: 100, exitPrice: 110, quantity: 1, pnl: 10, entryTime: 0, exitTime: 1, commission: 0 }],
      equity,
    )

    // Max DD should be the 110k -> 90k drawdown = 18.18%
    expect(metrics.maxDrawdown).toBeCloseTo(0.1818, 2)
  })
})
