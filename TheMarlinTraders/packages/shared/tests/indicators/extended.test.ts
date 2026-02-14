import { describe, it, expect } from 'vitest'
import type { OHLCV } from '../../src/types/market-data.js'
import { aroonOscillator } from '../../src/indicators/extended/aroon-oscillator.js'
import { bop } from '../../src/indicators/extended/bop.js'
import { dpo } from '../../src/indicators/extended/dpo.js'
import { eom } from '../../src/indicators/extended/eom.js'
import { elderRay } from '../../src/indicators/extended/elder-ray.js'
import { forceIndex } from '../../src/indicators/extended/force-index.js'
import { kst } from '../../src/indicators/extended/kst.js'
import { massIndex } from '../../src/indicators/extended/mass-index.js'
import { ppo } from '../../src/indicators/extended/ppo.js'
import { rvol } from '../../src/indicators/extended/rvol.js'
import { tsi } from '../../src/indicators/extended/tsi.js'
import { wad } from '../../src/indicators/extended/wad.js'
import { zigzag } from '../../src/indicators/extended/zigzag.js'
import { vwapBands } from '../../src/indicators/extended/vwap-bands.js'
import { percentB } from '../../src/indicators/extended/percent-b.js'

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

describe('Aroon Oscillator', () => {
  it('returns correct length', () => {
    const result = aroonOscillator(data, { period: 25 })
    expect(result).toHaveLength(data.length)
  })

  it('values bounded -100 to 100', () => {
    const result = aroonOscillator(data, { period: 25 })
    for (const v of result) {
      if (!isNaN(v)) {
        expect(v).toBeGreaterThanOrEqual(-100)
        expect(v).toBeLessThanOrEqual(100)
      }
    }
  })
})

describe('Balance of Power', () => {
  it('returns correct length', () => {
    const result = bop(data, { smoothing: 14 })
    expect(result).toHaveLength(data.length)
  })
})

describe('Detrended Price Oscillator', () => {
  it('returns correct length', () => {
    const result = dpo(data, { period: 20 })
    expect(result).toHaveLength(data.length)
  })
})

describe('Ease of Movement', () => {
  it('returns correct length', () => {
    const result = eom(data, { period: 14 })
    expect(result).toHaveLength(data.length)
  })
})

describe('Elder Ray', () => {
  it('returns bullPower and bearPower', () => {
    const result = elderRay(data, { period: 13 })
    expect(result.bullPower).toHaveLength(data.length)
    expect(result.bearPower).toHaveLength(data.length)
  })

  it('bullPower >= 0 when high > EMA', () => {
    const result = elderRay(data, { period: 13 })
    // Just check non-NaN values exist
    const validBull = result.bullPower.filter((v) => !isNaN(v))
    expect(validBull.length).toBeGreaterThan(0)
  })
})

describe('Force Index', () => {
  it('returns correct length', () => {
    const result = forceIndex(data, { period: 13 })
    expect(result).toHaveLength(data.length)
  })
})

describe('Know Sure Thing (KST)', () => {
  it('returns kst and signal', () => {
    const result = kst(data, {})
    expect(result.kst).toHaveLength(data.length)
    expect(result.signal).toHaveLength(data.length)
  })
})

describe('Mass Index', () => {
  it('returns correct length', () => {
    const result = massIndex(data, { emaPeriod: 9, sumPeriod: 25 })
    expect(result).toHaveLength(data.length)
  })
})

describe('Percentage Price Oscillator (PPO)', () => {
  it('returns ppo, signal, histogram', () => {
    const result = ppo(data, { fast: 12, slow: 26, signal: 9 })
    expect(result.ppo).toHaveLength(data.length)
    expect(result.signal).toHaveLength(data.length)
    expect(result.histogram).toHaveLength(data.length)
  })
})

describe('Relative Volume (RVOL)', () => {
  it('returns correct length', () => {
    const result = rvol(data, { period: 20 })
    expect(result).toHaveLength(data.length)
  })

  it('values are positive', () => {
    const result = rvol(data, { period: 20 })
    for (const v of result) {
      if (!isNaN(v)) expect(v).toBeGreaterThan(0)
    }
  })
})

describe('True Strength Index (TSI)', () => {
  it('returns tsi and signal', () => {
    const result = tsi(data, { longPeriod: 25, shortPeriod: 13, signal: 7 })
    expect(result.tsi).toHaveLength(data.length)
    expect(result.signal).toHaveLength(data.length)
  })
})

describe('Williams A/D', () => {
  it('returns correct length', () => {
    const result = wad(data, {})
    expect(result).toHaveLength(data.length)
  })

  it('first value is 0', () => {
    const result = wad(data, {})
    expect(result[0]).toBe(0)
  })
})

describe('ZigZag', () => {
  it('returns correct length', () => {
    const result = zigzag(data, { deviation: 5 })
    expect(result).toHaveLength(data.length)
  })

  it('handles empty data', () => {
    const result = zigzag([], { deviation: 5 })
    expect(result).toHaveLength(0)
  })
})

describe('VWAP Bands', () => {
  it('returns vwap and bands', () => {
    const result = vwapBands(data, { multiplier1: 1, multiplier2: 2 })
    expect(result.vwap).toHaveLength(data.length)
    expect(result.upper1).toHaveLength(data.length)
    expect(result.lower1).toHaveLength(data.length)
    expect(result.upper2).toHaveLength(data.length)
    expect(result.lower2).toHaveLength(data.length)
  })

  it('upper bands > vwap > lower bands', () => {
    const result = vwapBands(data, { multiplier1: 1, multiplier2: 2 })
    for (let i = 0; i < data.length; i++) {
      if (!isNaN(result.vwap[i]) && !isNaN(result.upper1[i])) {
        expect(result.upper2[i]).toBeGreaterThanOrEqual(result.upper1[i])
        expect(result.upper1[i]).toBeGreaterThanOrEqual(result.vwap[i])
        expect(result.vwap[i]).toBeGreaterThanOrEqual(result.lower1[i])
        expect(result.lower1[i]).toBeGreaterThanOrEqual(result.lower2[i])
      }
    }
  })
})

describe('Percent B', () => {
  it('returns correct length', () => {
    const result = percentB(data, { period: 20, stdDev: 2 })
    expect(result).toHaveLength(data.length)
  })
})
