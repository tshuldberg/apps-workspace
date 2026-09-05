/**
 * Engagement system types.
 */

/** A single day's streak record. */
export interface StreakRecord {
  /** ISO date string (YYYY-MM-DD). */
  date: string;
  /** Number of distinct modules with activity that day. */
  modulesActive: number;
  /** Which modules were active (module IDs). */
  moduleIds: string[];
  /** Running streak count (consecutive qualifying days ending on this date). */
  streakCount: number;
}

/** Current streak status for display. */
export interface StreakStatus {
  /** Current active streak length (0 if broken). */
  currentStreak: number;
  /** All-time longest streak. */
  longestStreak: number;
  /** Date of the most recent qualifying day (YYYY-MM-DD), or null if none. */
  lastActiveDate: string | null;
  /** Whether today qualifies (3+ modules active). */
  todayQualifies: boolean;
  /** Number of modules active today (even if < threshold). */
  todayModuleCount: number;
}

/** Minimum modules active in a day to count toward a streak. */
export const STREAK_THRESHOLD = 3;

/** A single module's contribution to the weekly digest. */
export interface DigestModuleEntry {
  moduleId: string;
  moduleName: string;
  /** Human-readable summary line (e.g., "3 workouts logged"). */
  summary: string;
  /** Count of activities in the period. */
  activityCount: number;
}

/** Weekly digest data. */
export interface WeeklyDigest {
  /** ISO date of the digest period start (Monday). */
  periodStart: string;
  /** ISO date of the digest period end (Sunday). */
  periodEnd: string;
  /** Per-module summaries. */
  modules: DigestModuleEntry[];
  /** One-line formatted summary string. */
  formattedSummary: string;
  /** Total activities across all modules. */
  totalActivities: number;
}

/** A memory card for "This Day Last Year". */
export interface MemoryCard {
  /** The historical date (YYYY-MM-DD). */
  date: string;
  /** How many years ago this was. */
  yearsAgo: number;
  /** Activity items from that day, grouped by module. */
  modules: MemoryModuleEntry[];
  /** Whether any data was found. */
  hasMemories: boolean;
}

/** A single module's memories for a given date. */
export interface MemoryModuleEntry {
  moduleId: string;
  moduleName: string;
  /** Human-readable activity descriptions from that day. */
  activities: string[];
}

/** Preference keys used by the engagement system. */
export const ENGAGEMENT_PREF_KEYS = {
  /** Whether the streak feature is enabled ('true'/'false'). */
  streakEnabled: 'engagement.streak.enabled',
  /** Whether the weekly digest is enabled ('true'/'false'). */
  digestEnabled: 'engagement.digest.enabled',
  /** Whether "This Day Last Year" is enabled ('true'/'false'). */
  memoryEnabled: 'engagement.memory.enabled',
  /** Day of week for digest (0=Sunday, 1=Monday, ...). */
  digestDay: 'engagement.digest.day',
} as const;
