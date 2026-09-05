import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { CAR_MODULE } from '../definition';
import {
  createVehicle,
  getVehicles,
  getVehicleById,
  updateVehicle,
  deleteVehicle,
  countVehicles,
  createMaintenance,
  getMaintenanceByVehicle,
  deleteMaintenance,
  createFuelLog,
  getFuelLogsByVehicle,
  deleteFuelLog,
  getSetting,
  setSetting,
} from '../db/crud';

describe('@mylife/car', () => {
  let adapter: DatabaseAdapter;
  let closeDb: () => void;

  beforeEach(() => {
    const testDb = createModuleTestDatabase('car', CAR_MODULE.migrations!);
    adapter = testDb.adapter;
    closeDb = testDb.close;
  });

  afterEach(() => {
    closeDb();
  });

  describe('CAR_MODULE definition', () => {
    it('has correct metadata', () => {
      expect(CAR_MODULE.id).toBe('car');
      expect(CAR_MODULE.tier).toBe('premium');
      expect(CAR_MODULE.storageType).toBe('sqlite');
      expect(CAR_MODULE.tablePrefix).toBe('cr_');
    });

    it('has 5 navigation tabs', () => {
      expect(CAR_MODULE.navigation.tabs).toHaveLength(5);
    });
  });

  describe('seeded data', () => {
    it('has default settings', () => {
      expect(getSetting(adapter, 'distanceUnit')).toBe('miles');
      expect(getSetting(adapter, 'fuelUnit')).toBe('gallons');
    });
  });

  describe('vehicles', () => {
    it('starts empty', () => {
      expect(countVehicles(adapter)).toBe(0);
    });

    it('creates and retrieves a vehicle', () => {
      createVehicle(adapter, 'v1', { name: 'My Car', make: 'Toyota', model: 'Camry', year: 2023 });
      expect(countVehicles(adapter)).toBe(1);
      const v = getVehicleById(adapter, 'v1');
      expect(v).not.toBeNull();
      expect(v!.name).toBe('My Car');
      expect(v!.fuelType).toBe('gas');
    });

    it('lists vehicles', () => {
      createVehicle(adapter, 'v1', { name: 'Car A', make: 'Honda', model: 'Civic', year: 2022 });
      createVehicle(adapter, 'v2', { name: 'Car B', make: 'Ford', model: 'F-150', year: 2024 });
      expect(getVehicles(adapter)).toHaveLength(2);
    });

    it('updates a vehicle', () => {
      createVehicle(adapter, 'v1', { name: 'Old', make: 'X', model: 'Y', year: 2020 });
      updateVehicle(adapter, 'v1', { name: 'New', odometer: 50000 });
      const v = getVehicleById(adapter, 'v1');
      expect(v!.name).toBe('New');
      expect(v!.odometer).toBe(50000);
    });

    it('deletes a vehicle', () => {
      createVehicle(adapter, 'v1', { name: 'Test', make: 'X', model: 'Y', year: 2020 });
      deleteVehicle(adapter, 'v1');
      expect(countVehicles(adapter)).toBe(0);
    });
  });

  describe('maintenance', () => {
    it('creates and retrieves maintenance records', () => {
      createVehicle(adapter, 'v1', { name: 'Car', make: 'X', model: 'Y', year: 2020 });
      createMaintenance(adapter, 'm1', 'v1', { type: 'oil_change', performedAt: '2026-01-15', costCents: 7500 });
      const records = getMaintenanceByVehicle(adapter, 'v1');
      expect(records).toHaveLength(1);
      expect(records[0].type).toBe('oil_change');
      expect(records[0].costCents).toBe(7500);
    });

    it('deletes a maintenance record', () => {
      createVehicle(adapter, 'v1', { name: 'Car', make: 'X', model: 'Y', year: 2020 });
      createMaintenance(adapter, 'm1', 'v1', { type: 'wash', performedAt: '2026-01-01' });
      deleteMaintenance(adapter, 'm1');
      expect(getMaintenanceByVehicle(adapter, 'v1')).toHaveLength(0);
    });
  });

  describe('fuel logs', () => {
    it('creates and retrieves fuel logs', () => {
      createVehicle(adapter, 'v1', { name: 'Car', make: 'X', model: 'Y', year: 2020 });
      createFuelLog(adapter, 'f1', 'v1', {
        gallons: 12.5, costCents: 4500, odometerAt: 50000, loggedAt: '2026-01-15',
      });
      const logs = getFuelLogsByVehicle(adapter, 'v1');
      expect(logs).toHaveLength(1);
      expect(logs[0].gallons).toBe(12.5);
      expect(logs[0].isFullTank).toBe(true);
    });

    it('deletes a fuel log', () => {
      createVehicle(adapter, 'v1', { name: 'Car', make: 'X', model: 'Y', year: 2020 });
      createFuelLog(adapter, 'f1', 'v1', { gallons: 10, costCents: 3500, odometerAt: 50000, loggedAt: '2026-01-01' });
      deleteFuelLog(adapter, 'f1');
      expect(getFuelLogsByVehicle(adapter, 'v1')).toHaveLength(0);
    });
  });

  describe('settings', () => {
    it('updates a setting', () => {
      setSetting(adapter, 'distanceUnit', 'km');
      expect(getSetting(adapter, 'distanceUnit')).toBe('km');
    });
  });
});
