/**
 * Walk-Forward Optimization
 * Sprints 43-44: Sliding window parameter optimization with overfitting detection
 *
 * Splits historical data into rolling in-sample (IS) / out-of-sample (OOS)
 * windows, optimizes strategy parameters on IS, and validates on OOS.
 * Detects overfitting by comparing IS vs OOS Sharpe degradation.
 */

import type { OHLCV } from '@marlin/shared'
import type { Strategy, CompletedTrade, EngineConfig } from './engine.js'
import { EventDrivenBacktester } from './engine.js'

// ── Types ────────────────────────────────────────────────────────────────

export interface WalkForwardConfig {
  /** Fraction of each window used for in-sample training (default 0.7) */
  inSampleRatio: number
  /** Number of bars to step forward between windows */
  stepSize: number
  /** Minimum number of bars for a valid IS or OOS segment */
  minWindowBars: number
  /** Engine configuration passed to each backtest run */
  engineConfig?: Partial<EngineConfig>
}

const DEFAULT_WF_CONFIG: WalkForwardConfig = {
  inSampleRatio: 0.7,
  stepSize: 50,
  minWindowBars: 20,
}

export interface ParamGrid {
  [paramName: string]: number[]
}

export interface ParamSet {
  [paramName: string]: number
}

/** Strategy factory that creates a strategy instance with specific parameters */
export type StrategyFactory = (params: ParamSet) => Strategy

export interface WindowMetrics {
  totalPnl: number
  sharpeRatio: number
  maxDrawdown: number
  winRate: number
  tradeCount: number
  profitFactor: number
}

export interface WindowResult {
  windowIndex: number
  inSampleStart: number
  inSampleEnd: number
  outOfSampleStart: number
  outOfSampleEnd: number
  bestParams: ParamSet
  inSampleMetrics: WindowMetrics
  outOfSampleMetrics: WindowMetrics
  /** IS Sharpe - OOS Sharpe (positive means overfitting) */
  sharpeDegradation: number
}

export interface WalkForwardResult {
  windows: WindowResult[]
  /** Average IS-to-OOS Sharpe degradation across all windows */
  overfittingScore: number
  /** Stitched OOS equity curve (timestamps + equity values) */
  aggregateOosEquity: { timestamp: number; equity: number }[]
  /** Average OOS Sharpe across all windows */
  averageOosSharpe: number
  /** Average IS Sharpe across all windows */
  averageIsSharpe: number
}

// ── Walk-Forward Optimizer ───────────────────────────────────────────────

export class WalkForwardOptimizer {
  private readonly config: WalkForwardConfig

  constructor(config?: Partial<WalkForwardConfig>) {
    this.config = { ...DEFAULT_WF_CONFIG, ...config }
  }

  /**
   * Run walk-forward optimization over a dataset.
   *
   * @param strategyFactory - Creates a strategy instance from a parameter set
   * @param paramGrid - Grid of parameter values to search
   * @param symbol - The trading symbol
   * @param bars - Full historical bar data
   */
  run(
    strategyFactory: StrategyFactory,
    paramGrid: ParamGrid,
    symbol: string,
    bars: OHLCV[],
  ): WalkForwardResult {
    const windows = this.generateWindows(bars.length)
    const results: WindowResult[] = []
    const aggregateOosEquity: { timestamp: number; equity: number }[] = []
    let runningEquity = this.config.engineConfig?.initialCapital ?? 100_000

    for (let i = 0; i < windows.length; i++) {
      const { isStart, isEnd, oosStart, oosEnd } = windows[i]!

      const isBars = bars.slice(isStart, isEnd)
      const oosBars = bars.slice(oosStart, oosEnd)

      if (isBars.length < this.config.minWindowBars || oosBars.length < this.config.minWindowBars) {
        continue
      }

      // Optimize on IS: exhaustive grid search
      const paramCombinations = this.cartesianProduct(paramGrid)
      let bestParams: ParamSet = paramCombinations[0]!
      let bestIsSharpe = -Infinity
      let bestIsMetrics: WindowMetrics | null = null

      for (const params of paramCombinations) {
        const strategy = strategyFactory(params)
        const engine = new EventDrivenBacktester(this.config.engineConfig)
        engine.loadBars(symbol, isBars)
        engine.run(strategy)

        const metrics = this.calculateMetrics(engine.trades, engine.equityCurve)
        if (metrics.sharpeRatio > bestIsSharpe) {
          bestIsSharpe = metrics.sharpeRatio
          bestParams = params
          bestIsMetrics = metrics
        }
      }

      if (!bestIsMetrics) continue

      // Validate on OOS with best params
      const oosStrategy = strategyFactory(bestParams)
      const oosEngine = new EventDrivenBacktester(this.config.engineConfig)
      oosEngine.loadBars(symbol, oosBars)
      oosEngine.run(oosStrategy)

      const oosMetrics = this.calculateMetrics(oosEngine.trades, oosEngine.equityCurve)

      const sharpeDegradation = bestIsMetrics.sharpeRatio - oosMetrics.sharpeRatio

      // Stitch OOS equity into aggregate curve
      for (const point of oosEngine.equityCurve) {
        const relativeReturn = point.equity / (this.config.engineConfig?.initialCapital ?? 100_000)
        aggregateOosEquity.push({
          timestamp: point.timestamp,
          equity: runningEquity * relativeReturn,
        })
      }
      if (oosEngine.equityCurve.length > 0) {
        const lastOos = oosEngine.equityCurve[oosEngine.equityCurve.length - 1]!
        runningEquity *= lastOos.equity / (this.config.engineConfig?.initialCapital ?? 100_000)
      }

      results.push({
        windowIndex: results.length,
        inSampleStart: isBars[0]!.timestamp,
        inSampleEnd: isBars[isBars.length - 1]!.timestamp,
        outOfSampleStart: oosBars[0]!.timestamp,
        outOfSampleEnd: oosBars[oosBars.length - 1]!.timestamp,
        bestParams,
        inSampleMetrics: bestIsMetrics,
        outOfSampleMetrics: oosMetrics,
        sharpeDegradation,
      })
    }

    const avgIsSharpe =
      results.length > 0
        ? results.reduce((s, r) => s + r.inSampleMetrics.sharpeRatio, 0) / results.length
        : 0

    const avgOosSharpe =
      results.length > 0
        ? results.reduce((s, r) => s + r.outOfSampleMetrics.sharpeRatio, 0) / results.length
        : 0

    const overfittingScore =
      results.length > 0
        ? results.reduce((s, r) => s + r.sharpeDegradation, 0) / results.length
        : 0

    return {
      windows: results,
      overfittingScore,
      aggregateOosEquity,
      averageOosSharpe: avgOosSharpe,
      averageIsSharpe: avgIsSharpe,
    }
  }

  // ── Window Generation ──────────────────────────────────────────────────

  /**
   * Generate sliding IS/OOS window boundaries.
   * Returns array of { isStart, isEnd, oosStart, oosEnd } as bar indices.
   */
  generateWindows(
    totalBars: number,
  ): { isStart: number; isEnd: number; oosStart: number; oosEnd: number }[] {
    const windows: { isStart: number; isEnd: number; oosStart: number; oosEnd: number }[] = []
    const windowSize = Math.floor(totalBars * 0.5)
    const isSize = Math.floor(windowSize * this.config.inSampleRatio)
    const oosSize = windowSize - isSize

    if (isSize < this.config.minWindowBars || oosSize < this.config.minWindowBars) {
      return windows
    }

    let start = 0

    while (start + isSize + oosSize <= totalBars) {
      windows.push({
        isStart: start,
        isEnd: start + isSize,
        oosStart: start + isSize,
        oosEnd: start + isSize + oosSize,
      })
      start += this.config.stepSize
    }

    return windows
  }

  // ── Metrics Calculation ────────────────────────────────────────────────

  calculateMetrics(
    trades: CompletedTrade[],
    equityCurve: { timestamp: number; equity: number }[],
  ): WindowMetrics {
    if (trades.length === 0) {
      return {
        totalPnl: 0,
        sharpeRatio: 0,
        maxDrawdown: 0,
        winRate: 0,
        tradeCount: 0,
        profitFactor: 0,
      }
    }

    const pnls = trades.map((t) => t.pnl)
    const totalPnl = pnls.reduce((sum, p) => sum + p, 0)
    const winners = pnls.filter((p) => p > 0)
    const losers = pnls.filter((p) => p < 0)

    const winRate = (winners.length / trades.length) * 100
    const grossProfit = winners.reduce((s, p) => s + p, 0)
    const grossLoss = Math.abs(losers.reduce((s, p) => s + p, 0))
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0

    // Sharpe ratio (annualized, assuming daily returns)
    const mean = pnls.reduce((s, p) => s + p, 0) / pnls.length
    const variance = pnls.reduce((s, p) => s + (p - mean) ** 2, 0) / pnls.length
    const stdDev = Math.sqrt(variance)
    const sharpeRatio = stdDev > 0 ? (mean / stdDev) * Math.sqrt(252) : 0

    // Max drawdown from equity curve
    let maxDrawdown = 0
    let peak = -Infinity

    for (const point of equityCurve) {
      if (point.equity > peak) peak = point.equity
      const dd = (peak - point.equity) / peak
      if (dd > maxDrawdown) maxDrawdown = dd
    }

    return {
      totalPnl,
      sharpeRatio,
      maxDrawdown,
      winRate,
      tradeCount: trades.length,
      profitFactor,
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────

  /**
   * Generate all combinations from a parameter grid.
   * { a: [1, 2], b: [3, 4] } -> [{ a: 1, b: 3 }, { a: 1, b: 4 }, { a: 2, b: 3 }, { a: 2, b: 4 }]
   */
  private cartesianProduct(grid: ParamGrid): ParamSet[] {
    const keys = Object.keys(grid)
    if (keys.length === 0) return [{}]

    const values = keys.map((k) => grid[k]!)
    const result: ParamSet[] = []

    const combine = (idx: number, current: ParamSet): void => {
      if (idx === keys.length) {
        result.push({ ...current })
        return
      }
      for (const val of values[idx]!) {
        current[keys[idx]!] = val
        combine(idx + 1, current)
      }
    }

    combine(0, {})
    return result
  }
}
