export type RecommendationSource = 'author_affinity' | 'genre_affinity' | 'similar_books';

export interface Recommendation {
  bookId: string;
  title: string;
  authors: string[];
  coverUrl: string | null;
  source: RecommendationSource;
  reason: string;
  score: number;
}

export interface RecommendationSet {
  insufficientData: boolean;
  minimumRatingsRequired: number;
  authorAffinity: Recommendation[];
  genreAffinity: Recommendation[];
  similarBooks: Recommendation[];
  computedAt: string;
}

export interface AuthorScore {
  author: string;
  count: number;
  avgRating: number;
  weightedScore: number;
}

export interface GenreScore {
  genre: string;
  totalRating: number;
  count: number;
}
