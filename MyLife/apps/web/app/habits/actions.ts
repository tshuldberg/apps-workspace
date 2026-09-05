'use server';

import { getAdapter, ensureModuleMigrations } from '@/lib/db';
import {
  // Habit CRUD
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
  // Enhanced streaks
  getStreaksWithGrace,
  getNegativeStreaks,
  getMeasurableStreaks,
  // Timed sessions
  startSession,
  endSession,
  getSessionsForHabit,
  getSessionsForDate,
  // Measurements
  recordMeasurement,
  getMeasurementsForHabit,
  getMeasurementsForDate,
  // Heatmap
  getHeatmapData,
  getHeatmapRange,
  // Statistics
  getCompletionRateByDayOfWeek,
  getCompletionRateByTimeOfDay,
  getMonthlyCompletionRate,
  getYearlyStats,
  getOverallStats,
  // Export
  exportHabitsCSV,
  exportCompletionsCSV,
  exportAllCSV,
  // V3: Sobriety
  createSobrietyProfile,
  getSobrietyProfile,
  getAllSobrietyProfiles,
  deleteSobrietyProfile,
  createPledge,
  getPledgeForDate,
  getRecentPledgeDates,
  getSlipDates,
  // V3: Cravings
  createCraving,
  getCravingsForHabit,
  getAllTriggersForHabit,
  deleteCraving,
  // V3: Milestones
  getMilestonesForHabit,
  markMilestoneAchieved,
  seedMilestonesForHabit,
  // V3: Focus sessions
  createFocusSession,
  completeFocusSession,
  getAllFocusSessions,
  // V4: Programs
  getAllPrograms,
  getProgramProgress,
  getEnrolledPrograms,
  createEnrollment,
  getAllActiveEnrollments,
  updateEnrollmentStatus,
  // V4: Badges
  getAllBadges,
  getEarnedBadges,
  getUnlockedBadgeKeys,
  getMilestoneProgress,
  // V4: Time tracking
  getAllActiveProjects,
  // V4: RPG
  getPlayerProfile,
  ensurePlayerProfile,
  getXPTransactions,
  getLevelHistory,
  // V4: Pet
  getPetState,
  ensurePetState,
  updatePetName,
  updatePetSpecies,
  getPetCareState,
  getPetHistory,
  feedPet,
  playWithPet,
  restPet,
  getPetUnlockablesForState,
  // Areas
  createArea,
  getAreas,
  updateArea,
  deleteArea,
  reorderAreas,
  // Templates
  getAllTemplates,
  // Stacking
  getHabitStacks,
  getStackSuggestions,
  getStackAnalytics,
  createHabitStack,
  deleteHabitStack,
  getLinksForHabit,
  // Action items
  createActionItem,
  getActionItemsForHabit,
  getCompletedActionItemIds,
  deleteActionItem,
  completeActionItem,
  uncompleteActionItem,
  // Reminders
  createReminder,
  getRemindersForHabit,
  deleteReminder,
  toggleReminder,
  // P7 web helpers
  getAllActiveHealthKitLinks,
  getAllActiveLocationReminders,
  getSleepRoutineContext,
  type CreateSobrietyProfileInput,
  type CreateCravingInput,
  type CreateFocusSessionInput,
  type CreateEnrollmentInput,
  type EnrollmentStatus,
} from '@mylife/habits';

function db() {
  const adapter = getAdapter();
  ensureModuleMigrations('habits');
  return adapter;
}

function bridgeDb() {
  const adapter = getAdapter();
  ensureModuleMigrations('habits');
  ensureModuleMigrations('sleep');
  return adapter;
}

function runAction<T>(action: () => T): T {
  try {
    return action();
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('MyHabits action failed.');
  }
}

// ── Habit CRUD ──────────────────────────────────────────────────────────────

export async function fetchHabits(opts?: { isArchived?: boolean }) {
  return getHabits(db(), opts);
}

export async function fetchHabitById(id: string) {
  return getHabitById(db(), id);
}

export async function doCreateHabit(
  id: string,
  input: {
    name: string;
    description?: string;
    frequency?: string;
    targetCount?: number;
    icon?: string;
    color?: string;
    habitType?: string;
    timeOfDay?: string;
    specificDays?: string[];
    gracePeriod?: number;
    reminderTime?: string;
  },
) {
  createHabit(db(), id, input);
}

export async function doUpdateHabit(
  id: string,
  updates: Partial<{
    name: string;
    description: string;
    frequency: string;
    targetCount: number;
    icon: string;
    color: string;
    habitType: string;
    timeOfDay: string;
    specificDays: string[];
    gracePeriod: number;
    reminderTime: string;
    isArchived: boolean;
    sortOrder: number;
  }>,
) {
  updateHabit(db(), id, updates);
}

export async function doDeleteHabit(id: string) {
  deleteHabit(db(), id);
}

export async function fetchHabitCount() {
  return countHabits(db());
}

export async function fetchSleepRoutineContext(date?: string) {
  return getSleepRoutineContext(bridgeDb(), { date });
}

// ── Settings ────────────────────────────────────────────────────────────────

export async function fetchSetting(key: string) {
  return getSetting(db(), key);
}

export async function doSetSetting(key: string, value: string) {
  setSetting(db(), key, value);
}

// ── Completions ─────────────────────────────────────────────────────────────

export async function doRecordCompletion(
  id: string,
  habitId: string,
  completedAt: string,
  value?: number,
  notes?: string,
) {
  recordCompletion(db(), id, habitId, completedAt, value, notes);
}

export async function fetchCompletions(
  habitId: string,
  opts?: { from?: string; to?: string },
) {
  return getCompletions(db(), habitId, opts);
}

export async function fetchCompletionsForDate(date: string) {
  return getCompletionsForDate(db(), date);
}

export async function doDeleteCompletion(id: string) {
  deleteCompletion(db(), id);
}

// ── Streaks ─────────────────────────────────────────────────────────────────

export async function fetchStreaks(habitId: string) {
  return getStreaks(db(), habitId);
}

export async function fetchStreaksWithGrace(habitId: string, gracePeriod: number) {
  return getStreaksWithGrace(db(), habitId, gracePeriod);
}

export async function fetchNegativeStreaks(habitId: string) {
  return getNegativeStreaks(db(), habitId);
}

export async function fetchMeasurableStreaks(habitId: string, gracePeriod?: number) {
  return getMeasurableStreaks(db(), habitId, gracePeriod);
}

// ── Timed Sessions ──────────────────────────────────────────────────────────

export async function doStartSession(
  id: string,
  habitId: string,
  targetSeconds: number,
) {
  startSession(db(), id, habitId, targetSeconds);
}

export async function doEndSession(id: string, durationSeconds: number) {
  endSession(db(), id, durationSeconds);
}

export async function fetchSessionsForHabit(habitId: string) {
  return getSessionsForHabit(db(), habitId);
}

export async function fetchSessionsForDate(date: string) {
  return getSessionsForDate(db(), date);
}

// ── Measurements ────────────────────────────────────────────────────────────

export async function doRecordMeasurement(
  id: string,
  habitId: string,
  measuredAt: string,
  value: number,
  target: number,
) {
  recordMeasurement(db(), id, habitId, measuredAt, value, target);
}

export async function fetchMeasurementsForHabit(habitId: string) {
  return getMeasurementsForHabit(db(), habitId);
}

export async function fetchMeasurementsForDate(date: string) {
  return getMeasurementsForDate(db(), date);
}

// ── Heatmap ─────────────────────────────────────────────────────────────────

export async function fetchHeatmapData(habitId: string, year?: number) {
  return getHeatmapData(db(), habitId, year);
}

export async function fetchHeatmapRange(habitId: string, from: string, to: string) {
  return getHeatmapRange(db(), habitId, from, to);
}

// ── Statistics ──────────────────────────────────────────────────────────────

export async function fetchDayOfWeekStats(habitId: string) {
  return getCompletionRateByDayOfWeek(db(), habitId);
}

export async function fetchTimeOfDayStats(habitId: string) {
  return getCompletionRateByTimeOfDay(db(), habitId);
}

export async function fetchMonthlyStats(habitId: string, year: number) {
  return getMonthlyCompletionRate(db(), habitId, year);
}

export async function fetchYearlyStats(habitId: string) {
  return getYearlyStats(db(), habitId);
}

export async function fetchOverallStats() {
  return getOverallStats(db());
}

// ── CSV Export ──────────────────────────────────────────────────────────────

export async function fetchExportHabitsCSV() {
  return exportHabitsCSV(db());
}

export async function fetchExportCompletionsCSV() {
  return exportCompletionsCSV(db());
}

export async function fetchExportAllCSV() {
  return exportAllCSV(db());
}

// ── Sobriety ─────────────────────────────────────────────────────────────────

export async function fetchSobrietyProfile(habitId: string) {
  return getSobrietyProfile(db(), habitId);
}

export async function fetchAllSobrietyProfiles() {
  return getAllSobrietyProfiles(db());
}

export async function doCreateSobrietyProfile(id: string, habitId: string, input: CreateSobrietyProfileInput) {
  createSobrietyProfile(db(), id, habitId, input);
}

export async function doDeleteSobrietyProfile(id: string) {
  deleteSobrietyProfile(db(), id);
}

export async function doCreatePledge(id: string, profileId: string, date: string) {
  createPledge(db(), id, profileId, date);
}

export async function fetchPledgeForDate(profileId: string, date: string) {
  return getPledgeForDate(db(), profileId, date);
}

export async function fetchRecentPledgeDates(profileId: string) {
  return getRecentPledgeDates(db(), profileId);
}

export async function fetchSlipDates(habitId: string) {
  return getSlipDates(db(), habitId);
}

// ── Cravings ─────────────────────────────────────────────────────────────────

export async function doCreateCraving(id: string, input: CreateCravingInput) {
  createCraving(db(), id, input);
}

export async function fetchCravingsForHabit(habitId: string) {
  return getCravingsForHabit(db(), habitId);
}

export async function fetchAllTriggersForHabit(habitId: string) {
  return getAllTriggersForHabit(db(), habitId);
}

export async function doDeleteCraving(id: string) {
  deleteCraving(db(), id);
}

// ── Milestones ───────────────────────────────────────────────────────────────

export async function fetchMilestonesForHabit(habitId: string) {
  return getMilestonesForHabit(db(), habitId);
}

export async function doMarkMilestoneAchieved(id: string) {
  markMilestoneAchieved(db(), id);
}

export async function doSeedMilestonesForHabit(
  habitId: string,
  milestones: Array<{ id: string; type: string; threshold: number; label: string; emoji: string }>,
) {
  seedMilestonesForHabit(db(), habitId, milestones as Parameters<typeof seedMilestonesForHabit>[2]);
}

// ── Focus Sessions ───────────────────────────────────────────────────────────

export async function doCreateFocusSession(id: string, input: CreateFocusSessionInput) {
  createFocusSession(db(), id, input);
}

export async function doCompleteFocusSession(
  id: string,
  roundsCompleted: number,
  totalFocusSec: number,
  totalBreakSec: number,
  status: 'completed' | 'abandoned',
) {
  completeFocusSession(db(), id, roundsCompleted, totalFocusSec, totalBreakSec, status);
}

export async function fetchAllFocusSessions() {
  return getAllFocusSessions(db());
}

// ── Programs ─────────────────────────────────────────────────────────────────

export async function fetchAllPrograms() {
  return getAllPrograms(db());
}

export async function fetchProgramProgress(programId: string) {
  return getProgramProgress(db(), programId);
}

export async function fetchEnrolledPrograms() {
  return getEnrolledPrograms(db());
}

export async function fetchAllActiveEnrollments() {
  return getAllActiveEnrollments(db());
}

export async function doCreateEnrollment(id: string, input: CreateEnrollmentInput) {
  createEnrollment(db(), id, input);
}

export async function doUpdateEnrollmentStatus(id: string, status: EnrollmentStatus) {
  updateEnrollmentStatus(db(), id, status);
}

// ── Badges ───────────────────────────────────────────────────────────────────

export async function fetchAllBadges() {
  return getAllBadges(db());
}

export async function fetchEarnedBadges() {
  return getEarnedBadges(db());
}

export async function fetchUnlockedBadgeKeys() {
  return getUnlockedBadgeKeys(db());
}

export async function fetchMilestoneProgress() {
  return getMilestoneProgress(db());
}

// ── Time Tracking ────────────────────────────────────────────────────────────

export async function fetchAllActiveProjects() {
  return getAllActiveProjects(db());
}

// ── RPG ──────────────────────────────────────────────────────────────────────

export async function fetchPlayerProfile() {
  return getPlayerProfile(db());
}

export async function doEnsurePlayerProfile() {
  ensurePlayerProfile(db());
}

export async function fetchXPTransactions(limit?: number) {
  return getXPTransactions(db(), limit);
}

export async function fetchLevelHistory(limit?: number) {
  return getLevelHistory(db(), limit);
}

// ── Pet ──────────────────────────────────────────────────────────────────────

export async function fetchPetState() {
  return getPetState(db());
}

export async function doEnsurePetState() {
  ensurePetState(db());
}

export async function doUpdatePetName(name: string) {
  updatePetName(db(), name);
}

export async function doUpdatePetSpecies(species: string) {
  updatePetSpecies(db(), species);
}

export async function fetchPetCareState(at?: string) {
  return getPetCareState(db(), at);
}

export async function fetchPetHistory(limit?: number) {
  return getPetHistory(db(), limit);
}

export async function fetchPetUnlockablesForState() {
  return getPetUnlockablesForState(db());
}

export async function doFeedPet() {
  return runAction(() => feedPet(db()));
}

export async function doPlayWithPet() {
  return runAction(() => playWithPet(db()));
}

export async function doRestPet() {
  return runAction(() => restPet(db()));
}

// ── Areas ────────────────────────────────────────────────────────────────────

export async function fetchAreas() {
  return getAreas(db());
}

export async function doCreateArea(
  id: string,
  input: {
    name: string;
    color?: string;
    icon?: string;
    sortOrder?: number;
  },
) {
  return runAction(() => createArea(db(), id, input));
}

export async function doUpdateArea(
  id: string,
  updates: Partial<{
    name: string;
    color: string;
    icon: string;
    sortOrder: number;
  }>,
) {
  return runAction(() => updateArea(db(), id, updates));
}

export async function doDeleteArea(id: string) {
  return runAction(() => deleteArea(db(), id));
}

export async function doReorderAreas(orderedIds: string[]) {
  return runAction(() => reorderAreas(db(), orderedIds));
}

// ── Templates ────────────────────────────────────────────────────────────────

export async function fetchAllTemplates() {
  return getAllTemplates();
}

// ── Stacking ────────────────────────────────────────────────────────────────

export async function fetchHabitStacks() {
  return getHabitStacks(db());
}

export async function fetchStackSuggestions() {
  return getStackSuggestions(db());
}

export async function fetchStackAnalytics(anchorHabitId: string) {
  return getStackAnalytics(db()).find((entry) => entry.anchorHabitId === anchorHabitId) ?? null;
}

export async function doCreateHabitStack(
  input: {
    habitIds: string[];
    linkType?: 'after' | 'before' | 'with';
  },
) {
  return runAction(() => createHabitStack(db(), input));
}

export async function doDeleteHabitStack(anchorHabitId: string) {
  return runAction(() => deleteHabitStack(db(), anchorHabitId));
}

export async function fetchLinksForHabit(habitId: string) {
  return getLinksForHabit(db(), habitId);
}

// ── Action Items ─────────────────────────────────────────────────────────────

export async function fetchActionItemsForHabit(habitId: string) {
  return getActionItemsForHabit(db(), habitId);
}

export async function fetchCompletedActionItemIds(habitId: string, date: string) {
  return [...getCompletedActionItemIds(db(), habitId, date)];
}

export async function doCreateActionItem(
  habitId: string,
  label: string,
  sortOrder?: number,
) {
  return runAction(() => createActionItem(db(), habitId, label, sortOrder));
}

export async function doDeleteActionItem(id: string) {
  return runAction(() => deleteActionItem(db(), id));
}

export async function doCompleteActionItem(id: string, date: string) {
  return runAction(() => completeActionItem(db(), id, date));
}

export async function doUncompleteActionItem(id: string, date: string) {
  return runAction(() => uncompleteActionItem(db(), id, date));
}

// ── Reminders ────────────────────────────────────────────────────────────────

export async function fetchRemindersForHabit(habitId: string) {
  return getRemindersForHabit(db(), habitId);
}

export async function doCreateReminder(
  id: string,
  habitId: string,
  time: string,
  label?: string,
) {
  return runAction(() => createReminder(db(), id, habitId, time, label));
}

export async function doDeleteReminder(id: string) {
  return runAction(() => deleteReminder(db(), id));
}

export async function doToggleReminder(id: string, enabled: boolean) {
  return runAction(() => toggleReminder(db(), id, enabled));
}

// ── HealthKit / Location / Siri Support ─────────────────────────────────────

export async function fetchAllActiveHealthKitLinks() {
  return getAllActiveHealthKitLinks(db());
}

export async function fetchAllActiveLocationReminders() {
  return getAllActiveLocationReminders(db());
}
