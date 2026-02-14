import { describe, it, expect } from 'vitest'
import type { OHLCV } from '../../src/types/market-data.js'
import { rsi, stochastic, cci, williamsR, mfi } from '../../src/indicators/momentum/index.js'

function makeOHLCV(closes: number[], volume = 1000): OHLCV[] {
  return closes.map((c, i) => ({
    open: c - 0.5,
    high: c + 1,
    low: c - 1,
    close: c,
    volume,
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

describe('RSI', () => {
  it('returns values between 0 and 100', () => {
    const closes = Array.from({ length: 30 }, (_, i) => 100 + Math.sin(i / 3) * 10)
    const data = makeOHLCV(closes)
    const result = rsi(data, { period: 14 }) as number[]
    for (const v of result) {
      if (!isNaN(v)) {
        expect(v).toBeGreaterThanOrEqual(0)
        expect(v).toBeLessThanOrEqual(100)
      }
    }
  })

  it('returns 100 for a pure uptrend', () => {
    const closes = Array.from({ length: 20 }, (_, i) => 100 + i)
    const data = makeOHLCV(closes)
    const result = rsi(data, { period: 14 }) as number[]
    const lastValid = result.filter((v) => !isNaN(v))
    // In a pure uptrend with no losses, RSI should be 100
    expect(lastValid[lastValid.length - 1]).toBe(100)
  })

  it('returns 0 for a pure downtrend', () => {
    const closes = Array.from({ length: 20 }, (_, i) => 100 - i)
    const data = makeOHLCV(closes)
    const result = rsi(data, { period: 14 }) as number[]
    const lastValid = result.filter((v) => !isNaN(v))
    expect(lastValid[lastValid.length - 1]).toBe(0)
  })

  it('first period values are NaN', () => {
    const closes = Array.from({ length: 20 }, (_, i) => 100 + i)
    const data = makeOHLCV(closes)
    const result = rsi(data, { period: 14 }) as number[]
    for (let i = 0; i < 14; i++) {
      expect(result[i]).toBeNaN()
    }
    expect(result[14]).not.toBeNaN()
  })
})

describe('Stochastic', () => {
  it('returns k and d arrays', () => {
    const closes = Array.from({ length: 30 }, (_, i) => 100 + Math.sin(i / 3) * 10)
    const data = makeOHLCV(closes)
    const result = stochastic(data, { kPeriod: 14, dPeriod: 3, smooth: 3 })
    expect(result).toHaveProperty('k')
    expect(result).toHaveProperty('d')

    const r = result as { k: number[]; d: number[] }
    expect(r.k.length).toBe(30)
    expect(r.d.length).toBe(30)
  })

  it('k values are between 0 and 100', () => {
    const closes = Array.from({ length: 30 }, (_, i) => 100 + Math.sin(i / 3) * 10)
    const data = makeOHLCV(closes)
    const r = stochastic(data, { kPeriod: 14, dPeriod: 3, smooth: 3 }) as { k: number[]; d: number[] }
    for (const v of r.k) {
      if (!isNaN(v)) {
        expect(v).toBeGreaterThanOrEqual(0)
        expect(v).toBeLessThanOrEqual(100)
      }
    }
  })
})

describe('CCI', () => {
  it('returns values with correct length', () => {
    const closes = Array.from({ length: 30 }, (_, i) => 100 + i)
    const data = makeOHLCV(closes)
    const result = cci(data, { period: 20 }) as number[]
    expect(result.length).toBe(30)
    // First 19 should be NaN
    for (let i = 0; i < 19; i++) {
      expect(result[i]).toBeNaN()
    }
    expect(result[19]).not.toBeNaN()
  })

  it('CCI can be positive or negative', () => {
    const closes = Array.from({ length: 40 }, (_, i) => 100 + Math.sin(i / 4) * 20)
    const data = makeOHLCV(closes)
    const result = cci(data, { period: 20 }) as number[]
    const valid = result.filter((v) => !isNaN(v))
    const hasPositive = valid.some((v) => v > 0)
    const hasNegative = valid.some((v) => v < 0)
    expect(hasPositive || hasNegative).toBe(true)
  })
})

describe('Williams %R', () => {
  it('returns values between -100 and 0', () => {
    const closes = Array.from({ length: 30 }, (_, i) => 100 + Math.sin(i / 3) * 10)
    const data = makeOHLCV(closes)
    const result = williamsR(data, { period: 14 }) as number[]
    for (const v of result) {
      if (!isNaN(v)) {
        expect(v).toBeGreaterThanOrEqual(-100)
        expect(v).toBeLessThanOrEqual(0)
      }
    }
  })

  it('first period-1 values are NaN', () => {
    const closes = Array.from({ length: 20 }, (_, i) => 100 + i)
    const data = makeOHLCV(closes)
    const result = williamsR(data, { period: 14 }) as number[]
    for (let i = 0; i < 13; i++) {
      expect(result[i]).toBeNaN()
    }
    expect(result[13]).not.toBeNaN()
  })
})

describe('MFI', () => {
  it('returns values between 0 and 100', () => {
    const closes = Array.from({ length: 30 }, (_, i) => 100 + Math.sin(i / 3) * 10)
    const data = makeOHLCV(closes, 50000)
    const result = mfi(data, { period: 14 }) as number[]
    for (const v of result) {
      if (!isNaN(v)) {
        expect(v).toBeGreaterThanOrEqual(0)
        expect(v).toBeLessThanOrEqual(100)
      }
    }
  })

  it('returns 100 for pure uptrend with positive volume', () => {
    const bars = Array.from({ length: 20 }, (_, i) => ({
      o: 100 + i,
      h: 102 + i,
      l: 99 + i,
      c: 101 + i,
      v: 10000,
    }))
    const data = makeFullOHLCV(bars)
    const result = mfi(data, { period: 14 }) as number[]
    const lastValid = result.filter((v) => !isNaN(v))
    // All positive flow, so MFI should be 100
    expect(lastValid[lastValid.length - 1]).toBe(100)
  })
})
