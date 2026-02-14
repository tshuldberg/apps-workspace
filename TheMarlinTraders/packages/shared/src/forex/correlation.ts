import type { CorrelationMatrix, CorrelationPeriod } from '../types/multi-asset.js'

/**
 * Calculate the Pearson correlation coefficient between two numeric series.
 *
 * @param seriesA  First data series
 * @param seriesB  Second data series (must be same length as seriesA)
 * @returns Pearson r value in range [-1, 1], or NaN if insufficient data
 */
export function calculateCorrelation(seriesA: number[], seriesB: number[]): number {
  const n = Math.min(seriesA.length, seriesB.length)
  if (n < 2) return NaN

  let sumA = 0
  let sumB = 0
  let sumAB = 0
  let sumA2 = 0
  let sumB2 = 0

  for (let i = 0; i < n; i++) {
    const a = seriesA[i]!
    const b = seriesB[i]!
    sumA += a
    sumB += b
    sumAB += a * b
    sumA2 += a * a
    sumB2 += b * b
  }

  const numerator = n * sumAB - sumA * sumB
  const denominator = Math.sqrt(
    (n * sumA2 - sumA * sumA) * (n * sumB2 - sumB * sumB),
  )

  if (denominator === 0) return 0

  return numerator / denominator
}

/**
 * Build an NxN correlation matrix from close price data.
 *
 * @param symbols      List of symbol identifiers (determines matrix dimensions)
 * @param closePrices  Map of symbol to array of close prices (oldest first)
 * @param period       Label for the period this matrix represents
 * @returns CorrelationMatrix with row-major 2D array
 */
export function buildCorrelationMatrix(
  symbols: string[],
  closePrices: Map<string, number[]>,
  period: CorrelationPeriod = '1M',
): CorrelationMatrix {
  const n = symbols.length
  const matrix: number[][] = Array.from({ length: n }, () => Array(n).fill(0) as number[])

  // Compute returns (percentage change) for correlation — correlating returns
  // is more meaningful than correlating raw prices
  const returns = new Map<string, number[]>()
  for (const symbol of symbols) {
    const prices = closePrices.get(symbol)
    if (!prices || prices.length < 2) {
      returns.set(symbol, [])
      continue
    }
    const rets: number[] = []
    for (let i = 1; i < prices.length; i++) {
      const prev = prices[i - 1]!
      rets.push(prev !== 0 ? (prices[i]! - prev) / prev : 0)
    }
    returns.set(symbol, rets)
  }

  for (let i = 0; i < n; i++) {
    matrix[i]![i] = 1 // Self-correlation is always 1
    const returnsA = returns.get(symbols[i]!) ?? []

    for (let j = i + 1; j < n; j++) {
      const returnsB = returns.get(symbols[j]!) ?? []
      const corr = calculateCorrelation(returnsA, returnsB)
      matrix[i]![j] = corr
      matrix[j]![i] = corr // Symmetric
    }
  }

  return { symbols, matrix, period }
}

/**
 * Get a human-readable label for a correlation value.
 */
export function correlationLabel(r: number): string {
  const abs = Math.abs(r)
  if (abs >= 0.8) return r > 0 ? 'Strong positive' : 'Strong negative'
  if (abs >= 0.5) return r > 0 ? 'Moderate positive' : 'Moderate negative'
  if (abs >= 0.3) return r > 0 ? 'Weak positive' : 'Weak negative'
  return 'No significant correlation'
}
