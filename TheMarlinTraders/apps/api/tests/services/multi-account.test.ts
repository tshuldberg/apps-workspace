import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { MultiAccountManager } from '../../src/services/multi-account.js'
import { IBKRAdapter } from '../../src/adapters/broker/ibkr.js'

// ── Mock Redis ────────────────────────────────────────────

vi.mock('../../src/lib/redis.js', () => ({
  redis: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
    keys: vi.fn().mockResolvedValue([]),
    pipeline: vi.fn().mockReturnValue({
      get: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue([]),
    }),
  },
}))

// ── Mock IBKRAdapter ──────────────────────────────────────

function createMockAdapter(
  accountData: {
    accountId: string
    equity: number
    cashBalance: number
    buyingPower: number
    positions: Array<{
      symbol: string
      quantity: number
      avgPrice: number
      currentPrice: number
      pnl: number
    }>
  }[],
): IBKRAdapter {
  const adapter = {
    provider: 'ibkr' as const,
    listAccounts: vi.fn().mockResolvedValue(
      accountData.map((a) => ({
        id: a.accountId,
        accountId: a.accountId,
        accountVan: a.accountId,
        accountTitle: 'Test',
        displayName: `Account ${a.accountId}`,
        accountAlias: '',
        accountStatus: 1,
        currency: 'USD',
        type: 'INDIVIDUAL',
        tradingType: 'STKNOPT',
        faclient: false,
        parent: { mmc: [], accountId: '', isMParent: false, isMChild: false, isMultiplex: false },
        desc: 'Test',
      })),
    ),
    getAccountById: vi.fn().mockImplementation(async (accountId: string) => {
      const data = accountData.find((a) => a.accountId === accountId)
      if (!data) throw new Error(`Account ${accountId} not found`)
      return {
        accountId: data.accountId,
        status: 'active',
        currency: 'USD',
        cashBalance: data.cashBalance,
        buyingPower: data.buyingPower,
        portfolioValue: data.equity,
        equity: data.equity,
        multiplier: 1,
        daytradeCount: 0,
        patternDayTrader: false,
        lastEquity: data.equity,
        createdAt: new Date().toISOString(),
      }
    }),
    getPositionsByAccount: vi.fn().mockImplementation(async (accountId: string) => {
      const data = accountData.find((a) => a.accountId === accountId)
      if (!data) return []
      return data.positions.map((p) => ({
        symbol: p.symbol,
        quantity: p.quantity,
        side: 'long' as const,
        avgEntryPrice: p.avgPrice,
        currentPrice: p.currentPrice,
        marketValue: p.quantity * p.currentPrice,
        costBasis: p.quantity * p.avgPrice,
        unrealizedPnL: p.pnl,
        unrealizedPnLPercent: ((p.currentPrice - p.avgPrice) / p.avgPrice) * 100,
        changeToday: 0,
      }))
    }),
    switchAccount: vi.fn(),
    disconnect: vi.fn(),
  } as unknown as IBKRAdapter

  return adapter
}

// ── Tests ─────────────────────────────────────────────────

describe('MultiAccountManager', () => {
  let manager: MultiAccountManager

  beforeEach(() => {
    manager = new MultiAccountManager()
  })

  describe('listSubAccounts', () => {
    it('lists all sub-accounts from registered adapter', async () => {
      const adapter = createMockAdapter([
        { accountId: 'U1111', equity: 50000, cashBalance: 25000, buyingPower: 100000, positions: [] },
        { accountId: 'U2222', equity: 30000, cashBalance: 15000, buyingPower: 60000, positions: [] },
      ])

      manager.registerAdapter('conn-1', adapter)
      const accounts = await manager.listSubAccounts('conn-1')

      expect(accounts).toHaveLength(2)
      expect(accounts[0].accountId).toBe('U1111')
      expect(accounts[1].accountId).toBe('U2222')
      expect(accounts[0].provider).toBe('ibkr')
    })
  })

  describe('switchAccount', () => {
    it('delegates to adapter.switchAccount', () => {
      const adapter = createMockAdapter([
        { accountId: 'U1111', equity: 50000, cashBalance: 25000, buyingPower: 100000, positions: [] },
      ])

      manager.registerAdapter('conn-1', adapter)
      manager.switchAccount('conn-1', 'U2222')

      expect(adapter.switchAccount).toHaveBeenCalledWith('U2222')
      expect(manager.getActiveAccountId()).toBe('U2222')
    })
  })

  describe('getAggregatedPortfolio', () => {
    it('aggregates equity, cash, and positions across all sub-accounts', async () => {
      const adapter = createMockAdapter([
        {
          accountId: 'U1111',
          equity: 50000,
          cashBalance: 25000,
          buyingPower: 100000,
          positions: [
            { symbol: 'AAPL', quantity: 100, avgPrice: 150, currentPrice: 180, pnl: 3000 },
            { symbol: 'MSFT', quantity: 50, avgPrice: 300, currentPrice: 410, pnl: 5500 },
          ],
        },
        {
          accountId: 'U2222',
          equity: 30000,
          cashBalance: 15000,
          buyingPower: 60000,
          positions: [
            { symbol: 'AAPL', quantity: 50, avgPrice: 155, currentPrice: 180, pnl: 1250 },
            { symbol: 'GOOGL', quantity: 20, avgPrice: 140, currentPrice: 170, pnl: 600 },
          ],
        },
      ])

      manager.registerAdapter('conn-1', adapter)
      const portfolio = await manager.getAggregatedPortfolio('conn-1')

      expect(portfolio.totalEquity).toBe(80000)
      expect(portfolio.totalCashBalance).toBe(40000)
      expect(portfolio.totalBuyingPower).toBe(160000)
      expect(portfolio.totalUnrealizedPnL).toBe(10350) // 3000 + 5500 + 1250 + 600
      expect(portfolio.accounts).toHaveLength(2)

      // First account
      expect(portfolio.accounts[0].equity).toBe(50000)
      expect(portfolio.accounts[0].positions).toHaveLength(2)

      // Second account
      expect(portfolio.accounts[1].equity).toBe(30000)
      expect(portfolio.accounts[1].positions).toHaveLength(2)
    })

    it('handles account fetch failures gracefully', async () => {
      const adapter = createMockAdapter([
        { accountId: 'U1111', equity: 50000, cashBalance: 25000, buyingPower: 100000, positions: [] },
      ]);

      // Override getAccountById to throw for U1111
      (adapter.getAccountById as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error('Account fetch failed'),
      )

      manager.registerAdapter('conn-1', adapter)
      const portfolio = await manager.getAggregatedPortfolio('conn-1')

      // Should still return 1 account with zeroed values
      expect(portfolio.accounts).toHaveLength(1)
      expect(portfolio.accounts[0].equity).toBe(0)
    })
  })

  describe('getAccountPnL', () => {
    it('calculates per-account P&L correctly', async () => {
      const adapter = createMockAdapter([
        {
          accountId: 'U1111',
          equity: 52000,
          cashBalance: 25000,
          buyingPower: 100000,
          positions: [
            { symbol: 'AAPL', quantity: 100, avgPrice: 150, currentPrice: 180, pnl: 3000 },
            { symbol: 'TSLA', quantity: 25, avgPrice: 200, currentPrice: 180, pnl: -500 },
          ],
        },
      ])

      manager.registerAdapter('conn-1', adapter)
      const pnl = await manager.getAccountPnL('conn-1', 'U1111')

      expect(pnl.unrealizedPnL).toBe(2500) // 3000 + (-500)
      expect(pnl.positions).toHaveLength(2)
      expect(pnl.dayPnL).toBe(0) // equity - lastEquity = 52000 - 52000
    })
  })

  describe('error handling', () => {
    it('throws when adapter not registered', async () => {
      await expect(
        manager.listSubAccounts('nonexistent'),
      ).rejects.toThrow('No IBKR adapter registered for connection')
    })
  })
})
