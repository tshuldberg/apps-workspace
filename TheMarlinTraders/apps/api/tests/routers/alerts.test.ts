import { describe, it, expect } from 'vitest'
import { z } from 'zod'

// Test the input validation schemas used by the alerts router
const CreateAlertSchema = z.object({
  symbol: z.string().min(1).max(10).transform((s) => s.toUpperCase()),
  conditionType: z.enum([
    'price_above',
    'price_below',
    'price_crossing_up',
    'price_crossing_down',
    'volume_above',
    'rvol_above',
    'rsi_above',
    'rsi_below',
    'macd_crossover',
    'ma_crossover',
  ]),
  threshold: z.string().min(1),
  deliveryMethod: z.enum(['in_app', 'email', 'webhook', 'push']).default('in_app'),
  webhookUrl: z.string().url().optional(),
  message: z.string().max(500).optional(),
})

const UpdateAlertSchema = z.object({
  id: z.string().uuid(),
  conditionType: z.enum([
    'price_above',
    'price_below',
    'price_crossing_up',
    'price_crossing_down',
    'volume_above',
    'rvol_above',
    'rsi_above',
    'rsi_below',
    'macd_crossover',
    'ma_crossover',
  ]).optional(),
  threshold: z.string().min(1).optional(),
  deliveryMethod: z.enum(['in_app', 'email', 'webhook', 'push']).optional(),
  webhookUrl: z.string().url().nullable().optional(),
  message: z.string().max(500).nullable().optional(),
})

describe('alert router input validation', () => {
  describe('CreateAlertSchema', () => {
    it('accepts valid price alert input', () => {
      const result = CreateAlertSchema.safeParse({
        symbol: 'AAPL',
        conditionType: 'price_above',
        threshold: '150.00',
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.symbol).toBe('AAPL')
        expect(result.data.conditionType).toBe('price_above')
        expect(result.data.threshold).toBe('150.00')
        expect(result.data.deliveryMethod).toBe('in_app')
      }
    })

    it('uppercases the symbol', () => {
      const result = CreateAlertSchema.safeParse({
        symbol: 'aapl',
        conditionType: 'price_below',
        threshold: '100',
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.symbol).toBe('AAPL')
      }
    })

    it('accepts all condition types', () => {
      const conditionTypes = [
        'price_above', 'price_below', 'price_crossing_up', 'price_crossing_down',
        'volume_above', 'rvol_above', 'rsi_above', 'rsi_below',
        'macd_crossover', 'ma_crossover',
      ]
      for (const ct of conditionTypes) {
        const result = CreateAlertSchema.safeParse({
          symbol: 'SPY',
          conditionType: ct,
          threshold: '100',
        })
        expect(result.success).toBe(true)
      }
    })

    it('accepts all delivery methods', () => {
      const methods = ['in_app', 'email', 'webhook', 'push']
      for (const method of methods) {
        const result = CreateAlertSchema.safeParse({
          symbol: 'SPY',
          conditionType: 'price_above',
          threshold: '100',
          deliveryMethod: method,
        })
        expect(result.success).toBe(true)
      }
    })

    it('accepts optional webhook URL for webhook delivery', () => {
      const result = CreateAlertSchema.safeParse({
        symbol: 'TSLA',
        conditionType: 'price_above',
        threshold: '200',
        deliveryMethod: 'webhook',
        webhookUrl: 'https://example.com/hook',
      })
      expect(result.success).toBe(true)
    })

    it('accepts optional custom message', () => {
      const result = CreateAlertSchema.safeParse({
        symbol: 'MSFT',
        conditionType: 'rsi_above',
        threshold: '70',
        message: 'RSI overbought alert',
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.message).toBe('RSI overbought alert')
      }
    })

    it('rejects empty symbol', () => {
      const result = CreateAlertSchema.safeParse({
        symbol: '',
        conditionType: 'price_above',
        threshold: '100',
      })
      expect(result.success).toBe(false)
    })

    it('rejects symbol longer than 10 characters', () => {
      const result = CreateAlertSchema.safeParse({
        symbol: 'VERYLONGSYMBOL',
        conditionType: 'price_above',
        threshold: '100',
      })
      expect(result.success).toBe(false)
    })

    it('rejects invalid condition type', () => {
      const result = CreateAlertSchema.safeParse({
        symbol: 'AAPL',
        conditionType: 'invalid_condition',
        threshold: '100',
      })
      expect(result.success).toBe(false)
    })

    it('rejects empty threshold', () => {
      const result = CreateAlertSchema.safeParse({
        symbol: 'AAPL',
        conditionType: 'price_above',
        threshold: '',
      })
      expect(result.success).toBe(false)
    })

    it('rejects invalid delivery method', () => {
      const result = CreateAlertSchema.safeParse({
        symbol: 'AAPL',
        conditionType: 'price_above',
        threshold: '100',
        deliveryMethod: 'sms',
      })
      expect(result.success).toBe(false)
    })

    it('rejects invalid webhook URL', () => {
      const result = CreateAlertSchema.safeParse({
        symbol: 'AAPL',
        conditionType: 'price_above',
        threshold: '100',
        webhookUrl: 'not-a-url',
      })
      expect(result.success).toBe(false)
    })

    it('rejects message longer than 500 characters', () => {
      const result = CreateAlertSchema.safeParse({
        symbol: 'AAPL',
        conditionType: 'price_above',
        threshold: '100',
        message: 'x'.repeat(501),
      })
      expect(result.success).toBe(false)
    })
  })

  describe('UpdateAlertSchema', () => {
    it('accepts valid update with UUID id', () => {
      const result = UpdateAlertSchema.safeParse({
        id: '550e8400-e29b-41d4-a716-446655440000',
        threshold: '200',
      })
      expect(result.success).toBe(true)
    })

    it('accepts partial updates', () => {
      const result = UpdateAlertSchema.safeParse({
        id: '550e8400-e29b-41d4-a716-446655440000',
        conditionType: 'price_below',
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.conditionType).toBe('price_below')
        expect(result.data.threshold).toBeUndefined()
      }
    })

    it('accepts null webhookUrl to clear it', () => {
      const result = UpdateAlertSchema.safeParse({
        id: '550e8400-e29b-41d4-a716-446655440000',
        webhookUrl: null,
      })
      expect(result.success).toBe(true)
    })

    it('rejects invalid UUID', () => {
      const result = UpdateAlertSchema.safeParse({
        id: 'not-a-uuid',
        threshold: '200',
      })
      expect(result.success).toBe(false)
    })

    it('rejects missing id', () => {
      const result = UpdateAlertSchema.safeParse({
        threshold: '200',
      })
      expect(result.success).toBe(false)
    })
  })
})
