import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import HealthTodayScreen from '../index';

const getSleepJournalContextMock = vi.fn();
const setManualSleepBridgeEnabledMock = vi.fn();

vi.mock('@mylife/health', () => ({
  getActiveMedications: () => [],
  getDoseLogsForDate: () => [],
  getMoodEntriesForDate: () => [],
  getLatestVital: () => null,
  getLastNightSleep: () => null,
  getActiveGoals: () => [],
  getSleepJournalContext: (...args: unknown[]) => getSleepJournalContextMock(...args),
  setManualSleepBridgeEnabled: (...args: unknown[]) =>
    setManualSleepBridgeEnabledMock(...args),
}));

vi.mock('@mylife/fast', () => ({
  getActiveFast: () => null,
}));

vi.mock('../../../components/DatabaseProvider', () => ({
  useDatabase: () => ({ id: 'mock-db' }),
}));

vi.mock('expo-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

describe('HealthTodayScreen (mobile)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSleepJournalContextMock.mockReturnValue(null);
  });

  it('renders empty state with quick actions', () => {
    render(<HealthTodayScreen />);
    expect(screen.getByText('Today')).toBeTruthy();
    expect(screen.getByText('Fast')).toBeTruthy();
    expect(screen.getAllByText('Mood').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Measure')).toBeTruthy();
    expect(screen.getByText('Goal')).toBeTruthy();
  });

  it('shows empty medication state', () => {
    render(<HealthTodayScreen />);
    expect(screen.getByText('No medications tracked')).toBeTruthy();
  });

  it('shows placeholder vitals', () => {
    render(<HealthTodayScreen />);
    const dashes = screen.getAllByText('--');
    expect(dashes.length).toBeGreaterThanOrEqual(3);
  });

  it('shows explicit MySleep journal consent context', () => {
    getSleepJournalContextMock.mockReturnValue({
      status: 'needs_consent',
      title: 'Connect MySleep journal',
      body: 'Review the MySleep preview before sharing aggregate manual sleep journal trends with MyHealth.',
      ctaLabel: 'Review Preview',
      ctaRoute: '/sleep/insights',
      summary: null,
      bridgeStatus: {
        state: 'needs_consent',
        enabled: false,
        settingKey: 'bridge.sleepJournal.enabled',
        copy: 'Review the MySleep preview before sharing aggregate manual sleep journal trends with MyHealth.',
      },
    });

    render(<HealthTodayScreen />);

    expect(screen.getByText('MySleep Journal')).toBeTruthy();
    expect(screen.getByText('Connect MySleep journal')).toBeTruthy();
    expect(screen.getByText('Enable Summary Bridge')).toBeTruthy();
  });
});
