import type { DatabaseAdapter } from '@mylife/db';
import {
  StoreNoteInputSchema,
  StoreNoteSchema,
  type StoreNote,
  type StoreNoteInput,
} from '../../models/schemas';

function nowMs(): number {
  return Date.now();
}

function randomId(): string {
  return (
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 10) +
    Math.random().toString(36).slice(2, 10)
  );
}

function parseInt0(raw: unknown): number {
  if (typeof raw === 'number') return raw;
  if (typeof raw === 'string' && raw.length > 0) return Number(raw);
  return 0;
}

function rowToNote(row: Record<string, unknown>): StoreNote {
  return StoreNoteSchema.parse({
    id: row.id,
    storeName: row.store_name,
    returnsPolicy: (row.returns_policy as string | null) ?? null,
    shippingNotes: (row.shipping_notes as string | null) ?? null,
    rewardsNotes: (row.rewards_notes as string | null) ?? null,
    createdAt: parseInt0(row.created_at),
    updatedAt: parseInt0(row.updated_at),
  });
}

/**
 * Insert or update a store note keyed by store_name.
 */
export function upsertStoreNote(
  db: DatabaseAdapter,
  rawInput: StoreNoteInput,
): StoreNote {
  const input = StoreNoteInputSchema.parse(rawInput);
  const existing = getStoreNoteByName(db, input.storeName);
  const now = nowMs();
  if (existing) {
    db.execute(
      `UPDATE sh_store_notes
         SET returns_policy = ?, shipping_notes = ?, rewards_notes = ?, updated_at = ?
       WHERE id = ?`,
      [
        input.returnsPolicy,
        input.shippingNotes,
        input.rewardsNotes,
        now,
        existing.id,
      ],
    );
    return getStoreNoteById(db, existing.id)!;
  }
  const id = randomId();
  db.execute(
    `INSERT INTO sh_store_notes (
       id, store_name, returns_policy, shipping_notes, rewards_notes,
       created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.storeName,
      input.returnsPolicy,
      input.shippingNotes,
      input.rewardsNotes,
      now,
      now,
    ],
  );
  return getStoreNoteById(db, id)!;
}

export function getStoreNoteById(
  db: DatabaseAdapter,
  id: string,
): StoreNote | null {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM sh_store_notes WHERE id = ?`,
    [id],
  );
  return rows[0] ? rowToNote(rows[0]) : null;
}

export function getStoreNoteByName(
  db: DatabaseAdapter,
  storeName: string,
): StoreNote | null {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM sh_store_notes WHERE store_name = ? LIMIT 1`,
    [storeName],
  );
  return rows[0] ? rowToNote(rows[0]) : null;
}

export function listStoreNotes(db: DatabaseAdapter): StoreNote[] {
  return db
    .query<Record<string, unknown>>(
      `SELECT * FROM sh_store_notes ORDER BY store_name ASC LIMIT 1000`,
    )
    .map(rowToNote);
}

export function deleteStoreNote(db: DatabaseAdapter, id: string): boolean {
  const existing = getStoreNoteById(db, id);
  if (!existing) return false;
  db.execute(`DELETE FROM sh_store_notes WHERE id = ?`, [id]);
  return true;
}
