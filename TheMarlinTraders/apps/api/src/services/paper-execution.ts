import type { InferSelectModel } from 'drizzle-orm'
import type { paperOrders, paperPositions } from '../db/schema/paper-trading.js'

type PaperOrder = InferSelectModel<typeof paperOrders>

export interface Quote {
  bid: number
  ask: number
  last: number
}

export interface FillResult {
  filled: boolean
  price: number
  quantity: number
}

/**
 * Simulated order execution engine for paper trading.
 * Market orders fill at bid (sell) / ask (buy), not midpoint.
 * Limit orders queue and fill when price reaches the limit.
 * Stop orders trigger at the stop price then execute as market.
 */
export class PaperExecutionEngine {
  /**
   * Attempt to fill an order given the current market quote.
   * Returns a FillResult indicating whether the order was filled.
   */
  tryFill(order: PaperOrder, quote: Quote): FillResult {
    const quantity = order.quantity - (order.filledQuantity ?? 0)
    if (quantity <= 0) {
      return { filled: false, price: 0, quantity: 0 }
    }

    switch (order.type) {
      case 'market':
        return this.fillMarket(order, quote, quantity)
      case 'limit':
        return this.fillLimit(order, quote, quantity)
      case 'stop':
        return this.fillStop(order, quote, quantity)
      default:
        return { filled: false, price: 0, quantity: 0 }
    }
  }

  private fillMarket(order: PaperOrder, quote: Quote, quantity: number): FillResult {
    // Buy at ask, sell at bid — never the midpoint
    const price = order.side === 'buy' ? quote.ask : quote.bid
    return { filled: true, price, quantity }
  }

  private fillLimit(order: PaperOrder, quote: Quote, quantity: number): FillResult {
    const limitPrice = parseFloat(order.limitPrice ?? '0')
    if (limitPrice <= 0) {
      return { filled: false, price: 0, quantity: 0 }
    }

    if (order.side === 'buy' && quote.ask <= limitPrice) {
      // Buy limit: fill when ask drops to or below limit
      return { filled: true, price: limitPrice, quantity }
    }

    if (order.side === 'sell' && quote.bid >= limitPrice) {
      // Sell limit: fill when bid rises to or above limit
      return { filled: true, price: limitPrice, quantity }
    }

    return { filled: false, price: 0, quantity: 0 }
  }

  private fillStop(order: PaperOrder, quote: Quote, quantity: number): FillResult {
    const stopPrice = parseFloat(order.stopPrice ?? '0')
    if (stopPrice <= 0) {
      return { filled: false, price: 0, quantity: 0 }
    }

    if (order.side === 'buy' && quote.last >= stopPrice) {
      // Buy stop triggers when price rises to stop, then fills at ask
      return { filled: true, price: quote.ask, quantity }
    }

    if (order.side === 'sell' && quote.last <= stopPrice) {
      // Sell stop triggers when price drops to stop, then fills at bid
      return { filled: true, price: quote.bid, quantity }
    }

    return { filled: false, price: 0, quantity: 0 }
  }

  /**
   * Validate that a buy order has sufficient buying power.
   */
  validateBuyingPower(cashBalance: number, price: number, quantity: number): boolean {
    return cashBalance >= price * quantity
  }

  /**
   * Validate that a sell order has sufficient shares in the position.
   */
  validateSellQuantity(positionQuantity: number, sellQuantity: number): boolean {
    return positionQuantity >= sellQuantity
  }
}
