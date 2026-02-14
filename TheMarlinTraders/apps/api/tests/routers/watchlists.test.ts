import { describe, it, expect } from 'vitest'
import { z } from 'zod'

// Mirror the input schemas used by the watchlist router for validation testing
const CreateInput = z.object({ name: z.string().min(1).max(64) })
const RenameInput = z.object({ id: z.string().uuid(), name: z.string().min(1).max(64) })
const DeleteInput = z.object({ id: z.string().uuid() })
const GetInput = z.object({ id: z.string().uuid() })
const AddItemInput = z.object({
  watchlistId: z.string().uuid(),
  symbolId: z.number().int().positive(),
})
const RemoveItemInput = z.object({ itemId: z.string().uuid() })
const ReorderInput = z.object({
  watchlistId: z.string().uuid(),
  itemIds: z.array(z.string().uuid()),
})

describe('watchlist router input validation', () => {
  describe('create', () => {
    it('accepts valid name', () => {
      const result = CreateInput.safeParse({ name: 'My Watchlist' })
      expect(result.success).toBe(true)
    })

    it('rejects empty name', () => {
      const result = CreateInput.safeParse({ name: '' })
      expect(result.success).toBe(false)
    })

    it('rejects name longer than 64 chars', () => {
      const result = CreateInput.safeParse({ name: 'a'.repeat(65) })
      expect(result.success).toBe(false)
    })

    it('accepts name at max length', () => {
      const result = CreateInput.safeParse({ name: 'a'.repeat(64) })
      expect(result.success).toBe(true)
    })
  })

  describe('rename', () => {
    it('accepts valid uuid and name', () => {
      const result = RenameInput.safeParse({
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Tech Stocks',
      })
      expect(result.success).toBe(true)
    })

    it('rejects invalid uuid', () => {
      const result = RenameInput.safeParse({ id: 'not-a-uuid', name: 'Test' })
      expect(result.success).toBe(false)
    })

    it('rejects empty name', () => {
      const result = RenameInput.safeParse({
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: '',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('delete', () => {
    it('accepts valid uuid', () => {
      const result = DeleteInput.safeParse({
        id: '550e8400-e29b-41d4-a716-446655440000',
      })
      expect(result.success).toBe(true)
    })

    it('rejects invalid uuid', () => {
      const result = DeleteInput.safeParse({ id: '123' })
      expect(result.success).toBe(false)
    })
  })

  describe('get', () => {
    it('accepts valid uuid', () => {
      const result = GetInput.safeParse({
        id: '550e8400-e29b-41d4-a716-446655440000',
      })
      expect(result.success).toBe(true)
    })
  })

  describe('addItem', () => {
    it('accepts valid input', () => {
      const result = AddItemInput.safeParse({
        watchlistId: '550e8400-e29b-41d4-a716-446655440000',
        symbolId: 1,
      })
      expect(result.success).toBe(true)
    })

    it('rejects non-positive symbolId', () => {
      const result = AddItemInput.safeParse({
        watchlistId: '550e8400-e29b-41d4-a716-446655440000',
        symbolId: 0,
      })
      expect(result.success).toBe(false)
    })

    it('rejects non-integer symbolId', () => {
      const result = AddItemInput.safeParse({
        watchlistId: '550e8400-e29b-41d4-a716-446655440000',
        symbolId: 1.5,
      })
      expect(result.success).toBe(false)
    })
  })

  describe('removeItem', () => {
    it('accepts valid uuid', () => {
      const result = RemoveItemInput.safeParse({
        itemId: '550e8400-e29b-41d4-a716-446655440000',
      })
      expect(result.success).toBe(true)
    })
  })

  describe('reorderItems', () => {
    it('accepts valid input', () => {
      const result = ReorderInput.safeParse({
        watchlistId: '550e8400-e29b-41d4-a716-446655440000',
        itemIds: [
          '550e8400-e29b-41d4-a716-446655440001',
          '550e8400-e29b-41d4-a716-446655440002',
        ],
      })
      expect(result.success).toBe(true)
    })

    it('accepts empty itemIds array', () => {
      const result = ReorderInput.safeParse({
        watchlistId: '550e8400-e29b-41d4-a716-446655440000',
        itemIds: [],
      })
      expect(result.success).toBe(true)
    })

    it('rejects non-uuid in itemIds', () => {
      const result = ReorderInput.safeParse({
        watchlistId: '550e8400-e29b-41d4-a716-446655440000',
        itemIds: ['not-a-uuid'],
      })
      expect(result.success).toBe(false)
    })
  })
})

describe('search router input validation', () => {
  const SearchInput = z.object({
    query: z.string().min(1).max(100),
    limit: z.number().int().min(1).max(50).optional().default(20),
    type: z
      .enum(['stock', 'etf', 'crypto', 'forex', 'future', 'option'])
      .optional(),
  })

  it('accepts valid query', () => {
    const result = SearchInput.safeParse({ query: 'AAPL' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.limit).toBe(20) // default
    }
  })

  it('rejects empty query', () => {
    const result = SearchInput.safeParse({ query: '' })
    expect(result.success).toBe(false)
  })

  it('rejects query over 100 chars', () => {
    const result = SearchInput.safeParse({ query: 'a'.repeat(101) })
    expect(result.success).toBe(false)
  })

  it('accepts valid type filter', () => {
    const result = SearchInput.safeParse({ query: 'BTC', type: 'crypto' })
    expect(result.success).toBe(true)
  })

  it('rejects invalid type filter', () => {
    const result = SearchInput.safeParse({ query: 'AAPL', type: 'bond' })
    expect(result.success).toBe(false)
  })

  it('accepts custom limit', () => {
    const result = SearchInput.safeParse({ query: 'AAPL', limit: 10 })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.limit).toBe(10)
    }
  })

  it('rejects limit over 50', () => {
    const result = SearchInput.safeParse({ query: 'AAPL', limit: 51 })
    expect(result.success).toBe(false)
  })
})
