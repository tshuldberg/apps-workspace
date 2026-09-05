/**
 * Daily notes engine for MyNotes.
 * Manages one-note-per-day creation, retrieval, and date navigation.
 */

import type { DatabaseAdapter } from '@mylife/db';
import type { Note } from '../types';
import { countWords } from '../engine/markdown';

export type DailyTitleFormat = 'YYYY-MM-DD' | 'MMM D, YYYY' | 'dddd, MMMM D';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Format a date string (YYYY-MM-DD) into a human-readable title.
 */
export function formatDailyTitle(isoDate: string, format: DailyTitleFormat = 'YYYY-MM-DD'): string {
  if (format === 'YYYY-MM-DD') return isoDate;

  const [yearStr, monthStr, dayStr] = isoDate.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10) - 1;
  const day = parseInt(dayStr, 10);
  const date = new Date(year, month, day);

  if (format === 'MMM D, YYYY') {
    return `${MONTHS_SHORT[month]} ${day}, ${year}`;
  }

  // 'dddd, MMMM D'
  return `${DAYS[date.getDay()]}, ${MONTHS[month]} ${day}`;
}

/**
 * Get today's date as an ISO string (YYYY-MM-DD) in local time.
 */
export function getTodayIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Get or create a daily note for a given date.
 * Uses a transaction to prevent duplicates.
 */
export function getOrCreateDailyNote(
  db: DatabaseAdapter,
  date: string,
  options?: {
    templateBody?: string;
    folderId?: string | null;
    titleFormat?: DailyTitleFormat;
  },
): Note {
  // Check if a daily note already exists for this date
  const existing = db.query<Record<string, unknown>>(
    `SELECT * FROM nt_notes WHERE daily_date = ?`,
    [date],
  );

  if (existing.length > 0) {
    const row = existing[0];
    return {
      id: row.id as string,
      title: row.title as string,
      body: row.body as string,
      folderId: (row.folder_id as string) ?? null,
      isPinned: (row.is_pinned as number) === 1,
      isFavorite: (row.is_favorite as number) === 1,
      wordCount: row.word_count as number,
      charCount: row.char_count as number,
      isDailyNote: true,
      dailyDate: date,
      sourceUrl: (row.source_url as string) ?? null,
      clippedAt: (row.clipped_at as string) ?? null,
      clipType: (row.clip_type as string) ?? null,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    };
  }

  // Create a new daily note
  const format = options?.titleFormat ?? 'YYYY-MM-DD';
  const title = formatDailyTitle(date, format);
  const body = options?.templateBody ?? '';
  const folderId = options?.folderId ?? null;
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const wc = countWords(body);
  const cc = body.length;

  db.transaction(() => {
    db.execute(
      `INSERT INTO nt_notes (id, title, body, folder_id, is_pinned, is_favorite, word_count, char_count, is_daily_note, daily_date, created_at, updated_at)
       VALUES (?, ?, ?, ?, 0, 0, ?, ?, 1, ?, ?, ?)`,
      [id, title, body, folderId, wc, cc, date, now, now],
    );
  });

  return {
    id,
    title,
    body,
    folderId,
    isPinned: false,
    isFavorite: false,
    wordCount: wc,
    charCount: cc,
    isDailyNote: true,
    dailyDate: date,
    sourceUrl: null,
    clippedAt: null,
    clipType: null,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Get all dates that have daily notes, sorted descending.
 */
export function getDailyNoteDates(db: DatabaseAdapter): string[] {
  const rows = db.query<{ daily_date: string }>(
    `SELECT daily_date FROM nt_notes WHERE is_daily_note = 1 AND daily_date IS NOT NULL ORDER BY daily_date DESC`,
  );
  return rows.map((r) => r.daily_date);
}

/**
 * Navigate to a specific date's daily note.
 * Returns the note if it exists, null otherwise.
 */
export function getDailyNoteByDate(db: DatabaseAdapter, date: string): Note | null {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM nt_notes WHERE daily_date = ?`,
    [date],
  );
  if (rows.length === 0) return null;
  const row = rows[0];
  return {
    id: row.id as string,
    title: row.title as string,
    body: row.body as string,
    folderId: (row.folder_id as string) ?? null,
    isPinned: (row.is_pinned as number) === 1,
    isFavorite: (row.is_favorite as number) === 1,
    wordCount: row.word_count as number,
    charCount: row.char_count as number,
    isDailyNote: true,
    dailyDate: date,
    sourceUrl: (row.source_url as string) ?? null,
    clippedAt: (row.clipped_at as string) ?? null,
    clipType: (row.clip_type as string) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

/**
 * Check if a note is a daily note.
 */
export function isDailyNote(note: Note): boolean {
  return note.isDailyNote && note.dailyDate !== null;
}
