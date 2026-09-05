import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createElement } from 'react';

const {
  registry,
  enableModuleAction,
  disableModuleAction,
  hasActiveHealthConsentAction,
  recordHealthConsentAction,
} = vi.hoisted(() => ({
  registry: {
    isEnabled: vi.fn(),
    enable: vi.fn(),
    disable: vi.fn(),
  },
  enableModuleAction: vi.fn().mockResolvedValue(undefined),
  disableModuleAction: vi.fn().mockResolvedValue(undefined),
  hasActiveHealthConsentAction: vi.fn().mockResolvedValue(false),
  recordHealthConsentAction: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../actions', () => ({
  enableModuleAction,
  disableModuleAction,
  hasActiveHealthConsentAction,
  recordHealthConsentAction,
}));

vi.mock('@mylife/module-registry/hooks', () => ({
  useModuleRegistry: () => registry,
  useEnabledModules: () => [],
}));

vi.mock('@mylife/module-registry', () => ({
  GA_MODULE_IDS: ['books'],
  PUBLIC_BETA_MODULE_IDS: ['cycle'],
  getModuleReleaseState: (id: string) => (id === 'books' ? 'ga' : 'public_beta'),
  getModuleReleaseLabel: (id: string) => (id === 'books' ? 'GA' : 'BETA'),
  getModuleReleaseDescription: (id: string) =>
    id === 'books'
      ? 'Included in the production launch promise.'
      : 'Included at launch as a public beta.',
  isGeneralAvailabilityModule: (id: string) => id === 'books',
  isPublicBetaModule: (id: string) => id === 'cycle',
  isHealthDataModule: (id: string) => id === 'cycle',
  HEALTH_DATA_TYPES: {
    cycle: ['Cycle history', 'Symptoms'],
  },
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
    cycle: {
      id: 'cycle',
      name: 'MyCycle',
      tagline: 'Track patterns and predictions',
      icon: '🌙',
      accentColor: '#F472B6',
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
  WEB_VISIBLE_MODULE_IDS: ['books', 'cycle'],
}));

vi.mock('@/components/marketing/ReplaceCompetitorRing', () => ({
  ReplaceCompetitorRing: () => 'Replace ring',
}));

import DiscoverPage from '../page';

describe('DiscoverPage function quality gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    registry.isEnabled.mockReturnValue(false);
  });

  it('renders launch counts and the marketing ring', () => {
    render(createElement(DiscoverPage));

    expect(screen.getByText(/browse 2 web-supported modules/i)).toBeInTheDocument();
    expect(screen.getByText(/1 are GA and 1 are public beta/i)).toBeInTheDocument();
    expect(screen.getByText('Replace ring')).toBeInTheDocument();
  });

  it('enables a non-health module directly', async () => {
    const user = userEvent.setup();

    render(createElement(DiscoverPage));
    await user.click(screen.getAllByRole('button', { name: 'Enable' })[0]);

    expect(enableModuleAction).toHaveBeenCalledWith('books');
    expect(registry.enable).toHaveBeenCalledWith('books');
    expect(hasActiveHealthConsentAction).not.toHaveBeenCalled();
  });

  it('opens the consent dialog before enabling a health module', async () => {
    const user = userEvent.setup();

    render(createElement(DiscoverPage));
    await user.click(screen.getAllByRole('button', { name: 'Enable' })[1]);

    expect(hasActiveHealthConsentAction).toHaveBeenCalledWith('cycle');
    expect(screen.getByText(/health data consent/i)).toBeInTheDocument();
    expect(recordHealthConsentAction).not.toHaveBeenCalled();
  });

  it('records consent and enables the module after confirmation', async () => {
    const user = userEvent.setup();

    render(createElement(DiscoverPage));
    await user.click(screen.getAllByRole('button', { name: 'Enable' })[1]);
    await user.click(screen.getByRole('button', { name: 'I Consent' }));

    expect(recordHealthConsentAction).toHaveBeenCalledWith('cycle', [
      'Cycle history',
      'Symptoms',
    ]);
    expect(enableModuleAction).toHaveBeenCalledWith('cycle');
    expect(registry.enable).toHaveBeenCalledWith('cycle');
  });
});
