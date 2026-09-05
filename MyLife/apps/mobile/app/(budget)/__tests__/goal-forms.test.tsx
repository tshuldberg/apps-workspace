import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Alert } from 'react-native';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import BudgetCreateGoalScreen from '../goal/create';
import BudgetGoalScreen from '../goal/[id]';

let routeParams: { id?: string | string[] } = { id: 'goal-vacation' };

const pushMock = vi.fn();
const replaceMock = vi.fn();
const backMock = vi.fn();
const createGoalMock = vi.fn();
const listEnvelopesMock = vi.fn();
const getGoalByIdMock = vi.fn();
const updateGoalMock = vi.fn();
const deleteGoalMock = vi.fn();
const mockDb = { id: 'mock-db' };

vi.mock('expo-router', () => ({
  useRouter: () => ({
    push: pushMock,
    replace: replaceMock,
    back: backMock,
  }),
  useLocalSearchParams: () => routeParams,
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
  calculateGoalProgress: ({
    currentAmount,
    targetAmount,
    targetDate,
  }: {
    currentAmount: number;
    targetAmount: number;
    targetDate: string | null;
  }) => ({
    status:
      currentAmount >= targetAmount
        ? 'completed'
        : targetDate
          ? 'on_track'
          : 'no_target_date',
  }),
  calculateGoalProjection: vi.fn(() => ({
    projectedDate: '2026-10-01',
  })),
  createGoal: (...args: unknown[]) => createGoalMock(...args),
  deleteGoal: (...args: unknown[]) => deleteGoalMock(...args),
  getGoalById: (...args: unknown[]) => getGoalByIdMock(...args),
  listEnvelopes: (...args: unknown[]) => listEnvelopesMock(...args),
  suggestMonthlyContribution: vi.fn(() => 17500),
  updateGoal: (...args: unknown[]) => updateGoalMock(...args),
}));

describe('Budget goal forms (mobile)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    routeParams = { id: 'goal-vacation' };

    listEnvelopesMock.mockReturnValue([
      {
        id: 'env-travel',
        name: 'Travel',
      },
    ]);

    getGoalByIdMock.mockReturnValue({
      id: 'goal-vacation',
      envelope_id: 'env-travel',
      name: 'Vacation Plan',
      target_amount: 120000,
      completed_amount: 30000,
      target_date: '2026-08-31',
      is_completed: 0,
      created_at: '2026-02-25T00:00:00.000Z',
      updated_at: '2026-02-25T00:00:00.000Z',
    });
  });

  it('creates a goal from user input and routes back to goals list', async () => {
    render(<BudgetCreateGoalScreen />);

    await waitFor(() => {
      expect(screen.getByText('New Goal')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText('Emergency Fund'), {
      target: { value: 'Laptop Upgrade' },
    });

    fireEvent.change(screen.getByPlaceholderText('5000.00'), {
      target: { value: '1200.00' },
    });
    fireEvent.change(screen.getByPlaceholderText('0.00'), {
      target: { value: '250.00' },
    });
    fireEvent.change(screen.getByPlaceholderText('2026-12-31'), {
      target: { value: '2026-11-01' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Create Goal' }));

    await waitFor(() => {
      expect(createGoalMock).toHaveBeenCalledWith(
        { id: 'mock-db' },
        expect.any(String),
        expect.objectContaining({
          envelope_id: 'env-travel',
          name: 'Laptop Upgrade',
          target_amount: 120000,
          completed_amount: 25000,
          target_date: '2026-11-01',
          is_completed: 0,
        }),
      );
      expect(replaceMock).toHaveBeenCalledWith(
        expect.stringMatching(/\/\(budget\)\/goals\?refresh=/),
      );
    });
  });

  it('shows the no-envelope guardrail and blocks goal creation', async () => {
    listEnvelopesMock.mockReturnValue([]);

    render(<BudgetCreateGoalScreen />);

    await waitFor(() => {
      expect(
        screen.getByText('Create at least one envelope before adding a goal.'),
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Create Goal' }));

    expect(createGoalMock).not.toHaveBeenCalled();
  });

  it('saves goal edits and routes back to goals list', async () => {
    render(<BudgetGoalScreen />);

    await waitFor(() => {
      expect(screen.getByText('Vacation Plan')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Edit Goal' }));
    fireEvent.change(screen.getByDisplayValue('Vacation Plan'), {
      target: { value: 'Summer Escape' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save Goal' }));

    await waitFor(() => {
      expect(updateGoalMock).toHaveBeenCalledWith(
        { id: 'mock-db' },
        'goal-vacation',
        expect.objectContaining({
          name: 'Summer Escape',
          target_amount: 120000,
          completed_amount: 30000,
          is_completed: 0,
        }),
      );
      expect(replaceMock).toHaveBeenCalledWith(
        expect.stringMatching(/\/\(budget\)\/goals\?refresh=/),
      );
    });
  });

  it('marks a goal complete from the editor', async () => {
    render(<BudgetGoalScreen />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Edit Goal' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Edit Goal' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Mark Complete' })).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Mark Complete' }));
    });

    await waitFor(() => {
      expect(updateGoalMock).toHaveBeenCalledWith(
        { id: 'mock-db' },
        'goal-vacation',
        expect.objectContaining({
          is_completed: 1,
          completed_amount: 120000,
        }),
      );
    });
  });

  it('routes to contribution creation and deletes a goal through confirmation', async () => {
    render(<BudgetGoalScreen />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Add Contribution' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Add Contribution' }));
    expect(pushMock).toHaveBeenCalledWith(
      '/(budget)/transaction/create?direction=transfer&envelopeId=env-travel&note=Contribution%20to%20Vacation%20Plan',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Delete Goal' }));

    const alertCalls = (Alert.alert as unknown as { mock: { calls: unknown[][] } }).mock.calls;
    expect(alertCalls.length).toBeGreaterThan(0);

    const deleteButtons = alertCalls[0][2] as Array<{ text: string; onPress?: () => void }>;
    const deleteAction = deleteButtons.find((entry) => entry.text === 'Delete');
    await act(async () => {
      deleteAction?.onPress?.();
    });

    await waitFor(() => {
      expect(deleteGoalMock).toHaveBeenCalledWith({ id: 'mock-db' }, 'goal-vacation');
      expect(replaceMock).toHaveBeenCalledWith(
        expect.stringMatching(/\/\(budget\)\/goals\?refresh=/),
      );
    });
  });
});
