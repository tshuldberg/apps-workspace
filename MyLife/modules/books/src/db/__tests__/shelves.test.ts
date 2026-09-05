import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { BOOKS_MODULE } from '../../definition';
import {
  createShelf,
  getShelf,
  getShelves,
  getSystemShelves,
  updateShelf,
  deleteShelf,
  getBookCountsPerShelf,
} from '../shelves';
import { addBookToShelf, removeBookFromShelf, getBooksOnShelf, getShelvesForBook, moveBookToShelf } from '../book-shelves';
import { createBook } from '../books';
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

describe('system shelves seeded on init', () => {
  it('creates 3 system shelves', () => {
    const system = getSystemShelves(adapter);
    expect(system).toHaveLength(3);
  });

  it('includes Want to Read shelf', () => {
    const system = getSystemShelves(adapter);
    const tbr = system.find((s) => s.slug === 'want-to-read');
    expect(tbr).toBeDefined();
    expect(tbr!.is_system).toBe(1);
  });

  it('includes Currently Reading shelf', () => {
    const system = getSystemShelves(adapter);
    const reading = system.find((s) => s.slug === 'currently-reading');
    expect(reading).toBeDefined();
  });

  it('includes Finished shelf', () => {
    const system = getSystemShelves(adapter);
    const finished = system.find((s) => s.slug === 'finished');
    expect(finished).toBeDefined();
  });

  it('system shelves are sorted by sort_order', () => {
    const system = getSystemShelves(adapter);
    expect(system[0].name).toBe('Want to Read');
    expect(system[1].name).toBe('Currently Reading');
    expect(system[2].name).toBe('Finished');
  });
});

describe('createShelf', () => {
  it('creates a custom shelf', () => {
    const shelf = createShelf(adapter, 'shelf-custom', {
      name: 'Favorites',
      slug: 'favorites',
    });
    expect(shelf.id).toBe('shelf-custom');
    expect(shelf.name).toBe('Favorites');
    expect(shelf.is_system).toBe(0);
  });

  it('sets created_at timestamp', () => {
    const shelf = createShelf(adapter, 'shelf-1', { name: 'Test', slug: 'test' });
    expect(shelf.created_at).toBeTruthy();
  });
});

describe('getShelf', () => {
  it('retrieves shelf by ID', () => {
    createShelf(adapter, 'shelf-1', { name: 'Custom', slug: 'custom' });
    const found = getShelf(adapter, 'shelf-1');
    expect(found).not.toBeNull();
    expect(found!.name).toBe('Custom');
  });

  it('returns null for non-existent shelf', () => {
    expect(getShelf(adapter, 'nope')).toBeNull();
  });
});

describe('getShelves', () => {
  it('returns system and custom shelves', () => {
    createShelf(adapter, 'shelf-custom', { name: 'Custom', slug: 'custom', sort_order: 10 });
    const all = getShelves(adapter);
    // 3 system + 1 custom
    expect(all).toHaveLength(4);
  });
});

describe('updateShelf', () => {
  it('updates name and slug', () => {
    createShelf(adapter, 'shelf-1', { name: 'Old', slug: 'old' });
    updateShelf(adapter, 'shelf-1', { name: 'New', slug: 'new' });
    const shelf = getShelf(adapter, 'shelf-1');
    expect(shelf!.name).toBe('New');
    expect(shelf!.slug).toBe('new');
  });

  it('does nothing for empty updates', () => {
    createShelf(adapter, 'shelf-1', { name: 'Old', slug: 'old' });
    updateShelf(adapter, 'shelf-1', {});
    expect(getShelf(adapter, 'shelf-1')!.name).toBe('Old');
  });
});

describe('deleteShelf', () => {
  it('deletes a custom shelf', () => {
    createShelf(adapter, 'shelf-1', { name: 'Custom', slug: 'custom' });
    deleteShelf(adapter, 'shelf-1');
    expect(getShelf(adapter, 'shelf-1')).toBeNull();
  });

  it('does not delete a system shelf', () => {
    deleteShelf(adapter, 'shelf-tbr');
    expect(getShelf(adapter, 'shelf-tbr')).not.toBeNull();
  });
});

describe('addBookToShelf / removeBookFromShelf', () => {
  beforeEach(() => {
    createBook(adapter, 'book-1', makeBook());
  });

  it('adds a book to a shelf and updates book_count', () => {
    addBookToShelf(adapter, 'book-1', 'shelf-tbr');
    const shelf = getShelf(adapter, 'shelf-tbr');
    expect(shelf!.book_count).toBe(1);
  });

  it('does not duplicate when adding twice', () => {
    addBookToShelf(adapter, 'book-1', 'shelf-tbr');
    addBookToShelf(adapter, 'book-1', 'shelf-tbr');
    const shelf = getShelf(adapter, 'shelf-tbr');
    expect(shelf!.book_count).toBe(1);
  });

  it('removes a book from a shelf and updates book_count', () => {
    addBookToShelf(adapter, 'book-1', 'shelf-tbr');
    removeBookFromShelf(adapter, 'book-1', 'shelf-tbr');
    const shelf = getShelf(adapter, 'shelf-tbr');
    expect(shelf!.book_count).toBe(0);
  });
});

describe('getBooksOnShelf', () => {
  it('returns books on a specific shelf', () => {
    createBook(adapter, 'book-1', makeBook({ title: 'A' }));
    createBook(adapter, 'book-2', makeBook({ title: 'B' }));
    addBookToShelf(adapter, 'book-1', 'shelf-tbr');
    addBookToShelf(adapter, 'book-2', 'shelf-reading');

    const tbrBooks = getBooksOnShelf(adapter, 'shelf-tbr');
    expect(tbrBooks).toHaveLength(1);
    expect(tbrBooks[0].title).toBe('A');
  });

  it('returns empty for shelf with no books', () => {
    expect(getBooksOnShelf(adapter, 'shelf-tbr')).toHaveLength(0);
  });
});

describe('getShelvesForBook', () => {
  it('returns shelves a book is on', () => {
    createBook(adapter, 'book-1', makeBook());
    addBookToShelf(adapter, 'book-1', 'shelf-tbr');
    addBookToShelf(adapter, 'book-1', 'shelf-reading');

    const shelves = getShelvesForBook(adapter, 'book-1');
    expect(shelves).toHaveLength(2);
  });
});

describe('moveBookToShelf', () => {
  it('moves a book from one shelf to another', () => {
    createBook(adapter, 'book-1', makeBook());
    addBookToShelf(adapter, 'book-1', 'shelf-tbr');

    moveBookToShelf(adapter, 'book-1', 'shelf-reading');

    const tbrBooks = getBooksOnShelf(adapter, 'shelf-tbr');
    const readingBooks = getBooksOnShelf(adapter, 'shelf-reading');
    expect(tbrBooks).toHaveLength(0);
    expect(readingBooks).toHaveLength(1);

    // Verify counts are updated
    expect(getShelf(adapter, 'shelf-tbr')!.book_count).toBe(0);
    expect(getShelf(adapter, 'shelf-reading')!.book_count).toBe(1);
  });
});

describe('getBookCountsPerShelf', () => {
  it('returns empty record when no books on any shelf', () => {
    const counts = getBookCountsPerShelf(adapter);
    expect(Object.keys(counts)).toHaveLength(0);
  });

  it('returns correct counts per shelf', () => {
    createBook(adapter, 'book-1', makeBook({ title: 'A' }));
    createBook(adapter, 'book-2', makeBook({ title: 'B' }));
    createBook(adapter, 'book-3', makeBook({ title: 'C' }));
    addBookToShelf(adapter, 'book-1', 'shelf-tbr');
    addBookToShelf(adapter, 'book-2', 'shelf-tbr');
    addBookToShelf(adapter, 'book-3', 'shelf-reading');

    const counts = getBookCountsPerShelf(adapter);
    expect(counts['shelf-tbr']).toBe(2);
    expect(counts['shelf-reading']).toBe(1);
    expect(counts['shelf-finished']).toBeUndefined();
  });
});
