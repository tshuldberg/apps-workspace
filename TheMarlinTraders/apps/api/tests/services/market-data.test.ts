import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { NormalizedBar } from '@marlin/shared'

// Mock the Polygon adapter
vi.mock('../../src/adapters/polygon-rest.js', () => ({
  getAggregates: vi.fn(),
}))

// Mock the db module
vi.mock('../../src/db/index.js', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
  },
}))

const MOCK_BARS: NormalizedBar[] = [
  {
    symbol: 'AAPL',
    timeframe: '1D',
    open: 150.0,
    high: 155.0,
    low: 149.0,
    close: 153.5,
    volume: 50000000,
    timestamp: 1700000000000,
  },
  {
    symbol: 'AAPL',
    timeframe: '1D',
    open: 153.5,
    high: 157.0,
    low: 152.0,
    close: 156.0,
    volume: 45000000,
    timestamp: 1700086400000,
  },
]

describe('MarketDataService', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('should fetch bars from Polygon when cache is empty', async () => {
    const { getAggregates } = await import('../../src/adapters/polygon-rest.js')
    const mockedGetAggs = vi.mocked(getAggregates)
    mockedGetAggs.mockResolvedValue(MOCK_BARS)

    // Mock the db to return empty cache
    const { db } = await import('../../src/db/index.js')
    const mockSelect = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue([]),
        }),
      }),
    })
    ;(db as unknown as { select: typeof mockSelect }).select = mockSelect

    const mockInsert = vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
      }),
    })
    ;(db as unknown as { insert: typeof mockInsert }).insert = mockInsert

    const { MarketDataService } = await import('../../src/services/market-data.js')
    const service = new MarketDataService(db as never)
    const result = await service.getBars('AAPL', '1D', '2023-11-01', '2023-12-01')

    expect(mockedGetAggs).toHaveBeenCalledWith('AAPL', '1D', '2023-11-01', '2023-12-01')
    expect(result).toEqual(MOCK_BARS)
  })

  it('should return cached bars when available', async () => {
    const { getAggregates } = await import('../../src/adapters/polygon-rest.js')
    const mockedGetAggs = vi.mocked(getAggregates)

    const cachedRows = MOCK_BARS.map((b) => ({
      symbol: b.symbol,
      timeframe: b.timeframe,
      timestamp: new Date(b.timestamp),
      open: b.open.toString(),
      high: b.high.toString(),
      low: b.low.toString(),
      close: b.close.toString(),
      volume: b.volume.toString(),
    }))

    const { db } = await import('../../src/db/index.js')
    const mockSelect = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue(cachedRows),
        }),
      }),
    })
    ;(db as unknown as { select: typeof mockSelect }).select = mockSelect

    const { MarketDataService } = await import('../../src/services/market-data.js')
    const service = new MarketDataService(db as never)
    const result = await service.getBars('AAPL', '1D', '2023-11-01', '2023-12-01')

    expect(mockedGetAggs).not.toHaveBeenCalled()
    expect(result).toHaveLength(2)
    expect(result[0]!.open).toBe(150.0)
    expect(result[0]!.symbol).toBe('AAPL')
  })
})
