import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  fetchBooks,
  fetchShelves,
  fetchCurrentlyReading,
  fetchBookCount,
  fetchGoalProgress,
  fetchBookStatusCounts,
} from '../actions';
import BooksLibraryPage from '../page';

vi.mock('../actions', () => ({
  fetchBooks: vi.fn(),
  fetchShelves: vi.fn(),
  fetchCurrentlyReading: vi.fn(),
  fetchBookCount: vi.fn(),
  fetchGoalProgress: vi.fn(),
  fetchBookStatusCounts: vi.fn(),
}));

function mockDefaults() {
  vi.mocked(fetchCurrentlyReading).mockResolvedValue([]);
  vi.mocked(fetchBookCount).mockResolvedValue(0);
  vi.mocked(fetchGoalProgress).mockResolvedValue(null);
  vi.mocked(fetchBookStatusCounts).mockResolvedValue({
    reading: 0,
    wantToRead: 0,
    finished: 0,
    dnf: 0,
  });
}

describe('BooksLibraryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDefaults();
  });

  it('loads books and shelves on first render', async () => {
    vi.mocked(fetchShelves).mockResolvedValue([
      { id: 'shelf-reading', slug: 'reading' },
      { id: 'shelf-wtr', slug: 'want-to-read' },
    ]);
    // fetchBooks is called by both the initial Promise.all and the activeFilter effect
    vi.mocked(fetchBooks).mockResolvedValue([
      {
        id: 'book-1',
        title: 'Dune',
        authors: '["Frank Herbert"]',
        cover_url: null,
        rating: 4.5,
      },
    ]);
    vi.mocked(fetchBookCount).mockResolvedValue(1);

    render(<BooksLibraryPage />);

    await waitFor(() => {
      expect(fetchShelves).toHaveBeenCalled();
      expect(fetchBooks).toHaveBeenCalled();
    });

    expect(screen.getAllByText('Dune').length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: '+ Add Book' })).toHaveAttribute(
      'href',
      '/books/search',
    );
  });

  it('filters by selected shelf', async () => {
    vi.mocked(fetchShelves).mockResolvedValue([
      { id: 'shelf-reading', slug: 'reading' },
      { id: 'shelf-wtr', slug: 'want-to-read' },
    ]);
    vi.mocked(fetchBooks).mockResolvedValue([
      {
        id: 'book-1',
        title: 'Dune',
        authors: '["Frank Herbert"]',
        cover_url: null,
        rating: 4,
      },
    ]);

    const user = userEvent.setup();
    render(<BooksLibraryPage />);

    await waitFor(() => {
      expect(fetchBooks).toHaveBeenCalled();
    });

    // Click the "Reading" filter chip
    await user.click(
      await screen.findByRole('button', { name: 'Reading' }),
    );

    await waitFor(() => {
      expect(fetchBooks).toHaveBeenCalledWith({
        shelf_id: 'shelf-reading',
      });
    });
  });

  it('shows empty state links when no books are returned', async () => {
    vi.mocked(fetchShelves).mockResolvedValue([]);
    vi.mocked(fetchBooks).mockResolvedValue([]);

    render(<BooksLibraryPage />);

    await waitFor(() => {
      expect(screen.getByText('Your library is waiting')).toBeInTheDocument();
    });

    expect(screen.getByRole('link', { name: 'Search Books' })).toHaveAttribute(
      'href',
      '/books/search',
    );
    expect(
      screen.getByRole('link', { name: 'Import Library' }),
    ).toHaveAttribute('href', '/books/import');
  });
});
