import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import StatsScreen from '../stats';

const pushMock = vi.fn();
const useGoalMock = vi.fn();
const useSessionsMock = vi.fn();
const useReviewsMock = vi.fn();
const useBooksMock = vi.fn();

vi.mock('expo-router', () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}));

vi.mock('../../../components/DatabaseProvider', () => ({
  useDatabase: () => ({ id: 'mock-db', query: vi.fn(() => []), execute: vi.fn() }),
}));

vi.mock('../../../hooks/books/use-goals', () => ({
  useGoal: (...args: unknown[]) => useGoalMock(...args),
}));

vi.mock('../../../hooks/books/use-sessions', () => ({
  useSessions: (...args: unknown[]) => useSessionsMock(...args),
}));

vi.mock('../../../hooks/books/use-reviews', () => ({
  useReviews: (...args: unknown[]) => useReviewsMock(...args),
}));

vi.mock('../../../hooks/books/use-books', () => ({
  useBooks: (...args: unknown[]) => useBooksMock(...args),
}));

describe('Books StatsScreen (mobile)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useGoalMock.mockReturnValue({
      goal: { target_books: 12 },
      progress: { booksRead: 2 },
      loading: false,
    });
    useSessionsMock.mockReturnValue({
      sessions: [
        { id: 's1', status: 'finished', book_id: 'b1', finished_at: '2026-01-10T00:00:00.000Z' },
        { id: 's2', status: 'finished', book_id: 'b2', finished_at: '2026-02-10T00:00:00.000Z' },
      ],
      loading: false,
    });
    useReviewsMock.mockReturnValue({
      reviews: [{ rating: 4 }, { rating: 5 }],
      loading: false,
    });
    useBooksMock.mockReturnValue({
      books: [
        { id: 'b1', page_count: 300 },
        { id: 'b2', page_count: 200 },
      ],
      loading: false,
    });
  });

  // Stats screen was rewritten in 2026 (Obsidian Noir redesign). The earlier
  // "Books Read / Pages Read / Avg Rating / Monthly Breakdown / Year in
  // Review CTA" layout no longer exists. Current screen shows an annual
  // goal ring, daily streak, three stat cards (TOTAL PAGES / AVG RATING /
  // READING TIME), monthly activity chart, top authors, and genre
  // distribution — no year-review navigation button. Assert on the stable
  // landmarks of the current screen.
  it('renders the reading-journey header and key analytic cards', () => {
    render(<StatsScreen />);

    expect(screen.getByText('INSIGHTS & ANALYTICS')).toBeInTheDocument();
    expect(screen.getByText('DAILY STREAK')).toBeInTheDocument();
    expect(screen.getByText('TOTAL PAGES')).toBeInTheDocument();
    expect(screen.getByText('AVG RATING')).toBeInTheDocument();
    expect(screen.getByText('READING TIME')).toBeInTheDocument();
    // Uses computed goal progress (2 finished / 12 target from the mock).
    expect(screen.getByText(/finished 2 out of 12 books/)).toBeInTheDocument();
  });
});
