import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import BudgetGoalsScreen from '../goals';

const pushMock = vi.fn();
const getGoalsMock = vi.fn();
const listEnvelopesMock = vi.fn();
const calculateGoalProgressMock = vi.fn();
const suggestMonthlyContributionMock = vi.fn();
const mockDb = { id: 'mock-db' };

vi.mock('expo-router', () => ({
  useRouter: () => ({
    push: pushMock,
  }),
  useLocalSearchParams: () => ({}),
}));

vi.mock('../../../components/DatabaseProvider', () => ({
  useDatabase: () => mockDb,
}));

vi.mock('@mylife/budget', () => ({
  BG_ACCENT: '#C9894D',
  BG_ACCENT_LIGHT: '#FFB877',
  BG_DANGER: '#FF453A',
  BG_FONTS: {
    bold: 'PlusJakartaSans_700Bold',
    extraBold: 'PlusJakartaSans_800ExtraBold',
    medium: 'PlusJakartaSans_500Medium',
    regular: 'PlusJakartaSans_400Regular',
    semiBold: 'PlusJakartaSans_600SemiBold',
  },
  BG_MONEY: '#22C55E',
  BG_SURFACES: {
    base: '#0E0E13',
    low: '#1B1B20',
  },
  BG_TEXT: '#F0F0F5',
  BG_TEXT_MUTED: '#9F8E81',
  BG_TEXT_SECONDARY: 'rgba(240,240,245,0.65)',
  BG_TEXT_TERTIARY: 'rgba(240,240,245,0.35)',
  BG_TRANSFER: '#60A5FA',
  AddFAB: ({
    label,
    onPress,
  }: {
    label?: string;
    onPress?: () => void;
  }) => <button onClick={onPress}>{label ?? 'Add'}</button>,
  AmountDisplay: ({ cents }: { cents: number }) => (
    <span>{`$${(cents / 100).toFixed(2)}`}</span>
  ),
  GoalProgressRing: ({
    current,
    target,
  }: {
    current: number;
    target: number;
  }) => <span>{`${current}/${target}`}</span>,
  GlassCard: ({
    children,
    onPress,
  }: {
    children?: React.ReactNode;
    onPress?: () => void;
  }) => (onPress ? <button onClick={onPress}>{children}</button> : <div>{children}</div>),
  MaterialSymbol: ({ name }: { name: string }) => <span>{name}</span>,
  calculateGoalProgress: (...args: unknown[]) => calculateGoalProgressMock(...args),
  getGoals: (...args: unknown[]) => getGoalsMock(...args),
  listEnvelopes: (...args: unknown[]) => listEnvelopesMock(...args),
  suggestMonthlyContribution: (...args: unknown[]) =>
    suggestMonthlyContributionMock(...args),
}));

describe('BudgetGoalsScreen (mobile)', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    getGoalsMock.mockReturnValue([
      {
        id: 'goal-emergency',
        envelope_id: 'env-emergency',
        name: 'Emergency Fund',
        target_amount: 100000,
        target_date: null,
        completed_amount: 100000,
        is_completed: 1,
        created_at: '2026-02-20T00:00:00.000Z',
        updated_at: '2026-02-20T00:00:00.000Z',
      },
      {
        id: 'goal-vacation',
        envelope_id: 'env-travel',
        name: 'Vacation Fund',
        target_amount: 200000,
        target_date: '2026-09-01',
        completed_amount: 50000,
        is_completed: 0,
        created_at: '2026-02-24T00:00:00.000Z',
        updated_at: '2026-02-24T00:00:00.000Z',
      },
      {
        id: 'goal-car',
        envelope_id: 'env-emergency',
        name: 'Car Fund',
        target_amount: 80000,
        target_date: '2026-05-01',
        completed_amount: 10000,
        is_completed: 0,
        created_at: '2026-02-23T00:00:00.000Z',
        updated_at: '2026-02-23T00:00:00.000Z',
      },
    ]);

    listEnvelopesMock.mockReturnValue([
      {
        id: 'env-travel',
        name: 'Travel',
      },
      {
        id: 'env-emergency',
        name: 'Emergency',
      },
    ]);

    calculateGoalProgressMock.mockImplementation(({ id }: { id: string }) => {
      if (id === 'goal-emergency') {
        return { status: 'completed' };
      }
      if (id === 'goal-car') {
        return { status: 'behind' };
      }
      return { status: 'on_track' };
    });

    suggestMonthlyContributionMock.mockImplementation(({ id }: { id: string }) => {
      if (id === 'goal-emergency') {
        return 0;
      }
      if (id === 'goal-car') {
        return 35000;
      }
      return 18000;
    });
  });

  it('renders the Phase 3 goals hub and routes from primary actions', async () => {
    render(<BudgetGoalsScreen />);

    await waitFor(() => {
      expect(screen.getByText('Savings Goals')).toBeInTheDocument();
      expect(screen.getByText('Vacation Fund')).toBeInTheDocument();
      expect(screen.getByText('Emergency Fund')).toBeInTheDocument();
      expect(screen.getByText('Car Fund')).toBeInTheDocument();
    });

    expect(
      screen.getByText(/\$3,800\.00 target across 3 goals/i),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Add Goal' }));
    expect(pushMock).toHaveBeenCalledWith('/(budget)/goal/create');

    fireEvent.click(screen.getByRole('button', { name: /Vacation Fund/i }));
    expect(pushMock).toHaveBeenCalledWith('/(budget)/goal/goal-vacation');
  });

  it('filters goals by status chips in the redesigned list', async () => {
    render(<BudgetGoalsScreen />);

    await waitFor(() => {
      expect(screen.getByText('Vacation Fund')).toBeInTheDocument();
      expect(screen.getByText('Emergency Fund')).toBeInTheDocument();
      expect(screen.getByText('Car Fund')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Behind' }));
    await waitFor(() => {
      expect(screen.getByText('Car Fund')).toBeInTheDocument();
      expect(screen.queryByText('Vacation Fund')).not.toBeInTheDocument();
      expect(screen.queryByText('Emergency Fund')).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Achieved' }));
    await waitFor(() => {
      expect(screen.getByText('Emergency Fund')).toBeInTheDocument();
      expect(screen.queryByText('Vacation Fund')).not.toBeInTheDocument();
      expect(screen.queryByText('Car Fund')).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Active' }));
    await waitFor(() => {
      expect(screen.getByText('Vacation Fund')).toBeInTheDocument();
      expect(screen.getByText('Car Fund')).toBeInTheDocument();
      expect(screen.queryByText('Emergency Fund')).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'All' }));
    await waitFor(() => {
      expect(screen.getByText('Vacation Fund')).toBeInTheDocument();
      expect(screen.getByText('Emergency Fund')).toBeInTheDocument();
      expect(screen.getByText('Car Fund')).toBeInTheDocument();
    });
  });
});
