import type { DatabaseAdapter } from '@mylife/db';
import type { Trip } from '../types';

// ---------------------------------------------------------------------------
// Row mapper (snake_case SQL -> camelCase TS)
// ---------------------------------------------------------------------------

function rowToTrip(row: Record<string, unknown>): Trip {
  return {
    id: row.id as string,
    vehicleId: row.vehicle_id as string,
    purpose: row.purpose as Trip['purpose'],
    routeName: (row.route_name as string) ?? null,
    startOdometer: row.start_odometer as number,
    endOdometer: row.end_odometer as number,
    distance: row.distance as number,
    startedAt: row.started_at as string,
    endedAt: (row.ended_at as string) ?? null,
    notes: (row.notes as string) ?? null,
    createdAt: row.created_at as string,
  };
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export function createTrip(
  db: DatabaseAdapter,
  id: string,
  input: {
    vehicleId: string;
    purpose: string;
    routeName?: string;
    startOdometer: number;
    endOdometer: number;
    startedAt: string;
    endedAt?: string;
    notes?: string;
  },
): void {
  const distance = input.endOdometer - input.startOdometer;
  const now = new Date().toISOString();
  db.execute(
    `INSERT INTO cr_trips (id, vehicle_id, purpose, route_name, start_odometer, end_odometer, distance, started_at, ended_at, notes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.vehicleId,
      input.purpose,
      input.routeName ?? null,
      input.startOdometer,
      input.endOdometer,
      distance,
      input.startedAt,
      input.endedAt ?? null,
      input.notes ?? null,
      now,
    ],
  );
}

export function getTripsByVehicle(db: DatabaseAdapter, vehicleId: string, limit = 500): Trip[] {
  return db
    .query<Record<string, unknown>>(
      'SELECT * FROM cr_trips WHERE vehicle_id = ? ORDER BY started_at DESC LIMIT ?',
      [vehicleId, limit],
    )
    .map(rowToTrip);
}

export function getTripsByPurpose(
  db: DatabaseAdapter,
  vehicleId: string,
  purpose: string,
): Trip[] {
  return db
    .query<Record<string, unknown>>(
      'SELECT * FROM cr_trips WHERE vehicle_id = ? AND purpose = ? ORDER BY started_at DESC',
      [vehicleId, purpose],
    )
    .map(rowToTrip);
}

export function deleteTrip(db: DatabaseAdapter, id: string): void {
  db.execute('DELETE FROM cr_trips WHERE id = ?', [id]);
}
