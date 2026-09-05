/** Aggregate reading statistics computed from sessions, reviews, and books. */
export interface ReadingStats {
  totalBooks: number;
  totalPages: number;
  booksPerMonth: Record<string, number>; // "2026-01" -> count
  pagesPerMonth: Record<string, number>;
  averageRating: number | null;
  ratingDistribution: Record<number, number>; // 0.5 -> count, 1.0 -> count, ... 5.0 -> count
  averagePagesPerBook: number | null;
  averageDaysPerBook: number | null;
  topAuthors: Array<{ author: string; count: number }>;
  fastestRead: { title: string; days: number } | null;
  slowestRead: { title: string; days: number } | null;
  longestBook: { title: string; pages: number } | null;
  shortestBook: { title: string; pages: number } | null;
}

/** Year-in-review summary for a specific year. */
export interface YearInReview {
  year: number;
  totalBooks: number;
  totalPages: number;
  topRated: Array<{ title: string; authors: string; rating: number }>;
  monthlyBreakdown: Array<{ month: string; count: number }>;
  favorites: Array<{ title: string; authors: string }>;
  longestBook: { title: string; pages: number } | null;
  shortestBook: { title: string; pages: number } | null;
  fastestRead: { title: string; days: number } | null;
  averageRating: number | null;
  authorCount: number;
  topAuthors: Array<{ author: string; count: number }>;
}
