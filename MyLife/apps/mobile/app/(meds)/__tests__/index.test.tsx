import type { ReactNode } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import TodayScreen from '../(tabs)/index';

const mockDb = {
  execute: vi.fn(),
  query: vi.fn(),
  transaction: vi.fn((callback: () => void) => callback()),
};

const decrementPillCountMock = vi.fn();
const getLowSupplyAlertsMock = vi.fn();
const getMoodEntriesForDateMock = vi.fn();
const getRegimenSummaryMock = vi.fn();
const getRemindersForMedicationMock = vi.fn();
const getWellnessScoreMock = vi.fn();
const logDoseMock = vi.fn();
const snoozeReminderMock = vi.fn();

vi.mock('@mylife/meds', () => ({
  decrementPillCount: (...args: unknown[]) => decrementPillCountMock(...args),
  getLowSupplyAlerts: (...args: unknown[]) => getLowSupplyAlertsMock(...args),
  getMoodEntriesForDate: (...args: unknown[]) => getMoodEntriesForDateMock(...args),
  getRegimenSummary: (...args: unknown[]) => getRegimenSummaryMock(...args),
  getRemindersForMedication: (...args: unknown[]) => getRemindersForMedicationMock(...args),
  getWellnessScore: (...args: unknown[]) => getWellnessScoreMock(...args),
  logDose: (...args: unknown[]) => logDoseMock(...args),
  snoozeReminder: (...args: unknown[]) => snoozeReminderMock(...args),
}));

vi.mock('@mylife/meds/ui', () => ({
  DoseCard: ({
    medication,
    onPress,
    onSkip,
    onSnooze,
    onTake,
  }: {
    medication: string;
    onPress?: () => void;
    onSkip?: () => void;
    onSnooze?: () => void;
    onTake?: () => void;
  }) => (
    <div>
      <span>{medication}</span>
      {onPress ? <button onClick={onPress}>Open dose</button> : null}
      {onTake ? <button aria-label="Take dose" onClick={onTake}>Take</button> : null}
      {onSkip ? <button aria-label="Skip dose" onClick={onSkip}>Skip</button> : null}
      {onSnooze ? <button aria-label="Snooze dose" onClick={onSnooze}>Snooze</button> : null}
    </div>
  ),
  GlassCard: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  MD_ACCENT_LIGHT: '#7dd3fc',
  MD_CHROME_GOLD: '#fbbf24',
  MD_DOSE_STATUS: {
    due: { text: '#fff' },
    late: { text: '#fff' },
    skipped: { text: '#fff' },
    taken: { text: '#fff' },
    upcoming: { text: '#fff' },
  },
  MD_FONTS: {
    bold: 'System',
    extraBold: 'System',
    medium: 'System',
    semiBold: 'System',
  },
  MD_SURFACES: {
    base: '#111827',
    elevated: '#1f2937',
    high: '#1f2937',
    low: '#111827',
  },
  MD_TEXT: '#f9fafb',
  MD_TEXT_SECONDARY: '#d1d5db',
  MD_TEXT_TERTIARY: '#9ca3af',
  MD_TYPOGRAPHY: {
    bodyMd: {},
    bodySm: {},
    headlineMd: {},
    labelUpper: {},
    titleMd: {},
    titleSm: {},
  },
  MoodChip: ({ mood, onPress }: { mood: string; onPress?: () => void }) => (
    <button onClick={onPress}>{mood}</button>
  ),
  SectionHeader: ({
    action,
    title,
  }: {
    action?: ReactNode;
    title: string;
  }) => (
    <div>
      <span>{title}</span>
      {action}
    </div>
  ),
  VitalStat: ({
    label,
    value,
  }: {
    label: string;
    value: string;
  }) => (
    <div>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  ),
  WellnessRing: ({ score }: { score: number }) => <div>{score}</div>,
  withAlpha: (color: string) => color,
}));

vi.mock('../../../components/meds/phase1', () => ({
  EmptyGlassState: ({
    actionLabel,
    message,
    onPress,
    title,
  }: {
    actionLabel?: string;
    message: string;
    onPress?: () => void;
    title: string;
  }) => (
    <div>
      <span>{title}</span>
      <span>{message}</span>
      {actionLabel ? <button onClick={onPress}>{actionLabel}</button> : null}
    </div>
  ),
  MetricBadge: ({
    label,
    value,
  }: {
    label: string;
    value: string | number;
  }) => (
    <div>
      <span>{label}</span>
      <span>{String(value)}</span>
    </div>
  ),
  ProgressBar: () => <div>progress</div>,
  ScreenTitleBlock: ({
    eyebrow,
    subtitle,
    title,
  }: {
    eyebrow?: string;
    subtitle?: string;
    title: string;
  }) => (
    <div>
      {eyebrow ? <span>{eyebrow}</span> : null}
      <span>{title}</span>
      {subtitle ? <span>{subtitle}</span> : null}
    </div>
  ),
  SectionStack: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  createDoseTone: (status: string) => (status === 'pending' ? 'due' : status),
  formatRelativeMinutes: () => 'in 15 min',
  getPartOfDayLabel: () => 'Morning',
  parseMedsDashboardSections: () => [
    { density: 'expanded', enabled: true, id: 'schedule', label: 'Schedule' },
    { density: 'expanded', enabled: true, id: 'vitals', label: 'Vitals' },
    { density: 'expanded', enabled: true, id: 'wellness', label: 'Wellness' },
    { density: 'compact', enabled: true, id: 'mood', label: 'Mood' },
    { density: 'compact', enabled: true, id: 'refills', label: 'Refills' },
  ],
  toDateKey: (date: Date) => date.toISOString().slice(0, 10),
}));

vi.mock('../../../components/DatabaseProvider', () => ({
  useDatabase: () => mockDb,
}));

const pushMock = vi.fn();

vi.mock('expo-router', () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn(), back: vi.fn() }),
}));

vi.mock('../../../lib/uuid', () => ({
  uuid: () => 'uuid-123',
}));

describe('TodayScreen (mobile)', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();

    mockDb.query.mockImplementation((sql: string, params?: unknown[]) => {
      if (sql.includes('hub_settings') && params?.[0] === 'meds.home_style') {
        return [{ value: 'timeline' }];
      }
      if (sql.includes('hub_settings') && params?.[0] === 'meds.dashboard_sections') {
        return [];
      }
      return [];
    });

    getRegimenSummaryMock.mockReturnValue({
      activeMedicationCount: 2,
      adherence7d: 92,
      adherenceStreak: 4,
      alerts: [],
      date: '2026-04-07',
      todayProgress: { taken: 1, total: 2 },
      todaySchedule: [
        {
          dosage: '500mg',
          medicationId: 'med-1',
          medicationName: 'Metformin',
          scheduledTime: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
          status: 'pending',
        },
      ],
      topInsights: [{ id: 'ins-1', title: 'Weekend adherence dip' }],
      vitals: {
        latestA1c: null,
        latestBP: {
          category: 'normal',
          diastolic: 78,
          measuredAt: '2026-04-07T09:00:00.000Z',
          systolic: 118,
        },
        latestGlucose: {
          measuredAt: '2026-04-07T09:00:00.000Z',
          rangeStatus: 'in_range',
          unit: 'mg/dL',
          value: 108,
        },
      },
      wellnessTrend: 'stable',
    });

    getMoodEntriesForDateMock.mockReturnValue([]);
    getLowSupplyAlertsMock.mockReturnValue([
      {
        daysRemaining: 4,
        medicationId: 'med-1',
        name: 'Metformin',
        pillCount: 8,
      },
    ]);
    getWellnessScoreMock.mockReturnValue({
      calculatedAt: '2026-04-07T09:00:00.000Z',
      composite: 81,
      components: [
        {
          dataPoints: 7,
          explanation: 'Excellent recent adherence.',
          name: 'Adherence',
          score: 92,
          weight: 0.4,
        },
      ],
      isConfident: true,
      trend: 'stable',
    });
    getRemindersForMedicationMock.mockReturnValue([
      {
        createdAt: '2026-04-07T08:00:00.000Z',
        daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
        id: 'rem-1',
        isActive: true,
        medicationId: 'med-1',
        snoozeUntil: null,
        time: new Date(Date.now() + 15 * 60 * 1000).toISOString().slice(11, 16),
      },
    ]);
  });

  it('logs and decrements supply when taking the next dose', () => {
    render(<TodayScreen />);

    fireEvent.click(screen.getAllByRole('button', { name: 'Take dose' })[0]);

    expect(logDoseMock).toHaveBeenCalledWith(
      mockDb,
      'uuid-123',
      expect.objectContaining({
        medicationId: 'med-1',
        status: 'taken',
      }),
    );
    expect(decrementPillCountMock).toHaveBeenCalledWith(mockDb, 'med-1');
  });

  it('shows refill alerts and can snooze the next reminder', () => {
    render(<TodayScreen />);

    expect(screen.getAllByText(/Metformin/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Request refill/i)).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: 'Snooze dose' })[0]);

    expect(snoozeReminderMock).toHaveBeenCalledWith(mockDb, 'rem-1', 15);
  });
});
