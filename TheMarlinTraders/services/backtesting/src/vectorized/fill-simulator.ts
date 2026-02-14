/**
 * Fill Simulator
 * Sprint 41-42: Vectorized Backtesting Engine
 *
 * Simulates order fills against OHLCV bar data with configurable slippage.
 * Market orders fill at the next bar's open price (adjusted for slippage).
 * Limit orders fill only when the bar's price range touches the limit.
 * Stop orders trigger when the bar breaches the stop level.
 */

import type { OHLCV } from '@marlin/shared'

export type OrderSide = 'buy' | 'sell'

export interface FillResult {
  /** Whether the order was filled on this bar */
  filled: boolean
  /** The simulated fill price (including slippage for market orders) */
  fillPrice: number
  /** Index of the bar where the fill occurred */
  barIndex: number
}

// ── Market Order Fills ────────────────────────────────────────────────────

/**
 * Simulate a market order fill at the bar's open price, adjusted for slippage.
 *
 * - Buy orders: fill at open * (1 + slippageBps / 10000)  (slightly worse — higher)
 * - Sell orders: fill at open * (1 - slippageBps / 10000)  (slightly worse — lower)
 *
 * @param bar          The bar on which the fill is simulated (typically next bar after signal)
 * @param side         'buy' or 'sell'
 * @param slippageBps  Slippage in basis points (1 bp = 0.01%). Default 0.
 * @param barIndex     Index of the bar in the series (for the FillResult)
 */
export function simulateMarketFill(
  bar: OHLCV,
  side: OrderSide,
  slippageBps: number = 0,
  barIndex: number = 0,
): FillResult {
  const slippageMultiplier = slippageBps / 10_000

  const fillPrice =
    side === 'buy'
      ? bar.open * (1 + slippageMultiplier)
      : bar.open * (1 - slippageMultiplier)

  return {
    filled: true,
    fillPrice: roundPrice(fillPrice),
    barIndex,
  }
}

// ── Limit Order Fills ─────────────────────────────────────────────────────

/**
 * Simulate a limit order fill.
 *
 * - Buy limit: fills if the bar's low <= limitPrice (price dipped to our level).
 *   Fill price is the limit price (best case — limit is guaranteed price or better).
 * - Sell limit: fills if the bar's high >= limitPrice (price rose to our level).
 *   Fill price is the limit price.
 *
 * @param bar        The OHLCV bar to check
 * @param limitPrice The limit price
 * @param side       'buy' or 'sell'
 * @param barIndex   Index of the bar in the series
 */
export function simulateLimitFill(
  bar: OHLCV,
  limitPrice: number,
  side: OrderSide,
  barIndex: number = 0,
): FillResult {
  if (side === 'buy') {
    // Buy limit: we want to buy at or below limitPrice
    if (bar.low <= limitPrice) {
      return {
        filled: true,
        fillPrice: limitPrice,
        barIndex,
      }
    }
  } else {
    // Sell limit: we want to sell at or above limitPrice
    if (bar.high >= limitPrice) {
      return {
        filled: true,
        fillPrice: limitPrice,
        barIndex,
      }
    }
  }

  return { filled: false, fillPrice: 0, barIndex }
}

// ── Stop Order Fills ──────────────────────────────────────────────────────

/**
 * Simulate a stop order fill.
 *
 * Stop orders become market orders when the stop price is breached.
 * - Sell stop (stop loss on long): triggers if bar's low <= stopPrice.
 *   Fill price is the stop price (approximation — real stops can gap through).
 * - Buy stop (stop loss on short, or breakout entry): triggers if bar's high >= stopPrice.
 *   Fill price is the stop price.
 *
 * @param bar       The OHLCV bar to check
 * @param stopPrice The stop trigger price
 * @param side      'buy' or 'sell'
 * @param barIndex  Index of the bar in the series
 */
export function simulateStopFill(
  bar: OHLCV,
  stopPrice: number,
  side: OrderSide,
  barIndex: number = 0,
): FillResult {
  if (side === 'sell') {
    // Sell stop: triggers when price drops to or below stop
    if (bar.low <= stopPrice) {
      // If the bar opens below the stop (gap down), fill at open instead
      const fillPrice = bar.open < stopPrice ? bar.open : stopPrice
      return {
        filled: true,
        fillPrice: roundPrice(fillPrice),
        barIndex,
      }
    }
  } else {
    // Buy stop: triggers when price rises to or above stop
    if (bar.high >= stopPrice) {
      // If the bar opens above the stop (gap up), fill at open instead
      const fillPrice = bar.open > stopPrice ? bar.open : stopPrice
      return {
        filled: true,
        fillPrice: roundPrice(fillPrice),
        barIndex,
      }
    }
  }

  return { filled: false, fillPrice: 0, barIndex }
}

// ── Helpers ───────────────────────────────────────────────────────────────

/** Round to 4 decimal places to avoid floating point drift */
function roundPrice(price: number): number {
  return Math.round(price * 10_000) / 10_000
}
