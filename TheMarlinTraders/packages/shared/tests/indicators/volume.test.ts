import { describe, it, expect } from 'vitest'
import type { OHLCV } from '../../src/types/market-data.js'
import { obv, vwap, adLine } from '../../src/indicators/volume/index.js'

function makeFullOHLCV(bars: { o: number; h: number; l: number; c: number; v: number }[]): OHLCV[] {
  return bars.map((b, i) => ({
    open: b.o,
    high: b.h,
    low: b.l,
    close: b.c,
    volume: b.v,
    timestamp: (1609459200 + i * 86400) * 1000,
  }))
}

describe('OBV', () => {
  it('accumulates volume on up closes', () => {
    const data = makeFullOHLCV([
      { o: 10, h: 11, l: 9, c: 10, v: 100 },
      { o: 10, h: 12, l: 9, c: 11, v: 200 },
      { o: 11, h: 13, l: 10, c: 12, v: 300 },
    ])
    const result = obv(data, {}) as number[]
    expect(result[0]).toBe(100)
    expect(result[1]).toBe(300) // +200
    expect(result[2]).toBe(600) // +300
  })

  it('subtracts volume on down closes', () => {
    const data = makeFullOHLCV([
      { o: 12, h: 13, l: 11, c: 12, v: 100 },
      { o: 12, h: 13, l: 10, c: 11, v: 200 },
      { o: 11, h: 12, l: 9, c: 10, v: 300 },
    ])
    const result = obv(data, {}) as number[]
    expect(result[0]).toBe(100)
    expect(result[1]).toBe(-100) // -200
    expect(result[2]).toBe(-400) // -300
  })

  it('unchanged on equal closes', () => {
    const data = makeFullOHLCV([
      { o: 10, h: 11, l: 9, c: 10, v: 100 },
      { o: 10, h: 11, l: 9, c: 10, v: 200 },
    ])
    const result = obv(data, {}) as number[]
    expect(result[0]).toBe(100)
    expect(result[1]).toBe(100) // unchanged
  })

  it('handles empty data', () => {
    const result = obv([], {}) as number[]
    expect(result.length).toBe(0)
  })
})

describe('VWAP', () => {
  it('computes cumulative VWAP', () => {
    const data = makeFullOHLCV([
      { o: 10, h: 12, l: 9, c: 11, v: 1000 },
      { o: 11, h: 13, l: 10, c: 12, v: 2000 },
      { o: 12, h: 14, l: 11, c: 13, v: 1500 },
    ])
    const result = vwap(data, {}) as number[]
    expect(result.length).toBe(3)

    // First bar: TP = (12+9+11)/3 ≈ 10.667, VWAP = 10.667 * 1000 / 1000 = 10.667
    const tp1 = (12 + 9 + 11) / 3
    expect(result[0]).toBeCloseTo(tp1, 5)
  })

  it('handles zero volume', () => {
    const data = makeFullOHLCV([
      { o: 10, h: 12, l: 9, c: 11, v: 0 },
    ])
    const result = vwap(data, {}) as number[]
    expect(result[0]).toBeNaN()
  })
})

describe('A/D Line', () => {
  it('accumulates when close is near high', () => {
    const data = makeFullOHLCV([
      { o: 10, h: 12, l: 9, c: 12, v: 1000 },
      { o: 12, h: 14, l: 11, c: 14, v: 2000 },
    ])
    const result = adLine(data, {}) as number[]
    // First bar: MFM = ((12-9) - (12-12)) / (12-9) = 3/3 = 1, MFV = 1000
    expect(result[0]).toBeCloseTo(1000, 5)
    // Second bar: MFM = ((14-11) - (14-14)) / (14-11) = 3/3 = 1, MFV = 2000
    expect(result[1]).toBeCloseTo(3000, 5)
  })

  it('decreases when close is near low', () => {
    const data = makeFullOHLCV([
      { o: 10, h: 12, l: 9, c: 9, v: 1000 },
    ])
    const result = adLine(data, {}) as number[]
    // MFM = ((9-9) - (12-9)) / (12-9) = -3/3 = -1, MFV = -1000
    expect(result[0]).toBeCloseTo(-1000, 5)
  })

  it('handles zero range (high == low)', () => {
    const data = makeFullOHLCV([
      { o: 10, h: 10, l: 10, c: 10, v: 1000 },
    ])
    const result = adLine(data, {}) as number[]
    expect(result[0]).toBe(0)
  })
})
