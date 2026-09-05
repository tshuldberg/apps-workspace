import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SurfSessionsScreen from '../sessions';

const mockDb = { id: 'mock-db' };

const createSessionMock = vi.fn();
const deleteSessionMock = vi.fn();
const getSessionsMock = vi.fn();
const getSpotsMock = vi.fn();

vi.mock('@mylife/surf', () => ({
  createSession: (...args: unknown[]) => createSessionMock(...args),
  deleteSession: (...args: unknown[]) => deleteSessionMock(...args),
  getSessions: (...args: unknown[]) => getSessionsMock(...args),
  getSpots: (...args: unknown[]) => getSpotsMock(...args),
}));

vi.mock('../../../components/DatabaseProvider', () => ({
  useDatabase: () => mockDb,
}));

describe('SurfSessionsScreen (mobile)', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    getSpotsMock.mockReturnValue([
      { id: 'spot-1', name: 'Pipeline', region: 'North Shore', breakType: 'reef' },
    ]);
    getSessionsMock.mockReturnValue([
      {
        id: 'session-1',
        spotId: 'spot-1',
        sessionDate: '2026-02-20T08:00:00.000Z',
        durationMin: 90,
        rating: 4,
        notes: 'Clean and fast',
      },
    ]);
  });

  it('creates and deletes surf sessions', () => {
    render(<SurfSessionsScreen />);

    fireEvent.change(screen.getByPlaceholderText('Duration (min)'), {
      target: { value: '75' },
    });
    fireEvent.change(screen.getByPlaceholderText('Rating (1-5)'), {
      target: { value: '5' },
    });
    fireEvent.change(screen.getByPlaceholderText('Notes'), {
      target: { value: 'Great barrels' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save Session' }));

    expect(createSessionMock).toHaveBeenCalledWith(
      mockDb,
      expect.stringMatching(/^session_/),
      expect.objectContaining({
        spotId: 'spot-1',
        durationMin: 75,
        rating: 5,
        notes: 'Great barrels',
      }),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(deleteSessionMock).toHaveBeenCalledWith(mockDb, 'session-1');
  });
});
