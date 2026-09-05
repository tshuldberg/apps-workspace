// Repro stage 2: add-book.test.tsx's exact import + vi.mock graph, but no
// render and no test-library queries. If this hangs, the deadlock lives in
// the module/mock graph; if it passes, the hang is in the render phase.

import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import AddBookScreen from '../../app/(books)/book/add';

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

vi.mock('../../components/DatabaseProvider', () => ({
  useDatabase: () => ({ id: 'mock-db', query: vi.fn(() => []) }),
}));

vi.mock('../../hooks/books/use-search', () => ({
  useOpenLibrarySearch: (...args: unknown[]) => useOpenLibrarySearchMock(...args),
}));

vi.mock('../../hooks/books/use-books', () => ({
  useBooks: () => ({
    create: createMock,
  }),
}));

vi.mock('../../hooks/books/use-shelves', () => ({
  useShelves: () => ({
    shelves: [{ id: 'shelf-wtr', slug: 'want-to-read', name: 'Want to Read' }],
  }),
}));

vi.mock('../../lib/books/settings', () => ({
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

describe('repro2: add-book import + mock graph, no render', () => {
  it('resolves the screen component without rendering', () => {
    useOpenLibrarySearchMock.mockReturnValue({ results: [], loading: false });
    expect(AddBookScreen).toBeTypeOf('function');
    expect(typeof render).toBe('function');
  });
});
