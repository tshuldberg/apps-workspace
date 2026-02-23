// Open Library API types
export type {
  OLSearchDoc,
  OLSearchResponse,
  OLBookEdition,
  OLWork,
  OLAuthor,
  CoverSize,
} from './types';

export {
  OLSearchDocSchema,
  OLSearchResponseSchema,
  OLBookEditionSchema,
  OLWorkSchema,
  OLAuthorSchema,
} from './types';

// API client functions
export {
  searchBooks,
  getBookByISBN,
  getWork,
  getAuthor,
  getCoverUrl,
  getCoverUrlByOLID,
} from './open-library';

// Transform functions (OL response → BookInsert from models)
export { olSearchDocToBook, olEditionToBook } from './transform';
