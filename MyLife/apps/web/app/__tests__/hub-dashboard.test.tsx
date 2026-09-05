import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import type { ModuleDefinition } from '@mylife/module-registry';
import HubDashboard from '../all/page';

let enabledModules: ModuleDefinition[] = [];

vi.mock('@mylife/module-registry/hooks', () => ({
  useEnabledModules: () => enabledModules,
  FREE_MODULES: ['fast', 'forums', 'journal', 'market', 'mood', 'notes', 'voice'],
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));

vi.mock('@/components/UpdatePrompt', () => ({
  UpdatePrompt: () => null,
}));

vi.mock('@/components/EntitlementsProvider', () => ({
  useEntitlements: () => ({
    hubUnlocked: true,
    unlockedModules: new Set(['books', 'budget', 'surf', 'subs']),
    storageTier: 'pro',
    updateEntitled: false,
    purchaseDate: null,
  }),
  usePayment: () => ({ paymentService: null, refreshEntitlements: vi.fn() }),
}));

import { fetchDashboardSummaries, fetchActivityFeed, isOnboardingCompleteAction } from '../actions';

vi.mock('../actions', () => ({
  fetchDashboardSummaries: vi.fn().mockResolvedValue([]),
  fetchActivityFeed: vi.fn().mockResolvedValue([]),
  isOnboardingCompleteAction: vi.fn().mockResolvedValue(true),
}));

describe('HubDashboard', () => {
  beforeEach(() => {
    enabledModules = [];
    // Re-apply after vi.restoreAllMocks() in global afterEach
    vi.mocked(fetchDashboardSummaries).mockResolvedValue([]);
    vi.mocked(fetchActivityFeed).mockResolvedValue([]);
    vi.mocked(isOnboardingCompleteAction).mockResolvedValue(true);
  });

  it('shows empty state when no modules are enabled', async () => {
    render(<HubDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Welcome to MyLife')).toBeInTheDocument();
    });
    expect(
      screen.getByRole('link', { name: 'Discover Modules' }),
    ).toHaveAttribute('href', '/discover');
  });

  it('renders enabled module cards and active count', async () => {
    enabledModules = [
      {
        id: 'books',
        name: 'MyBooks',
        tagline: 'Track your reading life',
        icon: '📚',
        accentColor: '#C9894D',
        tier: 'premium',
        storageType: 'sqlite',
        navigation: { tabs: [], screens: [] },
        requiresAuth: false,
        requiresNetwork: false,
        version: '0.1.0',
      },
    ] as ModuleDefinition[];

    render(<HubDashboard />);

    await waitFor(() => {
      expect(screen.getByText('1 module active')).toBeInTheDocument();
    });
    expect(screen.getByText('MyBooks')).toBeInTheDocument();
  });

  it('filters out modules that are not web-supported', async () => {
    const unsupportedModule = {
      id: 'subs',
      name: 'MySubs',
      tagline: 'Subscription tracker',
      icon: '💳',
      accentColor: '#9CA3AF',
      tier: 'premium',
      storageType: 'sqlite',
      navigation: { tabs: [], screens: [] },
      requiresAuth: false,
      requiresNetwork: false,
      version: '0.1.0',
    } as unknown as ModuleDefinition;

    enabledModules = [
      {
        id: 'books',
        name: 'MyBooks',
        tagline: 'Track your reading life',
        icon: '📚',
        accentColor: '#C9894D',
        tier: 'premium',
        storageType: 'sqlite',
        navigation: { tabs: [], screens: [] },
        requiresAuth: false,
        requiresNetwork: false,
        version: '0.1.0',
      },
      unsupportedModule,
    ] as ModuleDefinition[];

    render(<HubDashboard />);

    await waitFor(() => {
      expect(screen.getByText('1 module active')).toBeInTheDocument();
    });
    expect(screen.queryByText('MySubs')).not.toBeInTheDocument();
  });
});
