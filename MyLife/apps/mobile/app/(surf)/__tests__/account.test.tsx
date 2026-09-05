import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SurfAccountScreen from '../account';

const mockDb = { id: 'mock-db' };

const countFavoriteSpotsMock = vi.fn();
const countSessionsMock = vi.fn();
const countSpotsMock = vi.fn();

vi.mock('@mylife/surf', () => ({
  countFavoriteSpots: (...args: unknown[]) => countFavoriteSpotsMock(...args),
  countSessions: (...args: unknown[]) => countSessionsMock(...args),
  countSpots: (...args: unknown[]) => countSpotsMock(...args),
}));

vi.mock('../../../components/DatabaseProvider', () => ({
  useDatabase: () => mockDb,
}));

describe('SurfAccountScreen (mobile)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    countSpotsMock.mockReturnValue(7);
    countFavoriteSpotsMock.mockReturnValue(3);
    countSessionsMock.mockReturnValue(14);
  });

  it('renders profile metrics and toggles preference chips and flags', () => {
    render(<SurfAccountScreen />);

    expect(screen.getByText('Tracked Spots')).toBeInTheDocument();
    expect(screen.getByText('Favorites')).toBeInTheDocument();
    expect(screen.getByText('Sessions')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Wave m' }));
    fireEvent.click(screen.getByRole('button', { name: 'Wind mph' }));

    expect(screen.getByRole('button', { name: /Daily Forecast/i })).toBeInTheDocument();
    expect(screen.getAllByText('ON').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: /Daily Forecast/i }));
    expect(screen.getAllByText('OFF').length).toBeGreaterThan(0);
  });
});
