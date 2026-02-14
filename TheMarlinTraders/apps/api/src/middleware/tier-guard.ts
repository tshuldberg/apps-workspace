import { TRPCError } from '@trpc/server'
import { eq } from 'drizzle-orm'
import { db } from '../db/connection.js'
import { users } from '../db/schema/users.js'
import type { PlanId } from '../services/billing.js'

/** Feature tier requirements — minimum tier needed to access each feature */
export const FEATURE_TIERS: Record<string, PlanId> = {
  'realtime-data': 'pro',
  'strategy-builder': 'pro',
  'unlimited-indicators': 'premium',
  'unlimited-alerts': 'premium',
  'live-trading': 'premium',
  'backtesting': 'premium',
  'team-workspaces': 'institutional',
  'compliance': 'institutional',
  'var-analytics': 'institutional',
  'twap-vwap': 'institutional',
}

/** Tier hierarchy for comparison */
const TIER_RANK: Record<PlanId, number> = {
  free: 0,
  pro: 1,
  premium: 2,
  institutional: 3,
}

/**
 * Check if a user's tier meets the minimum required tier.
 */
export function meetsMinimumTier(userTier: PlanId, requiredTier: PlanId): boolean {
  return TIER_RANK[userTier] >= TIER_RANK[requiredTier]
}

/**
 * Get the user's current tier from the database.
 */
export async function getUserTier(clerkUserId: string): Promise<PlanId> {
  const [user] = await db
    .select({ tier: users.tier })
    .from(users)
    .where(eq(users.clerkId, clerkUserId))

  return (user?.tier as PlanId) ?? 'free'
}

/**
 * Enforce tier requirements for a feature. Throws a FORBIDDEN error with
 * an upgrade prompt if the user's tier is insufficient.
 */
export async function enforceTier(clerkUserId: string, feature: string): Promise<void> {
  const requiredTier = FEATURE_TIERS[feature]
  if (!requiredTier) {
    // No tier requirement — allow access
    return
  }

  const userTier = await getUserTier(clerkUserId)

  if (!meetsMinimumTier(userTier, requiredTier)) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: `Upgrade to ${requiredTier} to access ${feature}. You are currently on the ${userTier} plan.`,
    })
  }
}

/**
 * Get all features available to a given tier.
 */
export function getAvailableFeatures(tier: PlanId): string[] {
  return Object.entries(FEATURE_TIERS)
    .filter(([, requiredTier]) => meetsMinimumTier(tier, requiredTier))
    .map(([feature]) => feature)
}

/**
 * Get features that require upgrade from the user's current tier.
 */
export function getLockedFeatures(tier: PlanId): Array<{ feature: string; requiredTier: PlanId }> {
  return Object.entries(FEATURE_TIERS)
    .filter(([, requiredTier]) => !meetsMinimumTier(tier, requiredTier))
    .map(([feature, requiredTier]) => ({ feature, requiredTier }))
}
