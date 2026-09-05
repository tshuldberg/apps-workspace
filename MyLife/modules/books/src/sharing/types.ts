export type ColorTheme = 'dark' | 'accent' | 'light';

export type CardTemplateId = 'year_summary' | 'monthly_chart' | 'genre_breakdown' | 'top_authors' | 'reading_streak';

export interface CardTemplate {
  id: CardTemplateId;
  name: string;
  description: string;
  minRequirements: CardRequirements;
}

export interface CardRequirements {
  minFinishedBooks: number;
  minGenres?: number;
  minAuthors?: number;
}

export interface CardData {
  templateId: CardTemplateId;
  theme: ColorTheme;
  showDisplayName: boolean;
  displayName: string;
  // Year summary
  totalBooks?: number;
  totalPages?: number;
  averageRating?: number | null;
  topBooks?: Array<{ title: string; coverUrl: string | null }>;
  // Monthly chart
  monthlyBooks?: Record<string, number>;
  // Genre breakdown
  genreDistribution?: Array<{ genre: string; count: number; percentage: number }>;
  // Top authors
  topAuthors?: Array<{ author: string; count: number }>;
  // Reading streak
  currentStreak?: number;
  longestStreak?: number;
  recentDays?: boolean[];  // last 7 days, true = read
}

export interface ShareCardConfig {
  width: number;
  height: number;
  template: CardTemplate;
  data: CardData;
}

export interface TemplateAvailability {
  template: CardTemplate;
  available: boolean;
  reason?: string;
}
