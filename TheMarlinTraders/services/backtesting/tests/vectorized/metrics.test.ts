import { describe, it, expect } from 'vitest'
import {
  calculateMetrics,
  calculateSharpeRatio,
  calculateSortinoRatio,
} from '../../src/vectorized/metrics.js'
import type { EquityPoint, CompletedTrade } from '../../src/vectorized/metrics.js'

// ── Test Helpers ──────────────────────────────────────────────────────────

const DAY_MS = 86_400_000
const BASE_TS = 1704200400000 // 2024-01-02

function makeEquity(values: number[], startTs = BASE_TS): EquityPoint[] {
  return values.map((equity, i) => ({
    timestamp: startTs + i * DAY_MS,
    equity,
  }))
}

function makeTrade(overrides: Partial<CompletedTrade> = {}): CompletedTrade {
  return {
    entryTime: BASE_TS,
    exitTime: BASE_TS + DAY_MS,
    symbol: 'TEST',
    side: 'long',
    quantity: 100,
    entryPrice: 100,
    exitPrice: 105,
    pnl: 500,
    commission: 0,
    ...overrides,
  }
}

// ── Sharpe Ratio Tests ────────────────────────────────────────────────────

describe('calculateSharpeRatio', () => {
  it('should return 0 for fewer than 2 returns', () => {
    expect(calculateSharpeRatio([])).toBe(0)
    expect(calculateSharpeRatio([0.01])).toBe(0)
  })

  it('should return 0 for zero-variance returns', () => {
    // All returns identical => std = 0
    const returns = [0.01, 0.01, 0.01, 0.01, 0.01]
    expect(calculateSharpeRatio(returns)).toBe(0)
  })

  it('should return positive Sharpe for positive mean returns', () => {
    // Positive returns with some variance
    const returns = [0.01, 0.02, 0.015, 0.012, 0.018, 0.011, 0.016, 0.014]
    const sharpe = calculateSharpeRatio(returns)
    expect(sharpe).toBeGreaterThan(0)
  })

  it('should return negative Sharpe for negative mean returns', () => {
    const returns = [-0.01, -0.02, -0.015, -0.012, -0.018, -0.011, -0.016, -0.014]
    const sharpe = calculateSharpeRatio(returns)
    expect(sharpe).toBeLessThan(0)
  })

  it('should be annualized with sqrt(252)', () => {
    // Known example: daily returns with mean=0.001, std~0.01
    // Sharpe = (0.001 / 0.01) * sqrt(252) = 0.1 * 15.87 ~ 1.587
    const n = 252
    const returns = Array.from({ length: n }, (_, i) =>
      0.001 + (i % 2 === 0 ? 0.01 : -0.01),
    )
    const mean = returns.reduce((s, r) => s + r, 0) / n
    const std = Math.sqrt(
      returns.reduce((s, r) => s + (r - mean) ** 2, 0) / (n - 1),
    )
    const expectedSharpe = (mean / std) * Math.sqrt(252)

    const actualSharpe = calculateSharpeRatio(returns)
    expect(actualSharpe).toBeCloseTo(expectedSharpe, 4)
  })
})

// ── Sortino Ratio Tests ───────────────────────────────────────────────────

describe('calculateSortinoRatio', () => {
  it('should return 0 for fewer than 2 returns', () => {
    expect(calculateSortinoRatio([])).toBe(0)
    expect(calculateSortinoRatio([0.01])).toBe(0)
  })

  it('should return Infinity when all returns are positive', () => {
    const returns = [0.01, 0.02, 0.03, 0.015, 0.025]
    const sortino = calculateSortinoRatio(returns)
    expect(sortino).toBe(Infinity)
  })

  it('should return positive Sortino for positive mean with some downside', () => {
    const returns = [0.02, -0.005, 0.03, -0.01, 0.025, 0.015, -0.003, 0.02]
    const sortino = calculateSortinoRatio(returns)
    expect(sortino).toBeGreaterThan(0)
  })

  it('should be higher than Sharpe when there is low downside vol', () => {
    // Many positive returns, few small negatives
    const returns = [
      0.02, 0.03, 0.015, 0.025, 0.02, 0.018,
      -0.001, // tiny negative
      0.022, 0.019, 0.021,
    ]
    const sharpe = calculateSharpeRatio(returns)
    const sortino = calculateSortinoRatio(returns)

    // Sortino should be higher because downside deviation is small
    expect(sortino).toBeGreaterThan(sharpe)
  })
})

// ── Max Drawdown Tests ────────────────────────────────────────────────────

describe('calculateMetrics - max drawdown', () => {
  it('should calculate correct max drawdown for known sequence', () => {
    // Equity: 100 -> 120 -> 90 -> 110 -> 85 -> 100
    // Drawdown from 120 to 90 = 25% (30/120)
    // Drawdown from 120 to 85 = 29.17% (35/120)
    const equity = makeEquity([100, 120, 90, 110, 85, 100])
    const trades = [makeTrade({ pnl: 0 })] // Need at least 1 trade

    const metrics = calculateMetrics(equity, trades)

    // Max drawdown from peak 120 to trough 85 = 35/120 = 29.17%
    expect(metrics.maxDrawdownPct).toBeCloseTo(29.17, 1)
    expect(metrics.maxDrawdownDollar).toBeCloseTo(35, 2)
  })

  it('should return 0 drawdown for monotonically increasing equity', () => {
    const equity = makeEquity([100, 105, 110, 115, 120])
    const trades = [makeTrade({ pnl: 20 })]

    const metrics = calculateMetrics(equity, trades)

    expect(metrics.maxDrawdownPct).toBe(0)
    expect(metrics.maxDrawdownDollar).toBe(0)
  })

  it('should handle single peak then decline', () => {
    // 100 -> 200 -> 150 -> 100 -> 50
    // DD from 200 to 50 = 75%
    const equity = makeEquity([100, 200, 150, 100, 50])
    const trades = [makeTrade({ pnl: -50 })]

    const metrics = calculateMetrics(equity, trades)

    expect(metrics.maxDrawdownPct).toBeCloseTo(75, 1)
    expect(metrics.maxDrawdownDollar).toBeCloseTo(150, 2)
  })
})

// ── Win Rate Tests ────────────────────────────────────────────────────────

describe('calculateMetrics - win rate', () => {
  it('should calculate correct win rate with known outcomes', () => {
    const equity = makeEquity([100, 110, 105, 115, 108, 120])
    const trades = [
      makeTrade({ pnl: 100 }),   // win
      makeTrade({ pnl: -50 }),   // loss
      makeTrade({ pnl: 200 }),   // win
      makeTrade({ pnl: -30 }),   // loss
      makeTrade({ pnl: 150 }),   // win
    ]

    const metrics = calculateMetrics(equity, trades)

    // 3 wins out of 5 = 60%
    expect(metrics.winRate).toBeCloseTo(60, 1)
    expect(metrics.totalTrades).toBe(5)
  })

  it('should return 100% win rate when all trades are winners', () => {
    const equity = makeEquity([100, 110, 120, 130])
    const trades = [
      makeTrade({ pnl: 100 }),
      makeTrade({ pnl: 200 }),
      makeTrade({ pnl: 50 }),
    ]

    const metrics = calculateMetrics(equity, trades)
    expect(metrics.winRate).toBe(100)
  })

  it('should return 0% win rate when all trades are losers', () => {
    const equity = makeEquity([100, 90, 80, 70])
    const trades = [
      makeTrade({ pnl: -100 }),
      makeTrade({ pnl: -200 }),
      makeTrade({ pnl: -50 }),
    ]

    const metrics = calculateMetrics(equity, trades)
    expect(metrics.winRate).toBe(0)
  })
})

// ── Profit Factor Tests ───────────────────────────────────────────────────

describe('calculateMetrics - profit factor', () => {
  it('should calculate correct profit factor (gross profit / gross loss)', () => {
    const equity = makeEquity([100, 105, 110])
    const trades = [
      makeTrade({ pnl: 300 }),
      makeTrade({ pnl: -100 }),
      makeTrade({ pnl: 200 }),
      makeTrade({ pnl: -50 }),
    ]

    const metrics = calculateMetrics(equity, trades)

    // Gross profit = 300 + 200 = 500
    // Gross loss = 100 + 50 = 150
    // Profit factor = 500 / 150 = 3.33
    expect(metrics.profitFactor).toBeCloseTo(3.33, 2)
  })

  it('should return Infinity when there are no losses', () => {
    const equity = makeEquity([100, 110, 120])
    const trades = [
      makeTrade({ pnl: 100 }),
      makeTrade({ pnl: 200 }),
    ]

    const metrics = calculateMetrics(equity, trades)
    expect(metrics.profitFactor).toBe(Infinity)
  })

  it('should return 0 when there are no wins', () => {
    const equity = makeEquity([100, 90, 80])
    const trades = [
      makeTrade({ pnl: -100 }),
      makeTrade({ pnl: -200 }),
    ]

    const metrics = calculateMetrics(equity, trades)
    expect(metrics.profitFactor).toBe(0)
  })
})

// ── Edge Cases ────────────────────────────────────────────────────────────

describe('calculateMetrics - edge cases', () => {
  it('should return empty metrics for no trades', () => {
    const equity = makeEquity([100, 100, 100])
    const metrics = calculateMetrics(equity, [])

    expect(metrics.totalTrades).toBe(0)
    expect(metrics.winRate).toBe(0)
    expect(metrics.profitFactor).toBe(0)
    expect(metrics.sharpeRatio).toBe(0)
    expect(metrics.maxDrawdownPct).toBe(0)
    expect(metrics.expectancy).toBe(0)
  })

  it('should return empty metrics for insufficient equity data', () => {
    const metrics = calculateMetrics([], [makeTrade()])

    expect(metrics.totalTrades).toBe(0)
    expect(metrics.sharpeRatio).toBe(0)
  })

  it('should calculate avg win and avg loss correctly', () => {
    const equity = makeEquity([100, 110, 105, 115])
    const trades = [
      makeTrade({ pnl: 200 }),
      makeTrade({ pnl: 400 }),
      makeTrade({ pnl: -100 }),
      makeTrade({ pnl: -300 }),
    ]

    const metrics = calculateMetrics(equity, trades)

    // Avg win = (200 + 400) / 2 = 300
    expect(metrics.avgWin).toBeCloseTo(300, 2)
    // Avg loss = -(100 + 300) / 2 = -200
    expect(metrics.avgLoss).toBeCloseTo(-200, 2)
  })

  it('should find largest win and largest loss', () => {
    const equity = makeEquity([100, 110, 105, 115])
    const trades = [
      makeTrade({ pnl: 200 }),
      makeTrade({ pnl: 500 }),
      makeTrade({ pnl: -100 }),
      makeTrade({ pnl: -400 }),
    ]

    const metrics = calculateMetrics(equity, trades)

    expect(metrics.largestWin).toBe(500)
    expect(metrics.largestLoss).toBe(-400)
  })

  it('should count consecutive wins and losses', () => {
    const equity = makeEquity([100, 110, 115, 120, 115, 110, 105, 110])
    const trades = [
      makeTrade({ pnl: 100 }),
      makeTrade({ pnl: 200 }),
      makeTrade({ pnl: 150 }),
      makeTrade({ pnl: -50 }),
      makeTrade({ pnl: -80 }),
      makeTrade({ pnl: 30 }),
    ]

    const metrics = calculateMetrics(equity, trades)

    expect(metrics.maxConsecutiveWins).toBe(3)   // first three wins
    expect(metrics.maxConsecutiveLosses).toBe(2)  // two losses in a row
  })

  it('should calculate total commissions', () => {
    const equity = makeEquity([100, 110, 120])
    const trades = [
      makeTrade({ pnl: 100, commission: 5 }),
      makeTrade({ pnl: 200, commission: 8 }),
      makeTrade({ pnl: -50, commission: 3 }),
    ]

    const metrics = calculateMetrics(equity, trades)
    expect(metrics.totalCommissions).toBe(16) // 5 + 8 + 3
  })

  it('should calculate expectancy as total return / total trades', () => {
    // Equity goes from 100 to 120 (return = 20)
    const equity = makeEquity([100, 110, 120])
    const trades = [
      makeTrade({ pnl: 15 }),
      makeTrade({ pnl: -5 }),
      makeTrade({ pnl: 10 }),
    ]
    // Total return dollar = 120 - 100 = 20
    // Expectancy = 20 / 3 = 6.67
    const metrics = calculateMetrics(equity, trades)
    expect(metrics.expectancy).toBeCloseTo(6.67, 1)
  })

  it('should calculate annualized return (CAGR)', () => {
    // 1 year of data, 100 -> 120 = 20% total = 20% annualized
    const oneYearMs = 365.25 * 24 * 60 * 60 * 1000
    const equity: EquityPoint[] = [
      { timestamp: BASE_TS, equity: 100 },
      { timestamp: BASE_TS + oneYearMs, equity: 120 },
    ]
    const trades = [makeTrade({ pnl: 20 })]

    const metrics = calculateMetrics(equity, trades)
    expect(metrics.annualizedReturnPct).toBeCloseTo(20, 0)
  })

  it('should calculate calmar ratio', () => {
    // Equity: 100 -> 130 -> 100 -> 140
    // Annualized return ~ some value
    // Max DD = 30/130 = 23.08%
    // Calmar = annualized return / max DD %
    const equity = makeEquity([100, 130, 100, 140])
    const trades = [makeTrade({ pnl: 40 })]

    const metrics = calculateMetrics(equity, trades)

    // Just verify calmar is calculated and reasonable
    expect(metrics.calmarRatio).toBeGreaterThan(0)
    // Calmar = annualizedReturn / maxDrawdownPct
    const expectedCalmar = metrics.annualizedReturnPct / Math.abs(metrics.maxDrawdownPct)
    expect(metrics.calmarRatio).toBeCloseTo(expectedCalmar, 4)
  })
})
