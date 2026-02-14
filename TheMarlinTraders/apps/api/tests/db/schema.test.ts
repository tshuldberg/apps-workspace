import { describe, it, expect } from 'vitest'
import { users, userTierEnum, symbols, symbolTypeEnum, watchlists, watchlistItems } from '../../src/db/schema/index.js'
import { getTableColumns } from 'drizzle-orm'

describe('Database schema exports', () => {
  describe('users table', () => {
    it('exports users table with expected columns', () => {
      const columns = getTableColumns(users)
      expect(columns).toHaveProperty('id')
      expect(columns).toHaveProperty('clerkId')
      expect(columns).toHaveProperty('email')
      expect(columns).toHaveProperty('displayName')
      expect(columns).toHaveProperty('avatarUrl')
      expect(columns).toHaveProperty('tier')
      expect(columns).toHaveProperty('createdAt')
      expect(columns).toHaveProperty('updatedAt')
    })

    it('exports userTierEnum with correct values', () => {
      expect(userTierEnum.enumValues).toEqual(['free', 'pro', 'premium', 'institutional'])
    })
  })

  describe('symbols table', () => {
    it('exports symbols table with expected columns', () => {
      const columns = getTableColumns(symbols)
      expect(columns).toHaveProperty('id')
      expect(columns).toHaveProperty('symbol')
      expect(columns).toHaveProperty('name')
      expect(columns).toHaveProperty('exchange')
      expect(columns).toHaveProperty('type')
      expect(columns).toHaveProperty('currency')
      expect(columns).toHaveProperty('marketCap')
      expect(columns).toHaveProperty('sector')
      expect(columns).toHaveProperty('industry')
      expect(columns).toHaveProperty('isActive')
      expect(columns).toHaveProperty('createdAt')
    })

    it('exports symbolTypeEnum with correct values', () => {
      expect(symbolTypeEnum.enumValues).toEqual(['stock', 'etf', 'crypto', 'forex', 'future', 'option'])
    })
  })

  describe('watchlists table', () => {
    it('exports watchlists table with expected columns', () => {
      const columns = getTableColumns(watchlists)
      expect(columns).toHaveProperty('id')
      expect(columns).toHaveProperty('userId')
      expect(columns).toHaveProperty('name')
      expect(columns).toHaveProperty('position')
      expect(columns).toHaveProperty('createdAt')
      expect(columns).toHaveProperty('updatedAt')
    })
  })

  describe('watchlistItems table', () => {
    it('exports watchlistItems table with expected columns', () => {
      const columns = getTableColumns(watchlistItems)
      expect(columns).toHaveProperty('id')
      expect(columns).toHaveProperty('watchlistId')
      expect(columns).toHaveProperty('symbolId')
      expect(columns).toHaveProperty('position')
      expect(columns).toHaveProperty('addedAt')
    })
  })
})
