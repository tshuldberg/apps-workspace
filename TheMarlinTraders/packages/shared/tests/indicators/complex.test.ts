import { describe, it, expect } from 'vitest'
import type { OHLCV } from '../../src/types/market-data.js'
import { ichimoku, adx, aroon } from '../../src/indicators/complex/index.js'
import { computeIndicator, getIndicatorMeta, getIndicatorNames, getAllIndicatorMetas } from '../../src/indicators/compute.js'

function makeOHLCV(closes: number[]): OHLCV[] {
  return closes.map((c, i) => ({
    open: c - 0.5,
    high: c + 2,
    low: c - 2,
    close: c,
    volume: 1000,
    timestamp: (1609459200 + i * 86400) * 1000,
  }))
}

describe('Ichimoku Cloud', () => {
  it('returns all five components', () => {
    const closes = Array.from({ length: 80 }, (_, i) => 100 + Math.sin(i / 5) * 20)
    const data = makeOHLCV(closes)
    const result = ichimoku(data, { tenkan: 9, kijun: 26, senkou: 52 })
    expect(result).toHaveProperty('tenkan')
    expect(result).toHaveProperty('kijun')
    expect(result).toHaveProperty('senkouA')
    expect(result).toHaveProperty('senkouB')
    expect(result).toHaveProperty('chikou')

    const r = result as {
      tenkan: number[]
      kijun: number[]
      senkouA: number[]
      senkouB: number[]
      chikou: number[]
    }
    expect(r.tenkan.length).toBe(80)
    expect(r.kijun.length).toBe(80)
  })

  it('tenkan has valid values from period-1', () => {
    const closes = Array.from({ length: 30 }, (_, i) => 100 + i)
    const data = makeOHLCV(closes)
    const r = ichimoku(data, { tenkan: 9, kijun: 26, senkou: 52 }) as {
      tenkan: number[]
      kijun: number[]
      senkouA: number[]
      senkouB: number[]
      chikou: number[]
    }
    for (let i = 0; i < 8; i++) {
      expect(r.tenkan[i]).toBeNaN()
    }
    expect(r.tenkan[8]).not.toBeNaN()
  })

  it('tenkan is midpoint of high/low range', () => {
    const data = makeOHLCV([10, 12, 14, 11, 13])
    // Period 3 tenkan: for index 2, high range [12,16,16], low range [8,10,12]
    // highest high = 16, lowest low = 8, midpoint = 12
    const r = ichimoku(data, { tenkan: 3, kijun: 3, senkou: 3 }) as {
      tenkan: number[]
      kijun: number[]
      senkouA: number[]
      senkouB: number[]
      chikou: number[]
    }
    // At index 2: high=[12,14,16], low=[8,10,12] -> highest=16, lowest=8, mid=12
    expect(r.tenkan[2]).toBeCloseTo(12, 5)
  })
})

describe('ADX', () => {
  it('returns adx, diPlus, diMinus arrays', () => {
    const closes = Array.from({ length: 40 }, (_, i) => 100 + Math.sin(i / 3) * 10)
    const data = makeOHLCV(closes)
    const result = adx(data, { period: 14 })
    expect(result).toHaveProperty('adx')
    expect(result).toHaveProperty('diPlus')
    expect(result).toHaveProperty('diMinus')

    const r = result as { adx: number[]; diPlus: number[]; diMinus: number[] }
    expect(r.adx.length).toBe(40)
    expect(r.diPlus.length).toBe(40)
    expect(r.diMinus.length).toBe(40)
  })

  it('ADX values are between 0 and 100', () => {
    const closes = Array.from({ length: 50 }, (_, i) => 100 + Math.sin(i / 5) * 20)
    const data = makeOHLCV(closes)
    const r = adx(data, { period: 14 }) as { adx: number[]; diPlus: number[]; diMinus: number[] }
    for (const v of r.adx) {
      if (!isNaN(v)) {
        expect(v).toBeGreaterThanOrEqual(0)
        expect(v).toBeLessThanOrEqual(100)
      }
    }
  })

  it('DI+ and DI- are non-negative', () => {
    const closes = Array.from({ length: 50 }, (_, i) => 100 + Math.sin(i / 5) * 20)
    const data = makeOHLCV(closes)
    const r = adx(data, { period: 14 }) as { adx: number[]; diPlus: number[]; diMinus: number[] }
    for (const v of r.diPlus) {
      if (!isNaN(v)) expect(v).toBeGreaterThanOrEqual(0)
    }
    for (const v of r.diMinus) {
      if (!isNaN(v)) expect(v).toBeGreaterThanOrEqual(0)
    }
  })
})

describe('Aroon', () => {
  it('returns up and down arrays', () => {
    const closes = Array.from({ length: 30 }, (_, i) => 100 + Math.sin(i / 3) * 10)
    const data = makeOHLCV(closes)
    const result = aroon(data, { period: 25 })
    expect(result).toHaveProperty('up')
    expect(result).toHaveProperty('down')

    const r = result as { up: number[]; down: number[] }
    expect(r.up.length).toBe(30)
    expect(r.down.length).toBe(30)
  })

  it('values are between 0 and 100', () => {
    const closes = Array.from({ length: 50 }, (_, i) => 100 + Math.sin(i / 3) * 10)
    const data = makeOHLCV(closes)
    const r = aroon(data, { period: 25 }) as { up: number[]; down: number[] }
    for (const v of r.up) {
      if (!isNaN(v)) {
        expect(v).toBeGreaterThanOrEqual(0)
        expect(v).toBeLessThanOrEqual(100)
      }
    }
    for (const v of r.down) {
      if (!isNaN(v)) {
        expect(v).toBeGreaterThanOrEqual(0)
        expect(v).toBeLessThanOrEqual(100)
      }
    }
  })

  it('Aroon Up is 100 when highest high is at current bar', () => {
    // Uptrend: each bar has higher high
    const closes = Array.from({ length: 30 }, (_, i) => 100 + i)
    const data = makeOHLCV(closes)
    const r = aroon(data, { period: 5 }) as { up: number[]; down: number[] }
    // At each valid index, current bar has the highest high
    for (let i = 5; i < 30; i++) {
      expect(r.up[i]).toBe(100)
    }
  })
})

describe('Compute Registry', () => {
  it('has 25 registered indicators', () => {
    const names = getIndicatorNames()
    expect(names.length).toBe(25)
  })

  it('computeIndicator dispatches correctly', () => {
    const data = makeOHLCV([1, 2, 3, 4, 5])
    const result = computeIndicator('sma', data, { period: 3 }) as number[]
    expect(result[2]).toBeCloseTo(2)
    expect(result[3]).toBeCloseTo(3)
    expect(result[4]).toBeCloseTo(4)
  })

  it('throws for unknown indicator', () => {
    expect(() => computeIndicator('nonexistent', [], {})).toThrow('Unknown indicator: nonexistent')
    expect(() => getIndicatorMeta('nonexistent')).toThrow('Unknown indicator: nonexistent')
  })

  it('getIndicatorMeta returns correct meta', () => {
    const meta = getIndicatorMeta('rsi')
    expect(meta.name).toBe('rsi')
    expect(meta.category).toBe('momentum')
    expect(meta.display).toBe('subchart')
  })

  it('getAllIndicatorMetas returns all metas', () => {
    const metas = getAllIndicatorMetas()
    expect(metas.length).toBe(25)
    const names = metas.map((m) => m.name)
    expect(names).toContain('sma')
    expect(names).toContain('rsi')
    expect(names).toContain('bollinger')
    expect(names).toContain('ichimoku')
  })
})
