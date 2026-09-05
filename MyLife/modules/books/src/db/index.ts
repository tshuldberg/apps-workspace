// Database layer — SQLite schema, CRUD operations

// Schema SQL
export {
  CREATE_BOOKS,
  CREATE_SHELVES,
  CREATE_BOOK_SHELVES,
  CREATE_READING_SESSIONS,
  CREATE_REVIEWS,
  CREATE_SHARE_EVENTS,
  CREATE_READER_DOCUMENTS,
  CREATE_READER_NOTES,
  CREATE_READER_PREFERENCES,
  CREATE_TAGS,
  CREATE_BOOK_TAGS,
  CREATE_READING_GOALS,
  CREATE_OL_CACHE,
  CREATE_IMPORT_LOG,
  CREATE_SETTINGS,
  CREATE_BOOKS_FTS,
  CREATE_FTS_TRIGGERS,
  CREATE_INDEXES,
  CREATE_SHARE_INDEXES,
  CREATE_READER_INDEXES,
  CREATE_PROGRESS_UPDATES,
  CREATE_TIMED_SESSIONS,
  CREATE_SERIES,
  CREATE_SERIES_BOOKS,
  CREATE_MOOD_TAGS,
  CREATE_CONTENT_WARNINGS,
  CREATE_CHALLENGES,
  CREATE_CHALLENGE_PROGRESS,
  CREATE_JOURNAL_ENTRIES,
  CREATE_JOURNAL_PHOTOS,
  CREATE_JOURNAL_BOOK_LINKS,
  CREATE_JOURNAL_FTS,
  CREATE_JOURNAL_FTS_TRIGGERS,
  CREATE_FEATURE_INDEXES,
  SEED_SYSTEM_SHELVES,
  ALL_TABLES,
  REPLACE_JOURNAL_FTS_TRIGGERS,
} from './schema';

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
  getBookCountsPerShelf,
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

// Sharing primitives
export {
  createShareEvent,
  getShareEvent,
  getShareEventsForObject,
  listShareEventsVisibleToUser,
  updateShareEvent,
  updateShareEventVisibility,
  deleteShareEvent,
} from './sharing';
export type { ShareEventFilters } from './sharing';

// Reader documents and notes
export {
  createReaderDocument,
  getReaderDocument,
  getReaderDocuments,
  updateReaderDocument,
  updateReaderDocumentProgress,
  deleteReaderDocument,
} from './reader-documents';
export type { ReaderDocumentFilters } from './reader-documents';

export {
  createReaderNote,
  getReaderNote,
  getReaderNotes,
  updateReaderNote,
  deleteReaderNote,
} from './reader-notes';

export {
  getReaderPreferences,
  upsertReaderPreferences,
} from './reader-preferences';

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

// Progress update CRUD
export {
  createProgressUpdate,
  getProgressHistory,
  getLatestProgress,
  deleteProgressUpdate,
} from './progress-updates';

// Timed session CRUD
export {
  startTimedSession,
  stopTimedSession,
  getTimedSession,
  getTimedSessionsForBook,
  getTimedSessionsForSession,
  deleteTimedSession,
} from './timed-sessions';

// Series CRUD
export {
  createSeries,
  getSeries,
  getAllSeries,
  updateSeries,
  deleteSeries,
} from './series';

// Series-Books junction
export {
  addBookToSeries,
  removeBookFromSeries,
  getBooksInSeries,
  getSeriesForBook,
  reorderSeriesBook,
  getNextUnread,
} from './series-books';

// Mood tag CRUD
export {
  addMoodTag,
  removeMoodTag,
  getMoodTagsForBook,
  getMoodTagsByType,
  getBooksWithMoodTag,
  getDistinctMoodValues,
} from './mood-tags';

// Content warning CRUD
export {
  addContentWarning,
  removeContentWarning,
  getContentWarningsForBook,
  getBooksWithContentWarning,
  getDistinctWarnings,
} from './content-warnings';

// Challenge CRUD
export {
  createChallenge,
  getChallenge,
  getActiveChallenges,
  getAllChallenges,
  updateChallenge,
  deactivateChallenge,
  deleteChallenge,
} from './challenges';

// Challenge progress CRUD
export {
  logChallengeProgress,
  getProgressForChallenge,
  getTotalProgress,
  deleteChallengeProgress,
} from './challenge-progress';

// Journal entries
export {
  createJournalEntry,
  getJournalEntry,
  getJournalEntries,
  updateJournalEntry,
  deleteJournalEntry,
  searchJournalEntries,
  getJournalEntryCount,
} from './journal-entries';
export type { JournalFilters } from './journal-entries';

// Journal photos
export {
  addJournalPhoto,
  getPhotosForEntry,
  removeJournalPhoto,
  reorderJournalPhotos,
  getCrossModuleAttachmentsForBook,
} from './journal-photos';
export type { CrossModuleAttachmentLink } from './journal-photos';

// Journal book links
export {
  linkJournalToBook,
  unlinkJournalFromBook,
  getLinkedBooks,
  getJournalEntriesForBook,
  getLinkedEntryCount,
} from './journal-book-links';

// Schema SQL (V5+ additions)
export {
  CREATE_BOOK_CLUBS,
  CREATE_CLUB_NOTES,
  CREATE_CLUB_HISTORY,
  CREATE_CLUB_INDEXES,
  CREATE_CLUB_MEMBERS,
  CREATE_CLUB_MEMBERS_INDEX,
  CREATE_BADGES,
  CREATE_BADGE_INDEXES,
  SEED_BADGES,
  CREATE_COMMUNITY_CHALLENGES,
  CREATE_COMMUNITY_CHALLENGE_PARTICIPATION,
  CREATE_COMMUNITY_CHALLENGE_INDEXES,
  SEED_COMMUNITY_CHALLENGE_PRESETS,
} from './schema';

// Club CRUD
export {
  createClub,
  getClub,
  getActiveClubs,
  getAllClubs,
  updateClub,
  setCurrentBook,
  deactivateClub,
  deleteClub,
} from './clubs';
export type { BookClub, BookClubInsert } from './clubs';

// Club members CRUD
export {
  addClubMember,
  getClubMembers,
  updateMemberProgress,
  removeClubMember,
} from './club-members';
export type { ClubMember } from './club-members';

// Club notes CRUD
export {
  createClubNote,
  getClubNote,
  getNotesForClub,
  getNotesForClubAndBook,
  deleteClubNote,
} from './club-notes';
export type { ClubNote, ClubNoteInsert } from './club-notes';

// Club history CRUD
export {
  createClubHistory,
  getHistoryForClub,
  deleteClubHistory,
} from './club-history';
export type { ClubHistory, ClubHistoryInsert } from './club-history';

// Badge CRUD
export {
  getAllBadges,
  getEarnedBadges,
  getUnearnedBadges,
  getBadgesByCategory,
  getBadge,
  awardBadge,
} from './badges';
export type { Badge, BadgeCategory, BadgeTier } from './badges';

// Community challenge CRUD
export {
  getCommunityChallenge,
  getAllCommunityChallenge,
  getPresetChallenges,
  createCommunityChallenge,
  deleteCommunityChallenge,
  joinChallenge,
  getParticipation,
  getActiveParticipations,
  getAllParticipations,
  updateParticipationProgress,
  completeParticipation,
  abandonParticipation,
} from './community-challenges';
export type { CommunityChallenge, CommunityChallengeInsert, CommunityParticipation } from './community-challenges';
