// Quote collection engine -- save and surface favorite passages

export {
  createQuote,
  getQuoteById,
  getQuotesForBook,
  getQuotes,
  updateQuote,
  deleteQuote,
  getRandomQuote,
  getFavoriteQuotes,
  getQuoteCount,
} from '../db/quotes';

export type {
  Quote,
  CreateQuoteInput,
  QuoteFilter,
  QuoteSource,
  QuoteWithBook,
} from './types';
