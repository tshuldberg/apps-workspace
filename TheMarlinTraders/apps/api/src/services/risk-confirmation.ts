import type {
  BrokerAccount,
  BrokerOrder,
  BrokerPosition,
} from '../adapters/broker/broker.interface.js'

// ── Risk Levels ────────────────────────────────────────────

export type RiskLevel = 'low' | 'medium' | 'high'

export interface RiskCheckResult {
  approved: boolean
  level: RiskLevel
  warnings: string[]
  /** Hard-blocked = order cannot proceed regardless of user confirmation */
  blocked: boolean
  blockReason?: string
}

// ── Configurable Limits ────────────────────────────────────

export interface RiskPreferences {
  /** Max % of portfolio value for a single position (default 25%) */
  maxPositionSizePercent: number
  /** Max number of open orders (default 20) */
  maxOpenOrders: number
  /** Daily loss limit as % of portfolio value (default 5%) */
  dailyLossLimitPercent: number
  /** Minimum buying power cushion after order (default 10%) */
  minBuyingPowerPercent: number
}

const DEFAULT_PREFERENCES: RiskPreferences = {
  maxPositionSizePercent: 25,
  maxOpenOrders: 20,
  dailyLossLimitPercent: 5,
  minBuyingPowerPercent: 10,
}

// ── Risk Confirmation Service ──────────────────────────────

export class RiskConfirmationService {
  private prefs: RiskPreferences

  constructor(preferences?: Partial<RiskPreferences>) {
    this.prefs = { ...DEFAULT_PREFERENCES, ...preferences }
  }

  /**
   * Run all pre-order risk checks.
   * Returns a result with approval, risk level, warnings, and potential blocks.
   */
  check(
    order: BrokerOrder,
    account: BrokerAccount,
    positions: BrokerPosition[],
    openOrderCount: number,
    dailyPnL: number,
  ): RiskCheckResult {
    const warnings: string[] = []
    let blocked = false
    let blockReason: string | undefined

    // ── 1. Buying power check ────────────────────────────

    const estimatedCost = this.estimateOrderCost(order)

    if (order.side === 'buy' && estimatedCost > account.buyingPower) {
      blocked = true
      blockReason = `Insufficient buying power. Order requires ~$${estimatedCost.toFixed(2)} but only $${account.buyingPower.toFixed(2)} available.`
    }

    // Check buying power cushion
    if (order.side === 'buy' && !blocked) {
      const remainingPower = account.buyingPower - estimatedCost
      const cushionPercent = (remainingPower / account.portfolioValue) * 100
      if (cushionPercent < this.prefs.minBuyingPowerPercent) {
        warnings.push(
          `After this order, buying power will drop to ${cushionPercent.toFixed(1)}% of portfolio value (threshold: ${this.prefs.minBuyingPowerPercent}%).`,
        )
      }
    }

    // ── 2. Position size check ───────────────────────────

    const positionSizePercent =
      account.portfolioValue > 0
        ? (estimatedCost / account.portfolioValue) * 100
        : 0

    // Existing position in same symbol
    const existingPosition = positions.find((p) => p.symbol === order.symbol)
    const totalExposure = estimatedCost + (existingPosition?.marketValue ?? 0)
    const totalExposurePercent =
      account.portfolioValue > 0
        ? (totalExposure / account.portfolioValue) * 100
        : 0

    if (totalExposurePercent > this.prefs.maxPositionSizePercent * 1.5) {
      // Hard block at 1.5x the soft limit
      blocked = true
      blockReason = `Position in ${order.symbol} would reach ${totalExposurePercent.toFixed(1)}% of portfolio, exceeding hard limit of ${(this.prefs.maxPositionSizePercent * 1.5).toFixed(0)}%.`
    } else if (positionSizePercent > this.prefs.maxPositionSizePercent) {
      warnings.push(
        `This order is ${positionSizePercent.toFixed(1)}% of your portfolio (limit: ${this.prefs.maxPositionSizePercent}%).`,
      )
    }

    // ── 3. Daily loss limit ──────────────────────────────

    const dailyLossLimit =
      (this.prefs.dailyLossLimitPercent / 100) * account.portfolioValue
    const currentLoss = Math.abs(Math.min(dailyPnL, 0))

    if (currentLoss >= dailyLossLimit) {
      blocked = true
      blockReason = `Daily loss limit reached. Loss today: $${currentLoss.toFixed(2)} (limit: $${dailyLossLimit.toFixed(2)}).`
    } else if (currentLoss >= dailyLossLimit * 0.8) {
      warnings.push(
        `Approaching daily loss limit: $${currentLoss.toFixed(2)} / $${dailyLossLimit.toFixed(2)}.`,
      )
    }

    // ── 4. Max open orders ───────────────────────────────

    if (openOrderCount >= this.prefs.maxOpenOrders) {
      blocked = true
      blockReason = `Maximum open orders reached (${openOrderCount}/${this.prefs.maxOpenOrders}).`
    } else if (openOrderCount >= this.prefs.maxOpenOrders * 0.8) {
      warnings.push(
        `Approaching max open orders: ${openOrderCount}/${this.prefs.maxOpenOrders}.`,
      )
    }

    // ── Determine risk level ─────────────────────────────

    let level: RiskLevel = 'low'
    if (blocked) {
      level = 'high'
    } else if (warnings.length > 0) {
      level = 'medium'
    }

    return {
      approved: !blocked,
      level,
      warnings,
      blocked,
      blockReason,
    }
  }

  /**
   * Estimate the cost of an order for risk calculations.
   * Uses limit price if available, otherwise assumes current market conditions.
   */
  estimateOrderCost(order: BrokerOrder): number {
    const price =
      order.limitPrice ??
      order.stopPrice ??
      0

    return price * order.quantity
  }

  /**
   * Update the risk preferences for a user.
   */
  updatePreferences(prefs: Partial<RiskPreferences>): void {
    this.prefs = { ...this.prefs, ...prefs }
  }

  /**
   * Get the current risk preferences.
   */
  getPreferences(): RiskPreferences {
    return { ...this.prefs }
  }
}
