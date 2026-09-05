export { FLASH_MODULE } from './definition';

export type {
  FlashCardType,
  CardQueue,
  CardRating,
  Deck,
  Flashcard,
  FlashBrowserCard,
  FlashBrowserSort,
  ReviewLog,
  FlashSetting,
  FlashDashboard,
  CreateDeckInput,
  UpdateDeckInput,
  CreateFlashcardInput,
  BrowseFlashcardsInput,
  FlashExportRecord,
  ExportFlashDataInput,
  FlashExportBundle,
} from './types';

export {
  FlashCardTypeSchema,
  CardQueueSchema,
  CardRatingSchema,
  DeckSchema,
  FlashcardSchema,
  FlashBrowserCardSchema,
  FlashBrowserSortSchema,
  ReviewLogSchema,
  FlashSettingSchema,
  FlashDashboardSchema,
  CreateDeckInputSchema,
  UpdateDeckInputSchema,
  CreateFlashcardInputSchema,
  BrowseFlashcardsInputSchema,
  FlashExportRecordSchema,
  ExportFlashDataInputSchema,
} from './types';

export {
  DEFAULT_FLASH_DECK_ID,
  listDecks,
  getDeckById,
  createDeck,
  updateDeck,
  createFlashcards,
  listCardsForDeck,
  browseFlashcards,
  listDueFlashcards,
  listFlashTags,
  getFlashcardById,
  rateFlashcard,
  suspendFlashcard,
  unsuspendFlashcard,
  buryFlashcard,
  buryFlashNote,
  unburyFlashcards,
  listReviewLogsForCard,
  getFlashSetting,
  setFlashSetting,
  listFlashSettings,
  exportFlashData,
  listFlashExportRecords,
  getFlashDashboard,
  getLastStudiedDeck,
  undoLastRating,
  starFlashcard,
  unstarFlashcard,
  listStarredFlashcards,
} from './db';

export {
  calculateStudyStreak,
  scheduleFlashcard,
} from './engine/scheduler';

export {
  buildClozeFlashcards,
  parseClozeText,
  renderClozeBack,
  renderClozeFront,
} from './engine/cloze';

export {
  parseFlashSearchQuery,
} from './engine/search';

export {
  serializeFlashExport,
} from './engine/export';

// Reminders
export type { ReminderConfig, NotificationPayload } from './reminders';
export { buildNotificationContent, parseReminderConfig, filterDueByDecks } from './reminders';

// Streaks
export type { StreakMilestone, CelebrationEvent, BadgeColor, BadgeState } from './streaks';
export { MILESTONES, checkMilestone, getBadgeColor, getAtRiskState, getBadgeState, getEncouragingMessage } from './streaks';

// Multiple Choice
export type { MCOption, MCQuestion, MCSessionConfig, MCResult } from './mc';
export { getEligibleCards as getMCEligibleCards, generateMCQuestions, calculateMCScore } from './mc';

// Match Game
export type { TileSide, MatchTile, MatchBoard, MatchResult as MatchGameResult } from './match';
export { generateBoard, checkMatch, calculateStars } from './match';

// AI Card Generation
export type { GenerationMode, CardTypePreference, GenerationConfig, GeneratedCard, GenerationResult } from './ai';
export { generateCardsOnDevice, generateCards, validateTextLength, extractDefinitions, extractColonDefinitions, extractLists, extractBoldTerms, deduplicateCards } from './ai';

// Media
export type { MediaType, MediaFile, CreateMediaInput } from './media';
export { validateMediaFile, mediaTagForImage, mediaTagForAudio, removeMediaTag } from './media';

// DB: Media, MC Results, Match Results
export { createMediaFile, getMediaByHash, incrementMediaRef, decrementMediaRef, deleteOrphanMedia } from './db';
export { saveMCResult, listMCResults } from './db';
export type { MCResultRecord } from './db';
export { saveMatchResult, getMatchBest, updateMatchBest, listMatchResults } from './db';
export type { MatchResultRecord, MatchBestRecord } from './db';

// Occlusion
export type { OcclusionShape, OcclusionRegion, CreateOcclusionRegionInput, OcclusionCardSet } from './occlusion';
export { clampRegion, percentToPixel, pixelToPercent, regionContainsPoint, validateRegions, regionArea, isSmallRegion } from './occlusion';
export { createOcclusionRegion, listRegionsForCard, listRegionsForMedia, deleteOcclusionRegion, deleteRegionsForCard } from './db';

// Custom Templates
export type { TemplateFieldType, Template, TemplateField, CreateTemplateInput, CreateFieldInput } from './templates';
export { renderCardContent, extractPlaceholders, validateTemplateInput, sanitizeFieldName, buildFieldDefaults, BUILTIN_TEMPLATE_IDS } from './templates';
export type { BuiltinTemplateKey } from './templates';
export { listTemplates, getTemplateById, createTemplate, deleteTemplate } from './db';

// Practice Tests
export type { QuestionType, TestStatus, PracticeTestConfig, PracticeTest, PracticeAnswer, PracticeQuestion, TestScoreResult } from './practice';
export { generateMCQuestion as generatePracticeMCQuestion, generateTFQuestion, generateShortAnswerQuestion, generateFillBlankQuestion, generateTestQuestions } from './practice';
export { levenshteinDistance, normalizeAnswer, scoreShortAnswer, calculateTestScore } from './practice';
export { createPracticeTest, savePracticeAnswer, submitAnswer, completePracticeTest, abandonPracticeTest, getPracticeTestById, listPracticeTests, listAnswersForTest } from './db';

// Conversation Practice
export type { ConversationMode, ConversationDifficulty, ConversationStatus, MessageRole, Conversation, ConversationMessage, ConversationConfig, CardContext } from './conversation';
export { selectCardsForContext, formatCardContext, estimateTokens, buildSystemPrompt, buildOpeningMessage, extractPerformanceRating, FIRST_QUESTIONS, SUMMARY_INSTRUCTION } from './conversation';
export { createConversation, addConversationMessage, completeConversation, abandonConversation, getConversationById, listConversations, listMessagesForConversation } from './db';

// Competitive Leagues
export type { LeagueTier, LeagueStatus, League, LeagueMember, LeagueScore, XPBreakdown, PromotionResult, TierDefinition } from './leagues';
export { calculateXP, determinePromotions, generateInviteCode, getWeekStart, getWeekEnd, TIER_DEFINITIONS, TIER_ORDER, getTierDefinition, getNextTier, getPreviousTier } from './leagues';
export { createLeague, addLeagueMember, upsertLeagueScore, getLeagueById, listLeagueMembers, listLeagueScores, listActiveLeagues } from './db';

// Study Analytics
export type { RetentionStats, ReviewForecastDay, StudyTimeEstimate, AccuracyTrendPoint, DifficultyBucket, MaturityLevel, MaturityBucket } from './engine/analytics';
export { calculateRetentionRate, buildReviewForecast, calculateStudyTime, getAccuracyTrend, getDifficultyDistribution, getMaturityDistribution } from './engine/analytics';

// Forgetting Curve
export type { RetentionDataPoint, HalfLifeEstimate, RetentionPrediction, RetentionLevel, RetentionBucket } from './engine/forgetting-curve';
export { calculatePersonalRetention, estimateHalfLife, predictRetention, getRetentionBuckets } from './engine/forgetting-curve';

// Cross-Module Study Signals
export type { StudySignal, CardSuggestion, VocabularyPair, NoteExcerpt, CardSuggestionValidation } from './engine/cross-module';
export { getStudySignal, validateCardSuggestion, buildVocabularyCards, buildStudyDeckFromNotes } from './engine/cross-module';

// Anki Import
export type { AnkiNote, AnkiCard, AnkiDeck, AnkiModel, AnkiSchedulingState, ApkgMetadata, ApkgParseResult, ApkgParseWarning } from './engine/anki-import';
export { parseApkgMetadata, parseApkgDecks, parseApkgCards, mapAnkiScheduling } from './engine/anki-import';

// Study Sessions
export type { StudySession, SessionDurationEstimate, OptimalStudyTime, SessionXP } from './engine/session';
export { detectSessions, createSessionSummary, estimateSessionDuration, getOptimalStudyTime, calculateSessionXP } from './engine/session';
