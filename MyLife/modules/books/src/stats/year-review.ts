import type { Book, ReadingSession, Review } from '../models/schemas';
import type { YearInReview } from './types';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

type BookSummary = {
  title: string;
  pages: number;
};

type ReadDuration = {
  title: string;
  days: number;
};

type RatedBook = {
  title: string;
  authors: string;
  rating: number;
};

type AuthorSummary = {
  author: string;
  count: number;
};

type BookMeta = {
  title: string;
  pageCount: number | null;
  authors: string[];
  authorString: string;
};

function buildBookMetaMap(books: Book[]): Map<string, BookMeta> {
  const map = new Map<string, BookMeta>();
  for (const book of books) {
    const authors = parseAuthors(book.authors);
    map.set(book.id, {
      title: book.title,
      pageCount: book.page_count ?? null,
      authors,
      authorString: authors.join(', '),
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

function pushTopRated(top: RatedBook[], candidate: RatedBook, limit: number): void {
  let inserted = false;
  for (let index = 0; index < top.length; index += 1) {
    if (candidate.rating > top[index].rating) {
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
 * Generate year-in-review data for a specific year.
 * Filters sessions to only those finished in the given year.
 */
export function generateYearInReview(
  year: number,
  sessions: ReadingSession[],
  reviews: Review[],
  books: Book[],
): YearInReview {
  const bookMap = buildBookMetaMap(books);
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

  let fastestRead: ReadDuration | null = null;
  let longestBook: BookSummary | null = null;
  let shortestBook: BookSummary | null = null;
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
    if (book.pageCount) {
      totalPages += book.pageCount;
      if (!longestBook || book.pageCount > longestBook.pages) {
        longestBook = { title: book.title, pages: book.pageCount };
      }
      if (!shortestBook || book.pageCount <= shortestBook.pages) {
        shortestBook = { title: book.title, pages: book.pageCount };
      }
    }

    // Duration
    if (session.started_at && session.finished_at) {
      const start = new Date(session.started_at);
      const end = new Date(session.finished_at);
      const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
      if (!fastestRead || days < fastestRead.days) {
        fastestRead = { title: book.title, days };
      }
    }

    // Authors
    for (const author of book.authors) {
      authorCounts[author] = (authorCounts[author] ?? 0) + 1;
    }
  }

  // Top rated books (5-star or highest rated)
  const topRated: RatedBook[] = [];
  const ratings: number[] = [];
  const favorites: Array<{ title: string; authors: string }> = [];
  for (const session of yearSessions) {
    const book = bookMap.get(session.book_id);
    const review = reviewMap.get(session.book_id);
    if (!book || !review) continue;

    if (review.rating !== null) {
      ratings.push(review.rating);
      pushTopRated(topRated, { title: book.title, authors: book.authorString, rating: review.rating }, 5);
    }

    if (review.is_favorite === 1) {
      favorites.push({ title: book.title, authors: book.authorString });
    }
  }

  const averageRating = ratings.length > 0
    ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 100) / 100
    : null;

  const topAuthors = topAuthorsFromCounts(authorCounts, 5);

  return {
    year,
    totalBooks: yearSessions.length,
    totalPages,
    topRated,
    monthlyBreakdown: MONTH_NAMES.map((month, i) => ({ month, count: monthlyCounts[i] })),
    favorites,
    longestBook,
    shortestBook,
    fastestRead,
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
