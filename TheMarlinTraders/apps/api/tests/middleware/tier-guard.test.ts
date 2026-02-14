import { describe, it, expect, vi, beforeEach } from 'vitest'
import { meetsMinimumTier, getAvailableFeatures, getLockedFeatures } from '../../src/middleware/tier-guard.js'

// Mock the db for getUserTier / enforceTier
vi.mock('../../src/db/connection.js', () => ({
  db: {
    select: vi.fn(),
  },
}))

vi.mock('../../src/db/schema/users.js', () => ({
  users: { tier: 'tier', clerkId: 'clerk_id' },
}))

describe('tier-guard', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  describe('meetsMinimumTier', () => {
    it('free meets free', () => {
      expect(meetsMinimumTier('free', 'free')).toBe(true)
    })

    it('free does not meet pro', () => {
      expect(meetsMinimumTier('free', 'pro')).toBe(false)
    })

    it('pro meets pro', () => {
      expect(meetsMinimumTier('pro', 'pro')).toBe(true)
    })

    it('premium meets pro', () => {
      expect(meetsMinimumTier('premium', 'pro')).toBe(true)
    })

    it('premium meets premium', () => {
      expect(meetsMinimumTier('premium', 'premium')).toBe(true)
    })

    it('pro does not meet premium', () => {
      expect(meetsMinimumTier('pro', 'premium')).toBe(false)
    })

    it('institutional meets everything', () => {
      expect(meetsMinimumTier('institutional', 'free')).toBe(true)
      expect(meetsMinimumTier('institutional', 'pro')).toBe(true)
      expect(meetsMinimumTier('institutional', 'premium')).toBe(true)
      expect(meetsMinimumTier('institutional', 'institutional')).toBe(true)
    })
  })

  describe('getAvailableFeatures', () => {
    it('free user gets no gated features', () => {
      const features = getAvailableFeatures('free')
      expect(features).toEqual([])
    })

    it('pro user gets pro-tier features', () => {
      const features = getAvailableFeatures('pro')
      expect(features).toContain('realtime-data')
      expect(features).toContain('strategy-builder')
      expect(features).not.toContain('live-trading')
      expect(features).not.toContain('team-workspaces')
    })

    it('premium user gets pro + premium features', () => {
      const features = getAvailableFeatures('premium')
      expect(features).toContain('realtime-data')
      expect(features).toContain('unlimited-indicators')
      expect(features).toContain('live-trading')
      expect(features).not.toContain('team-workspaces')
    })

    it('institutional user gets all features', () => {
      const features = getAvailableFeatures('institutional')
      expect(features).toContain('realtime-data')
      expect(features).toContain('unlimited-indicators')
      expect(features).toContain('team-workspaces')
      expect(features).toContain('compliance')
    })
  })

  describe('getLockedFeatures', () => {
    it('free user has all features locked', () => {
      const locked = getLockedFeatures('free')
      expect(locked.length).toBeGreaterThan(0)
      expect(locked.some((f) => f.feature === 'realtime-data')).toBe(true)
    })

    it('pro user has premium and institutional features locked', () => {
      const locked = getLockedFeatures('pro')
      expect(locked.some((f) => f.feature === 'live-trading')).toBe(true)
      expect(locked.some((f) => f.feature === 'team-workspaces')).toBe(true)
      expect(locked.some((f) => f.feature === 'realtime-data')).toBe(false)
    })

    it('institutional user has nothing locked', () => {
      const locked = getLockedFeatures('institutional')
      expect(locked).toEqual([])
    })
  })
})
