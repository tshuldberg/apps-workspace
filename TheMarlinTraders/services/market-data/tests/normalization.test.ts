import { describe, it, expect } from 'vitest'
import { normalizeTrade, normalizeAggregate, isRegularTrade } from '../src/normalization/normalize.js'
import type { PolygonTrade, PolygonAggregate } from '../src/providers/polygon-ws.js'

describe('normalizeTrade', () => {
  it('converts a Polygon trade to NormalizedTrade', () => {
    const raw: PolygonTrade = {
      ev: 'T',
      sym: 'AAPL',
      p: 175.25,
      s: 100,
      t: 1700000000000,
      c: [0, 12],
      x: 12,
    }

    const result = normalizeTrade(raw)

    expect(result).toEqual({
      symbol: 'AAPL',
      price: 175.25,
      size: 100,
      timestamp: 1700000000000,
      conditions: ['0', '12'],
      exchange: 'XNAS',
    })
  })

  it('handles trade without conditions or exchange', () => {
    const raw: PolygonTrade = {
      ev: 'T',
      sym: 'MSFT',
      p: 350.50,
      s: 50,
      t: 1700000001000,
    }

    const result = normalizeTrade(raw)

    expect(result.symbol).toBe('MSFT')
    expect(result.conditions).toBeUndefined()
    expect(result.exchange).toBeUndefined()
  })

  it('maps known exchange IDs', () => {
    const exchanges = [
      { id: 7, mic: 'XNYS' },
      { id: 12, mic: 'XNAS' },
      { id: 15, mic: 'IEXG' },
    ]

    for (const { id, mic } of exchanges) {
      const raw: PolygonTrade = { ev: 'T', sym: 'SPY', p: 450, s: 10, t: 0, x: id }
      expect(normalizeTrade(raw).exchange).toBe(mic)
    }
  })
})

describe('normalizeAggregate', () => {
  it('converts a Polygon aggregate to NormalizedBar', () => {
    const raw: PolygonAggregate = {
      ev: 'AM',
      sym: 'TSLA',
      o: 240.00,
      h: 242.50,
      l: 239.00,
      c: 241.75,
      v: 15000,
      s: 1700000000000,
      e: 1700000060000,
      vw: 241.12,
      z: 350,
    }

    const result = normalizeAggregate(raw)

    expect(result).toEqual({
      symbol: 'TSLA',
      timeframe: '1m',
      open: 240.00,
      high: 242.50,
      low: 239.00,
      close: 241.75,
      volume: 15000,
      timestamp: 1700000000000,
      vwap: 241.12,
      tradeCount: 350,
    })
  })

  it('handles aggregate without optional fields', () => {
    const raw: PolygonAggregate = {
      ev: 'AM',
      sym: 'QQQ',
      o: 380.00,
      h: 381.00,
      l: 379.50,
      c: 380.75,
      v: 5000,
      s: 1700000000000,
      e: 1700000060000,
    }

    const result = normalizeAggregate(raw)
    expect(result.vwap).toBeUndefined()
    expect(result.tradeCount).toBeUndefined()
  })
})

describe('isRegularTrade', () => {
  it('returns true for trades with no conditions', () => {
    expect(isRegularTrade({ ev: 'T', sym: 'AAPL', p: 175, s: 100, t: 0 })).toBe(true)
  })

  it('returns true for regular condition codes', () => {
    expect(isRegularTrade({ ev: 'T', sym: 'AAPL', p: 175, s: 100, t: 0, c: [0, 12] })).toBe(true)
  })

  it('returns false for Form T (pre/post-market)', () => {
    expect(isRegularTrade({ ev: 'T', sym: 'AAPL', p: 175, s: 100, t: 0, c: [21] })).toBe(false)
  })

  it('returns false for average price trades', () => {
    expect(isRegularTrade({ ev: 'T', sym: 'AAPL', p: 175, s: 100, t: 0, c: [2] })).toBe(false)
  })

  it('returns false when any condition is irregular', () => {
    expect(isRegularTrade({ ev: 'T', sym: 'AAPL', p: 175, s: 100, t: 0, c: [0, 37] })).toBe(false)
  })
})
