/**
 * Booking CRUD for MyTravel (flights, hotels, car rentals, trains, ferries, tours).
 *
 * Pure functions of (DatabaseAdapter, input). Rows mirror the SQLite columns.
 * IDs are generated locally with a `bk_` prefix.
 */

import type { DatabaseAdapter } from '@mylife/db';
import {
  BookingInputSchema,
  BookingUpdateSchema,
  type BookingInput,
  type BookingRow,
  type BookingType,
  type BookingUpdate,
} from '../../models/schemas';

// ── ID generation ───────────────────────────────────────────────────

let idCounter = 0;
function generateBookingId(): string {
  idCounter += 1;
  const now = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 10);
  return `bk_${now}${rand}${idCounter.toString(36)}`;
}

// ── Update column whitelist ─────────────────────────────────────────

const UPDATE_COLUMNS = new Set([
  'type',
  'provider',
  'confirmation_code',
  'start_ts',
  'end_ts',
  'location',
  'cost_cents',
  'currency',
  'notes',
  'attachments_ref',
]);

// ── Create ──────────────────────────────────────────────────────────

export function createBooking(
  db: DatabaseAdapter,
  input: BookingInput,
): BookingRow {
  const parsed = BookingInputSchema.parse(input);
  const id = generateBookingId();
  const now = new Date().toISOString();

  const row: BookingRow = {
    id,
    trip_id: parsed.trip_id,
    type: parsed.type,
    provider: parsed.provider,
    confirmation_code: parsed.confirmation_code ?? null,
    start_ts: parsed.start_ts,
    end_ts: parsed.end_ts ?? null,
    location: parsed.location ?? null,
    cost_cents: parsed.cost_cents ?? null,
    currency: parsed.currency ?? null,
    notes: parsed.notes ?? null,
    attachments_ref: parsed.attachments_ref ?? null,
    created_at: now,
    updated_at: now,
  };

  db.execute(
    `INSERT INTO tv_bookings (
       id, trip_id, type, provider, confirmation_code,
       start_ts, end_ts, location, cost_cents, currency,
       notes, attachments_ref, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      row.id,
      row.trip_id,
      row.type,
      row.provider,
      row.confirmation_code,
      row.start_ts,
      row.end_ts,
      row.location,
      row.cost_cents,
      row.currency,
      row.notes,
      row.attachments_ref,
      row.created_at,
      row.updated_at,
    ],
  );

  return row;
}

// ── Read ────────────────────────────────────────────────────────────

export function getBooking(
  db: DatabaseAdapter,
  id: string,
): BookingRow | null {
  const rows = db.query<BookingRow>(
    `SELECT * FROM tv_bookings WHERE id = ?`,
    [id],
  );
  return rows[0] ?? null;
}

// ── Update ──────────────────────────────────────────────────────────

export function updateBooking(
  db: DatabaseAdapter,
  id: string,
  patch: BookingUpdate,
): void {
  const parsed = BookingUpdateSchema.parse(patch);
  const fields: string[] = [];
  const values: unknown[] = [];

  for (const [key, value] of Object.entries(parsed)) {
    if (value === undefined) continue;
    if (!UPDATE_COLUMNS.has(key)) continue;
    fields.push(`${key} = ?`);
    values.push(value);
  }

  if (fields.length === 0) return;

  fields.push('updated_at = ?');
  values.push(new Date().toISOString());
  values.push(id);

  db.execute(
    `UPDATE tv_bookings SET ${fields.join(', ')} WHERE id = ?`,
    values,
  );
}

// ── Delete ──────────────────────────────────────────────────────────

export function deleteBooking(db: DatabaseAdapter, id: string): void {
  db.execute(`DELETE FROM tv_bookings WHERE id = ?`, [id]);
}

// ── List ────────────────────────────────────────────────────────────

export interface ListBookingsOptions {
  tripId?: string;
  type?: BookingType;
}

export function listBookings(
  db: DatabaseAdapter,
  opts: ListBookingsOptions = {},
): BookingRow[] {
  const where: string[] = [];
  const params: unknown[] = [];

  if (opts.tripId) {
    where.push('trip_id = ?');
    params.push(opts.tripId);
  }
  if (opts.type) {
    where.push('type = ?');
    params.push(opts.type);
  }

  const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
  return db.query<BookingRow>(
    `SELECT * FROM tv_bookings ${whereClause} ORDER BY start_ts ASC`,
    params,
  );
}

// ── Upcoming window ─────────────────────────────────────────────────

export interface ListUpcomingBookingsOptions {
  tripId?: string;
  withinDays: number;
}

/**
 * Returns bookings whose start_ts falls between now and now + withinDays.
 * Past bookings are excluded. Ordered by start_ts ASC.
 */
export function listUpcomingBookings(
  db: DatabaseAdapter,
  opts: ListUpcomingBookingsOptions,
): BookingRow[] {
  const now = new Date();
  const end = new Date(now);
  end.setUTCDate(end.getUTCDate() + opts.withinDays);

  const nowIso = now.toISOString();
  const endIso = end.toISOString();

  const where: string[] = ['start_ts >= ?', 'start_ts <= ?'];
  const params: unknown[] = [nowIso, endIso];

  if (opts.tripId) {
    where.push('trip_id = ?');
    params.push(opts.tripId);
  }

  return db.query<BookingRow>(
    `SELECT * FROM tv_bookings WHERE ${where.join(' AND ')} ORDER BY start_ts ASC`,
    params,
  );
}
