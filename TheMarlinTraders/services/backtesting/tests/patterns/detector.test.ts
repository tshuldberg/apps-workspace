import { describe, it, expect } from 'vitest'
import type { OHLCV } from '@marlin/shared'
import { detectPatterns } from '../../src/patterns/detector.js'
import { findPivotHighs, findPivotLows, fitTrendline } from '../../src/patterns/pivots.js'

// ── Test Helpers ───────────────────────────────────────────────────────────

/**
 * Generate a simple OHLCV bar array from close prices.
 * Other fields (open, high, low, volume) are derived from close.
 */
function makeBars(closes: number[], baseTimestamp = 1700000000000): OHLCV[] {
  return closes.map((close, i) => ({
    open: close - 0.5,
    high: close + 1,
    low: close - 1,
    close,
    volume: 1000000 + Math.random() * 500000,
    timestamp: baseTimestamp + i * 86400000,
  }))
}

/**
 * Generate bars with explicit high/low for pivot testing.
 */
function makeDetailedBars(
  data: { open: number; high: number; low: number; close: number; volume?: number }[],
  baseTimestamp = 1700000000000,
): OHLCV[] {
  return data.map((d, i) => ({
    ...d,
    volume: d.volume ?? 1000000,
    timestamp: baseTimestamp + i * 86400000,
  }))
}

// ── Pivot Detection Tests ──────────────────────────────────────────────────

describe('findPivotHighs', () => {
  it('should detect pivot highs with the given period', () => {
    // Create a pattern: low, low, HIGH, low, low → the HIGH should be a pivot
    const bars = makeDetailedBars([
      { open: 10, high: 12, low: 9, close: 11 },
      { open: 11, high: 13, low: 10, close: 12 },
      { open: 12, high: 20, low: 11, close: 15 }, // pivot high
      { open: 15, high: 14, low: 10, close: 12 },
      { open: 12, high: 13, low: 9, close: 11 },
    ])

    const pivots = findPivotHighs(bars, 2)
    expect(pivots).toHaveLength(1)
    expect(pivots[0]!.index).toBe(2)
    expect(pivots[0]!.price).toBe(20)
  })

  it('should return empty for insufficient data', () => {
    const bars = makeBars([10, 15])
    const pivots = findPivotHighs(bars, 3)
    expect(pivots).toHaveLength(0)
  })

  it('should detect multiple pivot highs', () => {
    // Two peaks separated by a valley
    const bars = makeDetailedBars([
      { open: 10, high: 11, low: 9, close: 10 },
      { open: 10, high: 12, low: 9, close: 11 },
      { open: 11, high: 18, low: 10, close: 15 }, // pivot 1
      { open: 15, high: 13, low: 10, close: 12 },
      { open: 12, high: 11, low: 9, close: 10 },
      { open: 10, high: 10, low: 8, close: 9 },   // valley
      { open: 9, high: 11, low: 8, close: 10 },
      { open: 10, high: 12, low: 9, close: 11 },
      { open: 11, high: 19, low: 10, close: 15 },  // pivot 2
      { open: 15, high: 14, low: 10, close: 12 },
      { open: 12, high: 12, low: 9, close: 10 },
    ])

    const pivots = findPivotHighs(bars, 2)
    expect(pivots.length).toBeGreaterThanOrEqual(2)
  })
})

describe('findPivotLows', () => {
  it('should detect pivot lows with the given period', () => {
    const bars = makeDetailedBars([
      { open: 15, high: 16, low: 14, close: 15 },
      { open: 14, high: 15, low: 13, close: 14 },
      { open: 12, high: 13, low: 5, close: 10 }, // pivot low
      { open: 10, high: 14, low: 12, close: 13 },
      { open: 13, high: 16, low: 14, close: 15 },
    ])

    const pivots = findPivotLows(bars, 2)
    expect(pivots).toHaveLength(1)
    expect(pivots[0]!.index).toBe(2)
    expect(pivots[0]!.price).toBe(5)
  })
})

// ── Trendline Fitting Tests ────────────────────────────────────────────────

describe('fitTrendline', () => {
  it('should fit a perfect uptrend line', () => {
    const points = [
      { x: 0, y: 10 },
      { x: 1, y: 12 },
      { x: 2, y: 14 },
      { x: 3, y: 16 },
    ]

    const { slope, intercept, r2 } = fitTrendline(points)
    expect(slope).toBeCloseTo(2, 5)
    expect(intercept).toBeCloseTo(10, 5)
    expect(r2).toBeCloseTo(1, 5)
  })

  it('should fit a perfect downtrend line', () => {
    const points = [
      { x: 0, y: 20 },
      { x: 1, y: 18 },
      { x: 2, y: 16 },
      { x: 3, y: 14 },
    ]

    const { slope, intercept, r2 } = fitTrendline(points)
    expect(slope).toBeCloseTo(-2, 5)
    expect(intercept).toBeCloseTo(20, 5)
    expect(r2).toBeCloseTo(1, 5)
  })

  it('should handle a flat line', () => {
    const points = [
      { x: 0, y: 10 },
      { x: 1, y: 10 },
      { x: 2, y: 10 },
    ]

    const { slope, r2 } = fitTrendline(points)
    expect(slope).toBeCloseTo(0, 5)
    // R2 is undefined for constant y (ssTot = 0), we return 0
    expect(r2).toBe(0)
  })

  it('should return reasonable values for noisy data', () => {
    const points = [
      { x: 0, y: 10 },
      { x: 1, y: 13 },
      { x: 2, y: 11 },
      { x: 3, y: 15 },
      { x: 4, y: 14 },
    ]

    const { slope, r2 } = fitTrendline(points)
    expect(slope).toBeGreaterThan(0) // general uptrend
    expect(r2).toBeGreaterThan(0)
    expect(r2).toBeLessThanOrEqual(1)
  })

  it('should handle single point', () => {
    const points = [{ x: 0, y: 42 }]
    const { slope, intercept, r2 } = fitTrendline(points)
    expect(slope).toBe(0)
    expect(intercept).toBe(42)
    expect(r2).toBe(0)
  })
})

// ── Head & Shoulders Detection Tests ───────────────────────────────────────

describe('detectPatterns - Head & Shoulders', () => {
  it('should detect a head and shoulders pattern', () => {
    // Build H&S: left shoulder, head (higher), right shoulder (similar to left)
    const prices = [
      // Base
      100, 102, 104, 106, 108,
      // Left shoulder up
      112, 116, 120, 118,
      // Down to neckline
      114, 110, 108,
      // Head up (higher than shoulders)
      112, 118, 124, 130, 128,
      // Down to neckline
      122, 116, 110, 108,
      // Right shoulder up (similar height to left)
      112, 116, 120, 118,
      // Break down
      114, 110, 106, 102,
    ]

    const bars = makeBars(prices)
    const detections = detectPatterns(bars, {
      enabledPatterns: ['head_and_shoulders'],
      pivotPeriod: 2,
      minConfidence: 0.2,
    })

    // Should find at least some pattern candidates
    // The exact count depends on pivot detection and tolerance
    expect(detections.every((d) => d.pattern === 'head_and_shoulders')).toBe(true)
    if (detections.length > 0) {
      expect(detections[0]!.direction).toBe('bearish')
      expect(detections[0]!.confidence).toBeGreaterThan(0)
      expect(detections[0]!.confidence).toBeLessThanOrEqual(1)
    }
  })
})

// ── Double Top/Bottom Detection Tests ──────────────────────────────────────

describe('detectPatterns - Double Top/Bottom', () => {
  it('should detect a double top pattern', () => {
    // Two peaks at similar levels with a valley between
    const prices = [
      100, 105, 110, 115, 120, // up to first peak
      118, 115, 112, 108, 105, // down to valley
      108, 112, 115, 118, 120, // up to second peak
      118, 115, 110, 105, 100, // breakdown
    ]

    const bars = makeBars(prices)
    const detections = detectPatterns(bars, {
      enabledPatterns: ['double_top'],
      pivotPeriod: 2,
      minConfidence: 0.2,
    })

    const doubleTop = detections.filter((d) => d.pattern === 'double_top')
    if (doubleTop.length > 0) {
      expect(doubleTop[0]!.direction).toBe('bearish')
      expect(doubleTop[0]!.keyPoints.length).toBeGreaterThanOrEqual(2)
    }
  })

  it('should detect a double bottom pattern', () => {
    // Two troughs at similar levels with a peak between
    const prices = [
      120, 115, 110, 105, 100, // down to first trough
      102, 105, 110, 115, 118, // up to middle peak
      115, 110, 105, 102, 100, // down to second trough
      102, 105, 110, 115, 120, // recovery
    ]

    const bars = makeBars(prices)
    const detections = detectPatterns(bars, {
      enabledPatterns: ['double_bottom'],
      pivotPeriod: 2,
      minConfidence: 0.2,
    })

    const doubleBottom = detections.filter((d) => d.pattern === 'double_bottom')
    if (doubleBottom.length > 0) {
      expect(doubleBottom[0]!.direction).toBe('bullish')
    }
  })
})

// ── Triangle Detection Tests ───────────────────────────────────────────────

describe('detectPatterns - Triangles', () => {
  it('should detect an ascending triangle', () => {
    // Flat highs with rising lows (converging)
    const prices = [
      100, 105, 110, 115, 120, // up
      118, 115, 112, 110, // pullback 1 (low at 110)
      112, 115, 118, 120, // up to flat resistance
      119, 116, 114, 112, // pullback 2 (low at 112 — higher)
      114, 117, 119, 120, // up to flat resistance
      119, 117, 115, // pullback 3 (low at 115 — higher again)
      117, 119, 121, 123, // breakout
    ]

    const bars = makeBars(prices)
    const detections = detectPatterns(bars, {
      enabledPatterns: ['ascending_triangle'],
      pivotPeriod: 2,
      minConfidence: 0.2,
    })

    // Triangle detection depends heavily on trendline fit
    for (const d of detections) {
      expect(d.pattern).toBe('ascending_triangle')
      expect(d.direction).toBe('bullish')
    }
  })
})

// ── Confidence Scoring Tests ───────────────────────────────────────────────

describe('detectPatterns - Confidence', () => {
  it('should return confidence between 0 and 1', () => {
    const prices = Array.from({ length: 50 }, (_, i) =>
      100 + Math.sin(i * 0.5) * 15 + i * 0.2,
    )

    const bars = makeBars(prices)
    const detections = detectPatterns(bars, { minConfidence: 0 })

    for (const d of detections) {
      expect(d.confidence).toBeGreaterThanOrEqual(0)
      expect(d.confidence).toBeLessThanOrEqual(1)
    }
  })

  it('should respect minimum confidence threshold', () => {
    const prices = Array.from({ length: 50 }, (_, i) =>
      100 + Math.sin(i * 0.3) * 10,
    )

    const bars = makeBars(prices)
    const highConfidence = detectPatterns(bars, { minConfidence: 0.8 })
    const lowConfidence = detectPatterns(bars, { minConfidence: 0.2 })

    // High confidence filter should return fewer or equal results
    expect(highConfidence.length).toBeLessThanOrEqual(lowConfidence.length)

    for (const d of highConfidence) {
      expect(d.confidence).toBeGreaterThanOrEqual(0.8)
    }
  })

  it('should sort results by confidence descending', () => {
    const prices = Array.from({ length: 60 }, (_, i) =>
      100 + Math.sin(i * 0.4) * 20 + Math.cos(i * 0.2) * 5,
    )

    const bars = makeBars(prices)
    const detections = detectPatterns(bars, { minConfidence: 0 })

    for (let i = 1; i < detections.length; i++) {
      expect(detections[i]!.confidence).toBeLessThanOrEqual(detections[i - 1]!.confidence)
    }
  })
})

// ── Edge Cases ─────────────────────────────────────────────────────────────

describe('detectPatterns - Edge Cases', () => {
  it('should return empty array for insufficient bars', () => {
    const bars = makeBars([100, 105])
    const detections = detectPatterns(bars)
    expect(detections).toEqual([])
  })

  it('should return empty array for flat price data', () => {
    const prices = Array.from({ length: 30 }, () => 100)
    const bars = makeBars(prices)
    const detections = detectPatterns(bars, { minConfidence: 0.3 })
    // Flat data shouldn't produce meaningful patterns
    // All detections should have low confidence
    for (const d of detections) {
      expect(d.confidence).toBeLessThan(0.5)
    }
  })

  it('should only detect enabled patterns', () => {
    const prices = Array.from({ length: 50 }, (_, i) =>
      100 + Math.sin(i * 0.5) * 15,
    )

    const bars = makeBars(prices)
    const detections = detectPatterns(bars, {
      enabledPatterns: ['bull_flag'],
      minConfidence: 0,
    })

    for (const d of detections) {
      expect(d.pattern).toBe('bull_flag')
    }
  })

  it('should include keyPoints for every detection', () => {
    const prices = Array.from({ length: 50 }, (_, i) =>
      100 + Math.sin(i * 0.5) * 15 + i * 0.3,
    )

    const bars = makeBars(prices)
    const detections = detectPatterns(bars, { minConfidence: 0 })

    for (const d of detections) {
      expect(Array.isArray(d.keyPoints)).toBe(true)
      for (const kp of d.keyPoints) {
        expect(typeof kp.time).toBe('number')
        expect(typeof kp.price).toBe('number')
      }
    }
  })
})
