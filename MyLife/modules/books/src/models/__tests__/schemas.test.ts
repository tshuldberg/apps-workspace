import { describe, it, expect } from 'vitest';
import {
  BookInsertSchema,
  BookFormat,
  AddedSource,
  ReadingStatus,
  ReviewSchema,
  ShelfInsertSchema,
  ReadingSessionInsertSchema,
  TagInsertSchema,
  ReadingGoalInsertSchema,
  ImportSource,
} from '../schemas';

describe('BookInsertSchema', () => {
  const validBook = {
    title: 'The Great Gatsby',
    authors: '["F. Scott Fitzgerald"]',
  };

  it('accepts a valid minimal book', () => {
    const result = BookInsertSchema.safeParse(validBook);
    expect(result.success).toBe(true);
  });

  it('accepts a book with all optional fields', () => {
    const result = BookInsertSchema.safeParse({
      ...validBook,
      subtitle: 'A Novel',
      isbn_10: '0743273567',
      isbn_13: '9780743273565',
      open_library_id: 'OL45804W',
      open_library_edition_id: 'OL7353617M',
      cover_url: 'https://covers.openlibrary.org/b/isbn/9780743273565-L.jpg',
      cover_cached_path: '/cache/covers/abc.jpg',
      publisher: 'Scribner',
      publish_year: 1925,
      page_count: 180,
      subjects: '["Fiction", "Classic"]',
      description: 'A story of the Jazz Age.',
      language: 'en',
      format: 'physical',
      added_source: 'search',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a book without a title', () => {
    const result = BookInsertSchema.safeParse({ authors: '["Author"]' });
    expect(result.success).toBe(false);
  });

  it('rejects a book without authors', () => {
    const result = BookInsertSchema.safeParse({ title: 'Some Book' });
    expect(result.success).toBe(false);
  });

  it('rejects an empty title', () => {
    const result = BookInsertSchema.safeParse({ title: '', authors: '["Author"]' });
    expect(result.success).toBe(false);
  });

  it('rejects a negative page_count', () => {
    const result = BookInsertSchema.safeParse({ ...validBook, page_count: -10 });
    expect(result.success).toBe(false);
  });

  it('rejects page_count of 0', () => {
    const result = BookInsertSchema.safeParse({ ...validBook, page_count: 0 });
    expect(result.success).toBe(false);
  });

  it('accepts nullable optional fields as null', () => {
    const result = BookInsertSchema.safeParse({
      ...validBook,
      subtitle: null,
      isbn_10: null,
      isbn_13: null,
      description: null,
    });
    expect(result.success).toBe(true);
  });

  it('accepts format when provided', () => {
    const result = BookInsertSchema.parse({ ...validBook, format: 'ebook' });
    expect(result.format).toBe('ebook');
  });

  it('accepts added_source when provided', () => {
    const result = BookInsertSchema.parse({ ...validBook, added_source: 'scan' });
    expect(result.added_source).toBe('scan');
  });

  it('allows format to be omitted (optional with default)', () => {
    const result = BookInsertSchema.safeParse(validBook);
    expect(result.success).toBe(true);
  });
});

describe('BookFormat enum', () => {
  it('accepts physical', () => {
    expect(BookFormat.safeParse('physical').success).toBe(true);
  });

  it('accepts ebook', () => {
    expect(BookFormat.safeParse('ebook').success).toBe(true);
  });

  it('accepts audiobook', () => {
    expect(BookFormat.safeParse('audiobook').success).toBe(true);
  });

  it('rejects invalid format', () => {
    expect(BookFormat.safeParse('pdf').success).toBe(false);
  });
});

describe('AddedSource enum', () => {
  it('accepts all valid sources', () => {
    for (const source of ['search', 'scan', 'manual', 'import_goodreads', 'import_storygraph']) {
      expect(AddedSource.safeParse(source).success).toBe(true);
    }
  });

  it('rejects invalid source', () => {
    expect(AddedSource.safeParse('api').success).toBe(false);
  });
});

describe('ReadingStatus enum', () => {
  it('accepts all valid statuses', () => {
    for (const status of ['want_to_read', 'reading', 'finished', 'dnf']) {
      expect(ReadingStatus.safeParse(status).success).toBe(true);
    }
  });

  it('rejects invalid status', () => {
    expect(ReadingStatus.safeParse('paused').success).toBe(false);
  });
});

describe('ReviewSchema rating validation', () => {
  const validReview = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    book_id: '550e8400-e29b-41d4-a716-446655440001',
    session_id: null,
    review_text: null,
    favorite_quote: null,
    is_favorite: 0,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  };

  it('accepts a valid rating of 4.5', () => {
    const result = ReviewSchema.safeParse({ ...validReview, rating: 4.5 });
    expect(result.success).toBe(true);
  });

  it('accepts a rating of 0.5 (minimum)', () => {
    const result = ReviewSchema.safeParse({ ...validReview, rating: 0.5 });
    expect(result.success).toBe(true);
  });

  it('accepts a rating of 5.0 (maximum)', () => {
    const result = ReviewSchema.safeParse({ ...validReview, rating: 5.0 });
    expect(result.success).toBe(true);
  });

  it('accepts a null rating', () => {
    const result = ReviewSchema.safeParse({ ...validReview, rating: null });
    expect(result.success).toBe(true);
  });

  it('rejects a rating of 6.0 (too high)', () => {
    const result = ReviewSchema.safeParse({ ...validReview, rating: 6.0 });
    expect(result.success).toBe(false);
  });

  it('rejects a rating of 0.0 (too low)', () => {
    const result = ReviewSchema.safeParse({ ...validReview, rating: 0.0 });
    expect(result.success).toBe(false);
  });

  it('rejects a rating of 0.3 (not a multiple of 0.5)', () => {
    const result = ReviewSchema.safeParse({ ...validReview, rating: 0.3 });
    expect(result.success).toBe(false);
  });

  it('rejects a negative rating', () => {
    const result = ReviewSchema.safeParse({ ...validReview, rating: -1 });
    expect(result.success).toBe(false);
  });
});

describe('ShelfInsertSchema', () => {
  it('accepts a valid shelf', () => {
    const result = ShelfInsertSchema.safeParse({
      name: 'Favorites',
      slug: 'favorites',
    });
    expect(result.success).toBe(true);
  });

  it('rejects an empty name', () => {
    const result = ShelfInsertSchema.safeParse({ name: '', slug: 'test' });
    expect(result.success).toBe(false);
  });

  it('allows is_system to be omitted (optional with default)', () => {
    const result = ShelfInsertSchema.safeParse({ name: 'Custom', slug: 'custom' });
    expect(result.success).toBe(true);
  });
});

describe('ReadingSessionInsertSchema', () => {
  it('accepts minimal session', () => {
    const result = ReadingSessionInsertSchema.safeParse({
      book_id: '550e8400-e29b-41d4-a716-446655440000',
    });
    expect(result.success).toBe(true);
  });

  it('allows status to be omitted (optional with default)', () => {
    const result = ReadingSessionInsertSchema.safeParse({
      book_id: '550e8400-e29b-41d4-a716-446655440000',
    });
    expect(result.success).toBe(true);
  });
});

describe('TagInsertSchema', () => {
  it('accepts a valid tag', () => {
    const result = TagInsertSchema.safeParse({ name: 'Fiction' });
    expect(result.success).toBe(true);
  });

  it('rejects an empty name', () => {
    const result = TagInsertSchema.safeParse({ name: '' });
    expect(result.success).toBe(false);
  });
});

describe('ImportSource enum', () => {
  it('accepts goodreads', () => {
    expect(ImportSource.safeParse('goodreads').success).toBe(true);
  });

  it('accepts storygraph', () => {
    expect(ImportSource.safeParse('storygraph').success).toBe(true);
  });

  it('rejects invalid source', () => {
    expect(ImportSource.safeParse('kindle').success).toBe(false);
  });
});

describe('ReadingGoalInsertSchema', () => {
  it('accepts a valid goal', () => {
    const result = ReadingGoalInsertSchema.safeParse({
      year: 2026,
      target_books: 24,
    });
    expect(result.success).toBe(true);
  });

  it('rejects a year below 1900', () => {
    const result = ReadingGoalInsertSchema.safeParse({
      year: 1800,
      target_books: 24,
    });
    expect(result.success).toBe(false);
  });

  it('rejects zero target_books', () => {
    const result = ReadingGoalInsertSchema.safeParse({
      year: 2026,
      target_books: 0,
    });
    expect(result.success).toBe(false);
  });
});
