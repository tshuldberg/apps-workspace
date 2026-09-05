import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
// Phase 3a: the old bento + module-grid home relocated to /(hub)/all.
// The test keeps covering that surface against its new route file.
import HubAllModulesScreen from '../all';

vi.mock('expo-router', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
}));

vi.mock('../../hooks/use-onboarding', () => ({
  useOnboardingComplete: () => true,
}));

// Use modules whose release state is currently user-visible (GA or public beta).
// books and fast are hidden in release-states.ts, so the dashboard's
// isUserVisibleModule filter would strip them and leave the library grid empty.
const ENABLED_MODULES = [
  { id: 'budget', name: 'MyBudget', tagline: 'Budget', icon: '💰', accentColor: '#10B981' },
  { id: 'habits', name: 'MyHabits', tagline: 'Habits', icon: '✅', accentColor: '#8B5CF6' },
];

vi.mock('@mylife/module-registry', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    MODULE_METADATA: {
      budget: { id: 'budget', name: 'MyBudget', tagline: 'Budget', icon: '💰', accentColor: '#10B981' },
      habits: { id: 'habits', name: 'MyHabits', tagline: 'Habits', icon: '✅', accentColor: '#8B5CF6' },
    },
    MODULE_ICONS: {
      budget: 'wallet',
      habits: 'check-square',
    },
    aggregateDashboardData: () => new Map(),
    useEnabledModules: () => ENABLED_MODULES,
  };
});

vi.mock('@mylife/db', () => ({
  getVisibleDashboardCards: () => [],
}));

const DB_MOCK = {
  query: () => [],
  execute: () => {},
  transaction: (fn: () => void) => fn(),
};

vi.mock('../../../components/DatabaseProvider', () => ({
  useDatabase: () => DB_MOCK,
}));

describe('Hub all-modules grid (mobile)', () => {
  it('shows the greeting and enabled modules in library grid', () => {
    render(<HubAllModulesScreen />);

    // Greeting should be time-dependent
    const greeting = screen.queryByText(/Good morning|Good afternoon|Good evening/);
    expect(greeting).toBeInTheDocument();

    // Enabled modules appear in library grid (label = name with My stripped).
    // The grid can render the label more than once (card + tagline), so
    // assert presence rather than uniqueness.
    expect(screen.getAllByText('Budget').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Habits').length).toBeGreaterThan(0);

    // Library header
    expect(screen.getByText('LIBRARY MODULES')).toBeInTheDocument();
    expect(screen.getByText('2 ACTIVE')).toBeInTheDocument();
  });
});
