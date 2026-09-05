export { calculateStreaks, isStreakAtRisk } from './streaks';
export { calculateXP, calculateStreakBonus, getLevelForXP, xpForLevel, getXPProgress } from './xp';
export {
  buildDailySummary,
  buildWeeklySummary,
  buildCategoryBreakdown,
  formatScreenTime,
  calculateImprovement,
} from './stats';
export {
  detectWeekendPattern,
  detectMorningPickupTrend,
  detectSessionTimeOfDay,
  detectGoalRegression,
  generatePresenceInsights,
} from './insights';
export type { Insight } from './insights';
export { shouldRunToday, nextRunDateTime, listUpcomingScheduled } from './schedule';
export {
  BADGE_DEFS,
  computeEarnedBadges,
  getBadgeCurrentValue,
  getBadgeProgress,
  buildBadgeStatsSnapshotFromData,
} from './badges';
export type { BadgeDef, BadgeStatsSnapshot } from './badges';
export { buildBadgeStatsSnapshot, syncBadges, getBadgeDefinitionById } from './badges-sync';
export { evaluateRewards, buildRewardEvaluationStats, syncRewards, getRewardMilestoneLabel, getRewardProgress } from './rewards';
export type { RewardEvaluationStats } from './rewards';
export {
  buildPresenceRecommendations,
} from './recommendations';
export type {
  PresenceRecommendation,
  PresenceRecommendationContext,
  PresenceRecommendationType,
} from './recommendations';
