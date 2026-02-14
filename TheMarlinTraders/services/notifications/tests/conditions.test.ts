import { describe, it, expect } from 'vitest'
import { priceAbove, priceBelow, priceCrossingUp, priceCrossingDown } from '../src/evaluator/conditions/price.js'
import { volumeAbove, rvolAbove } from '../src/evaluator/conditions/volume.js'
import { rsiAbove, rsiBelow, macdCrossover, maCrossover } from '../src/evaluator/conditions/indicator.js'
import type { OHLCV } from '@marlin/shared'

// --- Price Conditions ---
describe('price conditions', () => {
  describe('priceAbove', () => {
    it('returns true when current price >= threshold', () => {
      expect(priceAbove({ currentPrice: 155, previousPrice: 150, threshold: 150 })).toBe(true)
      expect(priceAbove({ currentPrice: 150, previousPrice: 145, threshold: 150 })).toBe(true)
    })

    it('returns false when current price < threshold', () => {
      expect(priceAbove({ currentPrice: 149.99, previousPrice: 148, threshold: 150 })).toBe(false)
    })
  })

  describe('priceBelow', () => {
    it('returns true when current price <= threshold', () => {
      expect(priceBelow({ currentPrice: 145, previousPrice: 150, threshold: 150 })).toBe(true)
      expect(priceBelow({ currentPrice: 150, previousPrice: 155, threshold: 150 })).toBe(true)
    })

    it('returns false when current price > threshold', () => {
      expect(priceBelow({ currentPrice: 150.01, previousPrice: 155, threshold: 150 })).toBe(false)
    })
  })

  describe('priceCrossingUp', () => {
    it('returns true when price crosses from below to at/above threshold', () => {
      expect(priceCrossingUp({ currentPrice: 150, previousPrice: 149, threshold: 150 })).toBe(true)
      expect(priceCrossingUp({ currentPrice: 155, previousPrice: 149, threshold: 150 })).toBe(true)
    })

    it('returns false when price was already above threshold', () => {
      expect(priceCrossingUp({ currentPrice: 155, previousPrice: 151, threshold: 150 })).toBe(false)
    })

    it('returns false when price remains below threshold', () => {
      expect(priceCrossingUp({ currentPrice: 149.5, previousPrice: 149, threshold: 150 })).toBe(false)
    })
  })

  describe('priceCrossingDown', () => {
    it('returns true when price crosses from above to at/below threshold', () => {
      expect(priceCrossingDown({ currentPrice: 150, previousPrice: 151, threshold: 150 })).toBe(true)
      expect(priceCrossingDown({ currentPrice: 145, previousPrice: 151, threshold: 150 })).toBe(true)
    })

    it('returns false when price was already below threshold', () => {
      expect(priceCrossingDown({ currentPrice: 148, previousPrice: 149, threshold: 150 })).toBe(false)
    })

    it('returns false when price remains above threshold', () => {
      expect(priceCrossingDown({ currentPrice: 152, previousPrice: 151, threshold: 150 })).toBe(false)
    })
  })
})

// --- Volume Conditions ---
describe('volume conditions', () => {
  describe('volumeAbove', () => {
    it('returns true when volume >= threshold', () => {
      expect(volumeAbove({ currentVolume: 1_000_000, threshold: 500_000 })).toBe(true)
      expect(volumeAbove({ currentVolume: 500_000, threshold: 500_000 })).toBe(true)
    })

    it('returns false when volume < threshold', () => {
      expect(volumeAbove({ currentVolume: 499_999, threshold: 500_000 })).toBe(false)
    })
  })

  describe('rvolAbove', () => {
    it('returns true when relative volume >= threshold', () => {
      expect(rvolAbove({ currentVolume: 2_000_000, averageVolume: 1_000_000, threshold: 2 })).toBe(true)
      expect(rvolAbove({ currentVolume: 3_000_000, averageVolume: 1_000_000, threshold: 2 })).toBe(true)
    })

    it('returns false when relative volume < threshold', () => {
      expect(rvolAbove({ currentVolume: 1_500_000, averageVolume: 1_000_000, threshold: 2 })).toBe(false)
    })

    it('returns false when average volume is zero', () => {
      expect(rvolAbove({ currentVolume: 1_000_000, averageVolume: 0, threshold: 2 })).toBe(false)
    })
  })
})

// --- Indicator Conditions ---
function makeOHLCV(closes: number[]): OHLCV[] {
  return closes.map((c, i) => ({
    timestamp: Date.now() + i * 60_000,
    open: c - 0.5,
    high: c + 1,
    low: c - 1,
    close: c,
    volume: 100_000,
  }))
}

describe('indicator conditions', () => {
  describe('rsiAbove', () => {
    it('returns true when RSI exceeds threshold with overbought data', () => {
      // Generate a strong uptrend to push RSI high
      const closes: number[] = []
      for (let i = 0; i < 30; i++) {
        closes.push(100 + i * 2) // Steady climb
      }
      const data = makeOHLCV(closes)
      expect(rsiAbove({ data }, 70)).toBe(true)
    })

    it('returns false when RSI is below threshold', () => {
      // Generate a downtrend to push RSI low
      const closes: number[] = []
      for (let i = 0; i < 30; i++) {
        closes.push(200 - i * 2) // Steady decline
      }
      const data = makeOHLCV(closes)
      expect(rsiAbove({ data }, 70)).toBe(false)
    })
  })

  describe('rsiBelow', () => {
    it('returns true when RSI is below threshold with oversold data', () => {
      const closes: number[] = []
      for (let i = 0; i < 30; i++) {
        closes.push(200 - i * 2)
      }
      const data = makeOHLCV(closes)
      expect(rsiBelow({ data }, 30)).toBe(true)
    })

    it('returns false when RSI is above threshold', () => {
      const closes: number[] = []
      for (let i = 0; i < 30; i++) {
        closes.push(100 + i * 2)
      }
      const data = makeOHLCV(closes)
      expect(rsiBelow({ data }, 30)).toBe(false)
    })
  })

  describe('macdCrossover', () => {
    it('returns false with insufficient data', () => {
      const data = makeOHLCV([100, 101, 102])
      expect(macdCrossover({ data })).toBe(false)
    })

    it('handles flat data without errors', () => {
      const closes = new Array(50).fill(100)
      const data = makeOHLCV(closes)
      // Flat data => MACD ~0, no crossover
      expect(macdCrossover({ data })).toBe(false)
    })
  })

  describe('maCrossover', () => {
    it('returns false with insufficient data', () => {
      const data = makeOHLCV([100, 101])
      expect(maCrossover({ data })).toBe(false)
    })

    it('handles flat data without errors', () => {
      const closes = new Array(50).fill(100)
      const data = makeOHLCV(closes)
      expect(maCrossover({ data })).toBe(false)
    })
  })
})
