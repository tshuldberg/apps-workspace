import { z } from 'zod';

// ── App Categories ──────────────────────────────────────────────────────

export const AppCategorySchema = z.enum([
  'social',
  'entertainment',
  'productivity',
  'communication',
  'utilities',
  'media',
  'audio',
  'work',
  'gaming',
  'news',
  'shopping',
  'health',
  'education',
  'other',
]);
export type AppCategory = z.infer<typeof AppCategorySchema>;

// ── Daily Usage ─────────────────────────────────────────────────────────

export const DailyUsageSchema = z.object({
  id: z.string(),
  date: z.string(),
  total_minutes: z.number(),
  goal_minutes: z.number().nullable(),
  goal_met: z.number().int().min(0).max(1),
  pickups: z.number().int().default(0),
  first_pickup: z.string().nullable(),
  last_pickup: z.string().nullable(),
  created_at: z.string(),
});
export type DailyUsage = z.infer<typeof DailyUsageSchema>;

// ── App Usage ───────────────────────────────────────────────────────────

export const AppUsageSchema = z.object({
  id: z.string(),
  date: z.string(),
  app_id: z.string(),
  app_name: z.string(),
  category: AppCategorySchema,
  minutes: z.number(),
  opens: z.number().int().default(0),
  created_at: z.string(),
});
export type AppUsage = z.infer<typeof AppUsageSchema>;

// ── Goals ───────────────────────────────────────────────────────────────

export const GoalSchema = z.object({
  id: z.string(),
  daily_minutes: z.number().int().positive(),
  effective_date: z.string(),
  created_at: z.string(),
});
export type Goal = z.infer<typeof GoalSchema>;

// ── Focus Sessions ──────────────────────────────────────────────────────

export const SessionTypeSchema = z.enum(['solo', 'group', 'beast']);
export type SessionType = z.infer<typeof SessionTypeSchema>;

export const FocusSessionSchema = z.object({
  id: z.string(),
  start_time: z.string(),
  end_time: z.string().nullable(),
  planned_minutes: z.number().int().positive(),
  actual_minutes: z.number().nullable(),
  completed: z.number().int().min(0).max(1),
  type: SessionTypeSchema,
  rating: z.number().int().min(1).max(5).nullable(),
  created_at: z.string(),
});
export type FocusSession = z.infer<typeof FocusSessionSchema>;

// ── Session Whitelist ───────────────────────────────────────────────────

export const SessionWhitelistSchema = z.object({
  id: z.string(),
  session_id: z.string(),
  app_id: z.string(),
  app_name: z.string(),
});
export type SessionWhitelist = z.infer<typeof SessionWhitelistSchema>;

// ── App Intentions ──────────────────────────────────────────────────────

export const AppIntentionSchema = z.object({
  id: z.string(),
  app_id: z.string(),
  app_name: z.string(),
  daily_open_limit: z.number().int().positive().nullable(),
  per_open_minutes: z.number().int().positive().nullable(),
  breathing_pause: z.number().int().min(0).max(1).default(0),
  active: z.number().int().min(0).max(1).default(1),
  created_at: z.string(),
});
export type AppIntention = z.infer<typeof AppIntentionSchema>;

// ── App Opens ───────────────────────────────────────────────────────────

export const AppOpenSchema = z.object({
  id: z.string(),
  date: z.string(),
  app_id: z.string(),
  opened_at: z.string(),
  intention_text: z.string().nullable(),
  post_rating: z.number().int().min(1).max(5).nullable(),
  reflection_note: z.string().nullable().optional(),
  created_at: z.string(),
});
export type AppOpen = z.infer<typeof AppOpenSchema>;

// ── Scheduled Sessions ───────────────────────────────────────────────────

export const ScheduledSessionSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  durationMinutes: z.number().int().positive(),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).min(1),
  whitelist: z.array(z.string()).default([]),
  sessionType: SessionTypeSchema,
  active: z.boolean(),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
});
export type ScheduledSession = z.infer<typeof ScheduledSessionSchema>;

// ── Badges ───────────────────────────────────────────────────────────────

export const BadgeTierSchema = z.enum(['bronze', 'silver', 'gold']);
export type BadgeTier = z.infer<typeof BadgeTierSchema>;

export const EarnedBadgeSchema = z.object({
  id: z.string(),
  badgeId: z.string(),
  category: z.string(),
  tier: BadgeTierSchema,
  earnedAt: z.number().int().nonnegative(),
  createdAt: z.number().int().nonnegative(),
});
export type EarnedBadge = z.infer<typeof EarnedBadgeSchema>;

// ── Accountability Partners ──────────────────────────────────────────────

export const AccountabilityPartnerSchema = z.object({
  id: z.string(),
  partnerName: z.string().min(1),
  shareCode: z.string().min(8).max(8),
  active: z.boolean(),
  notifyOverGoal: z.boolean(),
  createdAt: z.number().int().nonnegative(),
});
export type AccountabilityPartner = z.infer<typeof AccountabilityPartnerSchema>;

// ── Rewards ──────────────────────────────────────────────────────────────

export const RewardMilestoneTypeSchema = z.enum(['streak', 'sessions', 'xp', 'goal-met-days']);
export type RewardMilestoneType = z.infer<typeof RewardMilestoneTypeSchema>;

export const RewardSchema = z.object({
  id: z.string(),
  milestoneType: RewardMilestoneTypeSchema,
  milestoneValue: z.number().int().positive(),
  rewardText: z.string().min(1),
  earned: z.boolean(),
  earnedAt: z.number().int().nonnegative().nullable(),
  createdAt: z.number().int().nonnegative(),
});
export type Reward = z.infer<typeof RewardSchema>;

// ── Commitment Contracts ─────────────────────────────────────────────────

export const CommitmentContractSchema = z.object({
  id: z.string(),
  text: z.string().min(1),
  active: z.boolean(),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
});
export type CommitmentContract = z.infer<typeof CommitmentContractSchema>;

// ── XP Log ──────────────────────────────────────────────────────────────

export const XPSourceSchema = z.enum(['goal', 'session', 'intention', 'streak']);
export type XPSource = z.infer<typeof XPSourceSchema>;

export const XPEntrySchema = z.object({
  id: z.string(),
  date: z.string(),
  source: XPSourceSchema,
  amount: z.number().int(),
  created_at: z.string(),
});
export type XPEntry = z.infer<typeof XPEntrySchema>;

// ── Streaks ─────────────────────────────────────────────────────────────

export interface StreakInfo {
  current: number;
  longest: number;
  lastGoalMetDate: string | null;
}

// ── Stats ───────────────────────────────────────────────────────────────

export interface DailySummary {
  date: string;
  totalMinutes: number;
  goalMinutes: number | null;
  goalMet: boolean;
  pickups: number;
  topApps: { appName: string; minutes: number; category: AppCategory }[];
}

export interface WeeklySummary {
  weekStart: string;
  averageMinutes: number;
  totalMinutes: number;
  daysMetGoal: number;
  bestDay: string | null;
  worstDay: string | null;
}

export interface CategoryBreakdown {
  category: AppCategory;
  minutes: number;
  percentage: number;
}

// ── Settings ────────────────────────────────────────────────────────────

export const PresenceSettingKeySchema = z.enum([
  'daily_goal_minutes',
  'daily_report_reminder_enabled',
  'daily_report_reminder_time',
  'scroll_alert_interval_minutes',
  'progressive_alerts_enabled',
  'focus_session_reminders_enabled',
  'morning_briefing_enabled',
  'morning_briefing_time',
  'bedtime_wind_down_enabled',
  'bedtime_time',
  'streak_reminders_enabled',
  'time_display_mode',
  'onboarding_completed',
]);
export type PresenceSettingKey = z.infer<typeof PresenceSettingKeySchema>;
