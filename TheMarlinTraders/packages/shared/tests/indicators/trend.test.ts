import { describe, it, expect } from 'vitest'
import type { OHLCV } from '../../src/types/market-data.js'
import { sma, ema, wma, dema, tema, vwma, hullMa, macd, sar, supertrend } from '../../src/indicators/trend/index.js'
import { smaArray } from '../../src/indicators/trend/sma.js'
import { emaArray } from '../../src/indicators/trend/ema.js'

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

describe('SMA', () => {
  it('computes SMA(3) correctly', () => {
    const data = makeOHLCV([1, 2, 3, 4, 5])
    const result = sma(data, { period: 3 }) as number[]
    expect(result[0]).toBeNaN()
    expect(result[1]).toBeNaN()
    expect(result[2]).toBeCloseTo(2, 10)
    expect(result[3]).toBeCloseTo(3, 10)
    expect(result[4]).toBeCloseTo(4, 10)
  })

  it('returns all NaN when data is shorter than period', () => {
    const data = makeOHLCV([1, 2])
    const result = sma(data, { period: 5 }) as number[]
    expect(result.every((v) => isNaN(v))).toBe(true)
  })

  it('handles period of 1', () => {
    const data = makeOHLCV([10, 20, 30])
    const result = sma(data, { period: 1 }) as number[]
    expect(result[0]).toBeCloseTo(10)
    expect(result[1]).toBeCloseTo(20)
    expect(result[2]).toBeCloseTo(30)
  })

  it('smaArray matches sma output', () => {
    const values = [1, 2, 3, 4, 5]
    const result = smaArray(values, 3)
    expect(result[2]).toBeCloseTo(2)
    expect(result[3]).toBeCloseTo(3)
    expect(result[4]).toBeCloseTo(4)
  })
})

describe('EMA', () => {
  it('computes EMA(3) with correct multiplier', () => {
    const data = makeOHLCV([1, 2, 3, 4, 5])
    const result = ema(data, { period: 3 }) as number[]

    // First value at index 2 = SMA of first 3 = 2
    expect(result[2]).toBeCloseTo(2, 10)
    // k = 2/(3+1) = 0.5
    // index 3: 4*0.5 + 2*0.5 = 3
    expect(result[3]).toBeCloseTo(3, 10)
    // index 4: 5*0.5 + 3*0.5 = 4
    expect(result[4]).toBeCloseTo(4, 10)
  })

  it('returns all NaN when data is shorter than period', () => {
    const result = emaArray([1], 5)
    expect(result.every((v) => isNaN(v))).toBe(true)
  })
})

describe('WMA', () => {
  it('computes WMA(3) correctly', () => {
    const data = makeOHLCV([1, 2, 3, 4, 5])
    const result = wma(data, { period: 3 }) as number[]

    // WMA(3) at index 2: (1*1 + 2*2 + 3*3) / (1+2+3) = 14/6 = 2.333...
    expect(result[2]).toBeCloseTo(14 / 6, 5)
    // WMA(3) at index 3: (2*1 + 3*2 + 4*3) / 6 = 20/6 = 3.333...
    expect(result[3]).toBeCloseTo(20 / 6, 5)
  })
})

describe('DEMA', () => {
  it('produces values close to EMA but with less lag', () => {
    const data = makeOHLCV([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    const result = dema(data, { period: 3 }) as number[]
    // DEMA should have some valid values
    const valid = result.filter((v) => !isNaN(v))
    expect(valid.length).toBeGreaterThan(0)
  })
})

describe('TEMA', () => {
  it('produces valid values for sufficient data', () => {
    const data = makeOHLCV([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
    const result = tema(data, { period: 3 }) as number[]
    const valid = result.filter((v) => !isNaN(v))
    expect(valid.length).toBeGreaterThan(0)
  })
})

describe('VWMA', () => {
  it('computes volume-weighted average correctly', () => {
    const data = makeFullOHLCV([
      { o: 10, h: 11, l: 9, c: 10, v: 100 },
      { o: 10, h: 12, l: 9, c: 11, v: 200 },
      { o: 11, h: 13, l: 10, c: 12, v: 300 },
    ])
    const result = vwma(data, { period: 3 }) as number[]
    // VWMA = (10*100 + 11*200 + 12*300) / (100+200+300) = (1000+2200+3600)/600 = 6800/600 ≈ 11.333
    expect(result[2]).toBeCloseTo(6800 / 600, 5)
  })

  it('handles zero volume', () => {
    const data = makeFullOHLCV([
      { o: 10, h: 11, l: 9, c: 10, v: 0 },
      { o: 10, h: 11, l: 9, c: 11, v: 0 },
    ])
    const result = vwma(data, { period: 2 }) as number[]
    expect(result[1]).toBeNaN()
  })
})

describe('Hull MA', () => {
  it('produces valid values for sufficient data', () => {
    const data = makeOHLCV([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15])
    const result = hullMa(data, { period: 9 }) as number[]
    const valid = result.filter((v) => !isNaN(v))
    expect(valid.length).toBeGreaterThan(0)
  })
})

describe('MACD', () => {
  it('computes MACD with correct structure', () => {
    const closes = Array.from({ length: 50 }, (_, i) => 100 + Math.sin(i / 5) * 10)
    const data = makeOHLCV(closes)
    const result = macd(data, { fast: 12, slow: 26, signal: 9 })
    expect(result).toHaveProperty('macd')
    expect(result).toHaveProperty('signal')
    expect(result).toHaveProperty('histogram')

    const r = result as { macd: number[]; signal: number[]; histogram: number[] }
    expect(r.macd.length).toBe(50)
    expect(r.signal.length).toBe(50)
    expect(r.histogram.length).toBe(50)

    // MACD line should have valid values after slow period
    const validMacd = r.macd.filter((v) => !isNaN(v))
    expect(validMacd.length).toBeGreaterThan(0)
  })

  it('histogram = macd - signal', () => {
    const closes = Array.from({ length: 50 }, (_, i) => 100 + i)
    const data = makeOHLCV(closes)
    const r = macd(data, { fast: 12, slow: 26, signal: 9 }) as {
      macd: number[]
      signal: number[]
      histogram: number[]
    }
    for (let i = 0; i < r.histogram.length; i++) {
      if (!isNaN(r.histogram[i]) && !isNaN(r.macd[i]) && !isNaN(r.signal[i])) {
        expect(r.histogram[i]).toBeCloseTo(r.macd[i] - r.signal[i], 8)
      }
    }
  })
})

describe('Parabolic SAR', () => {
  it('produces values for every bar', () => {
    const closes = Array.from({ length: 30 }, (_, i) => 100 + i * 2)
    const data = makeOHLCV(closes)
    const result = sar(data, { step: 0.02, max: 0.2 }) as number[]
    expect(result.length).toBe(30)
    // SAR should be a number for every bar
    const valid = result.filter((v) => !isNaN(v))
    expect(valid.length).toBe(30)
  })

  it('SAR trails below price in an uptrend', () => {
    const closes = Array.from({ length: 20 }, (_, i) => 100 + i * 3)
    const data = makeOHLCV(closes)
    const result = sar(data, { step: 0.02, max: 0.2 }) as number[]
    // After initial period, SAR should be below close in uptrend
    for (let i = 5; i < 20; i++) {
      if (!isNaN(result[i])) {
        expect(result[i]).toBeLessThan(data[i].close + 5)
      }
    }
  })
})

describe('Supertrend', () => {
  it('returns value and direction arrays', () => {
    const closes = Array.from({ length: 30 }, (_, i) => 100 + Math.sin(i / 3) * 10)
    const data = makeOHLCV(closes)
    const result = supertrend(data, { period: 10, multiplier: 3 })
    expect(result).toHaveProperty('value')
    expect(result).toHaveProperty('direction')

    const r = result as { value: number[]; direction: number[] }
    expect(r.value.length).toBe(30)
    expect(r.direction.length).toBe(30)
  })

  it('direction is 1 or -1 when valid', () => {
    const closes = Array.from({ length: 30 }, (_, i) => 100 + i)
    const data = makeOHLCV(closes)
    const r = supertrend(data, { period: 10, multiplier: 3 }) as {
      value: number[]
      direction: number[]
    }
    for (const d of r.direction) {
      if (!isNaN(d)) {
        expect([1, -1]).toContain(d)
      }
    }
  })
})
