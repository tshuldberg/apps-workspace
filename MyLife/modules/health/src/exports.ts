// Module definition
export { HEALTH_MODULE } from './definition';

// UI tokens + typography are pure JS (web-safe). RN component re-exports
// (SectionHeader, GlassCard, VitalCard, ActivityRing, GoalProgressCard,
// SleepStageBar, StatBadge, GradientButton, QuickActionButton) live in
// `./index.native.ts`, which Metro picks via the `react-native` export
// condition. Web bundlers fall through to this file and never see RN code.
export * from './ui/typography';
export * from './ui/tokens';

// Health-specific schema and migration
export { HEALTH_MIGRATION_V1 } from './db/migrations';
export * from './db/schema';

// Re-export absorbed module APIs so consumers access everything via @mylife/health.
// Business logic is NOT duplicated -- these are pass-through re-exports.

// --- MyMeds (medication tracking, dose logging, mood, symptoms, analytics) ---
export {
  // Medication CRUD
  createMedication,
  getMedications,
  getMedicationById,
  updateMedication,
  deleteMedication,
  countMedications,
  recordDose,
  getDoses,
  getDosesForDate,
  deleteDose,
  getAdherenceRate,
  getSetting as getMedsSetting,
  setSetting as setMedsSetting,
  // Extended medication CRUD + refill tracking
  createMedicationExtended,
  getMedicationExtended,
  getActiveMedications,
  updatePillCount,
  decrementPillCount,
  recordRefill,
  getRefillHistory,
  calculateBurnRate,
  getDaysRemaining,
  getLowSupplyAlerts,
  // Reminders, dose logging, adherence
  createRemindersForMedication,
  getActiveReminders,
  snoozeReminder,
  dismissReminder,
  getRemindersForMedication,
  logDose,
  getDoseLogsForDate,
  getDoseLogsForMedication,
  undoDoseLog,
  getAdherenceRateV2,
  getStreak,
  getAdherenceStats,
  getAdherenceByDay,
  getAdherenceCalendar,
  // Drug interactions
  seedAdditionalInteractions,
  checkInteractions,
  getInteractionsForMedication,
  ADDITIONAL_INTERACTIONS,
  // Measurements
  logMeasurement,
  getMeasurements,
  getMeasurementById,
  updateMeasurement,
  deleteMeasurement,
  getMeasurementTrend,
  getMeasurementTrendWithMedMarkers,
  // Mood, activities, symptoms
  MOOD_VOCABULARY,
  MOOD_VOCABULARY_SIMPLIFIED,
  DEFAULT_ACTIVITIES,
  moodColor,
  createMoodEntry,
  getMoodEntries,
  getMoodEntryById,
  deleteMoodEntry,
  getMoodEntriesForDate,
  addActivity,
  getActivities,
  removeActivity,
  getDailyMoodSummary,
  seedPredefinedSymptoms,
  getSymptoms,
  createCustomSymptom,
  logSymptom,
  getSymptomLogs,
  getSymptomLogsForSymptom,
  getMoodCalendar,
  getMoodCalendarMonth,
  getDayDetail,
  // Analytics
  getMoodMedicationCorrelation,
  getSymptomMedicationCorrelation,
  getAdherenceMoodCorrelation,
  getOverallWellnessTimeline,
  getOverallStats,
  // Export reports
  generateDoctorReport,
  generateTherapyReport,
} from '@mylife/meds';

export type {
  LowSupplyAlert,
  AdherenceStats,
  DayStatus,
  DayAdherence,
  MedDayStatus,
  CalendarDay,
  MoodQuadrant,
  MoodMedicationCorrelation,
  SymptomMedicationCorrelation,
  SymptomCorrelationItem,
  AdherenceMoodCorrelation,
  WellnessTimelineEntry,
  MedicationSummary,
  OverallStats,
  BundledInteraction,
} from '@mylife/meds';

// --- MyFast (fasting timer, protocols, weight, water, goals, streaks) ---
export { FAST_MODULE } from '@mylife/fast';

// --- Health-specific business logic (new, not absorbed from other modules) ---

// Documents (health records, lab results, prescriptions)
export {
  createDocument,
  getDocuments,
  getDocument,
  getDocumentsByType,
  getStarredDocuments,
  updateDocument,
  deleteDocument,
} from './documents/crud';
export type {
  HealthDocument,
  CreateDocumentInput,
  UpdateDocumentInput,
  DocumentType,
} from './documents/types';
export { MAX_DOCUMENT_SIZE } from './documents/types';

// Vitals (heart rate, HRV, SpO2, BP, temperature, steps, energy)
export {
  logVital,
  getVitals,
  getVitalsByType,
  getVitalsByDateRange,
  getVitalAggregates,
  getLatestVital,
  deleteVital,
} from './vitals/crud';
export type { Vital, LogVitalInput, VitalAggregate, VitalType, VitalSource } from './vitals/types';

// Sleep (sessions, quality scoring)
export {
  logSleep,
  getSleepSessions,
  getSleepByDateRange,
  getLastNightSleep,
  computeQualityScore,
  deleteSleepSession,
} from './sleep/crud';
export type { SleepSession, LogSleepInput, SleepSource } from './sleep/types';
export { DEFAULT_SLEEP_TARGET_HOURS } from './sleep/types';

// Goals (cross-domain health goals)
export {
  createGoal,
  getActiveGoals,
  getGoalById,
  deactivateGoal,
  deleteGoal,
  recordProgress,
  getGoalProgress,
} from './goals/crud';
export type { HealthGoal, CreateGoalInput, GoalProgress, GoalDomain, GoalPeriod, GoalDirection } from './goals/types';

// Emergency info (ICE card)
export {
  getEmergencyInfo,
  updateEmergencyInfo,
} from './emergency/crud';
export type { EmergencyInfo, UpdateEmergencyInfoInput, BloodType } from './emergency/types';

// Consolidated settings
export {
  getHealthSetting,
  setHealthSetting,
  getAllHealthSettings,
  isHealthSyncEnabled,
  setHealthSyncToggle,
} from './settings';

// MySleep manual journal bridge. This reads aggregate sl_* summaries only
// after explicit consent and never writes into hl_sleep_sessions.
export {
  getManualSleepBridgeStatus,
  getSleepJournalContext,
  setManualSleepBridgeEnabled,
} from './integrations';
export type {
  ManualSleepBridgeState,
  ManualSleepBridgeStatus,
  SleepJournalContext,
  SleepJournalContextStatus,
  SleepJournalContextSummary,
  SleepJournalDateRange,
  SleepJournalTrend,
} from './integrations';

// Migration (absorbed module consolidation)
export {
  detectAbsorbedModuleData,
  isAbsorptionMigrated,
  migrateAbsorbedSettings,
  disableAbsorbedModules,
} from './migration/absorb';
export type { AbsorbedModuleData } from './migration/absorb';

// HealthKit integration
export type {
  HealthKitAdapter,
} from './healthkit/adapter';
export { NoOpHealthKitAdapter } from './healthkit/adapter';
export {
  HK_TYPE_MAP,
  VITAL_TO_HK_MAP,
  VITAL_UNIT_MAP,
  SYNC_DATA_TYPES,
  SYNC_TYPE_LABELS,
  SYNC_BATCH_SIZE,
  INITIAL_SYNC_DAYS,
} from './healthkit/types';
export type {
  SyncDataType,
  HealthKitSample,
  HealthKitSleepSample,
  SyncLogEntry,
} from './healthkit/types';
export {
  mapHKTypeToVitalType,
  mapVitalTypeToHK,
  bulkInsertVitals,
  bulkInsertSleep,
  getSyncLog,
  getAllSyncLogs,
  updateSyncAnchor,
  getLastSyncAnchor,
  deleteSyncedVitals,
  deleteSyncedSleep,
  deleteAllSyncedData,
  computeSyncStartDate,
} from './healthkit/sync';
export {
  getRequiredPermissions,
  getEnabledVitalTypes,
  isSleepSyncEnabled,
  getHKIdentifier,
} from './healthkit/permissions';
export {
  mapQuantitySampleToVital,
  mapQuantitySamplesToVitals,
  mapSleepSamplesToSession,
  mapHKUnitToMyHealthUnit,
  isValidSample,
} from './healthkit/data-mappers';
export {
  HEALTH_SYNC_TASK_NAME,
  BACKGROUND_SYNC_INTERVAL_SECONDS,
  BackgroundFetchResult,
} from './healthkit/background-task';
export type { BackgroundSyncConfig, BackgroundFetchResultValue } from './healthkit/background-task';

// ============================================================================
// CEO Review Engines (4 features) -- cross-domain intelligence
// ============================================================================

// --- Daily Health Score ---
export {
  calculateHealthScore, normalizeSleep, normalizeReadiness, normalizeAdherence,
  normalizeMood, normalizeActivity, normalizeMindfulness, getLabel as getHealthScoreLabel,
  calculateDataCompleteness as calculateHealthScoreCompleteness,
  generateInsights as generateHealthScoreInsights,
} from './health-score/engine';
export type {
  HealthScoreInput, HealthScoreResult, HealthScoreBreakdown, HealthScoreLabel,
} from './health-score/engine';

// --- Cross-Domain Correlation ---
export {
  correlate, correlateAll, pearson, alignSeries,
  isSignificant, classifyStrength, classifyDirection, interpretCorrelation,
} from './correlation/engine';
export type {
  TimeSeriesPoint, CorrelationResult, CorrelationPair,
  CorrelationStrength, CorrelationDirection,
} from './correlation/engine';

// --- Weekly Health Digest ---
export {
  compileWeeklyDigest, summarizeSleep as summarizeSleepDigest,
  summarizeVitals as summarizeVitalsDigest, summarizeMood as summarizeMoodDigest,
  summarizeActivity as summarizeActivityDigest, summarizeFasting as summarizeFastingDigest,
  generateHighlights, generateConcerns,
} from './digest/engine';
export type {
  WeeklyDigestInput, WeeklyDigest, SleepDigest, VitalsDigest, MoodDigest,
  ActivityDigest, FastingDigest, MindfulnessDigest,
  DigestSleepDay, DigestVitalReading, DigestMoodEntry, DigestActivityDay, DigestFastingDay,
} from './digest/engine';

// --- Comprehensive Doctor Report ---
export { generateComprehensiveDoctorReport } from './reports/doctor-report';

// ============================================================================
// V2 A-Tier Features (14 features)
// ============================================================================

// --- Types ---
export type {
  BreathingPattern, BreathingSession, BreathingSessionInsert, BreathingPatternConfig, BreathingStats,
  Recommendation, ReadinessScore, ReadinessInput, ReadinessResult,
  ActivitySummary, RingProgress,
  SleepStageBreakdown, SleepStageTarget, SleepAnalysis,
  CbtExerciseType, CbtEntry, CbtExerciseDefinition, CbtStats,
  HrvCategory, HrvAnalysis,
  MeditationType, MeditationSession, MeditationDefinition, MeditationStats,
  BodyMeasurement, BmiCategory,
  SosSession, GroundingStep, SosStats,
  SleepRoutine, RoutineDefinition, SleepHygieneTip,
  ImportLog, DedupResult, ImportSummary,
  Spo2Category, Spo2Analysis,
  SleepBankStatus, SleepBank,
  TimelineEventType, TimelineEvent,
} from './types';

// --- Breathing Exercises ---
export {
  BREATHING_PATTERNS, getPatternConfig, calculateSessionDuration,
  calculateMoodDelta, getBreathingStats,
} from './breathing/engine';
export {
  createBreathingSession, getBreathingSessionById, getBreathingSessions, deleteBreathingSession,
} from './breathing/crud';

// --- Readiness Score ---
export {
  calculateReadinessScore, getRecommendation, normalizeSleepFactor,
  normalizeHrvFactor, normalizeRhrFactor, normalizeActivityFactor,
  normalizeStrainFactor, calculateDataCompleteness,
} from './readiness/engine';
export {
  saveReadinessScore, getReadinessScoreByDate, getRecentReadinessScores, deleteReadinessScore,
} from './readiness/crud';

// --- Activity Tracking ---
export {
  calculateRingProgress, calculateAllRingProgress, isGoalMet,
  calculateStreak, aggregateDailySteps,
} from './activity/engine';
export {
  createActivitySummary, getActivitySummaryByDate, getActivityHistory, deleteActivitySummary,
} from './activity/crud';

// --- Sleep Stage Analysis ---
export {
  calculateStageBreakdown, evaluateStageTargets, calculateSleepEfficiency,
  determineSleepTrend, analyzeSleepSession,
} from './sleep/analysis';

// --- CBT Exercises ---
export {
  CBT_EXERCISES, getExercisePrompts, getExerciseDefinition, getCbtStats,
} from './cbt/exercises';
export {
  createCbtEntry, getCbtEntryById, getCbtEntries, getCbtEntriesByType, deleteCbtEntry,
} from './cbt/crud';

// --- HRV Tracking ---
export {
  calculateBaseline as calculateHrvBaseline, calculatePercentileRank,
  categorizeHrv, calculateTrendDelta as calculateHrvTrendDelta,
  generateInsight as generateHrvInsight, analyzeHrv,
} from './hrv/analysis';

// --- Guided Meditation ---
export {
  MEDITATION_TYPES, getMeditationPrompts, getMeditationDefinition,
  getMeditationStats, getMeditationStreak,
} from './meditation/sessions';
export {
  createMeditationSession, getMeditationSessionById, getMeditationSessions, deleteMeditationSession,
} from './meditation/crud';

// --- Body Composition ---
export {
  calculateBmi, getBmiCategory, calculateLeanMass,
  convertLbsToKg, convertKgToLbs, convertInchesToCm, convertCmToInches,
  convertFeetInchesToCm, calculateMovingAverage,
} from './body/engine';
export {
  logBodyMeasurement, getBodyMeasurementById, getWeightHistory,
  getLatestMeasurement, deleteBodyMeasurement,
} from './body/crud';

// --- SOS/Panic ---
export {
  GROUNDING_STEPS, getGroundingSteps, CRISIS_HOTLINES, getSosStats,
} from './sos/grounding';
export {
  createSosSession, getSosSessionById, getSosSessions, deleteSosSession,
} from './sos/crud';

// --- Sleep Aids ---
export {
  WIND_DOWN_ROUTINES, AMBIENT_SOUNDS, SLEEP_HYGIENE_TIPS,
  getRoutineDefinition, getTipOfTheDay, calculateRoutineCorrelation,
} from './sleep-aids/routines';
export {
  createSleepRoutine, getSleepRoutineById, getSleepRoutines,
  linkRoutineToSleep, deleteSleepRoutine,
} from './sleep-aids/crud';

// --- Multi-App Aggregation ---
export {
  checkDuplicate, deduplicateBatch, parseCsvRecords, buildImportSummary,
} from './aggregation/dedup';
export {
  logImport, getImportLogById, getImportLogs, getSourceSummary, deleteImportLog,
} from './aggregation/crud';

// --- Blood Oxygen Tracking ---
export {
  categorizeSpo2, analyzeSpo2, checkLowAlert as checkSpo2LowAlert,
  determineTrend as determineSpo2Trend,
} from './spo2/analysis';

// --- Sleep Bank ---
export {
  calculateSleepBank, getSleepBankStatus, getSleepBankTrend,
} from './sleep/bank';

// --- Wellness Timeline ---
export {
  createTimelineEvent, mergeTimelineEvents, filterByType,
  filterByDateRange, groupByDate, paginateEvents,
  vitalToTimelineEvent, sleepToTimelineEvent,
} from './timeline/engine';

// ============================================================================
// V3 B+C Features (3 features)
// ============================================================================

// --- V3 Types ---
export type {
  SleepStage, SleepHeartRatePoint, SleepHeartRateAnalysis,
  SmartAlarm, SmartAlarmInsert, TriggerReason, AlarmHistory, WakeWindow, AlarmSuccessRate,
  SnoreIntensity, SnoreScoreCategory, SnoreSessionStatus, SnoreSession, SnoreEvent, SnoreSessionSummary,
} from './types';

// --- Heart Rate During Sleep ---
export {
  getSleepHeartRateData, mapTimestampToStage, getStageAverages,
  calculateHrDip, calculateSleepHrAnalysis,
} from './sleep/hr-analysis';
export type { HrReading, SleepWindow } from './sleep/hr-analysis';

// --- Smart Alarm ---
export {
  calculateWakeWindow, parseTargetTime, shouldTriggerAlarm,
  calculateSuccessRate, getNextAlarmTime, formatDaysOfWeek,
} from './smart-alarm/engine';
export {
  createAlarm, getAlarmById, getEnabledAlarms, getAllAlarms,
  updateAlarm, deleteAlarm,
  logAlarmTrigger, updateAlarmSnooze, dismissAlarmHistory,
  getAlarmHistory, getAllAlarmHistory, deleteAlarmHistory,
} from './smart-alarm/crud';

// --- Snore Detection ---
export {
  classifySnoreIntensity, getIntensityWeight, calculateSnorePercentage,
  calculateSnoreScore, getScoreCategory, getScoreColor,
  finalizeSession as finalizeSnoreSessionStats, sessionsOverlap, SNORE_DISCLAIMER,
} from './snore/engine';
export {
  startSnoreSession, finalizeSnoreSession, cancelSnoreSession,
  getSnoreSessionById, getSnoreHistory, deleteSnoreSession,
  createSnoreEvent, getSnoreEvents, deleteSnoreEvent,
} from './snore/crud';

// --- V2 & V3 Schema & Migrations ---
export { HEALTH_MIGRATION_V2, HEALTH_MIGRATION_V3 } from './db/migrations';
export {
  V2_ALL_TABLES, V2_INDEXES, V2_SEEDS,
  CREATE_BREATHING_SESSIONS, CREATE_READINESS_SCORES, CREATE_ACTIVITY_SUMMARIES,
  CREATE_CBT_ENTRIES, CREATE_MEDITATION_SESSIONS, CREATE_BODY_MEASUREMENTS,
  CREATE_SOS_SESSIONS, CREATE_SLEEP_ROUTINES, CREATE_IMPORT_LOG,
  V3_ALL_TABLES, V3_INDEXES,
  CREATE_SMART_ALARMS, CREATE_ALARM_HISTORY, CREATE_SNORE_SESSIONS, CREATE_SNORE_EVENTS,
} from './db/schema';
