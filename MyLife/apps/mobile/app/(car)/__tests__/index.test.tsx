import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CarScreen from '../index';

const mockDb = { id: 'mock-db' };

const countVehiclesMock = vi.fn();
const createFuelLogMock = vi.fn();
const createMaintenanceMock = vi.fn();
const createVehicleMock = vi.fn();
const deleteFuelLogMock = vi.fn();
const deleteMaintenanceMock = vi.fn();
const deleteVehicleMock = vi.fn();
const getFuelLogsByVehicleMock = vi.fn();
const getMaintenanceByVehicleMock = vi.fn();
const getVehiclesMock = vi.fn();

vi.mock('@mylife/car', () => ({
  countVehicles: (...args: unknown[]) => countVehiclesMock(...args),
  createFuelLog: (...args: unknown[]) => createFuelLogMock(...args),
  createMaintenance: (...args: unknown[]) => createMaintenanceMock(...args),
  createVehicle: (...args: unknown[]) => createVehicleMock(...args),
  deleteFuelLog: (...args: unknown[]) => deleteFuelLogMock(...args),
  deleteMaintenance: (...args: unknown[]) => deleteMaintenanceMock(...args),
  deleteVehicle: (...args: unknown[]) => deleteVehicleMock(...args),
  getFuelLogsByVehicle: (...args: unknown[]) => getFuelLogsByVehicleMock(...args),
  getMaintenanceByVehicle: (...args: unknown[]) => getMaintenanceByVehicleMock(...args),
  getVehicles: (...args: unknown[]) => getVehiclesMock(...args),
}));

vi.mock('../../../components/DatabaseProvider', () => ({
  useDatabase: () => mockDb,
}));

vi.mock('../../../lib/uuid', () => ({
  uuid: () => 'uuid-123',
}));

describe('CarScreen (mobile)', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    countVehiclesMock.mockReturnValue(1);
    getVehiclesMock.mockReturnValue([
      {
        id: 'veh-1',
        name: 'Roadster',
        make: 'Tesla',
        model: 'Model 3',
        year: 2022,
        odometer: 12345,
      },
    ]);
    getMaintenanceByVehicleMock.mockReturnValue([
      {
        id: 'mnt-1',
        type: 'oil_change',
        performedAt: '2026-01-01T10:00:00.000Z',
        costCents: 4999,
      },
    ]);
    getFuelLogsByVehicleMock.mockReturnValue([
      {
        id: 'fuel-1',
        gallons: 9.5,
        costCents: 3599,
        odometerAt: 12400,
        loggedAt: '2026-01-02T10:00:00.000Z',
      },
    ]);
  });

  it('renders vehicle sections and handles create/delete actions', () => {
    render(<CarScreen />);

    expect(screen.getByText('Roadster')).toBeInTheDocument();
    expect(screen.getByText('Maintenance · Roadster')).toBeInTheDocument();
    expect(screen.getByText('Fuel Logs · Roadster')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('Nickname'), {
      target: { value: 'Family Car' },
    });
    fireEvent.change(screen.getByPlaceholderText('Make'), {
      target: { value: 'Toyota' },
    });
    fireEvent.change(screen.getByPlaceholderText('Model'), {
      target: { value: 'Camry' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save Vehicle' }));

    expect(createVehicleMock).toHaveBeenCalledWith(
      mockDb,
      'uuid-123',
      expect.objectContaining({
        name: 'Family Car',
        make: 'Toyota',
        model: 'Camry',
      }),
    );

    fireEvent.change(screen.getAllByPlaceholderText('Cost')[0], {
      target: { value: '42.5' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add Maintenance' }));

    expect(createMaintenanceMock).toHaveBeenCalledWith(
      mockDb,
      'uuid-123',
      'veh-1',
      expect.objectContaining({
        type: 'oil_change',
        costCents: 4250,
      }),
    );

    fireEvent.change(screen.getAllByPlaceholderText('Cost')[1], {
      target: { value: '27.99' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add Fuel Log' }));

    expect(createFuelLogMock).toHaveBeenCalledWith(
      mockDb,
      'uuid-123',
      'veh-1',
      expect.objectContaining({
        costCents: 2799,
      }),
    );

    for (const button of screen.getAllByRole('button', { name: 'Delete' })) {
      fireEvent.click(button);
    }

    expect(deleteVehicleMock).toHaveBeenCalledWith(mockDb, 'veh-1');
    expect(deleteMaintenanceMock).toHaveBeenCalledWith(mockDb, 'mnt-1');
    expect(deleteFuelLogMock).toHaveBeenCalledWith(mockDb, 'fuel-1');
  });
});
