import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import BudgetHomeScreen from '../(tabs)/index';

const pushMock = vi.fn();
const listEnvelopesMock = vi.fn();
const allocateToEnvelopeMock = vi.fn();
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
    medium: 'PlusJakartaSans_500Medium',
    semiBold: 'PlusJakartaSans_600SemiBold',
  },
  BG_GLASS: { backgroundColor: 'rgba(255,255,255,0.04)' },
  BG_GOAL_STATUS: {},
  BG_MONEY: '#22C55E',
  BG_SURFACES: { high: '#2A292F', low: '#1B1B20', lowest: '#0E0E13' },
  BG_TEXT: '#F0F0F5',
  BG_TEXT_MUTED: '#9F8E81',
  BG_TEXT_SECONDARY: 'rgba(240,240,245,0.65)',
  BG_TEXT_TERTIARY: 'rgba(240,240,245,0.35)',
  BG_TYPOGRAPHY: { headlineMd: {}, labelUpper: {} },
  AmountDisplay: ({ cents }: { cents: number }) => (
    <span>{`$${(cents / 100).toFixed(2)}`}</span>
  ),
  EnvelopeCard: ({
    envelope,
    onPress,
  }: {
    envelope: { name: string };
    onPress?: () => void;
  }) => <button onClick={onPress}>{envelope.name}</button>,
  GlassCard: ({
    children,
    onPress,
  }: {
    children?: React.ReactNode;
    onPress?: () => void;
  }) => (onPress ? <button onClick={onPress}>{children}</button> : <div>{children}</div>),
  GoalProgressRing: ({
    current,
    target,
  }: {
    current: number;
    target: number;
  }) => <span>{`${current}/${target}`}</span>,
  MaterialSymbol: ({ name }: { name: string }) => <span>{name}</span>,
  SectionHeader: ({
    title,
    action,
  }: {
    title: string;
    action?: React.ReactNode;
  }) => (
    <div>
      <span>{title}</span>
      {action}
    </div>
  ),
  allocateToEnvelope: (...args: unknown[]) => allocateToEnvelopeMock(...args),
  calculateMonthBudget: vi.fn(() => ({
    overspent: 0,
    readyToAssign: 185000,
  })),
  calculateNetCash: vi.fn(() => ({
    netCash: 92000,
  })),
  calculateSpendingPulse: vi.fn(() => ({
    safeDailySpendCents: 4500,
    summary: 'Steady pace this month',
  })),
  checkAlerts: vi.fn(() => []),
  getActivityByEnvelope: vi.fn(() => new Map([['env-groceries', -12850]])),
  getAlertHistoryByMonth: vi.fn(() => []),
  getAllocationMap: vi.fn(() => new Map([['env-groceries', 45000]])),
  getBudgetAlerts: vi.fn(() => []),
  getCategoryGroups: vi.fn(() => [{ id: 'grp-home', name: 'Home Base' }]),
  getEnvelopesByGroup: vi.fn(() => [{ id: 'env-groceries' }]),
  getGoals: vi.fn(() => []),
  getTotalIncome: vi.fn(() => 250000),
  listEnvelopes: (...args: unknown[]) => listEnvelopesMock(...args),
  listTransactions: vi.fn(() => [
    {
      account_id: 'acct-checking',
      amount: 12850,
      created_at: '2026-04-03T00:00:00.000Z',
      direction: 'outflow',
      envelope_id: 'env-groceries',
      id: 'txn-1',
      merchant: 'Corner Market',
      note: null,
      occurred_on: '2026-04-03',
      updated_at: '2026-04-03T00:00:00.000Z',
    },
  ]),
}));

describe('BudgetHomeScreen (mobile)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listEnvelopesMock.mockImplementation((_db, includeArchived: boolean) => {
      const base = [
        {
          archived: 0,
          color: null,
          created_at: '2026-02-25T00:00:00.000Z',
          icon: '🛒',
          id: 'env-groceries',
          monthly_budget: 45000,
          name: 'Groceries',
          rollover_enabled: 1,
          sort_order: 0,
          updated_at: '2026-02-25T00:00:00.000Z',
        },
      ];
      if (includeArchived) {
        base.push({
          archived: 1,
          color: null,
          created_at: '2026-02-25T00:00:00.000Z',
          icon: '🧊',
          id: 'env-archive',
          monthly_budget: 1000,
          name: 'Archived Envelope',
          rollover_enabled: 0,
          sort_order: 1,
          updated_at: '2026-02-25T00:00:00.000Z',
        });
      }
      return base;
    });
  });

  it('renders the Phase 1 home surface and routes from primary actions', async () => {
    render(<BudgetHomeScreen />);

    await waitFor(() => {
      expect(screen.getByText('Ready to Budget')).toBeInTheDocument();
      expect(screen.getByText('Groceries')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Add Envelope/ }));
    expect(pushMock).toHaveBeenNthCalledWith(1, '/(budget)/create');

    fireEvent.click(screen.getByRole('button', { name: 'Groceries' }));
    expect(pushMock).toHaveBeenNthCalledWith(2, '/(budget)/env-groceries');
  });

  it('loads grouped budget data on mount', async () => {
    render(<BudgetHomeScreen />);

    await waitFor(() => {
      expect(listEnvelopesMock).toHaveBeenCalledWith({ id: 'mock-db' }, false);
      expect(screen.getByText('Allocation Distribution')).toBeInTheDocument();
      expect(screen.getAllByText('Home Base').length).toBeGreaterThan(0);
    });
  });
});
