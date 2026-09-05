// ── Module definition ─────────────────────────────────────────────────────
export { HABITS_MODULE } from './definition';

// ── Types & schemas ──────────────────────────────────────────────────────
export type {
  Area,
  Reminder,
  Habit,
  Frequency,
  HabitType,
  TimeOfDay,
  DayOfWeek,
  Completion,
  TimedSession,
  Measurement,
  StreakInfo,
  NegativeStreakInfo,
  HeatmapDay,
  HabitStats,
  OverallStats,
  CyclePeriod,
  CycleSymptom,
  CyclePrediction,
  SobrietyProfile,
  SobrietyPledge,
  SobrietyDuration,
  SobrietyLifetimeStats,
  Craving,
  CravingTrigger,
  CravingOutcome,
  TriggerCategory,
  TriggerFrequency,
  IntensityTrendPoint,
  PeakTimeSlot,
  CopingEffectiveness,
  Milestone,
  MilestoneType,
  MilestoneProgress,
  FocusSession,
  FocusSessionStatus,
  PomodoroState,
  PomodoroConfig,
  PomodoroPhase,
  FocusStats,
  HealthKitLink,
  HealthKitDataSource,
  AutoTrackProgress,
  ComparisonOperator,
  Program,
  ProgramDifficulty,
  ProgramEnrollment,
  EnrollmentStatus,
  Badge,
  BadgeCategory,
  BadgeDefinition,
  Project,
  TimeEntry,
  ProjectReport,
  TimeReport,
  PlayerProfile,
  XPSource,
  XPTransaction,
  UnlockableItem,
  PetMood,
  PetSpeciesKey,
  PetState,
  PetSpecies,
  SiriCompletionResult,
  LocationTriggerType,
  LocationReminder,
  HabitLink,
  HabitLinkType,
  StreakFreeze,
  ActionItem,
  ActionCompletion,
} from './types';
export {
  AreaSchema,
  ReminderSchema,
  HabitSchema,
  FrequencySchema,
  HabitTypeSchema,
  TimeOfDaySchema,
  DayOfWeekSchema,
  CompletionSchema,
  TimedSessionSchema,
  MeasurementSchema,
  CyclePeriodSchema,
  CycleSymptomSchema,
  CyclePredictionSchema,
  SobrietyProfileSchema,
  SobrietyPledgeSchema,
  CravingSchema,
  CravingTriggerSchema,
  CravingOutcomeSchema,
  TriggerCategorySchema,
  MilestoneSchema,
  MilestoneTypeSchema,
  FocusSessionSchema,
  FocusSessionStatusSchema,
  HealthKitLinkSchema,
  ComparisonOperatorSchema,
  ProgramDifficultySchema,
  ProgramSchema,
  EnrollmentStatusSchema,
  ProgramEnrollmentSchema,
  BadgeCategorySchema,
  BadgeSchema,
  ProjectSchema,
  PlayerProfileSchema,
  XPSourceSchema,
  XPTransactionSchema,
  PetMoodSchema,
  PetSpeciesKeySchema,
  PetStateSchema,
  LocationTriggerTypeSchema,
  LocationReminderSchema,
  HabitLinkTypeSchema,
  HabitLinkSchema,
  StreakFreezeSchema,
  ActionItemSchema,
  ActionCompletionSchema,
} from './types';

// ── Habit CRUD ───────────────────────────────────────────────────────────
export {
  createHabit,
  getHabits,
  getHabitById,
  updateHabit,
  deleteHabit,
  countHabits,
  recordCompletion,
  getCompletions,
  getCompletionsForDate,
  deleteCompletion,
  getStreaks,
  getSetting,
  setSetting,
} from './db';
export type { CreateHabitInput, UpdateHabitInput } from './db';

// ── Enhanced streaks ─────────────────────────────────────────────────────
export {
  getStreaksWithGrace,
  getNegativeStreaks,
  getMeasurableStreaks,
} from './db';

// ── Timed sessions ──────────────────────────────────────────────────────
export {
  startSession,
  endSession,
  getSessionsForHabit,
  getSessionsForDate,
  deleteSession,
} from './db';

// ── Measurements ────────────────────────────────────────────────────────
export {
  recordMeasurement,
  getMeasurementsForHabit,
  getMeasurementsForDate,
  deleteMeasurement,
} from './db';

// ── Heatmap ─────────────────────────────────────────────────────────────
export { getHeatmapData, getHeatmapRange } from './heatmap';

// ── Statistics ──────────────────────────────────────────────────────────
export {
  getCompletionRateByDayOfWeek,
  getCompletionRateByTimeOfDay,
  getMonthlyCompletionRate,
  getYearlyStats,
  getOverallStats,
} from './stats';

// ── CSV export ──────────────────────────────────────────────────────────
export { exportHabitsCSV, exportCompletionsCSV, exportAllCSV } from './export';

// ── CSV import ──────────────────────────────────────────────────────────
export {
  parseHabitsCSV,
  parseCompletionsCSV,
  importHabits,
  importCompletions,
  importAllCSV,
} from './import';
export type { ParsedHabit, ParsedCompletion, ImportResult } from './import';

// ── UI barrel ────────────────────────────────────────────────────────────
// `./ui/index.ts` exports only web-safe design tokens; full RN component
// surface lives in `./ui/index.native.ts` which Metro picks on mobile.
export * from './ui';

// ── Cross-module interface ──────────────────────────────────────────────
export {
  getSearchableContent,
  getDataSummary,
  getActivityFeed,
  getCorrelationData,
  habitsCrossModule,
} from './cross-module';

// ── Sleep bridge ─────────────────────────────────────────────────────────
export {
  getSleepRoutineContext,
  type SleepRoutineContext,
  type SleepRoutineContextOptions,
} from './integrations';

// ── Sobriety clock ──────────────────────────────────────────────────────
export {
  calculateSobrietyDuration,
  calculateMoneySaved,
  calculateLifetimeStats,
  getPledgeStreak,
} from './sobriety/engine';
export {
  createSobrietyProfile,
  getSobrietyProfile,
  getAllSobrietyProfiles,
  updateSobrietyProfile,
  deleteSobrietyProfile,
  createPledge,
  getPledgeForDate,
  getRecentPledgeDates,
  getSlipDates,
} from './db';
export type { CreateSobrietyProfileInput } from './db';

// ── Craving log ─────────────────────────────────────────────────────────
export {
  PRESET_TRIGGERS,
  PRESET_COPING_STRATEGIES,
  analyzeTriggerFrequency,
  analyzeIntensityTrend,
  analyzePeakTimes,
  analyzeCopingEffectiveness,
  normalizeTriggerName,
} from './sobriety/craving-engine';
export {
  createCraving,
  getCravingsForHabit,
  getTriggersForCraving,
  getAllTriggersForHabit,
  getCustomTriggerNames,
  deleteCraving,
} from './db';
export type { CreateCravingInput } from './db';

// ── Milestones ──────────────────────────────────────────────────────────
export {
  STREAK_MILESTONES,
  COMPLETION_MILESTONES,
  SOBRIETY_DAY_MILESTONES,
  SOBRIETY_MONEY_MILESTONES,
  getMilestoneLabel,
  generateStandardMilestones,
  detectNewMilestones,
  getNextMilestone,
} from './milestones/engine';
export {
  createMilestone,
  getMilestones,
  getMilestonesForHabit,
  getAchievedMilestones,
  getUnachievedMilestones,
  getMilestoneProgress,
  markMilestoneAchieved,
  dismissMilestone,
  seedMilestonesForHabit,
} from './db';
export type { MilestoneProgressSummary } from './db/milestones';

// ── Focus timer ─────────────────────────────────────────────────────────
export {
  createPomodoroState,
  getRemainingMs,
  isPhaseComplete,
  advancePhase,
  pauseTimer,
  resumeTimer,
  skipPhase,
  stopSession,
  formatTimerDisplay,
  calculateFocusStats,
} from './focus/engine';
export {
  createFocusSession,
  completeFocusSession,
  getFocusSessionsForHabit,
  getAllFocusSessions,
  deleteFocusSession,
} from './db';
export type { CreateFocusSessionInput } from './db';

// ── HealthKit auto-tracking ─────────────────────────────────────────────
export { HEALTHKIT_DATA_SOURCES, getDataSourceById } from './healthkit/data-sources';
export { checkThreshold, getAutoTrackProgress, isHealthKitAvailable } from './healthkit/bridge';
export type { HealthKitDataProvider } from './healthkit/bridge';
export {
  createHealthKitLink,
  getHealthKitLink,
  getAllActiveHealthKitLinks,
  updateHealthKitLinkSyncTime,
  deactivateHealthKitLink,
  deleteHealthKitLink,
} from './db';
export type { CreateHealthKitLinkInput } from './db';

// ── Challenges / Programs ─────────────────────────────────────────────────
export {
  BUILT_IN_PROGRAMS,
  interpolateSchedule,
  getCurrentDay,
  resolveDailyTarget,
  isProgramComplete,
  getProgramDayPlan,
} from './challenges/engine';
export type {
  BuiltInProgram,
  ProgramHabitBlueprint,
  ProgramDayPlanItem,
} from './challenges/engine';
export {
  createProgram,
  getProgramById,
  getPrograms,
  getAllPrograms,
  getBuiltInPrograms,
  deleteProgram,
  createEnrollment,
  getActiveEnrollment,
  getAllActiveEnrollments,
  getEnrolledPrograms,
  enrollInProgram,
  unenrollFromProgram,
  getProgramProgress,
  updateEnrollmentStatus,
  deleteEnrollment,
} from './db';
export type {
  CreateProgramInput,
  CreateEnrollmentInput,
  EnrolledProgram,
  ProgramProgress,
  ProgramProgressDay,
} from './db';

// ── Achievement badges ────────────────────────────────────────────────────
export {
  BADGE_CATALOG,
  getBadgesByCategory,
  getBadgeByKey,
  getBadgeProgress,
  detectNewBadges,
} from './badges/engine';
export type { UserBadgeStats, BadgeProgress } from './badges/engine';
export {
  createBadge,
  getBadgesForHabit,
  getAllBadges,
  getEarnedBadges,
  getUnlockedBadgeKeys,
  dismissBadge,
  deleteBadge,
} from './db';

// ── Time tracking ─────────────────────────────────────────────────────────
export {
  calculateBillableAmount,
  formatDuration,
  formatCurrency,
  generateTimeReport,
  generateCSV,
} from './time-tracking/engine';
export type { RawSessionEntry, ProjectInfo } from './time-tracking/engine';
export {
  createProject,
  getProjectByHabit,
  getAllActiveProjects,
  updateProject,
  deleteProject,
} from './db';
export type { CreateProjectInput } from './db';

// ── RPG gamification ──────────────────────────────────────────────────────
export {
  calculateXPForAction,
  xpForLevel,
  cumulativeXPForLevel,
  getLevelForXP,
  getXPProgress,
  calculateStreakBonus,
  UNLOCKABLE_ITEMS,
  getUnlockableForLevel,
  getUnlockedItems,
  buildLevelHistory,
} from './rpg/engine';
export type { LevelHistoryEntry } from './rpg/engine';
export {
  getPlayerProfile,
  ensurePlayerProfile,
  updatePlayerXP,
  setGamificationEnabled,
  createXPTransaction,
  getXPTransactions,
  getXPTransactionsForHabit,
  getLevelHistory,
} from './db';

// ── Siri shortcuts ────────────────────────────────────────────────────────
export {
  handleSiriCompletion,
  generateSiriResponse,
  isPlatformSupported as isSiriSupported,
} from './siri/engine';

// ── Pet / Avatar ──────────────────────────────────────────────────────────
export {
  PET_SPECIES_CATALOG,
  getSpeciesByKey,
  calculatePetMood,
  calculatePetMoodFromVitals,
  getMoodEmoji,
  getMoodLabel,
  equipItem,
  unequipItem,
  getDaysTogether,
  DEFAULT_PET_CARE_STATE,
  getPetLevelForXP,
  hydratePetCareState,
  decayPetCareState,
  applyPetCareAction,
  getPetUnlockables,
} from './pet/engine';
export type {
  PetActionType,
  PetCareState,
  PetHistoryEntry,
  PetUnlockable,
} from './pet/engine';
export {
  getPetState,
  ensurePetState,
  updatePetName,
  updatePetSpecies,
  updatePetEquippedItems,
  incrementPetCompletions,
  getPetCareState,
  getPetHistory,
  feedPet,
  playWithPet,
  restPet,
  getPetUnlockablesForState,
} from './db';

// ── Location reminders ────────────────────────────────────────────────────
export {
  shouldShowNotification,
  validateRadius,
  validateCoordinates,
  formatNotificationBody,
  isPlatformSupported as isLocationSupported,
} from './location/engine';
export {
  createLocationReminder,
  getLocationReminder,
  getAllActiveLocationReminders,
  updateLocationReminder,
  deactivateLocationReminder,
  deleteLocationReminder,
} from './db';
export type { CreateLocationReminderInput } from './db';

// ── Habit stacking ──────────────────────────────────────────────────────
export {
  resolveStack,
  getNextInStack,
  getParallelHabits,
  validateNoCircularDependency,
} from './stacking/engine';
export type { StackLink, StackNode, HabitStack } from './stacking/engine';
export {
  createHabitLink,
  getLinksForHabit,
  getLinksFromParent,
  getHabitStacks,
  createHabitStack,
  updateHabitStack,
  getStackSuggestions,
  getStackAnalytics,
  deleteHabitLink,
  deleteHabitStack,
  deleteAllLinksForHabit,
} from './db';
export type {
  CreateHabitLinkInput,
  CreateHabitStackInput,
  HabitStackRecord,
  HabitStackSuggestion,
  HabitStackAnalytics,
  HabitStackBreakpoint,
} from './db';

// ── Streak freeze ───────────────────────────────────────────────────────
export {
  canFreeze,
  remainingFreezes,
  calculateStreakWithFreezes,
  shouldSuggestFreeze,
  MAX_FREEZES_PER_MONTH,
} from './streak-freeze/engine';
export {
  createStreakFreeze,
  getFreezesForHabit,
  getFreezeDatesForHabit,
  getFreezesInMonth,
  deleteStreakFreeze,
} from './db';

// ── Action items (sub-tasks) ────────────────────────────────────────────
export {
  calculateActionProgress,
  resolveActionStates,
  reorderItems,
  getNextIncomplete,
  shouldAutoCompleteHabit,
} from './actions/engine';
export type { ActionItemState } from './actions/engine';
export {
  createActionItem,
  getActionItemsForHabit,
  updateActionItemLabel,
  updateActionItemOrder,
  deleteActionItem,
  completeActionItem,
  uncompleteActionItem,
  getCompletedActionItemIds,
  getActionCompletionsForDate,
} from './db';

// ── Templates ──────────────────────────────────────────────────────────
export { HABIT_TEMPLATES, getTemplatesByArea, getAllTemplates } from './templates';
export type { HabitTemplate } from './templates';

// ── Areas ──────────────────────────────────────────────────────────────
export {
  createArea,
  getAreas,
  updateArea,
  deleteArea,
  reorderAreas,
} from './db';
export type { CreateAreaInput } from './db';

// ── Reminders ─────────────────────────────────────────────────────────
export {
  createReminder,
  getRemindersForHabit,
  updateReminder,
  deleteReminder,
  toggleReminder,
} from './db';

// ── Magic Fill ────────────────────────────────────────────────────────
export { parseMagicFill } from './magic-fill/parser';
export type { MagicFillResult } from './magic-fill/parser';
