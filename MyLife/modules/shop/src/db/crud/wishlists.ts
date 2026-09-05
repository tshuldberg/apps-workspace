import type { DatabaseAdapter } from '@mylife/db';
import {
  WishlistInputSchema,
  WishlistPatchSchema,
  WishlistSchema,
  WishlistFilterSchema,
  type Wishlist,
  type WishlistInput,
  type WishlistPatch,
  type WishlistFilter,
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

function parseBool(raw: unknown): boolean {
  return raw === 1 || raw === '1' || raw === true;
}

function rowToWishlist(row: Record<string, unknown>): Wishlist {
  return WishlistSchema.parse({
    id: row.id,
    name: row.name,
    description: row.description ?? null,
    occasion: row.occasion ?? null,
    personId: row.person_id ?? null,
    isShareable: parseBool(row.is_shareable),
    shareToken: row.share_token ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

export function createWishlist(
  db: DatabaseAdapter,
  rawInput: WishlistInput,
): Wishlist {
  const input = WishlistInputSchema.parse(rawInput);
  const id = randomId();
  const now = nowIso();

  db.execute(
    `INSERT INTO sh_wishlists (
      id, name, description, occasion, person_id, is_shareable, share_token, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?)`,
    [
      id,
      input.name,
      input.description,
      input.occasion,
      input.personId,
      input.isShareable ? 1 : 0,
      now,
      now,
    ],
  );

  return getWishlistById(db, id)!;
}

export function getWishlistById(
  db: DatabaseAdapter,
  id: string,
): Wishlist | null {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM sh_wishlists WHERE id = ?`,
    [id],
  );
  return rows[0] ? rowToWishlist(rows[0]) : null;
}

export function listWishlists(
  db: DatabaseAdapter,
  filter?: WishlistFilter,
): Wishlist[] {
  const parsed = filter ? WishlistFilterSchema.parse(filter) : undefined;
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (parsed?.occasion) {
    conditions.push('occasion = ?');
    params.push(parsed.occasion);
  }
  if (parsed?.personId) {
    conditions.push('person_id = ?');
    params.push(parsed.personId);
  }
  if (parsed?.isShareable !== undefined) {
    conditions.push('is_shareable = ?');
    params.push(parsed.isShareable ? 1 : 0);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  return db
    .query<Record<string, unknown>>(
      `SELECT * FROM sh_wishlists ${where} ORDER BY created_at DESC LIMIT 500`,
      params,
    )
    .map(rowToWishlist);
}

export function updateWishlist(
  db: DatabaseAdapter,
  id: string,
  rawPatch: WishlistPatch,
): Wishlist | null {
  const existing = getWishlistById(db, id);
  if (!existing) return null;

  const patch = WishlistPatchSchema.parse(rawPatch);
  const next = {
    name: patch.name ?? existing.name,
    description:
      patch.description === undefined ? existing.description : patch.description,
    occasion: patch.occasion === undefined ? existing.occasion : patch.occasion,
    personId: patch.personId === undefined ? existing.personId : patch.personId,
    isShareable:
      patch.isShareable === undefined ? existing.isShareable : patch.isShareable,
  };
  const now = nowIso();

  db.execute(
    `UPDATE sh_wishlists
       SET name = ?, description = ?, occasion = ?, person_id = ?, is_shareable = ?, updated_at = ?
     WHERE id = ?`,
    [
      next.name,
      next.description,
      next.occasion,
      next.personId,
      next.isShareable ? 1 : 0,
      now,
      id,
    ],
  );

  return getWishlistById(db, id);
}

export function deleteWishlist(db: DatabaseAdapter, id: string): boolean {
  const existing = getWishlistById(db, id);
  if (!existing) return false;
  db.execute(`DELETE FROM sh_wishlists WHERE id = ?`, [id]);
  return true;
}

function opaqueToken(): string {
  return (
    'sh_' +
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 12) +
    Math.random().toString(36).slice(2, 12)
  );
}

export function generateShareToken(
  db: DatabaseAdapter,
  id: string,
): Wishlist | null {
  const existing = getWishlistById(db, id);
  if (!existing) return null;

  const token = opaqueToken();
  const now = nowIso();
  db.execute(
    `UPDATE sh_wishlists
       SET share_token = ?, is_shareable = 1, updated_at = ?
     WHERE id = ?`,
    [token, now, id],
  );
  return getWishlistById(db, id);
}

export function getWishlistByShareToken(
  db: DatabaseAdapter,
  token: string,
): Wishlist | null {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM sh_wishlists WHERE share_token = ?`,
    [token],
  );
  return rows[0] ? rowToWishlist(rows[0]) : null;
}
