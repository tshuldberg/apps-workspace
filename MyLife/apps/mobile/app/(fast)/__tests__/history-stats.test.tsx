import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import FastHistoryScreen from '../history';
import FastStatsScreen from '../stats';

const mockDb = { id: 'mock-db' };

const listFastsMock = vi.fn();
const getStreaksMock = vi.fn();
const adherenceRateMock = vi.fn();
const averageDurationMock = vi.fn();
const durationTrendMock = vi.fn();
const weeklyRollupMock = vi.fn();
const getMonthlySummaryMock = vi.fn();
const getAnnualSummaryMock = vi.fn();
const formatSummaryShareTextMock = vi.fn();

vi.mock('react-native-view-shot', () => ({
  captureRef: vi.fn(),
}));

vi.mock('expo-sharing', () => ({
  isAvailableAsync: vi.fn(async () => false),
  shareAsync: vi.fn(),
}));

vi.mock('@mylife/fast', () => ({
  listFasts: (...args: unknown[]) => listFastsMock(...args),
  getStreaks: (...args: unknown[]) => getStreaksMock(...args),
  adherenceRate: (...args: unknown[]) => adherenceRateMock(...args),
  averageDuration: (...args: unknown[]) => averageDurationMock(...args),
  durationTrend: (...args: unknown[]) => durationTrendMock(...args),
  weeklyRollup: (...args: unknown[]) => weeklyRollupMock(...args),
  getMonthlySummary: (...args: unknown[]) => getMonthlySummaryMock(...args),
  getAnnualSummary: (...args: unknown[]) => getAnnualSummaryMock(...args),
  formatSummaryShareText: (...args: unknown[]) => formatSummaryShareTextMock(...args),
  // history.tsx additions (FAST-02)
  computeFastQualityScore: vi.fn(() => ({ total: 80, breakdown: { target: 40, hydration: 20, caffeine: 10, streak: 10 }, grade: 'B' })),
  getCaffeineLogsForDate: vi.fn(() => []),
  getDailyHydration: vi.fn(() => ({ totalHydrationOz: 64, totalGlasses: 8, meetsTarget: true, logCount: 8 })),
  getSetting: vi.fn(() => null),
  hasLateCaffeine: vi.fn(() => false),
  // stats.tsx additions (FAST-04)
  computeWeekInReview: vi.fn(() => ({ periodStart: '2026-01-01', periodEnd: '2026-01-07', totalFastingHours: 0, totalFasts: 0, completedFasts: 0, avgDailyHydrationOz: 0, avgCaffeineMg: 0, weightDelta: null, avgQualityScore: 0, streakAtEnd: 0, bestDay: null })),
  getBeverageLogs: vi.fn(() => []),
  getWeightEntries: vi.fn(() => []),
}));

vi.mock('../../../components/DatabaseProvider', () => ({
  useDatabase: () => mockDb,
}));

describe('Fast history and stats screens (mobile)', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    getStreaksMock.mockReturnValue({ currentStreak: 3, longestStreak: 9, totalFasts: 14 });

    listFastsMock.mockReturnValue([
      {
        id: 'fast-1',
        protocol: '16:8',
        startedAt: '2026-02-10T08:00:00.000Z',
        hitTarget: true,
        durationSeconds: 57600,
      },
    ]);

    averageDurationMock.mockReturnValue(43200);
    adherenceRateMock.mockReturnValue(82.5);
    weeklyRollupMock.mockReturnValue([
      { date: '2026-02-20', totalHours: 16 },
      { date: '2026-02-21', totalHours: 18 },
    ]);
    durationTrendMock.mockReturnValue([
      { date: '2026-02-20', durationHours: 16, movingAverage: 15.5 },
      { date: '2026-02-21', durationHours: 18, movingAverage: 16.0 },
    ]);
    getMonthlySummaryMock.mockReturnValue({
      totalFasts: 18,
      totalHours: 288,
      averageDurationHours: 16,
      longestFastHours: 24,
      currentStreak: 4,
      adherenceRate: 82.5,
    });
    getAnnualSummaryMock.mockReturnValue({
      totalFasts: 140,
      totalHours: 2240,
      averageDurationHours: 16,
      longestFastHours: 36,
      currentStreak: 4,
      adherenceRate: 80.1,
    });
    formatSummaryShareTextMock.mockReturnValue('summary');
  });

  it('renders grouped fast history with summary and empty state handling', () => {
    render(<FastHistoryScreen />);

    expect(screen.getByText('History')).toBeInTheDocument();
    expect(screen.getByText('16:8')).toBeInTheDocument();
    expect(screen.getByText('Hit Target')).toBeInTheDocument();
    expect(screen.getByText('16h')).toBeInTheDocument();
  });

  it('renders stats rollups and trend values', () => {
    render(<FastStatsScreen />);

    expect(screen.getByText('Avg Duration')).toBeInTheDocument();
    expect(screen.getByText('12.0h')).toBeInTheDocument();
    expect(screen.getAllByText('82.5%').length).toBeGreaterThan(0);
    expect(screen.getByText('Last 7 Days')).toBeInTheDocument();
    expect(screen.getByText('14-Day Trend')).toBeInTheDocument();
  });
});
