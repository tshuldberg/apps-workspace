import type { DatabaseAdapter } from '@mylife/db';
import {
  GiftPersonInputSchema,
  GiftPersonSchema,
  GiftPersonUpdateSchema,
  type GiftPerson,
  type GiftPersonInput,
  type GiftPersonUpdate,
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

function parseIntOrNull(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'number') return raw;
  if (typeof raw === 'string' && raw.length > 0) return Number(raw);
  return null;
}

function rowToPerson(row: Record<string, unknown>): GiftPerson {
  return GiftPersonSchema.parse({
    id: row.id,
    name: row.name,
    relationship: row.relationship ?? null,
    nextOccasion: row.next_occasion ?? null,
    nextOccasionDate: parseIntOrNull(row.next_occasion_date),
    notes: row.notes ?? null,
    createdAt: parseInt0(row.created_at),
    updatedAt: parseInt0(row.updated_at),
  });
}

export function createGiftPerson(
  db: DatabaseAdapter,
  rawInput: GiftPersonInput,
): GiftPerson {
  const input = GiftPersonInputSchema.parse(rawInput);
  const id = randomId();
  const now = nowMs();
  db.execute(
    `INSERT INTO sh_gift_people (
       id, name, relationship, next_occasion, next_occasion_date, notes,
       created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.name,
      input.relationship,
      input.nextOccasion,
      input.nextOccasionDate,
      input.notes,
      now,
      now,
    ],
  );
  return getGiftPersonById(db, id)!;
}

export function getGiftPersonById(
  db: DatabaseAdapter,
  id: string,
): GiftPerson | null {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM sh_gift_people WHERE id = ?`,
    [id],
  );
  return rows[0] ? rowToPerson(rows[0]) : null;
}

export function updateGiftPerson(
  db: DatabaseAdapter,
  id: string,
  rawPatch: GiftPersonUpdate,
): GiftPerson | null {
  const existing = getGiftPersonById(db, id);
  if (!existing) return null;
  const patch = GiftPersonUpdateSchema.parse(rawPatch);

  const next = {
    name: patch.name ?? existing.name,
    relationship:
      patch.relationship === undefined ? existing.relationship : patch.relationship,
    nextOccasion:
      patch.nextOccasion === undefined ? existing.nextOccasion : patch.nextOccasion,
    nextOccasionDate:
      patch.nextOccasionDate === undefined
        ? existing.nextOccasionDate
        : patch.nextOccasionDate,
    notes: patch.notes === undefined ? existing.notes : patch.notes,
  };
  const now = nowMs();
  db.execute(
    `UPDATE sh_gift_people
       SET name = ?, relationship = ?, next_occasion = ?,
           next_occasion_date = ?, notes = ?, updated_at = ?
     WHERE id = ?`,
    [
      next.name,
      next.relationship,
      next.nextOccasion,
      next.nextOccasionDate,
      next.notes,
      now,
      id,
    ],
  );
  return getGiftPersonById(db, id);
}

export function deleteGiftPerson(db: DatabaseAdapter, id: string): boolean {
  const existing = getGiftPersonById(db, id);
  if (!existing) return false;
  db.execute(`DELETE FROM sh_gift_people WHERE id = ?`, [id]);
  return true;
}

export function listGiftPeople(db: DatabaseAdapter): GiftPerson[] {
  // Sort by next_occasion_date ASC with NULLs last, then name.
  return db
    .query<Record<string, unknown>>(
      `SELECT * FROM sh_gift_people
         ORDER BY (next_occasion_date IS NULL) ASC,
                  next_occasion_date ASC,
                  LOWER(name) ASC
         LIMIT 1000`,
    )
    .map(rowToPerson);
}
