/**
 * Wine CRUD operations.
 */

import type { DatabaseAdapter } from '@mylife/db';
import { CreateWineSchema, UpdateWineSchema } from '../../models/schemas';
import type { Wine, CreateWineInput, UpdateWineInput } from '../../models/schemas';

const WINE_COLUMNS = [
  'id',
  'visit_id',
  'restaurant_id',
  'producer',
  'name',
  'vintage',
  'region',
  'varietal',
  'color',
  'rating',
  'price_cents',
  'by_glass',
  'pairing_notes',
  'created_at',
  'updated_at',
].join(', ');

export function createWine(
  db: DatabaseAdapter,
  id: string,
  input: CreateWineInput,
): Wine {
  const parsed = CreateWineSchema.parse(input);
  const now = new Date().toISOString();

  const wine: Wine = {
    id,
    visit_id: parsed.visit_id ?? null,
    restaurant_id: parsed.restaurant_id,
    producer: parsed.producer,
    name: parsed.name,
    vintage: parsed.vintage ?? null,
    region: parsed.region ?? null,
    varietal: parsed.varietal ?? null,
    color: parsed.color ?? null,
    rating: parsed.rating ?? null,
    price_cents: parsed.price_cents ?? null,
    by_glass: parsed.by_glass ?? 0,
    pairing_notes: parsed.pairing_notes ?? null,
    created_at: now,
    updated_at: now,
  };

  db.execute(
    `INSERT INTO dn_wines (${WINE_COLUMNS})
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      wine.id,
      wine.visit_id,
      wine.restaurant_id,
      wine.producer,
      wine.name,
      wine.vintage,
      wine.region,
      wine.varietal,
      wine.color,
      wine.rating,
      wine.price_cents,
      wine.by_glass,
      wine.pairing_notes,
      wine.created_at,
      wine.updated_at,
    ],
  );

  return wine;
}

export function getWine(
  db: DatabaseAdapter,
  id: string,
): Wine | null {
  const rows = db.query<Wine>(
    `SELECT ${WINE_COLUMNS} FROM dn_wines WHERE id = ?`,
    [id],
  );
  if (rows.length === 0) return null;
  return rows[0];
}

export function updateWine(
  db: DatabaseAdapter,
  id: string,
  input: UpdateWineInput,
): void {
  const parsed = UpdateWineSchema.parse(input);
  const fields: string[] = [];
  const values: unknown[] = [];

  const fieldMap: Record<string, unknown> = {
    visit_id: parsed.visit_id,
    producer: parsed.producer,
    name: parsed.name,
    vintage: parsed.vintage,
    region: parsed.region,
    varietal: parsed.varietal,
    color: parsed.color,
    rating: parsed.rating,
    price_cents: parsed.price_cents,
    by_glass: parsed.by_glass,
    pairing_notes: parsed.pairing_notes,
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
    `UPDATE dn_wines SET ${fields.join(', ')} WHERE id = ?`,
    values,
  );
}

export function deleteWine(db: DatabaseAdapter, id: string): void {
  db.execute('DELETE FROM dn_wines WHERE id = ?', [id]);
}

export function listWinesByVisit(
  db: DatabaseAdapter,
  visitId: string,
): Wine[] {
  return db.query<Wine>(
    `SELECT ${WINE_COLUMNS} FROM dn_wines WHERE visit_id = ? ORDER BY created_at`,
    [visitId],
  );
}

export function listWinesByRestaurant(
  db: DatabaseAdapter,
  restaurantId: string,
): Wine[] {
  return db.query<Wine>(
    `SELECT ${WINE_COLUMNS} FROM dn_wines WHERE restaurant_id = ? ORDER BY created_at DESC`,
    [restaurantId],
  );
}
