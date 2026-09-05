import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DiscoverScreen from '../discover';

const toggleMock = vi.fn();
const routerMock = { push: vi.fn() };
const registry = {
  isEnabled: vi.fn((id: string) => id === 'fast' || id === 'health'),
};

vi.mock('expo-router', () => ({
  useRouter: () => routerMock,
}));

vi.mock('@mylife/module-registry', () => ({
  ...(function () {
    const metadata = {
      books: { id: 'books', name: 'MyBooks', tagline: 'Books', icon: '📚', accentColor: '#C9894D', tier: 'premium' },
      recipes: { id: 'recipes', name: 'MyGarden', tagline: 'Grow it, cook it, host it', icon: '🌱', accentColor: '#22C55E', tier: 'premium' },
      habits: { id: 'habits', name: 'MyHabits', tagline: 'Habits', icon: '✅', accentColor: '#8B5CF6', tier: 'premium' },
      words: { id: 'words', name: 'MyWords', tagline: 'Words', icon: '📝', accentColor: '#8B5CF6', tier: 'premium' },
      rsvp: { id: 'rsvp', name: 'MyRSVP', tagline: 'RSVP', icon: '💌', accentColor: '#FB7185', tier: 'premium' },
      budget: { id: 'budget', name: 'MyBudget', tagline: 'Budget', icon: '💰', accentColor: '#22C55E', tier: 'premium' },
      fast: { id: 'fast', name: 'MyFast', tagline: 'Fast', icon: '⏱️', accentColor: '#14B8A6', tier: 'free' },
      workouts: { id: 'workouts', name: 'MyWorkouts', tagline: 'Workouts', icon: '💪', accentColor: '#EF4444', tier: 'premium' },
      meds: { id: 'meds', name: 'MyMeds', tagline: 'Meds', icon: '💊', accentColor: '#06B6D4', tier: 'premium' },
      surf: { id: 'surf', name: 'MySurf', tagline: 'Surf', icon: '🏄', accentColor: '#3B82F6', tier: 'premium' },
      homes: { id: 'homes', name: 'MyHomes', tagline: 'Homes', icon: '🏠', accentColor: '#D97706', tier: 'premium' },
      car: { id: 'car', name: 'MyCar', tagline: 'Car', icon: '🚗', accentColor: '#6366F1', tier: 'premium' },
      health: { id: 'health', name: 'MyHealth', tagline: 'Your health, unified', icon: '❤️‍🩹', accentColor: '#10B981', tier: 'premium', freeSections: ['fasting'] },
    } as Record<string, {
      id: string;
      name: string;
      tagline: string;
      icon: string;
      accentColor: string;
      tier: 'free' | 'premium';
      freeSections?: string[];
    }>;

    const icons = {
      books: 'book',
      recipes: 'leaf',
      habits: 'check',
      words: 'type',
      rsvp: 'mail',
      budget: 'wallet',
      fast: 'timer',
      workouts: 'dumbbell',
      meds: 'pill',
      surf: 'waves',
      homes: 'house',
      car: 'car',
      health: 'heart',
    } as Record<string, string>;

    const fallbackIds = [
      'journal',
      'notes',
      'flash',
      'mood',
      'cycle',
      'nutrition',
      'garden',
      'closet',
      'mail',
      'voice',
      'subs',
      'trails',
      'stars',
      'pets',
    ];
    for (const id of fallbackIds) {
      metadata[id] = {
        id,
        name: `My${id.charAt(0).toUpperCase()}${id.slice(1)}`,
        tagline: id,
        icon: '•',
        accentColor: '#666666',
        tier: 'premium',
      };
      icons[id] = 'circle';
    }

    return {
      useModuleRegistry: () => registry,
      useEnabledModules: () => [],
      FREE_MODULES: ['fast'],
      MODULE_ICONS: icons,
      MODULE_METADATA: metadata,
      getModuleReleaseState: (id: string) => (id === 'books' ? 'ga' : 'public_beta'),
      getModuleReleaseLabel: (id: string) => (id === 'books' ? 'GA' : 'BETA'),
      getModuleReleaseDescription: (id: string) =>
        id === 'books'
          ? 'Included in the production launch promise.'
          : 'Included at launch as a public beta.',
      isUserVisibleModule: (id: string) => id !== 'subs',
    };
  })(),
}));

vi.mock('@mylife/module-registry', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    useEnabledModules: () => [],
    useModuleRegistry: () => registry,
  };
});

vi.mock('../../../hooks/use-module-toggle', () => ({
  useModuleToggle: () => ({
    toggle: toggleMock,
    pendingConsent: null,
    confirmConsent: vi.fn(),
    declineConsent: vi.fn(),
  }),
}));

vi.mock('../../../components/DatabaseProvider', () => ({
  useDatabase: () => ({}),
}));

vi.mock('../../../lib/entitlements', () => ({
  getStoredEntitlement: () => ({
    appId: 'mylife',
    mode: 'hosted',
    hostedActive: true,
    selfHostLicense: false,
    features: [],
    issuedAt: '2026-01-01T00:00:00Z',
    signature: 'test-sig',
  }),
}));

vi.mock('@mylife/entitlements', () => ({
  isEntitlementExpired: () => false,
}));

vi.mock('@mylife/ui', () => {
  const React = require('react');
  const stub = (name: string) =>
    React.forwardRef((props: Record<string, unknown>, ref: unknown) =>
      React.createElement('div', { ...props, ref, 'data-testid': name }),
    );
  return {
    // Synthetic on purpose: importOriginal() here OOMs the fork (see
    // test/setup.tsx note). vitest 4 validates accessed exports, so add
    // missing ones explicitly.
    fontFamilies: {
      display: 'Plus Jakarta Sans',
      body: 'Inter',
      serif: 'Literata',
      fallback: 'sans-serif',
    },
    useThemeColors: () => ({
      background: '#131318',
      surface: '#2A292F',
      text: '#E4E1E9',
      textSecondary: '#D6C3B5',
      primary: '#FFB877',
      primaryContainer: '#C9894D',
      border: 'rgba(255,255,255,0.10)',
      glass: 'rgba(255,255,255,0.03)',
      glassStrong: 'rgba(255,255,255,0.08)',
      glassBorder: 'rgba(255,255,255,0.10)',
      tertiary: '#8BCFF0',
      danger: '#FFB4AB',
      success: '#30D158',
    }),
    useThemeLayout: () => ({
      spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
      radius: { sm: 4, md: 8, lg: 16, xl: 24 },
    }),
    useThemeSurfaces: () => ({
      cornerRadius: { card: 16, sheet: 24, pill: 999 },
    }),
    useTheme: () => ({
      profile: 'cool-obsidian',
      colors: { background: '#131318', surface: '#2A292F', text: '#E4E1E9' },
    }),
    Card: stub('Card'),
    Text: stub('Text'),
    HealthDataConsentDialog: () => null,
    colors: {
      background: '#0A0A0F', surface: '#12121A', surfaceElevated: '#1A1A24',
      text: '#F0F0F5', textSecondary: 'rgba(240,240,245,0.65)',
      textTertiary: 'rgba(240,240,245,0.4)', border: 'rgba(255,255,255,0.06)',
      danger: '#FF453A', success: '#30D158', accent: '#C9894D',
      hubAccent: '#C9894D', hubAccentLight: '#FFB877', modules: {},
    },
    surfaceTiers: { lowest: '#0E0E13', low: '#1B1B20', container: '#1F1F25', high: '#2A292F', highest: '#35343A' },
    glassFills: { subtle: 'rgba(255,255,255,0.04)', standard: 'rgba(255,255,255,0.08)', prominent: 'rgba(255,255,255,0.12)', dock: 'rgba(18,18,26,0.65)' },
    glassBorders: { subtle: 'rgba(255,255,255,0.06)', standard: 'rgba(255,255,255,0.10)', prominent: 'rgba(255,255,255,0.14)' },
    spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 },
    borderRadius: { sm: 4, md: 8, lg: 12, xl: 16, xxl: 24, pill: 999 },
  };
});

describe('Hub DiscoverScreen (mobile)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls toggle with selected module id when user has entitlement', () => {
    render(<DiscoverScreen />);

    fireEvent.click(screen.getByRole('button', { name: /MyBooks/i }));

    expect(toggleMock).toHaveBeenCalledWith('books');
  });

  it('renders launch state and enabled status badges', () => {
    render(<DiscoverScreen />);

    expect(screen.getAllByText('GA').length).toBeGreaterThan(0);
    expect(screen.getAllByText('BETA').length).toBeGreaterThan(0);
    // MyFast is free + enabled
    expect(screen.getAllByText('ON').length).toBeGreaterThan(0);
  });
});
