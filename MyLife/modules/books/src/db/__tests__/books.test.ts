import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { BOOKS_MODULE } from '../../definition';
import {
  createBook,
  getBook,
  getBooks,
  updateBook,
  deleteBook,
  searchBooksLocal,
  getBookByISBNLocal,
  getBookCount,
} from '../books';
import type { BookInsert } from '../../models/schemas';

let adapter: DatabaseAdapter;
let closeDb: () => void;

function makeBook(overrides: Partial<BookInsert> = {}): BookInsert {
  return {
    title: 'The Great Gatsby',
    authors: '["F. Scott Fitzgerald"]',
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

describe('createBook', () => {
  it('returns a book with the given ID', () => {
    const book = createBook(adapter, 'book-1', makeBook());
    expect(book.id).toBe('book-1');
    expect(book.title).toBe('The Great Gatsby');
    expect(book.authors).toBe('["F. Scott Fitzgerald"]');
  });

  it('sets created_at and updated_at timestamps', () => {
    const book = createBook(adapter, 'book-1', makeBook());
    expect(book.created_at).toBeTruthy();
    expect(book.updated_at).toBeTruthy();
  });

  it('defaults nullable fields to null', () => {
    const book = createBook(adapter, 'book-1', makeBook());
    expect(book.subtitle).toBeNull();
    expect(book.isbn_10).toBeNull();
    expect(book.isbn_13).toBeNull();
    expect(book.description).toBeNull();
  });

  it('defaults format to physical', () => {
    const book = createBook(adapter, 'book-1', makeBook());
    expect(book.format).toBe('physical');
  });

  it('defaults added_source to manual', () => {
    const book = createBook(adapter, 'book-1', makeBook());
    expect(book.added_source).toBe('manual');
  });

  it('preserves optional fields when provided', () => {
    const book = createBook(adapter, 'book-1', makeBook({
      subtitle: 'A Novel',
      isbn_13: '9780743273565',
      page_count: 180,
      publisher: 'Scribner',
      publish_year: 1925,
      format: 'ebook',
      added_source: 'search',
    }));
    expect(book.subtitle).toBe('A Novel');
    expect(book.isbn_13).toBe('9780743273565');
    expect(book.page_count).toBe(180);
    expect(book.publisher).toBe('Scribner');
    expect(book.publish_year).toBe(1925);
    expect(book.format).toBe('ebook');
    expect(book.added_source).toBe('search');
  });
});

describe('getBook', () => {
  it('retrieves a book by ID', () => {
    createBook(adapter, 'book-1', makeBook());
    const found = getBook(adapter, 'book-1');
    expect(found).not.toBeNull();
    expect(found!.title).toBe('The Great Gatsby');
  });

  it('returns null for non-existent ID', () => {
    const found = getBook(adapter, 'does-not-exist');
    expect(found).toBeNull();
  });
});

describe('getBooks', () => {
  beforeEach(() => {
    createBook(adapter, 'book-1', makeBook({ title: 'Book A' }));
    createBook(adapter, 'book-2', makeBook({ title: 'Book B' }));
    createBook(adapter, 'book-3', makeBook({ title: 'Book C' }));
  });

  it('returns all books', () => {
    const books = getBooks(adapter);
    expect(books).toHaveLength(3);
  });

  it('supports limit', () => {
    const books = getBooks(adapter, { limit: 2 });
    expect(books).toHaveLength(2);
  });

  it('supports limit and offset', () => {
    const books = getBooks(adapter, { limit: 2, offset: 2 });
    expect(books).toHaveLength(1);
  });

  it('returns all books with default sort', () => {
    const books = getBooks(adapter);
    const titles = books.map((b) => b.title);
    expect(titles).toContain('Book A');
    expect(titles).toContain('Book B');
    expect(titles).toContain('Book C');
  });

  it('sorts by title ASC when requested', () => {
    const books = getBooks(adapter, { sort_by: 'title', sort_dir: 'ASC' });
    expect(books[0].title).toBe('Book A');
    expect(books[2].title).toBe('Book C');
  });

  it('filters by format', () => {
    createBook(adapter, 'book-4', makeBook({ title: 'Book D', format: 'ebook' }));
    const books = getBooks(adapter, { format: 'ebook' });
    expect(books).toHaveLength(1);
    expect(books[0].title).toBe('Book D');
  });
});

describe('updateBook', () => {
  it('updates specified fields', () => {
    createBook(adapter, 'book-1', makeBook());
    updateBook(adapter, 'book-1', { title: 'Updated Title' });
    const book = getBook(adapter, 'book-1');
    expect(book!.title).toBe('Updated Title');
  });

  it('sets updated_at when updating', () => {
    createBook(adapter, 'book-1', makeBook());
    updateBook(adapter, 'book-1', { title: 'Updated' });
    const updated = getBook(adapter, 'book-1');
    expect(updated!.updated_at).toBeTruthy();
    expect(updated!.title).toBe('Updated');
  });

  it('does nothing for empty updates', () => {
    createBook(adapter, 'book-1', makeBook());
    updateBook(adapter, 'book-1', {});
    const book = getBook(adapter, 'book-1');
    expect(book!.title).toBe('The Great Gatsby');
  });
});

describe('deleteBook', () => {
  it('removes the book', () => {
    createBook(adapter, 'book-1', makeBook());
    deleteBook(adapter, 'book-1');
    expect(getBook(adapter, 'book-1')).toBeNull();
  });

  it('does not throw for non-existent book', () => {
    expect(() => deleteBook(adapter, 'does-not-exist')).not.toThrow();
  });
});

describe('searchBooksLocal', () => {
  it('finds books by title', () => {
    createBook(adapter, 'book-1', makeBook({ title: 'The Great Gatsby' }));
    createBook(adapter, 'book-2', makeBook({ title: 'To Kill a Mockingbird' }));
    const results = searchBooksLocal(adapter, 'gatsby');
    expect(results).toHaveLength(1);
    expect(results[0].title).toBe('The Great Gatsby');
  });

  it('finds books by author', () => {
    createBook(adapter, 'book-1', makeBook({ authors: '["Harper Lee"]', title: 'Mockingbird' }));
    createBook(adapter, 'book-2', makeBook({ authors: '["Fitzgerald"]', title: 'Gatsby' }));
    const results = searchBooksLocal(adapter, 'Harper');
    expect(results).toHaveLength(1);
    expect(results[0].authors).toBe('["Harper Lee"]');
  });

  it('returns empty array for no matches', () => {
    createBook(adapter, 'book-1', makeBook());
    const results = searchBooksLocal(adapter, 'nonexistent_xyz');
    expect(results).toHaveLength(0);
  });
});

describe('getBookByISBNLocal', () => {
  it('finds a book by ISBN-13', () => {
    createBook(adapter, 'book-1', makeBook({ isbn_13: '9780743273565' }));
    const found = getBookByISBNLocal(adapter, '9780743273565');
    expect(found).not.toBeNull();
    expect(found!.id).toBe('book-1');
  });

  it('finds a book by ISBN-10', () => {
    createBook(adapter, 'book-1', makeBook({ isbn_10: '0743273567' }));
    const found = getBookByISBNLocal(adapter, '0743273567');
    expect(found).not.toBeNull();
    expect(found!.id).toBe('book-1');
  });

  it('returns null for unknown ISBN', () => {
    expect(getBookByISBNLocal(adapter, '0000000000')).toBeNull();
  });
});

describe('getBookCount', () => {
  it('returns 0 for empty database', () => {
    expect(getBookCount(adapter)).toBe(0);
  });

  it('counts all books', () => {
    createBook(adapter, 'book-1', makeBook({ title: 'A' }));
    createBook(adapter, 'book-2', makeBook({ title: 'B' }));
    expect(getBookCount(adapter)).toBe(2);
  });
});
