import type { GreeksResult } from './types.js'
import type { Strategy, PnLPoint, StrategyLeg } from './strategy-types.js'
import { blackScholesPrice } from './greeks.js'

/**
 * Standard normal CDF (Abramowitz & Stegun approximation).
 * Duplicated here to keep pnl-calculator self-contained without
 * exporting the private normCdf from greeks.ts.
 */
function normCdf(x: number): number {
  const a1 = 0.254829592
  const a2 = -0.284496736
  const a3 = 1.421413741
  const a4 = -1.453152027
  const a5 = 1.061405429
  const p = 0.3275911

  const sign = x < 0 ? -1 : 1
  const absX = Math.abs(x)
  const t = 1.0 / (1.0 + p * absX)
  const y =
    1.0 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp((-absX * absX) / 2)

  return 0.5 * (1.0 + sign * y)
}

/**
 * Contract multiplier — standard options represent 100 shares.
 */
const CONTRACT_MULTIPLIER = 100

/**
 * Calculate the P&L of a single leg at expiration for a given underlying price.
 */
function legPnlAtExpiry(leg: StrategyLeg, underlyingPrice: number): number {
  let intrinsic: number
  if (leg.type === 'call') {
    intrinsic = Math.max(underlyingPrice - leg.strike, 0)
  } else {
    intrinsic = Math.max(leg.strike - underlyingPrice, 0)
  }

  const direction = leg.side === 'buy' ? 1 : -1
  return direction * (intrinsic - leg.premium) * leg.quantity * CONTRACT_MULTIPLIER
}

/**
 * Calculate P&L at expiry across a price range.
 * Returns an array of { price, pnl } points representing the strategy payoff.
 */
export function calculatePnLAtExpiry(
  strategy: Strategy,
  priceRange: [number, number],
  steps: number,
): PnLPoint[] {
  const [min, max] = priceRange
  const stepSize = (max - min) / Math.max(steps - 1, 1)
  const points: PnLPoint[] = []

  for (let i = 0; i < steps; i++) {
    const price = min + i * stepSize
    let totalPnl = 0
    for (const leg of strategy.legs) {
      totalPnl += legPnlAtExpiry(leg, price)
    }
    points.push({ price, pnl: totalPnl })
  }

  return points
}

/**
 * Calculate P&L at a specific date before expiration using Black-Scholes pricing.
 * @param strategy - The multi-leg strategy
 * @param priceRange - [min, max] price range for the underlying
 * @param date - The evaluation date (YYYY-MM-DD)
 * @param volatility - Implied volatility (annualized, e.g. 0.30 for 30%)
 * @param riskFreeRate - Risk-free interest rate (annualized, e.g. 0.05 for 5%)
 */
export function calculatePnLAtDate(
  strategy: Strategy,
  priceRange: [number, number],
  steps: number,
  date: string,
  volatility: number,
  riskFreeRate: number,
): PnLPoint[] {
  const [min, max] = priceRange
  const stepSize = (max - min) / Math.max(steps - 1, 1)
  const points: PnLPoint[] = []

  const evalDate = new Date(date)

  for (let i = 0; i < steps; i++) {
    const price = min + i * stepSize
    let totalPnl = 0

    for (const leg of strategy.legs) {
      const expDate = new Date(leg.expiration)
      const daysToExpiry = Math.max(
        (expDate.getTime() - evalDate.getTime()) / (1000 * 60 * 60 * 24),
        0,
      )
      const T = daysToExpiry / 365

      let currentValue: number
      if (T <= 0) {
        // At or past expiry — use intrinsic value
        currentValue =
          leg.type === 'call'
            ? Math.max(price - leg.strike, 0)
            : Math.max(leg.strike - price, 0)
      } else {
        currentValue = blackScholesPrice(leg.type, price, leg.strike, T, riskFreeRate, volatility)
      }

      const direction = leg.side === 'buy' ? 1 : -1
      const legPnl = direction * (currentValue - leg.premium) * leg.quantity * CONTRACT_MULTIPLIER
      totalPnl += legPnl
    }

    points.push({ price, pnl: totalPnl })
  }

  return points
}

/**
 * Calculate the maximum profit of a strategy.
 * Samples 1000 points across a wide range and checks for unbounded upside.
 * Returns 'unlimited' if the P&L is still increasing at the upper boundary.
 */
export function calculateMaxProfit(strategy: Strategy): number | 'unlimited' {
  if (strategy.legs.length === 0) return 0

  const center = strategy.underlyingPrice
  const range: [number, number] = [center * 0.01, center * 3]
  const points = calculatePnLAtExpiry(strategy, range, 1000)

  const maxPnl = Math.max(...points.map((p) => p.pnl))

  // Check if P&L is still rising at the upper end — indicates unlimited profit
  const last = points[points.length - 1]!
  const secondLast = points[points.length - 2]!
  if (last.pnl > secondLast.pnl && last.pnl === maxPnl) {
    return 'unlimited'
  }

  return maxPnl
}

/**
 * Calculate the maximum loss of a strategy.
 * Returns 'unlimited' if the P&L is still decreasing at either boundary.
 */
export function calculateMaxLoss(strategy: Strategy): number | 'unlimited' {
  if (strategy.legs.length === 0) return 0

  const center = strategy.underlyingPrice
  const range: [number, number] = [center * 0.01, center * 3]
  const points = calculatePnLAtExpiry(strategy, range, 1000)

  const minPnl = Math.min(...points.map((p) => p.pnl))

  // Check if P&L is still falling at boundaries
  const first = points[0]!
  const second = points[1]!
  const last = points[points.length - 1]!
  const secondLast = points[points.length - 2]!

  const fallingAtLower = first.pnl < second.pnl && first.pnl === minPnl
  const fallingAtUpper = last.pnl < secondLast.pnl && last.pnl === minPnl

  if (fallingAtLower || fallingAtUpper) {
    return 'unlimited'
  }

  return minPnl
}

/**
 * Calculate breakeven points for a strategy.
 * Finds all prices where P&L crosses zero at expiry.
 */
export function calculateBreakevens(strategy: Strategy): number[] {
  if (strategy.legs.length === 0) return []

  const center = strategy.underlyingPrice
  const range: [number, number] = [center * 0.5, center * 1.5]
  const points = calculatePnLAtExpiry(strategy, range, 2000)
  const breakevens: number[] = []

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]!
    const curr = points[i]!

    // Detect zero-crossing
    if ((prev.pnl <= 0 && curr.pnl > 0) || (prev.pnl >= 0 && curr.pnl < 0)) {
      // Linear interpolation to find exact crossing
      const ratio = Math.abs(prev.pnl) / (Math.abs(prev.pnl) + Math.abs(curr.pnl))
      const breakeven = prev.price + ratio * (curr.price - prev.price)
      breakevens.push(Math.round(breakeven * 100) / 100)
    }
  }

  return breakevens
}

/**
 * Calculate the probability of profit using the log-normal distribution.
 * Estimates the probability that the underlying will be above (for net long)
 * or within (for spreads) the breakeven zone at expiration.
 *
 * @param strategy - The multi-leg strategy
 * @param volatility - Implied volatility (annualized)
 * @returns Probability of profit as a percentage (0-100)
 */
export function calculateProbOfProfit(strategy: Strategy, volatility: number): number {
  if (strategy.legs.length === 0) return 0

  const breakevens = calculateBreakevens(strategy)
  if (breakevens.length === 0) {
    // If no breakevens, check if strategy is always profitable or always losing
    const testPnl = calculatePnLAtExpiry(strategy, [strategy.underlyingPrice, strategy.underlyingPrice], 1)
    return testPnl[0]!.pnl > 0 ? 100 : 0
  }

  // Use the earliest expiration for time calculation
  const expirations = strategy.legs.map((leg) => new Date(leg.expiration).getTime())
  const earliestExpiry = Math.min(...expirations)
  const now = Date.now()
  const daysToExpiry = Math.max((earliestExpiry - now) / (1000 * 60 * 60 * 24), 1)
  const T = daysToExpiry / 365

  const S = strategy.underlyingPrice
  const sigma = volatility
  const sqrtT = Math.sqrt(T)

  // For each breakeven, calculate the probability of the price being above/below
  // Using log-normal distribution: ln(S_T / S_0) ~ N((r - sigma^2/2)*T, sigma^2*T)
  // Assume r ≈ 0 for simplicity in probability calculation
  const drift = -0.5 * sigma * sigma * T

  // Sample P&L around each breakeven to determine which side is profitable
  const points = calculatePnLAtExpiry(
    strategy,
    [S * 0.5, S * 1.5],
    2000,
  )

  // Count the range where P&L > 0 using the CDF
  let probOfProfit = 0

  // Find continuous profit zones
  const zones: { start: number; end: number }[] = []
  let zoneStart: number | null = null

  for (const point of points) {
    if (point.pnl > 0 && zoneStart === null) {
      zoneStart = point.price
    } else if (point.pnl <= 0 && zoneStart !== null) {
      zones.push({ start: zoneStart, end: point.price })
      zoneStart = null
    }
  }
  // Handle zone extending to the end
  if (zoneStart !== null) {
    zones.push({ start: zoneStart, end: S * 3 }) // Extended upper bound
  }

  for (const zone of zones) {
    const d_start = (Math.log(zone.start / S) - drift) / (sigma * sqrtT)
    const d_end = (Math.log(zone.end / S) - drift) / (sigma * sqrtT)
    probOfProfit += normCdf(d_end) - normCdf(d_start)
  }

  return Math.max(0, Math.min(100, probOfProfit * 100))
}

/**
 * Calculate the net Greeks for a strategy (sum of all legs, direction-weighted).
 */
export function calculateNetGreeks(strategy: Strategy): GreeksResult {
  const net: GreeksResult = { delta: 0, gamma: 0, theta: 0, vega: 0, rho: 0 }

  for (const leg of strategy.legs) {
    if (!leg.greeks) continue

    const direction = leg.side === 'buy' ? 1 : -1
    const multiplier = direction * leg.quantity * CONTRACT_MULTIPLIER

    net.delta += leg.greeks.delta * multiplier
    net.gamma += leg.greeks.gamma * multiplier
    net.theta += leg.greeks.theta * multiplier
    net.vega += leg.greeks.vega * multiplier
    net.rho += leg.greeks.rho * multiplier
  }

  return net
}

/**
 * Calculate the net debit or credit of a strategy.
 * Positive = net debit (you pay), negative = net credit (you receive).
 */
export function calculateNetPremium(strategy: Strategy): number {
  let netPremium = 0
  for (const leg of strategy.legs) {
    const direction = leg.side === 'buy' ? 1 : -1
    netPremium += direction * leg.premium * leg.quantity * CONTRACT_MULTIPLIER
  }
  return netPremium
}

/**
 * Calculate an individual leg's P&L contribution at a specific underlying price at expiry.
 */
export function calculateLegPnLAtExpiry(leg: StrategyLeg, underlyingPrice: number): number {
  return legPnlAtExpiry(leg, underlyingPrice)
}

/**
 * Calculate a default price range for a strategy (±20% around underlying price).
 */
export function getDefaultPriceRange(strategy: Strategy): [number, number] {
  const price = strategy.underlyingPrice
  const legStrikes = strategy.legs.map((l) => l.strike)
  const allPrices = [price, ...legStrikes]
  const min = Math.min(...allPrices)
  const max = Math.max(...allPrices)
  const spread = max - min
  const padding = Math.max(spread * 0.5, price * 0.2)

  return [Math.max(0.01, min - padding), max + padding]
}
