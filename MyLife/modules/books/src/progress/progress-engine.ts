/**
 * Higher-level progress tracking engine.
 */

import type { DatabaseAdapter } from '@mylife/db';
import type { ProgressUpdate } from '../models/schemas';
import { createProgressUpdate } from '../db/progress-updates';
import { getTimedSessionsForBook } from '../db/timed-sessions';
import { getProgressHistory } from '../db/progress-updates';
import type { ReadingSpeed, ProgressTimelineEntry } from './types';

/**
 * Record a progress update and calculate percent complete.
 */
export function updateProgress(
  db: DatabaseAdapter,
  bookId: string,
  sessionId: string,
  pageNumber: number,
  pageCount?: number,
): { update: ProgressUpdate; percentComplete: number } {
  const percentComplete = pageCount && pageCount > 0
    ? Math.min(100, (pageNumber / pageCount) * 100)
    : 0;

  const id = crypto.randomUUID();
  const update = createProgressUpdate(db, id, {
    session_id: sessionId,
    book_id: bookId,
    page_number: pageNumber,
    percent_complete: percentComplete > 0 ? percentComplete : null,
  });

  return { update, percentComplete };
}

/**
 * Aggregate reading speed from all timed sessions for a book.
 */
export function getReadingSpeed(
  db: DatabaseAdapter,
  bookId: string,
): ReadingSpeed | null {
  const sessions = getTimedSessionsForBook(db, bookId);

  let totalReadingTimeMs = 0;
  let totalPagesRead = 0;

  for (const session of sessions) {
    if (session.duration_ms != null && session.duration_ms > 0) {
      totalReadingTimeMs += session.duration_ms;
    }
    if (session.pages_read != null && session.pages_read > 0) {
      totalPagesRead += session.pages_read;
    }
  }

  if (totalReadingTimeMs === 0 || totalPagesRead === 0) {
    return null;
  }

  const averagePagesPerHour = (totalPagesRead / totalReadingTimeMs) * 3_600_000;

  return {
    averagePagesPerHour,
    totalReadingTimeMs,
    totalPagesRead,
  };
}

/**
 * Build a progress timeline for charting progress over time.
 */
export function getProgressTimeline(
  db: DatabaseAdapter,
  bookId: string,
): ProgressTimelineEntry[] {
  const history = getProgressHistory(db, bookId);

  return history
    .filter((u) => u.page_number != null)
    .map((u) => ({
      date: u.created_at,
      page: u.page_number!,
      percent: u.percent_complete ?? 0,
    }));
}
