/**
 * Order Matching Engine
 * Sprints 43-44: Realistic fill modeling with market impact
 *
 * Models limit order queue positions (FIFO), partial fills based on
 * bar volume, stop order triggers (including gap-through), and
 * market impact using a square-root model.
 */

import type { Order, OrderSide, PriceEvent } from './engine.js'

// ── Configuration ────────────────────────────────────────────────────────

export interface OrderMatcherConfig {
  /** Max fraction of bar volume a single order can fill (default 0.1 = 10%) */
  maxVolumeParticipation: number
  /** Market impact coefficient for sqrt model (default 0.1) */
  marketImpactCoefficient: number
  /** Average daily volume for market impact reference */
  averageDailyVolume: number
  /** Base slippage coefficient applied to market orders */
  slippageCoefficient: number
}

const DEFAULT_MATCHER_CONFIG: OrderMatcherConfig = {
  maxVolumeParticipation: 0.1,
  marketImpactCoefficient: 0.1,
  averageDailyVolume: 1_000_000,
  slippageCoefficient: 0.0005,
}

// ── Match Result ─────────────────────────────────────────────────────────

export interface MatchResult {
  filledQty: number
  fillPrice: number
  marketImpact: number
}

// ── Queue Position Tracker ───────────────────────────────────────────────

interface QueueEntry {
  orderId: string
  queuePosition: number
  estimatedDepth: number
}

// ── Order Matcher ────────────────────────────────────────────────────────

/**
 * Matches orders against incoming price events with realistic modeling:
 * - Market orders: immediate fill with slippage + market impact
 * - Limit orders: FIFO queue position with partial fills based on volume
 * - Stop orders: trigger on price cross, gap-through fills at actual price
 * - Market impact: coefficient * sqrt(order_qty / avg_volume)
 */
export class OrderMatcher {
  readonly config: OrderMatcherConfig
  private queuePositions: Map<string, QueueEntry> = new Map()

  constructor(config?: Partial<OrderMatcherConfig>) {
    this.config = { ...DEFAULT_MATCHER_CONFIG, ...config }
  }

  /**
   * Attempt to match an order against an incoming price event.
   * Returns a MatchResult if the order should be (partially) filled, null otherwise.
   */
  tryMatch(order: Order, tick: PriceEvent): MatchResult | null {
    const remainingQty = order.quantity - order.filledQuantity
    if (remainingQty <= 0) return null

    switch (order.type) {
      case 'market':
        return this.matchMarketOrder(order, tick, remainingQty)
      case 'limit':
        return this.matchLimitOrder(order, tick, remainingQty)
      case 'stop':
        return this.matchStopOrder(order, tick, remainingQty)
      case 'stop_limit':
        return this.matchStopLimitOrder(order, tick, remainingQty)
      default:
        return null
    }
  }

  /**
   * Calculate market impact using the square-root model.
   * impact = coefficient * sqrt(order_qty / avg_volume)
   */
  calculateMarketImpact(orderQty: number): number {
    if (this.config.averageDailyVolume <= 0) return 0
    return (
      this.config.marketImpactCoefficient *
      Math.sqrt(orderQty / this.config.averageDailyVolume)
    )
  }

  /**
   * Estimate fill probability for a limit order based on queue position and volume.
   * Returns a probability between 0 and 1.
   */
  estimateFillProbability(order: Order, availableVolume: number): number {
    const remainingQty = order.quantity - order.filledQuantity
    if (remainingQty <= 0) return 0

    const entry = this.queuePositions.get(order.id)
    const queueDepth = entry?.estimatedDepth ?? availableVolume * 0.5

    // Fill probability based on volume and queue position
    const volumeRatio = availableVolume / (queueDepth + remainingQty)
    return Math.min(Math.max(volumeRatio, 0), 1)
  }

  /**
   * Reset queue positions (e.g., between backtest runs).
   */
  reset(): void {
    this.queuePositions.clear()
  }

  // ── Private Matching Logic ─────────────────────────────────────────────

  private matchMarketOrder(
    order: Order,
    tick: PriceEvent,
    remainingQty: number,
  ): MatchResult {
    // Market orders fill immediately with slippage + impact
    const impact = this.calculateMarketImpact(remainingQty)
    const slippage = tick.price * this.config.slippageCoefficient
    const direction = order.side === 'buy' ? 1 : -1

    const fillPrice = tick.price + direction * (slippage + impact * tick.price)

    // Respect volume participation limits
    const maxFillQty = Math.floor(tick.volume * this.config.maxVolumeParticipation)
    const filledQty = Math.min(remainingQty, Math.max(maxFillQty, 1))

    return {
      filledQty,
      fillPrice,
      marketImpact: impact * tick.price,
    }
  }

  private matchLimitOrder(
    order: Order,
    tick: PriceEvent,
    remainingQty: number,
  ): MatchResult | null {
    const limitPrice = order.limitPrice!

    // Check if the tick price crosses the limit
    const isBuyTriggered = order.side === 'buy' && tick.price <= limitPrice
    const isSellTriggered = order.side === 'sell' && tick.price >= limitPrice

    if (!isBuyTriggered && !isSellTriggered) {
      // Price hasn't reached the limit — update or create queue position
      this.updateQueuePosition(order, tick)
      return null
    }

    // Calculate fill quantity based on volume participation
    const maxFillByVolume = Math.floor(tick.volume * this.config.maxVolumeParticipation)

    // Apply FIFO queue position: only fill if we've accumulated enough queue priority
    const entry = this.queuePositions.get(order.id)
    const queueRatio = entry ? Math.min(entry.queuePosition / (entry.estimatedDepth || 1), 1) : 0.5

    const adjustedMax = Math.max(Math.floor(maxFillByVolume * queueRatio), 1)
    const filledQty = Math.min(remainingQty, adjustedMax)

    // Limit orders fill at the limit price (or better)
    // Small improvement possible if the tick is beyond the limit
    const fillPrice = limitPrice

    const impact = this.calculateMarketImpact(filledQty)

    // Clear queue position after fill
    if (filledQty >= remainingQty) {
      this.queuePositions.delete(order.id)
    }

    return {
      filledQty,
      fillPrice,
      marketImpact: impact * tick.price,
    }
  }

  private matchStopOrder(
    order: Order,
    tick: PriceEvent,
    remainingQty: number,
  ): MatchResult | null {
    const stopPrice = order.stopPrice!

    // Stop buy triggers when price rises to or above stop price
    // Stop sell triggers when price falls to or at/below stop price
    const isBuyTriggered = order.side === 'buy' && tick.price >= stopPrice
    const isSellTriggered = order.side === 'sell' && tick.price <= stopPrice

    if (!isBuyTriggered && !isSellTriggered) return null

    // Gap-through: if the tick price blew past the stop, fill at the actual tick price
    // (not the stop price). This models gap opens correctly.
    const impact = this.calculateMarketImpact(remainingQty)
    const slippage = tick.price * this.config.slippageCoefficient
    const direction = order.side === 'buy' ? 1 : -1

    const fillPrice = tick.price + direction * (slippage + impact * tick.price)

    // Volume-limited fill
    const maxFillQty = Math.floor(tick.volume * this.config.maxVolumeParticipation)
    const filledQty = Math.min(remainingQty, Math.max(maxFillQty, 1))

    return {
      filledQty,
      fillPrice,
      marketImpact: impact * tick.price,
    }
  }

  private matchStopLimitOrder(
    order: Order,
    tick: PriceEvent,
    remainingQty: number,
  ): MatchResult | null {
    const stopPrice = order.stopPrice!
    const limitPrice = order.limitPrice!

    // First, check if stop is triggered
    const isBuyTriggered = order.side === 'buy' && tick.price >= stopPrice
    const isSellTriggered = order.side === 'sell' && tick.price <= stopPrice

    if (!isBuyTriggered && !isSellTriggered) return null

    // Stop is triggered — now check if limit price is acceptable
    const isLimitOk =
      order.side === 'buy' ? tick.price <= limitPrice : tick.price >= limitPrice

    if (!isLimitOk) return null

    // Fill at limit price or better
    const impact = this.calculateMarketImpact(remainingQty)
    const maxFillQty = Math.floor(tick.volume * this.config.maxVolumeParticipation)
    const filledQty = Math.min(remainingQty, Math.max(maxFillQty, 1))

    return {
      filledQty,
      fillPrice: limitPrice,
      marketImpact: impact * tick.price,
    }
  }

  /**
   * Track and evolve the queue position for a limit order.
   * Each tick at the limit price level moves us forward in the queue.
   */
  private updateQueuePosition(order: Order, tick: PriceEvent): void {
    const existing = this.queuePositions.get(order.id)

    if (!existing) {
      // Initialize with estimated queue depth based on volume
      this.queuePositions.set(order.id, {
        orderId: order.id,
        queuePosition: 0,
        estimatedDepth: tick.volume * 0.3,
      })
      return
    }

    // If price is at our limit, we advance in the queue
    const limitPrice = order.limitPrice!
    const atLimit =
      order.side === 'buy'
        ? tick.price <= limitPrice * 1.001
        : tick.price >= limitPrice * 0.999

    if (atLimit) {
      existing.queuePosition += tick.volume * 0.1
    }
  }
}
