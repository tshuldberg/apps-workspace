import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import LibraryScreen from '../library';

const pushMock = vi.fn();
const refreshMock = vi.fn();
const useBooksMock = vi.fn();
const useReviewsMock = vi.fn();
const setBooksDefaultSortMock = vi.fn();
const dbMock = {
  id: 'mock-db',
  query: vi.fn(() => []),
  execute: vi.fn(),
};

vi.mock('expo-router', () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}));

vi.mock('../../../components/DatabaseProvider', () => ({
  useDatabase: () => dbMock,
}));

vi.mock('../../../lib/books/settings', () => ({
  getBooksSettings: () => ({
    defaultShelfSlug: 'want-to-read',
    coverImageQuality: 'medium',
    defaultSort: 'added',
  }),
  setBooksDefaultSort: (...args: unknown[]) => setBooksDefaultSortMock(...args),
}));

vi.mock('../../../hooks/books/use-books', () => ({
  useBooks: (filters?: unknown) => useBooksMock(filters),
}));

vi.mock('../../../hooks/books/use-reviews', () => ({
  useReviews: () => useReviewsMock(),
}));

vi.mock('@mylife/books', () => ({
  getSessions: () => [],
  getLatestProgress: () => null,
}));

vi.mock('../../../components/books/BookList', () => ({
  BookList: ({ books }: { books: Array<{ title: string }> }) => (
    <div data-testid="book-list">{books.map((book) => book.title).join('|')}</div>
  ),
}));

describe('Books mobile LibraryScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useReviewsMock.mockImplementation(() => ({ reviews: [] }));
    useBooksMock.mockImplementation(() => ({
      books: [
        {
          id: 'book-z',
          title: 'Zulu',
          authors: '["Author Z"]',
          created_at: '2026-02-10T00:00:00.000Z',
        },
        {
          id: 'book-a',
          title: 'Alpha',
          authors: '["Author A"]',
          created_at: '2026-01-10T00:00:00.000Z',
        },
      ],
      loading: false,
      refresh: refreshMock,
    }));
  });

  it('cycles sort order and persists the new default', async () => {
    render(<LibraryScreen />);

    // Initial sort field is 'added' -> label 'Recently Added'.
    expect(
      screen.getByRole('button', { name: /Sort: Recently Added/ }),
    ).toBeInTheDocument();

    // Cycle: added -> title. Click fires on the Pressable (role=button), not
    // its Text child, which is required by the setup.tsx Pressable mock.
    fireEvent.click(
      screen.getByRole('button', { name: /Sort: Recently Added/ }),
    );

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /Sort: Title/ }),
      ).toBeInTheDocument();
    });
    expect(setBooksDefaultSortMock).toHaveBeenCalledWith(dbMock, 'title');
  });

  it('toggles to list view and renders the BookList', () => {
    render(<LibraryScreen />);

    // Grid view is the default -- the mocked BookList is not in the tree yet.
    expect(screen.queryByTestId('book-list')).not.toBeInTheDocument();

    // Click the list-view toggle. Its accessible name is the glyph it renders.
    fireEvent.click(screen.getByRole('button', { name: '☰' }));

    expect(screen.getByTestId('book-list')).toHaveTextContent('Zulu|Alpha');
  });

  it('filters to currently-reading books when the status chip is tapped', async () => {
    render(<LibraryScreen />);

    // With no reading sessions in the mock, 'Currently Read' yields an empty
    // filtered set and the empty state is rendered.
    fireEvent.click(screen.getByRole('button', { name: 'Currently Read' }));

    await waitFor(() => {
      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
    });
    expect(screen.getByText('No books here')).toBeInTheDocument();
  });
});
