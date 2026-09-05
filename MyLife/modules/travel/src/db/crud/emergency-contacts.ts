/**
 * Emergency Contact CRUD for MyTravel (v5 extended logistics).
 *
 * Contacts can be global (trip_id null) or trip-scoped. IDs use `ec_` prefix.
 */

import type { DatabaseAdapter } from '@mylife/db';
import {
  EmergencyContactInputSchema,
  EmergencyContactUpdateSchema,
  type EmergencyContactInput,
  type EmergencyContactRow,
  type EmergencyContactUpdate,
} from '../../models/schemas';

// ── ID generation ───────────────────────────────────────────────────

let ecIdCounter = 0;
function generateEmergencyContactId(): string {
  ecIdCounter += 1;
  const now = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 10);
  return `ec_${now}${rand}${ecIdCounter.toString(36)}`;
}

// ── Update column whitelist ─────────────────────────────────────────

const UPDATE_COLUMNS = new Set([
  'trip_id',
  'name',
  'relationship',
  'phone',
  'email',
  'country_code',
  'notes',
]);

// ── Create ──────────────────────────────────────────────────────────

export function createEmergencyContact(
  db: DatabaseAdapter,
  input: EmergencyContactInput,
): EmergencyContactRow {
  const parsed = EmergencyContactInputSchema.parse(input);
  const id = generateEmergencyContactId();
  const now = new Date().toISOString();

  const row: EmergencyContactRow = {
    id,
    trip_id: parsed.trip_id ?? null,
    name: parsed.name,
    relationship: parsed.relationship ?? null,
    phone: parsed.phone ?? null,
    email: parsed.email ?? null,
    country_code: parsed.country_code ?? null,
    notes: parsed.notes ?? null,
    created_at: now,
    updated_at: now,
  };

  db.execute(
    `INSERT INTO tv_emergency_contacts (
       id, trip_id, name, relationship, phone, email, country_code, notes,
       created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      row.id,
      row.trip_id,
      row.name,
      row.relationship,
      row.phone,
      row.email,
      row.country_code,
      row.notes,
      row.created_at,
      row.updated_at,
    ],
  );

  return row;
}

// ── Read ────────────────────────────────────────────────────────────

export function getEmergencyContact(
  db: DatabaseAdapter,
  id: string,
): EmergencyContactRow | null {
  const rows = db.query<EmergencyContactRow>(
    `SELECT * FROM tv_emergency_contacts WHERE id = ?`,
    [id],
  );
  return rows[0] ?? null;
}

// ── Update ──────────────────────────────────────────────────────────

export function updateEmergencyContact(
  db: DatabaseAdapter,
  id: string,
  patch: EmergencyContactUpdate,
): void {
  const parsed = EmergencyContactUpdateSchema.parse(patch);
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
    `UPDATE tv_emergency_contacts SET ${fields.join(', ')} WHERE id = ?`,
    values,
  );
}

// ── Delete ──────────────────────────────────────────────────────────

export function deleteEmergencyContact(db: DatabaseAdapter, id: string): void {
  db.execute(`DELETE FROM tv_emergency_contacts WHERE id = ?`, [id]);
}

// ── List ────────────────────────────────────────────────────────────

export interface ListEmergencyContactsOptions {
  tripId?: string;
  globalOnly?: boolean;
}

export function listEmergencyContacts(
  db: DatabaseAdapter,
  opts: ListEmergencyContactsOptions = {},
): EmergencyContactRow[] {
  const where: string[] = [];
  const params: unknown[] = [];

  if (opts.globalOnly) {
    where.push('trip_id IS NULL');
  } else if (opts.tripId) {
    where.push('trip_id = ?');
    params.push(opts.tripId);
  }

  const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
  return db.query<EmergencyContactRow>(
    `SELECT * FROM tv_emergency_contacts ${whereClause} ORDER BY name ASC`,
    params,
  );
}
