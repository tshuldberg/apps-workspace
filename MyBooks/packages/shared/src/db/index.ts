// Database layer — SQLite schema, migrations, CRUD operations

// Schema SQL
export {
  CREATE_BOOKS,
  CREATE_SHELVES,
  CREATE_BOOK_SHELVES,
  CREATE_READING_SESSIONS,
  CREATE_REVIEWS,
  CREATE_TAGS,
  CREATE_BOOK_TAGS,
  CREATE_READING_GOALS,
  CREATE_OL_CACHE,
  CREATE_IMPORT_LOG,
  CREATE_SETTINGS,
  CREATE_SCHEMA_VERSION,
  CREATE_BOOKS_FTS,
  CREATE_FTS_TRIGGERS,
  CREATE_INDEXES,
  SEED_SYSTEM_SHELVES,
  ALL_TABLES,
  SCHEMA_VERSION,
} from './schema';

// Migration runner
export {
  runMigrations,
  initializeDatabase,
  MIGRATIONS,
} from './migrations';
export type { DatabaseAdapter, Migration } from './migrations';

// Book CRUD
export {
  createBook,
  getBook,
  getBooks,
  updateBook,
  deleteBook,
  searchBooksLocal,
  getBookByISBNLocal,
  getBookCount,
} from './books';
export type { BookFilters } from './books';

// Shelf CRUD
export {
  createShelf,
  getShelf,
  getShelves,
  getSystemShelves,
  updateShelf,
  deleteShelf,
  refreshShelfCount,
  slugify,
} from './shelves';

// Book-Shelf junction
export {
  addBookToShelf,
  removeBookFromShelf,
  getBooksOnShelf,
  getShelvesForBook,
  moveBookToShelf,
} from './book-shelves';

// Reading session CRUD
export {
  createSession,
  getSession,
  getSessions,
  getSessionsForBook,
  updateSession,
  startReading,
  finishReading,
  markDNF,
  getCurrentlyReading,
} from './reading-sessions';

// Review CRUD
export {
  createReview,
  getReview,
  getReviewForBook,
  getReviewsForBook,
  updateReview,
  deleteReview,
  getFavorites,
} from './reviews';

// Tag CRUD
export {
  createTag,
  getTag,
  getTags,
  updateTag,
  deleteTag,
  addTagToBook,
  removeTagFromBook,
  getTagsForBook,
  getBooksWithTag,
} from './tags';

// Reading goal CRUD
export {
  createGoal,
  getGoal,
  getGoalForYear,
  updateGoal,
  getGoalProgress,
} from './reading-goals';
export type { GoalProgress } from './reading-goals';

// Open Library cache
export {
  cacheResponse,
  getCachedResponse,
  isCached,
  markCoverDownloaded,
  clearOldCache,
} from './ol-cache';

// Import log
export {
  logImport,
  getImportHistory,
} from './import-log';
