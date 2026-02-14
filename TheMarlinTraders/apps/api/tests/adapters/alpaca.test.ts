import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { AlpacaAdapter, AlpacaApiError } from '../../src/adapters/broker/alpaca.js'

// ── Mock Alpaca API responses ──────────────────────────────

const MOCK_ACCOUNT = {
  id: 'acc-123',
  account_number: '123456789',
  status: 'ACTIVE',
  currency: 'USD',
  cash: '50000.00',
  buying_power: '100000.00',
  portfolio_value: '75000.00',
  equity: '75000.00',
  last_equity: '74500.00',
  multiplier: '2',
  daytrade_count: 1,
  pattern_day_trader: false,
  created_at: '2024-01-15T10:00:00Z',
}

const MOCK_POSITIONS = [
  {
    asset_id: 'asset-1',
    symbol: 'AAPL',
    qty: '100',
    side: 'long',
    avg_entry_price: '175.50',
    current_price: '180.00',
    market_value: '18000.00',
    cost_basis: '17550.00',
    unrealized_pl: '450.00',
    unrealized_plpc: '0.0256',
    change_today: '0.0125',
  },
  {
    asset_id: 'asset-2',
    symbol: 'TSLA',
    qty: '50',
    side: 'long',
    avg_entry_price: '240.00',
    current_price: '235.00',
    market_value: '11750.00',
    cost_basis: '12000.00',
    unrealized_pl: '-250.00',
    unrealized_plpc: '-0.0208',
    change_today: '-0.0150',
  },
]

const MOCK_ORDER_RESPONSE = {
  id: 'order-abc-123',
  client_order_id: 'client-xyz',
  status: 'accepted',
  symbol: 'AAPL',
  side: 'buy',
  type: 'limit',
  qty: '10',
  filled_qty: '0',
  filled_avg_price: null,
  limit_price: '175.00',
  stop_price: null,
  trail_percent: null,
  trail_price: null,
  time_in_force: 'day',
  submitted_at: '2024-06-01T14:30:00Z',
  filled_at: null,
  canceled_at: null,
  expired_at: null,
}

const MOCK_ORDERS_LIST = [
  MOCK_ORDER_RESPONSE,
  {
    ...MOCK_ORDER_RESPONSE,
    id: 'order-def-456',
    status: 'filled',
    filled_qty: '10',
    filled_avg_price: '174.50',
    filled_at: '2024-06-01T14:35:00Z',
  },
]

// ── Test suite ─────────────────────────────────────────────

describe('AlpacaAdapter', () => {
  let adapter: AlpacaAdapter
  let fetchSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    adapter = new AlpacaAdapter()
    fetchSpy = vi.spyOn(globalThis, 'fetch')
  })

  afterEach(() => {
    vi.restoreAllMocks()
    adapter.disconnect()
  })

  function mockFetch(body: unknown, status = 200) {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
  }

  describe('authenticate', () => {
    it('authenticates with valid credentials and returns session', async () => {
      mockFetch(MOCK_ACCOUNT) // getAccount call during authenticate

      const session = await adapter.authenticate({
        accessToken: 'test-token-123',
        paper: true,
      })

      expect(session.accountId).toBe('acc-123')
      expect(session.provider).toBe('alpaca')
      expect(session.accessToken).toBe('test-token-123')
    })

    it('throws on invalid credentials', async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response('Unauthorized', { status: 401 }),
      )

      await expect(
        adapter.authenticate({ accessToken: 'bad-token' }),
      ).rejects.toThrow(AlpacaApiError)
    })
  })

  describe('getAccount', () => {
    it('fetches and maps account data correctly', async () => {
      // Authenticate first
      mockFetch(MOCK_ACCOUNT)
      await adapter.authenticate({ accessToken: 'token', paper: true })

      // Then fetch account
      mockFetch(MOCK_ACCOUNT)
      const account = await adapter.getAccount()

      expect(account.accountId).toBe('acc-123')
      expect(account.status).toBe('active')
      expect(account.cashBalance).toBe(50000)
      expect(account.buyingPower).toBe(100000)
      expect(account.portfolioValue).toBe(75000)
      expect(account.equity).toBe(75000)
      expect(account.multiplier).toBe(2)
      expect(account.daytradeCount).toBe(1)
      expect(account.patternDayTrader).toBe(false)
    })
  })

  describe('getPositions', () => {
    it('fetches and maps positions correctly', async () => {
      mockFetch(MOCK_ACCOUNT) // authenticate
      await adapter.authenticate({ accessToken: 'token', paper: true })

      mockFetch(MOCK_POSITIONS)
      const positions = await adapter.getPositions()

      expect(positions).toHaveLength(2)

      // AAPL position
      expect(positions[0]!.symbol).toBe('AAPL')
      expect(positions[0]!.quantity).toBe(100)
      expect(positions[0]!.side).toBe('long')
      expect(positions[0]!.avgEntryPrice).toBe(175.5)
      expect(positions[0]!.currentPrice).toBe(180)
      expect(positions[0]!.unrealizedPnL).toBe(450)

      // TSLA position (negative P&L)
      expect(positions[1]!.symbol).toBe('TSLA')
      expect(positions[1]!.unrealizedPnL).toBe(-250)
    })

    it('returns empty array when no positions', async () => {
      mockFetch(MOCK_ACCOUNT)
      await adapter.authenticate({ accessToken: 'token', paper: true })

      mockFetch([])
      const positions = await adapter.getPositions()

      expect(positions).toHaveLength(0)
    })
  })

  describe('submitOrder', () => {
    it('submits a limit order and returns result', async () => {
      mockFetch(MOCK_ACCOUNT)
      await adapter.authenticate({ accessToken: 'token', paper: true })

      mockFetch(MOCK_ORDER_RESPONSE)
      const result = await adapter.submitOrder({
        symbol: 'AAPL',
        side: 'buy',
        type: 'limit',
        quantity: 10,
        limitPrice: 175.0,
        timeInForce: 'day',
      })

      expect(result.orderId).toBe('order-abc-123')
      expect(result.status).toBe('accepted')
      expect(result.symbol).toBe('AAPL')
      expect(result.side).toBe('buy')
      expect(result.type).toBe('limit')
      expect(result.quantity).toBe(10)
      expect(result.filledQuantity).toBe(0)
      expect(result.limitPrice).toBe(175)

      // Verify the request body
      const lastCall = fetchSpy.mock.calls[fetchSpy.mock.calls.length - 1]!
      const requestBody = JSON.parse(lastCall[1]?.body as string)
      expect(requestBody.symbol).toBe('AAPL')
      expect(requestBody.qty).toBe('10')
      expect(requestBody.side).toBe('buy')
      expect(requestBody.type).toBe('limit')
      expect(requestBody.limit_price).toBe('175')
      expect(requestBody.time_in_force).toBe('day')
    })

    it('submits a market order', async () => {
      mockFetch(MOCK_ACCOUNT)
      await adapter.authenticate({ accessToken: 'token', paper: true })

      const marketOrderResponse = {
        ...MOCK_ORDER_RESPONSE,
        type: 'market',
        limit_price: null,
      }
      mockFetch(marketOrderResponse)

      const result = await adapter.submitOrder({
        symbol: 'AAPL',
        side: 'buy',
        type: 'market',
        quantity: 10,
        timeInForce: 'day',
      })

      expect(result.type).toBe('market')
      expect(result.limitPrice).toBeUndefined()
    })

    it('submits a stop-limit order with both prices', async () => {
      mockFetch(MOCK_ACCOUNT)
      await adapter.authenticate({ accessToken: 'token', paper: true })

      const stopLimitResponse = {
        ...MOCK_ORDER_RESPONSE,
        type: 'stop_limit',
        limit_price: '170.00',
        stop_price: '172.00',
      }
      mockFetch(stopLimitResponse)

      const result = await adapter.submitOrder({
        symbol: 'AAPL',
        side: 'sell',
        type: 'stop_limit',
        quantity: 10,
        limitPrice: 170.0,
        stopPrice: 172.0,
        timeInForce: 'gtc',
      })

      expect(result.type).toBe('stop_limit')
      expect(result.limitPrice).toBe(170)
      expect(result.stopPrice).toBe(172)
    })

    it('submits a trailing stop order', async () => {
      mockFetch(MOCK_ACCOUNT)
      await adapter.authenticate({ accessToken: 'token', paper: true })

      const trailingStopResponse = {
        ...MOCK_ORDER_RESPONSE,
        type: 'trailing_stop',
        limit_price: null,
        trail_percent: '2.5',
      }
      mockFetch(trailingStopResponse)

      const result = await adapter.submitOrder({
        symbol: 'AAPL',
        side: 'sell',
        type: 'trailing_stop',
        quantity: 10,
        trailPercent: 2.5,
        timeInForce: 'gtc',
      })

      expect(result.type).toBe('trailing_stop')

      const lastCall = fetchSpy.mock.calls[fetchSpy.mock.calls.length - 1]!
      const body = JSON.parse(lastCall[1]?.body as string)
      expect(body.trail_percent).toBe('2.5')
    })
  })

  describe('cancelOrder', () => {
    it('cancels an order by ID', async () => {
      mockFetch(MOCK_ACCOUNT)
      await adapter.authenticate({ accessToken: 'token', paper: true })

      fetchSpy.mockResolvedValueOnce(
        new Response(null, { status: 204 }),
      )

      await expect(adapter.cancelOrder('order-abc-123')).resolves.not.toThrow()

      const lastCall = fetchSpy.mock.calls[fetchSpy.mock.calls.length - 1]!
      expect(lastCall[0]).toContain('/v2/orders/order-abc-123')
      expect(lastCall[1]?.method).toBe('DELETE')
    })

    it('throws when order not found', async () => {
      mockFetch(MOCK_ACCOUNT)
      await adapter.authenticate({ accessToken: 'token', paper: true })

      fetchSpy.mockResolvedValueOnce(
        new Response('Not Found', { status: 404 }),
      )

      await expect(adapter.cancelOrder('nonexistent')).rejects.toThrow(AlpacaApiError)
    })
  })

  describe('getOrders', () => {
    it('fetches all orders when no status filter', async () => {
      mockFetch(MOCK_ACCOUNT)
      await adapter.authenticate({ accessToken: 'token', paper: true })

      mockFetch(MOCK_ORDERS_LIST)
      const orders = await adapter.getOrders()

      expect(orders).toHaveLength(2)
      expect(orders[0]!.orderId).toBe('order-abc-123')
      expect(orders[0]!.status).toBe('accepted')
      expect(orders[1]!.status).toBe('filled')
    })

    it('passes status filter to API', async () => {
      mockFetch(MOCK_ACCOUNT)
      await adapter.authenticate({ accessToken: 'token', paper: true })

      mockFetch([MOCK_ORDERS_LIST[1]])
      await adapter.getOrders('filled')

      const lastCall = fetchSpy.mock.calls[fetchSpy.mock.calls.length - 1]!
      expect(lastCall[0]).toContain('status=filled')
    })

    it('maps cancelled status correctly (Alpaca uses canceled)', async () => {
      mockFetch(MOCK_ACCOUNT)
      await adapter.authenticate({ accessToken: 'token', paper: true })

      mockFetch([])
      await adapter.getOrders('cancelled')

      const lastCall = fetchSpy.mock.calls[fetchSpy.mock.calls.length - 1]!
      expect(lastCall[0]).toContain('status=canceled')
    })
  })

  describe('position sync', () => {
    it('fetches fresh positions on connect', async () => {
      mockFetch(MOCK_ACCOUNT)
      await adapter.authenticate({ accessToken: 'token', paper: true })

      mockFetch(MOCK_POSITIONS)
      const positions = await adapter.getPositions()

      expect(positions).toHaveLength(2)
      expect(positions[0]!.symbol).toBe('AAPL')
      expect(positions[1]!.symbol).toBe('TSLA')
    })
  })

  describe('order lifecycle mapping', () => {
    it('maps all Alpaca statuses to internal statuses', async () => {
      mockFetch(MOCK_ACCOUNT)
      await adapter.authenticate({ accessToken: 'token', paper: true })

      const statuses = ['new', 'accepted', 'pending_new', 'partially_filled', 'filled', 'canceled', 'expired', 'rejected', 'replaced']

      for (const status of statuses) {
        mockFetch([{ ...MOCK_ORDER_RESPONSE, status }])
        const [order] = await adapter.getOrders()

        // 'canceled' maps to 'cancelled' internally
        const expected = status === 'canceled' ? 'cancelled' : status
        expect(order!.status).toBe(expected)
      }
    })
  })
})
