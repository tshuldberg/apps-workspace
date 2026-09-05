import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { BOOKS_MODULE } from '../../definition';
import { createBook } from '../../db/books';
import {
  createQuote,
  getQuoteById,
  getQuotesForBook,
  getQuotes,
  updateQuote,
  deleteQuote,
  getRandomQuote,
  getFavoriteQuotes,
  getQuoteCount,
} from '../../db/quotes';
import type { BookInsert } from '../../models/schemas';

let adapter: DatabaseAdapter;
let closeDb: () => void;
let testBookId: string;

function makeBook(overrides: Partial<BookInsert> = {}): BookInsert {
  return {
    title: 'Test Book',
    authors: '["Test Author"]',
    ...overrides,
  };
}

beforeEach(() => {
  const testDb = createModuleTestDatabase('books', BOOKS_MODULE.migrations!);
  adapter = testDb.adapter;
  closeDb = testDb.close;

  testBookId = crypto.randomUUID();
  createBook(adapter, testBookId, makeBook());
});

afterEach(() => {
  closeDb();
});

describe('createQuote', () => {
  it('creates a quote with required fields', () => {
    const id = crypto.randomUUID();
    const quote = createQuote(adapter, id, {
      book_id: testBookId,
      content: 'The only way to do great work is to love what you do.',
    });

    expect(quote.id).toBe(id);
    expect(quote.book_id).toBe(testBookId);
    expect(quote.content).toBe('The only way to do great work is to love what you do.');
    expect(quote.source).toBe('manual');
    expect(quote.is_favorite).toBe(0);
  });

  it('creates a quote with all optional fields', () => {
    const id = crypto.randomUUID();
    const quote = createQuote(adapter, id, {
      book_id: testBookId,
      content: 'To be or not to be.',
      page_number: 42,
      chapter: 'Act III',
      note: 'The famous soliloquy',
      is_favorite: 1,
      source: 'reader',
    });

    expect(quote.page_number).toBe(42);
    expect(quote.chapter).toBe('Act III');
    expect(quote.note).toBe('The famous soliloquy');
    expect(quote.is_favorite).toBe(1);
    expect(quote.source).toBe('reader');
  });
});

describe('getQuoteById', () => {
  it('returns quote by id', () => {
    const id = crypto.randomUUID();
    createQuote(adapter, id, { book_id: testBookId, content: 'Hello world' });

    const quote = getQuoteById(adapter, id);
    expect(quote).not.toBeNull();
    expect(quote!.content).toBe('Hello world');
  });

  it('returns null for non-existent quote', () => {
    const quote = getQuoteById(adapter, 'non-existent');
    expect(quote).toBeNull();
  });
});

describe('getQuotesForBook', () => {
  it('returns quotes for a specific book', () => {
    createQuote(adapter, crypto.randomUUID(), { book_id: testBookId, content: 'Quote 1' });
    createQuote(adapter, crypto.randomUUID(), { book_id: testBookId, content: 'Quote 2' });

    const otherBookId = crypto.randomUUID();
    createBook(adapter, otherBookId, makeBook({ title: 'Other Book' }));
    createQuote(adapter, crypto.randomUUID(), { book_id: otherBookId, content: 'Other quote' });

    const quotes = getQuotesForBook(adapter, testBookId);
    expect(quotes).toHaveLength(2);
  });
});

describe('getQuotes with filters', () => {
  it('filters by favorite', () => {
    createQuote(adapter, crypto.randomUUID(), { book_id: testBookId, content: 'Regular', is_favorite: 0 });
    createQuote(adapter, crypto.randomUUID(), { book_id: testBookId, content: 'Favorite', is_favorite: 1 });

    const favorites = getQuotes(adapter, { isFavorite: true });
    expect(favorites).toHaveLength(1);
    expect(favorites[0].quote.content).toBe('Favorite');
  });

  it('filters by source', () => {
    createQuote(adapter, crypto.randomUUID(), { book_id: testBookId, content: 'Manual', source: 'manual' });
    createQuote(adapter, crypto.randomUUID(), { book_id: testBookId, content: 'Reader', source: 'reader' });

    const readerQuotes = getQuotes(adapter, { source: 'reader' });
    expect(readerQuotes).toHaveLength(1);
    expect(readerQuotes[0].quote.source).toBe('reader');
  });

  it('includes book metadata', () => {
    createQuote(adapter, crypto.randomUUID(), { book_id: testBookId, content: 'With metadata' });

    const quotes = getQuotes(adapter);
    expect(quotes[0].bookTitle).toBe('Test Book');
    expect(quotes[0].bookAuthors).toBe('["Test Author"]');
  });
});

describe('updateQuote', () => {
  it('updates quote fields', () => {
    const id = crypto.randomUUID();
    createQuote(adapter, id, { book_id: testBookId, content: 'Original' });

    updateQuote(adapter, id, { content: 'Updated', is_favorite: 1 });

    const quote = getQuoteById(adapter, id);
    expect(quote!.content).toBe('Updated');
    expect(quote!.is_favorite).toBe(1);
  });
});

describe('deleteQuote', () => {
  it('removes a quote', () => {
    const id = crypto.randomUUID();
    createQuote(adapter, id, { book_id: testBookId, content: 'To delete' });

    deleteQuote(adapter, id);

    const quote = getQuoteById(adapter, id);
    expect(quote).toBeNull();
  });
});

describe('getRandomQuote', () => {
  it('returns null when no quotes exist', () => {
    const result = getRandomQuote(adapter);
    expect(result).toBeNull();
  });

  it('returns a random quote with book metadata', () => {
    createQuote(adapter, crypto.randomUUID(), { book_id: testBookId, content: 'Random me' });

    const result = getRandomQuote(adapter);
    expect(result).not.toBeNull();
    expect(result!.quote.content).toBe('Random me');
    expect(result!.bookTitle).toBe('Test Book');
  });
});

describe('getFavoriteQuotes', () => {
  it('returns only favorited quotes', () => {
    createQuote(adapter, crypto.randomUUID(), { book_id: testBookId, content: 'Not fav' });
    createQuote(adapter, crypto.randomUUID(), { book_id: testBookId, content: 'Fav', is_favorite: 1 });

    const result = getFavoriteQuotes(adapter);
    expect(result).toHaveLength(1);
    expect(result[0].quote.content).toBe('Fav');
  });
});

describe('getQuoteCount', () => {
  it('returns total count', () => {
    createQuote(adapter, crypto.randomUUID(), { book_id: testBookId, content: 'Q1' });
    createQuote(adapter, crypto.randomUUID(), { book_id: testBookId, content: 'Q2' });

    expect(getQuoteCount(adapter)).toBe(2);
  });

  it('returns count for specific book', () => {
    createQuote(adapter, crypto.randomUUID(), { book_id: testBookId, content: 'Q1' });

    const otherBookId = crypto.randomUUID();
    createBook(adapter, otherBookId, makeBook({ title: 'Other' }));
    createQuote(adapter, crypto.randomUUID(), { book_id: otherBookId, content: 'Q2' });

    expect(getQuoteCount(adapter, testBookId)).toBe(1);
  });
});
