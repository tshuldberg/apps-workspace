// Definition
export { MOOD_MODULE } from './definition';

// UI tokens, typography, and components
export * from './ui/typography';
export * from './ui/tokens';
export { SectionHeader } from './ui/SectionHeader';
export { GlassCard } from './ui/GlassCard';
export { MoodScoreIndicator } from './ui/MoodScoreIndicator';
export { EmotionChip } from './ui/EmotionChip';
export { GradientButton } from './ui/GradientButton';
export { StatBadge } from './ui/StatBadge';
export { TimelineEntry } from './ui/TimelineEntry';
export { PetCard } from './ui/PetCard';

// Types and schemas
export type {
  MoodLevel,
  MoodEntry,
  MoodActivity,
  MoodEmotionTag,
  MoodEntryActivity,
  MoodStreak,
  BreathingPattern,
  BreathingSession,
  MoodSetting,
  CreateMoodEntryInput,
  CreateActivityInput,
  UpdateActivityInput,
  CreateBreathingSessionInput,
  MoodEntryFilter,
  DailyAverage,
  MoodDashboard,
  ActivityCorrelation,
  WeeklyReport,
  PlutchikEmotion,
  // Experiment types
  Experiment,
  ExperimentTemplate,
  ExperimentStatus,
  ExperimentCategory,
  CreateExperimentInput,
  // Lock types
  ModuleLockConfig,
  LockMethod,
  LockTimeout,
  // Insight types
  MoodInsight,
  InsightType,
  InsightSeverity,
  // SOS types
  SosSession,
  EmergencyContact,
  CreateSosSessionInput,
  CompleteSosSessionInput,
  CreateEmergencyContactInput,
  // Attachment types
  Attachment,
  AttachmentType,
  CreateAttachmentInput,
  // Suggestion types
  SuggestionHistory,
  SuggestionSource,
  SuggestionAction,
  SuggestionCategory,
  CatalogSuggestion,
  GeneratedSuggestion,
  CreateSuggestionHistoryInput,
  // Meditation types
  MeditationTemplate,
  MeditationSession,
  MeditationStep,
  MeditationDifficulty,
  CreateMeditationSessionInput,
  CompleteMeditationSessionInput,
  // Pet types
  Pet,
  PetActivity,
  PetActivityType,
  PetSpecies,
  // Focus types
  FocusSession,
  SoundPreset,
  SoundLayer,
  CreateFocusSessionInput,
  CompleteFocusSessionInput,
  CreateSoundPresetInput,
} from './types';

export {
  MoodLevelSchema,
  MoodEntrySchema,
  MoodActivitySchema,
  MoodEmotionTagSchema,
  MoodEntryActivitySchema,
  MoodStreakSchema,
  BreathingPatternSchema,
  BreathingSessionSchema,
  MoodSettingSchema,
  CreateMoodEntryInputSchema,
  CreateActivityInputSchema,
  UpdateActivityInputSchema,
  CreateBreathingSessionInputSchema,
  MoodEntryFilterSchema,
  PlutchikEmotionSchema,
  MoodScoreDescriptors,
  BREATHING_PATTERNS,
  DEFAULT_ACTIVITIES,
  // Experiment schemas
  ExperimentStatusSchema,
  ExperimentCategorySchema,
  ExperimentSchema,
  ExperimentTemplateSchema,
  CreateExperimentInputSchema,
  // Lock schemas
  LockMethodSchema,
  LockTimeoutSchema,
  ModuleLockConfigSchema,
  PinInputSchema,
  // Insight schemas
  InsightTypeSchema,
  InsightSeveritySchema,
  MoodInsightSchema,
  // SOS schemas
  SosSessionSchema,
  EmergencyContactSchema,
  CreateSosSessionInputSchema,
  CompleteSosSessionInputSchema,
  CreateEmergencyContactInputSchema,
  // Attachment schemas
  AttachmentTypeSchema,
  AttachmentSchema,
  CreateAttachmentInputSchema,
  // Suggestion schemas
  SuggestionSourceSchema,
  SuggestionActionSchema,
  SuggestionHistorySchema,
  CreateSuggestionHistoryInputSchema,
  SuggestionCategorySchema,
  // Meditation schemas
  MeditationDifficultySchema,
  MeditationStepSchema,
  MeditationTemplateSchema,
  MeditationSessionSchema,
  CreateMeditationSessionInputSchema,
  CompleteMeditationSessionInputSchema,
  // Pet schemas
  PetSpeciesSchema,
  PetActivityTypeSchema,
  PetSchema,
  PetActivitySchema,
  // Focus schemas
  SoundLayerSchema,
  FocusSessionSchema,
  SoundPresetSchema,
  CreateFocusSessionInputSchema,
  CompleteFocusSessionInputSchema,
  CreateSoundPresetInputSchema,
} from './types';

// CRUD
export {
  createMoodEntry,
  getMoodEntryById,
  getMoodEntries,
  getMoodEntriesByDate,
  deleteMoodEntry,
  getMoodEntryCount,
  getEmotionTagsForEntry,
  createActivity,
  getActivities,
  getActivityById,
  updateActivity,
  deleteActivity,
  getActivitiesForEntry,
  seedDefaultActivities,
  createBreathingSession,
  getBreathingSessions,
  getSetting,
  setSetting,
  getDailyAverages,
  getMoodDashboard,
  getActivityCorrelations,
  getTopEmotions,
} from './db/crud';

// Engines
export {
  calculateStreaks,
  scoreToPixelColor,
  pearsonCorrelation,
  isSignificantCorrelation,
  generateWeeklyReport,
} from './engine/streak';

export type { WeeklyReportEntry } from './engine/streak';

export {
  getBreathingCycleSteps,
  getCycleDuration,
  getCyclesForDuration,
} from './engine/breathing';

export type { BreathingStep } from './engine/breathing';

// Experiment engine
export {
  computeDateRanges,
  transitionExperiment,
  analyzeExperiment,
  isSignificantExperiment,
  generateConclusion,
  correlationStrength,
} from './engine/experiment';

export type { ExperimentAnalysis } from './engine/experiment';

// Experiment CRUD
export {
  createExperiment,
  getExperiment,
  getActiveExperiment,
  getExperiments,
  updateExperimentStatus,
  updateExperimentResults,
  abandonExperiment,
  getTemplates,
  getTemplatesByCategory,
  getTemplateById,
  getScoresInDateRange,
} from './db/experiments';

// Lock engine
export {
  hashPin,
  verifyPin,
  generateSalt,
  checkLockout,
  computeLockedUntil,
  isTimeoutElapsed,
  LOCKOUT_MAX_ATTEMPTS,
  LOCKOUT_DURATION_SECONDS,
} from './engine/lock';

export type { LockoutState } from './engine/lock';

// Lock CRUD
export {
  getLockConfig,
  setLockConfig,
  incrementFailedAttempts,
  resetFailedAttempts,
  setLockedUntil,
  disableLock,
} from './db/lock';

// Insight engine
export {
  standardDeviation,
  detectDayOfWeekPattern,
  detectTimeOfDayPattern,
  detectActivityImpact,
  detectEmotionCluster,
  detectStreakImpact,
  detectTrendDirection,
  detectVolatilityAlert,
  detectBestWorstDay,
  generateInsights,
} from './engine/insight';

export type {
  EntryData,
  ActivityCorrelationData,
  InsightInput,
} from './engine/insight';

// SOS engine
export {
  getSosFlow,
  getRandomAffirmation,
  computeSosDuration,
  getSosStepCount,
  GROUNDING_SENSES,
  DEFAULT_AFFIRMATIONS,
} from './engine/sos';

export type { SosStep, SosStepType, GroundingSense } from './engine/sos';

// SOS CRUD
export {
  createSosSession,
  completeSosSession,
  getSosSession,
  getSosSessions,
  createEmergencyContact,
  getEmergencyContacts,
  deleteEmergencyContact,
} from './db/sos';

// Attachment CRUD
export {
  createAttachment,
  getAttachmentsForEntry,
  getAttachmentById,
  getAttachmentsByType,
  deleteAttachment,
  getAttachmentCount,
} from './db/attachments';

// Suggestion engine
export {
  generateSuggestions,
  SUGGESTION_CATALOG,
  getSuggestionsByCategory,
} from './engine/suggestions';

export type { SuggestionInput } from './engine/suggestions';

// Suggestion CRUD
export {
  createSuggestionHistory,
  updateSuggestionAction,
  getSuggestionHistory,
  getRecentSuggestionKeys,
  getSuggestionsByKey,
} from './db/suggestions';

// Meditation engine
export {
  createTimerState,
  tickTimer,
  getStepProgress,
  getTotalProgress,
  getCurrentStep,
  getRemainingTime,
  getCompletedStepCount,
} from './engine/meditation';

export type { TimerState } from './engine/meditation';

// Meditation CRUD
export {
  getMeditationTemplates,
  getMeditationTemplatesByCategory,
  getMeditationTemplateById,
  createMeditationSession,
  completeMeditationSession,
  getMeditationSession,
  getMeditationSessions,
  getMeditationSessionCount,
} from './db/meditation';

// Pet engine
export {
  feedPet,
  computeHappinessDecay,
  applyDecay,
  getEvolutionStage,
  FEED_REWARDS,
  EVOLUTION_THRESHOLDS,
  EVOLUTION_NAMES,
  MAX_FEEDS_PER_TYPE_PER_DAY,
  HAPPINESS_DECAY_PER_MISSED_DAY,
  HATCH_MOOD_ENTRIES_REQUIRED,
} from './engine/pet';

export type { FeedResult } from './engine/pet';

// Pet CRUD
export {
  getPet,
  createPet,
  updatePetStats,
  renamePet,
  createPetActivity,
  getPetActivities,
  getPetActivitiesToday,
} from './db/pet';

// Soundscape engine
export {
  SOUND_LIBRARY,
  DEFAULT_PRESETS,
  getSoundById,
  getSoundsByCategory,
  validateLayers,
  mixLayers,
} from './engine/soundscape';

export type { SoundDefinition } from './engine/soundscape';

// Focus CRUD
export {
  createFocusSession,
  completeFocusSession,
  getFocusSession,
  getFocusSessions,
  getSoundPresets,
  getSoundPresetById,
  createSoundPreset,
  deleteSoundPreset,
} from './db/focus';

// Integrations
export {
  getLastNightSleep,
} from './integrations';

export type {
  LastNightSleepOptions,
  LastNightSleepSummary,
} from './integrations';
