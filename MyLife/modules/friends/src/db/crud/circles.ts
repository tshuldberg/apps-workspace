/**
 * Circle CRUD operations.
 *
 * member_ids is stored as a JSON TEXT array in SQLite.
 * All reads deserialize to string[]; all writes serialize back.
 */

import type { DatabaseAdapter } from '@mylife/db';
import type { z } from 'zod';
import {
  CircleInputSchema,
  CircleUpdateSchema,
  type CircleRow,
  type CircleRecord,
} from '../../models/circle-schemas';

/** Input accepted by createCircle (member_ids optional, defaults to []). */
export type CircleInput = z.input<typeof CircleInputSchema>;
/** Partial update accepted by updateCircle. */
export type CircleUpdate = z.input<typeof CircleUpdateSchema>;

// ── Helpers ─────────────────────────────────────────────────────────

function deserialize(row: CircleRow): CircleRecord {
  return {
    ...row,
    member_ids: JSON.parse(row.member_ids) as string[],
  };
}

// ── CRUD ────────────────────────────────────────────────────────────

export function createCircle(
  db: DatabaseAdapter,
  input: CircleInput,
): CircleRecord {
  const parsed = CircleInputSchema.parse(input);
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const memberIdsJson = JSON.stringify(parsed.member_ids);

  db.execute(
    `INSERT INTO fn_circles (id, name, description, icon, color, member_ids, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      parsed.name,
      parsed.description ?? null,
      parsed.icon ?? null,
      parsed.color ?? null,
      memberIdsJson,
      now,
      now,
    ],
  );

  return {
    id,
    name: parsed.name,
    description: parsed.description ?? null,
    icon: parsed.icon ?? null,
    color: parsed.color ?? null,
    member_ids: parsed.member_ids,
    created_at: now,
    updated_at: now,
  };
}

export function getCircle(
  db: DatabaseAdapter,
  id: string,
): CircleRecord | null {
  const rows = db.query<CircleRow>(
    `SELECT * FROM fn_circles WHERE id = ?`,
    [id],
  );
  return rows.length > 0 ? deserialize(rows[0]) : null;
}

export function updateCircle(
  db: DatabaseAdapter,
  id: string,
  updates: CircleUpdate,
): void {
  const parsed = CircleUpdateSchema.parse(updates);
  const fields: string[] = [];
  const values: unknown[] = [];

  if (parsed.name !== undefined) {
    fields.push('name = ?');
    values.push(parsed.name);
  }
  if (parsed.description !== undefined) {
    fields.push('description = ?');
    values.push(parsed.description);
  }
  if (parsed.icon !== undefined) {
    fields.push('icon = ?');
    values.push(parsed.icon);
  }
  if (parsed.color !== undefined) {
    fields.push('color = ?');
    values.push(parsed.color);
  }
  if (parsed.member_ids !== undefined) {
    fields.push('member_ids = ?');
    values.push(JSON.stringify(parsed.member_ids));
  }

  if (fields.length === 0) return;

  fields.push('updated_at = ?');
  values.push(new Date().toISOString());
  values.push(id);

  db.execute(
    `UPDATE fn_circles SET ${fields.join(', ')} WHERE id = ?`,
    values,
  );
}

export function deleteCircle(db: DatabaseAdapter, id: string): void {
  db.execute(`DELETE FROM fn_circles WHERE id = ?`, [id]);
}

export function listCircles(db: DatabaseAdapter): CircleRecord[] {
  const rows = db.query<CircleRow>(
    `SELECT * FROM fn_circles ORDER BY name ASC`,
  );
  return rows.map(deserialize);
}

// ── Membership ──────────────────────────────────────────────────────

export function addMember(
  db: DatabaseAdapter,
  circleId: string,
  personId: string,
): void {
  const rows = db.query<CircleRow>(
    `SELECT member_ids FROM fn_circles WHERE id = ?`,
    [circleId],
  );
  if (rows.length === 0) return;

  const members: string[] = JSON.parse(rows[0].member_ids);
  if (members.includes(personId)) return; // idempotent

  members.push(personId);
  db.execute(
    `UPDATE fn_circles SET member_ids = ?, updated_at = ? WHERE id = ?`,
    [JSON.stringify(members), new Date().toISOString(), circleId],
  );
}

export function removeMember(
  db: DatabaseAdapter,
  circleId: string,
  personId: string,
): void {
  const rows = db.query<CircleRow>(
    `SELECT member_ids FROM fn_circles WHERE id = ?`,
    [circleId],
  );
  if (rows.length === 0) return;

  const members: string[] = JSON.parse(rows[0].member_ids);
  const filtered = members.filter((id) => id !== personId);
  if (filtered.length === members.length) return; // nothing to remove

  db.execute(
    `UPDATE fn_circles SET member_ids = ?, updated_at = ? WHERE id = ?`,
    [JSON.stringify(filtered), new Date().toISOString(), circleId],
  );
}

export function getCirclesForPerson(
  db: DatabaseAdapter,
  personId: string,
): CircleRecord[] {
  // SQLite JSON: check if member_ids array contains the person ID.
  // Using LIKE with the quoted ID is safe for UUIDs (no special chars).
  const rows = db.query<CircleRow>(
    `SELECT * FROM fn_circles WHERE member_ids LIKE ? ORDER BY name ASC`,
    [`%"${personId}"%`],
  );
  return rows.map(deserialize);
}

export function removePersonFromAllCircles(
  db: DatabaseAdapter,
  personId: string,
): void {
  const circles = getCirclesForPerson(db, personId);
  for (const circle of circles) {
    removeMember(db, circle.id, personId);
  }
}
