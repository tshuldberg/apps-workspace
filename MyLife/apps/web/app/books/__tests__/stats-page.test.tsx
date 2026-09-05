import { render, screen, waitFor } from '@testing-library/react';
import {
  fetchReadingStats,
  fetchGoalProgress,
  fetchBookCount,
  fetchBookStatusCounts,
} from '../actions';
import BooksStatsPage from '../stats/page';

vi.mock('../actions', () => ({
  fetchReadingStats: vi.fn(),
  fetchGoalProgress: vi.fn(),
  fetchBookCount: vi.fn(),
  fetchBookStatusCounts: vi.fn(),
}));

describe('BooksStatsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads stats data and renders aggregates', async () => {
    const currentYear = new Date().getFullYear();

    vi.mocked(fetchReadingStats).mockResolvedValue({
      totalBooks: 5,
      totalPages: 1600,
      averageRating: 4.2,
      averagePagesPerBook: 320,
      booksPerMonth: {
        [`${currentYear}-01`]: 1,
        [`${currentYear}-02`]: 2,
      },
      topAuthors: [{ author: 'Ursula K. Le Guin', count: 2 }],
    });
    vi.mocked(fetchGoalProgress).mockResolvedValue({
      booksRead: 3,
      goal: {
        target_books: 12,
      },
    });
    vi.mocked(fetchBookCount).mockResolvedValue(8);
    vi.mocked(fetchBookStatusCounts).mockResolvedValue({
      reading: 2,
      wantToRead: 3,
      finished: 5,
      dnf: 1,
    });

    render(<BooksStatsPage />);

    await waitFor(() => {
      expect(fetchReadingStats).toHaveBeenCalledTimes(1);
      expect(fetchGoalProgress).toHaveBeenCalledWith(currentYear);
      expect(fetchBookCount).toHaveBeenCalledTimes(1);
      expect(fetchBookStatusCounts).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByText('Your reading journey at a glance')).toBeInTheDocument();
    expect(
      screen.getByText(`${currentYear} Reading Goal`),
    ).toBeInTheDocument();
    expect(screen.getByText('3 / 12 books')).toBeInTheDocument();
    expect(screen.getByText('25% complete')).toBeInTheDocument();
    expect(screen.getByText('Ursula K. Le Guin')).toBeInTheDocument();
    expect(screen.getByText('Jan')).toBeInTheDocument();
    expect(screen.getByText('Feb')).toBeInTheDocument();
    expect(screen.getByText('Reading')).toBeInTheDocument();
    expect(screen.getByText('Want to Read')).toBeInTheDocument();
    expect(screen.getByText('DNF')).toBeInTheDocument();
  });
});
