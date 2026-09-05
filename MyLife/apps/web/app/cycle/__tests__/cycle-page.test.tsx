import { render, screen, waitFor } from '@testing-library/react';
import { fetchCycleHomeDashboard } from '../actions';
import CycleTodayPage from '../page';

vi.mock('../actions', () => ({
  fetchCycleHomeDashboard: vi.fn(),
}));

vi.mock('../ui', () => ({
  PHASE_COLORS: {
    menstrual: '#EF4444',
    follicular: '#FBCFE8',
    ovulation: '#F472B6',
    luteal: '#FDA4AF',
  },
  TOKENS: {
    accent: '#C9894D',
    accentLight: '#FFB877',
    accentWash: 'rgba(201,137,77,0.12)',
    accentGlow: 'rgba(255,184,119,0.22)',
    text: '#E4E1E9',
    textSecondary: '#D6C3B5',
    textTertiary: '#9F8E81',
    background: '#0E0E13',
    base: '#131318',
    low: '#1B1B20',
    mid: '#1F1F25',
    high: '#2A292F',
    highest: '#35343A',
    glass: 'rgba(255,255,255,0.03)',
    glassStrong: 'rgba(255,255,255,0.08)',
    success: '#30D158',
    danger: '#FF453A',
    info: '#8BCFF0',
    fertile: '#34D399',
  },
  eyebrowStyle: {},
  fabLinkStyle: {},
  ghostButtonStyle: {},
  gradientButtonStyle: {},
  panelStyle: vi.fn(() => ({})),
  statValueStyle: {},
  subtitleStyle: {},
  titleStyle: {},
}));

describe('CycleTodayPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders empty state when no cycles exist', async () => {
    vi.mocked(fetchCycleHomeDashboard).mockResolvedValue({
      today: '2026-04-06',
      stats: {
        totalCycles: 0,
        averageCycleLength: null,
        averagePeriodLength: null,
        shortestCycle: null,
        longestCycle: null,
        cycleLengthStdDev: null,
      },
      currentPhase: null,
      dayOfCycle: null,
      currentCycle: null,
      prediction: null,
      cycleLength: 28,
      periodLength: 5,
      recentCycles: [],
    });

    render(<CycleTodayPage />);

    await waitFor(() => {
      expect(screen.getByText('Your cycle journey starts here')).toBeInTheDocument();
    });
    expect(screen.getByText('Start Tracking')).toBeInTheDocument();
  });

  it('renders dashboard with stats when cycles exist', async () => {
    vi.mocked(fetchCycleHomeDashboard).mockResolvedValue({
      today: '2026-04-06',
      stats: {
        totalCycles: 12,
        averageCycleLength: 28.3,
        averagePeriodLength: 5.2,
        shortestCycle: 26,
        longestCycle: 31,
        cycleLengthStdDev: 1.8,
      },
      currentPhase: 'ovulation',
      dayOfCycle: 14,
      currentCycle: {
        id: 'c1',
        startDate: '2026-03-10',
        endDate: null,
        lengthDays: null,
        periodLength: 5,
        notes: null,
        createdAt: '2026-03-10T00:00:00.000Z',
        updatedAt: '2026-03-10T00:00:00.000Z',
      },
      prediction: {
        predictedStartDate: '2026-04-20',
        predictedEndDate: '2026-04-24',
        fertileWindowStart: '2026-04-08',
        fertileWindowEnd: '2026-04-12',
        confidence: 0.87,
        daysUntilNextPeriod: 14,
      },
      cycleLength: 28,
      periodLength: 5,
      recentCycles: [
        {
          id: 'c1',
          startDate: '2026-03-10',
          endDate: null,
          lengthDays: null,
          periodLength: 5,
          notes: null,
          createdAt: '2026-03-10T00:00:00.000Z',
          updatedAt: '2026-03-10T00:00:00.000Z',
        },
      ],
    });

    render(<CycleTodayPage />);

    await waitFor(() => {
      expect(screen.getByText('Day 14')).toBeInTheDocument();
    });
    expect(screen.getAllByText('Ovulation phase').length).toBeGreaterThan(0);
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('28.3d')).toBeInTheDocument();
  });

  it('renders error state with retry button', async () => {
    vi.mocked(fetchCycleHomeDashboard).mockRejectedValue(new Error('DB error'));

    render(<CycleTodayPage />);

    await waitFor(() => {
      expect(screen.getByText('DB error')).toBeInTheDocument();
    });
    expect(screen.getByText('Retry')).toBeInTheDocument();
  });
});
