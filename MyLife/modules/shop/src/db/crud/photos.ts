import type { DatabaseAdapter } from '@mylife/db';
import {
  PhotoInputSchema,
  PhotoSchema,
  type Photo,
  type PhotoInput,
} from '../../models/schemas';

function nowIso(): string {
  return new Date().toISOString();
}

function randomId(): string {
  return (
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 10) +
    Math.random().toString(36).slice(2, 10)
  );
}

function rowToPhoto(row: Record<string, unknown>): Photo {
  return PhotoSchema.parse({
    id: row.id,
    purchaseId: row.purchase_id ?? null,
    wishlistItemId: row.wishlist_item_id ?? null,
    warrantyId: row.warranty_id ?? null,
    kind: row.kind,
    localUri: row.local_uri,
    caption: row.caption ?? null,
    createdAt: row.created_at,
  });
}

export function createPhoto(
  db: DatabaseAdapter,
  rawInput: PhotoInput,
): Photo {
  const input = PhotoInputSchema.parse(rawInput);
  const id = randomId();
  const now = nowIso();

  db.execute(
    `INSERT INTO sh_photos (
       id, purchase_id, wishlist_item_id, warranty_id, kind, local_uri, caption, created_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.purchaseId,
      input.wishlistItemId,
      input.warrantyId,
      input.kind,
      input.localUri,
      input.caption,
      now,
    ],
  );

  return getPhotoById(db, id)!;
}

export function getPhotoById(
  db: DatabaseAdapter,
  id: string,
): Photo | null {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM sh_photos WHERE id = ?`,
    [id],
  );
  return rows[0] ? rowToPhoto(rows[0]) : null;
}

export function deletePhoto(db: DatabaseAdapter, id: string): boolean {
  const existing = getPhotoById(db, id);
  if (!existing) return false;
  db.execute(`DELETE FROM sh_photos WHERE id = ?`, [id]);
  return true;
}

export function listPhotosByItem(
  db: DatabaseAdapter,
  opts: {
    wishlistItemId?: string;
    purchaseId?: string;
    warrantyId?: string;
  },
): Photo[] {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (opts.wishlistItemId) {
    conditions.push('wishlist_item_id = ?');
    params.push(opts.wishlistItemId);
  }
  if (opts.purchaseId) {
    conditions.push('purchase_id = ?');
    params.push(opts.purchaseId);
  }
  if (opts.warrantyId) {
    conditions.push('warranty_id = ?');
    params.push(opts.warrantyId);
  }
  if (conditions.length === 0) return [];

  const where = `WHERE ${conditions.join(' OR ')}`;
  return db
    .query<Record<string, unknown>>(
      `SELECT * FROM sh_photos ${where} ORDER BY created_at DESC LIMIT 500`,
      params,
    )
    .map(rowToPhoto);
}
