export interface DiningMoodCorrelation {
  date: string;
  hadTopRatedVisit: boolean;
  restaurantRating: number | null;
  overallVisitRating: number | null;
}

export function buildCorrelationQuery(): {
  description: string;
  insightLabel: string;
  sourceModule: 'dining';
} {
  return {
    description: 'Compare mood scores on days with top-rated restaurant visits vs other days',
    insightLabel: 'Dining & Mood',
    sourceModule: 'dining',
  };
}

export function categorizeDiningDay(
  visits: Array<{ overall_rating: number; restaurant_avg_rating: number | null }>,
): 'top_rated' | 'average' | 'no_dining' {
  if (visits.length === 0) return 'no_dining';
  const hasTopRated = visits.some(
    (v) =>
      v.overall_rating >= 4 ||
      (v.restaurant_avg_rating != null && v.restaurant_avg_rating >= 4),
  );
  return hasTopRated ? 'top_rated' : 'average';
}
