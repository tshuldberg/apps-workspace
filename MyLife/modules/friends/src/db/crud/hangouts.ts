/**
 * Hangout CRUD operations.
 *
 * JSON array fields (people_ids, activity_tags, photo_ids) are stored as TEXT
 * in SQLite. All reads deserialize; all writes serialize.
 */

import type { DatabaseAdapter } from '@mylife/db';
import type { z } from 'zod';
import {
  HangoutInputSchema,
  HangoutUpdateSchema,
  type HangoutRow,
  type HangoutRecord,
  type HangoutFilter,
} from '../../models/hangout-schemas';

/** Input accepted by createHangout. */
export type HangoutInput = z.input<typeof HangoutInputSchema>;
/** Partial update accepted by updateHangout. */
export type HangoutUpdate = z.input<typeof HangoutUpdateSchema>;

// ── Helpers ─────────────────────────────────────────────────────────

function deserialize(row: HangoutRow): HangoutRecord {
  return {
    ...row,
    people_ids: JSON.parse(row.people_ids) as string[],
    activity_tags: JSON.parse(row.activity_tags) as string[],
    photo_ids: JSON.parse(row.photo_ids) as string[],
  };
}

// ── Updatable columns (guard against SQL injection via allowlist) ───

const SCALAR_COLUMNS = new Set([
  'happened_at',
  'duration_minutes',
  'location_name',
  'location_lat',
  'location_lng',
  'quality_rating',
  'notes_md',
  'group_id',
  'linked_dining_visit_id',
  'linked_concert_id',
  'linked_trail_id',
]);

const JSON_COLUMNS = new Set(['people_ids', 'activity_tags', 'photo_ids']);

// ── CRUD ────────────────────────────────────────────────────────────

export function createHangout(
  db: DatabaseAdapter,
  input: HangoutInput,
): HangoutRecord {
  const parsed = HangoutInputSchema.parse(input);
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  db.execute(
    `INSERT INTO fn_hangouts
       (id, people_ids, happened_at, duration_minutes,
        location_name, location_lat, location_lng,
        activity_tags, quality_rating, notes_md, photo_ids,
        group_id, linked_dining_visit_id, linked_concert_id, linked_trail_id,
        created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      JSON.stringify(parsed.people_ids),
      parsed.happened_at,
      parsed.duration_minutes ?? null,
      parsed.location_name ?? null,
      parsed.location_lat ?? null,
      parsed.location_lng ?? null,
      JSON.stringify(parsed.activity_tags),
      parsed.quality_rating ?? null,
      parsed.notes_md ?? null,
      JSON.stringify(parsed.photo_ids),
      parsed.group_id ?? null,
      parsed.linked_dining_visit_id ?? null,
      parsed.linked_concert_id ?? null,
      parsed.linked_trail_id ?? null,
      now,
    ],
  );

  return {
    id,
    people_ids: parsed.people_ids,
    happened_at: parsed.happened_at,
    duration_minutes: parsed.duration_minutes ?? null,
    location_name: parsed.location_name ?? null,
    location_lat: parsed.location_lat ?? null,
    location_lng: parsed.location_lng ?? null,
    activity_tags: parsed.activity_tags,
    quality_rating: parsed.quality_rating ?? null,
    notes_md: parsed.notes_md ?? null,
    photo_ids: parsed.photo_ids,
    group_id: parsed.group_id ?? null,
    linked_dining_visit_id: parsed.linked_dining_visit_id ?? null,
    linked_concert_id: parsed.linked_concert_id ?? null,
    linked_trail_id: parsed.linked_trail_id ?? null,
    created_at: now,
  };
}

export function getHangout(
  db: DatabaseAdapter,
  id: string,
): HangoutRecord | null {
  const rows = db.query<HangoutRow>(
    `SELECT * FROM fn_hangouts WHERE id = ?`,
    [id],
  );
  return rows.length > 0 ? deserialize(rows[0]) : null;
}

export function updateHangout(
  db: DatabaseAdapter,
  id: string,
  updates: HangoutUpdate,
): void {
  const parsed = HangoutUpdateSchema.parse(updates);
  const fields: string[] = [];
  const values: unknown[] = [];

  for (const [key, value] of Object.entries(parsed)) {
    if (value === undefined) continue;

    if (JSON_COLUMNS.has(key)) {
      fields.push(`${key} = ?`);
      values.push(JSON.stringify(value));
    } else if (SCALAR_COLUMNS.has(key)) {
      fields.push(`${key} = ?`);
      values.push(value);
    }
  }

  if (fields.length === 0) return;

  values.push(id);

  db.execute(
    `UPDATE fn_hangouts SET ${fields.join(', ')} WHERE id = ?`,
    values,
  );
}

export function deleteHangout(db: DatabaseAdapter, id: string): void {
  db.execute(`DELETE FROM fn_hangouts WHERE id = ?`, [id]);
}

// ── List with filters ──────────────────────────────────────────────

export function listHangouts(
  db: DatabaseAdapter,
  filters?: HangoutFilter,
): HangoutRecord[] {
  let sql = 'SELECT * FROM fn_hangouts';
  const params: unknown[] = [];
  const where: string[] = [];

  if (filters?.person_id) {
    where.push('people_ids LIKE ?');
    params.push(`%"${filters.person_id}"%`);
  }

  if (filters?.activity_tag) {
    where.push('activity_tags LIKE ?');
    params.push(`%"${filters.activity_tag}"%`);
  }

  if (filters?.date_from) {
    where.push('happened_at >= ?');
    params.push(filters.date_from);
  }

  if (filters?.date_to) {
    where.push('happened_at <= ?');
    params.push(filters.date_to);
  }

  if (filters?.quality_rating_min) {
    where.push('quality_rating >= ?');
    params.push(filters.quality_rating_min);
  }

  if (where.length > 0) {
    sql += ' WHERE ' + where.join(' AND ');
  }

  sql += ' ORDER BY happened_at DESC';

  const rows = db.query<HangoutRow>(sql, params);
  return rows.map(deserialize);
}

export function listHangoutsForPerson(
  db: DatabaseAdapter,
  personId: string,
): HangoutRecord[] {
  const rows = db.query<HangoutRow>(
    `SELECT * FROM fn_hangouts WHERE people_ids LIKE ? ORDER BY happened_at DESC`,
    [`%"${personId}"%`],
  );
  return rows.map(deserialize);
}

export function getLastHangoutDate(
  db: DatabaseAdapter,
  personId: string,
): string | null {
  const rows = db.query<{ happened_at: string }>(
    `SELECT happened_at FROM fn_hangouts
     WHERE people_ids LIKE ?
     ORDER BY happened_at DESC
     LIMIT 1`,
    [`%"${personId}"%`],
  );
  return rows.length > 0 ? rows[0].happened_at : null;
}
