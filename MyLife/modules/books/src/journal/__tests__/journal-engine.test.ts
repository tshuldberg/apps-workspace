import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { BOOKS_MODULE } from '../../definition';
import {
  createJournalEntry,
  getJournalEntry,
  getJournalEntries,
  updateJournalEntry,
  deleteJournalEntry,
  searchJournalEntries,
  getJournalEntryCount,
} from '../../db/journal-entries';
import {
  addJournalPhoto,
  getPhotosForEntry,
  removeJournalPhoto,
  reorderJournalPhotos,
} from '../../db/journal-photos';
import {
  linkJournalToBook,
  unlinkJournalFromBook,
  getLinkedBooks,
  getJournalEntriesForBook,
  getLinkedEntryCount,
} from '../../db/journal-book-links';
import { createBook } from '../../db/books';
import {
  createEntry,
  getDecryptedEntry,
  getReflectionsForBook,
  getJournalStats,
  exportJournalToMarkdown,
  countWords,
} from '../journal-engine';
import type { JournalEntryInsert, BookInsert } from '../../models/schemas';

let adapter: DatabaseAdapter;
let closeDb: () => void;

function makeEntry(overrides: Partial<JournalEntryInsert> = {}): JournalEntryInsert {
  return {
    content: 'Today I read a wonderful book about the sea.',
    ...overrides,
  };
}

function makeBook(overrides: Partial<BookInsert> = {}): BookInsert {
  return {
    title: 'The Old Man and the Sea',
    authors: '["Ernest Hemingway"]',
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

// --- Entry CRUD ---

describe('createJournalEntry', () => {
  it('creates an entry with all defaults', () => {
    const entry = createJournalEntry(adapter, 'entry-1', makeEntry());
    expect(entry.id).toBe('entry-1');
    expect(entry.content).toBe('Today I read a wonderful book about the sea.');
    expect(entry.content_encrypted).toBe(0);
    expect(entry.title).toBeNull();
    expect(entry.mood).toBeNull();
    expect(entry.is_favorite).toBe(0);
  });

  it('preserves optional fields', () => {
    const entry = createJournalEntry(adapter, 'entry-1', makeEntry({
      title: 'My Reading Thoughts',
      mood: 'happy',
      is_favorite: 1,
      word_count: 9,
    }));
    expect(entry.title).toBe('My Reading Thoughts');
    expect(entry.mood).toBe('happy');
    expect(entry.is_favorite).toBe(1);
    expect(entry.word_count).toBe(9);
  });
});

describe('getJournalEntry', () => {
  it('retrieves an entry by ID', () => {
    createJournalEntry(adapter, 'entry-1', makeEntry());
    const found = getJournalEntry(adapter, 'entry-1');
    expect(found).not.toBeNull();
    expect(found!.id).toBe('entry-1');
  });

  it('returns null for non-existent ID', () => {
    expect(getJournalEntry(adapter, 'nope')).toBeNull();
  });
});

describe('getJournalEntries', () => {
  beforeEach(() => {
    createJournalEntry(adapter, 'e1', makeEntry({ mood: 'happy', is_favorite: 1 }));
    createJournalEntry(adapter, 'e2', makeEntry({ mood: 'sad' }));
    createJournalEntry(adapter, 'e3', makeEntry({ mood: 'happy' }));
  });

  it('returns all entries', () => {
    const entries = getJournalEntries(adapter);
    expect(entries).toHaveLength(3);
  });

  it('filters by mood', () => {
    const entries = getJournalEntries(adapter, { mood: 'happy' });
    expect(entries).toHaveLength(2);
  });

  it('filters by is_favorite', () => {
    const entries = getJournalEntries(adapter, { isFavorite: true });
    expect(entries).toHaveLength(1);
    expect(entries[0].id).toBe('e1');
  });

  it('supports limit', () => {
    const entries = getJournalEntries(adapter, { limit: 2 });
    expect(entries).toHaveLength(2);
  });

  it('supports limit and offset', () => {
    const entries = getJournalEntries(adapter, { limit: 2, offset: 2 });
    expect(entries).toHaveLength(1);
  });
});

describe('updateJournalEntry', () => {
  it('updates specified fields', () => {
    createJournalEntry(adapter, 'e1', makeEntry());
    updateJournalEntry(adapter, 'e1', { mood: 'reflective' });
    const entry = getJournalEntry(adapter, 'e1');
    expect(entry!.mood).toBe('reflective');
  });

  it('does nothing for empty updates', () => {
    createJournalEntry(adapter, 'e1', makeEntry({ mood: 'calm' }));
    updateJournalEntry(adapter, 'e1', {});
    expect(getJournalEntry(adapter, 'e1')!.mood).toBe('calm');
  });
});

describe('deleteJournalEntry', () => {
  it('removes the entry', () => {
    createJournalEntry(adapter, 'e1', makeEntry());
    deleteJournalEntry(adapter, 'e1');
    expect(getJournalEntry(adapter, 'e1')).toBeNull();
  });
});

describe('searchJournalEntries', () => {
  it('finds entries by content', () => {
    createJournalEntry(adapter, 'e1', makeEntry({ content: 'The sunset was beautiful' }));
    createJournalEntry(adapter, 'e2', makeEntry({ content: 'I love reading mystery novels' }));
    const results = searchJournalEntries(adapter, 'sunset');
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('e1');
  });

  it('finds entries by title', () => {
    createJournalEntry(adapter, 'e1', makeEntry({ title: 'Morning Walk', content: 'text' }));
    createJournalEntry(adapter, 'e2', makeEntry({ title: 'Evening Read', content: 'text' }));
    const results = searchJournalEntries(adapter, 'morning');
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('e1');
  });

  it('returns empty for no matches', () => {
    createJournalEntry(adapter, 'e1', makeEntry());
    const results = searchJournalEntries(adapter, 'nonexistent_xyz_123');
    expect(results).toHaveLength(0);
  });
});

describe('getJournalEntryCount', () => {
  it('returns 0 for empty database', () => {
    expect(getJournalEntryCount(adapter)).toBe(0);
  });

  it('counts entries', () => {
    createJournalEntry(adapter, 'e1', makeEntry());
    createJournalEntry(adapter, 'e2', makeEntry());
    expect(getJournalEntryCount(adapter)).toBe(2);
  });
});

// --- Photos ---

describe('journal photos', () => {
  beforeEach(() => {
    createJournalEntry(adapter, 'e1', makeEntry());
  });

  it('adds and retrieves photos', () => {
    addJournalPhoto(adapter, 'p1', { entry_id: 'e1', file_path: '/photos/a.jpg' });
    addJournalPhoto(adapter, 'p2', { entry_id: 'e1', file_path: '/photos/b.jpg', sort_order: 1 });
    const photos = getPhotosForEntry(adapter, 'e1');
    expect(photos).toHaveLength(2);
    expect(photos[0].sort_order).toBe(0);
    expect(photos[1].sort_order).toBe(1);
  });

  it('removes a photo', () => {
    addJournalPhoto(adapter, 'p1', { entry_id: 'e1', file_path: '/photos/a.jpg' });
    removeJournalPhoto(adapter, 'p1');
    expect(getPhotosForEntry(adapter, 'e1')).toHaveLength(0);
  });

  it('reorders photos', () => {
    addJournalPhoto(adapter, 'p1', { entry_id: 'e1', file_path: '/a.jpg', sort_order: 0 });
    addJournalPhoto(adapter, 'p2', { entry_id: 'e1', file_path: '/b.jpg', sort_order: 1 });
    // Reorder: p2 first (sort_order=0), p1 second (sort_order=1)
    reorderJournalPhotos(adapter, 'e1', ['p2', 'p1']);
    const photos = getPhotosForEntry(adapter, 'e1');
    // Sorted by sort_order ASC, so p2 (0) comes before p1 (1)
    expect(photos[0].id).toBe('p2');
    expect(photos[0].sort_order).toBe(0);
    expect(photos[1].id).toBe('p1');
    expect(photos[1].sort_order).toBe(1);
  });
});

// --- Book links ---

describe('journal book links', () => {
  beforeEach(() => {
    createJournalEntry(adapter, 'e1', makeEntry());
    createBook(adapter, 'b1', makeBook({ title: 'Book A' }));
    createBook(adapter, 'b2', makeBook({ title: 'Book B' }));
  });

  it('links and retrieves linked books', () => {
    linkJournalToBook(adapter, 'e1', 'b1');
    linkJournalToBook(adapter, 'e1', 'b2');
    const books = getLinkedBooks(adapter, 'e1');
    expect(books).toHaveLength(2);
    const titles = books.map((b) => b.title);
    expect(titles).toContain('Book A');
    expect(titles).toContain('Book B');
  });

  it('unlinks a book', () => {
    linkJournalToBook(adapter, 'e1', 'b1');
    unlinkJournalFromBook(adapter, 'e1', 'b1');
    expect(getLinkedBooks(adapter, 'e1')).toHaveLength(0);
  });

  it('retrieves journal entries for a book', () => {
    createJournalEntry(adapter, 'e2', makeEntry({ content: 'Another reflection' }));
    linkJournalToBook(adapter, 'e1', 'b1');
    linkJournalToBook(adapter, 'e2', 'b1');
    const entries = getJournalEntriesForBook(adapter, 'b1');
    expect(entries).toHaveLength(2);
  });

  it('counts linked entries', () => {
    linkJournalToBook(adapter, 'e1', 'b1');
    expect(getLinkedEntryCount(adapter, 'b1')).toBe(1);
  });

  it('does not duplicate links', () => {
    linkJournalToBook(adapter, 'e1', 'b1');
    linkJournalToBook(adapter, 'e1', 'b1');
    expect(getLinkedEntryCount(adapter, 'b1')).toBe(1);
  });
});

// --- Engine ---

describe('countWords', () => {
  it('counts words in a string', () => {
    expect(countWords('hello world')).toBe(2);
    expect(countWords('one')).toBe(1);
    expect(countWords('  spaced  out  words  ')).toBe(3);
    expect(countWords('')).toBe(0);
    expect(countWords('   ')).toBe(0);
  });
});

describe('createEntry (engine)', () => {
  it('creates an entry with word count', async () => {
    const entry = await createEntry(adapter, 'Hello world today is great');
    expect(entry.word_count).toBe(5);
    expect(entry.content_encrypted).toBe(0);
  });

  it('creates an entry with book links', async () => {
    createBook(adapter, 'b1', makeBook());
    const entry = await createEntry(adapter, 'Great book!', { bookIds: ['b1'] });
    const linked = getLinkedBooks(adapter, entry.id);
    expect(linked).toHaveLength(1);
  });

  it('creates an encrypted entry', async () => {
    const entry = await createEntry(adapter, 'Secret thoughts', { passphrase: 'test123' });
    expect(entry.content_encrypted).toBe(1);
    expect(entry.encryption_salt).toBeTruthy();
    expect(entry.encryption_iv).toBeTruthy();
    expect(entry.content).not.toBe('Secret thoughts');
  });
});

describe('getDecryptedEntry', () => {
  it('decrypts an encrypted entry', async () => {
    const entry = await createEntry(adapter, 'My secret', { passphrase: 'pass123' });
    const result = await getDecryptedEntry(adapter, entry.id, 'pass123');
    expect(result).not.toBeNull();
    expect(result!.decryptedContent).toBe('My secret');
  });

  it('returns entry without decryptedContent for unencrypted entries', async () => {
    const entry = await createEntry(adapter, 'Plain text');
    const result = await getDecryptedEntry(adapter, entry.id);
    expect(result).not.toBeNull();
    expect(result!.decryptedContent).toBeUndefined();
    expect(result!.content).toBe('Plain text');
  });

  it('returns null for non-existent entry', async () => {
    const result = await getDecryptedEntry(adapter, 'nope');
    expect(result).toBeNull();
  });
});

describe('getReflectionsForBook', () => {
  it('returns entries linked to a book', async () => {
    createBook(adapter, 'b1', makeBook());
    await createEntry(adapter, 'Loved chapter 1', { bookIds: ['b1'] });
    await createEntry(adapter, 'Chapter 2 was slow', { bookIds: ['b1'] });
    const reflections = getReflectionsForBook(adapter, 'b1');
    expect(reflections).toHaveLength(2);
  });
});

describe('getJournalStats', () => {
  it('returns zero stats for empty journal', () => {
    const stats = getJournalStats(adapter);
    expect(stats.totalEntries).toBe(0);
    expect(stats.entriesThisMonth).toBe(0);
    expect(stats.longestStreak).toBe(0);
    expect(stats.currentStreak).toBe(0);
  });

  it('counts total entries', () => {
    createJournalEntry(adapter, 'e1', makeEntry());
    createJournalEntry(adapter, 'e2', makeEntry());
    const stats = getJournalStats(adapter);
    expect(stats.totalEntries).toBe(2);
  });

  it('counts entries this month', () => {
    createJournalEntry(adapter, 'e1', makeEntry());
    const stats = getJournalStats(adapter);
    expect(stats.entriesThisMonth).toBe(1);
  });
});

describe('exportJournalToMarkdown', () => {
  it('exports entries with YAML frontmatter', () => {
    createJournalEntry(adapter, 'e1', makeEntry({
      title: 'Test Entry',
      content: 'Some content here',
      mood: 'happy',
      word_count: 3,
    }));
    const md = exportJournalToMarkdown(adapter);
    expect(md).toContain('---');
    expect(md).toContain('mood: happy');
    expect(md).toContain('word_count: 3');
    expect(md).toContain('# Test Entry');
    expect(md).toContain('Some content here');
  });

  it('exports specific entries by ID', () => {
    createJournalEntry(adapter, 'e1', makeEntry({ content: 'First' }));
    createJournalEntry(adapter, 'e2', makeEntry({ content: 'Second' }));
    const md = exportJournalToMarkdown(adapter, ['e1']);
    expect(md).toContain('First');
    expect(md).not.toContain('Second');
  });

  it('includes linked book titles', () => {
    createBook(adapter, 'b1', makeBook({ title: 'Dune' }));
    createJournalEntry(adapter, 'e1', makeEntry({ content: 'Great book' }));
    linkJournalToBook(adapter, 'e1', 'b1');
    const md = exportJournalToMarkdown(adapter);
    expect(md).toContain('"Dune"');
  });
});
