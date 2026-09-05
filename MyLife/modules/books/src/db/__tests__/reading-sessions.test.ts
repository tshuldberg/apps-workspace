import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { BOOKS_MODULE } from '../../definition';
import {
  createSession,
  getSession,
  getSessions,
  getSessionsForBook,
  updateSession,
  startReading,
  finishReading,
  markDNF,
  getCurrentlyReading,
} from '../reading-sessions';
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
  createBook(adapter, 'book-1', makeBook());
});

afterEach(() => {
  closeDb();
});

describe('createSession', () => {
  it('creates a session with default status', () => {
    const session = createSession(adapter, 'session-1', { book_id: 'book-1' });
    expect(session.id).toBe('session-1');
    expect(session.book_id).toBe('book-1');
    expect(session.status).toBe('want_to_read');
    expect(session.current_page).toBe(0);
  });

  it('sets timestamps', () => {
    const session = createSession(adapter, 'session-1', { book_id: 'book-1' });
    expect(session.created_at).toBeTruthy();
    expect(session.updated_at).toBeTruthy();
  });

  it('accepts explicit status', () => {
    const session = createSession(adapter, 'session-1', {
      book_id: 'book-1',
      status: 'reading',
      started_at: '2026-01-01T00:00:00.000Z',
    });
    expect(session.status).toBe('reading');
    expect(session.started_at).toBe('2026-01-01T00:00:00.000Z');
  });
});

describe('getSession', () => {
  it('retrieves by ID', () => {
    createSession(adapter, 'session-1', { book_id: 'book-1' });
    const found = getSession(adapter, 'session-1');
    expect(found).not.toBeNull();
    expect(found!.book_id).toBe('book-1');
  });

  it('returns null for non-existent session', () => {
    expect(getSession(adapter, 'nope')).toBeNull();
  });
});

describe('getSessions', () => {
  it('returns all sessions', () => {
    createSession(adapter, 'session-1', { book_id: 'book-1' });
    createBook(adapter, 'book-2', makeBook({ title: 'Book 2' }));
    createSession(adapter, 'session-2', { book_id: 'book-2' });

    const sessions = getSessions(adapter);
    expect(sessions).toHaveLength(2);
  });

  it('filters by status', () => {
    createSession(adapter, 'session-1', { book_id: 'book-1', status: 'reading' });
    createBook(adapter, 'book-2', makeBook({ title: 'Book 2' }));
    createSession(adapter, 'session-2', { book_id: 'book-2', status: 'want_to_read' });

    const reading = getSessions(adapter, { status: 'reading' });
    expect(reading).toHaveLength(1);
    expect(reading[0].status).toBe('reading');
  });

  it('supports limit', () => {
    createSession(adapter, 'session-1', { book_id: 'book-1' });
    createBook(adapter, 'book-2', makeBook({ title: 'Book 2' }));
    createSession(adapter, 'session-2', { book_id: 'book-2' });

    const sessions = getSessions(adapter, { limit: 1 });
    expect(sessions).toHaveLength(1);
  });
});

describe('getSessionsForBook', () => {
  it('returns sessions for a specific book', () => {
    createSession(adapter, 'session-1', { book_id: 'book-1' });
    createSession(adapter, 'session-2', { book_id: 'book-1' });
    createBook(adapter, 'book-2', makeBook({ title: 'Other' }));
    createSession(adapter, 'session-3', { book_id: 'book-2' });

    const sessions = getSessionsForBook(adapter, 'book-1');
    expect(sessions).toHaveLength(2);
  });
});

describe('updateSession', () => {
  it('updates current_page', () => {
    createSession(adapter, 'session-1', { book_id: 'book-1' });
    updateSession(adapter, 'session-1', { current_page: 50 });
    const session = getSession(adapter, 'session-1');
    expect(session!.current_page).toBe(50);
  });

  it('updates status', () => {
    createSession(adapter, 'session-1', { book_id: 'book-1' });
    updateSession(adapter, 'session-1', { status: 'reading' });
    expect(getSession(adapter, 'session-1')!.status).toBe('reading');
  });

  it('does nothing for empty updates', () => {
    createSession(adapter, 'session-1', { book_id: 'book-1' });
    updateSession(adapter, 'session-1', {});
    expect(getSession(adapter, 'session-1')!.status).toBe('want_to_read');
  });
});

describe('startReading', () => {
  it('sets status to reading and records started_at', () => {
    createSession(adapter, 'session-1', { book_id: 'book-1' });
    startReading(adapter, 'session-1');
    const session = getSession(adapter, 'session-1');
    expect(session!.status).toBe('reading');
    expect(session!.started_at).toBeTruthy();
  });
});

describe('finishReading', () => {
  it('sets status to finished and records finished_at', () => {
    createSession(adapter, 'session-1', { book_id: 'book-1', status: 'reading' });
    finishReading(adapter, 'session-1');
    const session = getSession(adapter, 'session-1');
    expect(session!.status).toBe('finished');
    expect(session!.finished_at).toBeTruthy();
  });
});

describe('markDNF', () => {
  it('sets status to dnf', () => {
    createSession(adapter, 'session-1', { book_id: 'book-1', status: 'reading' });
    markDNF(adapter, 'session-1');
    expect(getSession(adapter, 'session-1')!.status).toBe('dnf');
  });

  it('records the dnf reason', () => {
    createSession(adapter, 'session-1', { book_id: 'book-1', status: 'reading' });
    markDNF(adapter, 'session-1', 'Too boring');
    const session = getSession(adapter, 'session-1');
    expect(session!.dnf_reason).toBe('Too boring');
  });

  it('sets null reason when not provided', () => {
    createSession(adapter, 'session-1', { book_id: 'book-1', status: 'reading' });
    markDNF(adapter, 'session-1');
    expect(getSession(adapter, 'session-1')!.dnf_reason).toBeNull();
  });
});

describe('getCurrentlyReading', () => {
  it('returns only reading sessions', () => {
    createSession(adapter, 'session-1', { book_id: 'book-1', status: 'reading' });
    createBook(adapter, 'book-2', makeBook({ title: 'Book 2' }));
    createSession(adapter, 'session-2', { book_id: 'book-2', status: 'want_to_read' });
    createBook(adapter, 'book-3', makeBook({ title: 'Book 3' }));
    createSession(adapter, 'session-3', { book_id: 'book-3', status: 'finished' });

    const current = getCurrentlyReading(adapter);
    expect(current).toHaveLength(1);
    expect(current[0].id).toBe('session-1');
  });

  it('returns empty array when nothing is being read', () => {
    createSession(adapter, 'session-1', { book_id: 'book-1', status: 'want_to_read' });
    expect(getCurrentlyReading(adapter)).toHaveLength(0);
  });
});
