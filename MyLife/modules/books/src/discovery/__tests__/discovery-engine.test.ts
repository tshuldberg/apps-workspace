import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { BOOKS_MODULE } from '../../definition';
import { createBook } from '../../db/books';
import { createTag, addTagToBook } from '../../db/tags';
import { addMoodTag, removeMoodTag, getMoodTagsForBook, getMoodTagsByType, getBooksWithMoodTag, getDistinctMoodValues } from '../../db/mood-tags';
import { addContentWarning, removeContentWarning, getContentWarningsForBook, getBooksWithContentWarning, getDistinctWarnings } from '../../db/content-warnings';
import { discoverBooks, getBookDiscoveryProfile } from '../discovery-engine';
import type { BookInsert } from '../../models/schemas';

let adapter: DatabaseAdapter;
let closeDb: () => void;

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
});

afterEach(() => {
  closeDb();
});

// --- Mood Tags CRUD ---

describe('addMoodTag', () => {
  it('creates a mood tag for a book', () => {
    createBook(adapter, 'book-1', makeBook());
    const tag = addMoodTag(adapter, 'mt-1', {
      book_id: 'book-1',
      tag_type: 'mood',
      value: 'melancholy',
    });
    expect(tag.id).toBe('mt-1');
    expect(tag.tag_type).toBe('mood');
    expect(tag.value).toBe('melancholy');
    expect(tag.created_at).toBeTruthy();
  });

  it('ignores duplicate book_id+tag_type+value', () => {
    createBook(adapter, 'book-1', makeBook());
    addMoodTag(adapter, 'mt-1', { book_id: 'book-1', tag_type: 'mood', value: 'dark' });
    // Should not throw due to INSERT OR IGNORE
    addMoodTag(adapter, 'mt-2', { book_id: 'book-1', tag_type: 'mood', value: 'dark' });
    const tags = getMoodTagsForBook(adapter, 'book-1');
    expect(tags).toHaveLength(1);
  });
});

describe('removeMoodTag', () => {
  it('removes a mood tag by id', () => {
    createBook(adapter, 'book-1', makeBook());
    addMoodTag(adapter, 'mt-1', { book_id: 'book-1', tag_type: 'mood', value: 'dark' });
    removeMoodTag(adapter, 'mt-1');
    expect(getMoodTagsForBook(adapter, 'book-1')).toHaveLength(0);
  });
});

describe('getMoodTagsForBook', () => {
  it('returns all mood tags for a book', () => {
    createBook(adapter, 'book-1', makeBook());
    addMoodTag(adapter, 'mt-1', { book_id: 'book-1', tag_type: 'mood', value: 'dark' });
    addMoodTag(adapter, 'mt-2', { book_id: 'book-1', tag_type: 'pace', value: 'fast' });
    addMoodTag(adapter, 'mt-3', { book_id: 'book-1', tag_type: 'genre', value: 'thriller' });
    const tags = getMoodTagsForBook(adapter, 'book-1');
    expect(tags).toHaveLength(3);
  });
});

describe('getMoodTagsByType', () => {
  it('filters by tag type', () => {
    createBook(adapter, 'book-1', makeBook());
    addMoodTag(adapter, 'mt-1', { book_id: 'book-1', tag_type: 'mood', value: 'dark' });
    addMoodTag(adapter, 'mt-2', { book_id: 'book-1', tag_type: 'pace', value: 'fast' });
    const moods = getMoodTagsByType(adapter, 'book-1', 'mood');
    expect(moods).toHaveLength(1);
    expect(moods[0].value).toBe('dark');
  });
});

describe('getBooksWithMoodTag', () => {
  it('returns books matching a mood tag value', () => {
    createBook(adapter, 'book-1', makeBook({ title: 'Dark Book' }));
    createBook(adapter, 'book-2', makeBook({ title: 'Light Book' }));
    addMoodTag(adapter, 'mt-1', { book_id: 'book-1', tag_type: 'mood', value: 'dark' });
    addMoodTag(adapter, 'mt-2', { book_id: 'book-2', tag_type: 'mood', value: 'light' });
    const results = getBooksWithMoodTag(adapter, 'mood', 'dark');
    expect(results).toHaveLength(1);
    expect(results[0].title).toBe('Dark Book');
  });
});

describe('getDistinctMoodValues', () => {
  it('returns unique values for a given type', () => {
    createBook(adapter, 'book-1', makeBook());
    createBook(adapter, 'book-2', makeBook({ title: 'Book 2' }));
    addMoodTag(adapter, 'mt-1', { book_id: 'book-1', tag_type: 'mood', value: 'dark' });
    addMoodTag(adapter, 'mt-2', { book_id: 'book-2', tag_type: 'mood', value: 'hopeful' });
    addMoodTag(adapter, 'mt-3', { book_id: 'book-1', tag_type: 'pace', value: 'slow' });
    const values = getDistinctMoodValues(adapter, 'mood');
    expect(values).toEqual(['dark', 'hopeful']);
  });
});

// --- Content Warnings CRUD ---

describe('addContentWarning', () => {
  it('creates a content warning', () => {
    createBook(adapter, 'book-1', makeBook());
    const cw = addContentWarning(adapter, 'cw-1', {
      book_id: 'book-1',
      warning: 'violence',
      severity: 'severe',
    });
    expect(cw.id).toBe('cw-1');
    expect(cw.warning).toBe('violence');
    expect(cw.severity).toBe('severe');
  });

  it('defaults severity to moderate', () => {
    createBook(adapter, 'book-1', makeBook());
    const cw = addContentWarning(adapter, 'cw-1', {
      book_id: 'book-1',
      warning: 'language',
    });
    expect(cw.severity).toBe('moderate');
  });
});

describe('removeContentWarning', () => {
  it('removes a content warning', () => {
    createBook(adapter, 'book-1', makeBook());
    addContentWarning(adapter, 'cw-1', { book_id: 'book-1', warning: 'violence' });
    removeContentWarning(adapter, 'cw-1');
    expect(getContentWarningsForBook(adapter, 'book-1')).toHaveLength(0);
  });
});

describe('getContentWarningsForBook', () => {
  it('returns warnings ordered by severity', () => {
    createBook(adapter, 'book-1', makeBook());
    addContentWarning(adapter, 'cw-1', { book_id: 'book-1', warning: 'language', severity: 'mild' });
    addContentWarning(adapter, 'cw-2', { book_id: 'book-1', warning: 'violence', severity: 'severe' });
    const warnings = getContentWarningsForBook(adapter, 'book-1');
    expect(warnings).toHaveLength(2);
    // Severe comes first in DESC order
    expect(warnings[0].severity).toBe('severe');
  });
});

describe('getBooksWithContentWarning', () => {
  it('returns books with a specific warning', () => {
    createBook(adapter, 'book-1', makeBook({ title: 'Violent Book' }));
    createBook(adapter, 'book-2', makeBook({ title: 'Clean Book' }));
    addContentWarning(adapter, 'cw-1', { book_id: 'book-1', warning: 'violence' });
    const results = getBooksWithContentWarning(adapter, 'violence');
    expect(results).toHaveLength(1);
    expect(results[0].title).toBe('Violent Book');
  });
});

describe('getDistinctWarnings', () => {
  it('returns unique warning names', () => {
    createBook(adapter, 'book-1', makeBook());
    createBook(adapter, 'book-2', makeBook({ title: 'B2' }));
    addContentWarning(adapter, 'cw-1', { book_id: 'book-1', warning: 'violence' });
    addContentWarning(adapter, 'cw-2', { book_id: 'book-2', warning: 'violence' });
    addContentWarning(adapter, 'cw-3', { book_id: 'book-1', warning: 'language' });
    const warnings = getDistinctWarnings(adapter);
    expect(warnings).toEqual(['language', 'violence']);
  });
});

// --- Discovery Engine ---

describe('discoverBooks', () => {
  beforeEach(() => {
    createBook(adapter, 'book-1', makeBook({ title: 'Dark Fantasy' }));
    createBook(adapter, 'book-2', makeBook({ title: 'Light Romance' }));
    createBook(adapter, 'book-3', makeBook({ title: 'Fast Thriller' }));

    addMoodTag(adapter, 'mt-1', { book_id: 'book-1', tag_type: 'mood', value: 'dark' });
    addMoodTag(adapter, 'mt-2', { book_id: 'book-1', tag_type: 'genre', value: 'fantasy' });
    addMoodTag(adapter, 'mt-3', { book_id: 'book-2', tag_type: 'mood', value: 'light' });
    addMoodTag(adapter, 'mt-4', { book_id: 'book-2', tag_type: 'genre', value: 'romance' });
    addMoodTag(adapter, 'mt-5', { book_id: 'book-3', tag_type: 'mood', value: 'dark' });
    addMoodTag(adapter, 'mt-6', { book_id: 'book-3', tag_type: 'pace', value: 'fast' });

    addContentWarning(adapter, 'cw-1', { book_id: 'book-1', warning: 'violence' });
    addContentWarning(adapter, 'cw-2', { book_id: 'book-3', warning: 'violence' });
  });

  it('returns all books with no filters', () => {
    const results = discoverBooks(adapter, {});
    expect(results).toHaveLength(3);
  });

  it('filters by mood', () => {
    const results = discoverBooks(adapter, { moods: ['dark'] });
    expect(results).toHaveLength(2);
    const titles = results.map((b) => b.title);
    expect(titles).toContain('Dark Fantasy');
    expect(titles).toContain('Fast Thriller');
  });

  it('filters by genre', () => {
    const results = discoverBooks(adapter, { genres: ['fantasy'] });
    expect(results).toHaveLength(1);
    expect(results[0].title).toBe('Dark Fantasy');
  });

  it('filters by pace', () => {
    const results = discoverBooks(adapter, { paces: ['fast'] });
    expect(results).toHaveLength(1);
    expect(results[0].title).toBe('Fast Thriller');
  });

  it('excludes books with content warnings', () => {
    const results = discoverBooks(adapter, { excludeWarnings: ['violence'] });
    expect(results).toHaveLength(1);
    expect(results[0].title).toBe('Light Romance');
  });

  it('combines mood and excludeWarnings', () => {
    const results = discoverBooks(adapter, {
      moods: ['dark'],
      excludeWarnings: ['violence'],
    });
    expect(results).toHaveLength(0);
  });

  it('filters by user tags', () => {
    createTag(adapter, 'tag-1', { name: 'favorites' });
    addTagToBook(adapter, 'book-2', 'tag-1');
    const results = discoverBooks(adapter, { tags: ['favorites'] });
    expect(results).toHaveLength(1);
    expect(results[0].title).toBe('Light Romance');
  });

  it('supports pagination', () => {
    const page1 = discoverBooks(adapter, { limit: 2, offset: 0 });
    const page2 = discoverBooks(adapter, { limit: 2, offset: 2 });
    expect(page1).toHaveLength(2);
    expect(page2).toHaveLength(1);
  });
});

describe('getBookDiscoveryProfile', () => {
  it('returns complete discovery profile', () => {
    createBook(adapter, 'book-1', makeBook());
    addMoodTag(adapter, 'mt-1', { book_id: 'book-1', tag_type: 'mood', value: 'dark' });
    addMoodTag(adapter, 'mt-2', { book_id: 'book-1', tag_type: 'pace', value: 'slow' });
    addMoodTag(adapter, 'mt-3', { book_id: 'book-1', tag_type: 'genre', value: 'fantasy' });
    addContentWarning(adapter, 'cw-1', { book_id: 'book-1', warning: 'violence', severity: 'severe' });
    createTag(adapter, 'tag-1', { name: 'favorites' });
    addTagToBook(adapter, 'book-1', 'tag-1');

    const profile = getBookDiscoveryProfile(adapter, 'book-1');
    expect(profile.moods).toEqual(['dark']);
    expect(profile.paces).toEqual(['slow']);
    expect(profile.genres).toEqual(['fantasy']);
    expect(profile.contentWarnings).toHaveLength(1);
    expect(profile.contentWarnings[0].warning).toBe('violence');
    expect(profile.tags).toEqual(['favorites']);
  });

  it('returns empty arrays for book with no metadata', () => {
    createBook(adapter, 'book-1', makeBook());
    const profile = getBookDiscoveryProfile(adapter, 'book-1');
    expect(profile.moods).toEqual([]);
    expect(profile.paces).toEqual([]);
    expect(profile.genres).toEqual([]);
    expect(profile.contentWarnings).toEqual([]);
    expect(profile.tags).toEqual([]);
  });
});
