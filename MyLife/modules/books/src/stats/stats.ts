import type { Book, ReadingSession, Review } from '../models/schemas';
import type { ReadingStats } from './types';

type BookSummary = {
  title: string;
  pages: number;
};

type ReadDuration = {
  title: string;
  days: number;
};

type AuthorSummary = {
  author: string;
  count: number;
};

type BookMeta = {
  title: string;
  pageCount: number | null;
  authors: string[];
};

function buildBookMetaMap(books: Book[]): Map<string, BookMeta> {
  const map = new Map<string, BookMeta>();
  for (const book of books) {
    map.set(book.id, {
      title: book.title,
      pageCount: book.page_count ?? null,
      authors: parseAuthors(book.authors),
    });
  }
  return map;
}

function parseAuthors(value: string): string[] {
  const parsed = safeParseJSON(value);
  if (Array.isArray(parsed)) {
    return parsed.filter((author): author is string => typeof author === 'string');
  }
  if (typeof parsed === 'string' && parsed.length > 0) {
    return [parsed];
  }
  return [];
}

function topAuthorsFromCounts(counts: Record<string, number>, limit: number): AuthorSummary[] {
  const top: AuthorSummary[] = [];
  for (const [author, count] of Object.entries(counts)) {
    const candidate = { author, count };
    let inserted = false;
    for (let index = 0; index < top.length; index += 1) {
      if (count > top[index].count) {
        top.splice(index, 0, candidate);
        inserted = true;
        break;
      }
    }
    if (!inserted && top.length < limit) {
      top.push(candidate);
    }
    if (inserted && top.length > limit) {
      top.pop();
    }
  }
  return top;
}

/**
 * Calculate aggregate reading statistics from sessions, reviews, and books.
 * Only considers sessions with status "finished".
 */
export function calculateReadingStats(
  sessions: ReadingSession[],
  reviews: Review[],
  books: Book[],
): ReadingStats {
  const bookMap = buildBookMetaMap(books);

  const finishedSessions = sessions.filter((s) => s.status === 'finished');

  // Books per month and pages per month
  const booksPerMonth: Record<string, number> = {};
  const pagesPerMonth: Record<string, number> = {};
  let totalPages = 0;
  let totalDurationDays = 0;
  let durationCount = 0;
  let fastestRead: ReadDuration | null = null;
  let slowestRead: ReadDuration | null = null;
  let longestBook: BookSummary | null = null;
  let shortestBook: BookSummary | null = null;
  const authorCounts: Record<string, number> = {};

  for (const session of finishedSessions) {
    const book = bookMap.get(session.book_id);
    if (!book) continue;

    // Month tracking based on finish date
    if (session.finished_at) {
      const month = session.finished_at.substring(0, 7); // "YYYY-MM"
      booksPerMonth[month] = (booksPerMonth[month] ?? 0) + 1;
      if (book.pageCount) {
        pagesPerMonth[month] = (pagesPerMonth[month] ?? 0) + book.pageCount;
      }
    }

    // Total pages
    if (book.pageCount) {
      totalPages += book.pageCount;
      if (!longestBook || book.pageCount > longestBook.pages) {
        longestBook = { title: book.title, pages: book.pageCount };
      }
      if (!shortestBook || book.pageCount <= shortestBook.pages) {
        shortestBook = { title: book.title, pages: book.pageCount };
      }
    }

    // Reading duration
    if (session.started_at && session.finished_at) {
      const start = new Date(session.started_at);
      const end = new Date(session.finished_at);
      const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
      totalDurationDays += days;
      durationCount += 1;
      if (!fastestRead || days < fastestRead.days) {
        fastestRead = { title: book.title, days };
      }
      if (!slowestRead || days >= slowestRead.days) {
        slowestRead = { title: book.title, days };
      }
    }

    // Author stats
    for (const author of book.authors) {
      authorCounts[author] = (authorCounts[author] ?? 0) + 1;
    }
  }

  // Rating stats
  const ratings: number[] = [];
  const ratingDistribution: Record<number, number> = {};
  for (const review of reviews) {
    if (review.rating === null) continue;
    ratings.push(review.rating);
    ratingDistribution[review.rating] = (ratingDistribution[review.rating] ?? 0) + 1;
  }
  const averageRating = ratings.length > 0
    ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 100) / 100
    : null;

  const topAuthors = topAuthorsFromCounts(authorCounts, 10);

  const totalBooks = finishedSessions.length;

  return {
    totalBooks,
    totalPages,
    booksPerMonth,
    pagesPerMonth,
    averageRating,
    ratingDistribution,
    averagePagesPerBook: totalBooks > 0 ? Math.round(totalPages / totalBooks) : null,
    averageDaysPerBook: durationCount > 0
      ? Math.round(totalDurationDays / durationCount)
      : null,
    topAuthors,
    fastestRead,
    slowestRead,
    longestBook,
    shortestBook,
  };
}

function safeParseJSON(json: string): unknown {
  try {
    return JSON.parse(json);
  } catch {
    return json;
  }
}
