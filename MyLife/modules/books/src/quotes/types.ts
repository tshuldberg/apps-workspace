export type QuoteSource = 'manual' | 'reader' | 'import';

export interface Quote {
  id: string;
  book_id: string;
  content: string;
  page_number: number | null;
  chapter: string | null;
  note: string | null;
  is_favorite: number;
  source: QuoteSource;
  created_at: string;
  updated_at: string;
}

export interface CreateQuoteInput {
  book_id: string;
  content: string;
  page_number?: number | null;
  chapter?: string | null;
  note?: string | null;
  is_favorite?: number;
  source?: QuoteSource;
}

export interface QuoteFilter {
  bookId?: string;
  isFavorite?: boolean;
  source?: QuoteSource;
  searchText?: string;
  limit?: number;
  offset?: number;
}

export interface QuoteWithBook {
  quote: Quote;
  bookTitle: string;
  bookAuthors: string;
  bookCoverUrl: string | null;
}
