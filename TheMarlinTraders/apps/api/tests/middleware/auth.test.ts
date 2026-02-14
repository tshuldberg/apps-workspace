import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock @clerk/backend before importing the module under test
vi.mock('@clerk/backend', () => ({
  createClerkClient: () => ({
    verifyToken: vi.fn().mockRejectedValue(new Error('Invalid token')),
  }),
}))

// Set env var before importing auth module
process.env.CLERK_SECRET_KEY = 'sk_test_fake'

const { verifyAuth } = await import('../../src/middleware/auth.js')

describe('Auth middleware', () => {
  it('returns null when no Authorization header is provided', async () => {
    const result = await verifyAuth(null)
    expect(result).toBeNull()
  })

  it('returns null when Authorization header does not start with Bearer', async () => {
    const result = await verifyAuth('Basic abc123')
    expect(result).toBeNull()
  })

  it('returns null when token is empty after Bearer prefix', async () => {
    const result = await verifyAuth('Bearer ')
    expect(result).toBeNull()
  })

  it('returns null for an invalid JWT token', async () => {
    const result = await verifyAuth('Bearer invalid.jwt.token')
    expect(result).toBeNull()
  })
})
