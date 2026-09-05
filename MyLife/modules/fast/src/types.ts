/** A completed or in-progress fasting session */
export interface Fast {
  id: string;
  protocol: string;
  targetHours: number;
  startedAt: string; // ISO 8601
  endedAt: string | null;
  durationSeconds: number | null;
  hitTarget: boolean | null;
  notes: string | null;
  createdAt: string;
}

/** An active fast (singleton — at most one at a time) */
export interface ActiveFast {
  id: string;
  fastId: string;
  protocol: string;
  targetHours: number;
  startedAt: string; // ISO 8601
}

/** A fasting protocol preset or custom */
export interface Protocol {
  id: string;
  name: string;
  fastingHours: number;
  eatingHours: number;
  description: string | null;
  isCustom: boolean;
  isDefault: boolean;
  sortOrder: number;
}

/** An optional weight log entry */
export interface WeightEntry {
  id: string;
  weightValue: number;
  unit: 'lbs' | 'kg';
  date: string; // ISO date YYYY-MM-DD
  notes: string | null;
  createdAt: string;
}

/** Streak cache values */
export interface StreakCache {
  currentStreak: number;
  longestStreak: number;
  totalFasts: number;
}

/** App settings stored as key-value pairs */
export interface Settings {
  defaultProtocol: string;
  notifyFastComplete: boolean;
  notifyEatingWindowClosing: boolean;
  weightTrackingEnabled: boolean;
  weightUnit: 'lbs' | 'kg';
}

/** Daily water intake row */
export interface WaterIntake {
  date: string; // ISO date YYYY-MM-DD
  count: number;
  target: number;
  completed: boolean;
  updatedAt: string;
}

/** Notification preferences stored in ft_notifications_config */
export interface NotificationPreferences {
  fastStart: boolean;
  progress25: boolean;
  progress50: boolean;
  progress75: boolean;
  fastComplete: boolean;
}

export type GoalType =
  | 'fasts_per_week'
  | 'hours_per_week'
  | 'hours_per_month'
  | 'weight_milestone';

export type GoalDirection = 'at_least' | 'at_most';

/** User-defined goal */
export interface Goal {
  id: string;
  type: GoalType;
  targetValue: number;
  period: 'weekly' | 'monthly' | 'milestone';
  direction: GoalDirection;
  label: string | null;
  unit: string | null;
  startDate: string; // ISO date YYYY-MM-DD
  endDate: string | null; // ISO date YYYY-MM-DD
  isActive: boolean;
  createdAt: string;
}

/** Computed progress snapshot for a goal */
export interface GoalProgress {
  id: string;
  goalId: string;
  periodStart: string; // ISO date YYYY-MM-DD
  periodEnd: string; // ISO date YYYY-MM-DD
  currentValue: number;
  targetValue: number;
  completed: boolean;
  createdAt: string;
}

/** Aggregate summary used for monthly and annual recaps */
export interface SummaryStats {
  totalFasts: number;
  totalHours: number;
  averageDurationHours: number;
  longestFastHours: number;
  adherenceRate: number;
  currentStreak: number;
}

/** Configurable fasting zone card model */
export interface FastingZone {
  id: string;
  name: string;
  startHour: number;
  endHour: number | null;
  title: string;
  description: string;
}

/** Timer state computed from an active fast */
export type FastState = 'idle' | 'fasting' | 'eating_window';

export interface TimerState {
  state: FastState;
  activeFast: ActiveFast | null;
  elapsed: number; // Seconds since fast started
  remaining: number; // Seconds until target (0 if passed)
  progress: number; // 0.0 to 1.0 (capped for ring display)
  targetReached: boolean;
}

// ── HealthKit Sync Types ──

/** Distinguishes manual weight entries from HealthKit-imported ones */
export type WeightSource = 'manual' | 'healthkit';

/** A weight sample from HealthKit to be evaluated for import */
export interface HealthKitWeightSample {
  value: number;
  unit: 'lbs' | 'kg';
  date: string; // ISO date YYYY-MM-DD
  timestamp: string; // ISO 8601 full datetime
}

/** HealthKit sync state for UI */
export interface HealthKitSyncState {
  enabled: boolean;
  readWeight: boolean;
  readActivity: boolean;
  writeFasts: boolean;
  lastSyncTimestamp: string | null;
}

/** Formatted fast data for writing to HealthKit */
export interface HealthKitFastSample {
  startDate: string; // ISO 8601
  endDate: string; // ISO 8601
  metadata: {
    protocol: string;
    targetHours: number;
    hitTarget: boolean;
    app: string;
  };
}

// ── Water Reminder Types ──

/** Configuration for smart water reminders */
export interface WaterReminderConfig {
  enabled: boolean;
  intervalMinutes: number;
  wakeStart: string; // HH:MM format
  wakeEnd: string; // HH:MM format
  pauseDuringDryFast: boolean;
  personalizedGoal: boolean;
}

/** A scheduled reminder time slot */
export interface ReminderSlot {
  hour: number;
  minute: number;
}

// ── Apple Watch Sync Types ──

/** State sent from phone to Watch via applicationContext */
export interface WatchState {
  activeFast: {
    protocol: string;
    startedAt: string; // ISO 8601
    targetHours: number;
    zoneName: string;
    zoneColor: string;
  } | null;
  waterCount: number;
  waterTarget: number;
  timestamp: string; // ISO 8601
}

/** Commands sent from Watch to phone */
export type WatchCommand =
  | { action: 'logWater' }
  | { action: 'startFast'; protocol: string; targetHours: number }
  | { action: 'endFast' }
  | { action: 'requestState' };

/** Result of handling a Watch command */
export interface WatchCommandResult {
  success: boolean;
  state: WatchState;
  error?: string;
}

// ── Multi-Beverage Types ──

/** A beverage type with hydration coefficient */
export interface BeverageType {
  id: string;
  name: string;
  icon: string;
  defaultOz: number;
  coefficient: number;
  caffeineMg: number | null;
  isBuiltin: boolean;
  sortOrder: number;
  createdAt: string;
}

/** A logged beverage entry */
export interface BeverageLog {
  id: string;
  date: string; // ISO date YYYY-MM-DD
  beverageTypeId: string;
  volumeOz: number;
  hydrationOz: number;
  loggedAt: string; // ISO 8601
}

/** Daily hydration summary computed from beverage logs */
export interface HydrationSummary {
  totalHydrationOz: number;
  totalGlasses: number;
  meetsTarget: boolean;
  logCount: number;
}

// ── Caffeine Tracking Types ──

/** Status classification for caffeine intake */
export type CaffeineStatus = 'empty' | 'normal' | 'high' | 'late' | 'critical';

/** A single caffeinated drink log with caffeine amount */
export interface CaffeineSnapshot {
  beverageTypeId: string;
  beverageName: string;
  caffeineMg: number;
  volumeOz: number;
  loggedAt: string; // ISO 8601
}

/** Summary of daily caffeine intake */
export interface CaffeineSummary {
  totalMg: number;
  status: CaffeineStatus;
  drinks: CaffeineSnapshot[];
  remainingMg: number;
  clearByTime: string | null; // ISO 8601 or null if already clear
}

// ── Custom Container Presets ──

/** A saved container preset for quick volume logging */
export interface ContainerPreset {
  id: string;
  name: string;
  volumeOz: number;
  icon: string;
  isBuiltin: boolean;
  sortOrder: number;
  createdAt: string;
}

// ── Eating Window Types ──

/** Minimal info about the last completed fast, used to compute eating window state */
export interface LastCompletedFast {
  endedAt: string; // ISO 8601
  eatingHours: number;
}

// ── Fast Quality Score Types ──

/** Inputs for computing a fast quality score */
export interface FastQualityInput {
  hitTarget: boolean;
  hydrationMet: boolean;
  noLateCaffeine: boolean;
  streakMaintained: boolean;
}

/** Composite quality score for a completed fast (0-100) */
export interface FastQualityScore {
  total: number;
  breakdown: {
    target: number; // 0-40
    hydration: number; // 0-30
    caffeine: number; // 0-20
    streak: number; // 0-10
  };
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
}

// ── Week-in-Review Types ──

/** Weekly summary computed from fasting, hydration, caffeine, and weight data */
export interface WeekInReview {
  periodStart: string; // ISO date
  periodEnd: string; // ISO date
  totalFastingHours: number;
  totalFasts: number;
  completedFasts: number;
  avgDailyHydrationOz: number;
  avgCaffeineMg: number;
  weightDelta: number | null;
  avgQualityScore: number;
  streakAtEnd: number;
  bestDay: string | null; // ISO date of highest quality score day
}

// ── Protocol Progression Types ──

/** Suggestion for the next protocol based on adherence */
export interface ProtocolSuggestion {
  currentProtocolId: string;
  suggestedProtocolId: string | null;
  reason: string;
  consecutiveSuccesses: number;
  threshold: number;
}
