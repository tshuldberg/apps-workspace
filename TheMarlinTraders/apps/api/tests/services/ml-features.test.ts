import { describe, it, expect } from 'vitest'
import {
  FeatureEngineer,
  smaRatio,
  emaSlope,
  rsiValue,
  macdHistogram,
  atrRatio,
  bbWidth,
  rvolValue,
  obvSlope,
  returnNBars,
  binaryDirection,
} from '../../src/services/ml-features.js'
import type { OHLCV, FeatureSet } from '@marlin/shared'

// ---------------------------------------------------------------------------
// Test data helpers
// ---------------------------------------------------------------------------

/**
 * Generate a synthetic OHLCV series with a mild uptrend and realistic spreads.
 */
function generateBars(count: number, startPrice: number = 100): OHLCV[] {
  const bars: OHLCV[] = []
  let price = startPrice
  const baseTimestamp = Date.now() - count * 60_000

  for (let i = 0; i < count; i++) {
    const change = (Math.sin(i / 5) * 0.02 + 0.001) * price
    price += change
    const high = price * (1 + Math.abs(Math.sin(i)) * 0.01)
    const low = price * (1 - Math.abs(Math.cos(i)) * 0.01)
    bars.push({
      open: price - change * 0.3,
      high,
      low,
      close: price,
      volume: 50_000 + Math.floor(Math.sin(i / 3) * 20_000 + 20_000),
      timestamp: baseTimestamp + i * 60_000,
    })
  }

  return bars
}

const BARS_50 = generateBars(50)
const BARS_100 = generateBars(100)
const BARS_200 = generateBars(200)

// ---------------------------------------------------------------------------
// SMA Ratio
// ---------------------------------------------------------------------------

describe('smaRatio', () => {
  it('returns array of same length as input', () => {
    const result = smaRatio(BARS_100, 20)
    expect(result.length).toBe(100)
  })

  it('produces values near 1.0 for a trending market', () => {
    const result = smaRatio(BARS_100, 20)
    // After warmup period, values should be finite and close to 1
    const validValues = result.slice(20).filter((v) => v !== 0)
    expect(validValues.length).toBeGreaterThan(0)
    for (const v of validValues) {
      expect(v).toBeGreaterThan(0.8)
      expect(v).toBeLessThan(1.2)
    }
  })

  it('returns all zeros for insufficient data', () => {
    const result = smaRatio(BARS_50.slice(0, 5), 20)
    expect(result.every((v) => v === 0)).toBe(true)
  })

  it('handles single bar input', () => {
    const result = smaRatio([BARS_50[0]!], 1)
    expect(result.length).toBe(1)
    expect(result[0]).toBeCloseTo(1.0, 5)
  })
})

// ---------------------------------------------------------------------------
// EMA Slope
// ---------------------------------------------------------------------------

describe('emaSlope', () => {
  it('returns array of same length as input', () => {
    const result = emaSlope(BARS_100, 12)
    expect(result.length).toBe(100)
  })

  it('produces finite numeric values after warmup', () => {
    const result = emaSlope(BARS_100, 12)
    const validValues = result.slice(20).filter((v) => v !== 0)
    expect(validValues.length).toBeGreaterThan(0)
    for (const v of validValues) {
      expect(Number.isFinite(v)).toBe(true)
    }
  })

  it('returns zeros for insufficient data', () => {
    const result = emaSlope(BARS_50.slice(0, 5), 12)
    expect(result.every((v) => v === 0)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// RSI Value
// ---------------------------------------------------------------------------

describe('rsiValue', () => {
  it('returns array of same length as input', () => {
    const result = rsiValue(BARS_100, 14)
    expect(result.length).toBe(100)
  })

  it('produces RSI values between 0 and 100', () => {
    const result = rsiValue(BARS_100, 14)
    for (const v of result) {
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(100)
    }
  })

  it('returns 50 (neutral) for insufficient data', () => {
    const result = rsiValue(BARS_50.slice(0, 5), 14)
    expect(result.every((v) => v === 50)).toBe(true)
  })

  it('produces higher RSI after sustained up moves', () => {
    // Create a consistently rising series
    const upBars: OHLCV[] = Array.from({ length: 30 }, (_, i) => ({
      open: 100 + i * 2,
      high: 100 + i * 2 + 1,
      low: 100 + i * 2 - 0.5,
      close: 100 + i * 2 + 1,
      volume: 100_000,
      timestamp: Date.now() + i * 60_000,
    }))
    const result = rsiValue(upBars, 14)
    // After warmup, RSI should be high (above 60)
    const lastRsi = result[result.length - 1]!
    expect(lastRsi).toBeGreaterThan(60)
  })
})

// ---------------------------------------------------------------------------
// MACD Histogram
// ---------------------------------------------------------------------------

describe('macdHistogram', () => {
  it('returns array of same length as input', () => {
    const result = macdHistogram(BARS_100)
    expect(result.length).toBe(100)
  })

  it('produces finite numeric values after warmup', () => {
    const result = macdHistogram(BARS_100)
    // Needs 26 + 9 = 35 bars for warmup
    const validValues = result.slice(35).filter((v) => v !== 0)
    expect(validValues.length).toBeGreaterThan(0)
    for (const v of validValues) {
      expect(Number.isFinite(v)).toBe(true)
    }
  })

  it('returns zeros for insufficient data', () => {
    const result = macdHistogram(BARS_50.slice(0, 10))
    expect(result.every((v) => v === 0)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// ATR Ratio
// ---------------------------------------------------------------------------

describe('atrRatio', () => {
  it('returns array of same length as input', () => {
    const result = atrRatio(BARS_100, 14)
    expect(result.length).toBe(100)
  })

  it('produces small positive values (volatility normalized by price)', () => {
    const result = atrRatio(BARS_100, 14)
    const validValues = result.slice(15).filter((v) => v !== 0)
    expect(validValues.length).toBeGreaterThan(0)
    for (const v of validValues) {
      expect(v).toBeGreaterThan(0)
      expect(v).toBeLessThan(0.5) // ATR/price should be small
    }
  })
})

// ---------------------------------------------------------------------------
// Bollinger Band Width
// ---------------------------------------------------------------------------

describe('bbWidth', () => {
  it('returns array of same length as input', () => {
    const result = bbWidth(BARS_100, 20)
    expect(result.length).toBe(100)
  })

  it('produces positive values after warmup', () => {
    const result = bbWidth(BARS_100, 20)
    const validValues = result.slice(20).filter((v) => v !== 0)
    expect(validValues.length).toBeGreaterThan(0)
    for (const v of validValues) {
      expect(v).toBeGreaterThan(0)
      expect(Number.isFinite(v)).toBe(true)
    }
  })
})

// ---------------------------------------------------------------------------
// Relative Volume
// ---------------------------------------------------------------------------

describe('rvolValue', () => {
  it('returns array of same length as input', () => {
    const result = rvolValue(BARS_100, 20)
    expect(result.length).toBe(100)
  })

  it('produces values centered around 1.0', () => {
    const result = rvolValue(BARS_100, 20)
    const validValues = result.slice(20).filter((v) => v !== 1)
    expect(validValues.length).toBeGreaterThan(0)
    // Average relative volume should be near 1
    const avg = validValues.reduce((s, v) => s + v, 0) / validValues.length
    expect(avg).toBeGreaterThan(0.3)
    expect(avg).toBeLessThan(3.0)
  })
})

// ---------------------------------------------------------------------------
// OBV Slope
// ---------------------------------------------------------------------------

describe('obvSlope', () => {
  it('returns array of same length as input', () => {
    const result = obvSlope(BARS_100, 14)
    expect(result.length).toBe(100)
  })

  it('produces finite numeric values', () => {
    const result = obvSlope(BARS_100, 14)
    for (const v of result) {
      expect(Number.isFinite(v)).toBe(true)
    }
  })
})

// ---------------------------------------------------------------------------
// Return N Bars
// ---------------------------------------------------------------------------

describe('returnNBars', () => {
  it('computes percentage returns', () => {
    const bars: OHLCV[] = [
      { open: 100, high: 101, low: 99, close: 100, volume: 1000, timestamp: 0 },
      { open: 100, high: 101, low: 99, close: 105, volume: 1000, timestamp: 1 },
      { open: 105, high: 106, low: 104, close: 110, volume: 1000, timestamp: 2 },
    ]
    const result = returnNBars(bars, 1)
    expect(result[0]).toBe(0) // no lookback for first bar
    expect(result[1]).toBeCloseTo(0.05, 6) // (105 - 100) / 100
    expect(result[2]).toBeCloseTo(110 / 105 - 1, 6)
  })

  it('returns zeros for short data', () => {
    const result = returnNBars([BARS_50[0]!], 5)
    expect(result.every((v) => v === 0)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Binary Direction
// ---------------------------------------------------------------------------

describe('binaryDirection', () => {
  it('returns 1 when price is higher N bars later', () => {
    const bars: OHLCV[] = [
      { open: 100, high: 101, low: 99, close: 100, volume: 1000, timestamp: 0 },
      { open: 100, high: 101, low: 99, close: 102, volume: 1000, timestamp: 1 },
      { open: 102, high: 103, low: 101, close: 105, volume: 1000, timestamp: 2 },
    ]
    const result = binaryDirection(bars, 1)
    expect(result[0]).toBe(1) // 102 > 100
    expect(result[1]).toBe(1) // 105 > 102
    expect(result[2]).toBe(0) // no future bar, defaults to 0
  })

  it('returns 0 when price is lower N bars later', () => {
    const bars: OHLCV[] = [
      { open: 105, high: 106, low: 104, close: 105, volume: 1000, timestamp: 0 },
      { open: 105, high: 106, low: 103, close: 100, volume: 1000, timestamp: 1 },
      { open: 100, high: 101, low: 98, close: 98, volume: 1000, timestamp: 2 },
    ]
    const result = binaryDirection(bars, 1)
    expect(result[0]).toBe(0) // 100 < 105
    expect(result[1]).toBe(0) // 98 < 100
  })
})

// ---------------------------------------------------------------------------
// Feature Extraction (matrix shape)
// ---------------------------------------------------------------------------

describe('FeatureEngineer.extractFeatures', () => {
  const engineer = new FeatureEngineer()

  const testFeatureSet: FeatureSet = {
    name: 'Test Features',
    description: 'Test feature set',
    features: [
      { name: 'smaRatio_20', type: 'indicator', params: { period: 20 }, normalization: 'none' },
      { name: 'rsi_14', type: 'indicator', params: { period: 14 }, normalization: 'none' },
      { name: 'atrRatio_14', type: 'indicator', params: { period: 14 }, normalization: 'none' },
    ],
  }

  it('produces a matrix with correct number of columns', () => {
    const result = engineer.extractFeatures(BARS_100, testFeatureSet)
    expect(result.names.length).toBe(3)
    expect(result.names).toEqual(['smaRatio_20', 'rsi_14', 'atrRatio_14'])
  })

  it('produces a matrix with correct number of rows', () => {
    const result = engineer.extractFeatures(BARS_100, testFeatureSet)
    expect(result.data.length).toBe(100) // same as input length
    // Each row should have 3 columns
    for (const row of result.data) {
      expect(row.length).toBe(3)
    }
  })

  it('produces all finite values', () => {
    const result = engineer.extractFeatures(BARS_200, testFeatureSet)
    for (const row of result.data) {
      for (const val of row) {
        expect(Number.isFinite(val)).toBe(true)
      }
    }
  })

  it('handles empty bars gracefully', () => {
    const result = engineer.extractFeatures([], testFeatureSet)
    expect(result.names.length).toBe(3)
    expect(result.data.length).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// Z-score Normalization
// ---------------------------------------------------------------------------

describe('FeatureEngineer.normalizeFeatures (zscore)', () => {
  const engineer = new FeatureEngineer()

  it('produces mean approximately 0 and std approximately 1', () => {
    const featureSet: FeatureSet = {
      name: 'Test',
      description: '',
      features: [
        { name: 'smaRatio_20', type: 'indicator', params: { period: 20 }, normalization: 'none' },
        { name: 'rsi_14', type: 'indicator', params: { period: 14 }, normalization: 'none' },
      ],
    }

    const matrix = engineer.extractFeatures(BARS_200, featureSet)
    const normalized = engineer.normalizeFeatures(matrix, 'zscore')

    // Check each column
    for (let col = 0; col < normalized.names.length; col++) {
      const colValues = normalized.data.map((row) => row[col]!)
      const mean = colValues.reduce((s, v) => s + v, 0) / colValues.length
      const variance = colValues.reduce((s, v) => s + (v - mean) ** 2, 0) / (colValues.length - 1)
      const std = Math.sqrt(variance)

      expect(mean).toBeCloseTo(0, 1) // mean near 0
      expect(std).toBeCloseTo(1, 1)  // std near 1
    }
  })

  it('handles constant values without NaN', () => {
    const matrix = {
      names: ['constant'],
      data: [[5], [5], [5], [5], [5]],
    }
    const normalized = engineer.normalizeFeatures(matrix, 'zscore')
    // Constant column should become all zeros
    for (const row of normalized.data) {
      expect(row[0]).toBe(0)
      expect(Number.isFinite(row[0]!)).toBe(true)
    }
  })

  it('returns unchanged matrix for method "none"', () => {
    const matrix = {
      names: ['a'],
      data: [[1], [2], [3]],
    }
    const result = engineer.normalizeFeatures(matrix, 'none')
    expect(result.data).toEqual(matrix.data)
  })
})

// ---------------------------------------------------------------------------
// Min-Max Normalization
// ---------------------------------------------------------------------------

describe('FeatureEngineer.normalizeFeatures (minmax)', () => {
  const engineer = new FeatureEngineer()

  it('scales values to [0, 1] range', () => {
    const matrix = {
      names: ['feature1'],
      data: [[10], [20], [30], [40], [50]],
    }
    const normalized = engineer.normalizeFeatures(matrix, 'minmax')

    expect(normalized.data[0]![0]).toBeCloseTo(0, 6)   // min -> 0
    expect(normalized.data[4]![0]).toBeCloseTo(1, 6)   // max -> 1
    expect(normalized.data[2]![0]).toBeCloseTo(0.5, 6) // mid -> 0.5
  })

  it('handles constant values without NaN', () => {
    const matrix = {
      names: ['constant'],
      data: [[7], [7], [7]],
    }
    const normalized = engineer.normalizeFeatures(matrix, 'minmax')
    for (const row of normalized.data) {
      expect(row[0]).toBe(0)
      expect(Number.isFinite(row[0]!)).toBe(true)
    }
  })
})

// ---------------------------------------------------------------------------
// Train/Test Split
// ---------------------------------------------------------------------------

describe('FeatureEngineer.splitTrainTest', () => {
  const engineer = new FeatureEngineer()

  it('respects the train/test ratio', () => {
    const features = Array.from({ length: 100 }, (_, i) => [i, i * 2])
    const targets = Array.from({ length: 100 }, (_, i) => i % 2)

    const split = engineer.splitTrainTest(features, targets, 0.8)

    expect(split.train.features.length).toBe(80)
    expect(split.train.targets.length).toBe(80)
    expect(split.test.features.length).toBe(20)
    expect(split.test.targets.length).toBe(20)
  })

  it('total samples equal original count', () => {
    const features = Array.from({ length: 50 }, (_, i) => [i])
    const targets = Array.from({ length: 50 }, (_, i) => i)

    const split = engineer.splitTrainTest(features, targets, 0.7)
    const total = split.train.features.length + split.test.features.length
    expect(total).toBe(50)
  })

  it('handles empty data', () => {
    const split = engineer.splitTrainTest([], [], 0.8)
    expect(split.train.features.length).toBe(0)
    expect(split.test.features.length).toBe(0)
  })

  it('shuffles the data (not sequential split)', () => {
    const features = Array.from({ length: 20 }, (_, i) => [i])
    const targets = Array.from({ length: 20 }, (_, i) => i)

    const split = engineer.splitTrainTest(features, targets, 0.8)

    // The training set should not be strictly ordered if shuffled
    const trainValues = split.train.features.map((f) => f[0]!)
    const isSorted = trainValues.every((v, i) => i === 0 || v! >= trainValues[i - 1]!)
    // Very unlikely to be sorted after shuffle (probability ~1/20!)
    expect(isSorted).toBe(false)
  })

  it('handles mismatched lengths', () => {
    const features = Array.from({ length: 10 }, (_, i) => [i])
    const targets = Array.from({ length: 5 }, (_, i) => i)

    // Should not crash
    const split = engineer.splitTrainTest(features, targets, 0.8)
    expect(split.train.features.length).toBe(0)
    expect(split.test.features.length).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// All extractors produce numeric values
// ---------------------------------------------------------------------------

describe('All extractors produce numeric values on real-ish data', () => {
  const extractors = [
    { name: 'smaRatio', fn: () => smaRatio(BARS_200, 20) },
    { name: 'emaSlope', fn: () => emaSlope(BARS_200, 12) },
    { name: 'rsiValue', fn: () => rsiValue(BARS_200, 14) },
    { name: 'macdHistogram', fn: () => macdHistogram(BARS_200) },
    { name: 'atrRatio', fn: () => atrRatio(BARS_200, 14) },
    { name: 'bbWidth', fn: () => bbWidth(BARS_200, 20) },
    { name: 'rvolValue', fn: () => rvolValue(BARS_200, 20) },
    { name: 'obvSlope', fn: () => obvSlope(BARS_200, 14) },
    { name: 'returnNBars', fn: () => returnNBars(BARS_200, 5) },
    { name: 'binaryDirection', fn: () => binaryDirection(BARS_200, 5) },
  ]

  for (const { name, fn } of extractors) {
    it(`${name} produces only finite numbers`, () => {
      const result = fn()
      expect(result.length).toBe(200)
      for (const v of result) {
        expect(Number.isFinite(v)).toBe(true)
      }
    })
  }
})
