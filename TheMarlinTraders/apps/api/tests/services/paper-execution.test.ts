import { describe, it, expect } from 'vitest'
import { PaperExecutionEngine } from '../../src/services/paper-execution.js'
import type { Quote } from '../../src/services/paper-execution.js'

function makeOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: 'order-1',
    portfolioId: 'portfolio-1',
    symbol: 'AAPL',
    side: 'buy' as const,
    type: 'market' as const,
    quantity: 100,
    limitPrice: null,
    stopPrice: null,
    status: 'pending' as const,
    filledAt: null,
    filledPrice: null,
    filledQuantity: 0,
    createdAt: new Date(),
    ...overrides,
  }
}

const QUOTE: Quote = { bid: 149.50, ask: 150.50, last: 150.00 }

describe('PaperExecutionEngine', () => {
  const engine = new PaperExecutionEngine()

  describe('market orders', () => {
    it('fills buy market order at ask price', () => {
      const order = makeOrder({ side: 'buy', type: 'market' })
      const result = engine.tryFill(order, QUOTE)
      expect(result.filled).toBe(true)
      expect(result.price).toBe(150.50) // ask
      expect(result.quantity).toBe(100)
    })

    it('fills sell market order at bid price', () => {
      const order = makeOrder({ side: 'sell', type: 'market' })
      const result = engine.tryFill(order, QUOTE)
      expect(result.filled).toBe(true)
      expect(result.price).toBe(149.50) // bid
      expect(result.quantity).toBe(100)
    })

    it('does not fill at midpoint', () => {
      const order = makeOrder({ side: 'buy', type: 'market' })
      const result = engine.tryFill(order, QUOTE)
      expect(result.price).not.toBe(150.00)
    })
  })

  describe('limit orders', () => {
    it('fills buy limit when ask <= limit price', () => {
      const order = makeOrder({
        side: 'buy',
        type: 'limit',
        limitPrice: '151.00',
      })
      const result = engine.tryFill(order, QUOTE)
      expect(result.filled).toBe(true)
      expect(result.price).toBe(151.00)
    })

    it('does not fill buy limit when ask > limit price', () => {
      const order = makeOrder({
        side: 'buy',
        type: 'limit',
        limitPrice: '149.00',
      })
      const result = engine.tryFill(order, QUOTE)
      expect(result.filled).toBe(false)
    })

    it('fills sell limit when bid >= limit price', () => {
      const order = makeOrder({
        side: 'sell',
        type: 'limit',
        limitPrice: '149.00',
      })
      const result = engine.tryFill(order, QUOTE)
      expect(result.filled).toBe(true)
      expect(result.price).toBe(149.00)
    })

    it('does not fill sell limit when bid < limit price', () => {
      const order = makeOrder({
        side: 'sell',
        type: 'limit',
        limitPrice: '151.00',
      })
      const result = engine.tryFill(order, QUOTE)
      expect(result.filled).toBe(false)
    })

    it('rejects limit order with no limit price', () => {
      const order = makeOrder({ type: 'limit', limitPrice: null })
      const result = engine.tryFill(order, QUOTE)
      expect(result.filled).toBe(false)
    })
  })

  describe('stop orders', () => {
    it('triggers buy stop when last price >= stop price', () => {
      const order = makeOrder({
        side: 'buy',
        type: 'stop',
        stopPrice: '150.00',
      })
      const result = engine.tryFill(order, QUOTE)
      expect(result.filled).toBe(true)
      expect(result.price).toBe(150.50) // fills at ask
    })

    it('does not trigger buy stop when last < stop price', () => {
      const order = makeOrder({
        side: 'buy',
        type: 'stop',
        stopPrice: '155.00',
      })
      const result = engine.tryFill(order, QUOTE)
      expect(result.filled).toBe(false)
    })

    it('triggers sell stop when last price <= stop price', () => {
      const order = makeOrder({
        side: 'sell',
        type: 'stop',
        stopPrice: '150.00',
      })
      const result = engine.tryFill(order, QUOTE)
      expect(result.filled).toBe(true)
      expect(result.price).toBe(149.50) // fills at bid
    })

    it('does not trigger sell stop when last > stop price', () => {
      const order = makeOrder({
        side: 'sell',
        type: 'stop',
        stopPrice: '145.00',
      })
      const result = engine.tryFill(order, QUOTE)
      expect(result.filled).toBe(false)
    })
  })

  describe('partially filled orders', () => {
    it('calculates remaining quantity from filled quantity', () => {
      const order = makeOrder({
        quantity: 100,
        filledQuantity: 60,
        type: 'market',
      })
      const result = engine.tryFill(order, QUOTE)
      expect(result.filled).toBe(true)
      expect(result.quantity).toBe(40)
    })

    it('returns not filled when fully filled', () => {
      const order = makeOrder({
        quantity: 100,
        filledQuantity: 100,
        type: 'market',
      })
      const result = engine.tryFill(order, QUOTE)
      expect(result.filled).toBe(false)
    })
  })

  describe('validation', () => {
    it('validates sufficient buying power', () => {
      expect(engine.validateBuyingPower(100000, 150, 100)).toBe(true)
      expect(engine.validateBuyingPower(10000, 150, 100)).toBe(false)
    })

    it('validates sufficient shares for sell', () => {
      expect(engine.validateSellQuantity(100, 50)).toBe(true)
      expect(engine.validateSellQuantity(50, 100)).toBe(false)
    })
  })
})
