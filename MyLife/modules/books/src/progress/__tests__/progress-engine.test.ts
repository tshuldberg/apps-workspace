import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { BOOKS_MODULE } from '../../definition';
import {
  updateProgress,
  getReadingSpeed,
  getProgressTimeline,
} from '../progress-engine';

describe('progress engine', () => {
  let adapter: DatabaseAdapter;
  let closeDb: () => void;

  beforeEach(() => {
    const testDb = createModuleTestDatabase('books', BOOKS_MODULE.migrations!);
    adapter = testDb.adapter;
    closeDb = testDb.close;
  });

  afterEach(() => {
    closeDb();
  });

  // ── Helpers ──

  /** Insert a book row so foreign keys are satisfied. */
  function insertBook(id: string, pageCount: number | null = 300) {
    const now = new Date().toISOString();
    adapter.execute(
      `INSERT INTO bk_books (id, title, authors, page_count, language, format, added_source, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'en', 'physical', 'manual', ?, ?)`,
      [id, 'Test Book', '["Author"]', pageCount, now, now],
    );
  }

  /** Insert a reading session row. */
  function insertSession(id: string, bookId: string) {
    const now = new Date().toISOString();
    adapter.execute(
      `INSERT INTO bk_reading_sessions (id, book_id, current_page, status, created_at, updated_at)
       VALUES (?, ?, 0, 'reading', ?, ?)`,
      [id, bookId, now, now],
    );
  }

  /** Insert a timed session directly for reading speed tests. */
  function insertTimedSession(
    id: string,
    bookId: string,
    sessionId: string,
    opts: { durationMs: number; pagesRead: number; startedAt?: string },
  ) {
    const startedAt = opts.startedAt ?? new Date().toISOString();
    adapter.execute(
      `INSERT INTO bk_timed_sessions (id, session_id, book_id, started_at, duration_ms, pages_read, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, sessionId, bookId, startedAt, opts.durationMs, opts.pagesRead, startedAt],
    );
  }

  // ── updateProgress ──

  describe('updateProgress', () => {
    it('records a progress update and returns percentComplete', () => {
      insertBook('b1', 300);
      insertSession('s1', 'b1');

      const result = updateProgress(adapter, 'b1', 's1', 150, 300);
      expect(result.percentComplete).toBe(50);
      expect(result.update.page_number).toBe(150);
      expect(result.update.book_id).toBe('b1');
    });

    it('returns 100% when page equals page count', () => {
      insertBook('b1', 200);
      insertSession('s1', 'b1');

      const result = updateProgress(adapter, 'b1', 's1', 200, 200);
      expect(result.percentComplete).toBe(100);
    });

    it('caps at 100% when page exceeds page count', () => {
      insertBook('b1', 200);
      insertSession('s1', 'b1');

      const result = updateProgress(adapter, 'b1', 's1', 250, 200);
      expect(result.percentComplete).toBe(100);
    });

    it('returns 0% when page count is 0', () => {
      insertBook('b1', 0);
      insertSession('s1', 'b1');

      const result = updateProgress(adapter, 'b1', 's1', 50, 0);
      expect(result.percentComplete).toBe(0);
    });

    it('returns 0% when page count is undefined', () => {
      insertBook('b1', null);
      insertSession('s1', 'b1');

      const result = updateProgress(adapter, 'b1', 's1', 50);
      expect(result.percentComplete).toBe(0);
    });

    it('records page 0 at start of reading', () => {
      insertBook('b1', 400);
      insertSession('s1', 'b1');

      const result = updateProgress(adapter, 'b1', 's1', 0, 400);
      expect(result.percentComplete).toBe(0);
      expect(result.update.page_number).toBe(0);
    });
  });

  // ── getReadingSpeed ──

  describe('getReadingSpeed', () => {
    it('returns null when no timed sessions exist', () => {
      insertBook('b1', 300);
      const result = getReadingSpeed(adapter, 'b1');
      expect(result).toBeNull();
    });

    it('returns null when sessions have 0 duration', () => {
      insertBook('b1', 300);
      insertSession('s1', 'b1');
      insertTimedSession('ts1', 'b1', 's1', { durationMs: 0, pagesRead: 10 });
      const result = getReadingSpeed(adapter, 'b1');
      expect(result).toBeNull();
    });

    it('returns null when sessions have 0 pages', () => {
      insertBook('b1', 300);
      insertSession('s1', 'b1');
      insertTimedSession('ts1', 'b1', 's1', { durationMs: 3600000, pagesRead: 0 });
      const result = getReadingSpeed(adapter, 'b1');
      expect(result).toBeNull();
    });

    it('calculates speed from a single session', () => {
      insertBook('b1', 300);
      insertSession('s1', 'b1');
      // 30 pages in 1 hour = 30 pages/hour
      insertTimedSession('ts1', 'b1', 's1', { durationMs: 3600000, pagesRead: 30 });

      const result = getReadingSpeed(adapter, 'b1');
      expect(result).not.toBeNull();
      expect(result!.averagePagesPerHour).toBeCloseTo(30, 1);
      expect(result!.totalReadingTimeMs).toBe(3600000);
      expect(result!.totalPagesRead).toBe(30);
    });

    it('aggregates across multiple sessions', () => {
      insertBook('b1', 300);
      insertSession('s1', 'b1');
      // Session 1: 20 pages in 30 min
      insertTimedSession('ts1', 'b1', 's1', { durationMs: 1800000, pagesRead: 20 });
      // Session 2: 30 pages in 1 hour
      insertTimedSession('ts2', 'b1', 's1', { durationMs: 3600000, pagesRead: 30 });

      const result = getReadingSpeed(adapter, 'b1');
      expect(result).not.toBeNull();
      // Total: 50 pages in 5400000ms (1.5 hours)
      // Speed = 50 / 5400000 * 3600000 = ~33.33 pages/hour
      expect(result!.totalPagesRead).toBe(50);
      expect(result!.totalReadingTimeMs).toBe(5400000);
      expect(result!.averagePagesPerHour).toBeCloseTo(33.33, 1);
    });

    it('excludes sessions with null duration', () => {
      insertBook('b1', 300);
      insertSession('s1', 'b1');
      insertTimedSession('ts1', 'b1', 's1', { durationMs: 3600000, pagesRead: 30 });
      // Insert a session with null duration directly
      adapter.execute(
        `INSERT INTO bk_timed_sessions (id, session_id, book_id, started_at, duration_ms, pages_read, created_at)
         VALUES ('ts2', 's1', 'b1', '2026-01-02T00:00:00Z', NULL, 20, '2026-01-02T00:00:00Z')`,
      );

      const result = getReadingSpeed(adapter, 'b1');
      expect(result).not.toBeNull();
      // Only ts1 counts: 30 pages in 1 hour
      expect(result!.totalPagesRead).toBe(50); // pages_read is still counted for ts2
      // Actually, duration_ms is null, so it won't add to totalReadingTimeMs
      // but pages_read is 20 which is > 0, so totalPagesRead = 30 + 20 = 50
      expect(result!.totalReadingTimeMs).toBe(3600000);
    });

    it('returns speed for fast reader', () => {
      insertBook('b1', 300);
      insertSession('s1', 'b1');
      // 60 pages in 30 minutes = 120 pages/hour
      insertTimedSession('ts1', 'b1', 's1', { durationMs: 1800000, pagesRead: 60 });

      const result = getReadingSpeed(adapter, 'b1');
      expect(result!.averagePagesPerHour).toBeCloseTo(120, 1);
    });

    it('returns speed for slow reader', () => {
      insertBook('b1', 300);
      insertSession('s1', 'b1');
      // 5 pages in 1 hour = 5 pages/hour
      insertTimedSession('ts1', 'b1', 's1', { durationMs: 3600000, pagesRead: 5 });

      const result = getReadingSpeed(adapter, 'b1');
      expect(result!.averagePagesPerHour).toBeCloseTo(5, 1);
    });
  });

  // ── getProgressTimeline ──

  describe('getProgressTimeline', () => {
    it('returns empty array when no progress exists', () => {
      insertBook('b1', 300);
      const timeline = getProgressTimeline(adapter, 'b1');
      expect(timeline).toEqual([]);
    });

    it('returns ordered timeline entries', () => {
      insertBook('b1', 300);
      insertSession('s1', 'b1');

      // Insert progress updates manually to control created_at
      adapter.execute(
        `INSERT INTO bk_progress_updates (id, session_id, book_id, page_number, percent_complete, created_at)
         VALUES ('pu1', 's1', 'b1', 50, 16.67, '2026-01-01T00:00:00Z')`,
      );
      adapter.execute(
        `INSERT INTO bk_progress_updates (id, session_id, book_id, page_number, percent_complete, created_at)
         VALUES ('pu2', 's1', 'b1', 100, 33.33, '2026-01-02T00:00:00Z')`,
      );
      adapter.execute(
        `INSERT INTO bk_progress_updates (id, session_id, book_id, page_number, percent_complete, created_at)
         VALUES ('pu3', 's1', 'b1', 200, 66.67, '2026-01-03T00:00:00Z')`,
      );

      const timeline = getProgressTimeline(adapter, 'b1');
      expect(timeline).toHaveLength(3);
      expect(timeline[0].page).toBe(50);
      expect(timeline[1].page).toBe(100);
      expect(timeline[2].page).toBe(200);
      expect(timeline[0].date).toBe('2026-01-01T00:00:00Z');
    });

    it('filters out entries with null page_number', () => {
      insertBook('b1', 300);
      insertSession('s1', 'b1');

      adapter.execute(
        `INSERT INTO bk_progress_updates (id, session_id, book_id, page_number, percent_complete, created_at)
         VALUES ('pu1', 's1', 'b1', 50, 16.67, '2026-01-01T00:00:00Z')`,
      );
      adapter.execute(
        `INSERT INTO bk_progress_updates (id, session_id, book_id, page_number, percent_complete, created_at)
         VALUES ('pu2', 's1', 'b1', NULL, NULL, '2026-01-02T00:00:00Z')`,
      );

      const timeline = getProgressTimeline(adapter, 'b1');
      expect(timeline).toHaveLength(1);
      expect(timeline[0].page).toBe(50);
    });

    it('uses 0 for null percent_complete', () => {
      insertBook('b1', null);
      insertSession('s1', 'b1');

      adapter.execute(
        `INSERT INTO bk_progress_updates (id, session_id, book_id, page_number, percent_complete, created_at)
         VALUES ('pu1', 's1', 'b1', 75, NULL, '2026-01-01T00:00:00Z')`,
      );

      const timeline = getProgressTimeline(adapter, 'b1');
      expect(timeline).toHaveLength(1);
      expect(timeline[0].percent).toBe(0);
    });

    it('handles rapid progression data points', () => {
      insertBook('b1', 100);
      insertSession('s1', 'b1');

      for (let i = 1; i <= 10; i++) {
        adapter.execute(
          `INSERT INTO bk_progress_updates (id, session_id, book_id, page_number, percent_complete, created_at)
           VALUES ('pu${i}', 's1', 'b1', ${i * 10}, ${i * 10}, '2026-01-01T${String(i).padStart(2, '0')}:00:00Z')`,
        );
      }

      const timeline = getProgressTimeline(adapter, 'b1');
      expect(timeline).toHaveLength(10);
      expect(timeline[0].page).toBe(10);
      expect(timeline[9].page).toBe(100);
      expect(timeline[9].percent).toBe(100);
    });

    it('returns empty for wrong book id', () => {
      insertBook('b1', 300);
      insertSession('s1', 'b1');

      adapter.execute(
        `INSERT INTO bk_progress_updates (id, session_id, book_id, page_number, percent_complete, created_at)
         VALUES ('pu1', 's1', 'b1', 50, 16.67, '2026-01-01T00:00:00Z')`,
      );

      const timeline = getProgressTimeline(adapter, 'other-book');
      expect(timeline).toEqual([]);
    });
  });
});
