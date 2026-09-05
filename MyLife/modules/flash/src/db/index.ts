export {
  DEFAULT_FLASH_DECK_ID,
} from './schema';

export {
  createMediaFile,
  getMediaByHash,
  incrementMediaRef,
  decrementMediaRef,
  deleteOrphanMedia,
} from './media';

export {
  saveMCResult,
  listMCResults,
} from './mc-results';
export type { MCResultRecord } from './mc-results';

export {
  saveMatchResult,
  getMatchBest,
  updateMatchBest,
  listMatchResults,
} from './match-results';
export type { MatchResultRecord, MatchBestRecord } from './match-results';

export {
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
} from './crud';

// Occlusion
export {
  createOcclusionRegion,
  listRegionsForCard,
  listRegionsForMedia,
  deleteOcclusionRegion,
  deleteRegionsForCard,
} from './occlusion';

// Templates
export {
  listTemplates,
  getTemplateById,
  createTemplate,
  deleteTemplate,
} from './templates';

// Practice tests
export {
  createPracticeTest,
  savePracticeAnswer,
  submitAnswer,
  completePracticeTest,
  abandonPracticeTest,
  getPracticeTestById,
  listPracticeTests,
  listAnswersForTest,
} from './practice';

// Conversations
export {
  createConversation,
  addConversationMessage,
  completeConversation,
  abandonConversation,
  getConversationById,
  listConversations,
  listMessagesForConversation,
} from './conversation';

// Leagues
export {
  createLeague,
  addLeagueMember,
  upsertLeagueScore,
  getLeagueById,
  listLeagueMembers,
  listLeagueScores,
  listActiveLeagues,
} from './leagues';
