import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ScreenerFilterSet } from '../../../src/db/schema/screeners.js'

// Mock the db module before importing engine
vi.mock('../../../src/db/connection.js', () => ({
  db: {
    execute: vi.fn().mockResolvedValue({ rows: [] }),
  },
}))

vi.mock('../../../src/middleware/tier-guard.js', () => ({
  getUserTier: vi.fn().mockResolvedValue('free'),
  meetsMinimumTier: vi.fn((userTier: string, required: string) => {
    const ranks: Record<string, number> = { free: 0, pro: 1, premium: 2, institutional: 3 }
    return (ranks[userTier] ?? 0) >= (ranks[required] ?? 0)
  }),
}))

import { runScreenerScan, type ScanOutput } from '../../../src/services/screener-engine.js'
import { db } from '../../../src/db/connection.js'
import { getUserTier } from '../../../src/middleware/tier-guard.js'

describe('ScreenerEngine', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default mock: return empty count and empty rows
    ;(db.execute as any).mockResolvedValue({ rows: [] })
  })

  describe('runScreenerScan', () => {
    it('returns empty results when no symbols match', async () => {
      ;(db.execute as any)
        .mockResolvedValueOnce({ rows: [{ total: 0 }] }) // count
        .mockResolvedValueOnce({ rows: [] }) // data

      const filters: ScreenerFilterSet = {
        logic: 'AND',
        filters: [
          { field: 'market_cap', operator: 'gt', value: 1000000000, category: 'fundamental' },
        ],
      }

      const result = await runScreenerScan({ filters })

      expect(result.results).toHaveLength(0)
      expect(result.total).toBe(0)
      expect(result.appliedFilters).toBe(1)
      expect(result.executionMs).toBeGreaterThanOrEqual(0)
    })

    it('returns results with correct shape', async () => {
      ;(db.execute as any)
        .mockResolvedValueOnce({ rows: [{ total: 2 }] })
        .mockResolvedValueOnce({
          rows: [
            { symbol: 'AAPL', name: 'Apple Inc.', exchange: 'NASDAQ', sector: 'Technology', industry: 'Consumer Electronics', marketCap: '3000000000000' },
            { symbol: 'MSFT', name: 'Microsoft Corp', exchange: 'NASDAQ', sector: 'Technology', industry: 'Software', marketCap: '2800000000000' },
          ],
        })

      const filters: ScreenerFilterSet = {
        logic: 'AND',
        filters: [
          { field: 'sector', operator: 'eq', value: 'Technology', category: 'fundamental' },
        ],
      }

      const result = await runScreenerScan({ filters })

      expect(result.results).toHaveLength(2)
      expect(result.total).toBe(2)
      expect(result.results[0]!.symbol).toBe('AAPL')
      expect(result.results[0]!.name).toBe('Apple Inc.')
      expect(result.results[0]!.marketCap).toBe(3000000000000)
      expect(result.results[1]!.symbol).toBe('MSFT')
    })

    it('flags results as delayed for free tier users', async () => {
      ;(getUserTier as any).mockResolvedValueOnce('free')
      ;(db.execute as any)
        .mockResolvedValueOnce({ rows: [{ total: 0 }] })
        .mockResolvedValueOnce({ rows: [] })

      const filters: ScreenerFilterSet = { logic: 'AND', filters: [{ field: 'sector', operator: 'eq', value: 'Technology', category: 'fundamental' }] }
      const result = await runScreenerScan({ filters, clerkUserId: 'user_free' })

      expect(result.isDelayed).toBe(true)
    })

    it('flags results as real-time for pro tier users', async () => {
      ;(getUserTier as any).mockResolvedValueOnce('pro')
      ;(db.execute as any)
        .mockResolvedValueOnce({ rows: [{ total: 0 }] })
        .mockResolvedValueOnce({ rows: [] })

      const filters: ScreenerFilterSet = { logic: 'AND', filters: [{ field: 'sector', operator: 'eq', value: 'Technology', category: 'fundamental' }] }
      const result = await runScreenerScan({ filters, clerkUserId: 'user_pro' })

      expect(result.isDelayed).toBe(false)
    })

    it('respects limit and offset parameters', async () => {
      ;(db.execute as any)
        .mockResolvedValueOnce({ rows: [{ total: 100 }] })
        .mockResolvedValueOnce({ rows: [{ symbol: 'TSLA', name: 'Tesla', exchange: null, sector: null, industry: null, marketCap: null }] })

      const filters: ScreenerFilterSet = { logic: 'AND', filters: [{ field: 'market_cap', operator: 'gt', value: 0, category: 'fundamental' }] }
      const result = await runScreenerScan({ filters, limit: 10, offset: 20 })

      expect(result.total).toBe(100)
      expect(result.results).toHaveLength(1) // mock returns 1 row
    })

    it('handles multiple filters with AND logic', async () => {
      ;(db.execute as any)
        .mockResolvedValueOnce({ rows: [{ total: 5 }] })
        .mockResolvedValueOnce({ rows: [] })

      const filters: ScreenerFilterSet = {
        logic: 'AND',
        filters: [
          { field: 'sector', operator: 'eq', value: 'Technology', category: 'fundamental' },
          { field: 'market_cap', operator: 'gt', value: 1000000000, category: 'fundamental' },
          { field: 'exchange', operator: 'eq', value: 'NASDAQ', category: 'fundamental' },
        ],
      }

      const result = await runScreenerScan({ filters })
      expect(result.appliedFilters).toBe(3)
      // Verify db.execute was called (count + data queries)
      expect(db.execute).toHaveBeenCalledTimes(2)
    })

    it('handles OR logic', async () => {
      ;(db.execute as any)
        .mockResolvedValueOnce({ rows: [{ total: 0 }] })
        .mockResolvedValueOnce({ rows: [] })

      const filters: ScreenerFilterSet = {
        logic: 'OR',
        filters: [
          { field: 'sector', operator: 'eq', value: 'Technology', category: 'fundamental' },
          { field: 'sector', operator: 'eq', value: 'Healthcare', category: 'fundamental' },
        ],
      }

      const result = await runScreenerScan({ filters })
      expect(result.appliedFilters).toBe(2)
    })

    it('handles between operator', async () => {
      ;(db.execute as any)
        .mockResolvedValueOnce({ rows: [{ total: 0 }] })
        .mockResolvedValueOnce({ rows: [] })

      const filters: ScreenerFilterSet = {
        logic: 'AND',
        filters: [
          { field: 'market_cap', operator: 'between', value: [1000000000, 10000000000], category: 'fundamental' },
        ],
      }

      const result = await runScreenerScan({ filters })
      expect(result.appliedFilters).toBe(1)
    })

    it('handles in operator', async () => {
      ;(db.execute as any)
        .mockResolvedValueOnce({ rows: [{ total: 0 }] })
        .mockResolvedValueOnce({ rows: [] })

      const filters: ScreenerFilterSet = {
        logic: 'AND',
        filters: [
          { field: 'exchange', operator: 'in', value: ['NASDAQ', 'NYSE'], category: 'fundamental' },
        ],
      }

      const result = await runScreenerScan({ filters })
      expect(result.appliedFilters).toBe(1)
    })

    it('skips unknown filter fields gracefully', async () => {
      ;(db.execute as any)
        .mockResolvedValueOnce({ rows: [{ total: 0 }] })
        .mockResolvedValueOnce({ rows: [] })

      const filters: ScreenerFilterSet = {
        logic: 'AND',
        filters: [
          { field: 'unknown_field_xyz', operator: 'gt', value: 0, category: 'fundamental' },
        ],
      }

      // Should not throw
      const result = await runScreenerScan({ filters })
      expect(result.appliedFilters).toBe(1)
    })

    it('defaults to delayed when no user is provided', async () => {
      ;(db.execute as any)
        .mockResolvedValueOnce({ rows: [{ total: 0 }] })
        .mockResolvedValueOnce({ rows: [] })

      const filters: ScreenerFilterSet = { logic: 'AND', filters: [{ field: 'sector', operator: 'eq', value: 'Technology', category: 'fundamental' }] }
      const result = await runScreenerScan({ filters })

      expect(result.isDelayed).toBe(true)
    })
  })
})
