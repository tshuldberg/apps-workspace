import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import BooksHomeScreen from '../index';

const pushMock = vi.fn();
const useGoalMock = vi.fn();
const useSessionsMock = vi.fn();
const useBooksMock = vi.fn();
const useReviewsMock = vi.fn();

vi.mock('expo-router', () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}));

vi.mock('../../../components/books/CurrentlyReading', () => ({
  CurrentlyReading: () => <div>CurrentlyReadingWidget</div>,
}));

vi.mock('../../../hooks/books/use-goals', () => ({
  useGoal: (...args: unknown[]) => useGoalMock(...args),
}));

vi.mock('../../../hooks/books/use-sessions', () => ({
  useSessions: (...args: unknown[]) => useSessionsMock(...args),
}));

vi.mock('../../../hooks/books/use-books', () => ({
  useBooks: (...args: unknown[]) => useBooksMock(...args),
}));

vi.mock('../../../hooks/books/use-reviews', () => ({
  useReviews: (...args: unknown[]) => useReviewsMock(...args),
  useReviewForBook: () => ({ reviews: [] }),
}));

describe('BooksHomeScreen (mobile)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useGoalMock.mockReturnValue({
      goal: { target_books: 24, year: 2026 },
      progress: { booksRead: 3 },
      loading: false,
      refresh: vi.fn(),
    });
    useSessionsMock.mockReturnValue({
      sessions: [
        {
          id: 'session-1',
          book_id: 'book-1',
          status: 'finished',
          finished_at: '2026-02-01T00:00:00.000Z',
        },
      ],
      loading: false,
      refresh: vi.fn(),
    });
    useBooksMock.mockReturnValue({
      books: [
        {
          id: 'book-1',
          title: 'Dune',
          authors: '["Frank Herbert"]',
          cover_url: null,
        },
      ],
      loading: false,
      refresh: vi.fn(),
    });
    useReviewsMock.mockImplementation((bookId?: string) => {
      if (bookId === 'book-1') {
        return {
          reviews: [{ rating: 4 }],
          loading: false,
        };
      }
      return {
        reviews: [],
        loading: false,
      };
    });
  });

  it('renders goal + currently reading sections and navigates on finished row press', () => {
    render(<BooksHomeScreen />);

    expect(screen.getByText('2026 Reading Goal')).toBeInTheDocument();
    expect(screen.getByText('Currently Reading')).toBeInTheDocument();
    expect(screen.getByText('CurrentlyReadingWidget')).toBeInTheDocument();
    expect(screen.getAllByText('Dune').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: /Dune/i }));
    expect(pushMock).toHaveBeenCalledWith('/(books)/book/book-1');
  });

  it('shows a warm empty state when there are no finished sessions', () => {
    useSessionsMock.mockReturnValue({
      sessions: [],
      loading: false,
      refresh: vi.fn(),
    });

    render(<BooksHomeScreen />);

    expect(
      screen.getByText('Your finished shelf is waiting'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Browse Library'),
    ).toBeInTheDocument();
  });
});
