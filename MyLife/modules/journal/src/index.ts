export { JOURNAL_MODULE } from './definition';

export type {
  JournalMood,
  JournalPromptCategory,
  JournalNotebook,
  JournalEntry,
  JournalTag,
  JournalSetting,
  JournalPrompt,
  JournalSearchResult,
  JournalOnThisDayItem,
  JournalDashboard,
  CreateJournalNotebookInput,
  CreateJournalEntryInput,
  UpdateJournalEntryInput,
  JournalEntryFilter,
  JournalExportBundle,
  EntryType,
} from './types';

export {
  JournalMoodSchema,
  JournalPromptCategorySchema,
  JournalNotebookSchema,
  JournalEntrySchema,
  JournalTagSchema,
  JournalSettingSchema,
  JournalPromptSchema,
  JournalSearchResultSchema,
  JournalOnThisDayItemSchema,
  JournalDashboardSchema,
  CreateJournalNotebookInputSchema,
  CreateJournalEntryInputSchema,
  UpdateJournalEntryInputSchema,
  JournalEntryFilterSchema,
  EntryTypeSchema,
} from './types';

export {
  createJournalNotebook,
  getJournalNotebookById,
  listJournalNotebooks,
  createJournalEntry,
  getJournalEntryById,
  listJournalEntries,
  searchJournalEntries,
  updateJournalEntry,
  deleteJournalEntry,
  getEntriesForDate,
  listJournalTags,
  getJournalSetting,
  setJournalSetting,
  getJournalDashboard,
  listOnThisDayEntries,
  exportJournalData,
  // Voice CRUD (V3)
  createVoiceRecording,
  getVoiceRecordingById,
  listVoiceRecordingsForEntry,
  updateTranscriptionStatus,
  deleteVoiceRecording,
  deleteVoiceRecordingsForEntry,
  // CBT CRUD (V3)
  createThoughtRecord,
  getThoughtRecordById,
  listThoughtRecordsForEntry,
  listCompletedThoughtRecords,
  updateThoughtRecordStep,
  completeThoughtRecord,
  deleteThoughtRecord,
  addEmotions,
  updateEmotionAfter,
  listEmotionsForRecord,
  addDistortions,
  listDistortionsForRecord,
  getDistortionFrequency,
  // Therapy CRUD (V3)
  addTherapyTopic,
  getTherapyTopicById,
  listTherapyTopicsForEntry,
  updateTherapyTopicContent,
  updateTherapyTopicOrder,
  toggleTherapyTopicCompleted,
  deleteTherapyTopic,
  deleteTherapyTopicsForEntry,
  reorderTherapyTopics,
} from './db';

export {
  calculateJournalStreak,
  countWords,
  estimateReadingTimeMinutes,
  summarizeMoodDistribution,
} from './engine/stats';
export { getDailyJournalPrompt, listJournalPromptCategories } from './engine/prompts';
export { serializeJournalExport } from './engine/export';

// Voice engine (V3)
export {
  buildRecordingPath,
  shouldAutoStop,
  isFileSizeExceeded,
  insertTranscription,
  handleEmptyTranscription,
  handlePartialTranscription,
  processTranscriptionResult,
  DEFAULT_RECORDING_CONFIG,
  MAX_AUDIO_SIZE_BYTES,
  VoiceRecordingSchema,
  CreateVoiceRecordingInputSchema,
} from './voice';
export type {
  VoiceRecording,
  CreateVoiceRecordingInput,
  TranscriptionResult,
  Transcriber,
} from './voice';

// Metadata engine (V3)
export {
  validateCoordinates,
  buildLocationData,
  formatPlaceName,
  LOCATION_TIMEOUT_MS,
  mapWeatherCode,
  parseWeatherResponse,
  buildWeatherUrl,
  LocationDataSchema,
  WeatherDataSchema,
  EntryMetadataSchema,
} from './metadata';
export type { LocationData, WeatherData, EntryMetadata, MetadataSettings } from './metadata';

// CBT engine (V3)
export {
  calculateEmotionalImpact,
  calculateBeliefReduction,
  computeDistortionFrequency,
  isValidDistortionType,
  COGNITIVE_DISTORTIONS,
  getDistortionByType,
  PREDEFINED_EMOTIONS,
  ThoughtRecordSchema,
  RecordEmotionSchema,
  RecordDistortionSchema,
  DistortionTypeSchema,
} from './cbt';
export type {
  ThoughtRecord,
  RecordEmotion,
  RecordDistortion,
  DistortionType,
  EmotionalImpact,
  DistortionFrequency,
  DistortionDefinition,
} from './cbt';

// Therapy engine (V3)
export {
  THERAPY_TEMPLATES,
  SECTION_LABELS,
  getTemplateByType,
  getTemplateSections,
  getNextSessionNumber,
  getTherapySessionInfo,
  autoPopulateMoodSummary,
  getRecentThoughtRecordCount,
  TherapyTemplateTypeSchema as TherapyTemplateTypeSchemaV3,
  TherapyTopicSectionSchema,
  TherapyTopicSchema,
} from './therapy';
export type {
  TherapyTemplateType,
  TherapyTopicSection,
  TherapyTopic,
  TherapyTemplate,
  TherapySessionInfo,
} from './therapy';

// AI Prompts engine (V4)
export {
  analyzeMoodTrend,
  selectTheme,
  fillTemplate,
  generatePrompt,
  dateToHash,
  PROMPT_THEMES,
  getThemeDefinition,
  AiPromptThemeSchema,
  MoodTrendSchema,
  AiPromptSchema,
} from './ai-prompts';
export type { AiPromptTheme, MoodTrend, AiPrompt, PromptContext, ThemeDefinition } from './ai-prompts';

// Philosophy engine (V4)
export {
  getDayOfYear,
  isLeapYear,
  getQuoteDayNumber,
  formatReflectionEntry,
  formatQuoteForClipboard,
  PhiloTraditionSchema,
  PhilosophyQuoteSchema,
} from './philosophy';
export type { PhiloTradition, PhilosophyQuote } from './philosophy';

// Affirmations engine (V4)
export {
  selectDailyAffirmation,
  calculateAffirmationStreak,
  validateAffirmationText,
  AffirmationCategorySchema,
  AffirmationActionSchema,
  AffirmationSchema,
  AffirmationLogSchema,
} from './affirmations';
export type { AffirmationCategory, Affirmation, AffirmationLog } from './affirmations';

// Grid engine (V4)
export {
  validateGridSize,
  assembleGridToMarkdown,
  calculateGridWordCount,
  parseGridConfig,
  BUILT_IN_LAYOUTS,
  GridCellSchema,
  GridConfigSchema,
  GridLayoutSchema,
} from './grid';
export type { GridCell, GridConfig, GridLayout } from './grid';

// Vision Board engine (V4)
export {
  getExportDimensions,
  normalizedToPixels,
  validateItemSize,
  clampRotation,
  isBoardLimitReached,
  isItemLimitReached,
  BoardOrientationSchema,
  VisionBoardItemTypeSchema,
  VisionBoardSchema,
  VisionBoardItemSchema,
  MAX_BOARDS,
  MAX_ITEMS_PER_BOARD,
} from './vision-board';
export type { BoardOrientation, VisionBoard, VisionBoardItem, CanvasDimensions } from './vision-board';

// Book Builder engine (V4)
export {
  getPageDimensions,
  getPageMargins,
  estimatePageCount,
  moodToEmoji,
  formatEntryForPage,
  generateTOC,
  validateBookConfig,
  CoverTemplateSchema,
  BodyFontSchema,
  PageSizeSchema,
  BookConfigSchema,
  MAX_ENTRIES_PER_BOOK,
  WORDS_PER_PAGE,
} from './book-builder';
export type { CoverTemplate, BodyFont, PageSize, BookConfig, BookEstimate } from './book-builder';

// Writing Insights engine (CEO review)
export {
  computeWordCountTrend,
  computeTopTags,
  estimateVocabularyRichness,
  computeTagMoodCorrelation,
  computeWritingTimeDistribution,
  computeWritingInsights,
  WordCountTrendSchema,
  TagInsightSchema,
  WritingInsightsSchema,
} from './engine/writing-insights';
export type { WordCountTrend, TagInsight, WritingInsights } from './engine/writing-insights';

// Therapeutic Progress engine (CEO review)
export {
  computeThoughtRecordCompletionRate,
  computeAvgBeliefReduction,
  rankDistortionsByFrequency,
  computeEmotionalIntensityTrend,
  computeTherapyPrepConsistency,
  computeTherapeuticProgress,
  EmotionalTrendSchema,
  DistortionRankingSchema,
  TherapeuticProgressSchema,
} from './engine/therapeutic-progress';
export type { EmotionalTrend, DistortionRanking, TherapeuticProgress } from './engine/therapeutic-progress';

// Habit Intelligence engine (CEO review)
export {
  computeConsistencyScore,
  computeEntryRichness,
  computeEntryRichnessTrend,
  findBestWritingDay,
  findBestWritingTime,
  computePromptAdherence,
  computeHabitIntelligence,
  ConsistencyTrendSchema,
  HabitIntelligenceSchema,
} from './engine/habit-intelligence';
export type { ConsistencyTrend, HabitIntelligence } from './engine/habit-intelligence';

// Nostalgia engine (CEO review)
export {
  scoreOnThisDayEntry,
  rankOnThisDayEntries,
  NostalgiaScoreSchema,
} from './engine/nostalgia';
export type { NostalgiaScore } from './engine/nostalgia';

// Challenge system (CEO review)
export {
  getChallengeDefinition,
  checkDayCompletion,
  computeChallengeProgress,
  CHALLENGE_DEFINITIONS,
  ChallengeTypeSchema,
  ChallengeRequirementSchema,
  ChallengeDefinitionSchema,
  ChallengeProgressSchema,
} from './engine/challenges';
export type {
  ChallengeType,
  ChallengeRequirement,
  ChallengeDefinition,
  ChallengeProgress,
} from './engine/challenges';
