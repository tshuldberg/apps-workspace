import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { BOOKS_MODULE } from '../../definition';
import { createBook } from '../../db/books';
import { computeInsights } from '../insights-engine';
import { computeGenreEvolution } from '../genre-evolution';
import { getOnThisDay } from '../on-this-day';
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

function addTimedSession(
  db: DatabaseAdapter,
  bookId: string,
  sessionId: string,
  opts: { startedAt: string; durationMs: number; pagesRead: number },
) {
  const id = crypto.randomUUID();
  db.execute(
    `INSERT INTO bk_timed_sessions (id, session_id, book_id, started_at, ended_at, duration_ms, pages_read, pages_per_hour, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    [
      id,
      sessionId,
      bookId,
      opts.startedAt,
      opts.startedAt,
      opts.durationMs,
      opts.pagesRead,
      opts.pagesRead / (opts.durationMs / 3_600_000),
    ],
  );
}

function addReadingSession(
  db: DatabaseAdapter,
  bookId: string,
  status: string,
  opts: { startedAt?: string; finishedAt?: string } = {},
) {
  const id = crypto.randomUUID();
  db.execute(
    `INSERT INTO bk_reading_sessions (id, book_id, status, current_page, started_at, finished_at, created_at, updated_at)
     VALUES (?, ?, ?, 0, ?, ?, datetime('now'), datetime('now'))`,
    [id, bookId, status, opts.startedAt ?? null, opts.finishedAt ?? null],
  );
  return id;
}

beforeEach(() => {
  const testDb = createModuleTestDatabase('books', BOOKS_MODULE.migrations!);
  adapter = testDb.adapter;
  closeDb = testDb.close;
});

afterEach(() => {
  closeDb();
});

describe('computeInsights', () => {
  it('returns insufficient data when fewer than 5 books', () => {
    createBook(adapter, crypto.randomUUID(), makeBook());
    const result = computeInsights(adapter);
    expect(result.insufficientData).toBe(true);
    expect(result.insights).toHaveLength(0);
  });

  it('returns insights when enough data exists', () => {
    // Create 6 books with sessions
    for (let i = 0; i < 6; i++) {
      const bookId = crypto.randomUUID();
      createBook(adapter, bookId, makeBook({
        title: `Book ${i}`,
        subjects: '["fiction", "drama"]',
      }));
      const sessionId = addReadingSession(adapter, bookId, i < 5 ? 'finished' : 'reading', {
        startedAt: `2025-0${i + 1}-15T10:00:00.000Z`,
        finishedAt: i < 5 ? `2025-0${i + 1}-20T10:00:00.000Z` : undefined,
      });
      addTimedSession(adapter, bookId, sessionId, {
        startedAt: `2025-0${i + 1}-15T10:00:00.000Z`,
        durationMs: 3_600_000,
        pagesRead: 50,
      });
    }

    const result = computeInsights(adapter);
    expect(result.insufficientData).toBe(false);
    expect(result.insights.length).toBeGreaterThan(0);
    expect(result.computedAt).toBeTruthy();
  });

  it('detects genre diversity', () => {
    const genres = ['fiction', 'science', 'history', 'philosophy', 'poetry', 'biography'];
    for (let i = 0; i < 6; i++) {
      const bookId = crypto.randomUUID();
      createBook(adapter, bookId, makeBook({
        title: `Book ${i}`,
        subjects: JSON.stringify([genres[i]]),
      }));
      addReadingSession(adapter, bookId, 'finished', {
        startedAt: `2025-0${i + 1}-01T10:00:00.000Z`,
        finishedAt: `2025-0${i + 1}-10T10:00:00.000Z`,
      });
    }

    const result = computeInsights(adapter);
    const diversityInsight = result.insights.find((i) => i.id === 'genre_diversity');
    expect(diversityInsight).toBeDefined();
    expect(diversityInsight!.value).toBe(6);
  });

  it('detects completion rate', () => {
    for (let i = 0; i < 6; i++) {
      const bookId = crypto.randomUUID();
      createBook(adapter, bookId, makeBook({ title: `Book ${i}` }));
      addReadingSession(adapter, bookId, i < 4 ? 'finished' : 'reading', {
        startedAt: `2025-01-0${i + 1}T10:00:00.000Z`,
        finishedAt: i < 4 ? `2025-01-1${i}T10:00:00.000Z` : undefined,
      });
    }

    const result = computeInsights(adapter);
    const completionInsight = result.insights.find((i) => i.id === 'completion_rate');
    expect(completionInsight).toBeDefined();
    expect(completionInsight!.value).toBe(67);
  });
});

describe('computeGenreEvolution', () => {
  it('returns empty timeline with no data', () => {
    const result = computeGenreEvolution(adapter);
    expect(result.periods).toHaveLength(0);
    expect(result.dominantGenreShifts).toHaveLength(0);
  });

  it('tracks genre distribution across years', () => {
    // Year 1: mostly fiction
    for (let i = 0; i < 3; i++) {
      const bookId = crypto.randomUUID();
      createBook(adapter, bookId, makeBook({
        title: `Fiction ${i}`,
        subjects: '["fiction"]',
      }));
      addReadingSession(adapter, bookId, 'finished', {
        startedAt: `2024-0${i + 1}-01T10:00:00.000Z`,
        finishedAt: `2024-0${i + 1}-15T10:00:00.000Z`,
      });
    }

    // Year 2: mostly science
    for (let i = 0; i < 3; i++) {
      const bookId = crypto.randomUUID();
      createBook(adapter, bookId, makeBook({
        title: `Science ${i}`,
        subjects: '["science"]',
      }));
      addReadingSession(adapter, bookId, 'finished', {
        startedAt: `2025-0${i + 1}-01T10:00:00.000Z`,
        finishedAt: `2025-0${i + 1}-15T10:00:00.000Z`,
      });
    }

    const result = computeGenreEvolution(adapter);
    expect(result.periods).toHaveLength(2);
    expect(result.periods[0].year).toBe(2024);
    expect(result.periods[0].genres[0].genre).toBe('fiction');
    expect(result.periods[1].year).toBe(2025);
    expect(result.periods[1].genres[0].genre).toBe('science');
    expect(result.dominantGenreShifts).toHaveLength(1);
    expect(result.dominantGenreShifts[0]).toEqual({
      from: 'fiction',
      to: 'science',
      period: '2025',
    });
  });
});

describe('getOnThisDay', () => {
  it('returns empty array with no matching events', () => {
    const result = getOnThisDay(adapter, '01-01');
    expect(result).toHaveLength(0);
  });

  it('finds books started on matching date in prior years', () => {
    const bookId = crypto.randomUUID();
    createBook(adapter, bookId, makeBook({ title: 'Anniversary Book' }));
    addReadingSession(adapter, bookId, 'finished', {
      startedAt: '2024-03-24T10:00:00.000Z',
      finishedAt: '2024-04-01T10:00:00.000Z',
    });

    const result = getOnThisDay(adapter, '03-24');
    expect(result.length).toBeGreaterThan(0);
    const startedEvent = result.find((e) => e.type === 'started');
    expect(startedEvent).toBeDefined();
    expect(startedEvent!.bookTitle).toBe('Anniversary Book');
    expect(startedEvent!.year).toBe(2024);
  });

  it('finds books finished on matching date', () => {
    const bookId = crypto.randomUUID();
    createBook(adapter, bookId, makeBook({ title: 'Finished Today' }));
    addReadingSession(adapter, bookId, 'finished', {
      startedAt: '2023-03-01T10:00:00.000Z',
      finishedAt: '2023-06-15T10:00:00.000Z',
    });

    const result = getOnThisDay(adapter, '06-15');
    const finishedEvent = result.find((e) => e.type === 'finished');
    expect(finishedEvent).toBeDefined();
    expect(finishedEvent!.bookTitle).toBe('Finished Today');
  });
});
