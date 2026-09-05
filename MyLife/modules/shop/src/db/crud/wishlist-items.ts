import type { DatabaseAdapter } from '@mylife/db';
import {
  WishlistItemInputSchema,
  WishlistItemPatchSchema,
  WishlistItemSchema,
  WishlistItemFilterSchema,
  type Category,
  type Priority,
  type WishlistItem,
  type WishlistItemFilter,
  type WishlistItemInput,
  type WishlistItemPatch,
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

function rowToItem(row: Record<string, unknown>): WishlistItem {
  return WishlistItemSchema.parse({
    id: row.id,
    listId: row.list_id,
    name: row.name,
    category: row.category,
    descriptionMd: row.description_md ?? null,
    priceCents: row.price_cents ?? null,
    priceRangeLow: row.price_range_low ?? null,
    priceRangeHigh: row.price_range_high ?? null,
    priority: row.priority,
    url: row.url ?? null,
    photoId: row.photo_id ?? null,
    store: row.store ?? null,
    brand: row.brand ?? null,
    occasionTag: row.occasion_tag ?? null,
    notesMd: row.notes_md ?? null,
    sizeNotes: row.size_notes ?? null,
    isPurchased: parseBool(row.is_purchased),
    purchasedAt: row.purchased_at ?? null,
    purchaseId: row.purchase_id ?? null,
    isGiftFor: row.is_gift_for ?? null,
    giftForPersonId: row.gift_for_person_id ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

// Priority order: need first, then want, someday, dream
const PRIORITY_ORDER_SQL = `CASE priority
  WHEN 'need' THEN 1
  WHEN 'want' THEN 2
  WHEN 'someday' THEN 3
  WHEN 'dream' THEN 4
  ELSE 5
END`;

export function createWishlistItem(
  db: DatabaseAdapter,
  rawInput: WishlistItemInput,
): WishlistItem {
  const input = WishlistItemInputSchema.parse(rawInput);
  const id = randomId();
  const now = nowIso();

  db.execute(
    `INSERT INTO sh_wishlist_items (
       id, list_id, name, category, description_md, price_cents,
       price_range_low, price_range_high, priority, url, photo_id,
       store, brand, occasion_tag, notes_md, size_notes,
       is_purchased, purchased_at, purchase_id, is_gift_for,
       gift_for_person_id, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, NULL, ?, ?, ?, ?)`,
    [
      id,
      input.listId,
      input.name,
      input.category,
      input.descriptionMd,
      input.priceCents,
      input.priceRangeLow,
      input.priceRangeHigh,
      input.priority,
      input.url,
      input.photoId,
      input.store,
      input.brand,
      input.occasionTag,
      input.notesMd,
      input.sizeNotes,
      input.isGiftFor,
      input.giftForPersonId,
      now,
      now,
    ],
  );

  return getWishlistItemById(db, id)!;
}

export function getWishlistItemById(
  db: DatabaseAdapter,
  id: string,
): WishlistItem | null {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM sh_wishlist_items WHERE id = ?`,
    [id],
  );
  return rows[0] ? rowToItem(rows[0]) : null;
}

export function updateWishlistItem(
  db: DatabaseAdapter,
  id: string,
  rawPatch: WishlistItemPatch,
): WishlistItem | null {
  const existing = getWishlistItemById(db, id);
  if (!existing) return null;

  const patch = WishlistItemPatchSchema.parse(rawPatch);
  const next = {
    name: patch.name ?? existing.name,
    category: patch.category ?? existing.category,
    descriptionMd:
      patch.descriptionMd === undefined
        ? existing.descriptionMd
        : patch.descriptionMd,
    priceCents:
      patch.priceCents === undefined ? existing.priceCents : patch.priceCents,
    priceRangeLow:
      patch.priceRangeLow === undefined
        ? existing.priceRangeLow
        : patch.priceRangeLow,
    priceRangeHigh:
      patch.priceRangeHigh === undefined
        ? existing.priceRangeHigh
        : patch.priceRangeHigh,
    priority: patch.priority ?? existing.priority,
    url: patch.url === undefined ? existing.url : patch.url,
    photoId: patch.photoId === undefined ? existing.photoId : patch.photoId,
    store: patch.store === undefined ? existing.store : patch.store,
    brand: patch.brand === undefined ? existing.brand : patch.brand,
    occasionTag:
      patch.occasionTag === undefined ? existing.occasionTag : patch.occasionTag,
    notesMd: patch.notesMd === undefined ? existing.notesMd : patch.notesMd,
    sizeNotes:
      patch.sizeNotes === undefined ? existing.sizeNotes : patch.sizeNotes,
    isGiftFor:
      patch.isGiftFor === undefined ? existing.isGiftFor : patch.isGiftFor,
    giftForPersonId:
      patch.giftForPersonId === undefined
        ? existing.giftForPersonId
        : patch.giftForPersonId,
  };
  const now = nowIso();

  db.execute(
    `UPDATE sh_wishlist_items
       SET name = ?, category = ?, description_md = ?, price_cents = ?,
           price_range_low = ?, price_range_high = ?, priority = ?, url = ?,
           photo_id = ?, store = ?, brand = ?, occasion_tag = ?,
           notes_md = ?, size_notes = ?, is_gift_for = ?,
           gift_for_person_id = ?, updated_at = ?
     WHERE id = ?`,
    [
      next.name,
      next.category,
      next.descriptionMd,
      next.priceCents,
      next.priceRangeLow,
      next.priceRangeHigh,
      next.priority,
      next.url,
      next.photoId,
      next.store,
      next.brand,
      next.occasionTag,
      next.notesMd,
      next.sizeNotes,
      next.isGiftFor,
      next.giftForPersonId,
      now,
      id,
    ],
  );

  return getWishlistItemById(db, id);
}

export function deleteWishlistItem(db: DatabaseAdapter, id: string): boolean {
  const existing = getWishlistItemById(db, id);
  if (!existing) return false;
  db.execute(`DELETE FROM sh_wishlist_items WHERE id = ?`, [id]);
  return true;
}

export function listItemsByWishlist(
  db: DatabaseAdapter,
  listId: string,
  filter?: WishlistItemFilter,
): WishlistItem[] {
  const parsed = filter ? WishlistItemFilterSchema.parse(filter) : undefined;
  const conditions: string[] = ['list_id = ?'];
  const params: unknown[] = [listId];

  if (parsed?.category) {
    conditions.push('category = ?');
    params.push(parsed.category);
  }
  if (parsed?.priority) {
    conditions.push('priority = ?');
    params.push(parsed.priority);
  }
  if (parsed?.isPurchased !== undefined) {
    conditions.push('is_purchased = ?');
    params.push(parsed.isPurchased ? 1 : 0);
  }

  const where = `WHERE ${conditions.join(' AND ')}`;
  return db
    .query<Record<string, unknown>>(
      `SELECT * FROM sh_wishlist_items ${where}
       ORDER BY is_purchased ASC, ${PRIORITY_ORDER_SQL}, LOWER(name) ASC
       LIMIT 1000`,
      params,
    )
    .map(rowToItem);
}

export function listItemsByCategory(
  db: DatabaseAdapter,
  category: Category,
): WishlistItem[] {
  return db
    .query<Record<string, unknown>>(
      `SELECT * FROM sh_wishlist_items WHERE category = ?
       ORDER BY ${PRIORITY_ORDER_SQL}, LOWER(name) ASC
       LIMIT 1000`,
      [category],
    )
    .map(rowToItem);
}

export function listItemsByPriority(
  db: DatabaseAdapter,
  priority: Priority,
): WishlistItem[] {
  return db
    .query<Record<string, unknown>>(
      `SELECT * FROM sh_wishlist_items WHERE priority = ?
       ORDER BY is_purchased ASC, LOWER(name) ASC
       LIMIT 1000`,
      [priority],
    )
    .map(rowToItem);
}

export function markAsPurchased(
  db: DatabaseAdapter,
  id: string,
  opts: { purchaseId?: string | null; purchasedAt: string },
): WishlistItem | null {
  const existing = getWishlistItemById(db, id);
  if (!existing) return null;
  const now = nowIso();
  db.execute(
    `UPDATE sh_wishlist_items
       SET is_purchased = 1, purchased_at = ?, purchase_id = ?, updated_at = ?
     WHERE id = ?`,
    [opts.purchasedAt, opts.purchaseId ?? null, now, id],
  );
  return getWishlistItemById(db, id);
}

export function moveItemToList(
  db: DatabaseAdapter,
  itemId: string,
  newListId: string,
): WishlistItem | null {
  const existing = getWishlistItemById(db, itemId);
  if (!existing) return null;
  const now = nowIso();
  db.execute(
    `UPDATE sh_wishlist_items SET list_id = ?, updated_at = ? WHERE id = ?`,
    [newListId, now, itemId],
  );
  return getWishlistItemById(db, itemId);
}

export function listItemsByGiftForPerson(
  db: DatabaseAdapter,
  personId: string,
): WishlistItem[] {
  return db
    .query<Record<string, unknown>>(
      `SELECT * FROM sh_wishlist_items
       WHERE gift_for_person_id = ?
       ORDER BY is_purchased ASC, ${PRIORITY_ORDER_SQL}, LOWER(name) ASC
       LIMIT 1000`,
      [personId],
    )
    .map(rowToItem);
}

export function searchItems(
  db: DatabaseAdapter,
  query: string,
): WishlistItem[] {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const like = `%${trimmed.toLowerCase()}%`;
  return db
    .query<Record<string, unknown>>(
      `SELECT * FROM sh_wishlist_items
       WHERE LOWER(name) LIKE ? OR LOWER(COALESCE(notes_md, '')) LIKE ?
       ORDER BY is_purchased ASC, ${PRIORITY_ORDER_SQL}, LOWER(name) ASC
       LIMIT 200`,
      [like, like],
    )
    .map(rowToItem);
}
