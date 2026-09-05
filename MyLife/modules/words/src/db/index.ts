export { ALL_TABLES, CREATE_INDEXES, V2_UP, V3_UP, V4_UP } from './schema';
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
} from './crud';
export type { GetSavedWordsOptions, CachedLookup, SavedWordLight } from './crud';
export { getSavedWordsLightweight } from './crud';
