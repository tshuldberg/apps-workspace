import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

vi.mock('../actions', () => ({
  fetchDashboardData: vi.fn(),
}));

vi.mock('../charts', () => ({
  TinySparkline: () => <div data-testid="sparkline" />,
  RadialScore: ({ value, label }: { value: number; label: string }) => (
    <div data-testid="radial-score">
      {label}:{value}
    </div>
  ),
}));

import MedsPage from '../page';
import { fetchDashboardData } from '../actions';

const dashboardFixture = {
  generatedAt: '2026-04-07T12:00:00.000Z',
  summary: {
    todaySchedule: [
      {
        medicationId: 'med-1',
        medicationName: 'Metformin',
        scheduledTime: '2026-04-07T08:30:00.000Z',
        status: 'pending',
        dosage: '500 mg',
      },
    ],
    activeMedicationCount: 2,
    adherenceStreak: 12,
    todayProgress: {
      taken: 1,
      total: 3,
    },
    alerts: [{ id: 'alert-1' }],
  },
  wellness: {
    composite: 82,
    trend: 'steady',
    isConfident: true,
    components: [
      { name: 'Adherence', score: 92 },
      { name: 'Glucose', score: 78 },
    ],
  },
  overall: {
    totalMedications: 2,
    activeMedications: 2,
    overallAdherence30d: 92,
    moodEntries30d: 4,
    averageMoodScore: 0.4,
    symptomEntries30d: 2,
  },
  lowSupply: [
    {
      medicationId: 'med-1',
      name: 'Metformin',
      pillCount: 6,
      daysRemaining: 2,
    },
  ],
  appointments: [
    {
      id: 'appt-1',
      title: 'Cardiology follow-up',
      scheduledAt: '2026-04-10T15:00:00.000Z',
      providerName: 'Dr. Hale',
      specialty: null,
    },
  ],
  insights: [
    {
      id: 'insight-1',
      title: 'Morning BP improving',
      description: 'Systolic readings trend lower after the last schedule adjustment.',
      severity: 'warning',
    },
  ],
  prescriptions: [
    {
      id: 'med-1',
      name: 'Metformin',
      dosage: '500',
      unit: 'mg',
      frequency: 'daily',
      adherenceRate: 92,
      daysRemaining: 2,
    },
  ],
  vitalsGrid: [
    {
      id: 'bp',
      label: 'Blood Pressure',
      href: '/meds/bp',
      value: '118/76',
      unit: 'mmHg',
      tone: 'normal',
      trend: [{ label: '2026-04-01', value: 118 }],
    },
    {
      id: 'glucose',
      label: 'Glucose',
      href: '/meds/glucose',
      value: '108',
      unit: 'mg/dL',
      tone: 'in_range',
      trend: [{ label: '2026-04-01', value: 108 }],
    },
    {
      id: 'heart_rate',
      label: 'Heart Rate',
      href: '/meds/measurements',
      value: '64',
      unit: 'bpm',
      tone: 'normal',
      trend: [{ label: '2026-04-01', value: 64 }],
    },
  ],
};

describe('MedsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchDashboardData).mockResolvedValue(dashboardFixture);
  });

  it('renders the clinical dashboard shell with live data', async () => {
    render(<MedsPage />);

    await waitFor(() => {
      expect(screen.getByText('Clinical dashboard')).toBeInTheDocument();
    });

    expect(fetchDashboardData).toHaveBeenCalled();
    expect(screen.getByText('Low supply alert')).toBeInTheDocument();
    expect(screen.getAllByText('Metformin').length).toBeGreaterThan(0);
    expect(screen.getByText('Upcoming supply events')).toBeInTheDocument();
    expect(screen.getByText('Cardiology follow-up')).toBeInTheDocument();
    expect(screen.getByTestId('radial-score')).toHaveTextContent('steady:82');
  });
});
