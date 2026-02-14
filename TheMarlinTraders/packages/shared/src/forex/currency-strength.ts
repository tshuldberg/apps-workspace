import type { CurrencyStrength, MajorCurrency } from '../types/multi-asset.js'
import { MAJOR_CURRENCIES } from '../types/multi-asset.js'

/**
 * The 28 major and cross pairs formed from the 8 major currencies.
 * Each pair is stored as 'BASE/COUNTER'.
 */
export const STRENGTH_PAIRS: readonly string[] = buildAllPairs()

function buildAllPairs(): string[] {
  const pairs: string[] = []
  for (let i = 0; i < MAJOR_CURRENCIES.length; i++) {
    for (let j = i + 1; j < MAJOR_CURRENCIES.length; j++) {
      pairs.push(`${MAJOR_CURRENCIES[i]}/${MAJOR_CURRENCIES[j]}`)
    }
  }
  return pairs
}

/**
 * Calculate the percentage change of each value relative to its first element.
 */
function percentChange(current: number, previous: number): number {
  if (previous === 0) return 0
  return ((current - previous) / previous) * 100
}

/**
 * Calculate the relative strength of 8 major currencies based on the
 * percentage change of 28 major/cross pairs over a given period.
 *
 * @param pairChanges  Map of pair string (e.g. 'EUR/USD') to its percentage
 *                     change over the desired period. Must include all 28
 *                     major/cross pairs.
 * @param previousStrengths  Optional previous strength values to compute change deltas.
 * @returns Array of 8 CurrencyStrength objects sorted by strength descending.
 */
export function calculateCurrencyStrength(
  pairChanges: Map<string, number>,
  previousStrengths?: Map<MajorCurrency, number>,
): CurrencyStrength[] {
  // Accumulate raw strength for each currency
  const rawStrength = new Map<MajorCurrency, number>()
  const pairCounts = new Map<MajorCurrency, number>()

  for (const currency of MAJOR_CURRENCIES) {
    rawStrength.set(currency, 0)
    pairCounts.set(currency, 0)
  }

  for (const [pair, change] of pairChanges) {
    const [base, counter] = pair.split('/') as [MajorCurrency, MajorCurrency]
    if (!base || !counter) continue

    // Base currency gains strength when pair price rises
    if (rawStrength.has(base)) {
      rawStrength.set(base, rawStrength.get(base)! + change)
      pairCounts.set(base, pairCounts.get(base)! + 1)
    }

    // Counter currency loses strength when pair price rises
    if (rawStrength.has(counter)) {
      rawStrength.set(counter, rawStrength.get(counter)! - change)
      pairCounts.set(counter, pairCounts.get(counter)! + 1)
    }
  }

  // Average out the raw strength
  for (const currency of MAJOR_CURRENCIES) {
    const count = pairCounts.get(currency) ?? 1
    if (count > 0) {
      rawStrength.set(currency, rawStrength.get(currency)! / count)
    }
  }

  // Normalize to 0-100 scale
  const values = Array.from(rawStrength.values())
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1

  const results: CurrencyStrength[] = MAJOR_CURRENCIES.map((currency) => {
    const raw = rawStrength.get(currency)!
    const strength = ((raw - min) / range) * 100

    let change = 0
    if (previousStrengths?.has(currency)) {
      change = strength - previousStrengths.get(currency)!
    }

    return { currency, strength, change }
  })

  // Sort by strength descending
  results.sort((a, b) => b.strength - a.strength)

  return results
}

/**
 * Compute pair changes from close price arrays.
 *
 * @param closePrices  Map of pair to array of close prices (oldest first).
 * @param period       Number of bars to look back (e.g. 24 for 24 hours of 1h bars).
 * @returns Map of pair to percentage change over the period.
 */
export function computePairChanges(
  closePrices: Map<string, number[]>,
  period: number,
): Map<string, number> {
  const changes = new Map<string, number>()

  for (const [pair, prices] of closePrices) {
    if (prices.length < 2) {
      changes.set(pair, 0)
      continue
    }

    const lookback = Math.min(period, prices.length - 1)
    const oldPrice = prices[prices.length - 1 - lookback]!
    const currentPrice = prices[prices.length - 1]!
    changes.set(pair, percentChange(currentPrice, oldPrice))
  }

  return changes
}
