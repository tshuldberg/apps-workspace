/**
 * Recommendation engine -- computes book recommendations from reading history.
 */

import type { DatabaseAdapter } from '@mylife/db';
import type {
  Recommendation,
  RecommendationSet,
  AuthorScore,
  GenreScore,
} from './types';

interface BookRow {
  id: string;
  title: string;
  authors: string;
  cover_url: string | null;
  subjects: string | null;
}

interface ReviewRow {
  book_id: string;
  rating: number;
}

interface SessionRow {
  book_id: string;
  status: string;
}

interface MoodTagRow {
  book_id: string;
  tag_type: string;
  value: string;
}

interface TagRow {
  book_id: string;
  tag_name: string;
}


function safeParseJSON(json: string): unknown {
  try {
    return JSON.parse(json);
  } catch {
    return json;
  }
}

function parseAuthors(value: string): string[] {
  const parsed = safeParseJSON(value);
  if (Array.isArray(parsed)) {
    return parsed.filter((a): a is string => typeof a === 'string');
  }
  if (typeof parsed === 'string' && parsed.length > 0) {
    return [parsed];
  }
  return [];
}

function parseSubjects(value: string | null): string[] {
  if (!value) return [];
  const parsed = safeParseJSON(value);
  if (Array.isArray(parsed)) {
    return parsed.filter((s): s is string => typeof s === 'string');
  }
  return [];
}

/**
 * Main entry point: compute all recommendation sections.
 */
export function computeRecommendations(
  db: DatabaseAdapter,
): RecommendationSet {
  // Check minimum rated reviews (any rating >= 0.5 counts toward minimum)
  const allReviews = db.query<ReviewRow>(
    `SELECT book_id, rating FROM bk_reviews WHERE rating IS NOT NULL AND rating >= 0.5`,
    [],
  );

  if (allReviews.length < 5) {
    return {
      insufficientData: true,
      minimumRatingsRequired: 5,
      authorAffinity: [],
      genreAffinity: [],
      similarBooks: [],
      computedAt: new Date().toISOString(),
    };
  }

  const authorRecs = computeAuthorAffinity(db);
  const genreRecs = computeGenreAffinity(db);
  const similarRecs = computeSimilarBooks(db);

  const deduped = deduplicateRecommendations(authorRecs, genreRecs, similarRecs);

  return {
    insufficientData: false,
    minimumRatingsRequired: 5,
    authorAffinity: deduped.author,
    genreAffinity: deduped.genre,
    similarBooks: deduped.similar,
    computedAt: new Date().toISOString(),
  };
}

/**
 * Find authors the user rates highly and recommend their unread books.
 */
export function computeAuthorAffinity(
  db: DatabaseAdapter,
): Recommendation[] {
  // Get all reviews with rating >= 4.0 (liked)
  const likedReviews = db.query<ReviewRow>(
    `SELECT book_id, rating FROM bk_reviews WHERE rating IS NOT NULL AND rating >= 4.0`,
    [],
  );

  if (likedReviews.length === 0) return [];

  // Get book metadata for liked books
  const likedBookIds = likedReviews.map((r) => r.book_id);
  const placeholders = likedBookIds.map(() => '?').join(', ');
  const likedBooks = db.query<BookRow>(
    `SELECT id, title, authors, cover_url, subjects FROM bk_books WHERE id IN (${placeholders})`,
    likedBookIds,
  );

  // Build author scores
  const authorMap = new Map<string, { count: number; totalRating: number }>();
  for (const book of likedBooks) {
    const review = likedReviews.find((r) => r.book_id === book.id);
    if (!review) continue;
    const authors = parseAuthors(book.authors);
    for (const author of authors) {
      const existing = authorMap.get(author) ?? { count: 0, totalRating: 0 };
      existing.count += 1;
      existing.totalRating += review.rating;
      authorMap.set(author, existing);
    }
  }

  // Compute weighted scores and sort
  const authorScores: AuthorScore[] = [];
  for (const [author, data] of authorMap) {
    const avgRating = data.totalRating / data.count;
    const weightedScore = data.count * 0.4 + avgRating * 0.6;
    authorScores.push({ author, count: data.count, avgRating, weightedScore });
  }
  authorScores.sort((a, b) => b.weightedScore - a.weightedScore);

  // Get finished book IDs (already read)
  const finishedSessions = db.query<SessionRow>(
    `SELECT book_id, status FROM bk_reading_sessions WHERE status = 'finished'`,
    [],
  );
  const finishedBookIds = new Set(finishedSessions.map((s) => s.book_id));

  // Find unread books by top authors
  const recommendations: Recommendation[] = [];
  for (const authorScore of authorScores.slice(0, 10)) {
    const authorBooks = db.query<BookRow>(
      `SELECT id, title, authors, cover_url, subjects FROM bk_books WHERE authors LIKE ?`,
      [`%${authorScore.author}%`],
    );

    for (const book of authorBooks) {
      if (finishedBookIds.has(book.id)) continue;
      // Verify this author is actually in the parsed authors list
      const bookAuthors = parseAuthors(book.authors);
      if (!bookAuthors.includes(authorScore.author)) continue;

      recommendations.push({
        bookId: book.id,
        title: book.title,
        authors: bookAuthors,
        coverUrl: book.cover_url,
        source: 'author_affinity',
        reason: `More by ${authorScore.author}`,
        score: authorScore.weightedScore,
      });
    }
  }

  return recommendations;
}

/**
 * Find genres the user rates highly and recommend unread books in those genres.
 */
export function computeGenreAffinity(
  db: DatabaseAdapter,
): Recommendation[] {
  // Get liked reviews (4.0+)
  const likedReviews = db.query<ReviewRow>(
    `SELECT book_id, rating FROM bk_reviews WHERE rating IS NOT NULL AND rating >= 4.0`,
    [],
  );

  if (likedReviews.length === 0) return [];

  const reviewMap = new Map<string, number>();
  for (const review of likedReviews) {
    reviewMap.set(review.book_id, review.rating);
  }

  // Get genre mood tags for liked books
  const likedBookIds = likedReviews.map((r) => r.book_id);
  const placeholders = likedBookIds.map(() => '?').join(', ');
  const genreTags = db.query<MoodTagRow>(
    `SELECT book_id, tag_type, value FROM bk_mood_tags WHERE tag_type = 'genre' AND book_id IN (${placeholders})`,
    likedBookIds,
  );

  // Sum ratings per genre
  const genreScores = new Map<string, GenreScore>();
  for (const tag of genreTags) {
    const rating = reviewMap.get(tag.book_id) ?? 0;
    const existing = genreScores.get(tag.value) ?? { genre: tag.value, totalRating: 0, count: 0 };
    existing.totalRating += rating;
    existing.count += 1;
    genreScores.set(tag.value, existing);
  }

  // Sort genres by total rating
  const sortedGenres = Array.from(genreScores.values())
    .sort((a, b) => b.totalRating - a.totalRating);

  // Get finished book IDs
  const finishedSessions = db.query<SessionRow>(
    `SELECT book_id, status FROM bk_reading_sessions WHERE status = 'finished'`,
    [],
  );
  const finishedBookIds = new Set(finishedSessions.map((s) => s.book_id));

  // Find unread books matching top genres
  const recommendations: Recommendation[] = [];
  for (const genre of sortedGenres.slice(0, 5)) {
    const genreBooks = db.query<{ book_id: string }>(
      `SELECT book_id FROM bk_mood_tags WHERE tag_type = 'genre' AND value = ?`,
      [genre.genre],
    );

    for (const row of genreBooks) {
      if (finishedBookIds.has(row.book_id)) continue;

      const book = db.query<BookRow>(
        `SELECT id, title, authors, cover_url, subjects FROM bk_books WHERE id = ?`,
        [row.book_id],
      );
      if (book.length === 0) continue;

      const b = book[0];
      recommendations.push({
        bookId: b.id,
        title: b.title,
        authors: parseAuthors(b.authors),
        coverUrl: b.cover_url,
        source: 'genre_affinity',
        reason: `Popular in ${genre.genre}`,
        score: genre.totalRating / genre.count,
      });
    }
  }

  return recommendations;
}

/**
 * Find books similar to the user's top-rated books using Jaccard similarity
 * on subjects and tags.
 */
export function computeSimilarBooks(
  db: DatabaseAdapter,
): Recommendation[] {
  // Get top-rated reviews (4.0+)
  const topReviews = db.query<ReviewRow>(
    `SELECT book_id, rating FROM bk_reviews WHERE rating IS NOT NULL AND rating >= 4.0 ORDER BY rating DESC`,
    [],
  );

  if (topReviews.length === 0) return [];

  // Get finished book IDs
  const finishedSessions = db.query<SessionRow>(
    `SELECT book_id, status FROM bk_reading_sessions WHERE status = 'finished'`,
    [],
  );
  const finishedBookIds = new Set(finishedSessions.map((s) => s.book_id));

  // Build attribute sets for top-rated books
  const topBookAttributes = new Map<string, { title: string; attributes: Set<string> }>();
  for (const review of topReviews) {
    const books = db.query<BookRow>(
      `SELECT id, title, authors, cover_url, subjects FROM bk_books WHERE id = ?`,
      [review.book_id],
    );
    if (books.length === 0) continue;

    const book = books[0];
    const attributes = new Set<string>();

    // Add subjects
    const subjects = parseSubjects(book.subjects);
    for (const subject of subjects) {
      attributes.add(`subject:${subject.toLowerCase()}`);
    }

    // Add user tags
    const tags = db.query<TagRow>(
      `SELECT bt.book_id, t.name AS tag_name FROM bk_book_tags bt INNER JOIN bk_tags t ON bt.tag_id = t.id WHERE bt.book_id = ?`,
      [review.book_id],
    );
    for (const tag of tags) {
      attributes.add(`tag:${tag.tag_name.toLowerCase()}`);
    }

    // Add genre mood tags
    const genreTags = db.query<MoodTagRow>(
      `SELECT book_id, tag_type, value FROM bk_mood_tags WHERE tag_type = 'genre' AND book_id = ?`,
      [review.book_id],
    );
    for (const tag of genreTags) {
      attributes.add(`genre:${tag.value.toLowerCase()}`);
    }

    if (attributes.size > 0) {
      topBookAttributes.set(book.id, { title: book.title, attributes });
    }
  }

  // Get all candidate books (not finished, not in top-rated)
  const allBooks = db.query<BookRow>(
    `SELECT id, title, authors, cover_url, subjects FROM bk_books`,
    [],
  );

  const recommendations: Recommendation[] = [];
  const seenBookIds = new Set<string>();

  for (const candidate of allBooks) {
    if (finishedBookIds.has(candidate.id)) continue;
    if (topBookAttributes.has(candidate.id)) continue;
    if (seenBookIds.has(candidate.id)) continue;

    // Build candidate attributes
    const candidateAttrs = new Set<string>();
    const subjects = parseSubjects(candidate.subjects);
    for (const subject of subjects) {
      candidateAttrs.add(`subject:${subject.toLowerCase()}`);
    }

    const tags = db.query<TagRow>(
      `SELECT bt.book_id, t.name AS tag_name FROM bk_book_tags bt INNER JOIN bk_tags t ON bt.tag_id = t.id WHERE bt.book_id = ?`,
      [candidate.id],
    );
    for (const tag of tags) {
      candidateAttrs.add(`tag:${tag.tag_name.toLowerCase()}`);
    }

    const genreTags = db.query<MoodTagRow>(
      `SELECT book_id, tag_type, value FROM bk_mood_tags WHERE tag_type = 'genre' AND book_id = ?`,
      [candidate.id],
    );
    for (const tag of genreTags) {
      candidateAttrs.add(`genre:${tag.value.toLowerCase()}`);
    }

    if (candidateAttrs.size === 0) continue;

    // Compare against each top-rated book
    let bestScore = 0;
    let bestReason = '';

    for (const [, topBook] of topBookAttributes) {
      const similarity = jaccardSimilarity(topBook.attributes, candidateAttrs);
      if (similarity > bestScore) {
        bestScore = similarity;
        bestReason = `Because you liked ${topBook.title}`;
      }
    }

    if (bestScore >= 0.3) {
      seenBookIds.add(candidate.id);
      recommendations.push({
        bookId: candidate.id,
        title: candidate.title,
        authors: parseAuthors(candidate.authors),
        coverUrl: candidate.cover_url,
        source: 'similar_books',
        reason: bestReason,
        score: bestScore,
      });
    }
  }

  // Sort by similarity score descending
  recommendations.sort((a, b) => b.score - a.score);
  return recommendations;
}

/**
 * Jaccard similarity: |A intersection B| / |A union B|
 */
function jaccardSimilarity(setA: Set<string>, setB: Set<string>): number {
  let intersection = 0;
  for (const item of setA) {
    if (setB.has(item)) intersection += 1;
  }
  const union = setA.size + setB.size - intersection;
  if (union === 0) return 0;
  return intersection / union;
}

/**
 * Remove books that appear in higher-priority sections.
 * Priority: author > genre > similar.
 */
export function deduplicateRecommendations(
  author: Recommendation[],
  genre: Recommendation[],
  similar: Recommendation[],
): { author: Recommendation[]; genre: Recommendation[]; similar: Recommendation[] } {
  const authorIds = new Set(author.map((r) => r.bookId));

  const dedupedGenre = genre.filter((r) => !authorIds.has(r.bookId));
  const genreIds = new Set(dedupedGenre.map((r) => r.bookId));

  const dedupedSimilar = similar.filter(
    (r) => !authorIds.has(r.bookId) && !genreIds.has(r.bookId),
  );

  return {
    author,
    genre: dedupedGenre,
    similar: dedupedSimilar,
  };
}
