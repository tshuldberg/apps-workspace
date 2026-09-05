import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Alert } from 'react-native';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SearchScreen from '../search';

const pushMock = vi.fn();
const createMock = vi.fn(() => ({ id: 'book-1', title: 'Dune' }));
const olSearchDocToBookMock = vi.fn(() => ({
  title: 'Dune',
  authors: '["Frank Herbert"]',
}));
const addBookToShelfMock = vi.fn();
const useOpenLibrarySearchMock = vi.fn((query: string) => {
  if (query === 'dune') {
    return {
      loading: false,
      error: null,
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
    };
  }
  return { loading: false, error: null, results: [] };
});

vi.mock('expo-router', () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}));

vi.mock('../../../components/DatabaseProvider', () => ({
  useDatabase: () => ({ id: 'mock-db', query: vi.fn(() => []) }),
}));

vi.mock('../../../hooks/books/use-search', () => ({
  useOpenLibrarySearch: (query: string) => useOpenLibrarySearchMock(query),
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

vi.mock('@mylife/books', async () => ({
  // vitest 4 validates every accessed export: the screen reads the BOOKS_*
  // tokens and JAKARTA_FONTS from the root barrel. Spread the real ui
  // barrel (small, fast graph) for token values; never import the full
  // @mylife/books module here (db/engine graph) and never partial-mock
  // @mylife/ui (OOMs the fork, see test/setup.tsx).
  ...(await vi.importActual<Record<string, unknown>>('@mylife/books/ui')),
  olSearchDocToBook: (...args: unknown[]) => olSearchDocToBookMock(...args),
  addBookToShelf: (...args: unknown[]) => addBookToShelfMock(...args),
  getSystemShelves: () => [
    { id: 'shelf-wtr', name: 'Want to Read', isSystem: 1 },
  ],
}));


describe('Books SearchScreen (mobile)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Auto-press first shelf option when Alert.alert is shown
    vi.spyOn(Alert, 'alert').mockImplementation(
      ((_title: string, _message?: string, buttons?: Array<{ onPress?: () => void }>) => {
        const firstAction = buttons?.find((b) => b.onPress);
        firstAction?.onPress?.();
      }) as typeof Alert.alert,
    );
  });

  it('navigates to scan screen from empty-state Scan Barcode button', () => {
    render(<SearchScreen />);

    fireEvent.click(screen.getByRole('button', { name: 'Scan Barcode' }));

    expect(pushMock).toHaveBeenCalledWith('/(books)/scan');
  });

  it('adds a searched book to library and links it to Want to Read shelf', async () => {
    render(<SearchScreen />);

    fireEvent.change(
      screen.getByPlaceholderText('Search your digital sanctuary...'),
      {
        target: { value: 'dune' },
      },
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Add to shelf' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Add to shelf' }));

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
    expect(Alert.alert).toHaveBeenCalledWith(
      'Added',
      '"Dune" added to Want to Read.',
    );
  });
});
