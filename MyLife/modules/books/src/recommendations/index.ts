// Recommendations engine -- personalized book recommendations

export { computeRecommendations, deduplicateRecommendations } from './engine';
export type {
  Recommendation,
  RecommendationSet,
  RecommendationSource,
  AuthorScore,
  GenreScore,
} from './types';
