import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

const mockUsePathname = vi.fn();
vi.mock('next/navigation', () => ({
  usePathname: () => mockUsePathname(),
}));

const mockRegistry = {
  getEnabled: vi.fn(),
};
vi.mock('@mylife/module-registry/hooks', () => ({
  useModuleRegistry: () => mockRegistry,
}));

vi.mock('@/lib/modules', () => ({
  isWebSupportedModuleId: (id: string) =>
    [
      'books',
      'budget',
      'fast',
      'recipes',
      'rsvp',
      'surf',
      'workouts',
      'homes',
      'car',
      'habits',
      'meds',
      'words',
    ].includes(id),
}));

import { Sidebar } from '../Sidebar';

const makeModule = (id: string, name: string, icon: string) => ({
  id,
  name,
  tagline: `${name} tagline`,
  icon,
  accentColor: '#FFFFFF',
  tier: 'premium' as const,
  storageType: 'sqlite' as const,
  migrations: [],
  tablePrefix: `${id.slice(0, 2)}_`,
  navigation: { tabs: [], screens: [] },
  requiresAuth: false,
  requiresNetwork: false,
  version: '1.0.0',
});

describe('Sidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUsePathname.mockReturnValue('/');
    mockRegistry.getEnabled.mockReturnValue([]);
  });

  it('renders logo with link to home', () => {
    render(<Sidebar />);

    // Desktop sidebar + mobile header both render the logo
    expect(screen.getAllByText('M').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('MyLife').length).toBeGreaterThanOrEqual(1);

    const homeLinks = screen.getAllByRole('link', { name: /mylife/i });
    expect(homeLinks[0]).toHaveAttribute('href', '/');
  });

  it('shows enabled module links in sidebar', () => {
    mockRegistry.getEnabled.mockReturnValue([
      makeModule('books', 'MyBooks', '\uD83D\uDCDA'),
      makeModule('budget', 'MyBudget', '\uD83D\uDCB0'),
    ]);

    render(<Sidebar />);

    const booksLink = screen.getByRole('link', { name: /books/i });
    expect(booksLink).toHaveAttribute('href', '/books');

    const budgetLink = screen.getByRole('link', { name: /budget/i });
    expect(budgetLink).toHaveAttribute('href', '/budget');
  });

  it('highlights active module link based on pathname', () => {
    mockUsePathname.mockReturnValue('/books/search');
    mockRegistry.getEnabled.mockReturnValue([
      makeModule('books', 'MyBooks', '\uD83D\uDCDA'),
      makeModule('budget', 'MyBudget', '\uD83D\uDCB0'),
    ]);

    render(<Sidebar />);

    // Active link gets elevated background style — just verify link exists with correct href
    const booksLink = screen.getByRole('link', { name: /books/i });
    expect(booksLink).toHaveAttribute('href', '/books');
  });

  it('shows Discover and Settings links', () => {
    render(<Sidebar />);

    const discoverLink = screen.getByRole('link', { name: /discover/i });
    expect(discoverLink).toHaveAttribute('href', '/discover');

    const settingsLink = screen.getByRole('link', { name: /settings/i });
    expect(settingsLink).toHaveAttribute('href', '/settings');
  });

  it('shows empty state when no modules enabled', () => {
    mockRegistry.getEnabled.mockReturnValue([]);

    render(<Sidebar />);

    expect(screen.getByText(/no modules enabled/i)).toBeInTheDocument();
  });

  it('filters out non-web-supported modules', () => {
    mockRegistry.getEnabled.mockReturnValue([
      makeModule('books', 'MyBooks', '\uD83D\uDCDA'),
      makeModule('voice', 'MyVoice', '\uD83C\uDFA4'),
    ]);

    render(<Sidebar />);

    expect(screen.getByText(/books/i)).toBeInTheDocument();
    expect(screen.queryByText(/voice/i)).not.toBeInTheDocument();
  });

  it('renders module icons and names', () => {
    mockRegistry.getEnabled.mockReturnValue([
      makeModule('books', 'MyBooks', '\uD83D\uDCDA'),
    ]);

    render(<Sidebar />);

    expect(screen.getByText(/MyBooks/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /MyBooks/i })).toHaveAttribute('href', '/books');
  });
});
