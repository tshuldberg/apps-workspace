import type { Book, Review, ReadingSession, Tag } from '../models/schemas';

/** A book with its associated relations, used for export. */
export interface BookWithRelations {
  book: Book;
  shelves: string[];      // Shelf names
  session?: ReadingSession | null;
  review?: Review | null;
  tags: string[];          // Tag names
}
