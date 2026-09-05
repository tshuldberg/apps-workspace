export type LeagueTier = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';
export type LeagueStatus = 'active' | 'completed';

export interface League {
  id: string;
  name: string;
  seasonStart: string;
  seasonEnd: string;
  tier: LeagueTier;
  maxMembers: number;
  isActive: boolean;
  createdAt: string;
}

export interface LeagueMember {
  id: string;
  leagueId: string;
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  isSelf: boolean;
  joinedAt: string;
}

export interface LeagueScore {
  id: string;
  leagueId: string;
  userId: string;
  weekStart: string;
  xpEarned: number;
  cardsReviewed: number;
  streakDays: number;
  rank: number | null;
  updatedAt: string;
}

export interface XPBreakdown {
  cardsReviewed: number;
  reviewXP: number;
  bonusXP: number;
  streakXP: number;
  activityXP: number;
  totalXP: number;
}

export interface PromotionResult {
  userId: string;
  previousTier: LeagueTier;
  newTier: LeagueTier;
  promoted: boolean;
  demoted: boolean;
}
