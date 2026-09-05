/**
 * @mylife/engagement -- Retention without manipulation.
 *
 * Three opt-in engagement features:
 * 1. Life Engagement Streak -- tracks consecutive days with 3+ active modules
 * 2. Weekly Digest -- aggregates activity across modules into a summary
 * 3. This Day Last Year -- surfaces cross-module memory cards
 *
 * All features are opt-in via hub_preferences. No dark patterns.
 */

// Schema
export { ENGAGEMENT_TABLES, ensureEngagementTables } from './schema';

// Streaks
export {
  recordDailyActivity,
  getStreakRecord,
  getStreakStatus,
  backfillStreaks,
  getStreakHistory,
  getPreviousDate,
  getNextDate,
} from './streaks';

// Weekly Digest
export { generateWeeklyDigest } from './digest';

// Memories (This Day Last Year)
export { getMemoryCard, getAvailableMemories, getDateYearsAgo } from './memories';

// Preferences
export {
  isStreakEnabled,
  isDigestEnabled,
  isMemoryEnabled,
  setStreakEnabled,
  setDigestEnabled,
  setMemoryEnabled,
  getDigestDay,
  setDigestDay,
} from './preferences';

// Types
export type {
  StreakRecord,
  StreakStatus,
  DigestModuleEntry,
  WeeklyDigest,
  MemoryCard,
  MemoryModuleEntry,
} from './types';

export { STREAK_THRESHOLD, ENGAGEMENT_PREF_KEYS } from './types';
