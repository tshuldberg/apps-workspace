import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { CAR_MODULE } from '../definition';
import {
  createVehicle,
  createMaintenance,
  deleteVehicle,
  createSchedule,
  getSchedulesByVehicle,
  getActiveSchedules,
  getScheduleById,
  updateSchedule,
  deactivateSchedule,
  autoLinkMaintenanceToSchedule,
} from '../db/crud';
import {
  calculateNextDue,
  calculateScheduleStatus,
  getDefaultSchedules,
  sortByUrgency,
} from '../engines/reminder-engine';
import { CreateScheduleInputSchema } from '../types';

// ---------------------------------------------------------------------------
// Engine unit tests (pure functions)
// ---------------------------------------------------------------------------

describe('reminder-engine', () => {
  describe('calculateScheduleStatus', () => {
    const base = {
      intervalMiles: 5000,
      intervalMonths: 6,
      lastServiceOdometer: 20000,
      lastServiceDate: '2026-01-01',
      nextDueOdometer: 25000,
      nextDueDate: '2026-07-01',
      snoozeMiles: 0,
      snoozeDateOffsetDays: 0,
    };

    it('returns "ok" when well below next_due_odometer', () => {
      expect(calculateScheduleStatus(base, 21000, '2026-02-01')).toBe('ok');
    });

    it('returns "due_soon" when within 500 miles of next_due_odometer', () => {
      expect(calculateScheduleStatus(base, 24600, '2026-02-01')).toBe('due_soon');
    });

    it('returns "overdue" when past next_due_odometer', () => {
      expect(calculateScheduleStatus(base, 25500, '2026-02-01')).toBe('overdue');
    });

    it('returns "due_soon" when within 30 days of next_due_date', () => {
      expect(calculateScheduleStatus(base, 21000, '2026-06-10')).toBe('due_soon');
    });

    it('returns "overdue" when past next_due_date', () => {
      expect(calculateScheduleStatus(base, 21000, '2026-07-15')).toBe('overdue');
    });

    it('date overdue takes precedence over mileage OK', () => {
      expect(calculateScheduleStatus(base, 21000, '2026-08-01')).toBe('overdue');
    });

    it('mileage overdue takes precedence over date OK', () => {
      expect(calculateScheduleStatus(base, 26000, '2026-02-01')).toBe('overdue');
    });

    it('handles schedule with only mileage interval (no date)', () => {
      const mileageOnly = {
        ...base,
        intervalMonths: null,
        lastServiceDate: null,
        nextDueDate: null,
      };
      expect(calculateScheduleStatus(mileageOnly, 24600, '2026-02-01')).toBe('due_soon');
    });

    it('handles schedule with only time interval (no mileage)', () => {
      const dateOnly = {
        ...base,
        intervalMiles: null,
        lastServiceOdometer: null,
        nextDueOdometer: null,
      };
      expect(calculateScheduleStatus(dateOnly, 0, '2026-06-10')).toBe('due_soon');
    });

    it('returns "unknown" when no last service data', () => {
      const noData = {
        ...base,
        lastServiceOdometer: null,
        lastServiceDate: null,
        nextDueOdometer: null,
        nextDueDate: null,
      };
      expect(calculateScheduleStatus(noData, 21000, '2026-02-01')).toBe('unknown');
    });
  });

  describe('calculateNextDue', () => {
    it('computes correct next_due_odometer from last + interval + snooze', () => {
      const result = calculateNextDue({
        intervalMiles: 5000,
        intervalMonths: null,
        lastServiceOdometer: 20000,
        lastServiceDate: null,
        snoozeMiles: 500,
        snoozeDateOffsetDays: 0,
      });
      expect(result.nextDueOdometer).toBe(25500);
      expect(result.nextDueDate).toBeNull();
    });

    it('computes correct next_due_date from last + months + snooze days', () => {
      const result = calculateNextDue({
        intervalMiles: null,
        intervalMonths: 6,
        lastServiceOdometer: null,
        lastServiceDate: '2026-01-15',
        snoozeMiles: 0,
        snoozeDateOffsetDays: 30,
      });
      expect(result.nextDueOdometer).toBeNull();
      expect(result.nextDueDate).toBe('2026-08-14');
    });

    it('returns null for both when no last service data', () => {
      const result = calculateNextDue({
        intervalMiles: 5000,
        intervalMonths: 6,
        lastServiceOdometer: null,
        lastServiceDate: null,
        snoozeMiles: 0,
        snoozeDateOffsetDays: 0,
      });
      expect(result.nextDueOdometer).toBeNull();
      expect(result.nextDueDate).toBeNull();
    });
  });

  describe('getDefaultSchedules', () => {
    it('returns exactly 8 presets', () => {
      expect(getDefaultSchedules()).toHaveLength(8);
    });

    it('oil_change preset has interval_miles=5000 and interval_months=6', () => {
      const oil = getDefaultSchedules().find((p) => p.serviceType === 'oil_change');
      expect(oil).toBeDefined();
      expect(oil!.intervalMiles).toBe(5000);
      expect(oil!.intervalMonths).toBe(6);
    });

    it('battery preset has interval_miles=null and interval_months=48', () => {
      const battery = getDefaultSchedules().find((p) => p.serviceType === 'battery');
      expect(battery).toBeDefined();
      expect(battery!.intervalMiles).toBeNull();
      expect(battery!.intervalMonths).toBe(48);
    });
  });

  describe('Zod validation', () => {
    it('rejects schedule with both intervals null', () => {
      const result = CreateScheduleInputSchema.safeParse({
        vehicleId: 'v1',
        serviceType: 'oil_change',
      });
      expect(result.success).toBe(false);
    });

    it('rejects interval_miles < 500', () => {
      const result = CreateScheduleInputSchema.safeParse({
        vehicleId: 'v1',
        serviceType: 'oil_change',
        intervalMiles: 100,
      });
      expect(result.success).toBe(false);
    });

    it('rejects interval_months < 1', () => {
      const result = CreateScheduleInputSchema.safeParse({
        vehicleId: 'v1',
        serviceType: 'oil_change',
        intervalMonths: 0,
      });
      expect(result.success).toBe(false);
    });

    it('accepts schedule with only interval_miles', () => {
      const result = CreateScheduleInputSchema.safeParse({
        vehicleId: 'v1',
        serviceType: 'oil_change',
        intervalMiles: 5000,
      });
      expect(result.success).toBe(true);
    });

    it('accepts schedule with only interval_months', () => {
      const result = CreateScheduleInputSchema.safeParse({
        vehicleId: 'v1',
        serviceType: 'battery',
        intervalMonths: 48,
      });
      expect(result.success).toBe(true);
    });

    it('requires service_type_custom when service_type is "custom"', () => {
      const result = CreateScheduleInputSchema.safeParse({
        vehicleId: 'v1',
        serviceType: 'custom',
        intervalMonths: 1,
      });
      expect(result.success).toBe(false);
    });

    it('accepts custom service type with custom name', () => {
      const result = CreateScheduleInputSchema.safeParse({
        vehicleId: 'v1',
        serviceType: 'custom',
        serviceTypeCustom: 'Car Wash',
        intervalMonths: 1,
      });
      expect(result.success).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// CRUD integration tests
// ---------------------------------------------------------------------------

describe('schedule CRUD', () => {
  let adapter: DatabaseAdapter;
  let closeDb: () => void;

  beforeEach(() => {
    const testDb = createModuleTestDatabase('car', CAR_MODULE.migrations!);
    adapter = testDb.adapter;
    closeDb = testDb.close;
    createVehicle(adapter, 'v1', { name: 'Test Car', make: 'Toyota', model: 'Camry', year: 2024, odometer: 20000 });
  });

  afterEach(() => {
    closeDb();
  });

  it('creates a schedule and retrieves it', () => {
    const schedule = createSchedule(adapter, 's1', {
      vehicleId: 'v1',
      serviceType: 'oil_change',
      intervalMiles: 5000,
      intervalMonths: 6,
      lastServiceDate: '2026-01-01',
      lastServiceOdometer: 20000,
    });
    expect(schedule.serviceType).toBe('oil_change');
    expect(schedule.intervalMiles).toBe(5000);
    expect(schedule.intervalMonths).toBe(6);
    expect(schedule.nextDueOdometer).toBe(25000);
    expect(schedule.nextDueDate).toBe('2026-07-01');
    expect(schedule.isActive).toBe(true);
  });

  it('rejects schedule with invalid interval', () => {
    expect(() =>
      createSchedule(adapter, 's1', { vehicleId: 'v1', serviceType: 'oil_change' }),
    ).toThrow();
  });

  it('retrieves schedules by vehicle', () => {
    createSchedule(adapter, 's1', {
      vehicleId: 'v1', serviceType: 'oil_change', intervalMiles: 5000, lastServiceOdometer: 20000,
    });
    createSchedule(adapter, 's2', {
      vehicleId: 'v1', serviceType: 'tire_rotation', intervalMiles: 7500, lastServiceOdometer: 20000,
    });
    expect(getSchedulesByVehicle(adapter, 'v1')).toHaveLength(2);
  });

  it('gets only active schedules', () => {
    createSchedule(adapter, 's1', {
      vehicleId: 'v1', serviceType: 'oil_change', intervalMiles: 5000, lastServiceOdometer: 20000,
    });
    createSchedule(adapter, 's2', {
      vehicleId: 'v1', serviceType: 'tire_rotation', intervalMiles: 7500, lastServiceOdometer: 20000,
    });
    deactivateSchedule(adapter, 's2');
    expect(getActiveSchedules(adapter, 'v1')).toHaveLength(1);
  });

  it('updates a schedule and recalculates next_due', () => {
    createSchedule(adapter, 's1', {
      vehicleId: 'v1', serviceType: 'oil_change', intervalMiles: 5000, lastServiceOdometer: 20000,
    });
    updateSchedule(adapter, 's1', { intervalMiles: 7500 });
    const updated = getScheduleById(adapter, 's1');
    expect(updated!.intervalMiles).toBe(7500);
    expect(updated!.nextDueOdometer).toBe(27500);
  });

  it('deactivates a schedule (does not delete)', () => {
    createSchedule(adapter, 's1', {
      vehicleId: 'v1', serviceType: 'oil_change', intervalMiles: 5000, lastServiceOdometer: 20000,
    });
    deactivateSchedule(adapter, 's1');
    const schedule = getScheduleById(adapter, 's1');
    expect(schedule).not.toBeNull();
    expect(schedule!.isActive).toBe(false);
  });

  it('auto-links maintenance to schedule and resets snooze', () => {
    createSchedule(adapter, 's1', {
      vehicleId: 'v1', serviceType: 'oil_change', intervalMiles: 5000,
      lastServiceOdometer: 20000, lastServiceDate: '2026-01-01',
    });
    // Snooze it first
    updateSchedule(adapter, 's1', { snoozeMiles: 500, snoozeCount: 2 });

    // Log a maintenance record
    createMaintenance(adapter, 'm1', 'v1', {
      type: 'oil_change', performedAt: '2026-06-15', odometerAt: 25000,
    });
    autoLinkMaintenanceToSchedule(adapter, 'v1', 'oil_change', '2026-06-15', 25000);

    const updated = getScheduleById(adapter, 's1');
    expect(updated!.lastServiceDate).toBe('2026-06-15');
    expect(updated!.lastServiceOdometer).toBe(25000);
    expect(updated!.nextDueOdometer).toBe(30000);
    expect(updated!.snoozeMiles).toBe(0);
    expect(updated!.snoozeCount).toBe(0);
  });

  it('cascade-deletes schedules when vehicle is deleted', () => {
    createSchedule(adapter, 's1', {
      vehicleId: 'v1', serviceType: 'oil_change', intervalMiles: 5000, lastServiceOdometer: 20000,
    });
    createSchedule(adapter, 's2', {
      vehicleId: 'v1', serviceType: 'tire_rotation', intervalMiles: 7500, lastServiceOdometer: 20000,
    });
    deleteVehicle(adapter, 'v1');
    expect(getSchedulesByVehicle(adapter, 'v1')).toHaveLength(0);
  });

  it('creates default schedules for a vehicle', () => {
    const defaults = getDefaultSchedules();
    defaults.forEach((preset, i) => {
      createSchedule(adapter, `default-${i}`, {
        vehicleId: 'v1',
        serviceType: preset.serviceType,
        intervalMiles: preset.intervalMiles ?? undefined,
        intervalMonths: preset.intervalMonths ?? undefined,
        lastServiceOdometer: 20000,
        lastServiceDate: '2026-01-01',
      });
    });
    const schedules = getSchedulesByVehicle(adapter, 'v1');
    expect(schedules).toHaveLength(8);
  });

  it('sortByUrgency orders overdue > due_soon > ok', () => {
    createSchedule(adapter, 's1', {
      vehicleId: 'v1', serviceType: 'oil_change', intervalMiles: 5000,
      lastServiceOdometer: 20000, lastServiceDate: '2026-01-01', intervalMonths: 6,
    });
    createSchedule(adapter, 's2', {
      vehicleId: 'v1', serviceType: 'tire_rotation', intervalMiles: 7500,
      lastServiceOdometer: 20000,
    });
    createSchedule(adapter, 's3', {
      vehicleId: 'v1', serviceType: 'battery', intervalMonths: 48,
      lastServiceDate: '2026-01-01',
    });

    const schedules = getActiveSchedules(adapter, 'v1');
    // Oil change: overdue at 25000 mi, testing at 25500
    // Tire rotation: due_soon at 27500, testing at 27100
    // Battery: ok, due in 2030
    const sorted = sortByUrgency(schedules, 25500, '2026-02-01');
    expect(sorted[0].serviceType).toBe('oil_change');
    expect(sorted[0].status).toBe('overdue');
  });
});
