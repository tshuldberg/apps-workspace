/**
 * Gift Idea CRUD operations.
 *
 * Gift ideas are lightweight captures of potential gifts for a person,
 * with optional price estimate, priority, and source note.
 */

import type { DatabaseAdapter } from '@mylife/db';
import {
  GiftIdeaInputSchema,
  GiftIdeaUpdateSchema,
  type GiftIdeaInput,
  type GiftIdeaUpdate,
  type GiftIdeaRow,
  type GiftIdeaRecord,
} from '../../models/gift-schemas';

// ── Helpers ─────────────────────────────────────────────────────────

function deserialize(row: GiftIdeaRow): GiftIdeaRecord {
  return {
    ...row,
    is_purchased: row.is_purchased === 1,
  };
}

// ── Updatable columns (guard against SQL injection via allowlist) ───

const SCALAR_COLUMNS = new Set([
  'description',
  'estimated_price_cents',
  'priority',
  'source_note',
  'link_url',
]);

// ── CRUD ────────────────────────────────────────────────────────────

export function createIdea(
  db: DatabaseAdapter,
  input: GiftIdeaInput,
): GiftIdeaRecord {
  const parsed = GiftIdeaInputSchema.parse(input);
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  db.execute(
    `INSERT INTO fn_gift_ideas
       (id, person_id, description, estimated_price_cents,
        priority, source_note, link_url, is_purchased,
        created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
    [
      id,
      parsed.person_id,
      parsed.description,
      parsed.estimated_price_cents ?? null,
      parsed.priority,
      parsed.source_note ?? null,
      parsed.link_url ?? null,
      now,
      now,
    ],
  );

  return {
    id,
    person_id: parsed.person_id,
    description: parsed.description,
    estimated_price_cents: parsed.estimated_price_cents ?? null,
    priority: parsed.priority,
    source_note: parsed.source_note ?? null,
    link_url: parsed.link_url ?? null,
    is_purchased: false,
    created_at: now,
    updated_at: now,
  };
}

export function getIdea(
  db: DatabaseAdapter,
  id: string,
): GiftIdeaRecord | null {
  const rows = db.query<GiftIdeaRow>(
    `SELECT * FROM fn_gift_ideas WHERE id = ?`,
    [id],
  );
  return rows.length > 0 ? deserialize(rows[0]) : null;
}

export function updateIdea(
  db: DatabaseAdapter,
  id: string,
  updates: GiftIdeaUpdate,
): void {
  const parsed = GiftIdeaUpdateSchema.parse(updates);
  const fields: string[] = [];
  const values: unknown[] = [];

  for (const [key, value] of Object.entries(parsed)) {
    if (value === undefined) continue;

    if (key === 'is_purchased') {
      fields.push('is_purchased = ?');
      values.push(value ? 1 : 0);
    } else if (SCALAR_COLUMNS.has(key)) {
      fields.push(`${key} = ?`);
      values.push(value);
    }
  }

  if (fields.length === 0) return;

  fields.push('updated_at = ?');
  values.push(new Date().toISOString());
  values.push(id);

  db.execute(
    `UPDATE fn_gift_ideas SET ${fields.join(', ')} WHERE id = ?`,
    values,
  );
}

export function deleteIdea(db: DatabaseAdapter, id: string): void {
  db.execute(`DELETE FROM fn_gift_ideas WHERE id = ?`, [id]);
}

export function listIdeasForPerson(
  db: DatabaseAdapter,
  personId: string,
): GiftIdeaRecord[] {
  const rows = db.query<GiftIdeaRow>(
    `SELECT * FROM fn_gift_ideas
     WHERE person_id = ?
     ORDER BY priority DESC, created_at DESC`,
    [personId],
  );
  return rows.map(deserialize);
}

export function markPurchased(db: DatabaseAdapter, id: string): void {
  db.execute(
    `UPDATE fn_gift_ideas SET is_purchased = 1, updated_at = ? WHERE id = ?`,
    [new Date().toISOString(), id],
  );
}
