/**
 * Vectorized Backtesting Engine
 * Sprint 41-42: Vectorized Backtesting Engine
 *
 * Iterates OHLCV bar arrays, executes strategy logic per bar, tracks positions
 * and equity, simulates fills with slippage/commission, and produces a complete
 * BacktestResult with trade list, equity curve, and performance metrics.
 *
 * Cash accounting model:
 *   - On entry: cash -= entryPrice * quantity + entryCommission
 *   - On exit:  cash += exitPrice * quantity - exitCommission  (long)
 *   - Equity = cash + (positionQty * currentPrice)  if long
 *            = cash + (2 * entryPrice * qty - currentPrice * qty) if short
 *   This simplifies to: equity = cash + positionMarketValue
 */

import type { OHLCV } from '@marlin/shared'
import { simulateMarketFill, simulateLimitFill, simulateStopFill } from './fill-simulator.js'
import type { OrderSide } from './fill-simulator.js'
import { calculateCommission, ZERO_COMMISSION } from './commission.js'
import type { CommissionSchedule } from './commission.js'
import { calculateMetrics } from './metrics.js'
import type { EquityPoint, CompletedTrade, BacktestMetrics } from './metrics.js'

// ── Public Types ──────────────────────────────────────────────────────────

export type SignalAction = 'buy' | 'sell' | 'none'

export interface Signal {
  /** The action to take */
  action: SignalAction
  /** Order type — default 'market' */
  orderType?: 'market' | 'limit' | 'stop'
  /** Limit or stop price (required for limit/stop orders) */
  price?: number
  /** Number of shares to trade (default: use position sizing from config) */
  quantity?: number
}

/**
 * Strategy interface. Implement `onBar` to generate trading signals.
 *
 * The backtester calls `init()` once before the first bar, then `onBar()`
 * for every bar in the series. `onBar` returns a Signal that the engine
 * processes through the fill simulator.
 */
export interface BacktestStrategy {
  /** Human-readable name for this strategy */
  name: string
  /** Called once before the backtest loop begins */
  init?(bars: OHLCV[]): void
  /**
   * Called for each bar. Return a Signal to generate an order,
   * or { action: 'none' } to do nothing.
   *
   * @param bar      Current OHLCV bar
   * @param index    Current bar index in the series
   * @param bars     The full bar array (for lookback calculations)
   * @param position Current open position (null if flat)
   */
  onBar(bar: OHLCV, index: number, bars: OHLCV[], position: OpenPosition | null): Signal
}

export interface BacktestConfig {
  /** Starting cash balance */
  initialCapital: number
  /** Default position size in shares (used when Signal.quantity is not set) */
  positionSize: number
  /** Slippage in basis points applied to market order fills */
  slippageBps?: number
  /** Commission schedule */
  commission?: CommissionSchedule
  /** Symbol being backtested (metadata) */
  symbol?: string
}

export interface OpenPosition {
  /** Trade direction */
  side: 'long' | 'short'
  /** Number of shares */
  quantity: number
  /** Average entry price */
  entryPrice: number
  /** Bar index where the position was opened */
  entryBarIndex: number
  /** Timestamp of entry */
  entryTime: number
}

export interface BacktestResult {
  /** Strategy name */
  strategyName: string
  /** Symbol backtested */
  symbol: string
  /** Configuration used */
  config: BacktestConfig
  /** Completed trades */
  trades: CompletedTrade[]
  /** Equity curve */
  equity: EquityPoint[]
  /** Performance metrics */
  metrics: BacktestMetrics
  /** Total number of bars processed */
  barsProcessed: number
  /** Start timestamp */
  startTime: number
  /** End timestamp */
  endTime: number
}

// ── Pending Order ─────────────────────────────────────────────────────────

interface PendingOrder {
  side: OrderSide
  orderType: 'market' | 'limit' | 'stop'
  price?: number
  quantity: number
  /** Whether this order opens a new position or closes an existing one */
  intent: 'open' | 'close'
}

// ── Engine ────────────────────────────────────────────────────────────────

export class VectorizedBacktester {
  /**
   * Run a backtest.
   *
   * @param strategy  Strategy implementation
   * @param config    Backtest configuration
   * @param bars      OHLCV bar array (chronologically sorted)
   * @returns         Complete BacktestResult
   */
  run(strategy: BacktestStrategy, config: BacktestConfig, bars: OHLCV[]): BacktestResult {
    if (bars.length === 0) {
      return this.emptyResult(strategy, config)
    }

    const commission = config.commission ?? ZERO_COMMISSION
    const slippageBps = config.slippageBps ?? 0
    const symbol = config.symbol ?? 'UNKNOWN'

    let cash = config.initialCapital
    let position: OpenPosition | null = null
    const trades: CompletedTrade[] = []
    const equity: EquityPoint[] = []
    let pendingOrder: PendingOrder | null = null

    // Initialize strategy
    strategy.init?.(bars)

    // Record initial equity
    equity.push({
      timestamp: bars[0]!.timestamp,
      equity: cash,
    })

    for (let i = 0; i < bars.length; i++) {
      const bar = bars[i]!

      // ── Step 1: Try to fill pending orders on this bar ────────────────
      if (pendingOrder) {
        const fillResult = this.tryFillOrder(pendingOrder, bar, i, slippageBps)

        if (fillResult.filled) {
          if (pendingOrder.intent === 'open') {
            const entryCommission = calculateCommission(commission, pendingOrder.quantity)
            const costBasis = fillResult.fillPrice * pendingOrder.quantity

            cash -= costBasis + entryCommission

            position = {
              side: pendingOrder.side === 'buy' ? 'long' : 'short',
              quantity: pendingOrder.quantity,
              entryPrice: fillResult.fillPrice,
              entryBarIndex: i,
              entryTime: bar.timestamp,
            }
          } else if (pendingOrder.intent === 'close' && position) {
            const exitCommission = calculateCommission(commission, position.quantity)
            const entryCommission = calculateCommission(commission, position.quantity)
            const totalCommission = entryCommission + exitCommission

            // Return proceeds to cash: for longs we sell shares, for shorts we buy to cover
            const exitProceeds = fillResult.fillPrice * position.quantity
            cash += exitProceeds - exitCommission

            const rawPnl =
              position.side === 'long'
                ? (fillResult.fillPrice - position.entryPrice) * position.quantity
                : (position.entryPrice - fillResult.fillPrice) * position.quantity

            trades.push({
              entryTime: position.entryTime,
              exitTime: bar.timestamp,
              symbol,
              side: position.side,
              quantity: position.quantity,
              entryPrice: position.entryPrice,
              exitPrice: fillResult.fillPrice,
              pnl: rawPnl - totalCommission,
              commission: totalCommission,
            })

            position = null
          }

          pendingOrder = null
        }
      }

      // ── Step 2: Generate signal from strategy ─────────────────────────
      const signal = strategy.onBar(bar, i, bars, position)

      if (signal.action !== 'none') {
        const orderType = signal.orderType ?? 'market'
        const quantity = signal.quantity ?? config.positionSize

        if (signal.action === 'buy') {
          if (position && position.side === 'short') {
            // Close the short
            pendingOrder = {
              side: 'buy',
              orderType,
              price: signal.price,
              quantity: position.quantity,
              intent: 'close',
            }
          } else if (!position) {
            // Open a long
            pendingOrder = {
              side: 'buy',
              orderType,
              price: signal.price,
              quantity,
              intent: 'open',
            }
          }
        } else if (signal.action === 'sell') {
          if (position && position.side === 'long') {
            // Close the long
            pendingOrder = {
              side: 'sell',
              orderType,
              price: signal.price,
              quantity: position.quantity,
              intent: 'close',
            }
          } else if (!position) {
            // Open a short
            pendingOrder = {
              side: 'sell',
              orderType,
              price: signal.price,
              quantity,
              intent: 'open',
            }
          }
        }
      }

      // ── Step 3: Record equity at bar close ────────────────────────────
      const positionValue = position
        ? this.markToMarket(position, bar.close)
        : 0

      const totalEquity = cash + positionValue

      equity.push({
        timestamp: bar.timestamp,
        equity: totalEquity,
      })
    }

    // ── Force-close any open position at the last bar's close ───────────
    if (position) {
      const lastBar = bars[bars.length - 1]!
      const exitCommission = calculateCommission(commission, position.quantity)
      const entryCommission = calculateCommission(commission, position.quantity)
      const totalCommission = entryCommission + exitCommission

      const rawPnl =
        position.side === 'long'
          ? (lastBar.close - position.entryPrice) * position.quantity
          : (position.entryPrice - lastBar.close) * position.quantity

      trades.push({
        entryTime: position.entryTime,
        exitTime: lastBar.timestamp,
        symbol,
        side: position.side,
        quantity: position.quantity,
        entryPrice: position.entryPrice,
        exitPrice: lastBar.close,
        pnl: rawPnl - totalCommission,
        commission: totalCommission,
      })
    }

    const metrics = calculateMetrics(equity, trades)

    return {
      strategyName: strategy.name,
      symbol,
      config,
      trades,
      equity,
      metrics,
      barsProcessed: bars.length,
      startTime: bars[0]!.timestamp,
      endTime: bars[bars.length - 1]!.timestamp,
    }
  }

  // ── Private Methods ───────────────────────────────────────────────────

  private tryFillOrder(
    order: PendingOrder,
    bar: OHLCV,
    barIndex: number,
    slippageBps: number,
  ) {
    switch (order.orderType) {
      case 'market':
        return simulateMarketFill(bar, order.side, slippageBps, barIndex)
      case 'limit':
        return simulateLimitFill(bar, order.price!, order.side, barIndex)
      case 'stop':
        return simulateStopFill(bar, order.price!, order.side, barIndex)
    }
  }

  /**
   * Mark a position to market at a given price.
   * Returns the current market value of the position.
   *
   * For longs:  qty * currentPrice  (we hold shares worth this much)
   * For shorts: qty * (2 * entryPrice - currentPrice)
   *   Short explanation: we sold at entryPrice and owe shares at currentPrice.
   *   The value we get back is entryPrice * qty (original proceeds) + unrealized P&L.
   *   unrealizedPnl = (entryPrice - currentPrice) * qty
   *   So value = entryPrice * qty + (entryPrice - currentPrice) * qty
   *            = (2 * entryPrice - currentPrice) * qty
   */
  private markToMarket(position: OpenPosition, currentPrice: number): number {
    if (position.side === 'long') {
      return position.quantity * currentPrice
    }
    // Short position
    return position.quantity * (2 * position.entryPrice - currentPrice)
  }

  private emptyResult(
    strategy: BacktestStrategy,
    config: BacktestConfig,
  ): BacktestResult {
    return {
      strategyName: strategy.name,
      symbol: config.symbol ?? 'UNKNOWN',
      config,
      trades: [],
      equity: [],
      metrics: calculateMetrics([], []),
      barsProcessed: 0,
      startTime: 0,
      endTime: 0,
    }
  }
}
