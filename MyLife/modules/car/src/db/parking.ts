import type { DatabaseAdapter } from '@mylife/db';
import type { ParkingLocation } from '../types';

// ---------------------------------------------------------------------------
// Row mapper (snake_case SQL -> camelCase TS)
// ---------------------------------------------------------------------------

function rowToParking(row: Record<string, unknown>): ParkingLocation {
  return {
    id: row.id as string,
    vehicleId: row.vehicle_id as string,
    latitude: row.latitude as number,
    longitude: row.longitude as number,
    altitude: (row.altitude as number) ?? null,
    accuracy: (row.accuracy as number) ?? null,
    level: (row.level as string) ?? null,
    spot: (row.spot as string) ?? null,
    photoUri: (row.photo_uri as string) ?? null,
    meterExpiresAt: (row.meter_expires_at as string) ?? null,
    notes: (row.notes as string) ?? null,
    isActive: !!(row.is_active as number),
    savedAt: row.saved_at as string,
    clearedAt: (row.cleared_at as string) ?? null,
    createdAt: row.created_at as string,
  };
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

/**
 * Save a new parking location. Deactivates any existing active parking
 * for the same vehicle before inserting the new one.
 */
export function saveParking(
  db: DatabaseAdapter,
  id: string,
  input: {
    vehicleId: string;
    latitude: number;
    longitude: number;
    altitude?: number;
    accuracy?: number;
    level?: string;
    spot?: string;
    photoUri?: string;
    meterExpiresAt?: string;
    notes?: string;
  },
): void {
  const now = new Date().toISOString();

  db.transaction(() => {
    // Deactivate any existing active parking for this vehicle
    db.execute(
      `UPDATE cr_parking_locations SET is_active = 0, cleared_at = ? WHERE vehicle_id = ? AND is_active = 1`,
      [now, input.vehicleId],
    );

    db.execute(
      `INSERT INTO cr_parking_locations
       (id, vehicle_id, latitude, longitude, altitude, accuracy, level, spot, photo_uri, meter_expires_at, notes, is_active, saved_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      [
        id,
        input.vehicleId,
        input.latitude,
        input.longitude,
        input.altitude ?? null,
        input.accuracy ?? null,
        input.level ?? null,
        input.spot ?? null,
        input.photoUri ?? null,
        input.meterExpiresAt ?? null,
        input.notes ?? null,
        now,
        now,
      ],
    );
  });
}

/**
 * Get the currently active parking location for a vehicle.
 * Returns null if no active parking exists.
 */
export function getActiveParking(db: DatabaseAdapter, vehicleId: string): ParkingLocation | null {
  const rows = db.query<Record<string, unknown>>(
    'SELECT * FROM cr_parking_locations WHERE vehicle_id = ? AND is_active = 1 LIMIT 1',
    [vehicleId],
  );
  return rows.length > 0 ? rowToParking(rows[0]) : null;
}

/**
 * Clear (deactivate) a parking location by setting is_active=0 and cleared_at=now.
 */
export function clearParking(db: DatabaseAdapter, id: string): void {
  db.execute(
    `UPDATE cr_parking_locations SET is_active = 0, cleared_at = datetime('now') WHERE id = ?`,
    [id],
  );
}

/**
 * Get parking history for a vehicle, ordered by most recent first.
 * Default limit is 20 entries.
 */
export function getParkingHistory(db: DatabaseAdapter, vehicleId: string, limit: number = 20): ParkingLocation[] {
  return db.query<Record<string, unknown>>(
    'SELECT * FROM cr_parking_locations WHERE vehicle_id = ? ORDER BY saved_at DESC LIMIT ?',
    [vehicleId, limit],
  ).map(rowToParking);
}
