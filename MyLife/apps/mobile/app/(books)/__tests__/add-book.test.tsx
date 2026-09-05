import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AddBookScreen from '../book/add';

const pushMock = vi.fn();
const createMock = vi.fn();
const useOpenLibrarySearchMock = vi.fn();
const olSearchDocToBookMock = vi.fn();
const addBookToShelfMock = vi.fn();

vi.mock('expo-router', () => ({
  useRouter: () => ({
    push: pushMock,
  }),
  Stack: {
    Screen: () => null,
  },
}));

vi.mock('../../../components/DatabaseProvider', () => ({
  useDatabase: () => ({ id: 'mock-db', query: vi.fn(() => []) }),
}));

vi.mock('../../../hooks/books/use-search', () => ({
  useOpenLibrarySearch: (...args: unknown[]) => useOpenLibrarySearchMock(...args),
}));

vi.mock('../../../hooks/books/use-books', () => ({
  useBooks: () => ({
    create: createMock,
  }),
}));

vi.mock('../../../hooks/books/use-shelves', () => ({
  useShelves: () => ({
    shelves: [{ id: 'shelf-wtr', slug: 'want-to-read', name: 'Want to Read' }],
  }),
}));

vi.mock('../../../lib/books/settings', () => ({
  getBooksSettings: () => ({
    defaultShelfSlug: 'want-to-read',
    coverImageQuality: 'medium',
    defaultSort: 'added',
  }),
  resolvePreferredShelf: (shelves: Array<{ slug: string }>, preferredSlug: string) =>
    shelves.find((shelf) => shelf.slug === preferredSlug) ?? null,
}));

vi.mock('@mylife/books', () => ({
  olSearchDocToBook: (...args: unknown[]) => olSearchDocToBookMock(...args),
  addBookToShelf: (...args: unknown[]) => addBookToShelfMock(...args),
}));

describe('AddBookScreen (mobile)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createMock.mockReturnValue({ id: 'book-1' });
    olSearchDocToBookMock.mockReturnValue({
      title: 'Dune',
      authors: '["Frank Herbert"]',
    });
    useOpenLibrarySearchMock.mockImplementation((query: string) => {
      if (query === 'dune') {
        return {
          results: [
            {
              key: '/works/OL123W',
              title: 'Dune',
              author_name: ['Frank Herbert'],
              cover_edition_key: 'OL123M',
              isbn: ['0441172717'],
              first_publish_year: 1965,
            },
          ],
          loading: false,
        };
      }
      return { results: [], loading: false };
    });
  });

  it('supports search add flow and sends user to created book page', () => {
    render(<AddBookScreen />);

    // The Curator redesign: inline search with results rail.
    fireEvent.change(screen.getByPlaceholderText('Title, author or ISBN'), {
      target: { value: 'dune' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add to Library' }));

    expect(olSearchDocToBookMock).toHaveBeenCalledTimes(1);
    expect(createMock).toHaveBeenCalledWith({
      title: 'Dune',
      authors: '["Frank Herbert"]',
    });
    expect(addBookToShelfMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'mock-db' }),
      'book-1',
      'shelf-wtr',
    );
    expect(pushMock).toHaveBeenCalledWith('/(books)/book/book-1');
  });

  it('navigates to the cover scanner', () => {
    // The manual-entry form was removed in the Curator redesign; adding is
    // search-first with Scan Cover as the alternate path.
    render(<AddBookScreen />);

    fireEvent.click(screen.getByRole('button', { name: /Scan Cover/i }));
    expect(pushMock).toHaveBeenCalledWith('/(books)/scan');
  });
});
