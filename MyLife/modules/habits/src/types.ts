import { z } from 'zod';

// ── Enums ─────────────────────────────────────────────────────────────────

export const HabitTypeSchema = z.enum(['standard', 'timed', 'negative', 'measurable']);
export type HabitType = z.infer<typeof HabitTypeSchema>;

export const TimeOfDaySchema = z.enum(['morning', 'afternoon', 'evening', 'anytime']);
export type TimeOfDay = z.infer<typeof TimeOfDaySchema>;

export const FrequencySchema = z.enum(['daily', 'weekly', 'monthly', 'specific_days']);
export type Frequency = z.infer<typeof FrequencySchema>;

export const DayOfWeekSchema = z.enum(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']);
export type DayOfWeek = z.infer<typeof DayOfWeekSchema>;

// ── Area ────────────────────────────────────────────────────────────────────

export const AreaSchema = z.object({
  id: z.string(),
  name: z.string(),
  icon: z.string().nullable(),
  color: z.string().nullable(),
  sortOrder: z.number().int(),
  createdAt: z.string(),
});
export type Area = z.infer<typeof AreaSchema>;

// ── Reminder ────────────────────────────────────────────────────────────────

export const ReminderSchema = z.object({
  id: z.string(),
  habitId: z.string(),
  time: z.string(),
  label: z.string().nullable(),
  isActive: z.boolean(),
  createdAt: z.string(),
});
export type Reminder = z.infer<typeof ReminderSchema>;

// ── Habit ───────────────────────────────────────────────────────────────────

export const HabitSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  icon: z.string().nullable(),
  color: z.string().nullable(),
  frequency: FrequencySchema,
  targetCount: z.number().int(),
  unit: z.string().nullable(),
  habitType: HabitTypeSchema,
  timeOfDay: TimeOfDaySchema,
  specificDays: z.array(DayOfWeekSchema).nullable(),
  gracePeriod: z.number().int(),
  reminderTime: z.string().nullable(),
  areaId: z.string().nullable(),
  startDate: z.string().nullable(),
  endDate: z.string().nullable(),
  isArchived: z.boolean(),
  sortOrder: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Habit = z.infer<typeof HabitSchema>;

// ── Completion ──────────────────────────────────────────────────────────────

export const CompletionSchema = z.object({
  id: z.string(),
  habitId: z.string(),
  completedAt: z.string(),
  value: z.number().nullable(),
  notes: z.string().nullable(),
  createdAt: z.string(),
});
export type Completion = z.infer<typeof CompletionSchema>;

// ── Timed Session ───────────────────────────────────────────────────────────

export const TimedSessionSchema = z.object({
  id: z.string(),
  habitId: z.string(),
  startedAt: z.string(),
  durationSeconds: z.number().int(),
  targetSeconds: z.number().int(),
  completed: z.boolean(),
  createdAt: z.string(),
});
export type TimedSession = z.infer<typeof TimedSessionSchema>;

// ── Measurement ─────────────────────────────────────────────────────────────

export const MeasurementSchema = z.object({
  id: z.string(),
  habitId: z.string(),
  measuredAt: z.string(),
  value: z.number(),
  target: z.number(),
  createdAt: z.string(),
});
export type Measurement = z.infer<typeof MeasurementSchema>;

// ── Streak info ─────────────────────────────────────────────────────────────

export interface StreakInfo {
  currentStreak: number;
  longestStreak: number;
}

export interface NegativeStreakInfo {
  daysSinceLastSlip: number;
  longestCleanStreak: number;
}

// ── Heatmap ─────────────────────────────────────────────────────────────────

export interface HeatmapDay {
  date: string;
  count: number;
}

// ── Statistics ───────────────────────────────────────────────────────────────

export interface HabitStats {
  totalCompletions: number;
  completionRate: number;
  bestDay: string;
  bestTimeOfDay: string;
  monthlyRates: Record<string, number>;
  averagePerWeek: number;
  bestStreak: number;
}

export interface OverallStats {
  totalHabits: number;
  totalCompletions: number;
  averageCompletionRate: number;
  bestHabit: { id: string; name: string; completionRate: number } | null;
}

// ── Cycle Tracking ──────────────────────────────────────────────────────────

export const CyclePeriodSchema = z.object({
  id: z.string(),
  startDate: z.string(),
  endDate: z.string().nullable(),
  cycleLength: z.number().int().nullable(),
  notes: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type CyclePeriod = z.infer<typeof CyclePeriodSchema>;

export const CycleSymptomSchema = z.object({
  id: z.string(),
  periodId: z.string(),
  date: z.string(),
  symptomType: z.string(),
  severity: z.number().int().min(1).max(5),
  notes: z.string().nullable(),
  createdAt: z.string(),
});
export type CycleSymptom = z.infer<typeof CycleSymptomSchema>;

export const CyclePredictionSchema = z.object({
  id: z.string(),
  predictedStart: z.string(),
  predictedEnd: z.string(),
  confidenceDays: z.number(),
  algorithmVersion: z.string(),
  createdAt: z.string(),
});
export type CyclePrediction = z.infer<typeof CyclePredictionSchema>;

// ── Sobriety ───────────────────────────────────────────────────────────────

export const SobrietyProfileSchema = z.object({
  id: z.string(),
  habitId: z.string(),
  quitDate: z.string(),
  dailyCost: z.number().int().min(0),
  currency: z.string(),
  motivation: z.string().nullable(),
  isActive: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type SobrietyProfile = z.infer<typeof SobrietyProfileSchema>;

export const SobrietyPledgeSchema = z.object({
  id: z.string(),
  profileId: z.string(),
  pledgedOn: z.string(),
  fulfilled: z.boolean(),
  createdAt: z.string(),
});
export type SobrietyPledge = z.infer<typeof SobrietyPledgeSchema>;

export interface SobrietyDuration {
  years: number;
  months: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalDays: number;
}

export interface SobrietyLifetimeStats {
  totalCleanDays: number;
  totalSlips: number;
  currentStreak: number;
  longestStreak: number;
  moneySavedCurrent: number;
  moneySavedLifetime: number;
}

// ── Cravings ───────────────────────────────────────────────────────────────

export const CravingOutcomeSchema = z.enum(['resisted', 'gave_in', 'distracted', 'delayed']);
export type CravingOutcome = z.infer<typeof CravingOutcomeSchema>;

export const TriggerCategorySchema = z.enum([
  'emotional', 'social', 'environmental', 'physical', 'routine', 'custom',
]);
export type TriggerCategory = z.infer<typeof TriggerCategorySchema>;

export const CravingSchema = z.object({
  id: z.string(),
  habitId: z.string(),
  intensity: z.number().int().min(1).max(10),
  durationMinutes: z.number().int().nullable(),
  copingStrategy: z.string().nullable(),
  outcome: CravingOutcomeSchema.nullable(),
  notes: z.string().nullable(),
  loggedAt: z.string(),
  createdAt: z.string(),
});
export type Craving = z.infer<typeof CravingSchema>;

export const CravingTriggerSchema = z.object({
  id: z.string(),
  cravingId: z.string(),
  triggerName: z.string(),
  triggerCategory: TriggerCategorySchema,
  createdAt: z.string(),
});
export type CravingTrigger = z.infer<typeof CravingTriggerSchema>;

export interface TriggerFrequency {
  triggerName: string;
  category: TriggerCategory;
  count: number;
}

export interface IntensityTrendPoint {
  weekStart: string;
  averageIntensity: number;
  count: number;
}

export interface PeakTimeSlot {
  hour: number;
  count: number;
}

export interface CopingEffectiveness {
  resisted: number;
  gaveIn: number;
  distracted: number;
  delayed: number;
  total: number;
  resistRate: number;
}

// ── Milestones ─────────────────────────────────────────────────────────────

export const MilestoneTypeSchema = z.enum([
  'streak', 'total_completions', 'sobriety_days', 'sobriety_money', 'custom',
]);
export type MilestoneType = z.infer<typeof MilestoneTypeSchema>;

export const MilestoneSchema = z.object({
  id: z.string(),
  habitId: z.string(),
  milestoneType: MilestoneTypeSchema,
  threshold: z.number().int(),
  label: z.string(),
  emoji: z.string().nullable(),
  achievedAt: z.string().nullable(),
  dismissed: z.boolean(),
  createdAt: z.string(),
});
export type Milestone = z.infer<typeof MilestoneSchema>;

export interface MilestoneProgress {
  milestone: Milestone;
  currentValue: number;
  percentage: number;
}

// ── Focus Timer ────────────────────────────────────────────────────────────

export const FocusSessionStatusSchema = z.enum(['active', 'completed', 'abandoned']);
export type FocusSessionStatus = z.infer<typeof FocusSessionStatusSchema>;

export const FocusSessionSchema = z.object({
  id: z.string(),
  habitId: z.string(),
  workDuration: z.number().int(),
  breakDuration: z.number().int(),
  roundsTarget: z.number().int(),
  roundsCompleted: z.number().int(),
  totalFocusSeconds: z.number().int(),
  totalBreakSeconds: z.number().int(),
  status: FocusSessionStatusSchema,
  startedAt: z.string(),
  completedAt: z.string().nullable(),
  createdAt: z.string(),
});
export type FocusSession = z.infer<typeof FocusSessionSchema>;

export type PomodoroPhase = 'work' | 'break' | 'long_break' | 'completed';

export interface PomodoroState {
  phase: PomodoroPhase;
  round: number;
  roundsTarget: number;
  phaseStartTime: number;
  phaseDuration: number;
  isPaused: boolean;
  pausedAt: number | null;
  totalFocusMs: number;
  totalBreakMs: number;
}

export interface PomodoroConfig {
  workDuration: number;
  breakDuration: number;
  longBreakDuration: number;
  rounds: number;
}

export interface FocusStats {
  todayMinutes: number;
  weekMinutes: number;
  monthMinutes: number;
  completedSessions: number;
  bestSessionMinutes: number;
}

// ── HealthKit ──────────────────────────────────────────────────────────────

export const ComparisonOperatorSchema = z.enum(['gte', 'lte', 'eq', 'gt', 'lt']);
export type ComparisonOperator = z.infer<typeof ComparisonOperatorSchema>;

export const HealthKitLinkSchema = z.object({
  id: z.string(),
  habitId: z.string(),
  dataSource: z.string(),
  metric: z.string(),
  threshold: z.number(),
  comparison: ComparisonOperatorSchema,
  isActive: z.boolean(),
  lastSyncedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type HealthKitLink = z.infer<typeof HealthKitLinkSchema>;

export interface HealthKitDataSource {
  id: string;
  label: string;
  healthKitIdentifier: string;
  defaultThreshold: number;
  unit: string;
  defaultComparison: ComparisonOperator;
}

export interface AutoTrackProgress {
  current: number;
  target: number;
  percentage: number;
  isComplete: boolean;
}

// ── Programs / Challenges ─────────────────────────────────────────────────

export const ProgramDifficultySchema = z.enum(['beginner', 'intermediate', 'advanced']);
export type ProgramDifficulty = z.infer<typeof ProgramDifficultySchema>;

export const ProgramSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  durationDays: z.number().int().min(7).max(90),
  schedule: z.array(z.number()),
  difficulty: ProgramDifficultySchema,
  isBuiltIn: z.boolean(),
  icon: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Program = z.infer<typeof ProgramSchema>;

export const EnrollmentStatusSchema = z.enum(['active', 'completed', 'abandoned']);
export type EnrollmentStatus = z.infer<typeof EnrollmentStatusSchema>;

export const ProgramEnrollmentSchema = z.object({
  id: z.string(),
  programId: z.string(),
  habitId: z.string(),
  startDate: z.string(),
  currentDay: z.number().int(),
  status: EnrollmentStatusSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type ProgramEnrollment = z.infer<typeof ProgramEnrollmentSchema>;

// ── Achievement Badges ────────────────────────────────────────────────────

export const BadgeCategorySchema = z.enum([
  'streak', 'completion', 'sobriety', 'collection', 'special',
]);
export type BadgeCategory = z.infer<typeof BadgeCategorySchema>;

export const BadgeSchema = z.object({
  id: z.string(),
  badgeKey: z.string(),
  habitId: z.string().nullable(),
  unlockedAt: z.string(),
  dismissed: z.boolean(),
  createdAt: z.string(),
});
export type Badge = z.infer<typeof BadgeSchema>;

export interface BadgeDefinition {
  key: string;
  name: string;
  description: string;
  emoji: string;
  category: BadgeCategory;
  threshold: number;
  hint: string;
}

// ── Time Tracking / Projects ──────────────────────────────────────────────

export const ProjectSchema = z.object({
  id: z.string(),
  habitId: z.string(),
  projectName: z.string(),
  clientName: z.string().nullable(),
  hourlyRate: z.number().int().min(0),
  currency: z.string(),
  isActive: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Project = z.infer<typeof ProjectSchema>;

export interface TimeEntry {
  date: string;
  startTime: string;
  durationSeconds: number;
  durationHours: number;
  amountCents: number;
}

export interface ProjectReport {
  projectName: string;
  clientName: string | null;
  hourlyRateCents: number;
  currency: string;
  totalSeconds: number;
  totalHours: number;
  totalAmountCents: number;
  entries: TimeEntry[];
}

export interface TimeReport {
  dateRange: { start: string; end: string };
  projects: ProjectReport[];
  totalSeconds: number;
  totalHours: number;
  totalAmountCents: number;
}

// ── RPG Gamification ──────────────────────────────────────────────────────

export const PlayerProfileSchema = z.object({
  id: z.string(),
  totalXP: z.number().int().min(0),
  currentLevel: z.number().int().min(1),
  gamificationEnabled: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type PlayerProfile = z.infer<typeof PlayerProfileSchema>;

export const XPSourceSchema = z.enum([
  'completion', 'timed_completion', 'measurable_completion',
  'streak_bonus', 'milestone', 'craving_resist', 'daily_pledge', 'all_complete',
]);
export type XPSource = z.infer<typeof XPSourceSchema>;

export const XPTransactionSchema = z.object({
  id: z.string(),
  amount: z.number().int().positive(),
  source: z.string(),
  habitId: z.string().nullable(),
  earnedAt: z.string(),
  createdAt: z.string(),
});
export type XPTransaction = z.infer<typeof XPTransactionSchema>;

export interface UnlockableItem {
  level: number;
  name: string;
  type: 'background' | 'hat' | 'accessory' | 'title' | 'effect';
}

// ── Pet / Avatar ──────────────────────────────────────────────────────────

export const PetMoodSchema = z.enum(['thriving', 'happy', 'neutral', 'tired', 'sleepy']);
export type PetMood = z.infer<typeof PetMoodSchema>;

export const PetSpeciesKeySchema = z.enum(['fox', 'cat', 'dog', 'owl', 'penguin']);
export type PetSpeciesKey = z.infer<typeof PetSpeciesKeySchema>;

export const PetStateSchema = z.object({
  id: z.string(),
  name: z.string(),
  species: PetSpeciesKeySchema,
  equippedItems: z.array(z.string()),
  daysTogether: z.number().int(),
  totalHabitsCompleted: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type PetState = z.infer<typeof PetStateSchema>;

export interface PetSpecies {
  key: PetSpeciesKey;
  emoji: string;
  description: string;
}

// ── Siri Shortcuts ────────────────────────────────────────────────────────

export type SiriCompletionResult = 'completed' | 'already_done' | 'not_found';

// ── Location Reminders ────────────────────────────────────────────────────

export const LocationTriggerTypeSchema = z.enum(['arrival', 'departure', 'both']);
export type LocationTriggerType = z.infer<typeof LocationTriggerTypeSchema>;

export const LocationReminderSchema = z.object({
  id: z.string(),
  habitId: z.string(),
  locationName: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  radiusMeters: z.number().int().min(50).max(500),
  triggerType: LocationTriggerTypeSchema,
  isActive: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type LocationReminder = z.infer<typeof LocationReminderSchema>;

// ── Habit Stacking ──────────────────────────────────────────────────────

export const HabitLinkTypeSchema = z.enum(['after', 'before', 'with']);
export type HabitLinkType = z.infer<typeof HabitLinkTypeSchema>;

export const HabitLinkSchema = z.object({
  id: z.string(),
  parentHabitId: z.string(),
  childHabitId: z.string(),
  linkType: HabitLinkTypeSchema,
  sortOrder: z.number().int(),
  createdAt: z.string(),
});
export type HabitLink = z.infer<typeof HabitLinkSchema>;

// ── Streak Freeze ───────────────────────────────────────────────────────

export const StreakFreezeSchema = z.object({
  id: z.string(),
  habitId: z.string(),
  freezeDate: z.string(),
  reason: z.string().nullable(),
  createdAt: z.string(),
});
export type StreakFreeze = z.infer<typeof StreakFreezeSchema>;

// ── Action Items (Sub-tasks) ────────────────────────────────────────────

export const ActionItemSchema = z.object({
  id: z.string(),
  habitId: z.string(),
  label: z.string(),
  sortOrder: z.number().int(),
  createdAt: z.string(),
});
export type ActionItem = z.infer<typeof ActionItemSchema>;

export const ActionCompletionSchema = z.object({
  id: z.string(),
  actionItemId: z.string(),
  completedAt: z.string(),
  createdAt: z.string(),
});
export type ActionCompletion = z.infer<typeof ActionCompletionSchema>;
