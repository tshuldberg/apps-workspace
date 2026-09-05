/**
 * Gift CRUD operations.
 *
 * Gifts track items given to or received from a person, with optional
 * occasion, amount, and reaction notes.
 */

import type { DatabaseAdapter } from '@mylife/db';
import {
  GiftInputSchema,
  type GiftInput,
  type GiftRow,
  type GiftRecord,
} from '../../models/gift-schemas';

// ── CRUD ────────────────────────────────────────────────────────────

export function createGift(
  db: DatabaseAdapter,
  input: GiftInput,
): GiftRecord {
  const parsed = GiftInputSchema.parse(input);
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  db.execute(
    `INSERT INTO fn_gifts
       (id, person_id, direction, description, occasion,
        amount_cents, date, reaction_notes, photo_id, link_url,
        created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      parsed.person_id,
      parsed.direction,
      parsed.description,
      parsed.occasion ?? null,
      parsed.amount_cents ?? null,
      parsed.date ?? null,
      parsed.reaction_notes ?? null,
      parsed.photo_id ?? null,
      parsed.link_url ?? null,
      now,
    ],
  );

  return {
    id,
    person_id: parsed.person_id,
    direction: parsed.direction,
    description: parsed.description,
    occasion: parsed.occasion ?? null,
    amount_cents: parsed.amount_cents ?? null,
    date: parsed.date ?? null,
    reaction_notes: parsed.reaction_notes ?? null,
    photo_id: parsed.photo_id ?? null,
    link_url: parsed.link_url ?? null,
    created_at: now,
  };
}

export function getGift(
  db: DatabaseAdapter,
  id: string,
): GiftRecord | null {
  const rows = db.query<GiftRow>(
    `SELECT * FROM fn_gifts WHERE id = ?`,
    [id],
  );
  return rows.length > 0 ? rows[0] : null;
}

export function deleteGift(db: DatabaseAdapter, id: string): void {
  db.execute(`DELETE FROM fn_gifts WHERE id = ?`, [id]);
}

export function listGiftsForPerson(
  db: DatabaseAdapter,
  personId: string,
  direction?: string,
): GiftRecord[] {
  let sql = 'SELECT * FROM fn_gifts WHERE person_id = ?';
  const params: unknown[] = [personId];

  if (direction) {
    sql += ' AND direction = ?';
    params.push(direction);
  }

  sql += ' ORDER BY COALESCE(date, created_at) DESC';

  return db.query<GiftRow>(sql, params);
}

export function listGiftsByOccasion(
  db: DatabaseAdapter,
  personId: string,
  occasion: string,
): GiftRecord[] {
  return db.query<GiftRow>(
    `SELECT * FROM fn_gifts
     WHERE person_id = ? AND occasion = ?
     ORDER BY COALESCE(date, created_at) DESC`,
    [personId, occasion],
  );
}

export function getGiftSpendingForPerson(
  db: DatabaseAdapter,
  personId: string,
): number {
  const rows = db.query<{ total: number | null }>(
    `SELECT SUM(amount_cents) AS total
     FROM fn_gifts
     WHERE person_id = ? AND direction = 'given' AND amount_cents IS NOT NULL`,
    [personId],
  );
  return rows[0]?.total ?? 0;
}
