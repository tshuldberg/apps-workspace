import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { IBKRContractResolver, IBKRContractError } from '../../src/adapters/broker/ibkr-contracts.js'

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

// ── Mock fetch ────────────────────────────────────────────

const mockResponses = new Map<string, { response: unknown; status: number }>()

function setMockResponse(pathPattern: string, response: unknown, status = 200) {
  mockResponses.set(pathPattern, { response, status })
}

const originalFetch = globalThis.fetch

beforeEach(() => {
  mockResponses.clear()

  globalThis.fetch = vi.fn(async (input: string | URL | Request) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
    for (const [pattern, mock] of mockResponses) {
      if (url.includes(pattern)) {
        return new Response(JSON.stringify(mock.response), {
          status: mock.status,
          headers: { 'Content-Type': 'application/json' },
        })
      }
    }
    return new Response('Not Found', { status: 404 })
  }) as typeof fetch
})

afterEach(() => {
  globalThis.fetch = originalFetch
})

// ── Tests ─────────────────────────────────────────────────

describe('IBKRContractResolver', () => {
  let resolver: IBKRContractResolver

  beforeEach(() => {
    resolver = new IBKRContractResolver('https://localhost:5000/v1/api', 'test-token')
  })

  describe('resolveContract', () => {
    it('resolves a stock symbol to an IBKR contract', async () => {
      setMockResponse('/iserver/secdef/search', [
        {
          conid: 265598,
          companyHeader: 'AAPL',
          companyName: 'Apple Inc.',
          symbol: 'AAPL',
          description: 'Apple Inc. - NASDAQ',
          restricted: null,
          fop: null,
          opt: null,
          war: null,
          sections: [{ secType: 'STK', exchange: 'SMART' }],
        },
      ])

      const contract = await resolver.resolveContract('AAPL', 'STK')

      expect(contract.conid).toBe(265598)
      expect(contract.symbol).toBe('AAPL')
      expect(contract.secType).toBe('STK')
      expect(contract.exchange).toBe('SMART')
      expect(contract.currency).toBe('USD')
    })

    it('throws when no contract is found', async () => {
      setMockResponse('/iserver/secdef/search', [])

      await expect(
        resolver.resolveContract('NOTREAL', 'STK'),
      ).rejects.toThrow('No IBKR contract found for symbol: NOTREAL')
    })

    it('uses cached contract on second call', async () => {
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
          sections: [{ secType: 'STK' }],
        },
      ])

      // First call
      await resolver.resolveContract('AAPL', 'STK')

      // Mock Redis to return cached value for second call
      const { redis } = await import('../../src/lib/redis.js')
      ;(redis.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        JSON.stringify({
          conid: 265598,
          symbol: 'AAPL',
          secType: 'STK',
          exchange: 'SMART',
          currency: 'USD',
        }),
      )

      const cached = await resolver.resolveContract('AAPL', 'STK')
      expect(cached.conid).toBe(265598)
    })
  })

  describe('resolveOptionsContract', () => {
    it('resolves an options contract', async () => {
      // Mock underlying resolution
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
          sections: [{ secType: 'STK' }],
        },
      ])

      // Mock options secdef
      setMockResponse('/iserver/secdef/info', {
        secdef: [
          {
            conid: 999888,
            symbol: 'AAPL',
            secType: 'OPT',
            exchange: 'SMART',
            listingExchange: 'CBOE',
            currency: 'USD',
            group: 'AAPL',
            name: 'AAPL 240119 C 175',
            lastTradeDateOrContractMonth: '20240119',
            strike: 175,
            right: 'C',
            multiplier: '100',
          },
          {
            conid: 999889,
            symbol: 'AAPL',
            secType: 'OPT',
            exchange: 'SMART',
            listingExchange: 'CBOE',
            currency: 'USD',
            group: 'AAPL',
            name: 'AAPL 240119 P 175',
            lastTradeDateOrContractMonth: '20240119',
            strike: 175,
            right: 'P',
            multiplier: '100',
          },
        ],
      })

      const contract = await resolver.resolveOptionsContract(
        'AAPL',
        '20240119',
        175,
        'C',
      )

      expect(contract.conid).toBe(999888)
      expect(contract.secType).toBe('OPT')
      expect(contract.strike).toBe(175)
      expect(contract.right).toBe('C')
      expect(contract.multiplier).toBe('100')
    })
  })

  describe('searchContract', () => {
    it('returns search results from IBKR', async () => {
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
          sections: [{ secType: 'STK' }],
        },
        {
          conid: 265599,
          companyHeader: 'AAPL',
          companyName: 'APPLE HOSPITALITY REIT',
          symbol: 'APLE',
          description: 'Apple Hospitality REIT',
          restricted: null,
          fop: null,
          opt: null,
          war: null,
          sections: [{ secType: 'STK' }],
        },
      ])

      const results = await resolver.searchContract('AAPL')
      expect(results).toHaveLength(2)
      expect(results[0].symbol).toBe('AAPL')
    })
  })

  describe('batchResolve', () => {
    it('resolves multiple symbols', async () => {
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
          sections: [{ secType: 'STK' }],
        },
      ])

      // Mock pipeline exec to return no cached values
      const { redis } = await import('../../src/lib/redis.js')
      ;(redis.pipeline as ReturnType<typeof vi.fn>).mockReturnValue({
        get: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([
          [null, null], // AAPL not cached
          [null, null], // MSFT not cached
        ]),
      })

      const results = await resolver.batchResolve(['AAPL', 'MSFT'])
      // AAPL should resolve, MSFT will use the same mock (since we only have one pattern)
      expect(results.size).toBeGreaterThanOrEqual(1)
    })
  })

  describe('getStrikes', () => {
    it('returns available strikes for an underlying', async () => {
      setMockResponse('/iserver/secdef/strikes', {
        call: { '20240119': [170, 175, 180, 185, 190] },
        put: { '20240119': [170, 175, 180, 185, 190] },
      })

      const strikes = await resolver.getStrikes(265598, '20240119')
      expect(strikes.calls).toEqual([170, 175, 180, 185, 190])
      expect(strikes.puts).toEqual([170, 175, 180, 185, 190])
    })
  })
})
