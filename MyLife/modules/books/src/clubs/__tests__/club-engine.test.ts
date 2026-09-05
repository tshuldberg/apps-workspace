import { describe, it, expect } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createClub, getClub, deactivateClub, deleteClub } from '../../db/clubs';
import { createClubNote, getNotesForClub } from '../../db/club-notes';
import { createClubHistory, getHistoryForClub } from '../../db/club-history';
import { setNextBook, daysRemaining, getClubProgress } from '../club-engine';

// ── Mock Database ──

function createMockDb(queryResults: Record<string, any[]> = {}) {
  const executed: Array<{ sql: string; params: unknown[] }> = [];
  return {
    db: {
      query: <T>(sql: string, params?: unknown[]): T[] => {
        for (const [pattern, result] of Object.entries(queryResults)) {
          if (sql.includes(pattern)) return result as T[];
        }
        return [] as T[];
      },
      execute: (sql: string, params?: unknown[]) => {
        executed.push({ sql, params: params ?? [] });
      },
      transaction: (fn: () => void) => fn(),
    } as DatabaseAdapter,
    executed,
  };
}

describe('club CRUD', () => {
  it('creates a club with name and description', () => {
    const { db, executed } = createMockDb();
    const club = createClub(db, 'club-1', {
      name: 'Sci-Fi Readers',
      description: 'We read sci-fi books',
    });

    expect(club.id).toBe('club-1');
    expect(club.name).toBe('Sci-Fi Readers');
    expect(club.description).toBe('We read sci-fi books');
    expect(club.mode).toBe('local');
    expect(club.is_active).toBe(1);
    expect(club.current_book_id).toBeNull();
    expect(executed).toHaveLength(1);
    expect(executed[0].sql).toContain('INSERT INTO bk_book_clubs');
  });

  it('creates a club with only name (minimal)', () => {
    const { db } = createMockDb();
    const club = createClub(db, 'club-2', {
      name: 'Book Buddies',
    });

    expect(club.name).toBe('Book Buddies');
    expect(club.description).toBeNull();
    expect(club.current_book_id).toBeNull();
    expect(club.reading_start_date).toBeNull();
    expect(club.reading_end_date).toBeNull();
    expect(club.mode).toBe('local');
  });

  it('adds a note to a club', () => {
    const { db, executed } = createMockDb();
    const note = createClubNote(db, 'note-1', {
      club_id: 'club-1',
      book_id: 'book-1',
      content: 'Great first chapter discussion!',
      note_type: 'discussion',
    });

    expect(note.id).toBe('note-1');
    expect(note.club_id).toBe('club-1');
    expect(note.book_id).toBe('book-1');
    expect(note.content).toBe('Great first chapter discussion!');
    expect(note.note_type).toBe('discussion');
    expect(executed).toHaveLength(1);
    expect(executed[0].sql).toContain('INSERT INTO bk_club_notes');
  });

  it('deactivates a club', () => {
    const { db, executed } = createMockDb();
    deactivateClub(db, 'club-1');

    expect(executed).toHaveLength(1);
    expect(executed[0].sql).toContain('UPDATE bk_book_clubs SET is_active = 0');
    expect(executed[0].params[1]).toBe('club-1');
  });

  it('deletes a club', () => {
    const { db, executed } = createMockDb();
    deleteClub(db, 'club-1');

    expect(executed).toHaveLength(1);
    expect(executed[0].sql).toContain('DELETE FROM bk_book_clubs');
    expect(executed[0].params[0]).toBe('club-1');
  });

  it('handles null current_book_id (club with deleted book)', () => {
    const { db } = createMockDb({
      'bk_book_clubs': [{
        id: 'club-1',
        name: 'Test Club',
        description: null,
        current_book_id: null,
        reading_start_date: null,
        reading_end_date: null,
        mode: 'local',
        is_active: 1,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
      }],
    });

    const club = getClub(db, 'club-1');
    expect(club).not.toBeNull();
    expect(club!.current_book_id).toBeNull();
  });
});

describe('club engine', () => {
  it('setNextBook archives current book and updates to new book', () => {
    const { db, executed } = createMockDb({
      'bk_book_clubs': [{
        id: 'club-1',
        name: 'Test Club',
        description: null,
        current_book_id: 'old-book',
        reading_start_date: '2026-01-01T00:00:00.000Z',
        reading_end_date: '2026-01-31T00:00:00.000Z',
        mode: 'local',
        is_active: 1,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
      }],
    });

    setNextBook(db, 'club-1', 'new-book', '2026-02-01', '2026-02-28');

    // Should have two executions: one INSERT into history, one UPDATE for new book
    expect(executed).toHaveLength(2);
    expect(executed[0].sql).toContain('INSERT INTO bk_club_history');
    expect(executed[0].params).toContain('old-book');
    expect(executed[1].sql).toContain('UPDATE bk_book_clubs SET');
    expect(executed[1].params).toContain('new-book');
  });

  it('setNextBook with no current book creates no history', () => {
    const { db, executed } = createMockDb({
      'bk_book_clubs': [{
        id: 'club-1',
        name: 'Test Club',
        description: null,
        current_book_id: null,
        reading_start_date: null,
        reading_end_date: null,
        mode: 'local',
        is_active: 1,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
      }],
    });

    setNextBook(db, 'club-1', 'first-book');

    // Should have only one execution: UPDATE for new book, no history INSERT
    expect(executed).toHaveLength(1);
    expect(executed[0].sql).toContain('UPDATE bk_book_clubs SET');
    expect(executed[0].params).toContain('first-book');
  });

  it('getClubHistory returns previously read books', () => {
    const { db } = createMockDb({
      'bk_club_history': [
        {
          id: 'h-2',
          club_id: 'club-1',
          book_id: 'book-2',
          started_at: '2026-02-01',
          finished_at: '2026-02-15',
          created_at: '2026-02-15T00:00:00.000Z',
        },
        {
          id: 'h-1',
          club_id: 'club-1',
          book_id: 'book-1',
          started_at: '2026-01-01',
          finished_at: '2026-01-31',
          created_at: '2026-01-31T00:00:00.000Z',
        },
      ],
    });

    const history = getHistoryForClub(db, 'club-1');
    expect(history).toHaveLength(2);
    expect(history[0].book_id).toBe('book-2');
    expect(history[1].book_id).toBe('book-1');
  });
});

describe('daysRemaining', () => {
  it('returns positive days for future date', () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 5);
    const result = daysRemaining(futureDate.toISOString());

    expect(result.days).toBeGreaterThan(0);
    expect(result.isOverdue).toBe(false);
  });

  it('returns negative days and isOverdue for past date', () => {
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 5);
    const result = daysRemaining(pastDate.toISOString());

    expect(result.days).toBeLessThan(0);
    expect(result.isOverdue).toBe(true);
  });

  it('returns null days and not overdue for null input', () => {
    const result = daysRemaining(null);

    expect(result.days).toBeNull();
    expect(result.isOverdue).toBe(false);
  });
});
