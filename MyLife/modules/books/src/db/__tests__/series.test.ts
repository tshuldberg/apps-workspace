import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { BOOKS_MODULE } from '../../definition';
import { createBook } from '../books';
import { createSession } from '../reading-sessions';
import { finishReading } from '../reading-sessions';
import {
  createSeries,
  getSeries,
  getAllSeries,
  updateSeries,
  deleteSeries,
} from '../series';
import {
  addBookToSeries,
  removeBookFromSeries,
  getBooksInSeries,
  getSeriesForBook,
  reorderSeriesBook,
  getNextUnread,
} from '../series-books';
import type { BookInsert } from '../../models/schemas';

let adapter: DatabaseAdapter;
let closeDb: () => void;

function makeBook(overrides: Partial<BookInsert> = {}): BookInsert {
  return {
    title: 'Test Book',
    authors: '["Author"]',
    ...overrides,
  };
}

beforeEach(() => {
  const testDb = createModuleTestDatabase('books', BOOKS_MODULE.migrations!);
  adapter = testDb.adapter;
  closeDb = testDb.close;
});

afterEach(() => {
  closeDb();
});

// --- Series CRUD ---

describe('createSeries', () => {
  it('creates a series', () => {
    const series = createSeries(adapter, 'series-1', { name: 'Lord of the Rings' });
    expect(series.id).toBe('series-1');
    expect(series.name).toBe('Lord of the Rings');
    expect(series.description).toBeNull();
    expect(series.total_books).toBeNull();
    expect(series.created_at).toBeTruthy();
  });

  it('accepts optional fields', () => {
    const series = createSeries(adapter, 'series-1', {
      name: 'Dune',
      description: 'Sci-fi classic',
      total_books: 6,
    });
    expect(series.description).toBe('Sci-fi classic');
    expect(series.total_books).toBe(6);
  });
});

describe('getSeries', () => {
  it('retrieves by ID', () => {
    createSeries(adapter, 'series-1', { name: 'Test' });
    const found = getSeries(adapter, 'series-1');
    expect(found).not.toBeNull();
    expect(found!.name).toBe('Test');
  });

  it('returns null for non-existent', () => {
    expect(getSeries(adapter, 'nope')).toBeNull();
  });
});

describe('getAllSeries', () => {
  it('returns all series ordered by name', () => {
    createSeries(adapter, 'series-1', { name: 'Zebra' });
    createSeries(adapter, 'series-2', { name: 'Alpha' });
    const all = getAllSeries(adapter);
    expect(all).toHaveLength(2);
    expect(all[0].name).toBe('Alpha');
    expect(all[1].name).toBe('Zebra');
  });
});

describe('updateSeries', () => {
  it('updates name and description', () => {
    createSeries(adapter, 'series-1', { name: 'Old' });
    updateSeries(adapter, 'series-1', { name: 'New', description: 'Updated' });
    const updated = getSeries(adapter, 'series-1');
    expect(updated!.name).toBe('New');
    expect(updated!.description).toBe('Updated');
  });

  it('does nothing for empty updates', () => {
    createSeries(adapter, 'series-1', { name: 'Test' });
    updateSeries(adapter, 'series-1', {});
    expect(getSeries(adapter, 'series-1')!.name).toBe('Test');
  });
});

describe('deleteSeries', () => {
  it('removes the series', () => {
    createSeries(adapter, 'series-1', { name: 'Test' });
    deleteSeries(adapter, 'series-1');
    expect(getSeries(adapter, 'series-1')).toBeNull();
  });
});

// --- Series Books ---

describe('addBookToSeries', () => {
  it('adds a book to a series', () => {
    createBook(adapter, 'book-1', makeBook());
    createSeries(adapter, 'series-1', { name: 'Test' });
    addBookToSeries(adapter, 'series-1', 'book-1', 1);

    const books = getBooksInSeries(adapter, 'series-1');
    expect(books).toHaveLength(1);
    expect(books[0].id).toBe('book-1');
    expect(books[0].sort_order).toBe(1);
  });

  it('ignores duplicate inserts', () => {
    createBook(adapter, 'book-1', makeBook());
    createSeries(adapter, 'series-1', { name: 'Test' });
    addBookToSeries(adapter, 'series-1', 'book-1', 1);
    addBookToSeries(adapter, 'series-1', 'book-1', 2); // duplicate, ignored
    expect(getBooksInSeries(adapter, 'series-1')).toHaveLength(1);
  });
});

describe('removeBookFromSeries', () => {
  it('removes a book from a series', () => {
    createBook(adapter, 'book-1', makeBook());
    createSeries(adapter, 'series-1', { name: 'Test' });
    addBookToSeries(adapter, 'series-1', 'book-1', 1);
    removeBookFromSeries(adapter, 'series-1', 'book-1');
    expect(getBooksInSeries(adapter, 'series-1')).toHaveLength(0);
  });
});

describe('getBooksInSeries', () => {
  it('returns books ordered by sort_order', () => {
    createBook(adapter, 'book-1', makeBook({ title: 'Second' }));
    createBook(adapter, 'book-2', makeBook({ title: 'First' }));
    createSeries(adapter, 'series-1', { name: 'Test' });
    addBookToSeries(adapter, 'series-1', 'book-1', 2);
    addBookToSeries(adapter, 'series-1', 'book-2', 1);

    const books = getBooksInSeries(adapter, 'series-1');
    expect(books).toHaveLength(2);
    expect(books[0].title).toBe('First');
    expect(books[1].title).toBe('Second');
  });
});

describe('getSeriesForBook', () => {
  it('returns all series a book belongs to', () => {
    createBook(adapter, 'book-1', makeBook());
    createSeries(adapter, 'series-1', { name: 'Alpha' });
    createSeries(adapter, 'series-2', { name: 'Beta' });
    addBookToSeries(adapter, 'series-1', 'book-1', 1);
    addBookToSeries(adapter, 'series-2', 'book-1', 1);

    const series = getSeriesForBook(adapter, 'book-1');
    expect(series).toHaveLength(2);
    expect(series[0].name).toBe('Alpha');
    expect(series[1].name).toBe('Beta');
  });
});

describe('reorderSeriesBook', () => {
  it('updates the sort order', () => {
    createBook(adapter, 'book-1', makeBook());
    createSeries(adapter, 'series-1', { name: 'Test' });
    addBookToSeries(adapter, 'series-1', 'book-1', 1);
    reorderSeriesBook(adapter, 'series-1', 'book-1', 5);

    const books = getBooksInSeries(adapter, 'series-1');
    expect(books[0].sort_order).toBe(5);
  });
});

describe('getNextUnread', () => {
  it('returns the first unread book in sort order', () => {
    createBook(adapter, 'book-1', makeBook({ title: 'Book 1' }));
    createBook(adapter, 'book-2', makeBook({ title: 'Book 2' }));
    createBook(adapter, 'book-3', makeBook({ title: 'Book 3' }));
    createSeries(adapter, 'series-1', { name: 'Test' });
    addBookToSeries(adapter, 'series-1', 'book-1', 1);
    addBookToSeries(adapter, 'series-1', 'book-2', 2);
    addBookToSeries(adapter, 'series-1', 'book-3', 3);

    // Mark book-1 as finished
    createSession(adapter, 'session-1', { book_id: 'book-1', status: 'reading' });
    finishReading(adapter, 'session-1');

    const next = getNextUnread(adapter, 'series-1');
    expect(next).not.toBeNull();
    expect(next!.id).toBe('book-2');
  });

  it('returns null when all books are finished', () => {
    createBook(adapter, 'book-1', makeBook());
    createSeries(adapter, 'series-1', { name: 'Test' });
    addBookToSeries(adapter, 'series-1', 'book-1', 1);

    createSession(adapter, 'session-1', { book_id: 'book-1', status: 'reading' });
    finishReading(adapter, 'session-1');

    expect(getNextUnread(adapter, 'series-1')).toBeNull();
  });

  it('returns null for empty series', () => {
    createSeries(adapter, 'series-1', { name: 'Test' });
    expect(getNextUnread(adapter, 'series-1')).toBeNull();
  });
});
