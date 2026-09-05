import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { BOOKS_MODULE } from '../definition';
import { createBook } from '../db/books';
import { createSession, updateSession } from '../db/reading-sessions';
import { createReview } from '../db/reviews';
import {
  getSearchableContent,
  getDataSummary,
  getActivityFeed,
} from '../cross-module';

let adapter: DatabaseAdapter;
let closeDb: () => void;

beforeEach(() => {
  const testDb = createModuleTestDatabase('books', BOOKS_MODULE.migrations!);
  adapter = testDb.adapter;
  closeDb = testDb.close;
});

afterEach(() => {
  closeDb();
});

describe('getSearchableContent', () => {
  it('returns empty array for empty database', () => {
    const items = getSearchableContent(adapter);
    expect(items).toEqual([]);
  });

  it('returns books as searchable items', () => {
    createBook(adapter, 'book-1', {
      title: 'The Great Gatsby',
      authors: '["F. Scott Fitzgerald"]',
      subjects: '["Fiction", "Classic"]',
      description: 'A story of the Jazz Age',
    });

    const items = getSearchableContent(adapter);
    expect(items).toHaveLength(1);

    const book = items[0];
    expect(book.moduleId).toBe('books');
    expect(book.type).toBe('book');
    expect(book.title).toBe('The Great Gatsby');
    expect(book.body).toBe('A story of the Jazz Age');
    expect(book.tags).toEqual(['F. Scott Fitzgerald', 'Fiction', 'Classic']);
    expect(book.itemId).toBe('book-1');
    expect(book.updatedAt).toBeTruthy();
  });

  it('includes reviews as separate searchable items', () => {
    createBook(adapter, 'book-1', {
      title: 'The Great Gatsby',
      authors: '["F. Scott Fitzgerald"]',
    });
    createSession(adapter, 'session-1', { book_id: 'book-1' });
    createReview(adapter, 'review-1', {
      book_id: 'book-1',
      session_id: 'session-1',
      review_text: 'A masterpiece of American literature',
      rating: 5.0,
    });

    const items = getSearchableContent(adapter);
    const reviewItems = items.filter((i) => i.type === 'review');
    expect(reviewItems).toHaveLength(1);
    expect(reviewItems[0].title).toBe('Review: The Great Gatsby');
    expect(reviewItems[0].body).toBe('A masterpiece of American literature');
  });

  it('excludes reviews without review_text', () => {
    createBook(adapter, 'book-1', {
      title: 'Test Book',
      authors: '["Author"]',
    });
    createSession(adapter, 'session-1', { book_id: 'book-1' });
    createReview(adapter, 'review-1', {
      book_id: 'book-1',
      session_id: 'session-1',
      rating: 4.0,
    });

    const items = getSearchableContent(adapter);
    const reviewItems = items.filter((i) => i.type === 'review');
    expect(reviewItems).toHaveLength(0);
  });

  it('handles books with no subjects or description', () => {
    createBook(adapter, 'book-1', {
      title: 'Minimal Book',
      authors: '["Author"]',
    });

    const items = getSearchableContent(adapter);
    expect(items).toHaveLength(1);
    expect(items[0].body).toBeUndefined();
    expect(items[0].tags).toEqual(['Author']);
  });

  it('handles invalid JSON in authors gracefully', () => {
    createBook(adapter, 'book-1', {
      title: 'Bad JSON',
      authors: 'not-json',
    });

    const items = getSearchableContent(adapter);
    expect(items).toHaveLength(1);
    expect(items[0].tags).toBeUndefined();
  });

  it('returns multiple books', () => {
    createBook(adapter, 'book-1', { title: 'Book A', authors: '["A"]' });
    createBook(adapter, 'book-2', { title: 'Book B', authors: '["B"]' });
    createBook(adapter, 'book-3', { title: 'Book C', authors: '["C"]' });

    const items = getSearchableContent(adapter);
    const bookItems = items.filter((i) => i.type === 'book');
    expect(bookItems).toHaveLength(3);
  });
});

describe('getDataSummary', () => {
  it('returns zeros for empty database', () => {
    const summary = getDataSummary(adapter);
    expect(summary.moduleId).toBe('books');
    expect(summary.totalItems).toBe(0);
    expect(summary.stats.currentlyReading).toBe(0);
    expect(summary.stats.booksFinished).toBe(0);
  });

  it('counts total books', () => {
    createBook(adapter, 'book-1', { title: 'A', authors: '["A"]' });
    createBook(adapter, 'book-2', { title: 'B', authors: '["B"]' });

    const summary = getDataSummary(adapter);
    expect(summary.totalItems).toBe(2);
  });

  it('counts currently reading sessions', () => {
    createBook(adapter, 'book-1', { title: 'A', authors: '["A"]' });
    createBook(adapter, 'book-2', { title: 'B', authors: '["B"]' });
    createSession(adapter, 's-1', { book_id: 'book-1', status: 'reading' });
    createSession(adapter, 's-2', { book_id: 'book-2', status: 'want_to_read' });

    const summary = getDataSummary(adapter);
    expect(summary.stats.currentlyReading).toBe(1);
  });

  it('counts finished books', () => {
    createBook(adapter, 'book-1', { title: 'A', authors: '["A"]' });
    createSession(adapter, 's-1', { book_id: 'book-1', status: 'finished' });

    const summary = getDataSummary(adapter);
    expect(summary.stats.booksFinished).toBe(1);
  });

  it('includes average rating when reviews exist', () => {
    createBook(adapter, 'book-1', { title: 'A', authors: '["A"]' });
    createBook(adapter, 'book-2', { title: 'B', authors: '["B"]' });
    createSession(adapter, 's-1', { book_id: 'book-1' });
    createSession(adapter, 's-2', { book_id: 'book-2' });
    createReview(adapter, 'r-1', { book_id: 'book-1', rating: 4.0 });
    createReview(adapter, 'r-2', { book_id: 'book-2', rating: 5.0 });

    const summary = getDataSummary(adapter);
    expect(summary.stats.avgRating).toBe(4.5);
  });

  it('omits avgRating when no reviews have ratings', () => {
    createBook(adapter, 'book-1', { title: 'A', authors: '["A"]' });
    createSession(adapter, 's-1', { book_id: 'book-1' });
    createReview(adapter, 'r-1', { book_id: 'book-1' });

    const summary = getDataSummary(adapter);
    expect(summary.stats.avgRating).toBeUndefined();
  });

  it('includes lastActivity from sessions', () => {
    createBook(adapter, 'book-1', { title: 'A', authors: '["A"]' });
    createSession(adapter, 's-1', { book_id: 'book-1', status: 'reading' });

    const summary = getDataSummary(adapter);
    expect(summary.lastActivity).toBeTruthy();
  });
});

describe('getActivityFeed', () => {
  it('returns empty array for empty database', () => {
    const items = getActivityFeed(adapter, new Date('2020-01-01'));
    expect(items).toEqual([]);
  });

  it('returns finished books as completed activities', () => {
    createBook(adapter, 'book-1', { title: 'Finished Book', authors: '["A"]' });
    createSession(adapter, 's-1', { book_id: 'book-1', status: 'reading' });
    updateSession(adapter, 's-1', {
      status: 'finished',
      finished_at: '2025-06-15T10:00:00.000Z',
    });

    const items = getActivityFeed(adapter, new Date('2025-01-01'));
    const completed = items.filter((i) => i.action === 'completed');
    expect(completed).toHaveLength(1);
    expect(completed[0].description).toBe('Finished reading "Finished Book"');
    expect(completed[0].itemId).toBe('book-1');
    expect(completed[0].itemType).toBe('book');
  });

  it('returns started books as started activities', () => {
    createBook(adapter, 'book-1', { title: 'New Read', authors: '["A"]' });
    createSession(adapter, 's-1', {
      book_id: 'book-1',
      status: 'reading',
      started_at: '2025-06-10T08:00:00.000Z',
    });

    const items = getActivityFeed(adapter, new Date('2025-01-01'));
    const started = items.filter((i) => i.action === 'started');
    expect(started).toHaveLength(1);
    expect(started[0].description).toBe('Started reading "New Read"');
  });

  it('returns newly added books as created activities', () => {
    createBook(adapter, 'book-1', { title: 'Fresh Add', authors: '["A"]' });

    const items = getActivityFeed(adapter, new Date('2020-01-01'));
    const created = items.filter((i) => i.action === 'created');
    expect(created).toHaveLength(1);
    expect(created[0].description).toBe('Added "Fresh Add" to library');
  });

  it('filters out activities before since date', () => {
    createBook(adapter, 'book-1', { title: 'Old Book', authors: '["A"]' });

    // created_at will be "now", so querying with a future since date should exclude it
    const items = getActivityFeed(adapter, new Date('2099-01-01'));
    expect(items).toHaveLength(0);
  });

  it('sorts activities by timestamp descending', () => {
    createBook(adapter, 'book-1', { title: 'Book A', authors: '["A"]' });
    createBook(adapter, 'book-2', { title: 'Book B', authors: '["B"]' });
    createSession(adapter, 's-1', {
      book_id: 'book-1',
      status: 'reading',
      started_at: '2025-06-01T00:00:00.000Z',
    });
    createSession(adapter, 's-2', {
      book_id: 'book-2',
      status: 'reading',
      started_at: '2025-06-15T00:00:00.000Z',
    });

    const items = getActivityFeed(adapter, new Date('2025-01-01'));
    const startedItems = items.filter((i) => i.action === 'started');
    expect(startedItems.length).toBeGreaterThanOrEqual(2);
    // Most recent first
    expect(startedItems[0].timestamp >= startedItems[1].timestamp).toBe(true);
  });

  it('includes all activity types in a single feed', () => {
    createBook(adapter, 'book-1', { title: 'Book A', authors: '["A"]' });
    createSession(adapter, 's-1', {
      book_id: 'book-1',
      status: 'reading',
      started_at: '2025-06-01T00:00:00.000Z',
    });
    updateSession(adapter, 's-1', {
      status: 'finished',
      finished_at: '2025-06-10T00:00:00.000Z',
    });

    const items = getActivityFeed(adapter, new Date('2020-01-01'));
    const actions = items.map((i) => i.action);
    expect(actions).toContain('created');
    expect(actions).toContain('completed');
    // started won't be returned because status is now 'finished'
  });
});

describe('booksCrossModule via definition', () => {
  it('is wired into BOOKS_MODULE.crossModule', () => {
    expect(BOOKS_MODULE.crossModule).toBeDefined();
    expect(BOOKS_MODULE.crossModule!.getSearchableContent).toBeTypeOf('function');
    expect(BOOKS_MODULE.crossModule!.getDataSummary).toBeTypeOf('function');
    expect(BOOKS_MODULE.crossModule!.getActivityFeed).toBeTypeOf('function');
  });

  it('works through the crossModule interface', () => {
    createBook(adapter, 'book-1', { title: 'Test', authors: '["Author"]' });

    const items = BOOKS_MODULE.crossModule!.getSearchableContent!(adapter);
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe('Test');

    const summary = BOOKS_MODULE.crossModule!.getDataSummary!(adapter);
    expect(summary.totalItems).toBe(1);
  });
});
