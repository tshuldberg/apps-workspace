import { describe, it, expect } from 'vitest'
import {
  calculateIVRank,
  calculateIVPercentile,
  calculateExpectedMove,
  buildVolatilityCone,
  buildIVSurface,
  buildSkew,
  buildTermStructure,
} from '../../src/services/iv-analytics.js'
import type { OptionsChainData } from '@marlin/shared'

// ---------------------------------------------------------------------------
// IV Rank
// ---------------------------------------------------------------------------

describe('calculateIVRank', () => {
  it('returns 0 when historical IVs are empty', () => {
    expect(calculateIVRank(0.30, [])).toBe(0)
  })

  it('returns 0 when current IV equals the low', () => {
    const historicalIVs = [0.20, 0.25, 0.30, 0.40, 0.50]
    expect(calculateIVRank(0.20, historicalIVs)).toBe(0)
  })

  it('returns 100 when current IV equals the high', () => {
    const historicalIVs = [0.20, 0.25, 0.30, 0.40, 0.50]
    expect(calculateIVRank(0.50, historicalIVs)).toBe(100)
  })

  it('returns 50 when current IV is at the midpoint', () => {
    const historicalIVs = [0.20, 0.30, 0.40]
    // midpoint = 0.30, (0.30 - 0.20) / (0.40 - 0.20) = 0.5 => 50
    expect(calculateIVRank(0.30, historicalIVs)).toBe(50)
  })

  it('clamps to 0-100 range', () => {
    const historicalIVs = [0.20, 0.30, 0.40]
    // Below range
    expect(calculateIVRank(0.10, historicalIVs)).toBe(0)
    // Above range
    expect(calculateIVRank(0.60, historicalIVs)).toBe(100)
  })

  it('handles all identical historical values', () => {
    const historicalIVs = [0.30, 0.30, 0.30]
    expect(calculateIVRank(0.30, historicalIVs)).toBe(0) // high <= low
  })
})

// ---------------------------------------------------------------------------
// IV Percentile
// ---------------------------------------------------------------------------

describe('calculateIVPercentile', () => {
  it('returns 0 when historical IVs are empty', () => {
    expect(calculateIVPercentile(0.30, [])).toBe(0)
  })

  it('returns correct percentile for known values', () => {
    // 3 of 5 values are below 0.35
    const historicalIVs = [0.10, 0.20, 0.30, 0.40, 0.50]
    expect(calculateIVPercentile(0.35, historicalIVs)).toBe(60) // 3/5 = 60%
  })

  it('returns 0 when current IV is the lowest', () => {
    const historicalIVs = [0.30, 0.40, 0.50]
    expect(calculateIVPercentile(0.25, historicalIVs)).toBe(0)
  })

  it('returns 100 when current IV is above all historical', () => {
    const historicalIVs = [0.10, 0.20, 0.30]
    expect(calculateIVPercentile(0.50, historicalIVs)).toBe(100)
  })

  it('handles duplicate values correctly', () => {
    const historicalIVs = [0.20, 0.20, 0.20, 0.40, 0.40]
    // 3 values below 0.30 (the three 0.20s)
    expect(calculateIVPercentile(0.30, historicalIVs)).toBe(60)
  })
})

// ---------------------------------------------------------------------------
// Expected Move
// ---------------------------------------------------------------------------

describe('calculateExpectedMove', () => {
  it('calculates expected move for 1 standard deviation', () => {
    const result = calculateExpectedMove(
      0.30,     // 30% IV
      100,      // $100 price
      30,       // 30 DTE
      'AAPL',
      '2024-02-19',
      0.6827,
    )

    expect(result.symbol).toBe('AAPL')
    expect(result.expiration).toBe('2024-02-19')
    expect(result.probability).toBe(0.6827)

    // Expected move = 100 * 0.30 * sqrt(30/365) = ~8.59
    const expectedMove = 100 * 0.30 * Math.sqrt(30 / 365)
    expect(result.upperBound).toBeCloseTo(100 + expectedMove, 1)
    expect(result.lowerBound).toBeCloseTo(100 - expectedMove, 1)
    expect(result.upperBound).toBeGreaterThan(100)
    expect(result.lowerBound).toBeLessThan(100)
  })

  it('calculates expected move for 2 standard deviations', () => {
    const result = calculateExpectedMove(
      0.30,
      100,
      30,
      'AAPL',
      '2024-02-19',
      0.9545,  // 2 std dev
    )

    const expectedMove = 100 * 0.30 * Math.sqrt(30 / 365) * 2
    expect(result.upperBound).toBeCloseTo(100 + expectedMove, 1)
    expect(result.lowerBound).toBeCloseTo(100 - expectedMove, 1)
  })

  it('returns symmetric bounds around current price', () => {
    const result = calculateExpectedMove(0.25, 200, 45, 'SPY', '2024-03-15')
    const upMove = result.upperBound - 200
    const downMove = 200 - result.lowerBound
    expect(upMove).toBeCloseTo(downMove, 6)
  })

  it('handles zero IV', () => {
    const result = calculateExpectedMove(0, 100, 30, 'TEST', '2024-02-19')
    expect(result.upperBound).toBe(100)
    expect(result.lowerBound).toBe(100)
  })

  it('handles zero DTE', () => {
    const result = calculateExpectedMove(0.30, 100, 0, 'TEST', '2024-02-19')
    expect(result.upperBound).toBe(100)
    expect(result.lowerBound).toBe(100)
  })
})

// ---------------------------------------------------------------------------
// Volatility Cone
// ---------------------------------------------------------------------------

describe('buildVolatilityCone', () => {
  it('returns empty cones for insufficient data', () => {
    const result = buildVolatilityCone([100, 101], [20, 60])
    expect(result.length).toBe(2)
    expect(result[0]!.period).toBe(20)
    expect(result[0]!.median).toBe(0) // not enough data
  })

  it('builds cone with sufficient historical prices', () => {
    // Generate a synthetic price series (random walk)
    const prices: number[] = [100]
    for (let i = 1; i <= 200; i++) {
      const change = 1 + (Math.random() - 0.5) * 0.04 // +/- 2% daily
      prices.push(prices[i - 1]! * change)
    }

    const result = buildVolatilityCone(prices, [10, 20])
    expect(result.length).toBe(2)

    for (const cone of result) {
      expect(cone.percentile5).toBeLessThanOrEqual(cone.percentile25)
      expect(cone.percentile25).toBeLessThanOrEqual(cone.median)
      expect(cone.median).toBeLessThanOrEqual(cone.percentile75)
      expect(cone.percentile75).toBeLessThanOrEqual(cone.percentile95)
      expect(cone.current).toBeGreaterThan(0)
    }
  })

  it('uses default periods when none specified', () => {
    const prices = Array.from({ length: 300 }, (_, i) => 100 + Math.sin(i / 10) * 5)
    const result = buildVolatilityCone(prices)
    // Default periods: [10, 20, 30, 60, 90, 120]
    expect(result.length).toBe(6)
    expect(result[0]!.period).toBe(10)
    expect(result[5]!.period).toBe(120)
  })
})

// ---------------------------------------------------------------------------
// IV Surface
// ---------------------------------------------------------------------------

describe('buildIVSurface', () => {
  it('returns empty surface for no chains', () => {
    const result = buildIVSurface([])
    expect(result.expirations.length).toBe(0)
    expect(result.strikes.length).toBe(0)
    expect(result.ivMatrix.length).toBe(0)
  })

  it('builds surface from chain data', () => {
    const chains: OptionsChainData[] = [
      {
        underlying: 'AAPL',
        underlyingPrice: 150,
        expiration: '2024-01-19',
        strikes: [
          {
            price: 145,
            call: { symbol: 'AAPL240119C00145000', underlying: 'AAPL', type: 'call', strike: 145, expiration: '2024-01-19', bid: 6, ask: 7, last: 6.5, volume: 100, openInterest: 500, iv: 0.28, greeks: { delta: 0.7, gamma: 0.02, theta: -0.05, vega: 0.1, rho: 0 } },
            put: { symbol: 'AAPL240119P00145000', underlying: 'AAPL', type: 'put', strike: 145, expiration: '2024-01-19', bid: 1, ask: 1.5, last: 1.2, volume: 50, openInterest: 200, iv: 0.30, greeks: { delta: -0.3, gamma: 0.02, theta: -0.04, vega: 0.1, rho: 0 } },
          },
          {
            price: 150,
            call: { symbol: 'AAPL240119C00150000', underlying: 'AAPL', type: 'call', strike: 150, expiration: '2024-01-19', bid: 3, ask: 4, last: 3.5, volume: 200, openInterest: 1000, iv: 0.25, greeks: { delta: 0.5, gamma: 0.03, theta: -0.06, vega: 0.12, rho: 0 } },
            put: { symbol: 'AAPL240119P00150000', underlying: 'AAPL', type: 'put', strike: 150, expiration: '2024-01-19', bid: 3, ask: 4, last: 3.5, volume: 150, openInterest: 800, iv: 0.26, greeks: { delta: -0.5, gamma: 0.03, theta: -0.06, vega: 0.12, rho: 0 } },
          },
        ],
        updatedAt: Date.now(),
      },
    ]

    const result = buildIVSurface(chains)
    expect(result.symbol).toBe('AAPL')
    expect(result.expirations).toEqual(['2024-01-19'])
    expect(result.strikes).toEqual([145, 150])
    expect(result.ivMatrix.length).toBe(1)
    expect(result.ivMatrix[0]!.length).toBe(2)
    // Strike 145: avg of 0.28 and 0.30 = 0.29
    expect(result.ivMatrix[0]![0]).toBeCloseTo(0.29, 2)
    // Strike 150: avg of 0.25 and 0.26 = 0.255
    expect(result.ivMatrix[0]![1]).toBeCloseTo(0.255, 2)
  })
})

// ---------------------------------------------------------------------------
// Skew
// ---------------------------------------------------------------------------

describe('buildSkew', () => {
  it('builds skew data from chain', () => {
    const chain: OptionsChainData = {
      underlying: 'SPY',
      underlyingPrice: 450,
      expiration: '2024-01-19',
      strikes: [
        {
          price: 440,
          call: { symbol: 'c1', underlying: 'SPY', type: 'call', strike: 440, expiration: '2024-01-19', bid: 12, ask: 13, last: 12.5, volume: 100, openInterest: 500, iv: 0.18, greeks: { delta: 0.8, gamma: 0.01, theta: -0.03, vega: 0.1, rho: 0 } },
          put: { symbol: 'p1', underlying: 'SPY', type: 'put', strike: 440, expiration: '2024-01-19', bid: 1, ask: 1.5, last: 1.2, volume: 50, openInterest: 200, iv: 0.22, greeks: { delta: -0.2, gamma: 0.01, theta: -0.02, vega: 0.08, rho: 0 } },
        },
        {
          price: 450,
          call: { symbol: 'c2', underlying: 'SPY', type: 'call', strike: 450, expiration: '2024-01-19', bid: 5, ask: 6, last: 5.5, volume: 200, openInterest: 1000, iv: 0.15, greeks: { delta: 0.5, gamma: 0.02, theta: -0.04, vega: 0.12, rho: 0 } },
          put: { symbol: 'p2', underlying: 'SPY', type: 'put', strike: 450, expiration: '2024-01-19', bid: 5, ask: 6, last: 5.5, volume: 200, openInterest: 1000, iv: 0.16, greeks: { delta: -0.5, gamma: 0.02, theta: -0.04, vega: 0.12, rho: 0 } },
        },
      ],
      updatedAt: Date.now(),
    }

    const result = buildSkew(chain, '2024-01-19')
    expect(result.symbol).toBe('SPY')
    expect(result.expiration).toBe('2024-01-19')
    expect(result.strikes).toEqual([440, 450])
    expect(result.callIVs).toEqual([0.18, 0.15])
    expect(result.putIVs).toEqual([0.22, 0.16])
  })
})

// ---------------------------------------------------------------------------
// Term Structure
// ---------------------------------------------------------------------------

describe('buildTermStructure', () => {
  it('returns empty for no chains', () => {
    const result = buildTermStructure([])
    expect(result.expirations.length).toBe(0)
  })

  it('builds term structure from multiple expirations', () => {
    const makeChain = (exp: string, atmCallIV: number, atmPutIV: number): OptionsChainData => ({
      underlying: 'SPY',
      underlyingPrice: 450,
      expiration: exp,
      strikes: [
        {
          price: 450,
          call: { symbol: 'c', underlying: 'SPY', type: 'call', strike: 450, expiration: exp, bid: 5, ask: 6, last: 5.5, volume: 100, openInterest: 500, iv: atmCallIV, greeks: { delta: 0.5, gamma: 0.02, theta: -0.04, vega: 0.1, rho: 0 } },
          put: { symbol: 'p', underlying: 'SPY', type: 'put', strike: 450, expiration: exp, bid: 5, ask: 6, last: 5.5, volume: 100, openInterest: 500, iv: atmPutIV, greeks: { delta: -0.5, gamma: 0.02, theta: -0.04, vega: 0.1, rho: 0 } },
        },
      ],
      updatedAt: Date.now(),
    })

    const chains = [
      makeChain('2024-01-19', 0.14, 0.16),
      makeChain('2024-02-16', 0.18, 0.20),
      makeChain('2024-03-15', 0.22, 0.24),
    ]

    const result = buildTermStructure(chains)
    expect(result.symbol).toBe('SPY')
    expect(result.expirations).toEqual(['2024-01-19', '2024-02-16', '2024-03-15'])
    expect(result.atm_ivs.length).toBe(3)
    expect(result.atm_ivs[0]).toBeCloseTo(0.15, 2) // avg(0.14, 0.16)
    expect(result.atm_ivs[1]).toBeCloseTo(0.19, 2) // avg(0.18, 0.20)
    expect(result.atm_ivs[2]).toBeCloseTo(0.23, 2) // avg(0.22, 0.24)
  })
})
