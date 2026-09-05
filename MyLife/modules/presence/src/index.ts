// ── Module definition ─────────────────────────────────────────────────────
export { PRESENCE_MODULE } from './definition';

// ── Types & schemas ──────────────────────────────────────────────────────
export type {
  AppCategory,
  DailyUsage,
  AppUsage,
  Goal,
  FocusSession,
  SessionType,
  SessionWhitelist,
  AppIntention,
  AppOpen,
  ScheduledSession,
  BadgeTier,
  EarnedBadge,
  AccountabilityPartner,
  Reward,
  RewardMilestoneType,
  CommitmentContract,
  XPEntry,
  XPSource,
  StreakInfo,
  DailySummary,
  WeeklySummary,
  CategoryBreakdown,
  PresenceSettingKey,
} from './types';
export {
  AppCategorySchema,
  DailyUsageSchema,
  AppUsageSchema,
  GoalSchema,
  FocusSessionSchema,
  SessionWhitelistSchema,
  AppIntentionSchema,
  AppOpenSchema,
  ScheduledSessionSchema,
  BadgeTierSchema,
  EarnedBadgeSchema,
  AccountabilityPartnerSchema,
  RewardMilestoneTypeSchema,
  RewardSchema,
  CommitmentContractSchema,
  XPEntrySchema,
  XPSourceSchema,
  SessionTypeSchema,
  PresenceSettingKeySchema,
} from './types';

// ── CRUD ─────────────────────────────────────────────────────────────────
export {
  // Daily Usage
  upsertDailyUsage,
  getDailyUsageByDate,
  getDailyUsageRange,
  // App Usage
  createAppUsage,
  getAppUsageByDate,
  getAppUsageRange,
  getTopApps,
  // Goals
  createGoal,
  getActiveGoal,
  getAllGoals,
  // Focus Sessions
  createFocusSession,
  completeFocusSession,
  updateFocusSessionRating,
  abandonFocusSession,
  getFocusSession,
  getFocusSessions,
  getFocusSessionsByDate,
  deleteFocusSession,
  // Session Whitelist
  addToWhitelist,
  getWhitelist,
  // App Intentions
  upsertAppIntention,
  getAppIntention,
  getAllActiveIntentions,
  deactivateIntention,
  deleteIntention,
  // App Opens
  recordAppOpen,
  getAppOpen,
  rateAppOpen,
  getAppOpensForDate,
  countAppOpensForDate,
  // Scheduled Sessions
  createScheduledSession,
  getScheduledSessions,
  updateScheduledSession,
  deleteScheduledSession,
  toggleScheduledSession,
  // Badges
  recordBadgeEarned,
  getEarnedBadges,
  isBadgeEarned,
  // Accountability
  generateShareCode,
  createAccountabilityPartner,
  getAccountabilityPartners,
  updateAccountabilityPartner,
  revokeAccountabilityPartner,
  // Rewards
  createReward,
  getRewards,
  markRewardEarned,
  deleteReward,
  // Commitments
  createCommitment,
  getCommitments,
  getActiveCommitment,
  updateCommitment,
  deleteCommitment,
  // XP
  awardXP,
  getTotalXP,
  getXPForDate,
  getXPLog,
  // Settings
  getSetting,
  setSetting,
} from './db';
export type {
  UpsertDailyUsageInput,
  CreateAppUsageInput,
  CreateGoalInput,
  CreateFocusSessionInput,
  CreateAppIntentionInput,
  RecordAppOpenInput,
  CreateScheduledSessionInput,
  UpdateScheduledSessionPatch,
  UpdateAccountabilityPartnerPatch,
  CreateRewardInput,
  AwardXPInput,
} from './db';

// ── Engines ──────────────────────────────────────────────────────────────
export {
  calculateStreaks,
  isStreakAtRisk,
  calculateXP,
  calculateStreakBonus,
  getLevelForXP,
  xpForLevel,
  getXPProgress,
  buildDailySummary,
  buildWeeklySummary,
  buildCategoryBreakdown,
  formatScreenTime,
  calculateImprovement,
  detectWeekendPattern,
  detectMorningPickupTrend,
  detectSessionTimeOfDay,
  detectGoalRegression,
  generatePresenceInsights,
  shouldRunToday,
  nextRunDateTime,
  listUpcomingScheduled,
  BADGE_DEFS,
  computeEarnedBadges,
  getBadgeCurrentValue,
  getBadgeProgress,
  buildBadgeStatsSnapshotFromData,
  buildBadgeStatsSnapshot,
  syncBadges,
  getBadgeDefinitionById,
  evaluateRewards,
  buildRewardEvaluationStats,
  syncRewards,
  getRewardMilestoneLabel,
  getRewardProgress,
  buildPresenceRecommendations,
} from './engines';
export type {
  Insight,
  BadgeDef,
  BadgeStatsSnapshot,
  RewardEvaluationStats,
  PresenceRecommendation,
  PresenceRecommendationContext,
  PresenceRecommendationType,
} from './engines';

// ── Static data ─────────────────────────────────────────────────────────
export {
  APP_LIBRARY,
  findAppLibraryEntry,
} from './data/app-library';
export type {
  AppLibraryEntry,
} from './data/app-library';

// ── Cross-module hooks ──────────────────────────────────────────────────
export { getPresenceCrossModule } from './cross-module';
export type { PresenceCrossModuleInterface } from './cross-module';

// ── Badges & titles ─────────────────────────────────────────────────────
export type {
  PresenceBadgeContext,
  PresenceBadgeDefinition,
  PresenceBadgeState,
} from './badges';
export {
  PRESENCE_BADGE_DEFS,
  getPresenceBadgePreview,
  getPresenceBadgeStates,
  getPresenceLevelTitle,
} from './badges';

// ── UI barrel ────────────────────────────────────────────────────────────
// `./ui/index.ts` has web-safe tokens + pure logic; full RN component
// surface lives in `./ui/index.native.ts` which Metro picks on mobile.
export * from './ui';

// ── CSV export ───────────────────────────────────────────────────────────
export { exportDailyUsageCSV, exportAppUsageCSV, exportSessionsCSV } from './export';
