import { describe, it, expect } from 'vitest'
import { detectUnusualActivity, buildPutCallRatio } from '../../src/services/options-flow.js'
import type { OptionTrade } from '../../src/services/options-flow.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTrade(overrides: Partial<OptionTrade> = {}): OptionTrade {
  return {
    id: 'trade-1',
    timestamp: Date.now(),
    symbol: 'AAPL',
    contractSymbol: 'AAPL240119C00150000',
    expiration: '2024-01-19',
    strike: 150,
    type: 'call',
    price: 5.00,
    size: 50,
    bid: 4.80,
    ask: 5.20,
    volume: 5000,
    openInterest: 2000,
    averageVolume: 1000,
    exchange: 'CBOE',
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('detectUnusualActivity', () => {
  describe('unusual volume detection', () => {
    it('detects trades with volume > 2x average AND volume > 2x OI', () => {
      const trade = makeTrade({
        volume: 5000,      // > 2x avgVol (1000)
        openInterest: 2000, // volume > 2x OI (5000 > 4000)
        averageVolume: 1000,
        size: 200,
      })

      const result = detectUnusualActivity([trade])
      expect(result.length).toBeGreaterThan(0)
      // Should be detected as block (size >= 100) or unusual volume
      const entry = result[0]!
      expect(entry.symbol).toBe('AAPL')
    })

    it('does not flag normal volume trades', () => {
      const trade = makeTrade({
        volume: 500,         // < 2x avgVol
        openInterest: 5000,  // volume < 2x OI
        averageVolume: 1000,
        size: 10,            // not a block trade
      })

      const result = detectUnusualActivity([trade])
      expect(result.length).toBe(0)
    })
  })

  describe('block trade detection', () => {
    it('detects single print > 100 contracts as block trade', () => {
      const trade = makeTrade({
        size: 150,
        volume: 200,
        averageVolume: 500,
        openInterest: 500,
      })

      const result = detectUnusualActivity([trade])
      expect(result.length).toBe(1)
      expect(result[0]!.flowType).toBe('block')
    })

    it('does not flag trades under 100 contracts as block', () => {
      const trade = makeTrade({
        size: 50,
        volume: 200,
        averageVolume: 500,
        openInterest: 500,
      })

      const result = detectUnusualActivity([trade])
      expect(result.length).toBe(0)
    })
  })

  describe('sweep detection', () => {
    it('detects rapid fills across multiple exchanges', () => {
      const now = Date.now()
      const trades: OptionTrade[] = [
        makeTrade({ id: 'sw-1', timestamp: now, exchange: 'CBOE', size: 30 }),
        makeTrade({ id: 'sw-2', timestamp: now + 500, exchange: 'ISE', size: 40 }),
        makeTrade({ id: 'sw-3', timestamp: now + 1000, exchange: 'PHLX', size: 35 }),
      ]

      const result = detectUnusualActivity(trades)
      const sweeps = result.filter((e) => e.flowType === 'sweep')
      expect(sweeps.length).toBeGreaterThanOrEqual(1)
    })

    it('does not flag trades on the same exchange as sweeps', () => {
      const now = Date.now()
      const trades: OptionTrade[] = [
        makeTrade({ id: 'same-1', timestamp: now, exchange: 'CBOE', size: 10 }),
        makeTrade({ id: 'same-2', timestamp: now + 500, exchange: 'CBOE', size: 10 }),
      ]

      const result = detectUnusualActivity(trades)
      const sweeps = result.filter((e) => e.flowType === 'sweep')
      expect(sweeps.length).toBe(0)
    })
  })

  describe('multi-leg detection', () => {
    it('detects trades at similar timestamp with different strikes', () => {
      const now = Date.now()
      const trades: OptionTrade[] = [
        makeTrade({
          id: 'ml-1',
          timestamp: now,
          strike: 150,
          type: 'call',
          size: 200, // block so it gets flagged individually too
        }),
        makeTrade({
          id: 'ml-2',
          timestamp: now + 200,
          strike: 160,
          type: 'call',
          size: 200,
        }),
      ]

      const result = detectUnusualActivity(trades)
      const multiLegs = result.filter((e) => e.flowType === 'multi_leg')
      expect(multiLegs.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('sentiment classification', () => {
    it('classifies call bought at ask as bullish', () => {
      const trade = makeTrade({
        type: 'call',
        bid: 4.80,
        ask: 5.20,
        price: 5.20, // at the ask
        size: 150,    // block trade to ensure detection
      })

      const result = detectUnusualActivity([trade])
      expect(result.length).toBeGreaterThan(0)
      expect(result[0]!.sentiment).toBe('bullish')
    })

    it('classifies call sold at bid as bearish', () => {
      const trade = makeTrade({
        type: 'call',
        bid: 4.80,
        ask: 5.20,
        price: 4.80, // at the bid
        size: 150,
      })

      const result = detectUnusualActivity([trade])
      expect(result.length).toBeGreaterThan(0)
      expect(result[0]!.sentiment).toBe('bearish')
    })

    it('classifies put bought at ask as bearish', () => {
      const trade = makeTrade({
        type: 'put',
        bid: 3.00,
        ask: 3.40,
        price: 3.40, // at the ask
        size: 150,
      })

      const result = detectUnusualActivity([trade])
      expect(result.length).toBeGreaterThan(0)
      expect(result[0]!.sentiment).toBe('bearish')
    })

    it('classifies put sold at bid as bullish', () => {
      const trade = makeTrade({
        type: 'put',
        bid: 3.00,
        ask: 3.40,
        price: 3.00, // at the bid
        size: 150,
      })

      const result = detectUnusualActivity([trade])
      expect(result.length).toBeGreaterThan(0)
      expect(result[0]!.sentiment).toBe('bullish')
    })
  })

  describe('unusual score', () => {
    it('assigns higher score to trades with higher volume/OI ratio', () => {
      const lowRatio = makeTrade({
        id: 'lo',
        size: 150,
        volume: 200,
        openInterest: 5000,
        averageVolume: 1000,
      })

      const highRatio = makeTrade({
        id: 'hi',
        size: 150,
        volume: 10000,
        openInterest: 100,
        averageVolume: 100,
      })

      const results = detectUnusualActivity([lowRatio, highRatio])
      // Both should be detected (block trade size)
      expect(results.length).toBe(2)

      const loEntry = results.find((e) => e.id === 'lo')!
      const hiEntry = results.find((e) => e.id === 'hi')!
      expect(hiEntry.unusualScore).toBeGreaterThan(loEntry.unusualScore)
    })
  })
})

describe('buildPutCallRatio', () => {
  it('calculates put/call ratio correctly', () => {
    const trades: OptionTrade[] = [
      makeTrade({ id: 't1', symbol: 'AAPL', type: 'call', size: 100 }),
      makeTrade({ id: 't2', symbol: 'AAPL', type: 'call', size: 50 }),
      makeTrade({ id: 't3', symbol: 'AAPL', type: 'put', size: 75 }),
    ]

    const result = buildPutCallRatio('AAPL', trades)
    expect(result.symbol).toBe('AAPL')
    expect(result.callVolume).toBe(150)
    expect(result.putVolume).toBe(75)
    expect(result.ratio).toBeCloseTo(0.5)
  })

  it('returns 0 ratio when no call volume', () => {
    const trades: OptionTrade[] = [
      makeTrade({ id: 't1', symbol: 'AAPL', type: 'put', size: 100 }),
    ]

    const result = buildPutCallRatio('AAPL', trades)
    expect(result.ratio).toBe(0)
    expect(result.callVolume).toBe(0)
    expect(result.putVolume).toBe(100)
  })

  it('filters by symbol', () => {
    const trades: OptionTrade[] = [
      makeTrade({ id: 't1', symbol: 'AAPL', type: 'call', size: 100 }),
      makeTrade({ id: 't2', symbol: 'TSLA', type: 'call', size: 200 }),
    ]

    const result = buildPutCallRatio('AAPL', trades)
    expect(result.callVolume).toBe(100) // Only AAPL
    expect(result.putVolume).toBe(0)
  })
})
