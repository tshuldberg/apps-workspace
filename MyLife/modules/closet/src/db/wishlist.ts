import type { DatabaseAdapter } from '@mylife/db';
import {
  CreateWishlistItemInputSchema,
  UpdateWishlistItemInputSchema,
  WishlistItemSchema,
  WishlistSummarySchema,
  type CreateWishlistItemInput,
  type UpdateWishlistItemInput,
  type WishlistItem,
  type WishlistSummary,
} from '../types';

function nowIso(): string {
  return new Date().toISOString();
}

function parseBoolean(raw: unknown): boolean {
  return raw === 1 || raw === '1' || raw === true;
}

function rowToWishlistItem(row: Record<string, unknown>): WishlistItem {
  return WishlistItemSchema.parse({
    id: row.id,
    name: row.name,
    category: row.category,
    brand: row.brand ?? null,
    color: row.color ?? null,
    estimatedPriceCents: row.estimated_price_cents ?? null,
    url: row.url ?? null,
    imageUri: row.image_uri ?? null,
    notes: row.notes ?? null,
    priority: row.priority ?? 'medium',
    isPurchased: parseBoolean(row.is_purchased),
    purchasedDate: row.purchased_date ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

export function createWishlistItem(
  db: DatabaseAdapter,
  id: string,
  rawInput: CreateWishlistItemInput,
): WishlistItem {
  const input = CreateWishlistItemInputSchema.parse(rawInput);
  const now = nowIso();

  db.execute(
    `INSERT INTO cl_wishlist_items (
      id, name, category, brand, color, estimated_price_cents, url, image_uri,
      notes, priority, is_purchased, purchased_date, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, ?, ?)`,
    [
      id, input.name, input.category, input.brand, input.color,
      input.estimatedPriceCents, input.url, input.imageUri,
      input.notes, input.priority, now, now,
    ],
  );

  return getWishlistItemById(db, id)!;
}

export function getWishlistItemById(db: DatabaseAdapter, id: string): WishlistItem | null {
  const row = db.query<Record<string, unknown>>(
    `SELECT * FROM cl_wishlist_items WHERE id = ?`, [id],
  )[0];
  return row ? rowToWishlistItem(row) : null;
}

export function listWishlistItems(
  db: DatabaseAdapter,
  options?: { isPurchased?: boolean; priority?: string },
): WishlistItem[] {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (options?.isPurchased !== undefined) {
    conditions.push('is_purchased = ?');
    params.push(options.isPurchased ? 1 : 0);
  }
  if (options?.priority) {
    conditions.push('priority = ?');
    params.push(options.priority);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const priorityOrder = `CASE priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 ELSE 4 END`;

  return db
    .query<Record<string, unknown>>(
      `SELECT * FROM cl_wishlist_items ${where} ORDER BY is_purchased ASC, ${priorityOrder}, created_at DESC LIMIT 500`,
      params,
    )
    .map(rowToWishlistItem);
}

export function updateWishlistItem(
  db: DatabaseAdapter,
  id: string,
  rawInput: UpdateWishlistItemInput,
): WishlistItem | null {
  const existing = getWishlistItemById(db, id);
  if (!existing) return null;

  const input = UpdateWishlistItemInputSchema.parse(rawInput);
  const now = nowIso();

  const next = {
    name: input.name ?? existing.name,
    category: input.category ?? existing.category,
    brand: input.brand === undefined ? existing.brand : input.brand,
    color: input.color === undefined ? existing.color : input.color,
    estimatedPriceCents: input.estimatedPriceCents === undefined ? existing.estimatedPriceCents : input.estimatedPriceCents,
    url: input.url === undefined ? existing.url : input.url,
    imageUri: input.imageUri === undefined ? existing.imageUri : input.imageUri,
    notes: input.notes === undefined ? existing.notes : input.notes,
    priority: input.priority ?? existing.priority,
  };

  db.execute(
    `UPDATE cl_wishlist_items
     SET name = ?, category = ?, brand = ?, color = ?, estimated_price_cents = ?,
         url = ?, image_uri = ?, notes = ?, priority = ?, updated_at = ?
     WHERE id = ?`,
    [
      next.name, next.category, next.brand, next.color, next.estimatedPriceCents,
      next.url, next.imageUri, next.notes, next.priority, now, id,
    ],
  );

  return getWishlistItemById(db, id);
}

export function deleteWishlistItem(db: DatabaseAdapter, id: string): boolean {
  db.execute(`DELETE FROM cl_wishlist_items WHERE id = ?`, [id]);
  return true;
}

export function markWishlistItemPurchased(
  db: DatabaseAdapter,
  id: string,
  purchasedDate?: string,
): WishlistItem | null {
  const existing = getWishlistItemById(db, id);
  if (!existing) return null;

  const now = nowIso();
  const date = purchasedDate ?? now.slice(0, 10);

  db.execute(
    `UPDATE cl_wishlist_items SET is_purchased = 1, purchased_date = ?, updated_at = ? WHERE id = ?`,
    [date, now, id],
  );

  return getWishlistItemById(db, id);
}

export function getWishlistSummary(db: DatabaseAdapter): WishlistSummary {
  const items = listWishlistItems(db, { isPurchased: false });
  let totalEstimatedCents = 0;
  const countByPriority = { high: 0, medium: 0, low: 0 };

  for (const item of items) {
    totalEstimatedCents += item.estimatedPriceCents ?? 0;
    countByPriority[item.priority] += 1;
  }

  return WishlistSummarySchema.parse({
    totalItems: items.length,
    totalEstimatedCents,
    countByPriority,
  });
}
