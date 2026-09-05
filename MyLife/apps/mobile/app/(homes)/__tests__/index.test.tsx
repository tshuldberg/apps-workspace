import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import HomesScreen from '../index';

const mockDb = { id: 'mock-db' };

const getPropertiesMock = vi.fn();
const getAllActiveSchedulesMock = vi.fn();
const getCostEntriesForPropertyMock = vi.fn();
const getCostSummaryMock = vi.fn();

vi.mock('@mylife/homes', () => ({
  getProperties: (...args: unknown[]) => getPropertiesMock(...args),
  getAllActiveSchedules: (...args: unknown[]) => getAllActiveSchedulesMock(...args),
  getCostEntriesForProperty: (...args: unknown[]) => getCostEntriesForPropertyMock(...args),
  calculateScheduleStatus: () => ({ isOverdue: false, isDueSoon: false, daysUntilDue: 30, nextDueDate: null }),
  sortByUrgency: (items: unknown[]) => items,
  getTaskTypeLabel: (t: string) => t,
  getCostSummary: (...args: unknown[]) => getCostSummaryMock(...args),
  markComplete: vi.fn(),
  updateSchedule: vi.fn(),
}));

vi.mock('../../../components/DatabaseProvider', () => ({
  useDatabase: () => mockDb,
}));

vi.mock('../../../hooks/homes/use-settings', () => ({
  useHomeSettings: () => ({ get: () => null, set: vi.fn() }),
}));

describe('HomesScreen (mobile)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getPropertiesMock.mockReturnValue([]);
    getAllActiveSchedulesMock.mockReturnValue([]);
    getCostEntriesForPropertyMock.mockReturnValue([]);
    getCostSummaryMock.mockReturnValue({ totalCents: 0, monthlyCents: 0, yearlyCents: 0, byCategory: {} });
  });

  it('renders empty state when no properties exist', () => {
    render(<HomesScreen />);
    expect(screen.getByText('Add Your First Property')).toBeTruthy();
  });

  // TODO: Add property-with-data test once mock setup matches current screen deps
});
