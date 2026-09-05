import type { DatabaseAdapter } from '@mylife/db';
import type { GpsTrip } from '../types';

// ---------------------------------------------------------------------------
// Row mapper (snake_case SQL -> camelCase TS)
// ---------------------------------------------------------------------------

function rowToGpsTrip(row: Record<string, unknown>): GpsTrip {
  return {
    id: row.id as string,
    vehicleId: row.vehicle_id as string,
    purpose: row.purpose as GpsTrip['purpose'],
    routeName: (row.route_name as string) ?? null,
    startLat: (row.start_lat as number) ?? null,
    startLng: (row.start_lng as number) ?? null,
    endLat: (row.end_lat as number) ?? null,
    endLng: (row.end_lng as number) ?? null,
    distanceMeters: row.distance_meters as number,
    durationSeconds: row.duration_seconds as number,
    polylineEncoded: (row.polyline_encoded as string) ?? null,
    startedAt: row.started_at as string,
    endedAt: (row.ended_at as string) ?? null,
    notes: (row.notes as string) ?? null,
    createdAt: row.created_at as string,
  };
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export function createGpsTrip(
  db: DatabaseAdapter,
  id: string,
  input: {
    vehicleId: string;
    purpose?: string;
    routeName?: string;
    startLat?: number;
    startLng?: number;
    endLat?: number;
    endLng?: number;
    distanceMeters: number;
    durationSeconds: number;
    polylineEncoded?: string;
    startedAt: string;
    endedAt?: string;
    notes?: string;
  },
): void {
  const now = new Date().toISOString();
  db.execute(
    `INSERT INTO cr_gps_trips
     (id, vehicle_id, purpose, route_name, start_lat, start_lng, end_lat, end_lng,
      distance_meters, duration_seconds, polyline_encoded, started_at, ended_at, notes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.vehicleId,
      input.purpose ?? 'personal',
      input.routeName ?? null,
      input.startLat ?? null,
      input.startLng ?? null,
      input.endLat ?? null,
      input.endLng ?? null,
      input.distanceMeters,
      input.durationSeconds,
      input.polylineEncoded ?? null,
      input.startedAt,
      input.endedAt ?? null,
      input.notes ?? null,
      now,
    ],
  );
}

export function getGpsTripsByVehicle(db: DatabaseAdapter, vehicleId: string, limit = 500): GpsTrip[] {
  return db
    .query<Record<string, unknown>>(
      'SELECT * FROM cr_gps_trips WHERE vehicle_id = ? ORDER BY started_at DESC LIMIT ?',
      [vehicleId, limit],
    )
    .map(rowToGpsTrip);
}

export function getGpsTripById(db: DatabaseAdapter, id: string): GpsTrip | null {
  const rows = db.query<Record<string, unknown>>(
    'SELECT * FROM cr_gps_trips WHERE id = ?',
    [id],
  );
  return rows.length > 0 ? rowToGpsTrip(rows[0]) : null;
}

export function deleteGpsTrip(db: DatabaseAdapter, id: string): void {
  db.execute('DELETE FROM cr_gps_trips WHERE id = ?', [id]);
}
