/**
 * Reservation CRUD operations.
 */

import type { DatabaseAdapter } from '@mylife/db';
import {
  CreateReservationSchema,
  UpdateReservationSchema,
  ReservationFilterSchema,
} from '../../models/schemas';
import type {
  Reservation,
  CreateReservationInput,
  UpdateReservationInput,
  ReservationFilter,
} from '../../models/schemas';

const RESERVATION_COLUMNS = [
  'id',
  'restaurant_id',
  'reserved_at',
  'party_size',
  'confirmation_code',
  'platform',
  'status',
  'cancel_reason',
  'reminder_minutes',
  'notes',
  'visit_id',
  'created_at',
  'updated_at',
].join(', ');

export function createReservation(
  db: DatabaseAdapter,
  id: string,
  input: CreateReservationInput,
): Reservation {
  const parsed = CreateReservationSchema.parse(input);
  const now = new Date().toISOString();

  const reservation: Reservation = {
    id,
    restaurant_id: parsed.restaurant_id,
    reserved_at: parsed.reserved_at,
    party_size: parsed.party_size,
    confirmation_code: parsed.confirmation_code ?? null,
    platform: parsed.platform ?? null,
    status: parsed.status ?? 'upcoming',
    cancel_reason: parsed.cancel_reason ?? null,
    reminder_minutes: parsed.reminder_minutes ?? null,
    notes: parsed.notes ?? null,
    visit_id: parsed.visit_id ?? null,
    created_at: now,
    updated_at: now,
  };

  db.execute(
    `INSERT INTO dn_reservations (${RESERVATION_COLUMNS})
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      reservation.id,
      reservation.restaurant_id,
      reservation.reserved_at,
      reservation.party_size,
      reservation.confirmation_code,
      reservation.platform,
      reservation.status,
      reservation.cancel_reason,
      reservation.reminder_minutes,
      reservation.notes,
      reservation.visit_id,
      reservation.created_at,
      reservation.updated_at,
    ],
  );

  return reservation;
}

export function getReservation(
  db: DatabaseAdapter,
  id: string,
): Reservation | null {
  const rows = db.query<Reservation>(
    `SELECT ${RESERVATION_COLUMNS} FROM dn_reservations WHERE id = ?`,
    [id],
  );
  if (rows.length === 0) return null;
  return rows[0];
}

export function updateReservation(
  db: DatabaseAdapter,
  id: string,
  input: UpdateReservationInput,
): void {
  const parsed = UpdateReservationSchema.parse(input);
  const fields: string[] = [];
  const values: unknown[] = [];

  const fieldMap: Record<string, unknown> = {
    reserved_at: parsed.reserved_at,
    party_size: parsed.party_size,
    confirmation_code: parsed.confirmation_code,
    platform: parsed.platform,
    status: parsed.status,
    cancel_reason: parsed.cancel_reason,
    reminder_minutes: parsed.reminder_minutes,
    notes: parsed.notes,
    visit_id: parsed.visit_id,
  };

  for (const [key, value] of Object.entries(fieldMap)) {
    if (value !== undefined) {
      fields.push(`${key} = ?`);
      values.push(value);
    }
  }

  if (fields.length === 0) return;

  fields.push('updated_at = ?');
  values.push(new Date().toISOString());
  values.push(id);

  db.execute(
    `UPDATE dn_reservations SET ${fields.join(', ')} WHERE id = ?`,
    values,
  );
}

export function deleteReservation(db: DatabaseAdapter, id: string): void {
  db.execute('DELETE FROM dn_reservations WHERE id = ?', [id]);
}

export function listReservations(
  db: DatabaseAdapter,
  filters?: ReservationFilter,
): Reservation[] {
  const parsed = filters ? ReservationFilterSchema.parse(filters) : {};
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (parsed.restaurant_id) {
    conditions.push('restaurant_id = ?');
    params.push(parsed.restaurant_id);
  }

  if (parsed.status) {
    conditions.push('status = ?');
    params.push(parsed.status);
  }

  if (parsed.date_from) {
    conditions.push('reserved_at >= ?');
    params.push(parsed.date_from);
  }

  if (parsed.date_to) {
    conditions.push('reserved_at <= ?');
    params.push(parsed.date_to);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const sortBy = parsed.sort_by ?? 'reserved_at';
  const sortDir = parsed.sort_dir ?? 'DESC';
  const limit = parsed.limit ?? 50;
  const offset = parsed.offset ?? 0;

  return db.query<Reservation>(
    `SELECT ${RESERVATION_COLUMNS} FROM dn_reservations
     ${where}
     ORDER BY ${sortBy} ${sortDir}
     LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );
}

export function listUpcomingReservations(
  db: DatabaseAdapter,
): Reservation[] {
  return db.query<Reservation>(
    `SELECT ${RESERVATION_COLUMNS} FROM dn_reservations
     WHERE status = 'upcoming'
     ORDER BY reserved_at ASC`,
    [],
  );
}

export function cancelReservation(
  db: DatabaseAdapter,
  id: string,
  reason?: string,
): void {
  const now = new Date().toISOString();
  db.execute(
    `UPDATE dn_reservations SET status = 'cancelled', cancel_reason = ?, updated_at = ? WHERE id = ?`,
    [reason ?? null, now, id],
  );
}

export function completeReservation(
  db: DatabaseAdapter,
  id: string,
  visitId?: string,
): void {
  const now = new Date().toISOString();
  db.execute(
    `UPDATE dn_reservations SET status = 'completed', visit_id = ?, updated_at = ? WHERE id = ?`,
    [visitId ?? null, now, id],
  );
}

export function markNoShow(db: DatabaseAdapter, id: string): void {
  const now = new Date().toISOString();
  db.execute(
    `UPDATE dn_reservations SET status = 'no_show', updated_at = ? WHERE id = ?`,
    [now, id],
  );
}

export function getReservationsByDateRange(
  db: DatabaseAdapter,
  from: string,
  to: string,
): Reservation[] {
  return db.query<Reservation>(
    `SELECT ${RESERVATION_COLUMNS} FROM dn_reservations
     WHERE reserved_at >= ? AND reserved_at <= ?
     ORDER BY reserved_at ASC`,
    [from, to],
  );
}
