export { ALL_TABLES, CREATE_INDEXES, SEED_SETTINGS, ALTER_HABITS_V2, ALL_V2_TABLES, V2_INDEXES, ALL_V3_TABLES, V3_INDEXES, ALL_V4_TABLES, V4_INDEXES, ALL_V5_TABLES, V5_INDEXES, ALL_V6_TABLES, ALTER_HABITS_V6, SEED_AREAS, V6_INDEXES, ALL_V7_TABLES, ALTER_HABITS_V7, MIGRATE_REMINDER_DATA, V7_INDEXES } from './schema';
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
} from './crud';
export type { CreateHabitInput, UpdateHabitInput } from './crud';
export {
  getStreaksWithGrace,
  getNegativeStreaks,
  getMeasurableStreaks,
} from './streaks';
export {
  startSession,
  endSession,
  getSessionsForHabit,
  getSessionsForDate,
  deleteSession,
} from './timed-sessions';
export {
  recordMeasurement,
  getMeasurementsForHabit,
  getMeasurementsForDate,
  deleteMeasurement,
} from './measurements';

// ── V3 CRUD ─────────────────────────────────────────────────────────────

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
} from './sobriety';
export type { CreateSobrietyProfileInput } from './sobriety';

export {
  createCraving,
  getCravingsForHabit,
  getTriggersForCraving,
  getAllTriggersForHabit,
  getCustomTriggerNames,
  deleteCraving,
} from './cravings';
export type { CreateCravingInput } from './cravings';

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
} from './milestones';

export {
  createFocusSession,
  completeFocusSession,
  getFocusSessionsForHabit,
  getAllFocusSessions,
  deleteFocusSession,
} from './focus';
export type { CreateFocusSessionInput } from './focus';

export {
  createHealthKitLink,
  getHealthKitLink,
  getAllActiveHealthKitLinks,
  updateHealthKitLinkSyncTime,
  deactivateHealthKitLink,
  deleteHealthKitLink,
} from './healthkit-links';
export type { CreateHealthKitLinkInput } from './healthkit-links';

// ── V4 CRUD ─────────────────────────────────────────────────────────────

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
} from './challenges';
export type {
  CreateProgramInput,
  CreateEnrollmentInput,
  EnrolledProgram,
  ProgramProgress,
  ProgramProgressDay,
} from './challenges';

export {
  createBadge,
  getBadgesForHabit,
  getAllBadges,
  getEarnedBadges,
  getUnlockedBadgeKeys,
  dismissBadge,
  deleteBadge,
} from './badges';

export {
  createProject,
  getProjectByHabit,
  getAllActiveProjects,
  updateProject,
  deleteProject,
} from './projects';
export type { CreateProjectInput } from './projects';

export {
  getPlayerProfile,
  ensurePlayerProfile,
  updatePlayerXP,
  setGamificationEnabled,
  createXPTransaction,
  getXPTransactions,
  getXPTransactionsForHabit,
  getLevelHistory,
} from './rpg';

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
} from './pet';

export {
  createLocationReminder,
  getLocationReminder,
  getAllActiveLocationReminders,
  updateLocationReminder,
  deactivateLocationReminder,
  deleteLocationReminder,
} from './location';
export type { CreateLocationReminderInput } from './location';

// ── V5 CRUD ─────────────────────────────────────────────────────────────

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
} from './stacking';
export type {
  CreateHabitLinkInput,
  CreateHabitStackInput,
  HabitStackRecord,
  HabitStackSuggestion,
  HabitStackAnalytics,
  HabitStackBreakpoint,
} from './stacking';

export {
  createStreakFreeze,
  getFreezesForHabit,
  getFreezeDatesForHabit,
  getFreezesInMonth,
  deleteStreakFreeze,
} from './streak-freezes';

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
} from './actions';

// ── V6 CRUD ─────────────────────────────────────────────────────────────

export {
  createArea,
  getAreas,
  updateArea,
  deleteArea,
  reorderAreas,
} from './areas';
export type { CreateAreaInput } from './areas';

// ── V7 CRUD ─────────────────────────────────────────────────────────────

export {
  createReminder,
  getRemindersForHabit,
  updateReminder,
  deleteReminder,
  toggleReminder,
} from './reminders';
