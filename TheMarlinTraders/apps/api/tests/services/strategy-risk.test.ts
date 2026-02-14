import { describe, it, expect } from 'vitest'
import { RiskManager, DailyPnLTracker } from '../../src/services/strategy-risk.js'
import type {
  RiskConfig,
  PortfolioSnapshot,
  OrderToCheck,
  PositionSnapshot,
} from '../../src/services/strategy-risk.js'

// ── Fixtures ───────────────────────────────────────────────

function makePortfolio(overrides: Partial<PortfolioSnapshot> = {}): PortfolioSnapshot {
  return {
    equity: 100_000,
    positions: [],
    ...overrides,
  }
}

function makeOrder(overrides: Partial<OrderToCheck> = {}): OrderToCheck {
  return {
    symbol: 'AAPL',
    side: 'buy',
    quantity: 10,
    price: 175,
    ...overrides,
  }
}

function makePosition(overrides: Partial<PositionSnapshot> = {}): PositionSnapshot {
  return {
    symbol: 'AAPL',
    quantity: 100,
    currentPrice: 175,
    marketValue: 17_500,
    ...overrides,
  }
}

// ── Tests ──────────────────────────────────────────────────

describe('RiskManager', () => {
  describe('checkOrder — basic approval', () => {
    it('allows an order within all limits', () => {
      const rm = new RiskManager()
      const order = makeOrder({ quantity: 10, price: 175 }) // $1,750
      const portfolio = makePortfolio({ equity: 100_000 })

      const result = rm.checkOrder(order, portfolio)

      expect(result.allowed).toBe(true)
      expect(result.reason).toBeUndefined()
    })

    it('allows sell orders without position size check', () => {
      const rm = new RiskManager({ maxPositionSizePercent: 1 })
      const order = makeOrder({ side: 'sell', quantity: 100, price: 175 }) // $17,500 sell
      const portfolio = makePortfolio({ equity: 100_000 })

      const result = rm.checkOrder(order, portfolio)

      expect(result.allowed).toBe(true)
    })
  })

  describe('checkOrder — max position size', () => {
    it('blocks order that would exceed max position size', () => {
      const rm = new RiskManager({ maxPositionSizePercent: 10 })
      // Order: 100 * $175 = $17,500 = 17.5% of $100k equity
      const order = makeOrder({ quantity: 100, price: 175 })
      const portfolio = makePortfolio({ equity: 100_000 })

      const result = rm.checkOrder(order, portfolio)

      expect(result.allowed).toBe(false)
      expect(result.reason).toContain('Position in AAPL')
      expect(result.reason).toContain('exceeding max 10%')
    })

    it('blocks order when existing position + new order exceeds limit', () => {
      const rm = new RiskManager({ maxPositionSizePercent: 15 })
      // Existing: $10,000 (10%), new: $8,750 (8.75%), total: $18,750 (18.75%)
      const order = makeOrder({ quantity: 50, price: 175 })
      const portfolio = makePortfolio({
        equity: 100_000,
        positions: [makePosition({ symbol: 'AAPL', marketValue: 10_000 })],
      })

      const result = rm.checkOrder(order, portfolio)

      expect(result.allowed).toBe(false)
      expect(result.reason).toContain('AAPL')
      expect(result.reason).toContain('15%')
    })

    it('allows order when position is within limits', () => {
      const rm = new RiskManager({ maxPositionSizePercent: 20 })
      // Order: 10 * $175 = $1,750 = 1.75% of $100k
      const order = makeOrder({ quantity: 10, price: 175 })
      const portfolio = makePortfolio({ equity: 100_000 })

      const result = rm.checkOrder(order, portfolio)

      expect(result.allowed).toBe(true)
    })

    it('allows custom per-check config override', () => {
      const rm = new RiskManager({ maxPositionSizePercent: 50 }) // Lenient default
      const order = makeOrder({ quantity: 100, price: 175 }) // $17,500 = 17.5%
      const portfolio = makePortfolio({ equity: 100_000 })

      // Override with strict config for this check
      const result = rm.checkOrder(order, portfolio, { maxPositionSizePercent: 10 })

      expect(result.allowed).toBe(false)
      expect(result.reason).toContain('10%')
    })
  })

  describe('checkOrder — max total exposure', () => {
    it('blocks order that would exceed total exposure limit', () => {
      const rm = new RiskManager({ maxTotalExposurePercent: 80 })
      // Existing exposure: $75,000 (75%), new order: $10,000 (10%), total: 85%
      const order = makeOrder({ quantity: 100, price: 100 }) // $10,000
      const portfolio = makePortfolio({
        equity: 100_000,
        positions: [
          makePosition({ symbol: 'MSFT', marketValue: 40_000 }),
          makePosition({ symbol: 'GOOGL', marketValue: 35_000 }),
        ],
      })

      const result = rm.checkOrder(order, portfolio)

      expect(result.allowed).toBe(false)
      expect(result.reason).toContain('Total exposure')
      expect(result.reason).toContain('80%')
    })

    it('allows order within total exposure limit', () => {
      const rm = new RiskManager({ maxTotalExposurePercent: 100 })
      const order = makeOrder({ quantity: 10, price: 175 }) // $1,750
      const portfolio = makePortfolio({
        equity: 100_000,
        positions: [makePosition({ symbol: 'MSFT', marketValue: 30_000 })],
      })

      const result = rm.checkOrder(order, portfolio)

      expect(result.allowed).toBe(true)
    })

    it('does not increase exposure for sell orders', () => {
      const rm = new RiskManager({ maxTotalExposurePercent: 50 })
      // Existing: $48,000 (48%), selling doesn't add exposure
      const order = makeOrder({ side: 'sell', quantity: 50, price: 175 })
      const portfolio = makePortfolio({
        equity: 100_000,
        positions: [makePosition({ symbol: 'AAPL', marketValue: 48_000 })],
      })

      const result = rm.checkOrder(order, portfolio)

      expect(result.allowed).toBe(true)
    })
  })

  describe('checkOrder — daily loss kill switch', () => {
    it('triggers kill switch when daily loss exceeds limit', () => {
      const rm = new RiskManager({ maxDailyLossPercent: 3 }, 100_000)
      const order = makeOrder()

      // Simulate a loss by updating equity below start-of-day
      rm.updateEquity(100_000) // Initialize today's entry
      const portfolio = makePortfolio({ equity: 96_500 }) // -3.5% loss

      const result = rm.checkOrder(order, portfolio)

      expect(result.allowed).toBe(false)
      expect(result.reason).toContain('Daily loss limit')

      // Kill switch should now be active
      const ks = rm.getKillSwitchStatus()
      expect(ks.triggered).toBe(true)
    })

    it('allows order when daily P&L is within limit', () => {
      const rm = new RiskManager({ maxDailyLossPercent: 3 }, 100_000)
      rm.updateEquity(100_000)
      const order = makeOrder()
      const portfolio = makePortfolio({ equity: 98_000 }) // -2% loss (within 3%)

      const result = rm.checkOrder(order, portfolio)

      expect(result.allowed).toBe(true)
    })

    it('allows order on profitable day', () => {
      const rm = new RiskManager({ maxDailyLossPercent: 3 }, 100_000)
      rm.updateEquity(100_000)
      const order = makeOrder()
      const portfolio = makePortfolio({ equity: 105_000 }) // +5% profit

      const result = rm.checkOrder(order, portfolio)

      expect(result.allowed).toBe(true)
    })

    it('blocks all subsequent orders after kill switch triggers', () => {
      const rm = new RiskManager({ maxDailyLossPercent: 3 }, 100_000)
      rm.updateEquity(100_000)

      // Trigger kill switch
      rm.checkOrder(makeOrder(), makePortfolio({ equity: 96_000 }))

      // Subsequent orders should all be blocked
      const result = rm.checkOrder(makeOrder(), makePortfolio({ equity: 99_000 }))
      expect(result.allowed).toBe(false)
      expect(result.reason).toContain('Kill switch active')
    })
  })

  describe('checkOrder — max drawdown kill switch', () => {
    it('triggers kill switch when drawdown exceeds limit', () => {
      const rm = new RiskManager({ maxDrawdownPercent: 10 }, 100_000)
      rm.updateEquity(100_000) // Peak

      const order = makeOrder()
      const portfolio = makePortfolio({ equity: 89_000 }) // -11% from peak

      const result = rm.checkOrder(order, portfolio)

      expect(result.allowed).toBe(false)
      expect(result.reason).toContain('Max drawdown')

      const ks = rm.getKillSwitchStatus()
      expect(ks.triggered).toBe(true)
    })

    it('allows order when drawdown is within limit', () => {
      const rm = new RiskManager({ maxDrawdownPercent: 10 }, 100_000)
      rm.updateEquity(100_000)

      const order = makeOrder()
      const portfolio = makePortfolio({ equity: 92_000 }) // -8% from peak

      const result = rm.checkOrder(order, portfolio)

      expect(result.allowed).toBe(true)
    })

    it('tracks peak equity correctly through multiple updates', () => {
      const rm = new RiskManager({ maxDrawdownPercent: 10 }, 100_000)

      // Equity goes up to 110k then drops
      rm.updateEquity(105_000)
      rm.updateEquity(110_000) // New peak
      rm.updateEquity(105_000)

      // Drawdown from 110k peak: (110k - 98k) / 110k = 10.9%
      const result = rm.checkOrder(makeOrder(), makePortfolio({ equity: 98_000 }))

      expect(result.allowed).toBe(false)
      expect(result.reason).toContain('Max drawdown')
    })
  })

  describe('kill switch management', () => {
    it('can reset the kill switch', () => {
      const rm = new RiskManager({ maxDailyLossPercent: 3 }, 100_000)
      rm.updateEquity(100_000)

      // Trigger kill switch
      rm.checkOrder(makeOrder(), makePortfolio({ equity: 96_000 }))
      expect(rm.getKillSwitchStatus().triggered).toBe(true)

      // Reset
      rm.resetKillSwitch()
      expect(rm.getKillSwitchStatus().triggered).toBe(false)

      // Should now allow orders (if within limits)
      const result = rm.checkOrder(makeOrder(), makePortfolio({ equity: 99_000 }))
      expect(result.allowed).toBe(true)
    })

    it('records triggeredAt timestamp', () => {
      const rm = new RiskManager({ maxDailyLossPercent: 1 }, 100_000)
      rm.updateEquity(100_000)

      const before = Date.now()
      rm.checkOrder(makeOrder(), makePortfolio({ equity: 98_000 }))
      const after = Date.now()

      const ks = rm.getKillSwitchStatus()
      expect(ks.triggered).toBe(true)
      expect(ks.triggeredAt).toBeGreaterThanOrEqual(before)
      expect(ks.triggeredAt).toBeLessThanOrEqual(after)
    })
  })

  describe('exposure calculation across multiple positions', () => {
    it('calculates total exposure from all positions', () => {
      const rm = new RiskManager({ maxTotalExposurePercent: 60 })
      const order = makeOrder({ symbol: 'TSLA', quantity: 20, price: 250 }) // $5,000
      const portfolio = makePortfolio({
        equity: 100_000,
        positions: [
          makePosition({ symbol: 'AAPL', marketValue: 20_000 }),
          makePosition({ symbol: 'MSFT', marketValue: 15_000 }),
          makePosition({ symbol: 'GOOGL', marketValue: 22_000 }),
        ],
      })
      // Existing: 20k + 15k + 22k = $57,000 (57%), new: +$5,000 = $62,000 (62%)

      const result = rm.checkOrder(order, portfolio)

      expect(result.allowed).toBe(false)
      expect(result.reason).toContain('Total exposure')
    })

    it('correctly sums absolute values of positions', () => {
      const rm = new RiskManager({ maxTotalExposurePercent: 100 })
      const order = makeOrder({ quantity: 5, price: 100 }) // $500
      const portfolio = makePortfolio({
        equity: 50_000,
        positions: [
          makePosition({ symbol: 'AAPL', marketValue: 15_000 }),
          makePosition({ symbol: 'MSFT', marketValue: 10_000 }),
          makePosition({ symbol: 'TSLA', marketValue: -5_000 }), // Short position
        ],
      })
      // Absolute exposure: 15k + 10k + 5k = $30,000 + $500 = $30,500 = 61%

      const result = rm.checkOrder(order, portfolio)

      expect(result.allowed).toBe(true)
    })
  })

  describe('config management', () => {
    it('uses default config when none provided', () => {
      const rm = new RiskManager()
      const config = rm.getConfig()

      expect(config.maxPositionSizePercent).toBe(10)
      expect(config.maxTotalExposurePercent).toBe(100)
      expect(config.maxDailyLossPercent).toBe(3)
      expect(config.maxDrawdownPercent).toBe(10)
    })

    it('allows custom config on construction', () => {
      const rm = new RiskManager({
        maxPositionSizePercent: 20,
        maxDailyLossPercent: 5,
      })
      const config = rm.getConfig()

      expect(config.maxPositionSizePercent).toBe(20)
      expect(config.maxDailyLossPercent).toBe(5)
      expect(config.maxTotalExposurePercent).toBe(100) // default
      expect(config.maxDrawdownPercent).toBe(10) // default
    })

    it('allows updating config', () => {
      const rm = new RiskManager()
      rm.updateConfig({ maxDrawdownPercent: 15 })
      const config = rm.getConfig()

      expect(config.maxDrawdownPercent).toBe(15)
      expect(config.maxPositionSizePercent).toBe(10) // unchanged
    })

    it('returns a copy of config (not a reference)', () => {
      const rm = new RiskManager()
      const config1 = rm.getConfig()
      config1.maxPositionSizePercent = 99

      const config2 = rm.getConfig()
      expect(config2.maxPositionSizePercent).toBe(10) // unchanged
    })
  })

  describe('P&L tracking', () => {
    it('records trades and updates daily P&L', () => {
      const rm = new RiskManager({}, 100_000)
      rm.updateEquity(100_000)

      rm.recordTrade(500, 100_500)
      rm.recordTrade(-200, 100_300)

      const dailyPnL = rm.getDailyPnLPercent(100_300)
      expect(dailyPnL).toBeCloseTo(0.3, 1) // +0.3%
    })

    it('tracks drawdown from peak', () => {
      const rm = new RiskManager({}, 100_000)

      rm.updateEquity(110_000) // Peak
      rm.updateEquity(105_000) // Drawdown

      const dd = rm.getDrawdownPercent(105_000)
      expect(dd).toBeCloseTo(4.55, 1) // (110k - 105k) / 110k = 4.55%
    })

    it('returns daily P&L entries', () => {
      const rm = new RiskManager({}, 100_000)
      rm.updateEquity(100_000)
      rm.recordTrade(1000, 101_000)

      const entries = rm.getDailyPnLEntries()
      expect(entries.length).toBeGreaterThan(0)
      expect(entries[0]!.trades).toBe(1)
      expect(entries[0]!.realizedPnL).toBe(1000)
    })
  })
})

describe('DailyPnLTracker', () => {
  it('creates daily entries on first access', () => {
    const tracker = new DailyPnLTracker(100_000)
    const entry = tracker.getToday(100_000)

    expect(entry.startEquity).toBe(100_000)
    expect(entry.currentEquity).toBe(100_000)
    expect(entry.realizedPnL).toBe(0)
    expect(entry.trades).toBe(0)
  })

  it('tracks peak equity within day', () => {
    const tracker = new DailyPnLTracker(100_000)
    tracker.updateEquity(100_000)
    tracker.updateEquity(105_000)
    tracker.updateEquity(103_000)

    const entry = tracker.getToday(103_000)
    expect(entry.peakEquity).toBe(105_000)
  })

  it('tracks all-time peak equity', () => {
    const tracker = new DailyPnLTracker(100_000)
    tracker.updateEquity(110_000)
    tracker.updateEquity(105_000)

    expect(tracker.getAllTimePeak()).toBe(110_000)
  })

  it('calculates drawdown from all-time peak', () => {
    const tracker = new DailyPnLTracker(100_000)
    tracker.updateEquity(120_000) // New peak
    tracker.updateEquity(110_000)

    const dd = tracker.getDrawdownPercent(110_000)
    // (120k - 110k) / 120k = 8.33%
    expect(dd).toBeCloseTo(8.33, 1)
  })

  it('calculates daily P&L percent', () => {
    const tracker = new DailyPnLTracker(100_000)
    tracker.updateEquity(100_000) // Start of day

    const pnl = tracker.getDailyPnLPercent(97_000) // Down $3k
    expect(pnl).toBeCloseTo(-3.0, 1)
  })

  it('handles zero equity gracefully', () => {
    const tracker = new DailyPnLTracker(0)
    expect(tracker.getDailyPnLPercent(0)).toBe(0)
    expect(tracker.getDrawdownPercent(0)).toBe(0)
  })

  it('records multiple trades', () => {
    const tracker = new DailyPnLTracker(100_000)
    tracker.recordTrade(500, 100_500)
    tracker.recordTrade(300, 100_800)
    tracker.recordTrade(-200, 100_600)

    const entry = tracker.getToday(100_600)
    expect(entry.trades).toBe(3)
    expect(entry.realizedPnL).toBe(600) // 500 + 300 - 200
  })
})
