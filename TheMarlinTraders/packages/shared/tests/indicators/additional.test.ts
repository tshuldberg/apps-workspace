import { describe, it, expect } from 'vitest'
import type { OHLCV } from '../../src/types/market-data.js'
import { roc } from '../../src/indicators/additional/roc.js'
import { ultimateOscillator } from '../../src/indicators/additional/ultimate-oscillator.js'
import { awesomeOscillator } from '../../src/indicators/additional/awesome-oscillator.js'
import { trix } from '../../src/indicators/additional/trix.js'
import { cmf } from '../../src/indicators/additional/cmf.js'
import { klinger } from '../../src/indicators/additional/klinger.js'
import { choppiness } from '../../src/indicators/additional/choppiness.js'
import { stddev } from '../../src/indicators/additional/stddev.js'
import { hv } from '../../src/indicators/additional/hv.js'
import { volumeProfile } from '../../src/indicators/additional/volume-profile.js'

function makeData(count: number): OHLCV[] {
  const data: OHLCV[] = []
  let price = 100
  for (let i = 0; i < count; i++) {
    const change = (Math.sin(i * 0.3) + Math.cos(i * 0.1)) * 2
    price = Math.max(1, price + change)
    data.push({
      open: price - 0.5,
      high: price + 2,
      low: price - 2,
      close: price,
      volume: 1000 + Math.floor(Math.abs(Math.sin(i * 0.5)) * 5000),
      timestamp: Date.now() + i * 60_000,
    })
  }
  return data
}

const data = makeData(100)

describe('Rate of Change (ROC)', () => {
  it('returns correct length', () => {
    const result = roc(data, { period: 12 })
    expect(result).toHaveLength(data.length)
  })

  it('first `period` values are NaN', () => {
    const result = roc(data, { period: 12 })
    for (let i = 0; i < 12; i++) {
      expect(result[i]).toBeNaN()
    }
    expect(result[12]).not.toBeNaN()
  })

  it('handles empty data', () => {
    const result = roc([], { period: 12 })
    expect(result).toHaveLength(0)
  })
})

describe('Ultimate Oscillator', () => {
  it('returns correct length', () => {
    const result = ultimateOscillator(data, { period1: 7, period2: 14, period3: 28 })
    expect(result).toHaveLength(data.length)
  })

  it('values are bounded 0-100', () => {
    const result = ultimateOscillator(data, { period1: 7, period2: 14, period3: 28 })
    for (const v of result) {
      if (!isNaN(v)) {
        expect(v).toBeGreaterThanOrEqual(0)
        expect(v).toBeLessThanOrEqual(100)
      }
    }
  })
})

describe('Awesome Oscillator', () => {
  it('returns correct length', () => {
    const result = awesomeOscillator(data, {})
    expect(result).toHaveLength(data.length)
  })

  it('has NaN for first 33 values', () => {
    const result = awesomeOscillator(data, {})
    expect(result[32]).toBeNaN()
    expect(result[33]).not.toBeNaN()
  })
})

describe('TRIX', () => {
  it('returns correct length', () => {
    const result = trix(data, { period: 15 })
    expect(result).toHaveLength(data.length)
  })
})

describe('Chaikin Money Flow (CMF)', () => {
  it('returns correct length', () => {
    const result = cmf(data, { period: 20 })
    expect(result).toHaveLength(data.length)
  })

  it('values are bounded -1 to 1', () => {
    const result = cmf(data, { period: 20 })
    for (const v of result) {
      if (!isNaN(v)) {
        expect(v).toBeGreaterThanOrEqual(-1)
        expect(v).toBeLessThanOrEqual(1)
      }
    }
  })
})

describe('Klinger Volume Oscillator', () => {
  it('returns kvo and signal arrays', () => {
    const result = klinger(data, { fast: 34, slow: 55, signal: 13 })
    expect(result.kvo).toHaveLength(data.length)
    expect(result.signal).toHaveLength(data.length)
  })
})

describe('Choppiness Index', () => {
  it('returns correct length', () => {
    const result = choppiness(data, { period: 14 })
    expect(result).toHaveLength(data.length)
  })

  it('values are bounded 0-100', () => {
    const result = choppiness(data, { period: 14 })
    for (const v of result) {
      if (!isNaN(v)) {
        expect(v).toBeGreaterThanOrEqual(0)
        expect(v).toBeLessThanOrEqual(100)
      }
    }
  })
})

describe('Standard Deviation', () => {
  it('returns correct length', () => {
    const result = stddev(data, { period: 20 })
    expect(result).toHaveLength(data.length)
  })

  it('values are non-negative', () => {
    const result = stddev(data, { period: 20 })
    for (const v of result) {
      if (!isNaN(v)) expect(v).toBeGreaterThanOrEqual(0)
    }
  })
})

describe('Historical Volatility', () => {
  it('returns correct length', () => {
    const result = hv(data, { period: 20 })
    expect(result).toHaveLength(data.length)
  })

  it('values are non-negative', () => {
    const result = hv(data, { period: 20 })
    for (const v of result) {
      if (!isNaN(v)) expect(v).toBeGreaterThanOrEqual(0)
    }
  })
})

describe('Volume Profile', () => {
  it('returns bins and poc', () => {
    const result = volumeProfile(data, { bins: 24 })
    expect(result.bins).toHaveLength(24)
    expect(result.poc).not.toBeNaN()
  })

  it('poc is within price range', () => {
    const result = volumeProfile(data, { bins: 24 })
    const lows = data.map((d) => d.low)
    const highs = data.map((d) => d.high)
    expect(result.poc).toBeGreaterThanOrEqual(Math.min(...lows))
    expect(result.poc).toBeLessThanOrEqual(Math.max(...highs))
  })

  it('handles empty data', () => {
    const result = volumeProfile([], { bins: 24 })
    expect(result.bins).toHaveLength(0)
    expect(result.poc).toBeNaN()
  })
})
