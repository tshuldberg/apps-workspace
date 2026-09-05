import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SurfHomeScreen from '../index';

const mockDb = { id: 'mock-db' };
const pushMock = vi.fn();

const countFavoriteSpotsMock = vi.fn();
const countSessionsMock = vi.fn();
const countSpotsMock = vi.fn();
const getAverageWaveHeightFtMock = vi.fn();
const getSpotsMock = vi.fn();
const toggleSpotFavoriteMock = vi.fn();

vi.mock('@mylife/surf', () => ({
  countFavoriteSpots: (...args: unknown[]) => countFavoriteSpotsMock(...args),
  countSessions: (...args: unknown[]) => countSessionsMock(...args),
  countSpots: (...args: unknown[]) => countSpotsMock(...args),
  getAverageWaveHeightFt: (...args: unknown[]) => getAverageWaveHeightFtMock(...args),
  getSpots: (...args: unknown[]) => getSpotsMock(...args),
  toggleSpotFavorite: (...args: unknown[]) => toggleSpotFavoriteMock(...args),
}));

vi.mock('expo-router', () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock('../../../components/DatabaseProvider', () => ({
  useDatabase: () => mockDb,
}));

describe('SurfHomeScreen (mobile)', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    countSpotsMock.mockReturnValue(5);
    countFavoriteSpotsMock.mockReturnValue(2);
    getAverageWaveHeightFtMock.mockReturnValue(4.2);
    countSessionsMock.mockReturnValue(9);
    getSpotsMock.mockReturnValue([
      {
        id: 'spot-1',
        name: 'Pipeline',
        region: 'North Shore',
        breakType: 'reef',
        waveHeightFt: 6.4,
        windKts: 12,
        isFavorite: true,
      },
    ]);
  });

  it('renders overview and supports favorite toggle + spot navigation', () => {
    render(<SurfHomeScreen />);

    expect(screen.getByText('Tracked Spots')).toBeInTheDocument();
    expect(screen.getByText('Pipeline')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '★' }));
    expect(toggleSpotFavoriteMock).toHaveBeenCalledWith(mockDb, 'spot-1');

    fireEvent.click(screen.getByRole('button', { name: /Pipeline/i }));
    expect(pushMock).toHaveBeenCalledWith('/(surf)/spot/spot-1');
  });
});
