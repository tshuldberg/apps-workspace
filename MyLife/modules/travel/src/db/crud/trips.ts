/**
 * MyTravel trip CRUD.
 *
 * - Array fields (destination_ids, companion_ids) are serialized to JSON TEXT.
 * - All row reads return the raw snake_case row shape.
 * - duplicate() is transactional and clones itinerary days + activities.
 */

import type { DatabaseAdapter } from '@mylife/db';
import type {
  TripInsert,
  TripListFilter,
  TripRow,
  TripStatus,
  TripUpdate,
} from '../../models/schemas';

// ---------------------------------------------------------------------------
// ID generation (simple, stable, collision-unlikely — does not depend on crypto)
// ---------------------------------------------------------------------------

let idCounter = 0;
function generateId(prefix: string): string {
  idCounter += 1;
  const now = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${now}${rand}${idCounter.toString(36)}`;
}

// ---------------------------------------------------------------------------
// Trip column whitelist (prevents injection via Object.entries)
// ---------------------------------------------------------------------------

const TRIP_COLUMNS = new Set([
  'name',
  'destination_ids',
  'trip_type',
  'start_date',
  'end_date',
  'status',
  'companion_ids',
  'budget_planned_cents',
  'budget_actual_cents',
  'cover_photo_id',
  'notes_md',
  'rating',
  'template_id',
]);

function serializeArray(value: string[] | undefined, fallback: string): string {
  if (value === undefined) return fallback;
  return JSON.stringify(value);
}

// ---------------------------------------------------------------------------
// Create / Read / Update / Delete
// ---------------------------------------------------------------------------

export function createTrip(
  db: DatabaseAdapter,
  input: TripInsert,
  id?: string,
): TripRow {
  const tripId = id ?? generateId('trip');
  const now = new Date().toISOString();

  const row: TripRow = {
    id: tripId,
    name: input.name,
    destination_ids: serializeArray(input.destination_ids, '[]'),
    trip_type: input.trip_type ?? null,
    start_date: input.start_date ?? null,
    end_date: input.end_date ?? null,
    status: input.status ?? 'planning',
    companion_ids: serializeArray(input.companion_ids, '[]'),
    budget_planned_cents: input.budget_planned_cents ?? null,
    budget_actual_cents: input.budget_actual_cents ?? 0,
    cover_photo_id: input.cover_photo_id ?? null,
    notes_md: input.notes_md ?? null,
    rating: input.rating ?? null,
    template_id: input.template_id ?? null,
    created_at: now,
    updated_at: now,
  };

  db.execute(
    `INSERT INTO tv_trips (
       id, name, destination_ids, trip_type, start_date, end_date, status,
       companion_ids, budget_planned_cents, budget_actual_cents,
       cover_photo_id, notes_md, rating, template_id, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      row.id,
      row.name,
      row.destination_ids,
      row.trip_type,
      row.start_date,
      row.end_date,
      row.status,
      row.companion_ids,
      row.budget_planned_cents,
      row.budget_actual_cents,
      row.cover_photo_id,
      row.notes_md,
      row.rating,
      row.template_id,
      row.created_at,
      row.updated_at,
    ],
  );

  return row;
}

export function getTripById(db: DatabaseAdapter, id: string): TripRow | null {
  const rows = db.query<TripRow>(`SELECT * FROM tv_trips WHERE id = ?`, [id]);
  return rows[0] ?? null;
}

export function listTrips(
  db: DatabaseAdapter,
  filter: TripListFilter = {},
): TripRow[] {
  const clauses: string[] = [];
  const params: unknown[] = [];

  if (filter.status) {
    clauses.push('status = ?');
    params.push(filter.status);
  }
  if (filter.trip_type) {
    clauses.push('trip_type = ?');
    params.push(filter.trip_type);
  }
  if (filter.start_after) {
    clauses.push('start_date >= ?');
    params.push(filter.start_after);
  }
  if (filter.start_before) {
    clauses.push('start_date <= ?');
    params.push(filter.start_before);
  }

  const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
  const sql = `SELECT * FROM tv_trips ${where} ORDER BY COALESCE(start_date, created_at) DESC`;
  return db.query<TripRow>(sql, params);
}

export function updateTrip(
  db: DatabaseAdapter,
  id: string,
  updates: TripUpdate,
): void {
  const fields: string[] = [];
  const values: unknown[] = [];

  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined) continue;
    if (!TRIP_COLUMNS.has(key)) continue;

    if (key === 'destination_ids' || key === 'companion_ids') {
      fields.push(`${key} = ?`);
      values.push(JSON.stringify(value));
    } else {
      fields.push(`${key} = ?`);
      values.push(value);
    }
  }

  if (fields.length === 0) return;

  fields.push('updated_at = ?');
  values.push(new Date().toISOString());
  values.push(id);

  db.execute(`UPDATE tv_trips SET ${fields.join(', ')} WHERE id = ?`, values);
}

export function updateTripStatus(
  db: DatabaseAdapter,
  id: string,
  status: TripStatus,
): void {
  db.execute(
    `UPDATE tv_trips SET status = ?, updated_at = ? WHERE id = ?`,
    [status, new Date().toISOString(), id],
  );
}

export function deleteTrip(db: DatabaseAdapter, id: string): void {
  db.execute(`DELETE FROM tv_trips WHERE id = ?`, [id]);
}

export function countTrips(db: DatabaseAdapter): number {
  const rows = db.query<{ count: number }>(
    `SELECT COUNT(*) as count FROM tv_trips`,
  );
  return rows[0]?.count ?? 0;
}

// ---------------------------------------------------------------------------
// Trip duplication (template)
// ---------------------------------------------------------------------------

export interface DuplicateTripOptions {
  newName?: string;
  dateOffset?: { days: number };
}

interface DayRow {
  id: string;
  trip_id: string;
  date: string | null;
  day_number: number;
  location: string | null;
  weather_notes: string | null;
  summary_md: string | null;
  photo_ids: string | null;
  created_at: string;
  updated_at: string;
}

interface ActivityRow {
  id: string;
  day_id: string;
  trip_id: string;
  time: string | null;
  end_time: string | null;
  title: string;
  type: string | null;
  location: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  confirmation_code: string | null;
  cost_cents: number | null;
  notes_md: string | null;
  booking_url: string | null;
  photo_id: string | null;
  created_at: string;
}

function shiftIsoDate(iso: string | null, days: number): string | null {
  if (!iso) return iso;
  // Accepts YYYY-MM-DD or full ISO; preserves time portion if present.
  const hasTime = iso.includes('T');
  const base = hasTime ? iso : `${iso}T00:00:00.000Z`;
  const d = new Date(base);
  if (Number.isNaN(d.getTime())) return iso;
  d.setUTCDate(d.getUTCDate() + days);
  if (hasTime) return d.toISOString();
  return d.toISOString().slice(0, 10);
}

/**
 * Duplicate a trip, cloning all itinerary days and activities with new IDs.
 * Status resets to 'planning' and budget_actual_cents resets to 0.
 * Runs in a single transaction.
 */
export function duplicateTrip(
  db: DatabaseAdapter,
  sourceTripId: string,
  options: DuplicateTripOptions = {},
): TripRow {
  const source = getTripById(db, sourceTripId);
  if (!source) {
    throw new Error(`Trip not found: ${sourceTripId}`);
  }

  const dayOffset = options.dateOffset?.days ?? 0;
  const newTripId = generateId('trip');
  const now = new Date().toISOString();

  const newTrip: TripRow = {
    id: newTripId,
    name: options.newName ?? `${source.name} (Copy)`,
    destination_ids: source.destination_ids ?? '[]',
    trip_type: source.trip_type ?? null,
    start_date: shiftIsoDate(source.start_date ?? null, dayOffset),
    end_date: shiftIsoDate(source.end_date ?? null, dayOffset),
    status: 'planning',
    companion_ids: source.companion_ids ?? '[]',
    budget_planned_cents: source.budget_planned_cents ?? null,
    budget_actual_cents: 0,
    cover_photo_id: source.cover_photo_id ?? null,
    notes_md: source.notes_md ?? null,
    rating: null,
    template_id: source.id,
    created_at: now,
    updated_at: now,
  };

  db.transaction(() => {
    db.execute(
      `INSERT INTO tv_trips (
         id, name, destination_ids, trip_type, start_date, end_date, status,
         companion_ids, budget_planned_cents, budget_actual_cents,
         cover_photo_id, notes_md, rating, template_id, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        newTrip.id,
        newTrip.name,
        newTrip.destination_ids,
        newTrip.trip_type,
        newTrip.start_date,
        newTrip.end_date,
        newTrip.status,
        newTrip.companion_ids,
        newTrip.budget_planned_cents,
        newTrip.budget_actual_cents,
        newTrip.cover_photo_id,
        newTrip.notes_md,
        newTrip.rating,
        newTrip.template_id,
        newTrip.created_at,
        newTrip.updated_at,
      ],
    );

    const sourceDays = db.query<DayRow>(
      `SELECT * FROM tv_itinerary_days WHERE trip_id = ? ORDER BY day_number ASC`,
      [sourceTripId],
    );

    const dayIdMap = new Map<string, string>();

    for (const day of sourceDays) {
      const newDayId = generateId('day');
      dayIdMap.set(day.id, newDayId);

      db.execute(
        `INSERT INTO tv_itinerary_days (
           id, trip_id, date, day_number, location, weather_notes, summary_md,
           photo_ids, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          newDayId,
          newTripId,
          shiftIsoDate(day.date, dayOffset),
          day.day_number,
          day.location,
          day.weather_notes,
          day.summary_md,
          day.photo_ids ?? '[]',
          now,
          now,
        ],
      );
    }

    const sourceActivities = db.query<ActivityRow>(
      `SELECT * FROM tv_activities WHERE trip_id = ?`,
      [sourceTripId],
    );

    for (const activity of sourceActivities) {
      const newDayId = dayIdMap.get(activity.day_id);
      if (!newDayId) continue; // orphaned activity — skip rather than break
      const newActivityId = generateId('act');

      db.execute(
        `INSERT INTO tv_activities (
           id, day_id, trip_id, time, end_time, title, type, location, address,
           lat, lng, confirmation_code, cost_cents, notes_md, booking_url,
           photo_id, created_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          newActivityId,
          newDayId,
          newTripId,
          activity.time,
          activity.end_time,
          activity.title,
          activity.type,
          activity.location,
          activity.address,
          activity.lat,
          activity.lng,
          activity.confirmation_code,
          activity.cost_cents,
          activity.notes_md,
          activity.booking_url,
          activity.photo_id,
          now,
        ],
      );
    }
  });

  return newTrip;
}
