import { describe, expect, it } from 'vitest';
import type { Book, ReadingSession, Review } from '../../models/schemas';
import { calculateReadingStats, generateYearInReview } from '../index';

function makeBook(
  id: string,
  title: string,
  authors: string,
  pageCount: number,
): Book {
  return {
    id,
    title,
    subtitle: null,
    authors,
    isbn_10: null,
    isbn_13: null,
    open_library_id: null,
    open_library_edition_id: null,
    cover_url: null,
    cover_cached_path: null,
    publisher: null,
    publish_year: null,
    page_count: pageCount,
    subjects: null,
    description: null,
    language: 'en',
    format: 'physical',
    added_source: 'manual',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  };
}

function makeSession(
  id: string,
  bookId: string,
  status: ReadingSession['status'],
  startedAt: string | null,
  finishedAt: string | null,
): ReadingSession {
  return {
    id,
    book_id: bookId,
    started_at: startedAt,
    finished_at: finishedAt,
    current_page: 0,
    status,
    dnf_reason: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  };
}

function makeReview(
  id: string,
  bookId: string,
  rating: number | null,
  isFavorite: 0 | 1 = 0,
): Review {
  return {
    id,
    book_id: bookId,
    session_id: null,
    rating,
    review_text: null,
    favorite_quote: null,
    is_favorite: isFavorite,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  };
}

describe('books stats helpers', () => {
  it('calculates aggregate reading stats for finished sessions', () => {
    const books = [
      makeBook(
        '00000000-0000-4000-8000-000000000101',
        'Dune',
        '["Frank Herbert"]',
        500,
      ),
      makeBook(
        '00000000-0000-4000-8000-000000000102',
        'Neuromancer',
        '["William Gibson"]',
        300,
      ),
      makeBook(
        '00000000-0000-4000-8000-000000000103',
        'Malformed Authors',
        'not-json',
        120,
      ),
    ];

    const sessions = [
      makeSession(
        '00000000-0000-4000-8000-000000000201',
        books[0].id,
        'finished',
        '2026-01-01T00:00:00.000Z',
        '2026-01-10T00:00:00.000Z',
      ),
      makeSession(
        '00000000-0000-4000-8000-000000000202',
        books[1].id,
        'finished',
        '2026-02-01T00:00:00.000Z',
        '2026-02-04T00:00:00.000Z',
      ),
      makeSession(
        '00000000-0000-4000-8000-000000000203',
        books[2].id,
        'reading',
        '2026-02-05T00:00:00.000Z',
        null,
      ),
    ];

    const reviews = [
      makeReview('00000000-0000-4000-8000-000000000301', books[0].id, 5),
      makeReview('00000000-0000-4000-8000-000000000302', books[1].id, 4.5),
      makeReview('00000000-0000-4000-8000-000000000303', books[2].id, null),
    ];

    const stats = calculateReadingStats(sessions, reviews, books);

    expect(stats.totalBooks).toBe(2);
    expect(stats.totalPages).toBe(800);
    expect(stats.booksPerMonth['2026-01']).toBe(1);
    expect(stats.booksPerMonth['2026-02']).toBe(1);
    expect(stats.pagesPerMonth['2026-01']).toBe(500);
    expect(stats.pagesPerMonth['2026-02']).toBe(300);
    expect(stats.averageRating).toBe(4.75);
    expect(stats.averagePagesPerBook).toBe(400);
    expect(stats.averageDaysPerBook).toBe(6);
    expect(stats.ratingDistribution[5]).toBe(1);
    expect(stats.ratingDistribution[4.5]).toBe(1);
    expect(stats.topAuthors).toEqual([
      { author: 'Frank Herbert', count: 1 },
      { author: 'William Gibson', count: 1 },
    ]);
    expect(stats.fastestRead).toEqual({ title: 'Neuromancer', days: 3 });
    expect(stats.slowestRead).toEqual({ title: 'Dune', days: 9 });
    expect(stats.longestBook).toEqual({ title: 'Dune', pages: 500 });
    expect(stats.shortestBook).toEqual({ title: 'Neuromancer', pages: 300 });
  });

  it('handles empty finished-session sets without crashing', () => {
    const stats = calculateReadingStats([], [], []);

    expect(stats.totalBooks).toBe(0);
    expect(stats.totalPages).toBe(0);
    expect(stats.averageRating).toBeNull();
    expect(stats.averagePagesPerBook).toBeNull();
    expect(stats.averageDaysPerBook).toBeNull();
    expect(stats.topAuthors).toEqual([]);
  });

  it('builds a year-in-review payload with monthly rollups and favorites', () => {
    const books = [
      makeBook(
        '00000000-0000-4000-8000-000000000401',
        'Atomic Habits',
        '["James Clear"]',
        320,
      ),
      makeBook(
        '00000000-0000-4000-8000-000000000402',
        'Old Year Book',
        '["Someone Else"]',
        200,
      ),
    ];

    const sessions = [
      makeSession(
        '00000000-0000-4000-8000-000000000501',
        books[0].id,
        'finished',
        '2026-01-05T00:00:00.000Z',
        '2026-01-20T00:00:00.000Z',
      ),
      makeSession(
        '00000000-0000-4000-8000-000000000502',
        books[1].id,
        'finished',
        '2025-12-01T00:00:00.000Z',
        '2025-12-12T00:00:00.000Z',
      ),
    ];

    const reviews = [
      makeReview(
        '00000000-0000-4000-8000-000000000601',
        books[0].id,
        5,
        1,
      ),
    ];

    const review = generateYearInReview(2026, sessions, reviews, books);

    expect(review.year).toBe(2026);
    expect(review.totalBooks).toBe(1);
    expect(review.totalPages).toBe(320);
    expect(review.averageRating).toBe(5);
    expect(review.authorCount).toBe(1);
    expect(review.topRated).toEqual([
      {
        title: 'Atomic Habits',
        authors: 'James Clear',
        rating: 5,
      },
    ]);
    expect(review.favorites).toEqual([
      {
        title: 'Atomic Habits',
        authors: 'James Clear',
      },
    ]);
    expect(review.monthlyBreakdown).toHaveLength(12);
    expect(review.monthlyBreakdown[0]).toEqual({ month: 'January', count: 1 });
    expect(review.longestBook).toEqual({ title: 'Atomic Habits', pages: 320 });
    expect(review.shortestBook).toEqual({ title: 'Atomic Habits', pages: 320 });
    expect(review.fastestRead).toEqual({ title: 'Atomic Habits', days: 15 });
    expect(review.topAuthors).toEqual([{ author: 'James Clear', count: 1 }]);
  });
});
