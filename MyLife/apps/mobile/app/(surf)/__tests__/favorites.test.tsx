import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SurfFavoritesScreen from '../favorites';

const mockDb = { id: 'mock-db' };
const pushMock = vi.fn();

const getSpotsMock = vi.fn();
const toggleSpotFavoriteMock = vi.fn();

vi.mock('@mylife/surf', () => ({
  getSpots: (...args: unknown[]) => getSpotsMock(...args),
  toggleSpotFavorite: (...args: unknown[]) => toggleSpotFavoriteMock(...args),
}));

vi.mock('expo-router', () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock('../../../components/DatabaseProvider', () => ({
  useDatabase: () => mockDb,
}));

describe('SurfFavoritesScreen (mobile)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSpotsMock.mockReturnValue([
      {
        id: 'spot-1',
        name: 'Mavericks',
        region: 'Half Moon Bay',
        breakType: 'reef',
        waveHeightFt: 10.2,
        windKts: 15,
      },
    ]);
  });

  it('navigates to favorite spot detail and removes favorite', () => {
    render(<SurfFavoritesScreen />);

    fireEvent.click(screen.getByRole('button', { name: /Mavericks/i }));
    expect(pushMock).toHaveBeenCalledWith('/(surf)/spot/spot-1');

    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(toggleSpotFavoriteMock).toHaveBeenCalledWith(mockDb, 'spot-1');
  });
});
