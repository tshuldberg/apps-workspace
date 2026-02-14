import type { GreeksResult, OptionType } from './types.js'

/**
 * Standard normal cumulative distribution function (CDF).
 * Uses Abramowitz & Stegun approximation (error < 7.5e-8).
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
  const y = 1.0 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX / 2)

  return 0.5 * (1.0 + sign * y)
}

/**
 * Standard normal probability density function (PDF).
 */
function normPdf(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI)
}

/**
 * Compute d1 and d2 for Black-Scholes.
 * @param S - Current stock price
 * @param K - Strike price
 * @param T - Time to expiration in years
 * @param r - Risk-free interest rate (annualized)
 * @param sigma - Implied volatility (annualized)
 */
function d1d2(
  S: number,
  K: number,
  T: number,
  r: number,
  sigma: number,
): { d1: number; d2: number } {
  const sqrtT = Math.sqrt(T)
  const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * sqrtT)
  const d2 = d1 - sigma * sqrtT
  return { d1, d2 }
}

/**
 * Black-Scholes option price.
 */
export function blackScholesPrice(
  type: OptionType,
  S: number,
  K: number,
  T: number,
  r: number,
  sigma: number,
): number {
  if (T <= 0) return Math.max(type === 'call' ? S - K : K - S, 0)
  const { d1, d2 } = d1d2(S, K, T, r, sigma)
  if (type === 'call') {
    return S * normCdf(d1) - K * Math.exp(-r * T) * normCdf(d2)
  }
  return K * Math.exp(-r * T) * normCdf(-d2) - S * normCdf(-d1)
}

/**
 * Calculate all Greeks for a given option.
 * @param type - 'call' or 'put'
 * @param S - Current stock price
 * @param K - Strike price
 * @param T - Time to expiration in years (must be > 0)
 * @param r - Risk-free interest rate (annualized, e.g. 0.05 for 5%)
 * @param sigma - Implied volatility (annualized, e.g. 0.30 for 30%)
 */
export function calculateGreeks(
  type: OptionType,
  S: number,
  K: number,
  T: number,
  r: number,
  sigma: number,
): GreeksResult {
  if (T <= 0) {
    const itm = type === 'call' ? S > K : S < K
    return {
      delta: itm ? (type === 'call' ? 1 : -1) : 0,
      gamma: 0,
      theta: 0,
      vega: 0,
      rho: 0,
    }
  }

  const { d1, d2 } = d1d2(S, K, T, r, sigma)
  const sqrtT = Math.sqrt(T)
  const pdf_d1 = normPdf(d1)
  const expRT = Math.exp(-r * T)

  let delta: number
  let theta: number
  let rho: number

  if (type === 'call') {
    delta = normCdf(d1)
    theta =
      (-S * pdf_d1 * sigma) / (2 * sqrtT) - r * K * expRT * normCdf(d2)
    rho = (K * T * expRT * normCdf(d2)) / 100
  } else {
    delta = normCdf(d1) - 1
    theta =
      (-S * pdf_d1 * sigma) / (2 * sqrtT) + r * K * expRT * normCdf(-d2)
    rho = (-K * T * expRT * normCdf(-d2)) / 100
  }

  const gamma = pdf_d1 / (S * sigma * sqrtT)
  const vega = (S * pdf_d1 * sqrtT) / 100

  // Theta is per-day (divide annual by 365)
  return {
    delta,
    gamma,
    theta: theta / 365,
    vega,
    rho,
  }
}

/**
 * Calculate implied volatility using Newton-Raphson method.
 * @param type - 'call' or 'put'
 * @param marketPrice - Observed market price of the option
 * @param S - Current stock price
 * @param K - Strike price
 * @param T - Time to expiration in years
 * @param r - Risk-free interest rate
 * @param maxIterations - Maximum iterations (default 100)
 * @param tolerance - Convergence tolerance (default 1e-6)
 * @returns Implied volatility, or NaN if no convergence
 */
export function impliedVolatility(
  type: OptionType,
  marketPrice: number,
  S: number,
  K: number,
  T: number,
  r: number,
  maxIterations = 100,
  tolerance = 1e-6,
): number {
  if (T <= 0 || marketPrice <= 0) return NaN

  // Initial guess using Brenner-Subrahmanyam approximation
  let sigma = Math.sqrt((2 * Math.PI) / T) * (marketPrice / S)
  if (sigma <= 0 || !isFinite(sigma)) sigma = 0.5

  for (let i = 0; i < maxIterations; i++) {
    const price = blackScholesPrice(type, S, K, T, r, sigma)
    const diff = price - marketPrice

    if (Math.abs(diff) < tolerance) return sigma

    // Vega (un-scaled, in terms of sigma not sigma/100)
    const { d1 } = d1d2(S, K, T, r, sigma)
    const vega = S * normPdf(d1) * Math.sqrt(T)

    if (vega < 1e-12) break // Vega too small, can't converge

    sigma = sigma - diff / vega

    if (sigma <= 0) sigma = 0.001 // Keep sigma positive
  }

  return NaN
}

/**
 * IV Rank: where current IV sits within the 52-week high-low range.
 * ivRank = (currentIV - 52wLow) / (52wHigh - 52wLow) * 100
 */
export function ivRank(currentIV: number, low52w: number, high52w: number): number {
  if (high52w <= low52w) return 0
  return Math.max(0, Math.min(100, ((currentIV - low52w) / (high52w - low52w)) * 100))
}

/**
 * IV Percentile: percentage of trading days in the past year with IV below current IV.
 */
export function ivPercentile(currentIV: number, historicalIVs: number[]): number {
  if (historicalIVs.length === 0) return 0
  const below = historicalIVs.filter((iv) => iv < currentIV).length
  return (below / historicalIVs.length) * 100
}
