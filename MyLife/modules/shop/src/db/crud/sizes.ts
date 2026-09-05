import type { DatabaseAdapter } from '@mylife/db';
import {
  SizeInputSchema,
  SizeSchema,
  SizeUpdateSchema,
  type Size,
  type SizeInput,
  type SizeType,
  type SizeUpdate,
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

function rowToSize(row: Record<string, unknown>): Size {
  return SizeSchema.parse({
    id: row.id,
    type: row.type,
    brand: row.brand,
    sizeValue: row.size_value,
    fitNotes: row.fit_notes ?? null,
    lastVerified: parseIntOrNull(row.last_verified),
    createdAt: parseInt0(row.created_at),
    updatedAt: parseInt0(row.updated_at),
  });
}

export function createSize(db: DatabaseAdapter, rawInput: SizeInput): Size {
  const input = SizeInputSchema.parse(rawInput);
  const id = randomId();
  const now = nowMs();

  db.execute(
    `INSERT INTO sh_sizes (
       id, type, brand, size_value, fit_notes,
       last_verified, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.type,
      input.brand,
      input.sizeValue,
      input.fitNotes,
      input.lastVerified,
      now,
      now,
    ],
  );

  return getSizeById(db, id)!;
}

export function getSizeById(db: DatabaseAdapter, id: string): Size | null {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM sh_sizes WHERE id = ?`,
    [id],
  );
  return rows[0] ? rowToSize(rows[0]) : null;
}

export function updateSize(
  db: DatabaseAdapter,
  id: string,
  rawPatch: SizeUpdate,
): Size | null {
  const existing = getSizeById(db, id);
  if (!existing) return null;
  const patch = SizeUpdateSchema.parse(rawPatch);

  const next = {
    type: patch.type ?? existing.type,
    brand: patch.brand ?? existing.brand,
    sizeValue: patch.sizeValue ?? existing.sizeValue,
    fitNotes:
      patch.fitNotes === undefined ? existing.fitNotes : patch.fitNotes,
    lastVerified:
      patch.lastVerified === undefined
        ? existing.lastVerified
        : patch.lastVerified,
  };

  const now = nowMs();
  db.execute(
    `UPDATE sh_sizes
       SET type = ?, brand = ?, size_value = ?, fit_notes = ?,
           last_verified = ?, updated_at = ?
     WHERE id = ?`,
    [
      next.type,
      next.brand,
      next.sizeValue,
      next.fitNotes,
      next.lastVerified,
      now,
      id,
    ],
  );

  return getSizeById(db, id);
}

export function deleteSize(db: DatabaseAdapter, id: string): boolean {
  const existing = getSizeById(db, id);
  if (!existing) return false;
  db.execute(`DELETE FROM sh_sizes WHERE id = ?`, [id]);
  return true;
}

export interface ListSizesOptions {
  type?: SizeType;
}

export function listSizes(
  db: DatabaseAdapter,
  opts: ListSizesOptions = {},
): Size[] {
  const conditions: string[] = [];
  const params: unknown[] = [];
  if (opts.type) {
    conditions.push('type = ?');
    params.push(opts.type);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  return db
    .query<Record<string, unknown>>(
      `SELECT * FROM sh_sizes ${where}
         ORDER BY brand ASC, size_value ASC
         LIMIT 1000`,
      params,
    )
    .map(rowToSize);
}

export function listSizesByType(db: DatabaseAdapter, type: SizeType): Size[] {
  return listSizes(db, { type });
}

export function listSizesByBrand(db: DatabaseAdapter, brand: string): Size[] {
  return db
    .query<Record<string, unknown>>(
      `SELECT * FROM sh_sizes WHERE brand = ?
         ORDER BY type ASC, size_value ASC
         LIMIT 1000`,
      [brand],
    )
    .map(rowToSize);
}

export function searchSizesByBrand(
  db: DatabaseAdapter,
  brandQuery: string,
): Size[] {
  const q = brandQuery.trim();
  if (!q) return [];
  return db
    .query<Record<string, unknown>>(
      `SELECT * FROM sh_sizes WHERE brand LIKE ? COLLATE NOCASE
         ORDER BY brand ASC, type ASC
         LIMIT 1000`,
      [`%${q}%`],
    )
    .map(rowToSize);
}
