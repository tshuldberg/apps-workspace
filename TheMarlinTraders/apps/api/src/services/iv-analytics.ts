import type {
  IVAnalytics,
  IVSurface,
  SkewData,
  TermStructure,
  VolatilityCone,
  ExpectedMove,
  OptionsChainData,
} from '@marlin/shared'

// ---------------------------------------------------------------------------
// IV Rank & Percentile
// ---------------------------------------------------------------------------

/**
 * IV Rank: where current IV falls in the 52-week high-low range.
 * Result is 0-100.
 *
 * Formula: (currentIV - 52wLow) / (52wHigh - 52wLow) * 100
 */
export function calculateIVRank(currentIV: number, historicalIVs: number[]): number {
  if (historicalIVs.length === 0) return 0
  const low = Math.min(...historicalIVs)
  const high = Math.max(...historicalIVs)
  if (high <= low) return 0
  return Math.max(0, Math.min(100, ((currentIV - low) / (high - low)) * 100))
}

/**
 * IV Percentile: percentage of days where IV was below current IV.
 * Result is 0-100.
 */
export function calculateIVPercentile(currentIV: number, historicalIVs: number[]): number {
  if (historicalIVs.length === 0) return 0
  const below = historicalIVs.filter((iv) => iv < currentIV).length
  return (below / historicalIVs.length) * 100
}

// ---------------------------------------------------------------------------
// IV Surface
// ---------------------------------------------------------------------------

/**
 * Build a 3D IV surface from multiple expiration chains.
 * Returns an IVSurface where ivMatrix[expirationIndex][strikeIndex] = IV.
 */
export function buildIVSurface(chains: OptionsChainData[]): IVSurface {
  if (chains.length === 0) {
    return { symbol: '', expirations: [], strikes: [], ivMatrix: [] }
  }

  const symbol = chains[0]!.underlying

  // Collect all unique strikes across all expirations
  const strikeSet = new Set<number>()
  for (const chain of chains) {
    for (const strike of chain.strikes) {
      strikeSet.add(strike.price)
    }
  }
  const strikes = Array.from(strikeSet).sort((a, b) => a - b)
  const strikeIndex = new Map<number, number>()
  strikes.forEach((s, i) => strikeIndex.set(s, i))

  // Sort chains by expiration
  const sortedChains = [...chains].sort((a, b) =>
    a.expiration.localeCompare(b.expiration),
  )
  const expirations = sortedChains.map((c) => c.expiration)

  // Build the IV matrix
  const ivMatrix: number[][] = []
  for (const chain of sortedChains) {
    const row = new Array<number>(strikes.length).fill(0)
    for (const strike of chain.strikes) {
      const idx = strikeIndex.get(strike.price)
      if (idx === undefined) continue
      // Use average of call and put IV, or whichever is available
      const callIV = strike.call?.iv ?? 0
      const putIV = strike.put?.iv ?? 0
      const avgIV = callIV && putIV ? (callIV + putIV) / 2 : callIV || putIV
      row[idx] = avgIV
    }
    ivMatrix.push(row)
  }

  return { symbol, expirations, strikes, ivMatrix }
}

// ---------------------------------------------------------------------------
// Skew
// ---------------------------------------------------------------------------

/**
 * Build IV skew for a given expiration: strike vs IV for calls and puts.
 */
export function buildSkew(chain: OptionsChainData, expiration: string): SkewData {
  const strikes: number[] = []
  const callIVs: number[] = []
  const putIVs: number[] = []

  for (const strike of chain.strikes) {
    strikes.push(strike.price)
    callIVs.push(strike.call?.iv ?? 0)
    putIVs.push(strike.put?.iv ?? 0)
  }

  return {
    symbol: chain.underlying,
    expiration,
    strikes,
    callIVs,
    putIVs,
  }
}

// ---------------------------------------------------------------------------
// Term Structure
// ---------------------------------------------------------------------------

/**
 * Build IV term structure: expiration vs ATM IV.
 * ATM is defined as the strike closest to the underlying price.
 */
export function buildTermStructure(chains: OptionsChainData[]): TermStructure {
  if (chains.length === 0) {
    return { symbol: '', expirations: [], atm_ivs: [] }
  }

  const symbol = chains[0]!.underlying
  const sortedChains = [...chains].sort((a, b) =>
    a.expiration.localeCompare(b.expiration),
  )

  const expirations: string[] = []
  const atm_ivs: number[] = []

  for (const chain of sortedChains) {
    const underlyingPrice = chain.underlyingPrice
    if (chain.strikes.length === 0) continue

    // Find ATM strike
    let closestStrike = chain.strikes[0]!
    let closestDiff = Math.abs(closestStrike.price - underlyingPrice)

    for (const strike of chain.strikes) {
      const diff = Math.abs(strike.price - underlyingPrice)
      if (diff < closestDiff) {
        closestDiff = diff
        closestStrike = strike
      }
    }

    const callIV = closestStrike.call?.iv ?? 0
    const putIV = closestStrike.put?.iv ?? 0
    const atmIV = callIV && putIV ? (callIV + putIV) / 2 : callIV || putIV

    expirations.push(chain.expiration)
    atm_ivs.push(atmIV)
  }

  return { symbol, expirations, atm_ivs }
}

// ---------------------------------------------------------------------------
// Volatility Cone
// ---------------------------------------------------------------------------

/**
 * Calculate historical volatility for a given period using close-to-close returns.
 * Returns annualized volatility.
 */
function historicalVolatility(prices: number[], period: number): number {
  if (prices.length < period + 1) return 0

  const returns: number[] = []
  const startIdx = prices.length - period - 1
  for (let i = startIdx + 1; i < prices.length; i++) {
    const prev = prices[i - 1]!
    const curr = prices[i]!
    if (prev > 0) {
      returns.push(Math.log(curr / prev))
    }
  }

  if (returns.length === 0) return 0

  const mean = returns.reduce((s, r) => s + r, 0) / returns.length
  const variance =
    returns.reduce((s, r) => s + (r - mean) ** 2, 0) / (returns.length - 1)

  return Math.sqrt(variance * 252) // annualize
}

/**
 * Build volatility cone data: for each lookback period, calculate percentile bands
 * using a rolling window approach across the full history.
 */
export function buildVolatilityCone(
  historicalPrices: number[],
  periods: number[] = [10, 20, 30, 60, 90, 120],
): VolatilityCone[] {
  const cones: VolatilityCone[] = []

  for (const period of periods) {
    if (historicalPrices.length < period + 2) {
      cones.push({
        period,
        percentile5: 0,
        percentile25: 0,
        median: 0,
        percentile75: 0,
        percentile95: 0,
        current: 0,
      })
      continue
    }

    // Calculate rolling HV for every possible window
    const hvValues: number[] = []
    for (let end = period + 1; end <= historicalPrices.length; end++) {
      const window = historicalPrices.slice(end - period - 1, end)
      const hv = historicalVolatility(window, period)
      if (hv > 0) hvValues.push(hv)
    }

    if (hvValues.length === 0) {
      cones.push({
        period,
        percentile5: 0,
        percentile25: 0,
        median: 0,
        percentile75: 0,
        percentile95: 0,
        current: 0,
      })
      continue
    }

    hvValues.sort((a, b) => a - b)
    const pctile = (p: number) => {
      const idx = Math.floor((p / 100) * (hvValues.length - 1))
      return hvValues[idx]!
    }

    // Current HV is the most recent rolling window
    const currentHV = hvValues[hvValues.length - 1]!

    cones.push({
      period,
      percentile5: pctile(5),
      percentile25: pctile(25),
      median: pctile(50),
      percentile75: pctile(75),
      percentile95: pctile(95),
      current: currentHV,
    })
  }

  return cones
}

// ---------------------------------------------------------------------------
// Expected Move
// ---------------------------------------------------------------------------

/**
 * Calculate expected move for a given symbol.
 *
 * Expected move = price * IV * sqrt(DTE / 365)
 *
 * The default probability is 68% (1 standard deviation).
 * For 2 std dev (95%), multiply the move by 2.
 */
export function calculateExpectedMove(
  iv: number,
  price: number,
  dte: number,
  symbol: string = '',
  expiration: string = '',
  probability: number = 0.6827, // 1 std dev
): ExpectedMove {
  // For 1 std dev, multiplier = 1; for 2 std dev (95%), multiplier = 2
  const stdDevMultiplier = probability > 0.9 ? 2 : 1
  const move = price * iv * Math.sqrt(dte / 365) * stdDevMultiplier

  return {
    symbol,
    expiration,
    upperBound: price + move,
    lowerBound: price - move,
    probability,
  }
}
