/**
 * Card renderer -- builds share card data from reading stats.
 */

import type { ReadingStats } from '../stats/types';
import type {
  CardData,
  CardTemplateId,
  ColorTheme,
  TemplateAvailability,
} from './types';
import { CARD_TEMPLATES } from './templates';

/**
 * Check which card templates are available given the user's stats.
 */
export function getTemplateAvailability(
  stats: ReadingStats,
  genreCount: number,
  authorCount: number,
): TemplateAvailability[] {
  return CARD_TEMPLATES.map((template) => {
    const reqs = template.minRequirements;

    if (stats.totalBooks < reqs.minFinishedBooks) {
      return {
        template,
        available: false,
        reason: `Requires at least ${reqs.minFinishedBooks} finished book${reqs.minFinishedBooks === 1 ? '' : 's'}`,
      };
    }

    if (reqs.minGenres !== undefined && genreCount < reqs.minGenres) {
      return {
        template,
        available: false,
        reason: `Requires at least ${reqs.minGenres} genres`,
      };
    }

    if (reqs.minAuthors !== undefined && authorCount < reqs.minAuthors) {
      return {
        template,
        available: false,
        reason: `Requires at least ${reqs.minAuthors} authors`,
      };
    }

    return { template, available: true };
  });
}

/**
 * Build card data for a specific template from reading stats.
 */
export function buildCardData(
  templateId: CardTemplateId,
  stats: ReadingStats,
  options: {
    theme: ColorTheme;
    showDisplayName: boolean;
    displayName: string;
    genreDistribution?: Array<{ genre: string; count: number; percentage: number }>;
    streakData?: { currentStreak: number; longestStreak: number; recentDays: boolean[] };
  },
): CardData {
  const base: CardData = {
    templateId,
    theme: options.theme,
    showDisplayName: options.showDisplayName,
    displayName: options.displayName,
  };

  switch (templateId) {
    case 'year_summary': {
      const topBooks = stats.topAuthors.length > 0
        ? stats.topAuthors.slice(0, 3).map((a) => ({ title: a.author, coverUrl: null }))
        : [];
      return {
        ...base,
        totalBooks: stats.totalBooks,
        totalPages: stats.totalPages,
        averageRating: stats.averageRating,
        topBooks,
      };
    }

    case 'monthly_chart':
      return {
        ...base,
        monthlyBooks: { ...stats.booksPerMonth },
      };

    case 'genre_breakdown':
      return {
        ...base,
        genreDistribution: options.genreDistribution ?? [],
      };

    case 'top_authors':
      return {
        ...base,
        topAuthors: stats.topAuthors.slice(0, 5).map((a) => ({
          author: a.author,
          count: a.count,
        })),
      };

    case 'reading_streak':
      return {
        ...base,
        currentStreak: options.streakData?.currentStreak ?? 0,
        longestStreak: options.streakData?.longestStreak ?? 0,
        recentDays: options.streakData?.recentDays ?? [],
      };

    default:
      return base;
  }
}

/**
 * Get theme colors for a card.
 */
export function getCardThemeColors(theme: ColorTheme): {
  background: string;
  backgroundGradient: string;
  text: string;
  textSecondary: string;
  accent: string;
} {
  switch (theme) {
    case 'dark':
      return {
        background: '#0A0A0F',
        backgroundGradient: '#1A1A24',
        text: '#F0F0F5',
        textSecondary: 'rgba(240,240,245,0.65)',
        accent: '#C9894D',
      };

    case 'accent':
      return {
        background: '#C9894D',
        backgroundGradient: '#A06830',
        text: '#F0F0F5',
        textSecondary: 'rgba(240,240,245,0.8)',
        accent: '#F0F0F5',
      };

    case 'light':
      return {
        background: '#F0F0F5',
        backgroundGradient: '#E0E0E8',
        text: '#12121A',
        textSecondary: 'rgba(18,18,26,0.65)',
        accent: '#C9894D',
      };
  }
}

/**
 * Truncate a title to a maximum length.
 */
export function truncateTitle(title: string, maxLength: number = 40): string {
  if (title.length <= maxLength) return title;
  return title.slice(0, maxLength) + '...';
}

/**
 * Get standard card dimensions for share images.
 */
export function getCardDimensions(): { width: number; height: number } {
  return { width: 1080, height: 1920 };
}
