import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { BOOKS_MODULE } from '../definition';
import { createBook } from '../db/books';
import { createSession, updateSession } from '../db/reading-sessions';
import { createGoal } from '../db/reading-goals';
import { getTodayCards } from '../cross-module';

let adapter: DatabaseAdapter;
let closeDb: () => void;

const FIXED_NOW = new Date('2026-04-18T15:00:00.000Z');

beforeEach(() => {
  const testDb = createModuleTestDatabase('books', BOOKS_MODULE.migrations!);
  adapter = testDb.adapter;
  closeDb = testDb.close;
});

afterEach(() => {
  closeDb();
});

describe('books.getTodayCards', () => {
  it('returns empty array on an empty database', () => {
    const cards = getTodayCards(adapter, { now: FIXED_NOW });
    expect(cards).toEqual([]);
  });

  it('surfaces the currently-reading book as a progress card', () => {
    createBook(adapter, 'book-1', {
      title: 'Project Hail Mary',
      authors: '["Andy Weir"]',
      page_count: 480,
    });
    createSession(adapter, 'session-1', {
      book_id: 'book-1',
      status: 'reading',
      current_page: 120,
      started_at: '2026-04-10T08:00:00.000Z',
    });

    const cards = getTodayCards(adapter, { now: FIXED_NOW });
    const progress = cards.find((c) => c.id.startsWith('books.currently-reading.'));
    expect(progress).toBeDefined();
    expect(progress!.moduleId).toBe('books');
    expect(progress!.kind).toBe('progress');
    expect(progress!.priority).toBe(50);
    expect(progress!.title).toBe('Project Hail Mary');
    expect(progress!.subtitle).toContain('25%');
    expect(progress!.subtitle).toContain('360 pages left');
    expect(progress!.cta?.route).toBe('/books/book/book-1');
  });

  it('surfaces a reading goal progress card with on/ahead/behind pace', () => {
    // April 18 = day 108 of 365 -> ~29.6% through year. Goal of 12 expects ~3.6 books.
    createGoal(adapter, 'goal-2026', { year: 2026, target_books: 12 });
    createBook(adapter, 'book-done', {
      title: 'Done Book',
      authors: '["Author"]',
    });
    createSession(adapter, 's-done', {
      book_id: 'book-done',
      status: 'finished',
      finished_at: '2026-02-01T12:00:00.000Z',
    });

    const cards = getTodayCards(adapter, { now: FIXED_NOW });
    const goal = cards.find((c) => c.id === 'books.reading-goal.2026');
    expect(goal).toBeDefined();
    expect(goal!.kind).toBe('progress');
    expect(goal!.title).toBe('1 of 12 books');
    expect(goal!.subtitle).toContain('2026');
    expect(goal!.subtitle).toMatch(/(behind pace|on pace|ahead of pace)/);
  });

  it('caps at 3 cards and respects priority bounds + ordering', () => {
    createBook(adapter, 'book-1', {
      title: 'Active Read',
      authors: '["A"]',
      page_count: 300,
    });
    createSession(adapter, 'sess-1', {
      book_id: 'book-1',
      status: 'reading',
      current_page: 100,
    });
    createGoal(adapter, 'goal-2026', { year: 2026, target_books: 24 });

    const cards = getTodayCards(adapter, { now: FIXED_NOW });
    expect(cards.length).toBeLessThanOrEqual(3);
    for (const card of cards) {
      expect(card.priority).toBeGreaterThanOrEqual(0);
      expect(card.priority).toBeLessThanOrEqual(100);
      expect(card.moduleId).toBe('books');
    }
    for (let i = 1; i < cards.length; i++) {
      expect(cards[i - 1].priority).toBeGreaterThanOrEqual(cards[i].priority);
    }
  });

  it('skips currently-reading card when no session is in reading status', () => {
    createBook(adapter, 'book-1', {
      title: 'Wishlist',
      authors: '["A"]',
    });
    createSession(adapter, 'sess-1', {
      book_id: 'book-1',
      status: 'want_to_read',
    });

    const cards = getTodayCards(adapter, { now: FIXED_NOW });
    const progress = cards.find((c) => c.id.startsWith('books.currently-reading.'));
    expect(progress).toBeUndefined();
  });

  it('updates currently-reading subtitle for >100% gracefully', () => {
    createBook(adapter, 'book-overflow', {
      title: 'Overflow',
      authors: '["A"]',
      page_count: 200,
    });
    const session = createSession(adapter, 'sess-overflow', {
      book_id: 'book-overflow',
      status: 'reading',
      current_page: 0,
    });
    expect(session).toBeDefined();
    updateSession(adapter, 'sess-overflow', { current_page: 250 });

    const cards = getTodayCards(adapter, { now: FIXED_NOW });
    const progress = cards.find((c) => c.id.startsWith('books.currently-reading.'));
    expect(progress).toBeDefined();
    expect(progress!.subtitle).toBe('Almost finished');
  });
});
