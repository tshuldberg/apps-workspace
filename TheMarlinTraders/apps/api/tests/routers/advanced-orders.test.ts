import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import {
  TrailingStopOrderSchema,
  BracketOrderGroupSchema,
  ConditionalOrderSchema,
  SubmitTrailingStopSchema,
  SubmitBracketSchema,
  SubmitConditionalSchema,
  ModifyOrderSchema,
  OrderConditionSchema,
  OrderReferenceSchema,
} from '@marlin/shared'

// ── Trailing Stop Validation ─────────────────────────────────────────────

describe('TrailingStopOrderSchema', () => {
  it('accepts valid trailing stop with trailAmount', () => {
    const result = TrailingStopOrderSchema.safeParse({
      symbol: 'AAPL',
      side: 'sell',
      quantity: 100,
      trailAmount: 2.5,
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.symbol).toBe('AAPL')
      expect(result.data.trailAmount).toBe(2.5)
      expect(result.data.timeInForce).toBe('GTC')
    }
  })

  it('accepts valid trailing stop with trailPercent', () => {
    const result = TrailingStopOrderSchema.safeParse({
      symbol: 'msft',
      side: 'sell',
      quantity: 50,
      trailPercent: 0.05,
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.symbol).toBe('MSFT') // uppercased
      expect(result.data.trailPercent).toBe(0.05)
    }
  })

  it('accepts trailing stop with activationPrice', () => {
    const result = TrailingStopOrderSchema.safeParse({
      symbol: 'TSLA',
      side: 'sell',
      quantity: 25,
      trailAmount: 5,
      activationPrice: 250,
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.activationPrice).toBe(250)
    }
  })

  it('rejects trailing stop without trailAmount or trailPercent', () => {
    const result = TrailingStopOrderSchema.safeParse({
      symbol: 'AAPL',
      side: 'sell',
      quantity: 100,
    })
    expect(result.success).toBe(false)
  })

  it('rejects trailPercent > 1 (100%)', () => {
    const result = TrailingStopOrderSchema.safeParse({
      symbol: 'AAPL',
      side: 'sell',
      quantity: 100,
      trailPercent: 1.5,
    })
    expect(result.success).toBe(false)
  })

  it('rejects negative quantity', () => {
    const result = TrailingStopOrderSchema.safeParse({
      symbol: 'AAPL',
      side: 'sell',
      quantity: -10,
      trailAmount: 2,
    })
    expect(result.success).toBe(false)
  })

  it('rejects empty symbol', () => {
    const result = TrailingStopOrderSchema.safeParse({
      symbol: '',
      side: 'sell',
      quantity: 100,
      trailAmount: 2,
    })
    expect(result.success).toBe(false)
  })

  it('accepts both trailAmount and trailPercent', () => {
    const result = TrailingStopOrderSchema.safeParse({
      symbol: 'SPY',
      side: 'sell',
      quantity: 100,
      trailAmount: 3,
      trailPercent: 0.02,
    })
    expect(result.success).toBe(true)
  })
})

// ── Submit Trailing Stop ─────────────────────────────────────────────────

describe('SubmitTrailingStopSchema', () => {
  it('accepts valid submission with portfolioId', () => {
    const result = SubmitTrailingStopSchema.safeParse({
      portfolioId: '550e8400-e29b-41d4-a716-446655440000',
      order: {
        symbol: 'AAPL',
        side: 'sell',
        quantity: 100,
        trailAmount: 2.5,
      },
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid portfolioId', () => {
    const result = SubmitTrailingStopSchema.safeParse({
      portfolioId: 'not-a-uuid',
      order: {
        symbol: 'AAPL',
        side: 'sell',
        quantity: 100,
        trailAmount: 2.5,
      },
    })
    expect(result.success).toBe(false)
  })
})

// ── Bracket Order Validation ─────────────────────────────────────────────

describe('BracketOrderGroupSchema', () => {
  const validBracket = {
    entryOrder: {
      symbol: 'AAPL',
      side: 'buy',
      type: 'limit',
      quantity: 100,
      limitPrice: 150,
      timeInForce: 'DAY',
    },
    takeProfitOrder: {
      symbol: 'AAPL',
      side: 'sell',
      type: 'limit',
      quantity: 100,
      limitPrice: 160,
      timeInForce: 'GTC',
    },
    stopLossOrder: {
      symbol: 'AAPL',
      side: 'sell',
      type: 'stop',
      quantity: 100,
      stopPrice: 145,
      timeInForce: 'GTC',
    },
    ocoGroupId: '550e8400-e29b-41d4-a716-446655440000',
  }

  it('accepts a valid bracket order', () => {
    const result = BracketOrderGroupSchema.safeParse(validBracket)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.entryOrder.symbol).toBe('AAPL')
      expect(result.data.ocoGroupId).toBe('550e8400-e29b-41d4-a716-446655440000')
    }
  })

  it('rejects bracket with invalid ocoGroupId', () => {
    const result = BracketOrderGroupSchema.safeParse({
      ...validBracket,
      ocoGroupId: 'not-a-uuid',
    })
    expect(result.success).toBe(false)
  })

  it('rejects bracket with missing entry order', () => {
    const result = BracketOrderGroupSchema.safeParse({
      takeProfitOrder: validBracket.takeProfitOrder,
      stopLossOrder: validBracket.stopLossOrder,
      ocoGroupId: validBracket.ocoGroupId,
    })
    expect(result.success).toBe(false)
  })

  it('rejects bracket with missing stop loss', () => {
    const result = BracketOrderGroupSchema.safeParse({
      entryOrder: validBracket.entryOrder,
      takeProfitOrder: validBracket.takeProfitOrder,
      ocoGroupId: validBracket.ocoGroupId,
    })
    expect(result.success).toBe(false)
  })

  it('uppercases symbols in all orders', () => {
    const result = BracketOrderGroupSchema.safeParse({
      ...validBracket,
      entryOrder: { ...validBracket.entryOrder, symbol: 'aapl' },
      takeProfitOrder: { ...validBracket.takeProfitOrder, symbol: 'aapl' },
      stopLossOrder: { ...validBracket.stopLossOrder, symbol: 'aapl' },
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.entryOrder.symbol).toBe('AAPL')
      expect(result.data.takeProfitOrder.symbol).toBe('AAPL')
      expect(result.data.stopLossOrder.symbol).toBe('AAPL')
    }
  })
})

// ── Conditional Order Validation ─────────────────────────────────────────

describe('ConditionalOrderSchema', () => {
  it('accepts valid price condition with numeric value', () => {
    const result = ConditionalOrderSchema.safeParse({
      condition: {
        type: 'price',
        symbol: 'AAPL',
        operator: 'gte',
        value: 200,
      },
      thenOrder: {
        symbol: 'AAPL',
        side: 'buy',
        type: 'market',
        quantity: 50,
      },
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.condition.type).toBe('price')
      expect(result.data.condition.value).toBe(200)
    }
  })

  it('accepts valid time condition with string value', () => {
    const result = ConditionalOrderSchema.safeParse({
      condition: {
        type: 'time',
        operator: 'gte',
        value: '2026-03-01T09:30:00Z',
      },
      thenOrder: {
        symbol: 'SPY',
        side: 'buy',
        type: 'limit',
        quantity: 100,
        limitPrice: 500,
      },
    })
    expect(result.success).toBe(true)
  })

  it('accepts indicator condition', () => {
    const result = ConditionalOrderSchema.safeParse({
      condition: {
        type: 'indicator',
        symbol: 'AAPL',
        operator: 'gt',
        value: 70,
      },
      thenOrder: {
        symbol: 'AAPL',
        side: 'sell',
        type: 'market',
        quantity: 25,
      },
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid operator', () => {
    const result = ConditionalOrderSchema.safeParse({
      condition: {
        type: 'price',
        operator: 'invalid',
        value: 200,
      },
      thenOrder: {
        symbol: 'AAPL',
        side: 'buy',
        type: 'market',
        quantity: 50,
      },
    })
    expect(result.success).toBe(false)
  })

  it('rejects missing thenOrder', () => {
    const result = ConditionalOrderSchema.safeParse({
      condition: {
        type: 'price',
        operator: 'gte',
        value: 200,
      },
    })
    expect(result.success).toBe(false)
  })

  it('accepts all valid operators', () => {
    const operators = ['gt', 'lt', 'eq', 'gte', 'lte']
    for (const op of operators) {
      const result = OrderConditionSchema.safeParse({
        type: 'price',
        operator: op,
        value: 100,
      })
      expect(result.success).toBe(true)
    }
  })
})

// ── Submit Conditional ─────────────────────────────────────────────────

describe('SubmitConditionalSchema', () => {
  it('accepts valid submission', () => {
    const result = SubmitConditionalSchema.safeParse({
      portfolioId: '550e8400-e29b-41d4-a716-446655440000',
      conditional: {
        condition: {
          type: 'price',
          operator: 'gte',
          value: 200,
        },
        thenOrder: {
          symbol: 'AAPL',
          side: 'buy',
          type: 'market',
          quantity: 50,
        },
      },
    })
    expect(result.success).toBe(true)
  })
})

// ── Modify Order Validation ──────────────────────────────────────────────

describe('ModifyOrderSchema', () => {
  it('accepts modification with new price', () => {
    const result = ModifyOrderSchema.safeParse({
      orderId: '550e8400-e29b-41d4-a716-446655440000',
      newPrice: 155.5,
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.newPrice).toBe(155.5)
      expect(result.data.newQuantity).toBeUndefined()
    }
  })

  it('accepts modification with new quantity', () => {
    const result = ModifyOrderSchema.safeParse({
      orderId: '550e8400-e29b-41d4-a716-446655440000',
      newQuantity: 200,
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.newQuantity).toBe(200)
    }
  })

  it('accepts modification with new stop price', () => {
    const result = ModifyOrderSchema.safeParse({
      orderId: '550e8400-e29b-41d4-a716-446655440000',
      newStopPrice: 145,
    })
    expect(result.success).toBe(true)
  })

  it('accepts modification with multiple fields', () => {
    const result = ModifyOrderSchema.safeParse({
      orderId: '550e8400-e29b-41d4-a716-446655440000',
      newPrice: 155,
      newQuantity: 200,
      newStopPrice: 145,
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid orderId', () => {
    const result = ModifyOrderSchema.safeParse({
      orderId: 'not-a-uuid',
      newPrice: 155,
    })
    expect(result.success).toBe(false)
  })

  it('rejects negative new price', () => {
    const result = ModifyOrderSchema.safeParse({
      orderId: '550e8400-e29b-41d4-a716-446655440000',
      newPrice: -10,
    })
    expect(result.success).toBe(false)
  })

  it('rejects non-integer new quantity', () => {
    const result = ModifyOrderSchema.safeParse({
      orderId: '550e8400-e29b-41d4-a716-446655440000',
      newQuantity: 10.5,
    })
    expect(result.success).toBe(false)
  })

  it('accepts orderId with no modifications (validation passes, router rejects)', () => {
    const result = ModifyOrderSchema.safeParse({
      orderId: '550e8400-e29b-41d4-a716-446655440000',
    })
    // Schema allows it — the router enforces at least one modification
    expect(result.success).toBe(true)
  })
})

// ── Order Reference Validation ───────────────────────────────────────────

describe('OrderReferenceSchema', () => {
  it('accepts all valid order types', () => {
    const types = ['market', 'limit', 'stop', 'stop_limit', 'trailing_stop']
    for (const type of types) {
      const result = OrderReferenceSchema.safeParse({
        symbol: 'SPY',
        side: 'buy',
        type,
        quantity: 100,
      })
      expect(result.success).toBe(true)
    }
  })

  it('defaults timeInForce to DAY', () => {
    const result = OrderReferenceSchema.safeParse({
      symbol: 'AAPL',
      side: 'buy',
      type: 'limit',
      quantity: 100,
      limitPrice: 150,
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.timeInForce).toBe('DAY')
    }
  })

  it('accepts all valid timeInForce values', () => {
    const tifs = ['DAY', 'GTC', 'IOC', 'FOK', 'GTD', 'OPG', 'CLS']
    for (const tif of tifs) {
      const result = OrderReferenceSchema.safeParse({
        symbol: 'SPY',
        side: 'buy',
        type: 'market',
        quantity: 100,
        timeInForce: tif,
      })
      expect(result.success).toBe(true)
    }
  })

  it('rejects zero quantity', () => {
    const result = OrderReferenceSchema.safeParse({
      symbol: 'SPY',
      side: 'buy',
      type: 'market',
      quantity: 0,
    })
    expect(result.success).toBe(false)
  })
})
