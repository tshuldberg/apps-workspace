import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SettingsScreen from '../settings';

const pushMock = vi.fn();
const refreshEntitlementFromServerMock = vi.fn();

vi.mock('expo-router', () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}));

vi.mock('../../../components/DatabaseProvider', () => ({
  useDatabase: () => ({ id: 'mock-db' }),
}));

vi.mock('../../../components/EntitlementsProvider', () => ({
  useEntitlements: () => ({ entitled: false, source: 'free', loading: false }),
  usePayment: () => ({
    paymentService: null,
    refreshEntitlements: vi.fn(),
  }),
}));

vi.mock('../../../lib/entitlements', () => ({
  getModeConfig: () => ({
    mode: 'local_only',
    serverUrl: null,
  }),
  getStoredEntitlement: () => null,
  refreshEntitlementFromServer: (...args: unknown[]) =>
    refreshEntitlementFromServerMock(...args),
}));

vi.mock('@mylife/auth', () => ({
  useLocalAuth: () => ({
    user: null,
    isAuthenticated: false,
    signOut: vi.fn(),
  }),
}));

vi.mock('@mylife/db', () => ({
  listAllHealthConsents: () => [],
  withdrawHealthConsent: vi.fn(),
  getEnabledModules: () => [],
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
    Card: stub('Card'),
    Text: stub('Text'),
    HealthDataConsentDialog: () => null,
    colors: {
      background: '#0A0A0F',
      surface: '#12121A',
      surfaceElevated: '#1A1A24',
      text: '#F0F0F5',
      textSecondary: 'rgba(240,240,245,0.65)',
      textTertiary: 'rgba(240,240,245,0.4)',
      border: 'rgba(255,255,255,0.06)',
      danger: '#FF453A',
      success: '#30D158',
      accent: '#C9894D',
      hubAccent: '#C9894D',
      hubAccentLight: '#FFB877',
      modules: {},
    },
    surfaceTiers: { lowest: '#0E0E13', low: '#1B1B20', container: '#1F1F25', high: '#2A292F', highest: '#35343A' },
    glassFills: { subtle: 'rgba(255,255,255,0.04)', standard: 'rgba(255,255,255,0.08)', prominent: 'rgba(255,255,255,0.12)', dock: 'rgba(18,18,26,0.65)' },
    glassBorders: { subtle: 'rgba(255,255,255,0.06)', standard: 'rgba(255,255,255,0.10)', prominent: 'rgba(255,255,255,0.14)' },
    spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 },
    borderRadius: { sm: 4, md: 8, lg: 12, xl: 16, xxl: 24, pill: 999 },
  };
});

/** Minimal MODULE_METADATA stubs for health modules rendered by the settings screen. */
const healthModuleMeta: Record<string, { icon: string; name: string }> = {
  cycle: { icon: '🔄', name: 'MyCycle' },
  fast: { icon: '⏱️', name: 'MyFast' },
  habits: { icon: '✅', name: 'MyHabits' },
  health: { icon: '❤️', name: 'MyHealth' },
  meds: { icon: '💊', name: 'MyMeds' },
  mood: { icon: '😊', name: 'MyMood' },
  nutrition: { icon: '🥗', name: 'MyNutrition' },
  presence: { icon: '📱', name: 'MyPresence' },
  workouts: { icon: '💪', name: 'MyWorkouts' },
};

vi.mock('@mylife/module-registry', () => ({
  GA_MODULE_IDS: ['books', 'budget', 'fast', 'habits', 'health', 'meds', 'recipes', 'rsvp', 'words'],
  PUBLIC_BETA_MODULE_IDS: [
    'car', 'closet', 'cycle', 'flash', 'garden', 'homes', 'journal',
    'mail', 'mood', 'notes', 'nutrition', 'pets', 'stars', 'surf',
    'trails', 'voice', 'workouts',
  ],
  HEALTH_DATA_MODULE_IDS: [
    'cycle', 'fast', 'habits', 'health', 'meds', 'mood', 'nutrition', 'presence', 'workouts',
  ],
  MODULE_METADATA: new Proxy({} as Record<string, unknown>, {
    get: (_target, prop: string) => healthModuleMeta[prop] ?? { icon: '📦', name: prop },
  }),
  FREE_MODULES: ['fast', 'journal', 'mood', 'notes', 'voice'],
  isHealthDataModule: (id: string) =>
    ['cycle', 'fast', 'habits', 'health', 'meds', 'mood', 'nutrition', 'presence', 'workouts'].includes(id),
}));

describe('Hub SettingsScreen (mobile)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    refreshEntitlementFromServerMock.mockResolvedValue({ ok: true });
  });

  it('navigates to onboarding mode and self-host setup from buttons', () => {
    render(<SettingsScreen />);

    // The "Change Mode" CTA was replaced with a SYNC_MODES segmented control
    // (Local / P2P / Cloud); each segment routes to /(hub)/onboarding-mode.
    fireEvent.click(screen.getByText('Local'));
    fireEvent.click(screen.getByRole('button', { name: 'Self-Host Setup' }));

    expect(pushMock).toHaveBeenNthCalledWith(1, '/(hub)/onboarding-mode');
    expect(pushMock).toHaveBeenNthCalledWith(2, '/(hub)/self-host');
  });

  it('refreshes entitlement and shows success message', async () => {
    render(<SettingsScreen />);

    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));

    await waitFor(() => {
      expect(refreshEntitlementFromServerMock).toHaveBeenCalledTimes(1);
      expect(screen.getByText('Entitlement refreshed.')).toBeInTheDocument();
    });
  });

  it('shows failure message when entitlement refresh fails', async () => {
    refreshEntitlementFromServerMock.mockResolvedValue({
      ok: false,
      reason: 'network_unreachable',
    });

    render(<SettingsScreen />);
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));

    await waitFor(() => {
      expect(
        screen.getByText('Refresh failed: network_unreachable'),
      ).toBeInTheDocument();
    });
  });

  it('describes the GA launch promise instead of claiming all modules', () => {
    render(<SettingsScreen />);

    expect(
      screen.getByText(/guarantees 9 production-ready modules/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/17 more in public beta/i)).toBeInTheDocument();
  });
});
