import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import OnboardingModeScreen from '../onboarding-mode';

const replaceMock = vi.fn();
const incrementAggregateEventCounterMock = vi.fn();
const saveModeConfigMock = vi.fn();
const mockDb = {
  id: 'mock-db',
  execute: vi.fn(),
  query: vi.fn(() => []),
};

vi.mock('expo-router', () => ({
  useRouter: () => ({
    replace: replaceMock,
  }),
}));

vi.mock('../../../components/DatabaseProvider', () => ({
  useDatabase: () => mockDb,
}));

vi.mock('@mylife/db', () => ({
  incrementAggregateEventCounter: (...args: unknown[]) =>
    incrementAggregateEventCounterMock(...args),
}));

vi.mock('../../../lib/entitlements', () => ({
  saveModeConfig: (...args: unknown[]) => saveModeConfigMock(...args),
}));

describe('Hub OnboardingModeScreen (mobile)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.query.mockReturnValue([]);
  });

  it('saves hosted mode and returns to settings', () => {
    render(<OnboardingModeScreen />);

    fireEvent.click(screen.getByRole('button', { name: 'Use Hosted' }));

    expect(saveModeConfigMock).toHaveBeenCalledWith(
      mockDb,
      'hosted',
      null,
    );
    expect(incrementAggregateEventCounterMock).toHaveBeenCalledWith(
      mockDb,
      'mode_selected:hosted',
    );
    expect(replaceMock).toHaveBeenCalledWith('/(hub)/settings');
  });

  it('saves self-host mode with entered URL', () => {
    render(<OnboardingModeScreen />);

    fireEvent.change(screen.getByPlaceholderText('https://home.example.com'), {
      target: { value: 'https://home.example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Use Self-Host' }));

    expect(saveModeConfigMock).toHaveBeenCalledWith(
      mockDb,
      'self_host',
      'https://home.example.com',
    );
    expect(incrementAggregateEventCounterMock).toHaveBeenCalledWith(
      mockDb,
      'mode_selected:self_host',
    );
    expect(replaceMock).toHaveBeenCalledWith('/(hub)/settings');
  });

  it('saves local-only mode and clears server URL', () => {
    render(<OnboardingModeScreen />);

    fireEvent.click(screen.getByRole('button', { name: 'Use Local-Only' }));

    expect(saveModeConfigMock).toHaveBeenCalledWith(
      mockDb,
      'local_only',
      null,
    );
    expect(incrementAggregateEventCounterMock).toHaveBeenCalledWith(
      mockDb,
      'mode_selected:local_only',
    );
    expect(replaceMock).toHaveBeenCalledWith('/(hub)/settings');
  });
});
