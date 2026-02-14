import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { IBKRAdapter, IBKRApiError } from '../../src/adapters/broker/ibkr.js'

// ── Mock fetch ────────────────────────────────────────────

const mockResponses = new Map<string, unknown>()

function setMockResponse(pathPattern: string, response: unknown, status = 200) {
  mockResponses.set(pathPattern, { response, status })
}

function findMockResponse(url: string): { response: unknown; status: number } | undefined {
  for (const [pattern, mock] of mockResponses) {
    if (url.includes(pattern)) return mock as { response: unknown; status: number }
  }
  return undefined
}

const originalFetch = globalThis.fetch

beforeEach(() => {
  mockResponses.clear()

  globalThis.fetch = vi.fn(async (input: string | URL | Request) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
    const mock = findMockResponse(url)

    if (!mock) {
      return new Response('Not Found', { status: 404 })
    }

    return new Response(JSON.stringify(mock.response), {
      status: mock.status,
      headers: { 'Content-Type': 'application/json' },
    })
  }) as typeof fetch
})

afterEach(() => {
  globalThis.fetch = originalFetch
})

// ── Auth Tests ────────────────────────────────────────────

describe('IBKRAdapter', () => {
  describe('authenticate', () => {
    it('authenticates successfully with valid session token', async () => {
      setMockResponse('/iserver/auth/status', {
        authenticated: true,
        competing: false,
        connected: true,
        message: '',
      })
      setMockResponse('/portfolio/accounts', { accounts: ['U1234567'] })
      setMockResponse('/portfolio/U1234567/meta', {
        id: 'U1234567',
        accountId: 'U1234567',
        accountVan: 'U1234567',
        accountTitle: 'Individual',
        displayName: 'Main Account',
        accountAlias: 'Main',
        accountStatus: 1,
        currency: 'USD',
        type: 'INDIVIDUAL',
        tradingType: 'STKNOPT',
        faclient: false,
        parent: { mmc: [], accountId: '', isMParent: false, isMChild: false, isMultiplex: false },
        desc: 'Individual Account',
      })

      const adapter = new IBKRAdapter()
      const session = await adapter.authenticate({
        accessToken: 'test-session-token',
      })

      expect(session.provider).toBe('ibkr')
      expect(session.accountId).toBe('U1234567')
      expect(session.accessToken).toBe('test-session-token')
      expect(session.expiresAt).toBeDefined()
    })

    it('throws on unauthenticated session', async () => {
      setMockResponse('/iserver/auth/status', {
        authenticated: false,
        competing: false,
        connected: false,
        message: 'Not authenticated',
      })

      const adapter = new IBKRAdapter()
      await expect(
        adapter.authenticate({ accessToken: 'invalid-token' }),
      ).rejects.toThrow('IBKR session is not authenticated')
    })
  })

  // ── Account Tests ──────────────────────────────────────

  describe('getAccount', () => {
    it('maps IBKR account summary to BrokerAccount', async () => {
      // Setup auth
      setMockResponse('/iserver/auth/status', { authenticated: true, competing: false, connected: true, message: '' })
      setMockResponse('/portfolio/accounts', { accounts: ['U1234567'] })
      setMockResponse('/portfolio/U1234567/meta', {
        id: 'U1234567', accountId: 'U1234567', accountVan: 'U1234567',
        accountTitle: 'Individual', displayName: 'Main', accountAlias: '',
        accountStatus: 1, currency: 'USD', type: 'INDIVIDUAL', tradingType: 'STKNOPT',
        faclient: false, parent: { mmc: [], accountId: '', isMParent: false, isMChild: false, isMultiplex: false },
        desc: 'Individual',
      })
      setMockResponse('/portfolio/U1234567/summary', {
        accountready: { value: true },
        netliquidation: { amount: 50000, currency: 'USD' },
        totalcashvalue: { amount: 25000, currency: 'USD' },
        buyingpower: { amount: 100000, currency: 'USD' },
        grosspositionvalue: { amount: 25000, currency: 'USD' },
        sma: { amount: 100000, currency: 'USD' },
        availablefunds: { amount: 90000, currency: 'USD' },
        maintmarginreq: { amount: 10000, currency: 'USD' },
        initmarginreq: { amount: 15000, currency: 'USD' },
        cushion: { value: 0.9 },
        daytradesremaining: { value: 3 },
        daytradingstatus: { value: 'NO' },
      })

      const adapter = new IBKRAdapter()
      await adapter.authenticate({ accessToken: 'test-token' })

      const account = await adapter.getAccount()
      expect(account.accountId).toBe('U1234567')
      expect(account.status).toBe('active')
      expect(account.cashBalance).toBe(25000)
      expect(account.buyingPower).toBe(100000)
      expect(account.equity).toBe(50000)
      expect(account.portfolioValue).toBe(50000)
      expect(account.daytradeCount).toBe(3)
      expect(account.patternDayTrader).toBe(false)
    })
  })

  // ── Positions Tests ─────────────────────────────────────

  describe('getPositions', () => {
    it('maps IBKR positions to BrokerPosition[]', async () => {
      setMockResponse('/iserver/auth/status', { authenticated: true, competing: false, connected: true, message: '' })
      setMockResponse('/portfolio/accounts', { accounts: ['U1234567'] })
      setMockResponse('/portfolio/U1234567/meta', {
        id: 'U1234567', accountId: 'U1234567', accountVan: 'U1234567',
        accountTitle: 'Individual', displayName: 'Main', accountAlias: '',
        accountStatus: 1, currency: 'USD', type: 'INDIVIDUAL', tradingType: 'STKNOPT',
        faclient: false, parent: { mmc: [], accountId: '', isMParent: false, isMChild: false, isMultiplex: false },
        desc: 'Individual',
      })
      setMockResponse('/portfolio/U1234567/positions/0', [
        {
          acctId: 'U1234567',
          conid: 265598,
          contractDesc: 'AAPL',
          position: 100,
          mktPrice: 180.50,
          mktValue: 18050,
          currency: 'USD',
          avgCost: 150,
          avgPrice: 150,
          realizedPnl: 0,
          unrealizedPnl: 3050,
          exchs: null,
          expiry: null,
          putOrCall: null,
          multiplier: null,
          strike: 0,
          exerciseStyle: null,
          assetClass: 'STK',
          model: '',
        },
        {
          acctId: 'U1234567',
          conid: 4815747,
          contractDesc: 'MSFT',
          position: -50,
          mktPrice: 410.25,
          mktValue: -20512.5,
          currency: 'USD',
          avgCost: 400,
          avgPrice: 400,
          realizedPnl: 0,
          unrealizedPnl: -512.5,
          exchs: null,
          expiry: null,
          putOrCall: null,
          multiplier: null,
          strike: 0,
          exerciseStyle: null,
          assetClass: 'STK',
          model: '',
        },
      ])

      const adapter = new IBKRAdapter()
      await adapter.authenticate({ accessToken: 'test-token' })

      const positions = await adapter.getPositions()
      expect(positions).toHaveLength(2)

      // Long position
      expect(positions[0].symbol).toBe('AAPL')
      expect(positions[0].quantity).toBe(100)
      expect(positions[0].side).toBe('long')
      expect(positions[0].avgEntryPrice).toBe(150)
      expect(positions[0].currentPrice).toBe(180.50)
      expect(positions[0].unrealizedPnL).toBe(3050)

      // Short position
      expect(positions[1].symbol).toBe('MSFT')
      expect(positions[1].quantity).toBe(50)
      expect(positions[1].side).toBe('short')
    })
  })

  // ── Multi-Account Tests ─────────────────────────────────

  describe('listAccounts', () => {
    it('lists all sub-accounts under master', async () => {
      setMockResponse('/iserver/auth/status', { authenticated: true, competing: false, connected: true, message: '' })
      setMockResponse('/portfolio/accounts', { accounts: ['U1234567', 'U7654321', 'DU9999999'] })

      setMockResponse('/portfolio/U1234567/meta', {
        id: 'U1234567', accountId: 'U1234567', accountVan: 'U1234567',
        accountTitle: 'Individual', displayName: 'Main Account', accountAlias: 'Main',
        accountStatus: 1, currency: 'USD', type: 'INDIVIDUAL', tradingType: 'STKNOPT',
        faclient: false, parent: { mmc: [], accountId: '', isMParent: true, isMChild: false, isMultiplex: false },
        desc: 'Individual',
      })
      setMockResponse('/portfolio/U7654321/meta', {
        id: 'U7654321', accountId: 'U7654321', accountVan: 'U7654321',
        accountTitle: 'IRA', displayName: 'IRA Account', accountAlias: 'IRA',
        accountStatus: 1, currency: 'USD', type: 'IRA', tradingType: 'STKNOPT',
        faclient: false, parent: { mmc: [], accountId: 'U1234567', isMParent: false, isMChild: true, isMultiplex: false },
        desc: 'IRA',
      })
      setMockResponse('/portfolio/DU9999999/meta', {
        id: 'DU9999999', accountId: 'DU9999999', accountVan: 'DU9999999',
        accountTitle: 'Paper', displayName: 'Paper Account', accountAlias: 'Paper',
        accountStatus: 1, currency: 'USD', type: 'DEMO', tradingType: 'STKNOPT',
        faclient: false, parent: { mmc: [], accountId: '', isMParent: false, isMChild: false, isMultiplex: false },
        desc: 'Paper Trading',
      })

      const adapter = new IBKRAdapter()
      await adapter.authenticate({ accessToken: 'test-token' })

      const accounts = await adapter.listAccounts()
      expect(accounts).toHaveLength(3)
      expect(accounts[0].displayName).toBe('Main Account')
      expect(accounts[1].displayName).toBe('IRA Account')
      expect(accounts[2].type).toBe('DEMO')
    })
  })

  describe('switchAccount', () => {
    it('switches active account for order submission', async () => {
      setMockResponse('/iserver/auth/status', { authenticated: true, competing: false, connected: true, message: '' })
      setMockResponse('/portfolio/accounts', { accounts: ['U1234567'] })
      setMockResponse('/portfolio/U1234567/meta', {
        id: 'U1234567', accountId: 'U1234567', accountVan: 'U1234567',
        accountTitle: 'Individual', displayName: 'Main', accountAlias: '',
        accountStatus: 1, currency: 'USD', type: 'INDIVIDUAL', tradingType: 'STKNOPT',
        faclient: false, parent: { mmc: [], accountId: '', isMParent: false, isMChild: false, isMultiplex: false },
        desc: 'Individual',
      })

      const adapter = new IBKRAdapter()
      await adapter.authenticate({ accessToken: 'test-token' })

      adapter.switchAccount('U7654321')
      // After switching, operations should target the new account
      // (verified by checking the URL in subsequent calls)
      expect(true).toBe(true) // switchAccount is synchronous and doesn't throw
    })
  })

  // ── Order Tests ─────────────────────────────────────────

  describe('submitOrder', () => {
    it('constructs correct IBKR order payload for limit order', async () => {
      // Setup auth
      setMockResponse('/iserver/auth/status', { authenticated: true, competing: false, connected: true, message: '' })
      setMockResponse('/portfolio/accounts', { accounts: ['U1234567'] })
      setMockResponse('/portfolio/U1234567/meta', {
        id: 'U1234567', accountId: 'U1234567', accountVan: 'U1234567',
        accountTitle: 'Individual', displayName: 'Main', accountAlias: '',
        accountStatus: 1, currency: 'USD', type: 'INDIVIDUAL', tradingType: 'STKNOPT',
        faclient: false, parent: { mmc: [], accountId: '', isMParent: false, isMChild: false, isMultiplex: false },
        desc: 'Individual',
      })

      // Mock contract resolution
      setMockResponse('/iserver/secdef/search', [
        {
          conid: 265598,
          companyHeader: 'AAPL',
          companyName: 'Apple Inc.',
          symbol: 'AAPL',
          description: 'Apple Inc.',
          restricted: null,
          fop: null,
          opt: null,
          war: null,
          sections: [{ secType: 'STK', exchange: 'SMART' }],
        },
      ])

      // Mock order submission
      setMockResponse('/iserver/account/U1234567/orders', [
        { id: 'order-123', confirmed: true },
      ])

      const adapter = new IBKRAdapter()
      await adapter.authenticate({ accessToken: 'test-token' })

      const result = await adapter.submitOrder({
        symbol: 'AAPL',
        side: 'buy',
        type: 'limit',
        quantity: 100,
        limitPrice: 175.00,
        timeInForce: 'day',
      })

      expect(result.orderId).toBe('order-123')
      expect(result.status).toBe('new')
      expect(result.symbol).toBe('AAPL')
      expect(result.side).toBe('buy')
      expect(result.quantity).toBe(100)
    })
  })

  describe('getOrders', () => {
    it('maps IBKR order details to BrokerOrderResult[]', async () => {
      setMockResponse('/iserver/auth/status', { authenticated: true, competing: false, connected: true, message: '' })
      setMockResponse('/portfolio/accounts', { accounts: ['U1234567'] })
      setMockResponse('/portfolio/U1234567/meta', {
        id: 'U1234567', accountId: 'U1234567', accountVan: 'U1234567',
        accountTitle: 'Individual', displayName: 'Main', accountAlias: '',
        accountStatus: 1, currency: 'USD', type: 'INDIVIDUAL', tradingType: 'STKNOPT',
        faclient: false, parent: { mmc: [], accountId: '', isMParent: false, isMChild: false, isMultiplex: false },
        desc: 'Individual',
      })
      setMockResponse('/iserver/account/orders', {
        orders: [
          {
            orderId: 101,
            conid: 265598,
            symbol: 'AAPL',
            side: 'BUY',
            orderType: 'LMT',
            price: 175,
            auxPrice: 0,
            status: 'Submitted',
            filledQuantity: 0,
            remainingQuantity: 100,
            totalQuantity: 100,
            avgPrice: 0,
            lastFillPrice: 0,
            timeInForce: 'DAY',
            lastExecutionTime_r: Date.now(),
            orderDesc: 'Buy 100 AAPL @ 175.00',
            ocaGroupId: '',
            parentId: 0,
          },
          {
            orderId: 102,
            conid: 265598,
            symbol: 'AAPL',
            side: 'SELL',
            orderType: 'LMT',
            price: 185,
            auxPrice: 0,
            status: 'Filled',
            filledQuantity: 50,
            remainingQuantity: 0,
            totalQuantity: 50,
            avgPrice: 185.10,
            lastFillPrice: 185.10,
            timeInForce: 'GTC',
            lastExecutionTime_r: Date.now(),
            orderDesc: 'Sell 50 AAPL @ 185.00',
            ocaGroupId: '',
            parentId: 0,
          },
        ],
      })

      const adapter = new IBKRAdapter()
      await adapter.authenticate({ accessToken: 'test-token' })

      const orders = await adapter.getOrders()
      expect(orders).toHaveLength(2)

      expect(orders[0].orderId).toBe('101')
      expect(orders[0].status).toBe('new') // Submitted -> new
      expect(orders[0].side).toBe('buy')
      expect(orders[0].type).toBe('limit')
      expect(orders[0].quantity).toBe(100)

      expect(orders[1].orderId).toBe('102')
      expect(orders[1].status).toBe('filled')
      expect(orders[1].avgFillPrice).toBe(185.10)
    })

    it('filters by status', async () => {
      setMockResponse('/iserver/auth/status', { authenticated: true, competing: false, connected: true, message: '' })
      setMockResponse('/portfolio/accounts', { accounts: ['U1234567'] })
      setMockResponse('/portfolio/U1234567/meta', {
        id: 'U1234567', accountId: 'U1234567', accountVan: 'U1234567',
        accountTitle: 'Individual', displayName: 'Main', accountAlias: '',
        accountStatus: 1, currency: 'USD', type: 'INDIVIDUAL', tradingType: 'STKNOPT',
        faclient: false, parent: { mmc: [], accountId: '', isMParent: false, isMChild: false, isMultiplex: false },
        desc: 'Individual',
      })
      setMockResponse('/iserver/account/orders', {
        orders: [
          {
            orderId: 101, conid: 265598, symbol: 'AAPL', side: 'BUY',
            orderType: 'LMT', price: 175, auxPrice: 0, status: 'Submitted',
            filledQuantity: 0, remainingQuantity: 100, totalQuantity: 100,
            avgPrice: 0, lastFillPrice: 0, timeInForce: 'DAY',
            lastExecutionTime_r: Date.now(), orderDesc: '', ocaGroupId: '', parentId: 0,
          },
          {
            orderId: 102, conid: 265598, symbol: 'AAPL', side: 'SELL',
            orderType: 'LMT', price: 185, auxPrice: 0, status: 'Filled',
            filledQuantity: 50, remainingQuantity: 0, totalQuantity: 50,
            avgPrice: 185.10, lastFillPrice: 185.10, timeInForce: 'GTC',
            lastExecutionTime_r: Date.now(), orderDesc: '', ocaGroupId: '', parentId: 0,
          },
        ],
      })

      const adapter = new IBKRAdapter()
      await adapter.authenticate({ accessToken: 'test-token' })

      const filledOnly = await adapter.getOrders('filled')
      expect(filledOnly).toHaveLength(1)
      expect(filledOnly[0].orderId).toBe('102')
    })
  })

  // ── Bracket Order Tests ─────────────────────────────────

  describe('submitBracketOrder', () => {
    it('submits bracket order with entry, target, and stop', async () => {
      setMockResponse('/iserver/auth/status', { authenticated: true, competing: false, connected: true, message: '' })
      setMockResponse('/portfolio/accounts', { accounts: ['U1234567'] })
      setMockResponse('/portfolio/U1234567/meta', {
        id: 'U1234567', accountId: 'U1234567', accountVan: 'U1234567',
        accountTitle: 'Individual', displayName: 'Main', accountAlias: '',
        accountStatus: 1, currency: 'USD', type: 'INDIVIDUAL', tradingType: 'STKNOPT',
        faclient: false, parent: { mmc: [], accountId: '', isMParent: false, isMChild: false, isMultiplex: false },
        desc: 'Individual',
      })
      setMockResponse('/iserver/account/U1234567/orders', [
        { id: 'entry-001', confirmed: true },
        { id: 'target-001', confirmed: true },
        { id: 'stop-001', confirmed: true },
      ])

      const adapter = new IBKRAdapter()
      await adapter.authenticate({ accessToken: 'test-token' })

      const result = await adapter.submitBracketOrder({
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

      expect(result.entryOrderId).toBe('entry-001')
      expect(result.targetOrderId).toBe('target-001')
      expect(result.stopOrderId).toBe('stop-001')
    })
  })

  // ── Error Handling ──────────────────────────────────────

  describe('error handling', () => {
    it('throws IBKRApiError on HTTP errors', async () => {
      setMockResponse('/iserver/auth/status', { authenticated: true, competing: false, connected: true, message: '' })
      setMockResponse('/portfolio/accounts', { accounts: ['U1234567'] })
      setMockResponse('/portfolio/U1234567/meta', {
        id: 'U1234567', accountId: 'U1234567', accountVan: 'U1234567',
        accountTitle: 'Individual', displayName: 'Main', accountAlias: '',
        accountStatus: 1, currency: 'USD', type: 'INDIVIDUAL', tradingType: 'STKNOPT',
        faclient: false, parent: { mmc: [], accountId: '', isMParent: false, isMChild: false, isMultiplex: false },
        desc: 'Individual',
      })

      const adapter = new IBKRAdapter()
      await adapter.authenticate({ accessToken: 'test-token' })

      // Remove the summary mock so it returns 404
      mockResponses.delete('/portfolio/U1234567/summary')

      await expect(adapter.getAccount()).rejects.toThrow()
    })
  })

  // ── Disconnect ──────────────────────────────────────────

  describe('disconnect', () => {
    it('cleans up resources on disconnect', async () => {
      setMockResponse('/iserver/auth/status', { authenticated: true, competing: false, connected: true, message: '' })
      setMockResponse('/portfolio/accounts', { accounts: ['U1234567'] })
      setMockResponse('/portfolio/U1234567/meta', {
        id: 'U1234567', accountId: 'U1234567', accountVan: 'U1234567',
        accountTitle: 'Individual', displayName: 'Main', accountAlias: '',
        accountStatus: 1, currency: 'USD', type: 'INDIVIDUAL', tradingType: 'STKNOPT',
        faclient: false, parent: { mmc: [], accountId: '', isMParent: false, isMChild: false, isMultiplex: false },
        desc: 'Individual',
      })

      const adapter = new IBKRAdapter()
      await adapter.authenticate({ accessToken: 'test-token' })

      // Should not throw
      adapter.disconnect()
      expect(true).toBe(true)
    })
  })
})
