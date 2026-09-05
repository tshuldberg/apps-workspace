// Badge engine -- badge evaluation and achievement tracking

export {
  evaluateBadges,
  gatherBadgeStats,
  getBadgeProgress,
  computeStreak,
  countDistinctAuthors,
} from './badge-engine';
export type {
  BadgeProgress,
  BadgeEvaluationResult,
  BadgeStats,
  BadgeCategory,
  BadgeTier,
} from './types';
export { BADGE_IDS, BADGE_CATEGORIES } from './definitions';
