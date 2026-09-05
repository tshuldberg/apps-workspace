export { SLEEP_MODULE } from './definition';

export {
  createFactor,
  createDream,
  createEntry,
  deleteEntry,
  deleteDream,
  deleteFactor,
  deleteHygieneCheck,
  getEntryByDate,
  getEntriesByDateRange,
  getDream,
  getDreamDictionaryNotes,
  getDreamStats,
  getDreamsByEntry,
  getEntry,
  getGoal,
  getActiveGoals,
  getFactor,
  getFactorByDate,
  getFactorByEntry,
  getFactorCorrelations,
  getHygieneChecksByDate,
  getLatestEntry,
  getRecurringGroup,
  listFactors,
  listHygieneChecks,
  listAllDreams,
  listEntries,
  listDreams,
  saveFactorLog,
  saveHygieneCheck,
  setDreamDictionaryNote,
  updateEntry,
  updateDream,
  updateFactor,
  createNap,
  createGoal,
  deleteNap,
  deactivateGoal,
  getNapsByDate,
  listNaps,
  updateGoal,
  checkGoalProgress,
  getStreaks,
  updateStreak,
  resetStreak,
  getStreakHistory,
} from './db';

export {
  ALL_TABLES,
  CREATE_DREAMS,
  CREATE_DREAMS_FTS,
  CREATE_DREAMS_FTS_DELETE_TRIGGER,
  CREATE_DREAMS_FTS_INSERT_TRIGGER,
  CREATE_DREAMS_FTS_UPDATE_TRIGGER,
  CREATE_DREAM_V2_INDEXES,
  DREAM_FTS_MIGRATION_UP,
  CREATE_FACTORS,
  CREATE_GOALS,
  CREATE_HYGIENE_CHECKS,
  CREATE_HYGIENE_INDEXES,
  CREATE_INDEXES,
  CREATE_NAPS,
  CREATE_SETTINGS,
  CREATE_SLEEP_ENTRIES,
  CREATE_STREAK_HISTORY,
  CREATE_STREAK_HISTORY_INDEXES,
  CREATE_STREAKS,
  HYGIENE_MIGRATION_UP,
  STREAK_HISTORY_MIGRATION_UP,
  SEED_SETTINGS,
  SLEEP_MIGRATIONS,
  getSleepMigrations,
} from './db';

export {
  evaluateEntry,
  evaluateStreakType,
  generateAccountabilityMessage,
  getWeeklySummary,
  type SleepEntryGoalEvaluation,
  type SleepGoalEvaluationResult,
  type SleepStreakEvaluationOptions,
  type SleepWeeklyProgressSummary,
} from './engine/progress';

export {
  formatClockMinutes,
  getBestNights,
  getMonthlyAverage,
  getTrendData,
  getWeeklyAverage,
  getWeekendVsWeekday,
  getWorstNights,
} from './engine/analytics';

export {
  calculateConsistencyScore,
  getBedtimeVariance,
  getSleepConsistencySummary,
  getWakeTimeVariance,
} from './engine/consistency';

export {
  correlateAlcohol,
  correlateCaffeine,
  correlateExercise,
  correlateScreenTime,
  correlateStress,
  generateInsight,
  getTopCorrelations,
  type SleepCorrelationConfidence,
  type SleepCorrelationDirection,
  type SleepCorrelationFactor,
  type SleepCorrelationGroupSummary,
  type SleepCorrelationResult,
  type SleepCorrelationStatus,
} from './engine/correlations';

export {
  buildWeeklyGoalDots,
  calculateReminderFireDate,
  compactStreakHistory,
  formatGoalProgress,
  formatGoalTarget,
  formatGoalTypeLabel,
  formatReminderSummary,
  formatStreakTypeLabel,
  getDefaultGoalTarget,
  getGoalTargetPlaceholder,
  isNewLongestStreak,
  type SleepGoalWeekDot,
} from './engine/goals-presentation';

export {
  getChronotypeEstimate,
  findOptimalBedtime,
  findOptimalDuration,
} from './engine/optimal-window';

export {
  assessChronotype,
  getChronotypeAssessment,
  getCircadianProfile,
  type Chronotype,
  type ChronotypeAssessmentResult,
  type ChronotypeAssessmentStatus,
  type CircadianProfile,
  type CircadianProfilePhase,
  type CircadianProfilePoint,
} from './engine/chronotype';

export {
  createJetLagTracker,
  getAdjustmentProgress,
  getRecommendation,
  getRecommendedSleepTime,
  type JetLagDirection,
  type JetLagTracker,
} from './engine/jet-lag';

export {
  evaluateShiftSleep,
  getExpectedSleepWindow,
  setShiftPattern,
  type ExpectedSleepWindow,
  type ShiftBlock,
  type ShiftPattern,
  type ShiftSleepEvaluation,
  type ShiftSleepRating,
} from './engine/shift-work';

export {
  generateYearReview,
  type YearReview,
  type YearReviewComparison,
  type YearReviewDreamStats,
  type YearReviewImprovementMetric,
  type YearReviewInput,
  type YearReviewLongestStreak,
  type YearReviewMonthHighlight,
  type YearReviewMonthStats,
  type YearReviewTrend,
} from './engine/year-review';

export {
  DEFAULT_SLEEP_HYGIENE_PRACTICE_IDS,
  SLEEP_HYGIENE_PRACTICES,
  buildSleepHygieneChecklist,
  getEnabledHygienePracticeIds,
  getSleepHygieneDashboard,
  serializeEnabledHygienePracticeIds,
  type SleepHygieneChecklistItem,
  type SleepHygieneChecklistSource,
  type SleepHygieneCorrelationDirection,
  type SleepHygieneCorrelationStatus,
  type SleepHygieneDailyChecklist,
  type SleepHygieneDashboard,
  type SleepHygieneDashboardInput,
  type SleepHygienePractice,
  type SleepHygieneQualityCorrelation,
  type SleepHygieneStatus,
} from './engine/hygiene';

export {
  getNapDurationTrend,
  getNapImpactInsight,
  getNapSummary,
  type NapDurationTrendPoint,
  type NapImpactDirection,
  type NapImpactInsight,
  type NapImpactStatus,
  type NapSummary,
} from './engine/naps';

export {
  getSleepMoodCorrelation,
  type SleepMoodCorrelation,
  type SleepMoodCorrelationDateRange,
  type SleepMoodCorrelationStatus,
  type SleepMoodPair,
} from './integrations/mood';

export {
  buildHabitCompletionHints,
  getSleepHabitAdherence,
  suggestSleepHabits,
  type HabitCompletionHint,
  type SleepHabitAdherenceDateRange,
  type SleepHabitAdherenceDay,
  type SleepHabitAdherenceStatus,
  type SleepHabitAdherenceSummary,
  type SleepHabitHintConfidence,
  type SleepHabitHintSource,
  type SleepHabitSuggestion,
  type SleepRoutineHabit,
} from './integrations/habits';

export {
  buildHealthSyncPreview,
  getHealthBridgeSummary,
  HEALTH_SLEEP_JOURNAL_BRIDGE_SETTING_KEY,
  SLEEP_HEALTH_BRIDGE_SETTING_KEY,
  type HealthBridgeDateRange,
  type HealthBridgeLatestNight,
  type HealthBridgeSummary,
  type HealthBridgeSummaryStatus,
  type HealthBridgeTrend,
  type HealthSyncPreview,
  type HealthSyncPreviewStatus,
} from './integrations/health';

export {
  calculateSleepDebt,
  getDailyDebt,
  getDebtTrend,
  getRecoveryEstimate,
} from './engine/sleep-debt';

export {
  calculateSleepEfficiency,
  generateCBTIDiaryEntry,
  getEfficiencyTrend,
  getSleepRestrictionWindow,
  sortCBTIDiaryEntries,
} from './engine/cbti';

export {
  exportToCBTIFormat,
  exportToCSV,
} from './engine/export';

export {
  calculateDuration,
  calculateSleepLatency,
} from './engine/duration';

export {
  indexDream,
  searchDreams,
} from './engine/dream-search';

export {
  buildDreamTimelineSections,
  filterDreams,
  findRecurringDreamCandidates,
  findRelatedDreams,
  getDreamExcerpt,
  getRecurringDreamGroupId,
  getDreamPeopleSuggestions,
  getDreamTypeMeta,
  DREAM_EMOTION_OPTIONS,
} from './engine/dream-presentation';

export {
  DREAM_DICTIONARY_NOTES_SETTING_KEY,
  getDreamDictionary,
  getDreamPatternDashboard,
  getDreamRateTrend,
  getDreamTypeDistribution,
  getDreamsPerWeekAverage,
  getEmotionDistribution,
  getLucidDreamRate,
  getNightmareRate,
  getRecurringDreamSummary,
  getThemeFrequency,
  parseDreamDictionaryNotes,
  searchDreamDictionary,
  serializeDreamDictionaryNotes,
  sortDreamDictionary,
  updateDreamDictionaryNotesMap,
} from './engine/dream-patterns';

export {
  buildFactorCreateInput,
  createEmptyFactorLogDraft,
  FACTOR_LOG_MODES,
  FACTOR_ROOM_LIGHT_OPTIONS,
  FACTOR_ROOM_NOISE_OPTIONS,
  FACTOR_ROOM_TEMP_OPTIONS,
  formatFactorClockTime,
  getDefaultFactorLogMode,
  getFactorLogDraftFromFactor,
  getFactorRoomLightMeta,
  getFactorRoomNoiseMeta,
  getFactorRoomTempMeta,
  getPreSleepActivityMeta,
  getSleepSupplementMeta,
  getStressLevelMeta,
  isFactorLogMode,
  PRE_SLEEP_ACTIVITY_OPTIONS,
  resolveFactorLogDate,
  SLEEP_SUPPLEMENT_OPTIONS,
  STRESS_LEVEL_OPTIONS,
} from './engine/factor-log';

export {
  buildMorningLogEntryInput,
  buildMorningLogEntryInputForDate,
  formatDurationLabel,
  getMorningLogDraftFromEntry,
  getMorningLogSummary,
  getMorningLogSummaryForDate,
} from './engine/morning-log';

export {
  buildSleepTimelineSections,
  formatSleepEntryDateLabel,
  formatSleepTimeLabel,
  formatSleepWeekLabel,
  getSleepDurationTone,
  getSleepWakeFeelingMeta,
  getSleepWeekStart,
  renderSleepQualityStars,
} from './engine/timeline';

export {
  DREAM_THEME_TAXONOMY,
  DreamCreateSchema,
  DreamListOptionsSchema,
  DreamSchema,
  DreamStatsSchema,
  DreamTypeSchema,
  DreamUpdateSchema,
} from './models/dream-schemas';

export {
  NapCreateSchema,
  NapListOptionsSchema,
  NapSchema,
  SleepDateSchema,
  SleepDateTimeSchema,
  SleepEntryCreateSchema,
  SleepEntryListOptionsSchema,
  SleepEntrySchema,
  SleepEntryUpdateSchema,
  SleepPastOrPresentDateTimeSchema,
} from './models/schemas';

export {
  SLEEP_HYGIENE_PRACTICE_IDS,
  SleepHygieneCheckCreateSchema,
  SleepHygieneCheckListOptionsSchema,
  SleepHygieneCheckSchema,
  SleepHygieneCheckSourceSchema,
  SleepHygienePracticeIdSchema,
} from './models/hygiene-schemas';

export {
  SLEEP_STREAK_TYPES,
  SleepGoalCreateSchema,
  SleepGoalDateRangeSchema,
  SleepGoalProgressSchema,
  SleepGoalSchema,
  SleepGoalTypeSchema,
  SleepGoalUpdateSchema,
  SleepStreakHistoryPointSchema,
  SleepStreakSchema,
  SleepStreakTypeSchema,
  normalizeGoalNotes,
  normalizeGoalTargetValue,
  parseGoalTargetNumber,
  type SleepGoal,
  type SleepGoalCreateInput,
  type SleepGoalDateRange,
  type SleepGoalProgress,
  type SleepGoalType,
  type SleepGoalUpdateInput,
  type SleepStreak,
  type SleepStreakHistoryPoint,
  type SleepStreakType,
} from './models/goal-schemas';

export {
  PRE_SLEEP_ACTIVITY_TAXONOMY,
  SLEEP_SUPPLEMENT_TAXONOMY,
  FactorCorrelationMetricSchema,
  FactorCorrelationsSchema,
  FactorCreateSchema,
  FactorDateSchema,
  FactorListOptionsSchema,
  FactorMetricCorrelationSchema,
  FactorRoomLightSchema,
  FactorRoomNoiseSchema,
  FactorRoomTempSchema,
  FactorSchema,
  FactorUpdateSchema,
  SleepClockTimeSchema,
} from './models/factor-schemas';

export type {
  SleepBridgeSettings,
  SleepModuleStatus,
  SleepSetting,
  SleepSettingKey,
  SleepWakeFeeling,
} from './types';

export type {
  Dream,
  DreamCreateInput,
  DreamListOptions,
  DreamStatItem,
  DreamStats,
  DreamType,
  DreamUpdateInput,
} from './models/dream-schemas';

export type {
  FactorLogDraft,
  FactorLogMode,
  FactorOptionMeta,
  StressLevelMeta,
} from './engine/factor-log';

export type {
  SleepAnalyticsDateRange,
  SleepAnalyticsEntry,
  SleepAverageSummary,
  SleepNightConditions,
  SleepNightInsight,
  SleepTrendGranularity,
  SleepTrendPoint,
  WeekendVsWeekdaySummary,
} from './engine/analytics';

export type {
  SleepConsistencySummary,
} from './engine/consistency';

export type {
  ChronotypeEstimate,
  OptimalBedtimeWindow,
  OptimalDurationWindow,
  OptimalWindowConfidence,
} from './engine/optimal-window';

export type {
  SleepDebtRecoveryEstimate,
  SleepDebtTrendPoint,
} from './engine/sleep-debt';

export type {
  CBTIDiaryEntry,
  SleepEfficiencyTrendPoint,
  SleepRestrictionWindow,
  SleepRestrictionWindowOptions,
  SleepRestrictionWindowStatus,
} from './engine/cbti';

export type {
  SleepCsvExport,
} from './engine/export';

export type {
  Factor,
  FactorAssociationSummary,
  FactorCorrelationMetric,
  FactorCorrelationPoint,
  FactorCorrelations,
  FactorCreateInput,
  FactorListOptions,
  FactorMetricCorrelation,
  FactorRoomLight,
  FactorRoomNoise,
  FactorRoomTemp,
  FactorUpdateInput,
  PreSleepActivity,
  SleepSupplement,
} from './models/factor-schemas';

export type {
  Nap as NapRecord,
  NapCreateInput as CreateNapInput,
  NapListOptions,
  SleepEntry as SleepEntryRecord,
  SleepEntryCreateInput as CreateSleepEntryInput,
  SleepEntryListOptions,
  SleepEntryUpdateInput as UpdateSleepEntryInput,
} from './models/schemas';

export type {
  SleepHygieneCheck,
  SleepHygieneCheckCreateInput,
  SleepHygieneCheckListOptions,
  SleepHygieneCheckSource,
  SleepHygienePracticeId,
} from './models/hygiene-schemas';

export type {
  DreamDictionaryEntry,
  DreamDictionaryNotesMap,
  DreamDictionarySort,
  DreamEmotionCountItem,
  DreamEmotionDistributionItem,
  DreamPatternDashboard,
  DreamPatternDateRange,
  DreamRateSummary,
  DreamThemeFrequencyItem,
  DreamTrendPoint,
  DreamTypeDistributionItem,
  RecurringDreamSummaryItem,
} from './engine/dream-patterns';

export type {
  DreamEmotionOption,
  DreamFilterState,
  DreamTimelineSection as DreamMonthSection,
  DreamTypeMeta,
} from './engine/dream-presentation';

export type {
  DreamSearchIndexEntry,
  DreamSearchOptions,
} from './engine/dream-search';

export type {
  MorningLogDraft,
  MorningLogSummary,
} from './engine/morning-log';

export type {
  SleepDurationTone,
  SleepTimelineSection,
} from './engine/timeline';

export {
  DEFAULT_SLEEP_BRIDGE_SETTINGS,
  DEFAULT_SLEEP_MODULE_STATUS,
  SleepBridgeSettingsSchema,
  SleepModuleStatusSchema,
  SleepSettingKeySchema,
  SleepSettingSchema,
  SleepWakeFeelingSchema,
} from './types';
