import { v4 as uuidv4 } from 'uuid';
import type { DatabaseAdapter } from '@mylife/db';
import { PinInputSchema, type PinInput, type PinRow } from '../../types';

export function createPin(db: DatabaseAdapter, input: PinInput): string {
  const data = PinInputSchema.parse(input);
  const id = data.id ?? uuidv4();
  db.execute(
    `INSERT INTO mh_pins (id, name, category, lat, lng, neighborhood, photo_ref, is_shareable)
     VALUES (?,?,?,?,?,?,?,?)`,
    [id, data.name, data.category ?? null, data.lat ?? null, data.lng ?? null,
     data.neighborhood ?? null, data.photoRef ?? null, data.isShareable ? 1 : 0],
  );
  return id;
}

export function updatePin(db: DatabaseAdapter, id: string, input: PinInput): void {
  const data = PinInputSchema.parse(input);
  db.execute(
    `UPDATE mh_pins
     SET name = ?, category = ?, lat = ?, lng = ?, neighborhood = ?, photo_ref = ?,
         is_shareable = ?, updated_at = datetime('now')
     WHERE id = ?`,
    [data.name, data.category ?? null, data.lat ?? null, data.lng ?? null,
     data.neighborhood ?? null, data.photoRef ?? null, data.isShareable ? 1 : 0, id],
  );
}

export function getPins(db: DatabaseAdapter): PinRow[] {
  return db.query<PinRow>(`SELECT * FROM mh_pins WHERE deleted_at IS NULL ORDER BY name ASC`);
}

export function getPinById(db: DatabaseAdapter, id: string): PinRow | null {
  const rows = db.query<PinRow>(`SELECT * FROM mh_pins WHERE id = ? AND deleted_at IS NULL`, [id]);
  return rows[0] ?? null;
}

export function setPinShareable(db: DatabaseAdapter, id: string, shareable: boolean): void {
  db.execute(`UPDATE mh_pins SET is_shareable = ?, updated_at = datetime('now') WHERE id = ?`,
    [shareable ? 1 : 0, id]);
}

export function softDeletePin(db: DatabaseAdapter, id: string): void {
  db.execute(`UPDATE mh_pins SET deleted_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`, [id]);
}
