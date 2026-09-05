import type { DatabaseAdapter } from '@mylife/db';
import type { Vehicle, Maintenance, FuelLog, MaintenanceSchedule, ScheduleServiceType } from '../types';
import { CreateScheduleInputSchema, type CreateScheduleRawInput } from '../types';
import { calculateNextDue } from '../engines/reminder-engine';

// ---------------------------------------------------------------------------
// Row mappers (snake_case SQL → camelCase TS)
// ---------------------------------------------------------------------------

function rowToVehicle(row: Record<string, unknown>): Vehicle {
  return {
    id: row.id as string,
    name: row.name as string,
    make: row.make as string,
    model: row.model as string,
    year: row.year as number,
    color: (row.color as string) ?? null,
    vin: (row.vin as string) ?? null,
    licensePlate: (row.license_plate as string) ?? null,
    odometer: row.odometer as number,
    fuelType: row.fuel_type as Vehicle['fuelType'],
    isPrimary: !!(row.is_primary as number),
    imageUri: (row.image_uri as string) ?? null,
    notes: (row.notes as string) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function rowToMaintenance(row: Record<string, unknown>): Maintenance {
  return {
    id: row.id as string,
    vehicleId: row.vehicle_id as string,
    type: row.type as Maintenance['type'],
    description: (row.description as string) ?? null,
    costCents: (row.cost_cents as number) ?? null,
    odometerAt: (row.odometer_at as number) ?? null,
    performedAt: row.performed_at as string,
    nextDueDate: (row.next_due_date as string) ?? null,
    nextDueOdometer: (row.next_due_odometer as number) ?? null,
    notes: (row.notes as string) ?? null,
    createdAt: row.created_at as string,
  };
}

function rowToFuelLog(row: Record<string, unknown>): FuelLog {
  return {
    id: row.id as string,
    vehicleId: row.vehicle_id as string,
    gallons: row.gallons as number,
    costCents: row.cost_cents as number,
    odometerAt: row.odometer_at as number,
    station: (row.station as string) ?? null,
    isFullTank: !!(row.is_full_tank as number),
    loggedAt: row.logged_at as string,
    createdAt: row.created_at as string,
  };
}

// ---------------------------------------------------------------------------
// Vehicles
// ---------------------------------------------------------------------------

export function createVehicle(
  db: DatabaseAdapter,
  id: string,
  input: { name: string; make: string; model: string; year: number; fuelType?: string; odometer?: number },
): void {
  const now = new Date().toISOString();
  db.execute(
    `INSERT INTO cr_vehicles (id, name, make, model, year, fuel_type, odometer, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, input.name, input.make, input.model, input.year, input.fuelType ?? 'gas', input.odometer ?? 0, now, now],
  );
}

export function getVehicles(db: DatabaseAdapter): Vehicle[] {
  return db.query<Record<string, unknown>>('SELECT * FROM cr_vehicles ORDER BY is_primary DESC, name ASC').map(rowToVehicle);
}

export function getVehicleById(db: DatabaseAdapter, id: string): Vehicle | null {
  const rows = db.query<Record<string, unknown>>('SELECT * FROM cr_vehicles WHERE id = ?', [id]);
  return rows.length > 0 ? rowToVehicle(rows[0]) : null;
}

export function updateVehicle(db: DatabaseAdapter, id: string, updates: Partial<{ name: string; make: string; model: string; year: number; odometer: number; fuelType: string; isPrimary: boolean }>): void {
  const sets: string[] = [];
  const params: unknown[] = [];
  if (updates.name !== undefined) { sets.push('name = ?'); params.push(updates.name); }
  if (updates.make !== undefined) { sets.push('make = ?'); params.push(updates.make); }
  if (updates.model !== undefined) { sets.push('model = ?'); params.push(updates.model); }
  if (updates.year !== undefined) { sets.push('year = ?'); params.push(updates.year); }
  if (updates.odometer !== undefined) { sets.push('odometer = ?'); params.push(updates.odometer); }
  if (updates.fuelType !== undefined) { sets.push('fuel_type = ?'); params.push(updates.fuelType); }
  if (updates.isPrimary !== undefined) { sets.push('is_primary = ?'); params.push(updates.isPrimary ? 1 : 0); }
  if (sets.length === 0) return;
  sets.push('updated_at = ?');
  params.push(new Date().toISOString());
  params.push(id);

  if (updates.isPrimary) {
    db.transaction(() => {
      db.execute('UPDATE cr_vehicles SET is_primary = 0, updated_at = ? WHERE is_primary = 1 AND id != ?', [new Date().toISOString(), id]);
      db.execute(`UPDATE cr_vehicles SET ${sets.join(', ')} WHERE id = ?`, params);
    });
  } else {
    db.execute(`UPDATE cr_vehicles SET ${sets.join(', ')} WHERE id = ?`, params);
  }
}

export function deleteVehicle(db: DatabaseAdapter, id: string): void {
  db.execute('DELETE FROM cr_vehicles WHERE id = ?', [id]);
}

export function countVehicles(db: DatabaseAdapter): number {
  return (db.query<{ c: number }>('SELECT COUNT(*) as c FROM cr_vehicles')[0]).c;
}

// ---------------------------------------------------------------------------
// Maintenance
// ---------------------------------------------------------------------------

export function createMaintenance(
  db: DatabaseAdapter,
  id: string,
  vehicleId: string,
  input: { type: string; performedAt: string; description?: string; costCents?: number; odometerAt?: number },
): void {
  const now = new Date().toISOString();
  db.execute(
    `INSERT INTO cr_maintenance (id, vehicle_id, type, description, cost_cents, odometer_at, performed_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, vehicleId, input.type, input.description ?? null, input.costCents ?? null, input.odometerAt ?? null, input.performedAt, now],
  );
}

export function getMaintenanceByVehicle(db: DatabaseAdapter, vehicleId: string, limit = 200): Maintenance[] {
  return db.query<Record<string, unknown>>(
    'SELECT * FROM cr_maintenance WHERE vehicle_id = ? ORDER BY performed_at DESC LIMIT ?',
    [vehicleId, limit],
  ).map(rowToMaintenance);
}

export function deleteMaintenance(db: DatabaseAdapter, id: string): void {
  db.execute('DELETE FROM cr_maintenance WHERE id = ?', [id]);
}

// ---------------------------------------------------------------------------
// Fuel Logs
// ---------------------------------------------------------------------------

export function createFuelLog(
  db: DatabaseAdapter,
  id: string,
  vehicleId: string,
  input: { gallons: number; costCents: number; odometerAt: number; loggedAt: string; station?: string; isFullTank?: boolean },
): void {
  const now = new Date().toISOString();
  db.execute(
    `INSERT INTO cr_fuel_logs (id, vehicle_id, gallons, cost_cents, odometer_at, station, is_full_tank, logged_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, vehicleId, input.gallons, input.costCents, input.odometerAt, input.station ?? null, input.isFullTank !== false ? 1 : 0, input.loggedAt, now],
  );
}

export function getFuelLogsByVehicle(db: DatabaseAdapter, vehicleId: string, limit = 500): FuelLog[] {
  return db.query<Record<string, unknown>>(
    'SELECT * FROM cr_fuel_logs WHERE vehicle_id = ? ORDER BY logged_at DESC LIMIT ?',
    [vehicleId, limit],
  ).map(rowToFuelLog);
}

export function deleteFuelLog(db: DatabaseAdapter, id: string): void {
  db.execute('DELETE FROM cr_fuel_logs WHERE id = ?', [id]);
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export function getSetting(db: DatabaseAdapter, key: string): string | undefined {
  const rows = db.query<{ value: string }>('SELECT value FROM cr_settings WHERE key = ?', [key]);
  return rows.length > 0 ? rows[0].value : undefined;
}

export function setSetting(db: DatabaseAdapter, key: string, value: string): void {
  db.execute(
    `INSERT INTO cr_settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    [key, value],
  );
}

// ---------------------------------------------------------------------------
// Maintenance Schedules
// ---------------------------------------------------------------------------

function rowToSchedule(row: Record<string, unknown>): MaintenanceSchedule {
  return {
    id: row.id as string,
    vehicleId: row.vehicle_id as string,
    serviceType: row.service_type as MaintenanceSchedule['serviceType'],
    serviceTypeCustom: (row.service_type_custom as string) ?? null,
    intervalMiles: (row.interval_miles as number) ?? null,
    intervalMonths: (row.interval_months as number) ?? null,
    lastServiceDate: (row.last_service_date as string) ?? null,
    lastServiceOdometer: (row.last_service_odometer as number) ?? null,
    nextDueOdometer: (row.next_due_odometer as number) ?? null,
    nextDueDate: (row.next_due_date as string) ?? null,
    isActive: !!(row.is_active as number),
    snoozeMiles: (row.snooze_miles as number) ?? 0,
    snoozeDateOffsetDays: (row.snooze_date_offset_days as number) ?? 0,
    snoozeCount: (row.snooze_count as number) ?? 0,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export function createSchedule(
  db: DatabaseAdapter,
  id: string,
  rawInput: CreateScheduleRawInput,
): MaintenanceSchedule {
  const input = CreateScheduleInputSchema.parse(rawInput);
  const nextDue = calculateNextDue({
    intervalMiles: input.intervalMiles ?? null,
    intervalMonths: input.intervalMonths ?? null,
    lastServiceOdometer: input.lastServiceOdometer ?? null,
    lastServiceDate: input.lastServiceDate ?? null,
    snoozeMiles: 0,
    snoozeDateOffsetDays: 0,
  });
  const now = new Date().toISOString();
  db.execute(
    `INSERT INTO cr_maintenance_schedules
     (id, vehicle_id, service_type, service_type_custom, interval_miles, interval_months,
      last_service_date, last_service_odometer, next_due_odometer, next_due_date,
      is_active, snooze_miles, snooze_date_offset_days, snooze_count, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, 0, 0, ?, ?)`,
    [
      id,
      input.vehicleId,
      input.serviceType,
      input.serviceTypeCustom ?? null,
      input.intervalMiles ?? null,
      input.intervalMonths ?? null,
      input.lastServiceDate ?? null,
      input.lastServiceOdometer ?? null,
      nextDue.nextDueOdometer,
      nextDue.nextDueDate,
      now,
      now,
    ],
  );
  const rows = db.query<Record<string, unknown>>(
    'SELECT * FROM cr_maintenance_schedules WHERE id = ?',
    [id],
  );
  return rowToSchedule(rows[0]);
}

export function getSchedulesByVehicle(db: DatabaseAdapter, vehicleId: string): MaintenanceSchedule[] {
  return db.query<Record<string, unknown>>(
    'SELECT * FROM cr_maintenance_schedules WHERE vehicle_id = ? ORDER BY next_due_date ASC, next_due_odometer ASC',
    [vehicleId],
  ).map(rowToSchedule);
}

export function getActiveSchedules(db: DatabaseAdapter, vehicleId?: string): MaintenanceSchedule[] {
  if (vehicleId) {
    return db.query<Record<string, unknown>>(
      'SELECT * FROM cr_maintenance_schedules WHERE vehicle_id = ? AND is_active = 1 ORDER BY next_due_date ASC, next_due_odometer ASC',
      [vehicleId],
    ).map(rowToSchedule);
  }
  return db.query<Record<string, unknown>>(
    'SELECT * FROM cr_maintenance_schedules WHERE is_active = 1 ORDER BY next_due_date ASC, next_due_odometer ASC',
  ).map(rowToSchedule);
}

export function getScheduleById(db: DatabaseAdapter, id: string): MaintenanceSchedule | null {
  const rows = db.query<Record<string, unknown>>(
    'SELECT * FROM cr_maintenance_schedules WHERE id = ?',
    [id],
  );
  return rows.length > 0 ? rowToSchedule(rows[0]) : null;
}

export function updateSchedule(
  db: DatabaseAdapter,
  id: string,
  updates: Partial<{
    serviceType: ScheduleServiceType;
    serviceTypeCustom: string | null;
    intervalMiles: number | null;
    intervalMonths: number | null;
    lastServiceDate: string | null;
    lastServiceOdometer: number | null;
    snoozeMiles: number;
    snoozeDateOffsetDays: number;
    snoozeCount: number;
    isActive: boolean;
  }>,
): void {
  const sets: string[] = [];
  const params: unknown[] = [];
  if (updates.serviceType !== undefined) { sets.push('service_type = ?'); params.push(updates.serviceType); }
  if (updates.serviceTypeCustom !== undefined) { sets.push('service_type_custom = ?'); params.push(updates.serviceTypeCustom); }
  if (updates.intervalMiles !== undefined) { sets.push('interval_miles = ?'); params.push(updates.intervalMiles); }
  if (updates.intervalMonths !== undefined) { sets.push('interval_months = ?'); params.push(updates.intervalMonths); }
  if (updates.lastServiceDate !== undefined) { sets.push('last_service_date = ?'); params.push(updates.lastServiceDate); }
  if (updates.lastServiceOdometer !== undefined) { sets.push('last_service_odometer = ?'); params.push(updates.lastServiceOdometer); }
  if (updates.snoozeMiles !== undefined) { sets.push('snooze_miles = ?'); params.push(updates.snoozeMiles); }
  if (updates.snoozeDateOffsetDays !== undefined) { sets.push('snooze_date_offset_days = ?'); params.push(updates.snoozeDateOffsetDays); }
  if (updates.snoozeCount !== undefined) { sets.push('snooze_count = ?'); params.push(updates.snoozeCount); }
  if (updates.isActive !== undefined) { sets.push('is_active = ?'); params.push(updates.isActive ? 1 : 0); }
  if (sets.length === 0) return;

  // Recalculate next_due values if interval or service data changed
  const existing = getScheduleById(db, id);
  if (existing) {
    const nextDue = calculateNextDue({
      intervalMiles: updates.intervalMiles !== undefined ? updates.intervalMiles : existing.intervalMiles,
      intervalMonths: updates.intervalMonths !== undefined ? updates.intervalMonths : existing.intervalMonths,
      lastServiceOdometer: updates.lastServiceOdometer !== undefined ? updates.lastServiceOdometer : existing.lastServiceOdometer,
      lastServiceDate: updates.lastServiceDate !== undefined ? updates.lastServiceDate : existing.lastServiceDate,
      snoozeMiles: updates.snoozeMiles !== undefined ? updates.snoozeMiles : existing.snoozeMiles,
      snoozeDateOffsetDays: updates.snoozeDateOffsetDays !== undefined ? updates.snoozeDateOffsetDays : existing.snoozeDateOffsetDays,
    });
    sets.push('next_due_odometer = ?'); params.push(nextDue.nextDueOdometer);
    sets.push('next_due_date = ?'); params.push(nextDue.nextDueDate);
  }

  sets.push('updated_at = ?');
  params.push(new Date().toISOString());
  params.push(id);
  db.execute(`UPDATE cr_maintenance_schedules SET ${sets.join(', ')} WHERE id = ?`, params);
}

export function deactivateSchedule(db: DatabaseAdapter, id: string): void {
  db.execute(
    `UPDATE cr_maintenance_schedules SET is_active = 0, updated_at = datetime('now') WHERE id = ?`,
    [id],
  );
}

export function deleteSchedule(db: DatabaseAdapter, id: string): void {
  db.execute('DELETE FROM cr_maintenance_schedules WHERE id = ?', [id]);
}

export function autoLinkMaintenanceToSchedule(
  db: DatabaseAdapter,
  vehicleId: string,
  serviceType: string,
  serviceDate: string,
  serviceOdometer: number | null,
): void {
  // Find a matching active schedule for this vehicle and service type
  const rows = db.query<Record<string, unknown>>(
    'SELECT * FROM cr_maintenance_schedules WHERE vehicle_id = ? AND service_type = ? AND is_active = 1',
    [vehicleId, serviceType],
  );
  if (rows.length === 0) return;
  const schedule = rowToSchedule(rows[0]);

  // Update the schedule with new last service data and reset snooze
  const nextDue = calculateNextDue({
    intervalMiles: schedule.intervalMiles,
    intervalMonths: schedule.intervalMonths,
    lastServiceOdometer: serviceOdometer,
    lastServiceDate: serviceDate,
    snoozeMiles: 0,
    snoozeDateOffsetDays: 0,
  });

  db.execute(
    `UPDATE cr_maintenance_schedules
     SET last_service_date = ?, last_service_odometer = ?,
         next_due_odometer = ?, next_due_date = ?,
         snooze_miles = 0, snooze_date_offset_days = 0, snooze_count = 0,
         updated_at = datetime('now')
     WHERE id = ?`,
    [serviceDate, serviceOdometer, nextDue.nextDueOdometer, nextDue.nextDueDate, schedule.id],
  );
}
