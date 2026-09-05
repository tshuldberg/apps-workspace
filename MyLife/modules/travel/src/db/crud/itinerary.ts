/**
 * MyTravel itinerary day + activity CRUD.
 *
 * Itinerary days belong to a trip. Activities belong to a day (and carry
 * trip_id for trip-wide queries).
 */

import type { DatabaseAdapter } from '@mylife/db';
import type {
  ActivityInsert,
  ActivityRow,
  ActivityUpdate,
  ItineraryDayInsert,
  ItineraryDayRow,
  ItineraryDayUpdate,
} from '../../models/schemas';

// ---------------------------------------------------------------------------
// ID generation (shared pattern with trips.ts but independent counter)
// ---------------------------------------------------------------------------

let idCounter = 0;
function generateId(prefix: string): string {
  idCounter += 1;
  const now = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${now}${rand}${idCounter.toString(36)}`;
}

// ---------------------------------------------------------------------------
// Column whitelists
// ---------------------------------------------------------------------------

const DAY_COLUMNS = new Set([
  'date',
  'day_number',
  'location',
  'weather_notes',
  'summary_md',
  'photo_ids',
]);

const ACTIVITY_COLUMNS = new Set([
  'time',
  'end_time',
  'title',
  'type',
  'location',
  'address',
  'lat',
  'lng',
  'confirmation_code',
  'cost_cents',
  'notes_md',
  'booking_url',
  'photo_id',
]);

function serializeArray(
  value: string[] | undefined,
  fallback: string,
): string {
  if (value === undefined) return fallback;
  return JSON.stringify(value);
}

// ---------------------------------------------------------------------------
// Itinerary days
// ---------------------------------------------------------------------------

export function createDay(
  db: DatabaseAdapter,
  input: ItineraryDayInsert,
  id?: string,
): ItineraryDayRow {
  const dayId = id ?? generateId('day');
  const now = new Date().toISOString();

  const row: ItineraryDayRow = {
    id: dayId,
    trip_id: input.trip_id,
    date: input.date ?? null,
    day_number: input.day_number,
    location: input.location ?? null,
    weather_notes: input.weather_notes ?? null,
    summary_md: input.summary_md ?? null,
    photo_ids: serializeArray(input.photo_ids, '[]'),
    created_at: now,
    updated_at: now,
  };

  db.execute(
    `INSERT INTO tv_itinerary_days (
       id, trip_id, date, day_number, location, weather_notes, summary_md,
       photo_ids, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      row.id,
      row.trip_id,
      row.date,
      row.day_number,
      row.location,
      row.weather_notes,
      row.summary_md,
      row.photo_ids,
      row.created_at,
      row.updated_at,
    ],
  );

  return row;
}

export function getDayById(
  db: DatabaseAdapter,
  id: string,
): ItineraryDayRow | null {
  const rows = db.query<ItineraryDayRow>(
    `SELECT * FROM tv_itinerary_days WHERE id = ?`,
    [id],
  );
  return rows[0] ?? null;
}

export function listDaysByTrip(
  db: DatabaseAdapter,
  tripId: string,
): ItineraryDayRow[] {
  return db.query<ItineraryDayRow>(
    `SELECT * FROM tv_itinerary_days WHERE trip_id = ? ORDER BY day_number ASC, date ASC`,
    [tripId],
  );
}

export function updateDay(
  db: DatabaseAdapter,
  id: string,
  updates: ItineraryDayUpdate,
): void {
  const fields: string[] = [];
  const values: unknown[] = [];

  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined) continue;
    if (!DAY_COLUMNS.has(key)) continue;

    if (key === 'photo_ids') {
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

  db.execute(
    `UPDATE tv_itinerary_days SET ${fields.join(', ')} WHERE id = ?`,
    values,
  );
}

export function deleteDay(db: DatabaseAdapter, id: string): void {
  db.execute(`DELETE FROM tv_itinerary_days WHERE id = ?`, [id]);
}

/**
 * Reorder days within a trip. `orderedDayIds` must list every day in the trip
 * in the desired order; day_number is assigned 1..N.
 */
export function reorderDays(
  db: DatabaseAdapter,
  tripId: string,
  orderedDayIds: string[],
): void {
  const now = new Date().toISOString();
  db.transaction(() => {
    orderedDayIds.forEach((dayId, index) => {
      db.execute(
        `UPDATE tv_itinerary_days SET day_number = ?, updated_at = ?
         WHERE id = ? AND trip_id = ?`,
        [index + 1, now, dayId, tripId],
      );
    });
  });
}

export function countDaysByTrip(db: DatabaseAdapter, tripId: string): number {
  const rows = db.query<{ count: number }>(
    `SELECT COUNT(*) as count FROM tv_itinerary_days WHERE trip_id = ?`,
    [tripId],
  );
  return rows[0]?.count ?? 0;
}

// ---------------------------------------------------------------------------
// Activities
// ---------------------------------------------------------------------------

export function createActivity(
  db: DatabaseAdapter,
  input: ActivityInsert,
  id?: string,
): ActivityRow {
  const activityId = id ?? generateId('act');
  const now = new Date().toISOString();

  const row: ActivityRow = {
    id: activityId,
    day_id: input.day_id,
    trip_id: input.trip_id,
    time: input.time ?? null,
    end_time: input.end_time ?? null,
    title: input.title,
    type: input.type ?? null,
    location: input.location ?? null,
    address: input.address ?? null,
    lat: input.lat ?? null,
    lng: input.lng ?? null,
    confirmation_code: input.confirmation_code ?? null,
    cost_cents: input.cost_cents ?? null,
    notes_md: input.notes_md ?? null,
    booking_url: input.booking_url ?? null,
    photo_id: input.photo_id ?? null,
    created_at: now,
  };

  db.execute(
    `INSERT INTO tv_activities (
       id, day_id, trip_id, time, end_time, title, type, location, address,
       lat, lng, confirmation_code, cost_cents, notes_md, booking_url,
       photo_id, created_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      row.id,
      row.day_id,
      row.trip_id,
      row.time,
      row.end_time,
      row.title,
      row.type,
      row.location,
      row.address,
      row.lat,
      row.lng,
      row.confirmation_code,
      row.cost_cents,
      row.notes_md,
      row.booking_url,
      row.photo_id,
      row.created_at,
    ],
  );

  return row;
}

export function getActivityById(
  db: DatabaseAdapter,
  id: string,
): ActivityRow | null {
  const rows = db.query<ActivityRow>(
    `SELECT * FROM tv_activities WHERE id = ?`,
    [id],
  );
  return rows[0] ?? null;
}

export function listActivitiesByDay(
  db: DatabaseAdapter,
  dayId: string,
): ActivityRow[] {
  return db.query<ActivityRow>(
    `SELECT * FROM tv_activities WHERE day_id = ?
     ORDER BY COALESCE(time, '99:99') ASC, created_at ASC`,
    [dayId],
  );
}

export function listActivitiesByTrip(
  db: DatabaseAdapter,
  tripId: string,
): ActivityRow[] {
  return db.query<ActivityRow>(
    `SELECT * FROM tv_activities WHERE trip_id = ?
     ORDER BY created_at ASC`,
    [tripId],
  );
}

export function updateActivity(
  db: DatabaseAdapter,
  id: string,
  updates: ActivityUpdate,
): void {
  const fields: string[] = [];
  const values: unknown[] = [];

  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined) continue;
    if (!ACTIVITY_COLUMNS.has(key)) continue;
    fields.push(`${key} = ?`);
    values.push(value);
  }

  if (fields.length === 0) return;

  values.push(id);
  db.execute(
    `UPDATE tv_activities SET ${fields.join(', ')} WHERE id = ?`,
    values,
  );
}

export function deleteActivity(db: DatabaseAdapter, id: string): void {
  db.execute(`DELETE FROM tv_activities WHERE id = ?`, [id]);
}

/**
 * Reorder activities within a day by updating their `time` fields in place.
 * The ordering persists via the time string; orderedActivityIds must cover
 * every activity on that day. If times collide, tie-break stays with
 * created_at. This is a light reorder that does not change day membership.
 */
export function reorderActivities(
  db: DatabaseAdapter,
  dayId: string,
  orderedActivityIds: string[],
): void {
  db.transaction(() => {
    orderedActivityIds.forEach((activityId, index) => {
      // Encode order into synthetic time slot (HH:MM) — 00:00, 00:01, ...
      // Callers that care about real times should use updateActivity instead.
      const hh = Math.floor(index / 60).toString().padStart(2, '0');
      const mm = (index % 60).toString().padStart(2, '0');
      db.execute(
        `UPDATE tv_activities SET time = ? WHERE id = ? AND day_id = ?`,
        [`${hh}:${mm}`, activityId, dayId],
      );
    });
  });
}

export function countActivitiesByTrip(
  db: DatabaseAdapter,
  tripId: string,
): number {
  const rows = db.query<{ count: number }>(
    `SELECT COUNT(*) as count FROM tv_activities WHERE trip_id = ?`,
    [tripId],
  );
  return rows[0]?.count ?? 0;
}
