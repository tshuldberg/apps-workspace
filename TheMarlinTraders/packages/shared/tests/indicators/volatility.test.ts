import { describe, it, expect } from 'vitest'
import type { OHLCV } from '../../src/types/market-data.js'
import { bollinger, atr, keltner, donchian } from '../../src/indicators/volatility/index.js'

function makeOHLCV(closes: number[]): OHLCV[] {
  return closes.map((c, i) => ({
    open: c - 0.5,
    high: c + 1,
    low: c - 1,
    close: c,
    volume: 1000,
    timestamp: (1609459200 + i * 86400) * 1000,
  }))
}

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

describe('Bollinger Bands', () => {
  it('upper > middle > lower', () => {
    const closes = Array.from({ length: 25 }, (_, i) => 100 + Math.sin(i / 3) * 10)
    const data = makeOHLCV(closes)
    const result = bollinger(data, { period: 20, stdDev: 2 })
    const r = result as { upper: number[]; middle: number[]; lower: number[] }

    for (let i = 19; i < 25; i++) {
      expect(r.upper[i]).toBeGreaterThan(r.middle[i])
      expect(r.middle[i]).toBeGreaterThan(r.lower[i])
    }
  })

  it('middle band equals SMA', () => {
    const closes = [1, 2, 3, 4, 5]
    const data = makeOHLCV(closes)
    const result = bollinger(data, { period: 3, stdDev: 2 })
    const r = result as { upper: number[]; middle: number[]; lower: number[] }
    // Middle at index 2 = SMA(3) = (1+2+3)/3 = 2
    expect(r.middle[2]).toBeCloseTo(2, 10)
    expect(r.middle[3]).toBeCloseTo(3, 10)
  })

  it('bands are symmetric around middle', () => {
    const closes = Array.from({ length: 25 }, (_, i) => 100 + i)
    const data = makeOHLCV(closes)
    const result = bollinger(data, { period: 20, stdDev: 2 })
    const r = result as { upper: number[]; middle: number[]; lower: number[] }

    for (let i = 19; i < 25; i++) {
      const upperDist = r.upper[i] - r.middle[i]
      const lowerDist = r.middle[i] - r.lower[i]
      expect(upperDist).toBeCloseTo(lowerDist, 8)
    }
  })

  it('returns NaN when data < period', () => {
    const data = makeOHLCV([1, 2, 3])
    const result = bollinger(data, { period: 20, stdDev: 2 })
    const r = result as { upper: number[]; middle: number[]; lower: number[] }
    expect(r.upper.every((v) => isNaN(v))).toBe(true)
  })
})

describe('ATR', () => {
  it('computes ATR with correct length', () => {
    const closes = Array.from({ length: 20 }, (_, i) => 100 + i)
    const data = makeOHLCV(closes)
    const result = atr(data, { period: 14 }) as number[]
    expect(result.length).toBe(20)
    // First 13 should be NaN
    for (let i = 0; i < 13; i++) {
      expect(result[i]).toBeNaN()
    }
    expect(result[13]).not.toBeNaN()
  })

  it('ATR is always positive', () => {
    const closes = Array.from({ length: 30 }, (_, i) => 100 + Math.sin(i / 3) * 10)
    const data = makeOHLCV(closes)
    const result = atr(data, { period: 14 }) as number[]
    for (const v of result) {
      if (!isNaN(v)) {
        expect(v).toBeGreaterThan(0)
      }
    }
  })

  it('uses true range with gaps', () => {
    const data = makeFullOHLCV([
      { o: 100, h: 105, l: 95, c: 102, v: 1000 },
      { o: 108, h: 110, l: 106, c: 109, v: 1000 }, // gap up
    ])
    const result = atr(data, { period: 1 }) as number[]
    // TR for bar 1 = max(110-106, |110-102|, |106-102|) = max(4, 8, 4) = 8
    expect(result[1]).toBeCloseTo(8, 5)
  })
})

describe('Keltner Channels', () => {
  it('upper > middle > lower', () => {
    const closes = Array.from({ length: 30 }, (_, i) => 100 + Math.sin(i / 3) * 10)
    const data = makeOHLCV(closes)
    const result = keltner(data, { period: 20, multiplier: 1.5, atrPeriod: 10 })
    const r = result as { upper: number[]; middle: number[]; lower: number[] }

    const valid = r.upper.map((v, i) => ({
      upper: v,
      middle: r.middle[i],
      lower: r.lower[i],
    })).filter((v) => !isNaN(v.upper))

    expect(valid.length).toBeGreaterThan(0)
    for (const v of valid) {
      expect(v.upper).toBeGreaterThan(v.middle)
      expect(v.middle).toBeGreaterThan(v.lower)
    }
  })
})

describe('Donchian Channels', () => {
  it('upper is highest high, lower is lowest low', () => {
    const data = makeFullOHLCV([
      { o: 10, h: 15, l: 8, c: 12, v: 1000 },
      { o: 12, h: 18, l: 10, c: 16, v: 1000 },
      { o: 16, h: 20, l: 12, c: 14, v: 1000 },
    ])
    const result = donchian(data, { period: 3 })
    const r = result as { upper: number[]; middle: number[]; lower: number[] }

    expect(r.upper[2]).toBe(20) // max(15, 18, 20)
    expect(r.lower[2]).toBe(8)  // min(8, 10, 12)
    expect(r.middle[2]).toBeCloseTo((20 + 8) / 2, 10)
  })

  it('returns NaN when data < period', () => {
    const data = makeOHLCV([1, 2])
    const result = donchian(data, { period: 20 })
    const r = result as { upper: number[]; middle: number[]; lower: number[] }
    expect(r.upper.every((v) => isNaN(v))).toBe(true)
  })
})
