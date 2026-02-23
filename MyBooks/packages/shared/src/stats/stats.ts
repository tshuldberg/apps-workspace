import type { Book, ReadingSession, Review, ReadingGoal } from '../models/schemas';
import type { ReadingStats } from './types';

/**
 * Calculate aggregate reading statistics from sessions, reviews, and books.
 * Only considers sessions with status "finished".
 */
export function calculateReadingStats(
  sessions: ReadingSession[],
  reviews: Review[],
  books: Book[],
): ReadingStats {
  const bookMap = new Map(books.map((b) => [b.id, b]));
  const reviewMap = new Map(reviews.map((r) => [r.book_id, r]));

  const finishedSessions = sessions.filter((s) => s.status === 'finished');

  // Books per month and pages per month
  const booksPerMonth: Record<string, number> = {};
  const pagesPerMonth: Record<string, number> = {};
  let totalPages = 0;
  const readDurations: Array<{ title: string; days: number }> = [];
  const booksByPages: Array<{ title: string; pages: number }> = [];

  for (const session of finishedSessions) {
    const book = bookMap.get(session.book_id);
    if (!book) continue;

    // Month tracking based on finish date
    if (session.finished_at) {
      const month = session.finished_at.substring(0, 7); // "YYYY-MM"
      booksPerMonth[month] = (booksPerMonth[month] ?? 0) + 1;
      if (book.page_count) {
        pagesPerMonth[month] = (pagesPerMonth[month] ?? 0) + book.page_count;
      }
    }

    // Total pages
    if (book.page_count) {
      totalPages += book.page_count;
      booksByPages.push({ title: book.title, pages: book.page_count });
    }

    // Reading duration
    if (session.started_at && session.finished_at) {
      const start = new Date(session.started_at);
      const end = new Date(session.finished_at);
      const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
      readDurations.push({ title: book.title, days });
    }
  }

  // Rating stats
  const ratings: number[] = [];
  const ratingDistribution: Record<number, number> = {};
  for (const review of reviews) {
    if (review.rating !== null) {
      ratings.push(review.rating);
      ratingDistribution[review.rating] = (ratingDistribution[review.rating] ?? 0) + 1;
    }
  }
  const averageRating = ratings.length > 0
    ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 100) / 100
    : null;

  // Author stats
  const authorCounts: Record<string, number> = {};
  for (const session of finishedSessions) {
    const book = bookMap.get(session.book_id);
    if (!book) continue;
    const authors = safeParseJSON(book.authors);
    if (Array.isArray(authors)) {
      for (const author of authors) {
        authorCounts[author] = (authorCounts[author] ?? 0) + 1;
      }
    }
  }
  const topAuthors = Object.entries(authorCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([author, count]) => ({ author, count }));

  // Sort durations and pages
  readDurations.sort((a, b) => a.days - b.days);
  booksByPages.sort((a, b) => b.pages - a.pages);

  const totalBooks = finishedSessions.length;

  return {
    totalBooks,
    totalPages,
    booksPerMonth,
    pagesPerMonth,
    averageRating,
    ratingDistribution,
    averagePagesPerBook: totalBooks > 0 ? Math.round(totalPages / totalBooks) : null,
    averageDaysPerBook: readDurations.length > 0
      ? Math.round(readDurations.reduce((sum, d) => sum + d.days, 0) / readDurations.length)
      : null,
    topAuthors,
    fastestRead: readDurations[0] ?? null,
    slowestRead: readDurations.length > 0 ? readDurations[readDurations.length - 1] : null,
    longestBook: booksByPages[0] ?? null,
    shortestBook: booksByPages.length > 0 ? booksByPages[booksByPages.length - 1] : null,
  };
}

function safeParseJSON(json: string): unknown {
  try {
    return JSON.parse(json);
  } catch {
    return json;
  }
}
