import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../actions', () => ({
  fetchVehicles: vi.fn(),
  fetchVehicleCount: vi.fn(),
  doCreateVehicle: vi.fn(),
  doUpdateVehicle: vi.fn(),
  doDeleteVehicle: vi.fn(),
  fetchMaintenance: vi.fn(),
  doCreateMaintenance: vi.fn(),
  doDeleteMaintenance: vi.fn(),
  fetchFuelLogs: vi.fn(),
  doCreateFuelLog: vi.fn(),
  doDeleteFuelLog: vi.fn(),
}));

import CarPage from '../page';
import {
  fetchVehicles,
  fetchVehicleCount,
  doCreateVehicle,
  doDeleteVehicle,
  fetchMaintenance,
  doCreateMaintenance,
  fetchFuelLogs,
  doCreateFuelLog,
} from '../actions';

type Vehicle = {
  id: string;
  name: string;
  make: string;
  model: string;
  year: number;
  color: string | null;
  vin: string | null;
  licensePlate: string | null;
  odometer: number;
  fuelType: string;
  isPrimary: boolean;
  imageUri: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

const mockVehicle = (overrides: Partial<Vehicle> = {}): Vehicle => ({
  id: 'v-1',
  name: 'Daily Driver',
  make: 'Toyota',
  model: 'Camry',
  year: 2022,
  color: null,
  vin: null,
  licensePlate: null,
  odometer: 35000,
  fuelType: 'gas',
  isPrimary: true,
  imageUri: null,
  notes: null,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  (fetchVehicles as ReturnType<typeof vi.fn>).mockResolvedValue([]);
  (fetchVehicleCount as ReturnType<typeof vi.fn>).mockResolvedValue(0);
  (doCreateVehicle as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true });
  (doDeleteVehicle as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true });
  (fetchMaintenance as ReturnType<typeof vi.fn>).mockResolvedValue([]);
  (doCreateMaintenance as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true });
  (fetchFuelLogs as ReturnType<typeof vi.fn>).mockResolvedValue([]);
  (doCreateFuelLog as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true });
});

describe('CarPage', () => {
  it('loads and displays vehicles on mount', async () => {
    const vehicle = mockVehicle();
    (fetchVehicles as ReturnType<typeof vi.fn>).mockResolvedValue([vehicle]);
    (fetchVehicleCount as ReturnType<typeof vi.fn>).mockResolvedValue(1);

    render(<CarPage />);

    await waitFor(() => {
      expect(screen.getByText('Daily Driver')).toBeInTheDocument();
    });

    expect(screen.getByText('MyCar')).toBeInTheDocument();
    expect(screen.getByText(/2022 Toyota Camry/)).toBeInTheDocument();
    expect(screen.getByText(/35,000/)).toBeInTheDocument();
    expect(fetchVehicles).toHaveBeenCalled();
    expect(fetchVehicleCount).toHaveBeenCalled();
  });

  it('shows add vehicle link in empty state', async () => {
    (fetchVehicles as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (fetchVehicleCount as ReturnType<typeof vi.fn>).mockResolvedValue(0);

    render(<CarPage />);

    await waitFor(() => {
      expect(screen.getByText('MyCar')).toBeInTheDocument();
    });

    // Empty state has a link to the garage page for adding vehicles
    const addLink = screen.getByRole('link', { name: /add.*vehicle|get started|garage/i });
    expect(addLink).not.toBeNull();
    expect(addLink.getAttribute('href')).toContain('/car/garage');
  });

  it('renders vehicle cards as links to detail pages', async () => {
    const vehicle = mockVehicle();
    (fetchVehicles as ReturnType<typeof vi.fn>).mockResolvedValue([vehicle]);
    (fetchVehicleCount as ReturnType<typeof vi.fn>).mockResolvedValue(1);

    render(<CarPage />);

    await waitFor(() => {
      expect(screen.getByText('Daily Driver')).toBeInTheDocument();
    });

    // Vehicle cards link to /car/garage/:id detail pages
    const link = screen.getByText('Daily Driver').closest('a');
    expect(link).not.toBeNull();
    expect(link?.getAttribute('href')).toContain('/car/garage/');
  });

  it('links vehicle card to detail page', async () => {
    const vehicle = mockVehicle();
    (fetchVehicles as ReturnType<typeof vi.fn>).mockResolvedValue([vehicle]);
    (fetchVehicleCount as ReturnType<typeof vi.fn>).mockResolvedValue(1);

    render(<CarPage />);

    await waitFor(() => {
      expect(screen.getByText('Daily Driver')).toBeInTheDocument();
    });

    // Vehicle cards are now Links to detail pages
    const vehicleLink = screen.getByText('Daily Driver').closest('a');
    expect(vehicleLink).not.toBeNull();
    expect(vehicleLink?.getAttribute('href')).toBe('/car/garage/v-1');
  });

  it('renders navigation items for sub-pages', async () => {
    const vehicle = mockVehicle();
    (fetchVehicles as ReturnType<typeof vi.fn>).mockResolvedValue([vehicle]);
    (fetchVehicleCount as ReturnType<typeof vi.fn>).mockResolvedValue(1);

    render(<CarPage />);

    await waitFor(() => {
      expect(screen.getByText('Daily Driver')).toBeInTheDocument();
    });

    // Navigation grid has links to sub-pages
    expect(screen.getByText('MyCar')).toBeInTheDocument();
    expect(screen.getByText('Reminders')).toBeInTheDocument();
    expect(screen.getByText('Trips')).toBeInTheDocument();
    expect(screen.getByText('Expenses')).toBeInTheDocument();
  });

  it('shows vehicle count in subtitle', async () => {
    const vehicle = mockVehicle();
    (fetchVehicles as ReturnType<typeof vi.fn>).mockResolvedValue([vehicle]);
    (fetchVehicleCount as ReturnType<typeof vi.fn>).mockResolvedValue(1);

    render(<CarPage />);

    await waitFor(() => {
      expect(screen.getByText('Daily Driver')).toBeInTheDocument();
    });

    expect(screen.getByText(/1 vehicle.*in your garage/)).toBeInTheDocument();
  });

  it('shows empty state when no vehicles', async () => {
    (fetchVehicles as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (fetchVehicleCount as ReturnType<typeof vi.fn>).mockResolvedValue(0);

    render(<CarPage />);

    await waitFor(() => {
      expect(screen.getByText('MyCar')).toBeInTheDocument();
    });

    expect(
      screen.getByText(/add your first vehicle/i)
    ).toBeInTheDocument();
  });

  it('displays vehicle info including odometer', async () => {
    const vehicle = mockVehicle({ fuelType: 'gas' });
    (fetchVehicles as ReturnType<typeof vi.fn>).mockResolvedValue([vehicle]);
    (fetchVehicleCount as ReturnType<typeof vi.fn>).mockResolvedValue(1);

    render(<CarPage />);

    await waitFor(() => {
      expect(screen.getByText('Daily Driver')).toBeInTheDocument();
    });

    expect(screen.getByText(/35,000/)).toBeInTheDocument();
  });
});
