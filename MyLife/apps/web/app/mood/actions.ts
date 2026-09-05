'use server';

import { getAdapter, ensureModuleMigrations } from '@/lib/db';
import {
  // Entry CRUD
  createMoodEntry,
  getMoodEntryById,
  getMoodEntries,
  getMoodEntriesByDate,
  deleteMoodEntry,
  getMoodEntryCount,
  getEmotionTagsForEntry,
  // Activity CRUD
  createActivity,
  getActivities,
  updateActivity,
  deleteActivity,
  getActivitiesForEntry,
  seedDefaultActivities,
  // Breathing
  createBreathingSession,
  getBreathingSessions,
  // Settings
  getSetting,
  getLastNightSleep,
  setSetting,
  // Analytics
  getDailyAverages,
  getMoodDashboard,
  getActivityCorrelations,
  getTopEmotions,
  // Experiments
  createExperiment,
  getActiveExperiment,
  getExperiments,
  updateExperimentStatus,
  updateExperimentResults,
  abandonExperiment,
  getTemplates,
  getTemplatesByCategory,
  getScoresInDateRange,
  // Lock
  getLockConfig,
  setLockConfig,
  incrementFailedAttempts,
  resetFailedAttempts,
  setLockedUntil,
  disableLock,
  // SOS
  createSosSession,
  completeSosSession,
  getSosSessions,
  createEmergencyContact,
  getEmergencyContacts,
  deleteEmergencyContact,
  // Attachments
  getAttachmentsForEntry,
  // Meditation
  getMeditationTemplates,
  getMeditationTemplatesByCategory,
  getMeditationTemplateById,
  createMeditationSession,
  completeMeditationSession,
  getMeditationSessions,
  // Pet
  getPet,
  createPet,
  updatePetStats,
  renamePet,
  createPetActivity,
  getPetActivities,
  getPetActivitiesToday,
  // Focus
  createFocusSession,
  completeFocusSession,
  getFocusSessions,
  getSoundPresets,
  createSoundPreset,
  deleteSoundPreset,
  // Types
  type CreateMoodEntryInput,
  type MoodEntryFilter,
  type CreateActivityInput,
  type UpdateActivityInput,
  type CreateBreathingSessionInput,
  type CreateExperimentInput,
  type ExperimentStatus,
  type CreateSosSessionInput,
  type CompleteSosSessionInput,
  type CreateEmergencyContactInput,
  type CreateMeditationSessionInput,
  type CompleteMeditationSessionInput,
  type CreateFocusSessionInput,
  type CompleteFocusSessionInput,
  type CreateSoundPresetInput,
} from '@mylife/mood';
import { getSleepMoodCorrelation } from '@mylife/sleep';

function db() {
  const adapter = getAdapter();
  ensureModuleMigrations('mood');
  return adapter;
}

function crossModuleDb() {
  const adapter = getAdapter();
  ensureModuleMigrations('mood');
  ensureModuleMigrations('sleep');
  return adapter;
}

// -- Dashboard --

export async function fetchDashboard() {
  return getMoodDashboard(db());
}

export async function fetchDailyAverages(startDate: string, endDate: string) {
  return getDailyAverages(db(), startDate, endDate);
}

export async function fetchActivityCorrelations(days = 30) {
  return getActivityCorrelations(db(), days);
}

export async function fetchTopEmotions(startDate: string, endDate: string, limit = 10) {
  return getTopEmotions(db(), startDate, endDate, limit);
}

export async function fetchSleepMoodCorrelation(startDate: string, endDate: string) {
  return getSleepMoodCorrelation(crossModuleDb(), { startDate, endDate });
}

export async function fetchLastNightSleepContext(referenceDate?: string) {
  return getLastNightSleep(crossModuleDb(), { referenceDate });
}

// -- Entries --

export async function fetchEntries(filter?: MoodEntryFilter) {
  return getMoodEntries(db(), filter);
}

export async function fetchEntriesByDate(date: string) {
  return getMoodEntriesByDate(db(), date);
}

export async function fetchEntryById(id: string) {
  return getMoodEntryById(db(), id);
}

export async function addEntry(input: CreateMoodEntryInput) {
  return createMoodEntry(db(), crypto.randomUUID(), input);
}

export async function removeEntry(id: string) {
  deleteMoodEntry(db(), id);
  return { ok: true };
}

export async function fetchEntryCount() {
  return getMoodEntryCount(db());
}

// -- Emotions --

export async function fetchEmotionTagsForEntry(entryId: string) {
  return getEmotionTagsForEntry(db(), entryId);
}

// -- Activities --

export async function fetchActivities() {
  return getActivities(db());
}

export async function addActivity(input: CreateActivityInput) {
  return createActivity(db(), crypto.randomUUID(), input);
}

export async function editActivity(id: string, input: UpdateActivityInput) {
  return updateActivity(db(), id, input);
}

export async function removeActivity(id: string) {
  deleteActivity(db(), id);
  return { ok: true };
}

export async function fetchActivitiesForEntry(entryId: string) {
  return getActivitiesForEntry(db(), entryId);
}

export async function initDefaultActivities() {
  seedDefaultActivities(db());
  return { ok: true };
}

// -- Breathing --

export async function addBreathingSession(input: CreateBreathingSessionInput) {
  return createBreathingSession(db(), crypto.randomUUID(), input);
}

export async function fetchBreathingSessions(limit = 50) {
  return getBreathingSessions(db(), limit);
}

// -- Settings --

export async function fetchSetting(key: string) {
  return getSetting(db(), key);
}

export async function saveSetting(key: string, value: string) {
  setSetting(db(), key, value);
  return { ok: true };
}

// -- Experiments --

export async function fetchActiveExperiment() {
  return getActiveExperiment(db());
}

export async function fetchExperiments() {
  return getExperiments(db());
}

export async function fetchTemplates() {
  return getTemplates(db());
}

export async function fetchTemplatesByCategory(category: string) {
  return getTemplatesByCategory(db(), category);
}

export async function addExperiment(input: CreateExperimentInput) {
  return createExperiment(db(), crypto.randomUUID(), input);
}

export async function changeExperimentStatus(id: string, status: ExperimentStatus) {
  updateExperimentStatus(db(), id, status);
  return { ok: true };
}

export async function saveExperimentResults(id: string, results: {
  baselineAvg: number | null;
  interventionAvg: number | null;
  baselineEntryCount: number;
  interventionEntryCount: number;
  scoreDiff: number | null;
  percentChange: number | null;
  pearsonR: number | null;
  isSignificant: boolean;
  conclusion: string;
}) {
  updateExperimentResults(db(), id, results);
  return { ok: true };
}

export async function cancelExperiment(id: string) {
  abandonExperiment(db(), id);
  return { ok: true };
}

export async function fetchScoresInRange(startDate: string, endDate: string) {
  return getScoresInDateRange(db(), startDate, endDate);
}

// -- Lock --

export async function fetchLockConfig() {
  return getLockConfig(db());
}

export async function saveLockConfig(config: {
  isEnabled: boolean;
  method: string;
  lockTimeoutSeconds: number;
}) {
  setLockConfig(db(), config);
  return { ok: true };
}

export async function addFailedAttempt() {
  incrementFailedAttempts(db());
  return { ok: true };
}

export async function clearFailedAttempts() {
  resetFailedAttempts(db());
  return { ok: true };
}

export async function setLockedUntilTime(until: string) {
  setLockedUntil(db(), until);
  return { ok: true };
}

export async function removeLock() {
  disableLock(db());
  return { ok: true };
}

// -- SOS --

export async function addSosSession(input: CreateSosSessionInput) {
  return createSosSession(db(), crypto.randomUUID(), input);
}

export async function endSosSession(id: string, input: CompleteSosSessionInput) {
  completeSosSession(db(), id, input);
  return { ok: true };
}

export async function fetchSosSessions(limit = 20) {
  return getSosSessions(db(), limit);
}

export async function addEmergencyContact(input: CreateEmergencyContactInput) {
  return createEmergencyContact(db(), crypto.randomUUID(), input);
}

export async function fetchEmergencyContacts() {
  return getEmergencyContacts(db());
}

export async function removeEmergencyContact(id: string) {
  deleteEmergencyContact(db(), id);
  return { ok: true };
}

// -- Attachments --

export async function fetchAttachmentsForEntry(entryId: string) {
  return getAttachmentsForEntry(db(), entryId);
}

// -- Meditation --

export async function fetchMeditationTemplates() {
  return getMeditationTemplates(db());
}

export async function fetchMeditationTemplatesByCategory(category: string) {
  return getMeditationTemplatesByCategory(db(), category);
}

export async function fetchMeditationTemplateById(id: string) {
  return getMeditationTemplateById(db(), id);
}

export async function addMeditationSession(input: CreateMeditationSessionInput) {
  return createMeditationSession(db(), crypto.randomUUID(), input);
}

export async function endMeditationSession(id: string, input: CompleteMeditationSessionInput) {
  completeMeditationSession(db(), id, input);
  return { ok: true };
}

export async function fetchMeditationSessions(limit = 20) {
  return getMeditationSessions(db(), limit);
}

// -- Pet --

export async function fetchPet() {
  return getPet(db());
}

export async function addPet(name = 'Buddy') {
  return createPet(db(), name);
}

export async function editPetStats(happiness: number, experience: number, evolutionStage: number, totalFeeds: number, hatchedAt?: string | null) {
  updatePetStats(db(), happiness, experience, evolutionStage, totalFeeds, hatchedAt);
  return { ok: true };
}

export async function editPetName(name: string) {
  renamePet(db(), name);
  return { ok: true };
}

export async function addPetActivity(activityType: 'mood_log' | 'breathing' | 'meditation' | 'journal' | 'workout' | 'experiment' | 'streak_bonus', happinessDelta: number, experienceDelta: number, sourceModule?: string) {
  return createPetActivity(db(), crypto.randomUUID(), activityType, happinessDelta, experienceDelta, sourceModule);
}

export async function fetchPetActivities(limit = 20) {
  return getPetActivities(db(), limit);
}

export async function fetchPetActivitiesToday(type: 'mood_log' | 'breathing' | 'meditation' | 'journal' | 'workout' | 'experiment' | 'streak_bonus') {
  const today = new Date().toISOString().slice(0, 10);
  return getPetActivitiesToday(db(), type, today);
}

// -- Focus --

export async function addFocusSession(input: CreateFocusSessionInput) {
  return createFocusSession(db(), crypto.randomUUID(), input);
}

export async function endFocusSession(id: string, input: CompleteFocusSessionInput) {
  completeFocusSession(db(), id, input);
  return { ok: true };
}

export async function fetchFocusSessions(limit = 20) {
  return getFocusSessions(db(), limit);
}

export async function fetchSoundPresets() {
  return getSoundPresets(db());
}

export async function addSoundPreset(input: CreateSoundPresetInput) {
  return createSoundPreset(db(), crypto.randomUUID(), input);
}

export async function removeSoundPreset(id: string) {
  deleteSoundPreset(db(), id);
  return { ok: true };
}
