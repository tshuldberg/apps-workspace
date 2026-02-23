import type { Book, ReadingSession, Review } from '../models/schemas';
import type { YearInReview } from './types';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/**
 * Generate year-in-review data for a specific year.
 * Filters sessions to only those finished in the given year.
 */
export function generateYearInReview(
  year: number,
  sessions: ReadingSession[],
  reviews: Review[],
  books: Book[],
): YearInReview {
  const bookMap = new Map(books.map((b) => [b.id, b]));
  const reviewMap = new Map(reviews.map((r) => [r.book_id, r]));

  // Filter to sessions finished in the given year
  const yearSessions = sessions.filter((s) => {
    if (s.status !== 'finished' || !s.finished_at) return false;
    const finishedYear = new Date(s.finished_at).getFullYear();
    return finishedYear === year;
  });

  // Monthly breakdown (all 12 months)
  const monthlyCounts = new Array(12).fill(0) as number[];
  let totalPages = 0;

  const readDurations: Array<{ title: string; days: number }> = [];
  const booksByPages: Array<{ title: string; pages: number }> = [];
  const authorCounts: Record<string, number> = {};

  for (const session of yearSessions) {
    const book = bookMap.get(session.book_id);
    if (!book) continue;

    // Month count
    if (session.finished_at) {
      const month = new Date(session.finished_at).getMonth();
      monthlyCounts[month]++;
    }

    // Pages
    if (book.page_count) {
      totalPages += book.page_count;
      booksByPages.push({ title: book.title, pages: book.page_count });
    }

    // Duration
    if (session.started_at && session.finished_at) {
      const start = new Date(session.started_at);
      const end = new Date(session.finished_at);
      const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
      readDurations.push({ title: book.title, days });
    }

    // Authors
    const authors = safeParseJSON(book.authors);
    if (Array.isArray(authors)) {
      for (const author of authors) {
        authorCounts[author] = (authorCounts[author] ?? 0) + 1;
      }
    }
  }

  // Top rated books (5-star or highest rated)
  const ratedBooks: Array<{ title: string; authors: string; rating: number }> = [];
  const ratings: number[] = [];
  for (const session of yearSessions) {
    const book = bookMap.get(session.book_id);
    const review = reviewMap.get(session.book_id);
    if (!book || !review?.rating) continue;

    ratings.push(review.rating);
    const authors = safeParseJSON(book.authors);
    const authorStr = Array.isArray(authors) ? authors.join(', ') : String(authors);
    ratedBooks.push({ title: book.title, authors: authorStr, rating: review.rating });
  }
  const topRated = ratedBooks
    .sort((a, b) => b.rating - a.rating)
    .slice(0, 5);

  // Favorites (books marked as favorite)
  const favorites: Array<{ title: string; authors: string }> = [];
  for (const session of yearSessions) {
    const book = bookMap.get(session.book_id);
    const review = reviewMap.get(session.book_id);
    if (!book || review?.is_favorite !== 1) continue;

    const authors = safeParseJSON(book.authors);
    const authorStr = Array.isArray(authors) ? authors.join(', ') : String(authors);
    favorites.push({ title: book.title, authors: authorStr });
  }

  const averageRating = ratings.length > 0
    ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 100) / 100
    : null;

  readDurations.sort((a, b) => a.days - b.days);
  booksByPages.sort((a, b) => b.pages - a.pages);

  const topAuthors = Object.entries(authorCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([author, count]) => ({ author, count }));

  return {
    year,
    totalBooks: yearSessions.length,
    totalPages,
    topRated,
    monthlyBreakdown: MONTH_NAMES.map((month, i) => ({ month, count: monthlyCounts[i] })),
    favorites,
    longestBook: booksByPages[0] ?? null,
    shortestBook: booksByPages.length > 0 ? booksByPages[booksByPages.length - 1] : null,
    fastestRead: readDurations[0] ?? null,
    averageRating,
    authorCount: Object.keys(authorCounts).length,
    topAuthors,
  };
}

function safeParseJSON(json: string): unknown {
  try {
    return JSON.parse(json);
  } catch {
    return json;
  }
}
