// Definition
export { WORDS_MODULE } from './definition';

// Service
export {
  getMyWordsLanguages,
  lookupWord,
  browseWordsAlphabetically,
  suggestWordReplacements,
  __resetMyWordsServiceCacheForTests,
} from './service';

// Saved Words CRUD
export {
  saveWord,
  unsaveWord,
  getSavedWord,
  getSavedWordByWordAndLang,
  getSavedWords,
  updateSavedWord,
  incrementLookupCount,
  getSavedWordCount,
  getSavedWordCountByLanguage,
  getSavedWordCountByList,
  truncateLookupData,
  createWordList,
  getWordList,
  getWordLists,
  updateWordList,
  deleteWordList,
  // V2: Flash bridge
  setFlashCardId,
  // V3: Offline cache
  cacheLookupResult,
  getCachedLookup,
  evictLruEntries,
  evictStaleEntries,
  getCachePrefixMatches,
  getCacheStats,
  clearCache,
  // V4: Advanced search
  getDistinctPartsOfSpeech,
  searchSavedWordsFts,
  escapeFtsQuery,
  advancedSearchSavedWords,
} from './db';
export type { GetSavedWordsOptions, CachedLookup, SavedWordLight } from './db';
export { getSavedWordsLightweight } from './db';

// Flash Bridge (V2)
export {
  buildFlashcardContent,
  buildFlashcardTags,
  getOrCreateVocabularyDeck,
  createFlashcardFromWord,
  bulkCreateFlashcards,
  checkFlashCardExists,
} from './flash-bridge';
export type { FlashBridgeDeps } from './flash-bridge';

// Offline (V3)
export { lookupWordWithFallback, cacheAfterLookup } from './offline';

// Search (V4)
export { escapeFtsQuery as escapeFts, advancedSearchSavedWords as advancedSearch } from './search';

// Types
export type {
  BrowseAlphabeticalWordsInput,
  LookupWordInput,
  WordHelperInput,
  MyWordsProvider,
  MyWordsLanguage,
  MyWordsPronunciation,
  MyWordsForm,
  MyWordsQuote,
  MyWordsSense,
  MyWordsEntry,
  MyWordsAttribution,
  MyWordsAlphabeticalBrowseResult,
  MyWordsWordHelperSuggestion,
  MyWordsWordHelperResult,
  MyWordsLookupResult,
  SavedWord,
  CreateSavedWordInput,
  UpdateSavedWordInput,
  SavedWordSortBy,
  WordList,
  CreateWordListInput,
  UpdateWordListInput,
  FlashBridgeContent,
  FlashBridgeResult,
  BulkFlashBridgeResult,
  OfflineLookupSource,
  OfflineLookupResult,
  CacheStats,
  AdvancedSearchFilters,
} from './types';

export {
  CreateSavedWordInputSchema,
  UpdateSavedWordInputSchema,
  CreateWordListInputSchema,
  UpdateWordListInputSchema,
} from './types';
