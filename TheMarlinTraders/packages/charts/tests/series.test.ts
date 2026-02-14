import { describe, it, expect } from 'vitest'
import { computeHeikinAshi } from '../src/lightweight/series/heikin-ashi.js'
import type { OHLCV } from '@marlin/shared'

const SAMPLE_BARS: OHLCV[] = [
  { open: 100, high: 110, low: 95, close: 105, volume: 1000, timestamp: 1000000 },
  { open: 105, high: 115, low: 100, close: 110, volume: 1200, timestamp: 2000000 },
  { open: 110, high: 120, low: 105, close: 108, volume: 900, timestamp: 3000000 },
]

describe('series', () => {
  describe('computeHeikinAshi', () => {
    it('returns empty array for empty input', () => {
      expect(computeHeikinAshi([])).toEqual([])
    })

    it('computes Heikin-Ashi bars correctly', () => {
      const result = computeHeikinAshi(SAMPLE_BARS)

      expect(result).toHaveLength(3)

      // First bar: haClose = (100+110+95+105)/4 = 102.5, haOpen = (100+105)/2 = 102.5
      const first = result[0]!
      expect(first.close).toBe(102.5)
      expect(first.open).toBe(102.5)
      expect(first.high).toBe(110) // max(110, 102.5, 102.5)
      expect(first.low).toBe(95) // min(95, 102.5, 102.5)
      expect(first.volume).toBe(1000)
      expect(first.timestamp).toBe(1000000)
    })

    it('uses previous HA bar for open calculation', () => {
      const result = computeHeikinAshi(SAMPLE_BARS)

      // Second bar: haClose = (105+115+100+110)/4 = 107.5
      // haOpen = (prevHA.open + prevHA.close)/2 = (102.5 + 102.5)/2 = 102.5
      const second = result[1]!
      expect(second.close).toBe(107.5)
      expect(second.open).toBe(102.5)
      expect(second.high).toBe(115)
      expect(second.low).toBe(100)
    })

    it('preserves timestamps', () => {
      const result = computeHeikinAshi(SAMPLE_BARS)
      expect(result.map((b) => b.timestamp)).toEqual([1000000, 2000000, 3000000])
    })
  })
})
