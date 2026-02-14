import { describe, it, expect } from 'vitest'
import {
  ibkrBracketOrderSchema,
  ibkrOCAOrderSchema,
  ibkrConditionalOrderSchema,
  ibkrAdaptiveAlgoSchema,
  ibkrContractSchema,
  calculateRiskReward,
  generateOCAGroupId,
} from '../../src/orders/ibkr-order-types.js'

describe('IBKR Order Type Schemas', () => {
  describe('ibkrContractSchema', () => {
    it('validates a valid stock contract', () => {
      const result = ibkrContractSchema.safeParse({
        conid: 265598,
        symbol: 'AAPL',
        secType: 'STK',
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.exchange).toBe('SMART')
        expect(result.data.currency).toBe('USD')
      }
    })

    it('validates a valid options contract', () => {
      const result = ibkrContractSchema.safeParse({
        conid: 999888,
        symbol: 'AAPL',
        secType: 'OPT',
        lastTradeDateOrContractMonth: '20240119',
        strike: 175,
        right: 'C',
        multiplier: '100',
      })
      expect(result.success).toBe(true)
    })

    it('rejects invalid conid', () => {
      const result = ibkrContractSchema.safeParse({
        conid: -1,
        symbol: 'AAPL',
        secType: 'STK',
      })
      expect(result.success).toBe(false)
    })

    it('rejects empty symbol', () => {
      const result = ibkrContractSchema.safeParse({
        conid: 265598,
        symbol: '',
        secType: 'STK',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('ibkrBracketOrderSchema', () => {
    it('validates a complete bracket order', () => {
      const result = ibkrBracketOrderSchema.safeParse({
        entry: {
          conid: 265598,
          action: 'BUY',
          orderType: 'LMT',
          quantity: 100,
          limitPrice: 175,
          timeInForce: 'DAY',
        },
        profitTarget: {
          limitPrice: 190,
        },
        stopLoss: {
          stopPrice: 165,
        },
      })
      expect(result.success).toBe(true)
    })

    it('validates bracket order with percentage targets', () => {
      const result = ibkrBracketOrderSchema.safeParse({
        entry: {
          conid: 265598,
          action: 'BUY',
          orderType: 'MKT',
          quantity: 50,
        },
        profitTarget: {
          limitPrice: 190,
          percentFromEntry: 5,
        },
        stopLoss: {
          stopPrice: 165,
          percentFromEntry: 3,
        },
      })
      expect(result.success).toBe(true)
    })

    it('validates bracket order with trailing stop', () => {
      const result = ibkrBracketOrderSchema.safeParse({
        entry: {
          conid: 265598,
          action: 'BUY',
          orderType: 'LMT',
          quantity: 100,
          limitPrice: 175,
        },
        profitTarget: {
          limitPrice: 190,
        },
        stopLoss: {
          stopPrice: 165,
          trailingAmount: 2,
          trailingType: 'percent',
        },
      })
      expect(result.success).toBe(true)
    })

    it('rejects zero quantity', () => {
      const result = ibkrBracketOrderSchema.safeParse({
        entry: {
          conid: 265598,
          action: 'BUY',
          orderType: 'LMT',
          quantity: 0,
          limitPrice: 175,
        },
        profitTarget: { limitPrice: 190 },
        stopLoss: { stopPrice: 165 },
      })
      expect(result.success).toBe(false)
    })
  })

  describe('ibkrOCAOrderSchema', () => {
    it('validates a valid OCA group with 2 orders', () => {
      const result = ibkrOCAOrderSchema.safeParse({
        ocaGroup: 'oca_user1_abc123',
        ocaType: 1,
        orders: [
          {
            conid: 265598,
            action: 'BUY',
            orderType: 'LMT',
            quantity: 100,
            limitPrice: 170,
          },
          {
            conid: 265598,
            action: 'BUY',
            orderType: 'STP',
            quantity: 100,
            stopPrice: 180,
          },
        ],
      })
      expect(result.success).toBe(true)
    })

    it('rejects OCA group with fewer than 2 orders', () => {
      const result = ibkrOCAOrderSchema.safeParse({
        ocaGroup: 'oca_test',
        ocaType: 1,
        orders: [
          {
            conid: 265598,
            action: 'BUY',
            orderType: 'LMT',
            quantity: 100,
            limitPrice: 170,
          },
        ],
      })
      expect(result.success).toBe(false)
    })

    it('rejects invalid OCA type', () => {
      const result = ibkrOCAOrderSchema.safeParse({
        ocaGroup: 'oca_test',
        ocaType: 5,
        orders: [
          { conid: 265598, action: 'BUY', orderType: 'LMT', quantity: 100, limitPrice: 170 },
          { conid: 265598, action: 'BUY', orderType: 'STP', quantity: 100, stopPrice: 180 },
        ],
      })
      expect(result.success).toBe(false)
    })
  })

  describe('ibkrConditionalOrderSchema', () => {
    it('validates a price-conditional order', () => {
      const result = ibkrConditionalOrderSchema.safeParse({
        conditions: [
          {
            type: 'price',
            conid: 265598,
            operator: '>=',
            value: 180,
          },
        ],
        conditionsLogic: 'AND',
        order: {
          conid: 265598,
          action: 'BUY',
          orderType: 'LMT',
          quantity: 100,
          limitPrice: 180,
        },
      })
      expect(result.success).toBe(true)
    })

    it('validates a time-conditional order', () => {
      const result = ibkrConditionalOrderSchema.safeParse({
        conditions: [
          {
            type: 'time',
            triggerAfter: '2024-01-19T14:30:00Z',
          },
        ],
        order: {
          conid: 265598,
          action: 'SELL',
          orderType: 'MKT',
          quantity: 50,
        },
      })
      expect(result.success).toBe(true)
    })

    it('validates a margin-conditional order', () => {
      const result = ibkrConditionalOrderSchema.safeParse({
        conditions: [
          {
            type: 'margin',
            cushionPercent: 25,
            operator: '>=',
          },
        ],
        order: {
          conid: 265598,
          action: 'BUY',
          orderType: 'LMT',
          quantity: 100,
          limitPrice: 175,
        },
      })
      expect(result.success).toBe(true)
    })

    it('validates multi-condition with OR logic', () => {
      const result = ibkrConditionalOrderSchema.safeParse({
        conditions: [
          { type: 'price', conid: 265598, operator: '>=', value: 180 },
          { type: 'time', triggerAfter: '2024-01-19T14:30:00Z' },
        ],
        conditionsLogic: 'OR',
        order: {
          conid: 265598,
          action: 'BUY',
          orderType: 'MKT',
          quantity: 100,
        },
      })
      expect(result.success).toBe(true)
    })

    it('rejects conditional order with no conditions', () => {
      const result = ibkrConditionalOrderSchema.safeParse({
        conditions: [],
        order: {
          conid: 265598,
          action: 'BUY',
          orderType: 'MKT',
          quantity: 100,
        },
      })
      expect(result.success).toBe(false)
    })
  })

  describe('ibkrAdaptiveAlgoSchema', () => {
    it('validates an adaptive algo order', () => {
      const result = ibkrAdaptiveAlgoSchema.safeParse({
        conid: 265598,
        action: 'BUY',
        quantity: 100,
        priority: 'Normal',
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.timeInForce).toBe('DAY')
      }
    })

    it('validates with time bounds', () => {
      const result = ibkrAdaptiveAlgoSchema.safeParse({
        conid: 265598,
        action: 'SELL',
        quantity: 50,
        priority: 'Patient',
        startTime: '09:30:00',
        endTime: '12:00:00',
        timeInForce: 'DAY',
      })
      expect(result.success).toBe(true)
    })
  })
})

describe('calculateRiskReward', () => {
  it('calculates risk:reward for a long position', () => {
    const result = calculateRiskReward(175, 190, 165, 'BUY')
    expect(result).not.toBeNull()
    expect(result!.riskAmount).toBe(10) // 175 - 165
    expect(result!.rewardAmount).toBe(15) // 190 - 175
    expect(result!.ratio).toBe(1.5)
  })

  it('calculates risk:reward for a short position', () => {
    const result = calculateRiskReward(175, 160, 185, 'SELL')
    expect(result).not.toBeNull()
    expect(result!.riskAmount).toBe(10) // 185 - 175
    expect(result!.rewardAmount).toBe(15) // 175 - 160
    expect(result!.ratio).toBe(1.5)
  })

  it('returns null for zero entry price', () => {
    expect(calculateRiskReward(0, 190, 165, 'BUY')).toBeNull()
  })

  it('returns null for invalid stop (above entry for BUY)', () => {
    expect(calculateRiskReward(175, 190, 180, 'BUY')).toBeNull()
  })

  it('returns null for invalid target (below entry for BUY)', () => {
    expect(calculateRiskReward(175, 170, 165, 'BUY')).toBeNull()
  })
})

describe('generateOCAGroupId', () => {
  it('generates a unique OCA group ID', () => {
    const id1 = generateOCAGroupId('user1')
    const id2 = generateOCAGroupId('user1')
    expect(id1).toMatch(/^oca_user1_/)
    expect(id1).not.toBe(id2)
  })

  it('includes the user ID', () => {
    const id = generateOCAGroupId('user123')
    expect(id).toContain('user123')
  })
})
