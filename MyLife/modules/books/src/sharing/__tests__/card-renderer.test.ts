import { describe, it, expect } from 'vitest';
import type { ReadingStats } from '../../stats/types';
import {
  getTemplateAvailability,
  buildCardData,
  getCardThemeColors,
  truncateTitle,
  getCardDimensions,
} from '../card-renderer';

function makeStats(overrides: Partial<ReadingStats> = {}): ReadingStats {
  return {
    totalBooks: 10,
    totalPages: 3000,
    booksPerMonth: {
      '2026-01': 2,
      '2026-02': 1,
      '2026-03': 3,
      '2026-04': 0,
      '2026-05': 1,
      '2026-06': 0,
      '2026-07': 1,
      '2026-08': 0,
      '2026-09': 1,
      '2026-10': 0,
      '2026-11': 1,
      '2026-12': 0,
    },
    pagesPerMonth: {},
    averageRating: 4.2,
    ratingDistribution: { 4: 5, 5: 3, 3: 2 },
    averagePagesPerBook: 300,
    averageDaysPerBook: 7,
    topAuthors: [
      { author: 'Brandon Sanderson', count: 3 },
      { author: 'Patrick Rothfuss', count: 2 },
      { author: 'Robin Hobb', count: 2 },
      { author: 'Joe Abercrombie', count: 1 },
      { author: 'N.K. Jemisin', count: 1 },
      { author: 'Ursula K. Le Guin', count: 1 },
    ],
    fastestRead: { title: 'Short Story', days: 1 },
    slowestRead: { title: 'Long Epic', days: 30 },
    longestBook: { title: 'Long Epic', pages: 800 },
    shortestBook: { title: 'Short Story', pages: 100 },
    ...overrides,
  };
}

describe('getTemplateAvailability', () => {
  it('marks all templates available with sufficient data', () => {
    const stats = makeStats();
    const availability = getTemplateAvailability(stats, 5, 6);

    expect(availability).toHaveLength(5);
    for (const item of availability) {
      expect(item.available).toBe(true);
    }
  });

  it('disables all cards with 0 finished books', () => {
    const stats = makeStats({ totalBooks: 0 });
    const availability = getTemplateAvailability(stats, 0, 0);

    for (const item of availability) {
      expect(item.available).toBe(false);
      expect(item.reason).toBeDefined();
    }
  });

  it('disables genre card with fewer than 3 genres', () => {
    const stats = makeStats();
    const availability = getTemplateAvailability(stats, 2, 6);

    const genreTemplate = availability.find((a) => a.template.id === 'genre_breakdown');
    expect(genreTemplate).toBeDefined();
    expect(genreTemplate!.available).toBe(false);
    expect(genreTemplate!.reason).toBe('Requires at least 3 genres');
  });

  it('disables top authors card with fewer than 3 authors', () => {
    const stats = makeStats();
    const availability = getTemplateAvailability(stats, 5, 2);

    const authorsTemplate = availability.find((a) => a.template.id === 'top_authors');
    expect(authorsTemplate).toBeDefined();
    expect(authorsTemplate!.available).toBe(false);
    expect(authorsTemplate!.reason).toBe('Requires at least 3 authors');
  });
});

describe('buildCardData', () => {
  it('renders year summary card', () => {
    const stats = makeStats();
    const card = buildCardData('year_summary', stats, {
      theme: 'dark',
      showDisplayName: true,
      displayName: 'BookWorm',
    });

    expect(card.templateId).toBe('year_summary');
    expect(card.totalBooks).toBe(10);
    expect(card.totalPages).toBe(3000);
    expect(card.averageRating).toBe(4.2);
    expect(card.topBooks).toBeDefined();
    expect(card.topBooks!.length).toBeLessThanOrEqual(3);
    expect(card.showDisplayName).toBe(true);
    expect(card.displayName).toBe('BookWorm');
  });

  it('renders monthly chart with 12 months data', () => {
    const stats = makeStats();
    const card = buildCardData('monthly_chart', stats, {
      theme: 'accent',
      showDisplayName: false,
      displayName: '',
    });

    expect(card.templateId).toBe('monthly_chart');
    expect(card.monthlyBooks).toBeDefined();
    expect(Object.keys(card.monthlyBooks!).length).toBe(12);
  });

  it('renders genre breakdown with percentages', () => {
    const genreDistribution = [
      { genre: 'Fantasy', count: 5, percentage: 50 },
      { genre: 'Sci-Fi', count: 2, percentage: 20 },
      { genre: 'Mystery', count: 1, percentage: 10 },
      { genre: 'Horror', count: 1, percentage: 10 },
      { genre: 'Romance', count: 1, percentage: 10 },
    ];
    const stats = makeStats();
    const card = buildCardData('genre_breakdown', stats, {
      theme: 'dark',
      showDisplayName: true,
      displayName: 'Reader',
      genreDistribution,
    });

    expect(card.templateId).toBe('genre_breakdown');
    expect(card.genreDistribution).toHaveLength(5);
    expect(card.genreDistribution![0].genre).toBe('Fantasy');
    expect(card.genreDistribution![0].percentage).toBe(50);
  });

  it('renders top authors sorted by count', () => {
    const stats = makeStats();
    const card = buildCardData('top_authors', stats, {
      theme: 'light',
      showDisplayName: true,
      displayName: 'BookFan',
    });

    expect(card.templateId).toBe('top_authors');
    expect(card.topAuthors).toBeDefined();
    expect(card.topAuthors!.length).toBeLessThanOrEqual(5);
    // Verify sorted by count
    for (let i = 1; i < card.topAuthors!.length; i++) {
      expect(card.topAuthors![i - 1].count).toBeGreaterThanOrEqual(card.topAuthors![i].count);
    }
  });

  it('handles null average rating gracefully', () => {
    const stats = makeStats({ averageRating: null });
    const card = buildCardData('year_summary', stats, {
      theme: 'dark',
      showDisplayName: false,
      displayName: '',
    });

    expect(card.averageRating).toBeNull();
  });

  it('renders reading streak card', () => {
    const stats = makeStats();
    const streakData = {
      currentStreak: 5,
      longestStreak: 14,
      recentDays: [true, true, true, true, true, false, true],
    };
    const card = buildCardData('reading_streak', stats, {
      theme: 'dark',
      showDisplayName: false,
      displayName: '',
      streakData,
    });

    expect(card.currentStreak).toBe(5);
    expect(card.longestStreak).toBe(14);
    expect(card.recentDays).toHaveLength(7);
  });
});

describe('truncateTitle', () => {
  it('does not truncate short titles', () => {
    expect(truncateTitle('Short Title')).toBe('Short Title');
  });

  it('truncates long titles at 40 chars with ellipsis', () => {
    const longTitle = 'A Very Long Book Title That Exceeds The Maximum Character Limit';
    const result = truncateTitle(longTitle);
    expect(result.length).toBe(43); // 40 + "..."
    expect(result).toBe(longTitle.slice(0, 40) + '...');
  });

  it('respects custom max length', () => {
    const title = 'Medium Length Title';
    const result = truncateTitle(title, 10);
    expect(result).toBe('Medium Len...');
  });

  it('does not truncate at exact max length', () => {
    const title = 'Exactly 10';
    expect(truncateTitle(title, 10)).toBe('Exactly 10');
  });
});

describe('getCardDimensions', () => {
  it('returns 1080x1920', () => {
    const dims = getCardDimensions();
    expect(dims.width).toBe(1080);
    expect(dims.height).toBe(1920);
  });
});

describe('getCardThemeColors', () => {
  it('returns dark theme colors', () => {
    const colors = getCardThemeColors('dark');
    expect(colors.background).toBe('#0A0A0F');
    expect(colors.backgroundGradient).toBe('#1A1A24');
    expect(colors.text).toBe('#F0F0F5');
    expect(colors.accent).toBe('#C9894D');
  });

  it('returns accent theme colors', () => {
    const colors = getCardThemeColors('accent');
    expect(colors.background).toBe('#C9894D');
    expect(colors.backgroundGradient).toBe('#A06830');
    expect(colors.text).toBe('#F0F0F5');
  });

  it('returns light theme colors', () => {
    const colors = getCardThemeColors('light');
    expect(colors.background).toBe('#F0F0F5');
    expect(colors.backgroundGradient).toBe('#E0E0E8');
    expect(colors.text).toBe('#12121A');
    expect(colors.accent).toBe('#C9894D');
  });
});
