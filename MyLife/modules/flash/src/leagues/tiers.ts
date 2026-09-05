import type { LeagueTier } from './types';

export interface TierDefinition {
  tier: LeagueTier;
  name: string;
  color: string;
  icon: string;
  order: number;
}

export const TIER_DEFINITIONS: Record<LeagueTier, TierDefinition> = {
  bronze: { tier: 'bronze', name: 'Bronze', color: '#CD7F32', icon: 'shield', order: 0 },
  silver: { tier: 'silver', name: 'Silver', color: '#C0C0C0', icon: 'shield', order: 1 },
  gold: { tier: 'gold', name: 'Gold', color: '#FFD700', icon: 'shield', order: 2 },
  platinum: { tier: 'platinum', name: 'Platinum', color: '#E5E4E2', icon: 'shield', order: 3 },
  diamond: { tier: 'diamond', name: 'Diamond', color: '#B9F2FF', icon: 'shield', order: 4 },
};

export const TIER_ORDER: LeagueTier[] = ['bronze', 'silver', 'gold', 'platinum', 'diamond'];

export function getTierDefinition(tier: LeagueTier): TierDefinition {
  return TIER_DEFINITIONS[tier];
}

export function getNextTier(tier: LeagueTier): LeagueTier | null {
  const idx = TIER_ORDER.indexOf(tier);
  return idx < TIER_ORDER.length - 1 ? TIER_ORDER[idx + 1] : null;
}

export function getPreviousTier(tier: LeagueTier): LeagueTier | null {
  const idx = TIER_ORDER.indexOf(tier);
  return idx > 0 ? TIER_ORDER[idx - 1] : null;
}
