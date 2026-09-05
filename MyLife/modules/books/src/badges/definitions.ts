/**
 * Badge ID constants and category list.
 */

export const BADGE_IDS = {
  VOLUME_10: 'volume_10',
  VOLUME_25: 'volume_25',
  VOLUME_50: 'volume_50',
  VOLUME_100: 'volume_100',
  PAGES_1000: 'pages_1000',
  PAGES_5000: 'pages_5000',
  PAGES_10000: 'pages_10000',
  PAGES_50000: 'pages_50000',
  GENRE_3: 'genre_3',
  GENRE_5: 'genre_5',
  GENRE_10: 'genre_10',
  AUTHOR_5: 'author_5',
  AUTHOR_10: 'author_10',
  AUTHOR_25: 'author_25',
  STREAK_7: 'streak_7',
  STREAK_30: 'streak_30',
  STREAK_100: 'streak_100',
  STREAK_365: 'streak_365',
  CHALLENGE_1: 'challenge_1',
  CHALLENGE_5: 'challenge_5',
  CHALLENGE_10: 'challenge_10',
  SPEED_1DAY: 'speed_1day',
  SPEED_3DAY: 'speed_3day',
  SPEED_WEEKEND: 'speed_weekend',
  REVIEW_5: 'review_5',
  REVIEW_10: 'review_10',
  REVIEW_25: 'review_25',
  REVIEW_50: 'review_50',
  JOURNAL_5: 'journal_5',
  JOURNAL_10: 'journal_10',
  JOURNAL_25: 'journal_25',
} as const;

export const BADGE_CATEGORIES = ['volume', 'pages', 'genre', 'author', 'streak', 'challenge', 'speed', 'review', 'journal'] as const;
