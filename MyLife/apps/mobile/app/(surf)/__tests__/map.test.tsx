import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SurfMapScreen from '../map';

const mockDb = { id: 'mock-db' };

const createSpotMock = vi.fn();
const getSpotsMock = vi.fn();
const toggleSpotFavoriteMock = vi.fn();

vi.mock('@mylife/surf', () => ({
  createSpot: (...args: unknown[]) => createSpotMock(...args),
  getSpots: (...args: unknown[]) => getSpotsMock(...args),
  toggleSpotFavorite: (...args: unknown[]) => toggleSpotFavoriteMock(...args),
}));

vi.mock('../../../components/DatabaseProvider', () => ({
  useDatabase: () => mockDb,
}));

describe('SurfMapScreen (mobile)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSpotsMock.mockImplementation((_db: unknown, opts?: { region?: string }) => {
      const all = [
        {
          id: 'spot-1',
          name: 'Pipeline',
          region: 'North Shore',
          breakType: 'reef',
          waveHeightFt: 6.4,
          windKts: 12,
          isFavorite: false,
        },
      ];

      if (opts?.region) {
        return all.filter((spot) => spot.region === opts.region);
      }
      return all;
    });
  });

  it('pins a spot and toggles favorite status from list', () => {
    render(<SurfMapScreen />);

    fireEvent.change(screen.getByPlaceholderText('Spot name'), {
      target: { value: 'Sunset' },
    });
    fireEvent.change(screen.getByPlaceholderText('Region'), {
      target: { value: 'North Shore' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'point' }));
    fireEvent.click(screen.getByRole('button', { name: 'Pin Spot' }));

    expect(createSpotMock).toHaveBeenCalledWith(
      mockDb,
      expect.stringMatching(/^spot_/),
      expect.objectContaining({
        name: 'Sunset',
        region: 'North Shore',
        breakType: 'point',
      }),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Favorite' }));
    expect(toggleSpotFavoriteMock).toHaveBeenCalledWith(mockDb, 'spot-1');
  });
});
