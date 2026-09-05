import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { TRAVEL_MODULE } from '../definition';
import {
  getRoadTripReadingList,
  suggestBooksForDestination,
} from '../integrations/books-link';

function createBooksTables(adapter: DatabaseAdapter): void {
  adapter.execute(`
    CREATE TABLE bk_books (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      authors TEXT,
      subjects TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  adapter.execute(`
    CREATE TABLE bk_reading_sessions (
      id TEXT PRIMARY KEY,
      book_id TEXT NOT NULL,
      status TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
}

function insertBook(
  adapter: DatabaseAdapter,
  params: {
    id: string;
    title: string;
    authors?: string;
    subjects?: string;
    createdAt?: string;
  },
): void {
  adapter.execute(
    `INSERT INTO bk_books (id, title, authors, subjects, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    [
      params.id,
      params.title,
      params.authors ?? null,
      params.subjects ?? null,
      params.createdAt ?? new Date().toISOString(),
    ],
  );
}

function insertSession(
  adapter: DatabaseAdapter,
  id: string,
  bookId: string,
  status: string,
): void {
  adapter.execute(
    `INSERT INTO bk_reading_sessions (id, book_id, status, updated_at)
     VALUES (?, ?, ?, ?)`,
    [id, bookId, status, new Date().toISOString()],
  );
}

describe('@mylife/travel books-link integration', () => {
  let adapter: DatabaseAdapter;
  let closeDb: () => void;

  beforeEach(() => {
    const testDb = createModuleTestDatabase('travel', TRAVEL_MODULE.migrations!);
    adapter = testDb.adapter;
    closeDb = testDb.close;
  });

  afterEach(() => {
    closeDb();
  });

  it('returns [] when bk_books is missing (Books not installed)', () => {
    expect(suggestBooksForDestination(adapter, 'Tokyo')).toEqual([]);
    expect(getRoadTripReadingList(adapter, 30)).toEqual([]);
  });

  it('suggestBooksForDestination matches title or subjects LIKE', () => {
    createBooksTables(adapter);
    insertBook(adapter, {
      id: 'b1',
      title: 'Lost in Tokyo',
      authors: 'Jane Doe',
    });
    insertBook(adapter, {
      id: 'b2',
      title: 'Nothing Relevant',
      authors: 'Bob',
      subjects: 'tokyo, travel',
    });
    insertBook(adapter, {
      id: 'b3',
      title: 'Cooking 101',
      authors: 'Chef',
    });
    const result = suggestBooksForDestination(adapter, 'Tokyo');
    const ids = result.map((r) => r.bookId).sort();
    expect(ids).toEqual(['b1', 'b2']);
    const b1 = result.find((r) => r.bookId === 'b1')!;
    expect(b1.author).toBe('Jane Doe');
    expect(b1.status).toBe('unread');
  });

  it('populates status from latest reading session', () => {
    createBooksTables(adapter);
    insertBook(adapter, { id: 'b1', title: 'Paris Dreams' });
    insertSession(adapter, 's1', 'b1', 'reading');
    const result = suggestBooksForDestination(adapter, 'Paris');
    expect(result).toHaveLength(1);
    expect(result[0]!.status).toBe('reading');
  });

  it('falls back to recent unread books when no match', () => {
    createBooksTables(adapter);
    insertBook(adapter, {
      id: 'b_old',
      title: 'Old',
      createdAt: '2020-01-01T00:00:00Z',
    });
    insertBook(adapter, {
      id: 'b_new',
      title: 'New',
      createdAt: '2026-01-01T00:00:00Z',
    });
    insertBook(adapter, {
      id: 'b_finished',
      title: 'Done',
      createdAt: '2026-01-02T00:00:00Z',
    });
    insertSession(adapter, 's1', 'b_finished', 'finished');

    const result = suggestBooksForDestination(adapter, 'Mars', undefined, 10);
    const ids = result.map((r) => r.bookId);
    expect(ids).toContain('b_new');
    expect(ids).toContain('b_old');
    expect(ids).not.toContain('b_finished');
  });

  it('getRoadTripReadingList sizes list as floor(days/3), min 1, max 10', () => {
    createBooksTables(adapter);
    for (let i = 0; i < 15; i++) {
      insertBook(adapter, {
        id: 'b' + i,
        title: 'Book ' + i,
        createdAt: '2026-01-' + String(i + 1).padStart(2, '0') + 'T00:00:00Z',
      });
    }
    // 2 days -> floor(2/3) = 0 -> clamp to 1
    expect(getRoadTripReadingList(adapter, 2)).toHaveLength(1);
    // 9 days -> 3
    expect(getRoadTripReadingList(adapter, 9)).toHaveLength(3);
    // 45 days -> 15 but capped at 10
    expect(getRoadTripReadingList(adapter, 45)).toHaveLength(10);
  });

  it('getRoadTripReadingList excludes finished books', () => {
    createBooksTables(adapter);
    insertBook(adapter, { id: 'b1', title: 'One' });
    insertBook(adapter, { id: 'b2', title: 'Two' });
    insertSession(adapter, 's1', 'b1', 'finished');
    insertSession(adapter, 's2', 'b2', 'want_to_read');
    const list = getRoadTripReadingList(adapter, 30);
    const ids = list.map((l) => l.bookId);
    expect(ids).toContain('b2');
    expect(ids).not.toContain('b1');
  });
});
