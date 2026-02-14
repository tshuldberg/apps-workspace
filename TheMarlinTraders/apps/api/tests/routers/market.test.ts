import { describe, it, expect } from 'vitest'
import { TimeframeSchema } from '@marlin/shared'
import { z } from 'zod'

// Test the input validation schema used by the market router
const MarketGetBarsInput = z.object({
  symbol: z.string().min(1).max(10).transform((s) => s.toUpperCase()),
  timeframe: TimeframeSchema,
  from: z.string().optional(),
  to: z.string().optional(),
})

describe('market router input validation', () => {
  it('accepts valid symbol and timeframe', () => {
    const result = MarketGetBarsInput.safeParse({
      symbol: 'AAPL',
      timeframe: '1D',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.symbol).toBe('AAPL')
      expect(result.data.timeframe).toBe('1D')
    }
  })

  it('uppercases the symbol', () => {
    const result = MarketGetBarsInput.safeParse({
      symbol: 'aapl',
      timeframe: '1D',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.symbol).toBe('AAPL')
    }
  })

  it('rejects empty symbol', () => {
    const result = MarketGetBarsInput.safeParse({
      symbol: '',
      timeframe: '1D',
    })
    expect(result.success).toBe(false)
  })

  it('rejects symbol longer than 10 characters', () => {
    const result = MarketGetBarsInput.safeParse({
      symbol: 'VERYLONGSYMBOL',
      timeframe: '1D',
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid timeframe', () => {
    const result = MarketGetBarsInput.safeParse({
      symbol: 'AAPL',
      timeframe: '2D',
    })
    expect(result.success).toBe(false)
  })

  it('accepts all valid timeframes', () => {
    const validTimeframes = ['1m', '5m', '15m', '30m', '1h', '4h', '1D', '1W', '1M']
    for (const tf of validTimeframes) {
      const result = MarketGetBarsInput.safeParse({
        symbol: 'AAPL',
        timeframe: tf,
      })
      expect(result.success).toBe(true)
    }
  })

  it('accepts optional from and to dates', () => {
    const result = MarketGetBarsInput.safeParse({
      symbol: 'MSFT',
      timeframe: '1h',
      from: '2024-01-01',
      to: '2024-03-01',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.from).toBe('2024-01-01')
      expect(result.data.to).toBe('2024-03-01')
    }
  })
})
