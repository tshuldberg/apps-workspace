export type InsightCategory =
  | 'speed'
  | 'timing'
  | 'diversity'
  | 'consistency'
  | 'milestones';

export interface ReadingInsight {
  id: string;
  category: InsightCategory;
  title: string;
  description: string;
  value: number | string;
  comparisonValue?: number | string;
  comparisonLabel?: string;
}

export interface InsightSet {
  insights: ReadingInsight[];
  computedAt: string;
  insufficientData: boolean;
  minimumBooksRequired: number;
}

export interface GenreSnapshot {
  genre: string;
  count: number;
  percentage: number;
}

export interface GenreEvolutionPeriod {
  period: string;
  year: number;
  month?: number;
  genres: GenreSnapshot[];
}

export interface GenreEvolutionTimeline {
  periods: GenreEvolutionPeriod[];
  dominantGenreShifts: Array<{
    from: string;
    to: string;
    period: string;
  }>;
}

export interface OnThisDayEvent {
  type: 'started' | 'finished' | 'added' | 'reviewed';
  bookTitle: string;
  bookId: string;
  coverUrl: string | null;
  year: number;
  date: string;
  detail?: string;
}
