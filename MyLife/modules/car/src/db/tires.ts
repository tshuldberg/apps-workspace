import type { DatabaseAdapter } from '@mylife/db';
import type { TireSet, TireMeasurement, TireRotation } from '../types';

// ---------------------------------------------------------------------------
// Row mappers (snake_case SQL -> camelCase TS)
// ---------------------------------------------------------------------------

function rowToTireSet(row: Record<string, unknown>): TireSet {
  return {
    id: row.id as string,
    vehicleId: row.vehicle_id as string,
    brand: (row.brand as string) ?? null,
    modelName: (row.model_name as string) ?? null,
    size: (row.size as string) ?? null,
    purchasedAt: (row.purchased_at as string) ?? null,
    purchasePriceCents: (row.purchase_price_cents as number) ?? null,
    purchaseOdometer: (row.purchase_odometer as number) ?? null,
    isCurrent: !!(row.is_current as number),
    notes: (row.notes as string) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function rowToMeasurement(row: Record<string, unknown>): TireMeasurement {
  return {
    id: row.id as string,
    tireSetId: row.tire_set_id as string,
    position: row.position as TireMeasurement['position'],
    treadDepth32nds: row.tread_depth_32nds as number,
    measuredAt: row.measured_at as string,
    odometerAt: (row.odometer_at as number) ?? null,
    notes: (row.notes as string) ?? null,
    createdAt: row.created_at as string,
  };
}

function rowToRotation(row: Record<string, unknown>): TireRotation {
  return {
    id: row.id as string,
    tireSetId: row.tire_set_id as string,
    rotatedAt: row.rotated_at as string,
    odometerAt: (row.odometer_at as number) ?? null,
    pattern: (row.pattern as string) ?? null,
    notes: (row.notes as string) ?? null,
    createdAt: row.created_at as string,
  };
}

// ---------------------------------------------------------------------------
// Tire Sets
// ---------------------------------------------------------------------------

/**
 * Create a new tire set and mark it as current.
 * Automatically marks all other tire sets for this vehicle as not current.
 */
export function createTireSet(
  db: DatabaseAdapter,
  id: string,
  input: {
    vehicleId: string;
    brand?: string;
    modelName?: string;
    size?: string;
    purchasedAt?: string;
    purchasePriceCents?: number;
    purchaseOdometer?: number;
    notes?: string;
  },
): void {
  const now = new Date().toISOString();

  db.transaction(() => {
    // Mark all existing tire sets for this vehicle as not current
    db.execute(
      'UPDATE cr_tire_sets SET is_current = 0, updated_at = ? WHERE vehicle_id = ?',
      [now, input.vehicleId],
    );

    db.execute(
      `INSERT INTO cr_tire_sets
       (id, vehicle_id, brand, model_name, size, purchased_at, purchase_price_cents,
        purchase_odometer, is_current, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
      [
        id,
        input.vehicleId,
        input.brand ?? null,
        input.modelName ?? null,
        input.size ?? null,
        input.purchasedAt ?? null,
        input.purchasePriceCents ?? null,
        input.purchaseOdometer ?? null,
        input.notes ?? null,
        now,
        now,
      ],
    );
  });
}

export function getTireSetsByVehicle(db: DatabaseAdapter, vehicleId: string): TireSet[] {
  return db
    .query<Record<string, unknown>>(
      'SELECT * FROM cr_tire_sets WHERE vehicle_id = ? ORDER BY is_current DESC, created_at DESC',
      [vehicleId],
    )
    .map(rowToTireSet);
}

export function getCurrentTireSet(db: DatabaseAdapter, vehicleId: string): TireSet | null {
  const rows = db.query<Record<string, unknown>>(
    'SELECT * FROM cr_tire_sets WHERE vehicle_id = ? AND is_current = 1 LIMIT 1',
    [vehicleId],
  );
  return rows.length > 0 ? rowToTireSet(rows[0]) : null;
}

export function updateTireSet(
  db: DatabaseAdapter,
  id: string,
  updates: Partial<{
    brand: string | null;
    modelName: string | null;
    size: string | null;
    isCurrent: boolean;
    notes: string | null;
  }>,
): void {
  const sets: string[] = [];
  const params: unknown[] = [];

  if (updates.brand !== undefined) { sets.push('brand = ?'); params.push(updates.brand); }
  if (updates.modelName !== undefined) { sets.push('model_name = ?'); params.push(updates.modelName); }
  if (updates.size !== undefined) { sets.push('size = ?'); params.push(updates.size); }
  if (updates.isCurrent !== undefined) { sets.push('is_current = ?'); params.push(updates.isCurrent ? 1 : 0); }
  if (updates.notes !== undefined) { sets.push('notes = ?'); params.push(updates.notes); }

  if (sets.length === 0) return;

  sets.push('updated_at = ?');
  params.push(new Date().toISOString());
  params.push(id);

  db.execute(`UPDATE cr_tire_sets SET ${sets.join(', ')} WHERE id = ?`, params);
}

export function deleteTireSet(db: DatabaseAdapter, id: string): void {
  db.execute('DELETE FROM cr_tire_sets WHERE id = ?', [id]);
}

// ---------------------------------------------------------------------------
// Tire Measurements
// ---------------------------------------------------------------------------

export function createMeasurement(
  db: DatabaseAdapter,
  id: string,
  input: {
    tireSetId: string;
    position: string;
    treadDepth32nds: number;
    measuredAt: string;
    odometerAt?: number;
    notes?: string;
  },
): void {
  const now = new Date().toISOString();
  db.execute(
    `INSERT INTO cr_tire_measurements
     (id, tire_set_id, position, tread_depth_32nds, measured_at, odometer_at, notes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.tireSetId,
      input.position,
      input.treadDepth32nds,
      input.measuredAt,
      input.odometerAt ?? null,
      input.notes ?? null,
      now,
    ],
  );
}

export function getMeasurementsByTireSet(
  db: DatabaseAdapter,
  tireSetId: string,
): TireMeasurement[] {
  return db
    .query<Record<string, unknown>>(
      'SELECT * FROM cr_tire_measurements WHERE tire_set_id = ? ORDER BY measured_at DESC',
      [tireSetId],
    )
    .map(rowToMeasurement);
}

export function deleteMeasurement(db: DatabaseAdapter, id: string): void {
  db.execute('DELETE FROM cr_tire_measurements WHERE id = ?', [id]);
}

// ---------------------------------------------------------------------------
// Tire Rotations
// ---------------------------------------------------------------------------

export function createRotation(
  db: DatabaseAdapter,
  id: string,
  input: {
    tireSetId: string;
    rotatedAt: string;
    odometerAt?: number;
    pattern?: string;
    notes?: string;
  },
): void {
  const now = new Date().toISOString();
  db.execute(
    `INSERT INTO cr_tire_rotations
     (id, tire_set_id, rotated_at, odometer_at, pattern, notes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.tireSetId,
      input.rotatedAt,
      input.odometerAt ?? null,
      input.pattern ?? null,
      input.notes ?? null,
      now,
    ],
  );
}

export function getRotationsByTireSet(
  db: DatabaseAdapter,
  tireSetId: string,
): TireRotation[] {
  return db
    .query<Record<string, unknown>>(
      'SELECT * FROM cr_tire_rotations WHERE tire_set_id = ? ORDER BY rotated_at DESC',
      [tireSetId],
    )
    .map(rowToRotation);
}

export function deleteRotation(db: DatabaseAdapter, id: string): void {
  db.execute('DELETE FROM cr_tire_rotations WHERE id = ?', [id]);
}
