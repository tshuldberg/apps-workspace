import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  enableModuleAction,
  disableModuleAction,
} from '../actions';
import DiscoverPage from '../discover/page';

const registry = {
  isEnabled: vi.fn(),
  enable: vi.fn(),
  disable: vi.fn(),
};

vi.mock('../actions', () => ({
  enableModuleAction: vi.fn().mockResolvedValue(undefined),
  disableModuleAction: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@mylife/module-registry/hooks', () => ({
  useModuleRegistry: () => registry,
  useEnabledModules: () => [],
}));

vi.mock('@mylife/module-registry', () => ({
  GA_MODULE_IDS: ['books'],
  PUBLIC_BETA_MODULE_IDS: ['workouts'],
  getModuleReleaseState: (id: string) => (id === 'books' ? 'ga' : 'public_beta'),
  getModuleReleaseLabel: (id: string) => (id === 'books' ? 'GA' : 'BETA'),
  getModuleReleaseDescription: (id: string) =>
    id === 'books'
      ? 'Included in the production launch promise.'
      : 'Included at launch as a public beta.',
  isGeneralAvailabilityModule: (id: string) => id === 'books',
  isPublicBetaModule: (id: string) => id !== 'books',
  isUserVisibleModule: (id: string) => id !== 'subs',
  isHealthDataModule: vi.fn().mockReturnValue(false),
  HEALTH_DATA_TYPES: {},
  MODULE_METADATA: {
    books: {
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
  },
}));

vi.mock('@/lib/modules', () => ({
  WEB_SUPPORTED_MODULE_IDS: ['books'],
  WEB_VISIBLE_MODULE_IDS: ['books'],
}));

describe('DiscoverPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('enables a module when Enable is clicked', async () => {
    registry.isEnabled.mockReturnValue(false);
    const user = userEvent.setup();

    render(<DiscoverPage />);
    await user.click(screen.getByRole('button', { name: 'Enable' }));

    expect(enableModuleAction).toHaveBeenCalledWith('books');
    expect(registry.enable).toHaveBeenCalledWith('books');
    expect(disableModuleAction).not.toHaveBeenCalled();
  });

  it('disables a module when Enabled is clicked', async () => {
    registry.isEnabled.mockReturnValue(true);
    const user = userEvent.setup();

    render(<DiscoverPage />);
    await user.click(screen.getByRole('button', { name: 'Enabled' }));

    expect(disableModuleAction).toHaveBeenCalledWith('books');
    expect(registry.disable).toHaveBeenCalledWith('books');
    expect(enableModuleAction).not.toHaveBeenCalled();
  });

  it('shows launch-state messaging for GA modules', () => {
    registry.isEnabled.mockReturnValue(false);

    render(<DiscoverPage />);

    expect(screen.getByText(/1 are GA and 0 are public beta/i)).toBeInTheDocument();
    expect(screen.getByText('GA')).toBeInTheDocument();
    expect(
      screen.getByText('Included in the production launch promise.'),
    ).toBeInTheDocument();
  });
});
