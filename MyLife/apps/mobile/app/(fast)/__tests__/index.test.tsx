import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import FastTimerScreen from '../index';

const mockDb = { id: 'mock-db' };

const computeTimerStateMock = vi.fn();
const formatDurationMock = vi.fn();
const getActiveFastMock = vi.fn();
const getProtocolsMock = vi.fn();
const getStreaksMock = vi.fn();
const refreshStreakCacheMock = vi.fn();
const startFastMock = vi.fn();
const endFastMock = vi.fn();
const getCurrentFastingZoneMock = vi.fn();
const getCurrentZoneProgressMock = vi.fn();
const getWaterIntakeMock = vi.fn();
const incrementWaterIntakeMock = vi.fn();
const listGoalsMock = vi.fn();
const getGoalProgressMock = vi.fn();
const refreshGoalProgressMock = vi.fn();

vi.mock('@mylife/fast', () => ({
  computeTimerState: (...args: unknown[]) => computeTimerStateMock(...args),
  formatDuration: (...args: unknown[]) => formatDurationMock(...args),
  getActiveFast: (...args: unknown[]) => getActiveFastMock(...args),
  getProtocols: (...args: unknown[]) => getProtocolsMock(...args),
  getStreaks: (...args: unknown[]) => getStreaksMock(...args),
  refreshStreakCache: (...args: unknown[]) => refreshStreakCacheMock(...args),
  startFast: (...args: unknown[]) => startFastMock(...args),
  endFast: (...args: unknown[]) => endFastMock(...args),
  getCurrentFastingZone: (...args: unknown[]) => getCurrentFastingZoneMock(...args),
  getCurrentZoneProgress: (...args: unknown[]) => getCurrentZoneProgressMock(...args),
  getWaterIntake: (...args: unknown[]) => getWaterIntakeMock(...args),
  incrementWaterIntake: (...args: unknown[]) => incrementWaterIntakeMock(...args),
  listGoals: (...args: unknown[]) => listGoalsMock(...args),
  getGoalProgress: (...args: unknown[]) => getGoalProgressMock(...args),
  refreshGoalProgress: (...args: unknown[]) => refreshGoalProgressMock(...args),
  suggestNextProtocol: vi.fn(() => ({ currentProtocolId: '16:8', suggestedProtocolId: null, reason: '', consecutiveSuccesses: 0, threshold: 7 })),
  listFasts: vi.fn(() => []),
  getSetting: vi.fn(() => null),
  setSetting: vi.fn(),
}));

vi.mock('../../../components/DatabaseProvider', () => ({
  useDatabase: () => mockDb,
}));

vi.mock('../../../lib/uuid', () => ({
  uuid: () => 'uuid-123',
}));

describe('FastTimerScreen (mobile)', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    formatDurationMock.mockReturnValue('01:00:00');
    getActiveFastMock.mockReturnValue(null);
    getProtocolsMock.mockReturnValue([
      {
        id: '16:8',
        name: '16:8',
        fasting_hours: 16,
        eating_hours: 8,
      },
      {
        id: '18:6',
        name: '18:6',
        fasting_hours: 18,
        eating_hours: 6,
      },
    ]);
    getStreaksMock.mockReturnValue({ currentStreak: 4, longestStreak: 10, totalFasts: 28 });
    computeTimerStateMock.mockReturnValue({
      state: 'idle',
      elapsed: 0,
      remaining: 0,
      progress: 0,
      targetReached: false,
    });
    getCurrentFastingZoneMock.mockReturnValue({
      name: 'Fat Burn',
      title: 'Fat Burn Zone',
      description: 'Primary fat oxidation window.',
    });
    getCurrentZoneProgressMock.mockReturnValue(0.4);
    getWaterIntakeMock.mockReturnValue({
      date: '2026-03-01',
      count: 2,
      target: 8,
      completed: false,
      updatedAt: '2026-03-01T10:00:00.000Z',
    });
    incrementWaterIntakeMock.mockReturnValue({
      date: '2026-03-01',
      count: 3,
      target: 8,
      completed: false,
      updatedAt: '2026-03-01T10:05:00.000Z',
    });
    listGoalsMock.mockReturnValue([]);
    getGoalProgressMock.mockReturnValue(null);
  });

  it('starts a fast with selected protocol', () => {
    render(<FastTimerScreen />);

    fireEvent.click(screen.getByRole('button', { name: '18:6' }));
    fireEvent.click(screen.getByRole('button', { name: 'Start Fast' }));

    expect(startFastMock).toHaveBeenCalledWith(mockDb, 'uuid-123', '18:6', 18);
    expect(screen.getByText('Current Streak')).toBeInTheDocument();
    expect(screen.getByText('Total Fasts')).toBeInTheDocument();
  });

  it('ends an active fast and refreshes streak cache', () => {
    computeTimerStateMock.mockReturnValue({
      state: 'fasting',
      elapsed: 3600,
      remaining: 1800,
      progress: 0.67,
      targetReached: false,
    });

    render(<FastTimerScreen />);

    fireEvent.click(screen.getByRole('button', { name: 'End Fast' }));

    expect(endFastMock).toHaveBeenCalledWith(mockDb, expect.any(Date));
    expect(refreshStreakCacheMock).toHaveBeenCalledWith(mockDb);
  });
});
