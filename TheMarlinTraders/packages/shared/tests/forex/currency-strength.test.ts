import { describe, it, expect } from 'vitest'
import {
  calculateCurrencyStrength,
  computePairChanges,
  STRENGTH_PAIRS,
} from '../../src/forex/currency-strength.js'
import type { MajorCurrency } from '../../src/types/multi-asset.js'

// ── STRENGTH_PAIRS ──────────────────────────────────────────────────────────

describe('STRENGTH_PAIRS', () => {
  it('contains 28 pairs (C(8,2) = 28)', () => {
    expect(STRENGTH_PAIRS.length).toBe(28)
  })

  it('includes key major pairs', () => {
    expect(STRENGTH_PAIRS).toContain('USD/EUR')
    expect(STRENGTH_PAIRS).toContain('USD/GBP')
    expect(STRENGTH_PAIRS).toContain('USD/JPY')
  })

  it('has no duplicate pairs', () => {
    const unique = new Set(STRENGTH_PAIRS)
    expect(unique.size).toBe(STRENGTH_PAIRS.length)
  })
})

// ── calculateCurrencyStrength ───────────────────────────────────────────────

describe('calculateCurrencyStrength', () => {
  it('returns 8 currency strength entries', () => {
    const changes = new Map<string, number>()
    // Provide all 28 pairs with some changes
    for (const pair of STRENGTH_PAIRS) {
      changes.set(pair, (Math.random() - 0.5) * 2)
    }

    const result = calculateCurrencyStrength(changes)
    expect(result.length).toBe(8)
  })

  it('returns strength values normalized between 0 and 100', () => {
    const changes = new Map<string, number>()
    for (const pair of STRENGTH_PAIRS) {
      changes.set(pair, (Math.random() - 0.5) * 5)
    }

    const result = calculateCurrencyStrength(changes)
    for (const entry of result) {
      expect(entry.strength).toBeGreaterThanOrEqual(0)
      expect(entry.strength).toBeLessThanOrEqual(100)
    }
  })

  it('sorts results by strength descending', () => {
    const changes = new Map<string, number>()
    for (const pair of STRENGTH_PAIRS) {
      changes.set(pair, (Math.random() - 0.5) * 3)
    }

    const result = calculateCurrencyStrength(changes)
    for (let i = 0; i < result.length - 1; i++) {
      expect(result[i]!.strength).toBeGreaterThanOrEqual(result[i + 1]!.strength)
    }
  })

  it('strongest currency gets 100 and weakest gets 0', () => {
    const changes = new Map<string, number>()
    // USD is strongest: positive changes for USD pairs
    changes.set('USD/EUR', 2.0)
    changes.set('USD/GBP', 2.0)
    changes.set('USD/JPY', 2.0)
    changes.set('USD/AUD', 2.0)
    changes.set('USD/CAD', 2.0)
    changes.set('USD/CHF', 2.0)
    changes.set('USD/NZD', 2.0)
    // Fill rest with 0
    for (const pair of STRENGTH_PAIRS) {
      if (!changes.has(pair)) changes.set(pair, 0)
    }

    const result = calculateCurrencyStrength(changes)
    const max = Math.max(...result.map((r) => r.strength))
    const min = Math.min(...result.map((r) => r.strength))

    expect(max).toBeCloseTo(100, 1)
    expect(min).toBeCloseTo(0, 1)
  })

  it('computes change delta when previous strengths provided', () => {
    const changes = new Map<string, number>()
    for (const pair of STRENGTH_PAIRS) {
      changes.set(pair, 1.0)
    }

    const previous = new Map<MajorCurrency, number>()
    previous.set('USD', 50)
    previous.set('EUR', 50)
    previous.set('GBP', 50)
    previous.set('JPY', 50)
    previous.set('AUD', 50)
    previous.set('CAD', 50)
    previous.set('CHF', 50)
    previous.set('NZD', 50)

    const result = calculateCurrencyStrength(changes, previous)

    // Each entry should have a non-zero change (since current != 50 for most)
    const hasChange = result.some((r) => r.change !== 0)
    expect(hasChange).toBe(true)
  })
})

// ── computePairChanges ──────────────────────────────────────────────────────

describe('computePairChanges', () => {
  it('computes percentage changes correctly', () => {
    const closePrices = new Map<string, number[]>()
    closePrices.set('EUR/USD', [1.0800, 1.0850, 1.0900]) // ~0.93% change over 2 periods

    const changes = computePairChanges(closePrices, 2)
    const change = changes.get('EUR/USD')!

    // (1.0900 - 1.0800) / 1.0800 * 100 ≈ 0.926%
    expect(change).toBeCloseTo(0.926, 1)
  })

  it('handles period longer than available data', () => {
    const closePrices = new Map<string, number[]>()
    closePrices.set('USD/JPY', [150, 155]) // Only 2 data points

    const changes = computePairChanges(closePrices, 100) // Asking for 100 periods
    const change = changes.get('USD/JPY')!

    // Should use all available data: (155 - 150) / 150 * 100 ≈ 3.33%
    expect(change).toBeCloseTo(3.333, 1)
  })

  it('returns 0 for single data point', () => {
    const closePrices = new Map<string, number[]>()
    closePrices.set('GBP/USD', [1.2700])

    const changes = computePairChanges(closePrices, 10)
    expect(changes.get('GBP/USD')).toBe(0)
  })

  it('returns 0 for empty data', () => {
    const closePrices = new Map<string, number[]>()
    const changes = computePairChanges(closePrices, 10)
    expect(changes.size).toBe(0)
  })
})
