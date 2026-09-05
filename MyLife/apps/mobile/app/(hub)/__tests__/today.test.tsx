import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// -----------------------------------------------------------------------------
// Mocks -- must be declared before the module under test is imported.
// -----------------------------------------------------------------------------

vi.mock('expo-router', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
}));

vi.mock('../../../hooks/use-onboarding', () => ({
  useOnboardingComplete: () => true,
}));

vi.mock('@mylife/db', () => ({
  getPreference: () => undefined,
}));

const aggregateTodayCardsMock = vi.fn();
const getDismissedCardIdsMock = vi.fn(() => new Set<string>());
const getQuickActionsForClustersMock = vi.fn();
const dismissCardTodayMock = vi.fn();
const enabledModulesMock = vi.fn(() => [] as unknown[]);

vi.mock('@mylife/module-registry', () => ({
  aggregateTodayCards: (...args: unknown[]) => aggregateTodayCardsMock(...args),
  dismissCardToday: (...args: unknown[]) => dismissCardTodayMock(...args),
  getDismissedCardIds: (...args: unknown[]) => getDismissedCardIdsMock(...args),
  getQuickActionsForClusters: (...args: unknown[]) =>
    getQuickActionsForClustersMock(...args),
  isUserVisibleModule: () => true,
  useEnabledModules: () => enabledModulesMock(),
}));

const DB_MOCK = {
  query: vi.fn(() => []),
  execute: vi.fn(),
  transaction: (fn: () => void) => fn(),
};

vi.mock('../../../components/DatabaseProvider', () => ({
  useDatabase: () => DB_MOCK,
}));

// The hub layout export used by the screen for bottom padding. Re-exporting the
// numeric constant avoids pulling in expo-blur / safe-area side effects from
// the real layout file at import time.
vi.mock('../_layout', () => ({
  HUB_TAB_BAR_CLEARANCE: 120,
}));

// -----------------------------------------------------------------------------
// Module under test (must import after all vi.mock calls above)
// -----------------------------------------------------------------------------

import TodayScreen from '../index';

describe('Hub TodayScreen (mobile)', () => {
  it('renders the empty state when zero modules are enabled', () => {
    enabledModulesMock.mockReturnValueOnce([]);
    aggregateTodayCardsMock.mockReturnValueOnce([]);
    getQuickActionsForClustersMock.mockReturnValueOnce([]);

    render(<TodayScreen />);

    expect(screen.getByText('Enable a module to see your day')).toBeInTheDocument();
    expect(screen.getByText('Browse Modules')).toBeInTheDocument();
  });

  it('renders an aggregated card in the "Your day" section', () => {
    enabledModulesMock.mockReturnValueOnce([
      { id: 'health', name: 'MyHealth' },
    ]);
    aggregateTodayCardsMock.mockReturnValueOnce([
      {
        id: 'health:vitals-today',
        moduleId: 'health',
        kind: 'action',
        priority: 80,
        title: 'Log your vitals',
        subtitle: 'Takes 30 seconds',
        cta: { label: 'Open', route: '/health/vitals/new' },
        dismissible: true,
      },
    ]);
    getQuickActionsForClustersMock.mockReturnValueOnce([]);

    render(<TodayScreen />);

    expect(screen.getByText('YOUR DAY')).toBeInTheDocument();
    expect(screen.getByText('Log your vitals')).toBeInTheDocument();
    expect(screen.getByText('Takes 30 seconds')).toBeInTheDocument();
  });

  it('hides the Quick Actions row when no quick actions resolve', () => {
    enabledModulesMock.mockReturnValueOnce([
      { id: 'journal', name: 'MyJournal' },
    ]);
    aggregateTodayCardsMock.mockReturnValueOnce([
      {
        id: 'journal:insight',
        moduleId: 'journal',
        kind: 'insight',
        priority: 40,
        title: 'Seven-day streak',
        dismissible: false,
      },
    ]);
    getQuickActionsForClustersMock.mockReturnValueOnce([]);

    render(<TodayScreen />);

    // THIS WEEK section renders the insight card; QUICK row must NOT render.
    expect(screen.getByText('THIS WEEK')).toBeInTheDocument();
    expect(screen.getByText('Seven-day streak')).toBeInTheDocument();
    expect(screen.queryByText('QUICK')).toBeNull();
  });
});
