/**
 * Badge engine types.
 */

import type { Badge } from '../db/badges';

export type { BadgeCategory, BadgeTier } from '../db/badges';

export interface BadgeProgress {
  badge: Badge;
  currentValue: number;
  isEarned: boolean;
  progressText: string;
}

export interface BadgeEvaluationResult {
  newlyEarned: Badge[];
  allProgress: BadgeProgress[];
}

export interface BadgeStats {
  totalBooks: number;
  totalPages: number;
  genreCount: number;
  authorCount: number;
  currentStreak: number;
  completedChallenges: number;
  reviewCount: number;
  journalCount: number;
  fastestBookDays: number | null;
}
