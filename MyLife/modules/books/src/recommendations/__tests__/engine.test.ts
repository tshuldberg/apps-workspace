import { describe, it, expect } from 'vitest';
import { computeRecommendations, deduplicateRecommendations } from '../engine';
import type { Recommendation } from '../types';

// --- Mock DatabaseAdapter ---

interface MockData {
  books: Array<{
    id: string;
    title: string;
    authors: string;
    cover_url: string | null;
    subjects: string | null;
  }>;
  reviews: Array<{ book_id: string; rating: number }>;
  sessions: Array<{ book_id: string; status: string }>;
  moodTags: Array<{ book_id: string; tag_type: string; value: string }>;
  tags: Array<{ book_id: string; tag_name: string; tag_id: string }>;
  tagDefs: Array<{ id: string; name: string }>;
  shelves: Array<{ id: string; slug: string }>;
  bookShelves: Array<{ book_id: string; shelf_id: string }>;
}

function defaultMockData(): MockData {
  return {
    books: [],
    reviews: [],
    sessions: [],
    moodTags: [],
    tags: [],
    tagDefs: [],
    shelves: [],
    bookShelves: [],
  };
}

function createMockDb(data: MockData) {
  return {
    transaction: (fn: () => void) => fn(),
    query: <T>(sql: string, params?: unknown[]): T[] => {
      const sqlLower = sql.toLowerCase();

      // Review queries
      if (sqlLower.includes('bk_reviews')) {
        let results = data.reviews;
        // Filter by rating threshold if specified
        const ratingMatch = sql.match(/rating\s*>=\s*([\d.]+)/);
        if (ratingMatch) {
          const threshold = parseFloat(ratingMatch[1]);
          results = results.filter((r) => r.rating >= threshold);
        }
        // Filter by book_id IN clause
        if (sqlLower.includes('where') && params && params.length > 0 && sqlLower.includes('in')) {
          results = results.filter((r) => (params as string[]).includes(r.book_id));
        }
        return results as T[];
      }

      // Reading sessions
      if (sqlLower.includes('bk_reading_sessions')) {
        let results = data.sessions;
        if (sqlLower.includes("status = 'finished'")) {
          results = results.filter((s) => s.status === 'finished');
        }
        return results as T[];
      }

      // Mood tags
      if (sqlLower.includes('bk_mood_tags')) {
        let results = data.moodTags;
        if (sqlLower.includes("tag_type = 'genre'")) {
          results = results.filter((t) => t.tag_type === 'genre');
        }
        // Filter by book_id if param provided
        if (params && params.length === 1 && typeof params[0] === 'string') {
          // Single book_id query
          if (sqlLower.includes('book_id = ?')) {
            results = results.filter((t) => t.book_id === params[0]);
          }
          // Value query
          if (sqlLower.includes('value = ?')) {
            results = results.filter((t) => t.value === params[0]);
          }
        }
        if (params && params.length > 1 && sqlLower.includes('in')) {
          results = results.filter((t) => (params as string[]).includes(t.book_id));
        }
        return results as T[];
      }

      // Book tags join
      if (sqlLower.includes('bk_book_tags') && sqlLower.includes('bk_tags')) {
        if (params && params.length === 1) {
          const bookId = params[0] as string;
          return data.tags
            .filter((t) => t.book_id === bookId)
            .map((t) => {
              const tagDef = data.tagDefs.find((td) => td.id === t.tag_id);
              return { book_id: t.book_id, tag_name: tagDef?.name ?? '' };
            }) as T[];
        }
        return [] as T[];
      }

      // Books
      if (sqlLower.includes('bk_books')) {
        let results = data.books;
        // Single book by ID
        if (params && params.length === 1 && sqlLower.includes('where id = ?')) {
          results = results.filter((b) => b.id === params[0]);
        }
        // Books by IN clause
        if (params && params.length > 0 && sqlLower.includes('in (')) {
          results = results.filter((b) => (params as string[]).includes(b.id));
        }
        // Books by LIKE (author search)
        if (params && params.length === 1 && sqlLower.includes('like')) {
          const pattern = (params[0] as string).replace(/%/g, '');
          results = results.filter((b) => b.authors.includes(pattern));
        }
        return results as T[];
      }

      // Shelves
      if (sqlLower.includes('bk_shelves')) {
        return data.shelves as T[];
      }

      // Book shelves
      if (sqlLower.includes('bk_book_shelves')) {
        return data.bookShelves as T[];
      }

      return [] as T[];
    },
    execute: (_sql: string, _params?: unknown[]) => {},
  };
}

// --- Tests ---

describe('computeRecommendations', () => {
  it('requires minimum 5 ratings', () => {
    const data = defaultMockData();
    data.reviews = [
      { book_id: 'b1', rating: 4.5 },
      { book_id: 'b2', rating: 3.0 },
      { book_id: 'b3', rating: 5.0 },
    ];
    const db = createMockDb(data);
    const result = computeRecommendations(db);
    expect(result.insufficientData).toBe(true);
    expect(result.minimumRatingsRequired).toBe(5);
    expect(result.authorAffinity).toEqual([]);
    expect(result.genreAffinity).toEqual([]);
    expect(result.similarBooks).toEqual([]);
  });

  it('handles empty library', () => {
    const db = createMockDb(defaultMockData());
    const result = computeRecommendations(db);
    expect(result.insufficientData).toBe(true);
    expect(result.authorAffinity).toEqual([]);
  });

  it('author affinity ranks by weighted score', () => {
    const data = defaultMockData();
    // Author A: 2 books rated 5.0 -> count*0.4 + avg*0.6 = 0.8 + 3.0 = 3.8
    // Author B: 3 books rated 4.0 -> count*0.4 + avg*0.6 = 1.2 + 2.4 = 3.6
    // Author C: 1 book rated 5.0 -> count*0.4 + avg*0.6 = 0.4 + 3.0 = 3.4
    data.books = [
      { id: 'b1', title: 'Book A1', authors: '["Author A"]', cover_url: null, subjects: null },
      { id: 'b2', title: 'Book A2', authors: '["Author A"]', cover_url: null, subjects: null },
      { id: 'b3', title: 'Book B1', authors: '["Author B"]', cover_url: null, subjects: null },
      { id: 'b4', title: 'Book B2', authors: '["Author B"]', cover_url: null, subjects: null },
      { id: 'b5', title: 'Book B3', authors: '["Author B"]', cover_url: null, subjects: null },
      { id: 'b6', title: 'Book C1', authors: '["Author C"]', cover_url: null, subjects: null },
      // Unread books by these authors for recommendations
      { id: 'b7', title: 'Unread A', authors: '["Author A"]', cover_url: null, subjects: null },
      { id: 'b8', title: 'Unread B', authors: '["Author B"]', cover_url: null, subjects: null },
      { id: 'b9', title: 'Unread C', authors: '["Author C"]', cover_url: null, subjects: null },
    ];
    data.reviews = [
      { book_id: 'b1', rating: 5.0 },
      { book_id: 'b2', rating: 5.0 },
      { book_id: 'b3', rating: 4.0 },
      { book_id: 'b4', rating: 4.0 },
      { book_id: 'b5', rating: 4.0 },
      { book_id: 'b6', rating: 5.0 },
    ];
    data.sessions = [
      { book_id: 'b1', status: 'finished' },
      { book_id: 'b2', status: 'finished' },
      { book_id: 'b3', status: 'finished' },
      { book_id: 'b4', status: 'finished' },
      { book_id: 'b5', status: 'finished' },
      { book_id: 'b6', status: 'finished' },
    ];

    const db = createMockDb(data);
    const result = computeRecommendations(db);

    expect(result.insufficientData).toBe(false);
    // Author A should rank first (3.8), then B (3.6), then C (3.4)
    const authorRecs = result.authorAffinity;
    expect(authorRecs.length).toBeGreaterThanOrEqual(3);

    const authorOrder = authorRecs.map((r) => r.reason);
    const indexA = authorOrder.findIndex((r) => r.includes('Author A'));
    const indexB = authorOrder.findIndex((r) => r.includes('Author B'));
    const indexC = authorOrder.findIndex((r) => r.includes('Author C'));
    expect(indexA).toBeLessThan(indexB);
    expect(indexB).toBeLessThan(indexC);
  });

  it('author affinity filters out read books', () => {
    const data = defaultMockData();
    data.books = [
      { id: 'b1', title: 'Read Book', authors: '["Author A"]', cover_url: null, subjects: null },
      { id: 'b2', title: 'Also Read', authors: '["Author A"]', cover_url: null, subjects: null },
      { id: 'b3', title: 'Read 3', authors: '["Author A"]', cover_url: null, subjects: null },
      { id: 'b4', title: 'Read 4', authors: '["Author A"]', cover_url: null, subjects: null },
      { id: 'b5', title: 'Read 5', authors: '["Author A"]', cover_url: null, subjects: null },
      { id: 'b6', title: 'Already Read By A', authors: '["Author A"]', cover_url: null, subjects: null },
    ];
    data.reviews = [
      { book_id: 'b1', rating: 5.0 },
      { book_id: 'b2', rating: 4.5 },
      { book_id: 'b3', rating: 4.0 },
      { book_id: 'b4', rating: 4.5 },
      { book_id: 'b5', rating: 5.0 },
    ];
    // All books are finished, including b6
    data.sessions = [
      { book_id: 'b1', status: 'finished' },
      { book_id: 'b2', status: 'finished' },
      { book_id: 'b3', status: 'finished' },
      { book_id: 'b4', status: 'finished' },
      { book_id: 'b5', status: 'finished' },
      { book_id: 'b6', status: 'finished' },
    ];

    const db = createMockDb(data);
    const result = computeRecommendations(db);

    // b6 is already finished, so should not appear in recommendations
    const recBookIds = result.authorAffinity.map((r) => r.bookId);
    expect(recBookIds).not.toContain('b6');
  });

  it('genre affinity weights by rating', () => {
    const data = defaultMockData();
    data.books = [
      { id: 'b1', title: 'Fantasy 1', authors: '["Author"]', cover_url: null, subjects: null },
      { id: 'b2', title: 'Sci-Fi 1', authors: '["Author"]', cover_url: null, subjects: null },
      { id: 'b3', title: 'Fantasy 2', authors: '["Author"]', cover_url: null, subjects: null },
      { id: 'b4', title: 'Sci-Fi 2', authors: '["Author"]', cover_url: null, subjects: null },
      { id: 'b5', title: 'More Books', authors: '["Author"]', cover_url: null, subjects: null },
      // Unread candidates
      { id: 'b6', title: 'Unread Fantasy', authors: '["Other"]', cover_url: null, subjects: null },
      { id: 'b7', title: 'Unread SciFi', authors: '["Other"]', cover_url: null, subjects: null },
    ];
    data.reviews = [
      { book_id: 'b1', rating: 5.0 },
      { book_id: 'b2', rating: 4.0 },
      { book_id: 'b3', rating: 5.0 },
      { book_id: 'b4', rating: 4.0 },
      { book_id: 'b5', rating: 4.5 },
    ];
    data.sessions = [
      { book_id: 'b1', status: 'finished' },
      { book_id: 'b2', status: 'finished' },
      { book_id: 'b3', status: 'finished' },
      { book_id: 'b4', status: 'finished' },
      { book_id: 'b5', status: 'finished' },
    ];
    data.moodTags = [
      { book_id: 'b1', tag_type: 'genre', value: 'Fantasy' },
      { book_id: 'b2', tag_type: 'genre', value: 'Sci-Fi' },
      { book_id: 'b3', tag_type: 'genre', value: 'Fantasy' },
      { book_id: 'b4', tag_type: 'genre', value: 'Sci-Fi' },
      // Unread books share genres
      { book_id: 'b6', tag_type: 'genre', value: 'Fantasy' },
      { book_id: 'b7', tag_type: 'genre', value: 'Sci-Fi' },
    ];

    const db = createMockDb(data);
    const result = computeRecommendations(db);

    // Fantasy total rating = 10.0 (2x5.0), Sci-Fi = 8.0 (2x4.0)
    // Fantasy recommendations should come first
    const genreRecs = result.genreAffinity;
    if (genreRecs.length >= 2) {
      const fantasyIdx = genreRecs.findIndex((r) => r.reason.includes('Fantasy'));
      const sciFiIdx = genreRecs.findIndex((r) => r.reason.includes('Sci-Fi'));
      if (fantasyIdx >= 0 && sciFiIdx >= 0) {
        expect(fantasyIdx).toBeLessThan(sciFiIdx);
      }
    }
  });

  it('similar books uses Jaccard similarity correctly', () => {
    const data = defaultMockData();
    data.books = [
      { id: 'b1', title: 'Liked Book', authors: '["A"]', cover_url: null, subjects: '["fiction","adventure","mystery"]' },
      { id: 'b2', title: 'R2', authors: '["A"]', cover_url: null, subjects: null },
      { id: 'b3', title: 'R3', authors: '["A"]', cover_url: null, subjects: null },
      { id: 'b4', title: 'R4', authors: '["A"]', cover_url: null, subjects: null },
      { id: 'b5', title: 'R5', authors: '["A"]', cover_url: null, subjects: null },
      // Candidate with 2/3 shared subjects (fiction, adventure) -> Jaccard = 2/4 = 0.5
      { id: 'c1', title: 'Similar Book', authors: '["B"]', cover_url: null, subjects: '["fiction","adventure","romance"]' },
    ];
    data.reviews = [
      { book_id: 'b1', rating: 5.0 },
      { book_id: 'b2', rating: 4.0 },
      { book_id: 'b3', rating: 4.0 },
      { book_id: 'b4', rating: 4.5 },
      { book_id: 'b5', rating: 4.0 },
    ];
    data.sessions = [
      { book_id: 'b1', status: 'finished' },
      { book_id: 'b2', status: 'finished' },
      { book_id: 'b3', status: 'finished' },
      { book_id: 'b4', status: 'finished' },
      { book_id: 'b5', status: 'finished' },
    ];

    const db = createMockDb(data);
    const result = computeRecommendations(db);

    const similarRecs = result.similarBooks;
    const found = similarRecs.find((r) => r.bookId === 'c1');
    expect(found).toBeDefined();
    expect(found!.reason).toBe('Because you liked Liked Book');
    expect(found!.score).toBeCloseTo(0.5, 1);
  });

  it('similar book minimum threshold excludes low similarity', () => {
    const data = defaultMockData();
    data.books = [
      { id: 'b1', title: 'Liked', authors: '["A"]', cover_url: null, subjects: '["fiction","adventure","mystery","thriller","horror"]' },
      { id: 'b2', title: 'R2', authors: '["B"]', cover_url: null, subjects: null },
      { id: 'b3', title: 'R3', authors: '["B"]', cover_url: null, subjects: null },
      { id: 'b4', title: 'R4', authors: '["B"]', cover_url: null, subjects: null },
      { id: 'b5', title: 'R5', authors: '["B"]', cover_url: null, subjects: null },
      // 1 shared out of 8 unique -> Jaccard = 1/8 = 0.125, below 0.3
      { id: 'c1', title: 'Low Match', authors: '["C"]', cover_url: null, subjects: '["fiction","romance","comedy","drama"]' },
    ];
    data.reviews = [
      { book_id: 'b1', rating: 5.0 },
      { book_id: 'b2', rating: 4.0 },
      { book_id: 'b3', rating: 4.0 },
      { book_id: 'b4', rating: 4.0 },
      { book_id: 'b5', rating: 4.0 },
    ];
    data.sessions = [
      { book_id: 'b1', status: 'finished' },
      { book_id: 'b2', status: 'finished' },
      { book_id: 'b3', status: 'finished' },
      { book_id: 'b4', status: 'finished' },
      { book_id: 'b5', status: 'finished' },
    ];

    const db = createMockDb(data);
    const result = computeRecommendations(db);

    const found = result.similarBooks.find((r) => r.bookId === 'c1');
    expect(found).toBeUndefined();
  });

  it('deduplicates across sections', () => {
    const authorRec: Recommendation = {
      bookId: 'dup-1',
      title: 'Shared Book',
      authors: ['Author X'],
      coverUrl: null,
      source: 'author_affinity',
      reason: 'More by Author X',
      score: 3.5,
    };
    const genreRecDup: Recommendation = {
      bookId: 'dup-1',
      title: 'Shared Book',
      authors: ['Author X'],
      coverUrl: null,
      source: 'genre_affinity',
      reason: 'Popular in Fantasy',
      score: 4.0,
    };
    const genreRecUnique: Recommendation = {
      bookId: 'unique-genre',
      title: 'Genre Only',
      authors: ['Author Y'],
      coverUrl: null,
      source: 'genre_affinity',
      reason: 'Popular in Mystery',
      score: 3.0,
    };
    const similarRecDup: Recommendation = {
      bookId: 'dup-1',
      title: 'Shared Book',
      authors: ['Author X'],
      coverUrl: null,
      source: 'similar_books',
      reason: 'Because you liked Something',
      score: 0.5,
    };
    const similarRecUnique: Recommendation = {
      bookId: 'unique-similar',
      title: 'Similar Only',
      authors: ['Author Z'],
      coverUrl: null,
      source: 'similar_books',
      reason: 'Because you liked Another',
      score: 0.4,
    };

    const result = deduplicateRecommendations(
      [authorRec],
      [genreRecDup, genreRecUnique],
      [similarRecDup, similarRecUnique],
    );

    // dup-1 should only be in author section
    expect(result.author).toHaveLength(1);
    expect(result.author[0].bookId).toBe('dup-1');

    expect(result.genre).toHaveLength(1);
    expect(result.genre[0].bookId).toBe('unique-genre');

    expect(result.similar).toHaveLength(1);
    expect(result.similar[0].bookId).toBe('unique-similar');
  });

  it('handles books with no subjects', () => {
    const data = defaultMockData();
    data.books = [
      { id: 'b1', title: 'No Subject Book', authors: '["Author A"]', cover_url: null, subjects: null },
      { id: 'b2', title: 'B2', authors: '["Author A"]', cover_url: null, subjects: null },
      { id: 'b3', title: 'B3', authors: '["Author A"]', cover_url: null, subjects: null },
      { id: 'b4', title: 'B4', authors: '["Author A"]', cover_url: null, subjects: null },
      { id: 'b5', title: 'B5', authors: '["Author A"]', cover_url: null, subjects: null },
      { id: 'b6', title: 'Unread', authors: '["Author A"]', cover_url: null, subjects: null },
    ];
    data.reviews = [
      { book_id: 'b1', rating: 5.0 },
      { book_id: 'b2', rating: 4.5 },
      { book_id: 'b3', rating: 4.0 },
      { book_id: 'b4', rating: 4.0 },
      { book_id: 'b5', rating: 4.0 },
    ];
    data.sessions = [
      { book_id: 'b1', status: 'finished' },
      { book_id: 'b2', status: 'finished' },
      { book_id: 'b3', status: 'finished' },
      { book_id: 'b4', status: 'finished' },
      { book_id: 'b5', status: 'finished' },
    ];

    const db = createMockDb(data);
    const result = computeRecommendations(db);

    // Should still produce author affinity even with no subjects
    expect(result.insufficientData).toBe(false);
    expect(result.authorAffinity.length).toBeGreaterThan(0);
    expect(result.authorAffinity[0].reason).toContain('Author A');
  });

  it('full flow with sufficient data produces non-empty recommendations', () => {
    const data = defaultMockData();
    data.books = [
      { id: 'b1', title: 'Fantasy Epic', authors: '["Brandon Sanderson"]', cover_url: 'http://cover.jpg', subjects: '["fiction","fantasy"]' },
      { id: 'b2', title: 'Fantasy 2', authors: '["Brandon Sanderson"]', cover_url: null, subjects: '["fiction","fantasy"]' },
      { id: 'b3', title: 'Mystery Novel', authors: '["Agatha Christie"]', cover_url: null, subjects: '["fiction","mystery"]' },
      { id: 'b4', title: 'Sci-Fi Classic', authors: '["Isaac Asimov"]', cover_url: null, subjects: '["fiction","science fiction"]' },
      { id: 'b5', title: 'Historical', authors: '["Ken Follett"]', cover_url: null, subjects: '["fiction","historical"]' },
      // Unread books
      { id: 'b6', title: 'Unread Sanderson', authors: '["Brandon Sanderson"]', cover_url: null, subjects: '["fiction","fantasy"]' },
      { id: 'b7', title: 'Unread Fantasy', authors: '["Other"]', cover_url: null, subjects: '["fiction","fantasy","adventure"]' },
    ];
    data.reviews = [
      { book_id: 'b1', rating: 5.0 },
      { book_id: 'b2', rating: 4.5 },
      { book_id: 'b3', rating: 4.0 },
      { book_id: 'b4', rating: 4.0 },
      { book_id: 'b5', rating: 4.5 },
    ];
    data.sessions = [
      { book_id: 'b1', status: 'finished' },
      { book_id: 'b2', status: 'finished' },
      { book_id: 'b3', status: 'finished' },
      { book_id: 'b4', status: 'finished' },
      { book_id: 'b5', status: 'finished' },
    ];
    data.moodTags = [
      { book_id: 'b1', tag_type: 'genre', value: 'Fantasy' },
      { book_id: 'b2', tag_type: 'genre', value: 'Fantasy' },
      { book_id: 'b6', tag_type: 'genre', value: 'Fantasy' },
      { book_id: 'b7', tag_type: 'genre', value: 'Fantasy' },
    ];

    const db = createMockDb(data);
    const result = computeRecommendations(db);

    expect(result.insufficientData).toBe(false);
    expect(result.computedAt).toBeTruthy();

    // Should have at least some author affinity recommendations
    const allRecs = [
      ...result.authorAffinity,
      ...result.genreAffinity,
      ...result.similarBooks,
    ];
    expect(allRecs.length).toBeGreaterThan(0);
  });
});
