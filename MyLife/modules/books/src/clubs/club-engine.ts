/**
 * Club engine -- higher-level club management and progress tracking.
 */

import type { DatabaseAdapter } from '@mylife/db';
import { getClub, setCurrentBook } from '../db/clubs';
import { getClubMembers } from '../db/club-members';
import { createClubHistory } from '../db/club-history';
import type { ClubWithProgress } from './types';

/**
 * Set the next book for a club. Archives the current book to history
 * (if one exists) before updating the club's current book.
 */
export function setNextBook(
  db: DatabaseAdapter,
  clubId: string,
  newBookId: string,
  startDate?: string,
  endDate?: string,
): void {
  const club = getClub(db, clubId);
  if (!club) return;

  // Archive current book if one exists
  if (club.current_book_id) {
    const historyId = crypto.randomUUID();
    createClubHistory(db, historyId, {
      club_id: clubId,
      book_id: club.current_book_id,
      started_at: club.reading_start_date,
      finished_at: new Date().toISOString(),
    });
  }

  // Update to the new book
  setCurrentBook(db, clubId, newBookId, startDate, endDate);
}

/**
 * Compute days remaining and overdue status from an end date.
 */
export function daysRemaining(
  endDate: string | null,
): { days: number | null; isOverdue: boolean } {
  if (!endDate) {
    return { days: null, isOverdue: false };
  }

  const end = new Date(endDate).getTime();
  const now = Date.now();
  const msPerDay = 1000 * 60 * 60 * 24;
  const days = Math.ceil((end - now) / msPerDay);

  return {
    days,
    isOverdue: days < 0,
  };
}

/**
 * Assemble the full club progress view including current book info
 * and reading progress.
 */
export function getClubProgress(
  db: DatabaseAdapter,
  clubId: string,
): ClubWithProgress | null {
  const club = getClub(db, clubId);
  if (!club) return null;

  let currentBookTitle: string | null = null;
  let currentBookCoverUrl: string | null = null;
  let readingProgress: number | null = null;

  if (club.current_book_id) {
    // Get book info
    const books = db.query<{ title: string; cover_url: string | null; page_count: number | null }>(
      `SELECT title, cover_url, page_count FROM bk_books WHERE id = ?`,
      [club.current_book_id],
    );
    if (books.length > 0) {
      currentBookTitle = books[0].title;
      currentBookCoverUrl = books[0].cover_url;

      // Get reading progress from reading sessions
      const sessions = db.query<{ current_page: number }>(
        `SELECT current_page FROM bk_reading_sessions WHERE book_id = ? ORDER BY updated_at DESC LIMIT 1`,
        [club.current_book_id],
      );
      if (sessions.length > 0 && books[0].page_count && books[0].page_count > 0) {
        readingProgress = Math.min(
          Math.round((sessions[0].current_page / books[0].page_count) * 100),
          100,
        );
      }
    }
  }

  const remaining = daysRemaining(club.reading_end_date);
  const members = getClubMembers(db, clubId);

  return {
    club,
    currentBookTitle,
    currentBookCoverUrl,
    daysRemaining: remaining.days,
    isOverdue: remaining.isOverdue,
    readingProgress,
    members,
  };
}
