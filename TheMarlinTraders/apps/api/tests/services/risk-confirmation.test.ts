import { describe, it, expect } from 'vitest'
import { RiskConfirmationService } from '../../src/services/risk-confirmation.js'
import type {
  BrokerAccount,
  BrokerOrder,
  BrokerPosition,
} from '../../src/adapters/broker/broker.interface.js'

// ── Fixtures ───────────────────────────────────────────────

function makeAccount(overrides: Partial<BrokerAccount> = {}): BrokerAccount {
  return {
    accountId: 'acc-1',
    status: 'active',
    currency: 'USD',
    cashBalance: 50000,
    buyingPower: 100000,
    portfolioValue: 100000,
    equity: 100000,
    multiplier: 2,
    daytradeCount: 0,
    patternDayTrader: false,
    lastEquity: 100000,
    createdAt: '2024-01-01T00:00:00Z',
    ...overrides,
  }
}

function makeOrder(overrides: Partial<BrokerOrder> = {}): BrokerOrder {
  return {
    symbol: 'AAPL',
    side: 'buy',
    type: 'limit',
    quantity: 10,
    limitPrice: 175,
    timeInForce: 'day',
    ...overrides,
  }
}

function makePosition(overrides: Partial<BrokerPosition> = {}): BrokerPosition {
  return {
    symbol: 'AAPL',
    quantity: 100,
    side: 'long',
    avgEntryPrice: 170,
    currentPrice: 175,
    marketValue: 17500,
    costBasis: 17000,
    unrealizedPnL: 500,
    unrealizedPnLPercent: 2.94,
    changeToday: 1.2,
    ...overrides,
  }
}

// ── Tests ──────────────────────────────────────────────────

describe('RiskConfirmationService', () => {
  describe('buying power validation', () => {
    it('approves order when sufficient buying power', () => {
      const service = new RiskConfirmationService()
      const order = makeOrder({ quantity: 10, limitPrice: 175 }) // $1,750
      const account = makeAccount({ buyingPower: 100000 })

      const result = service.check(order, account, [], 0, 0)

      expect(result.approved).toBe(true)
      expect(result.blocked).toBe(false)
      expect(result.level).toBe('low')
    })

    it('blocks order when insufficient buying power', () => {
      const service = new RiskConfirmationService()
      const order = makeOrder({ quantity: 1000, limitPrice: 175 }) // $175,000
      const account = makeAccount({ buyingPower: 100000 })

      const result = service.check(order, account, [], 0, 0)

      expect(result.approved).toBe(false)
      expect(result.blocked).toBe(true)
      expect(result.blockReason).toContain('Insufficient buying power')
    })

    it('warns when buying power drops below cushion threshold', () => {
      const service = new RiskConfirmationService({ minBuyingPowerPercent: 10 })
      // Order costs $90,000 out of $100,000 buying power, leaving 10% of $100k portfolio
      const order = makeOrder({ quantity: 600, limitPrice: 150 }) // $90,000
      const account = makeAccount({ buyingPower: 100000, portfolioValue: 100000 })

      const result = service.check(order, account, [], 0, 0)

      expect(result.approved).toBe(true)
      expect(result.level).toBe('medium')
      expect(result.warnings.length).toBeGreaterThan(0)
      expect(result.warnings[0]).toContain('buying power')
    })

    it('does not check buying power for sell orders', () => {
      const service = new RiskConfirmationService()
      const order = makeOrder({ side: 'sell', quantity: 100, limitPrice: 175 })
      const account = makeAccount({ buyingPower: 0 })

      const result = service.check(order, account, [], 0, 0)

      // Sell orders don't require buying power
      expect(result.blockReason).not.toContain('Insufficient buying power')
    })
  })

  describe('position size limits', () => {
    it('approves order within position size limit', () => {
      const service = new RiskConfirmationService({ maxPositionSizePercent: 25 })
      const order = makeOrder({ quantity: 10, limitPrice: 175 }) // $1,750 = 1.75%
      const account = makeAccount({ portfolioValue: 100000 })

      const result = service.check(order, account, [], 0, 0)

      expect(result.approved).toBe(true)
      expect(result.level).toBe('low')
    })

    it('warns when position exceeds soft limit', () => {
      const service = new RiskConfirmationService({ maxPositionSizePercent: 10 })
      const order = makeOrder({ quantity: 100, limitPrice: 175 }) // $17,500 = 17.5%
      const account = makeAccount({ portfolioValue: 100000 })

      const result = service.check(order, account, [], 0, 0)

      expect(result.level).toBe('medium')
      expect(result.warnings.some((w) => w.includes('portfolio'))).toBe(true)
    })

    it('blocks when total exposure exceeds hard limit (1.5x soft)', () => {
      const service = new RiskConfirmationService({ maxPositionSizePercent: 10 })
      // Existing position: $17,500 + new order: $17,500 = $35,000 = 35% > 15% hard limit
      const order = makeOrder({ quantity: 100, limitPrice: 175 }) // $17,500
      const account = makeAccount({ portfolioValue: 100000 })
      const positions = [makePosition({ symbol: 'AAPL', marketValue: 17500 })]

      const result = service.check(order, account, positions, 0, 0)

      expect(result.blocked).toBe(true)
      expect(result.blockReason).toContain('hard limit')
    })

    it('considers existing positions in same symbol', () => {
      const service = new RiskConfirmationService({ maxPositionSizePercent: 20 })
      // Existing: $15,000 + new: $8,750 = $23,750 = 23.75% > 20%
      const order = makeOrder({ quantity: 50, limitPrice: 175 }) // $8,750
      const account = makeAccount({ portfolioValue: 100000 })
      const positions = [makePosition({ symbol: 'AAPL', marketValue: 15000 })]

      const result = service.check(order, account, positions, 0, 0)

      // Total exposure exceeds soft limit but is within hard limit (1.5x = 30%)
      expect(result.approved).toBe(true)
      expect(result.level).toBe('medium')
    })
  })

  describe('daily loss limit', () => {
    it('approves when no daily loss', () => {
      const service = new RiskConfirmationService({ dailyLossLimitPercent: 5 })
      const order = makeOrder()
      const account = makeAccount({ portfolioValue: 100000 })

      const result = service.check(order, account, [], 0, 0)

      expect(result.approved).toBe(true)
    })

    it('blocks when daily loss limit exceeded', () => {
      const service = new RiskConfirmationService({ dailyLossLimitPercent: 5 })
      const order = makeOrder()
      const account = makeAccount({ portfolioValue: 100000 })
      const dailyPnL = -5500 // $5,500 loss > 5% of $100k

      const result = service.check(order, account, [], 0, dailyPnL)

      expect(result.blocked).toBe(true)
      expect(result.blockReason).toContain('Daily loss limit')
    })

    it('warns when approaching daily loss limit (80%)', () => {
      const service = new RiskConfirmationService({ dailyLossLimitPercent: 5 })
      const order = makeOrder()
      const account = makeAccount({ portfolioValue: 100000 })
      const dailyPnL = -4200 // $4,200 loss = 84% of $5k limit

      const result = service.check(order, account, [], 0, dailyPnL)

      expect(result.approved).toBe(true)
      expect(result.level).toBe('medium')
      expect(result.warnings.some((w) => w.includes('daily loss'))).toBe(true)
    })

    it('ignores positive daily P&L', () => {
      const service = new RiskConfirmationService({ dailyLossLimitPercent: 5 })
      const order = makeOrder()
      const account = makeAccount({ portfolioValue: 100000 })
      const dailyPnL = 3000 // Profitable day

      const result = service.check(order, account, [], 0, dailyPnL)

      expect(result.approved).toBe(true)
      expect(result.level).toBe('low')
    })
  })

  describe('max open orders', () => {
    it('approves when under open order limit', () => {
      const service = new RiskConfirmationService({ maxOpenOrders: 20 })
      const order = makeOrder()
      const account = makeAccount()

      const result = service.check(order, account, [], 10, 0)

      expect(result.approved).toBe(true)
    })

    it('blocks when max open orders reached', () => {
      const service = new RiskConfirmationService({ maxOpenOrders: 20 })
      const order = makeOrder()
      const account = makeAccount()

      const result = service.check(order, account, [], 20, 0)

      expect(result.blocked).toBe(true)
      expect(result.blockReason).toContain('Maximum open orders')
    })

    it('warns when approaching max open orders (80%)', () => {
      const service = new RiskConfirmationService({ maxOpenOrders: 20 })
      const order = makeOrder()
      const account = makeAccount()

      const result = service.check(order, account, [], 17, 0)

      expect(result.approved).toBe(true)
      expect(result.level).toBe('medium')
      expect(result.warnings.some((w) => w.includes('open orders'))).toBe(true)
    })
  })

  describe('risk level determination', () => {
    it('returns low when all checks pass cleanly', () => {
      const service = new RiskConfirmationService()
      const order = makeOrder({ quantity: 1, limitPrice: 175 })
      const account = makeAccount()

      const result = service.check(order, account, [], 0, 0)

      expect(result.level).toBe('low')
      expect(result.warnings).toHaveLength(0)
    })

    it('returns medium when warnings exist but not blocked', () => {
      const service = new RiskConfirmationService({ maxPositionSizePercent: 5 })
      const order = makeOrder({ quantity: 50, limitPrice: 175 }) // $8,750 = 8.75%
      const account = makeAccount({ portfolioValue: 100000 })

      const result = service.check(order, account, [], 0, 0)

      expect(result.level).toBe('medium')
      expect(result.approved).toBe(true)
    })

    it('returns high when blocked', () => {
      const service = new RiskConfirmationService()
      const order = makeOrder({ quantity: 10000, limitPrice: 175 }) // $1,750,000
      const account = makeAccount({ buyingPower: 100000 })

      const result = service.check(order, account, [], 0, 0)

      expect(result.level).toBe('high')
      expect(result.approved).toBe(false)
    })
  })

  describe('estimateOrderCost', () => {
    it('uses limit price for limit orders', () => {
      const service = new RiskConfirmationService()
      const order = makeOrder({ type: 'limit', quantity: 10, limitPrice: 175 })

      expect(service.estimateOrderCost(order)).toBe(1750)
    })

    it('uses stop price when no limit price', () => {
      const service = new RiskConfirmationService()
      const order = makeOrder({
        type: 'stop',
        quantity: 10,
        limitPrice: undefined,
        stopPrice: 170,
      })

      expect(service.estimateOrderCost(order)).toBe(1700)
    })

    it('returns 0 for market orders without price estimate', () => {
      const service = new RiskConfirmationService()
      const order = makeOrder({
        type: 'market',
        quantity: 10,
        limitPrice: undefined,
        stopPrice: undefined,
      })

      expect(service.estimateOrderCost(order)).toBe(0)
    })
  })

  describe('preference management', () => {
    it('uses default preferences', () => {
      const service = new RiskConfirmationService()
      const prefs = service.getPreferences()

      expect(prefs.maxPositionSizePercent).toBe(25)
      expect(prefs.maxOpenOrders).toBe(20)
      expect(prefs.dailyLossLimitPercent).toBe(5)
      expect(prefs.minBuyingPowerPercent).toBe(10)
    })

    it('allows custom preferences on construction', () => {
      const service = new RiskConfirmationService({
        maxPositionSizePercent: 50,
        maxOpenOrders: 10,
      })
      const prefs = service.getPreferences()

      expect(prefs.maxPositionSizePercent).toBe(50)
      expect(prefs.maxOpenOrders).toBe(10)
      expect(prefs.dailyLossLimitPercent).toBe(5) // default
    })

    it('allows updating preferences', () => {
      const service = new RiskConfirmationService()
      service.updatePreferences({ maxOpenOrders: 50 })
      const prefs = service.getPreferences()

      expect(prefs.maxOpenOrders).toBe(50)
      expect(prefs.maxPositionSizePercent).toBe(25) // unchanged
    })
  })
})
