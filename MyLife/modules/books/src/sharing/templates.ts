import type { CardTemplate } from './types';

export const CARD_TEMPLATES: CardTemplate[] = [
  {
    id: 'year_summary',
    name: 'Year Summary',
    description: 'Total books, pages, average rating, and top reads',
    minRequirements: { minFinishedBooks: 1 },
  },
  {
    id: 'monthly_chart',
    name: 'Monthly Chart',
    description: 'Books read per month as a bar chart',
    minRequirements: { minFinishedBooks: 2 },
  },
  {
    id: 'genre_breakdown',
    name: 'Genre Breakdown',
    description: 'Reading distribution by genre',
    minRequirements: { minFinishedBooks: 3, minGenres: 3 },
  },
  {
    id: 'top_authors',
    name: 'Top Authors',
    description: 'Your most-read authors',
    minRequirements: { minFinishedBooks: 3, minAuthors: 3 },
  },
  {
    id: 'reading_streak',
    name: 'Reading Streak',
    description: 'Current and longest reading streak',
    minRequirements: { minFinishedBooks: 1 },
  },
];
