// Open Library API types
export type {
  OLSearchDoc,
  OLSearchResponse,
  OLBookEdition,
  OLWork,
  OLAuthor,
  OLSubjectWork,
  OLSubjectResponse,
  CoverSize,
} from './types';

export {
  OLSearchDocSchema,
  OLSearchResponseSchema,
  OLBookEditionSchema,
  OLWorkSchema,
  OLAuthorSchema,
  OLSubjectWorkSchema,
  OLSubjectResponseSchema,
} from './types';

// API client functions
export {
  searchBooks,
  searchBooksRanked,
  getBooksBySubject,
  getBookByISBN,
  getWork,
  getAuthor,
  getCoverUrl,
  getCoverUrlByOLID,
  buildSearchQuery,
  relevanceScore,
} from './open-library';

// Transform functions (OL response -> BookInsert from models)
export { olSearchDocToBook, olEditionToBook } from './transform';

// Ratings API
export { fetchWorkRatings, syncBookRatings } from './ratings';
