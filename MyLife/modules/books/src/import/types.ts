import type { BookInsert, ReadingSessionInsert, ReviewInsert } from '../models/schemas';

/** A single book parsed from an import file, with associated session and review data. */
export interface ParsedBook {
  book: BookInsert;
  session?: ReadingSessionInsert;
  review?: { rating?: number | null; review_text?: string | null };
  shelves: string[]; // Shelf names to assign (e.g. ["to-read"], ["read"], ["currently-reading", "Book Club"])
}

/** Result of parsing an import CSV file. */
export interface ParsedImport {
  books: ParsedBook[];
  errors: string[];
  skipped: number;
}
