/**
 * @mylife/search -- Unified cross-module search infrastructure.
 *
 * Provides FTS5-powered full-text search across all enabled modules
 * that implement getSearchableContent() on their crossModule interface.
 * Includes LRU caching, grouped results, performance logging, and
 * index coverage validation.
 */

// Schema
export { CREATE_SEARCH_INDEX, CREATE_SEARCH_META, SEARCH_TABLES } from './schema';

// Indexer
export {
  ensureSearchTables,
  indexModule,
  indexAllModules,
  removeModuleFromIndex,
  updateSearchEntries,
  removeSearchEntries,
  validateIndexCoverage,
  ensureFullCoverage,
} from './indexer';
export type { IndexCoverageResult } from './indexer';

// Query
export {
  search,
  searchCount,
  searchRecent,
  searchGrouped,
  groupResultsByModule,
  getRecentActions,
  clearSearchCache,
  setSearchPerfLogger,
  _getCacheSize,
} from './query';
export type {
  SearchResult,
  SearchOptions,
  SearchModuleMeta,
  SearchResultGroup,
  SearchPerfLogger,
} from './query';
