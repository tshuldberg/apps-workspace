/**
 * Life Event CRUD operations.
 *
 * When a 'move' event is created, the person's city field is auto-updated
 * to the event description (treated as the new city name).
 */

import type { DatabaseAdapter } from '@mylife/db';
import {
  LifeEventInputSchema,
  type LifeEventInput,
  type LifeEventRow,
  type LifeEventRecord,
} from '../../models/life-event-schemas';

// ── Helpers ─────────────────────────────────────────────────────────

function deserialize(row: LifeEventRow): LifeEventRecord {
  return {
    ...row,
    acknowledged: row.acknowledged === 1,
  };
}

// ── CRUD ────────────────────────────────────────────────────────────

export function createLifeEvent(
  db: DatabaseAdapter,
  input: LifeEventInput,
): LifeEventRecord {
  const parsed = LifeEventInputSchema.parse(input);
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const happenedAt = parsed.happened_at ?? now;

  db.execute(
    `INSERT INTO fn_life_events
       (id, person_id, type, description, happened_at, acknowledged, notes_md, created_at)
     VALUES (?, ?, ?, ?, ?, 0, ?, ?)`,
    [
      id,
      parsed.person_id,
      parsed.type,
      parsed.description ?? null,
      happenedAt,
      parsed.notes_md ?? null,
      now,
    ],
  );

  // Auto-update city on move events when description is provided
  if (parsed.type === 'move' && parsed.description?.trim()) {
    db.execute(
      `UPDATE fn_people SET city = ?, updated_at = ? WHERE id = ?`,
      [parsed.description.trim(), now, parsed.person_id],
    );
  }

  return {
    id,
    person_id: parsed.person_id,
    type: parsed.type,
    description: parsed.description ?? null,
    happened_at: happenedAt,
    acknowledged: false,
    notes_md: parsed.notes_md ?? null,
    created_at: now,
  };
}

export function getLifeEvent(
  db: DatabaseAdapter,
  id: string,
): LifeEventRecord | null {
  const rows = db.query<LifeEventRow>(
    `SELECT * FROM fn_life_events WHERE id = ?`,
    [id],
  );
  return rows.length > 0 ? deserialize(rows[0]) : null;
}

export function listEventsForPerson(
  db: DatabaseAdapter,
  personId: string,
): LifeEventRecord[] {
  const rows = db.query<LifeEventRow>(
    `SELECT * FROM fn_life_events WHERE person_id = ? ORDER BY happened_at DESC`,
    [personId],
  );
  return rows.map(deserialize);
}

export function acknowledgeEvent(db: DatabaseAdapter, id: string): void {
  db.execute(
    `UPDATE fn_life_events SET acknowledged = 1 WHERE id = ?`,
    [id],
  );
}

export function deleteLifeEvent(db: DatabaseAdapter, id: string): void {
  db.execute(`DELETE FROM fn_life_events WHERE id = ?`, [id]);
}

export function listRecentEvents(
  db: DatabaseAdapter,
  daysBack: number = 30,
): LifeEventRecord[] {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysBack);
  const cutoffIso = cutoff.toISOString();

  const rows = db.query<LifeEventRow>(
    `SELECT * FROM fn_life_events
     WHERE happened_at >= ?
     ORDER BY happened_at DESC`,
    [cutoffIso],
  );
  return rows.map(deserialize);
}

export function getPeopleByCities(
  db: DatabaseAdapter,
): Record<string, Array<{ id: string; display_name: string }>> {
  const rows = db.query<{ id: string; display_name: string; city: string }>(
    `SELECT id, display_name, city FROM fn_people
     WHERE city IS NOT NULL AND city != '' AND is_archived = 0
     ORDER BY city ASC, display_name ASC`,
    [],
  );

  const result: Record<string, Array<{ id: string; display_name: string }>> = {};
  for (const row of rows) {
    if (!result[row.city]) {
      result[row.city] = [];
    }
    result[row.city].push({ id: row.id, display_name: row.display_name });
  }
  return result;
}
