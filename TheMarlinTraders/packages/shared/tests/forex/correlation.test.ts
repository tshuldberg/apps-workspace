import { describe, it, expect } from 'vitest'
import { calculateCorrelation, buildCorrelationMatrix, correlationLabel } from '../../src/forex/correlation.js'

// ── calculateCorrelation ────────────────────────────────────────────────────

describe('calculateCorrelation', () => {
  it('returns 1.0 for perfectly correlated series', () => {
    const a = [1, 2, 3, 4, 5]
    const b = [2, 4, 6, 8, 10]
    expect(calculateCorrelation(a, b)).toBeCloseTo(1.0, 10)
  })

  it('returns -1.0 for perfectly inversely correlated series', () => {
    const a = [1, 2, 3, 4, 5]
    const b = [10, 8, 6, 4, 2]
    expect(calculateCorrelation(a, b)).toBeCloseTo(-1.0, 10)
  })

  it('returns approximately 0 for uncorrelated series', () => {
    // Alternating values with no linear relationship
    const a = [1, 2, 3, 4, 5, 6, 7, 8]
    const b = [2, 1, 4, 3, 6, 5, 8, 7]
    const r = calculateCorrelation(a, b)
    // Should be close to 0 but not exactly 0
    expect(Math.abs(r)).toBeLessThan(0.5)
  })

  it('returns NaN for series shorter than 2', () => {
    expect(calculateCorrelation([1], [2])).toBeNaN()
    expect(calculateCorrelation([], [])).toBeNaN()
  })

  it('handles series of different lengths (uses shorter)', () => {
    const a = [1, 2, 3, 4, 5]
    const b = [2, 4, 6] // Only 3 elements
    const r = calculateCorrelation(a, b)
    expect(r).toBeCloseTo(1.0, 10)
  })

  it('returns 0 for constant series (zero variance)', () => {
    const a = [5, 5, 5, 5]
    const b = [1, 2, 3, 4]
    expect(calculateCorrelation(a, b)).toBe(0)
  })

  it('computes known correlation value', () => {
    // Known example: r ≈ 0.8165
    const a = [1, 2, 3]
    const b = [1, 2, 4]
    const r = calculateCorrelation(a, b)
    expect(r).toBeCloseTo(0.9819, 3)
  })
})

// ── buildCorrelationMatrix ──────────────────────────────────────────────────

describe('buildCorrelationMatrix', () => {
  it('builds a symmetric matrix with 1.0 on the diagonal', () => {
    const symbols = ['AAPL', 'MSFT', 'GOOGL']
    const closePrices = new Map<string, number[]>()
    closePrices.set('AAPL', [150, 152, 151, 155, 158])
    closePrices.set('MSFT', [380, 385, 383, 390, 395])
    closePrices.set('GOOGL', [140, 138, 142, 145, 143])

    const result = buildCorrelationMatrix(symbols, closePrices, '1M')

    // Check dimensions
    expect(result.symbols).toEqual(symbols)
    expect(result.matrix.length).toBe(3)
    expect(result.matrix[0]!.length).toBe(3)

    // Diagonal should be 1.0
    expect(result.matrix[0]![0]).toBe(1)
    expect(result.matrix[1]![1]).toBe(1)
    expect(result.matrix[2]![2]).toBe(1)

    // Symmetry: matrix[i][j] === matrix[j][i]
    expect(result.matrix[0]![1]).toBeCloseTo(result.matrix[1]![0]!, 10)
    expect(result.matrix[0]![2]).toBeCloseTo(result.matrix[2]![0]!, 10)
    expect(result.matrix[1]![2]).toBeCloseTo(result.matrix[2]![1]!, 10)

    // Period label
    expect(result.period).toBe('1M')
  })

  it('handles symbols with no price data', () => {
    const symbols = ['X', 'Y']
    const closePrices = new Map<string, number[]>()
    closePrices.set('X', [10, 20, 30])
    // Y has no data

    const result = buildCorrelationMatrix(symbols, closePrices)

    // Diagonal still 1
    expect(result.matrix[0]![0]).toBe(1)
    expect(result.matrix[1]![1]).toBe(1)

    // Cross-correlation with empty data should be NaN
    expect(result.matrix[0]![1]).toBeNaN()
  })

  it('correlates returns, not raw prices', () => {
    // Two series with identical returns but different price levels
    const symbols = ['A', 'B']
    const closePrices = new Map<string, number[]>()
    closePrices.set('A', [100, 110, 121, 133.1]) // +10% each
    closePrices.set('B', [50, 55, 60.5, 66.55])  // +10% each

    const result = buildCorrelationMatrix(symbols, closePrices)

    // Should be perfectly correlated (both have same returns)
    expect(result.matrix[0]![1]).toBeCloseTo(1.0, 5)
  })
})

// ── correlationLabel ────────────────────────────────────────────────────────

describe('correlationLabel', () => {
  it('labels strong positive', () => {
    expect(correlationLabel(0.85)).toBe('Strong positive')
  })

  it('labels strong negative', () => {
    expect(correlationLabel(-0.9)).toBe('Strong negative')
  })

  it('labels moderate positive', () => {
    expect(correlationLabel(0.6)).toBe('Moderate positive')
  })

  it('labels moderate negative', () => {
    expect(correlationLabel(-0.55)).toBe('Moderate negative')
  })

  it('labels weak positive', () => {
    expect(correlationLabel(0.35)).toBe('Weak positive')
  })

  it('labels no significant correlation', () => {
    expect(correlationLabel(0.1)).toBe('No significant correlation')
    expect(correlationLabel(0)).toBe('No significant correlation')
    expect(correlationLabel(-0.15)).toBe('No significant correlation')
  })
})
