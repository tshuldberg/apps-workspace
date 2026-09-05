/**
 * Cross-module interface implementation for MyBooks.
 *
 * Exposes book data for hub-level search, dashboard summaries,
 * and activity feeds.
 */

import type { DatabaseAdapter } from '@mylife/db';
import type {
  CrossModuleInterface,
  SearchableItem,
  ModuleSummary,
  ActivityItem,
  TodayCard,
  TodayCardContext,
} from '@mylife/module-registry';

const MODULE_ID = 'books';
const MAX_TODAY_CARDS = 3;

interface BookRow {
  id: string;
  title: string;
  subtitle: string | null;
  authors: string;
  subjects: string | null;
  description: string | null;
  updated_at: string;
}

interface ReviewRow {
  id: string;
  book_id: string;
  review_text: string | null;
  favorite_quote: string | null;
  rating: number | null;
  updated_at: string;
}

interface SessionRow {
  id: string;
  book_id: string;
  status: string;
  current_page: number;
  started_at: string | null;
  finished_at: string | null;
  updated_at: string;
}

interface CountRow {
  count: number;
}

interface LastActivityRow {
  last_activity: string | null;
}

interface AvgRow {
  avg_rating: number | null;
}

interface BookTitleRow {
  book_id: string;
  title: string;
}

function parseAuthors(authorsJson: string): string[] {
  try {
    const parsed = JSON.parse(authorsJson);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseSubjects(subjectsJson: string | null): string[] {
  if (!subjectsJson) return [];
  try {
    const parsed = JSON.parse(subjectsJson);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function getSearchableContent(db: DatabaseAdapter): SearchableItem[] {
  const books = db.query<BookRow>(
    `SELECT id, title, subtitle, authors, subjects, description, updated_at FROM bk_books`,
  );

  const reviews = db.query<ReviewRow & { book_title: string }>(
    `SELECT r.id, r.book_id, r.review_text, r.favorite_quote, r.rating, r.updated_at,
            b.title as book_title
     FROM bk_reviews r
     JOIN bk_books b ON r.book_id = b.id
     WHERE r.review_text IS NOT NULL`,
  );

  const items: SearchableItem[] = [];

  for (const book of books) {
    const authors = parseAuthors(book.authors);
    const subjects = parseSubjects(book.subjects);
    const tags = [...authors, ...subjects].filter(Boolean);

    items.push({
      moduleId: MODULE_ID,
      type: 'book',
      title: book.title,
      body: book.description ?? undefined,
      tags: tags.length > 0 ? tags : undefined,
      itemId: book.id,
      updatedAt: book.updated_at,
    });
  }

  for (const review of reviews) {
    items.push({
      moduleId: MODULE_ID,
      type: 'review',
      title: `Review: ${review.book_title}`,
      body: review.review_text ?? undefined,
      itemId: review.id,
      updatedAt: review.updated_at,
    });
  }

  return items;
}

export function getDataSummary(db: DatabaseAdapter): ModuleSummary {
  const totalRows = db.query<CountRow>(`SELECT COUNT(*) as count FROM bk_books`);
  const totalItems = totalRows[0]?.count ?? 0;

  const readingRows = db.query<CountRow>(
    `SELECT COUNT(*) as count FROM bk_reading_sessions WHERE status = 'reading'`,
  );
  const currentlyReading = readingRows[0]?.count ?? 0;

  const finishedRows = db.query<CountRow>(
    `SELECT COUNT(*) as count FROM bk_reading_sessions WHERE status = 'finished'`,
  );
  const booksFinished = finishedRows[0]?.count ?? 0;

  const avgRows = db.query<AvgRow>(
    `SELECT AVG(rating) as avg_rating FROM bk_reviews WHERE rating IS NOT NULL`,
  );
  const avgRating = avgRows[0]?.avg_rating;

  const lastRows = db.query<LastActivityRow>(
    `SELECT MAX(updated_at) as last_activity FROM bk_reading_sessions`,
  );
  const lastActivity = lastRows[0]?.last_activity ?? undefined;

  const stats: Record<string, number | string> = {
    currentlyReading,
    booksFinished,
  };

  if (avgRating != null) {
    stats.avgRating = Math.round(avgRating * 10) / 10;
  }

  return {
    moduleId: MODULE_ID,
    totalItems,
    stats,
    lastActivity,
  };
}

export function getActivityFeed(db: DatabaseAdapter, since: Date): ActivityItem[] {
  const sinceISO = since.toISOString();
  const items: ActivityItem[] = [];

  // Books finished since date
  const finished = db.query<SessionRow & { title: string }>(
    `SELECT s.id, s.book_id, s.status, s.current_page, s.started_at, s.finished_at, s.updated_at,
            b.title
     FROM bk_reading_sessions s
     JOIN bk_books b ON s.book_id = b.id
     WHERE s.status = 'finished' AND s.finished_at >= ?
     ORDER BY s.finished_at DESC`,
    [sinceISO],
  );

  for (const row of finished) {
    items.push({
      moduleId: MODULE_ID,
      action: 'completed',
      description: `Finished reading "${row.title}"`,
      timestamp: row.finished_at!,
      itemId: row.book_id,
      itemType: 'book',
    });
  }

  // Books started since date
  const started = db.query<SessionRow & { title: string }>(
    `SELECT s.id, s.book_id, s.status, s.current_page, s.started_at, s.finished_at, s.updated_at,
            b.title
     FROM bk_reading_sessions s
     JOIN bk_books b ON s.book_id = b.id
     WHERE s.status = 'reading' AND s.started_at >= ?
     ORDER BY s.started_at DESC`,
    [sinceISO],
  );

  for (const row of started) {
    items.push({
      moduleId: MODULE_ID,
      action: 'started',
      description: `Started reading "${row.title}"`,
      timestamp: row.started_at!,
      itemId: row.book_id,
      itemType: 'book',
    });
  }

  // New books added since date
  const added = db.query<BookTitleRow & { created_at: string }>(
    `SELECT id as book_id, title, created_at FROM bk_books
     WHERE created_at >= ?
     ORDER BY created_at DESC`,
    [sinceISO],
  );

  for (const row of added) {
    items.push({
      moduleId: MODULE_ID,
      action: 'created',
      description: `Added "${row.title}" to library`,
      timestamp: row.created_at,
      itemId: row.book_id,
      itemType: 'book',
    });
  }

  // Sort all items by timestamp descending
  items.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  return items;
}

// ---------------------------------------------------------------------------
// getTodayCards (Phase 2 anchor)
// ---------------------------------------------------------------------------

interface CurrentlyReadingRow {
  book_id: string;
  title: string;
  current_page: number;
  page_count: number | null;
  ended_at: string | null;
}

interface ReadingGoalRow {
  target_books: number;
  target_pages: number | null;
}

interface FinishedThisYearRow {
  count: number;
}

function tableExists(db: DatabaseAdapter, name: string): boolean {
  const rows = db.query<{ name: string }>(
    `SELECT name FROM sqlite_master WHERE type='table' AND name = ?`,
    [name],
  );
  return rows.length > 0;
}

function buildCurrentlyReadingCard(db: DatabaseAdapter): TodayCard | null {
  if (!tableExists(db, 'bk_reading_sessions') || !tableExists(db, 'bk_books')) {
    return null;
  }

  const rows = db.query<CurrentlyReadingRow>(
    `SELECT s.book_id as book_id, b.title as title,
            s.current_page as current_page, b.page_count as page_count,
            COALESCE(s.finished_at, s.updated_at) as ended_at
     FROM bk_reading_sessions s
     JOIN bk_books b ON s.book_id = b.id
     WHERE s.status = 'reading'
     ORDER BY COALESCE(s.updated_at, s.started_at) DESC
     LIMIT 1`,
  );
  const row = rows[0];
  if (!row) return null;

  let subtitle: string;
  const total = row.page_count ?? 0;
  const current = row.current_page ?? 0;
  if (total > 0 && current >= 0) {
    if (current >= total) {
      subtitle = 'Almost finished';
    } else {
      const pct = Math.max(0, Math.min(100, Math.round((current / total) * 100)));
      const left = Math.max(0, total - current);
      subtitle = `${pct}% complete \u2022 ${left} pages left`;
    }
  } else if (current > 0) {
    subtitle = `Page ${current}`;
  } else {
    subtitle = 'Pick up where you left off';
  }

  return {
    id: `books.currently-reading.${row.book_id}`,
    moduleId: MODULE_ID,
    kind: 'progress',
    priority: 50,
    title: row.title,
    subtitle,
    cta: { label: 'Continue', route: `/books/book/${row.book_id}` },
    dismissible: true,
  };
}

function buildReadingGoalCard(
  db: DatabaseAdapter,
  context: TodayCardContext,
): TodayCard | null {
  if (
    !tableExists(db, 'bk_reading_goals') ||
    !tableExists(db, 'bk_reading_sessions')
  ) {
    return null;
  }

  const year = context.now.getUTCFullYear();
  const goalRows = db.query<ReadingGoalRow>(
    `SELECT target_books, target_pages FROM bk_reading_goals WHERE year = ? LIMIT 1`,
    [year],
  );
  const goal = goalRows[0];
  if (!goal || goal.target_books <= 0) return null;

  const yearStart = `${year}-01-01T00:00:00.000Z`;
  const finishedRows = db.query<FinishedThisYearRow>(
    `SELECT COUNT(*) as count FROM bk_reading_sessions
     WHERE status = 'finished' AND finished_at IS NOT NULL AND finished_at >= ?`,
    [yearStart],
  );
  const booksRead = finishedRows[0]?.count ?? 0;

  // Pace inference: where should we be by now in the year?
  const start = Date.UTC(year, 0, 1);
  const next = Date.UTC(year + 1, 0, 1);
  const elapsed = Math.max(0, context.now.getTime() - start);
  const total = next - start;
  const fractionElapsed = total > 0 ? elapsed / total : 0;
  const expected = goal.target_books * fractionElapsed;
  const delta = booksRead - expected;
  let pace: string;
  if (delta >= 0.5) pace = 'ahead of pace';
  else if (delta <= -0.5) pace = 'behind pace';
  else pace = 'on pace';

  return {
    id: `books.reading-goal.${year}`,
    moduleId: MODULE_ID,
    kind: 'progress',
    priority: 35,
    title: `${booksRead} of ${goal.target_books} books`,
    subtitle: `${year} reading goal \u2022 ${pace}`,
    cta: { label: 'View goal', route: '/books/stats' },
    dismissible: true,
  };
}

export function getTodayCards(
  db: DatabaseAdapter,
  context: TodayCardContext,
): TodayCard[] {
  const cards: TodayCard[] = [];

  const currentlyReading = buildCurrentlyReadingCard(db);
  if (currentlyReading) cards.push(currentlyReading);

  const goal = buildReadingGoalCard(db, context);
  if (goal) cards.push(goal);

  // Note: a "Return library book" reminder is part of the spec but the books
  // schema has no library/due-date concept (bk_books has no due_date or
  // 'library' source). Skipped per the constraint to not fabricate columns.

  cards.sort((a, b) => b.priority - a.priority);
  return cards.slice(0, MAX_TODAY_CARDS);
}

export const booksCrossModule: CrossModuleInterface = {
  getSearchableContent: (db) => getSearchableContent(db as DatabaseAdapter),
  getDataSummary: (db) => getDataSummary(db as DatabaseAdapter),
  getActivityFeed: (db, since) => getActivityFeed(db as DatabaseAdapter, since),
  getTodayCards: (db, context) => getTodayCards(db as DatabaseAdapter, context),
};
