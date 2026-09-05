/**
 * Seller verification level engine.
 *
 * Pure function: input = stats, output = verification level.
 * No auto-demotion: levels only increase.
 *
 * Level requirements:
 *   unverified  - nothing
 *   basic       - email verified
 *   verified    - email + phone + photo
 *   trusted     - verified + 5 sales + 4.0+ rating
 *   top_seller  - trusted + 25 sales + 4.5+ rating + 90%+ response + 30+ day account
 */

import type { VerificationLevel } from '../types';

export interface VerificationStats {
  emailVerified: boolean;
  phoneVerified: boolean;
  photoVerified: boolean;
  idVerified: boolean;
  completedSales: number;
  totalReviews: number;
  averageRating: number | null;
  responseRate: number | null;
  accountAgeDays: number;
}

/** Listing limits per verification level */
export const LISTING_LIMITS: Record<VerificationLevel, number> = {
  unverified: 5,
  basic: 25,
  verified: 50,
  trusted: 100,
  top_seller: 100,
};

/**
 * Calculate the verification level a seller qualifies for.
 * Levels are progressive -- each builds on the previous.
 */
export function calculateVerificationLevel(
  stats: VerificationStats,
): VerificationLevel {
  if (!stats.emailVerified) return 'unverified';

  // basic: email verified
  if (!stats.phoneVerified || !stats.photoVerified) return 'basic';

  // verified: email + phone + photo
  const rating = stats.averageRating ?? 0;
  if (stats.completedSales < 5 || rating < 4.0) return 'verified';

  // trusted: verified + 5 sales + 4.0 rating
  const responseRate = stats.responseRate ?? 0;
  if (
    stats.completedSales < 25 ||
    rating < 4.5 ||
    responseRate < 90 ||
    stats.accountAgeDays < 30
  ) {
    return 'trusted';
  }

  // top_seller: all requirements met
  return 'top_seller';
}

/**
 * Resolve the effective level, accounting for no-demotion rule.
 * If current level is higher than calculated, keep current.
 */
export function resolveEffectiveLevel(
  currentLevel: VerificationLevel,
  calculatedLevel: VerificationLevel,
): VerificationLevel {
  const order: VerificationLevel[] = [
    'unverified',
    'basic',
    'verified',
    'trusted',
    'top_seller',
  ];
  const currentIndex = order.indexOf(currentLevel);
  const calculatedIndex = order.indexOf(calculatedLevel);
  return calculatedIndex >= currentIndex ? calculatedLevel : currentLevel;
}

/**
 * Check if a seller can create a new listing given their level and active count.
 */
export function canCreateListing(
  level: VerificationLevel,
  activeListingCount: number,
): boolean {
  return activeListingCount < LISTING_LIMITS[level];
}
