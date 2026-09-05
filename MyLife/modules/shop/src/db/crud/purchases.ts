import type { DatabaseAdapter } from '@mylife/db';
import {
  PurchaseFilterSchema,
  PurchaseInputSchema,
  PurchasePatchSchema,
  PurchaseSchema,
  SatisfactionPeriodSchema,
  SatisfactionRatingSchema,
  type Purchase,
  type PurchaseFilter,
  type PurchaseInput,
  type PurchasePatch,
  type SatisfactionPeriod,
} from '../../models/schemas';
import { calculateReturnDeadline } from '../../engine/return-deadline';

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

function nullableInt(raw: unknown): number | null {
  if (raw == null) return null;
  if (typeof raw === 'number') return raw;
  if (typeof raw === 'string' && raw.length > 0) return Number(raw);
  return null;
}

function rowToPurchase(row: Record<string, unknown>): Purchase {
  return PurchaseSchema.parse({
    id: row.id,
    name: row.name,
    category: row.category,
    priceCents: row.price_cents,
    purchaseDate: row.purchase_date,
    store: row.store ?? null,
    paymentMethod: row.payment_method ?? null,
    brand: row.brand ?? null,
    url: row.url ?? null,
    receiptPhotoId: row.receipt_photo_id ?? null,
    satisfactionInitial: nullableInt(row.satisfaction_initial),
    satisfaction30day: nullableInt(row.satisfaction_30day),
    satisfaction90day: nullableInt(row.satisfaction_90day),
    isImpulse: parseBool(row.is_impulse),
    researchNotesMd: row.research_notes_md ?? null,
    returnDeadline: row.return_deadline ?? null,
    returned: parseBool(row.returned),
    returnReason: row.return_reason ?? null,
    wishlistItemId: row.wishlist_item_id ?? null,
    notesMd: row.notes_md ?? null,
    photoId: row.photo_id ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

export function createPurchase(
  db: DatabaseAdapter,
  rawInput: PurchaseInput,
): Purchase {
  const input = PurchaseInputSchema.parse(rawInput);
  const id = randomId();
  const now = nowIso();

  const resolvedDeadline =
    input.returnDeadline ??
    (input.policyDays != null
      ? calculateReturnDeadline(input.purchaseDate, input.policyDays)
      : null);

  db.execute(
    `INSERT INTO sh_purchases (
       id, name, category, price_cents, purchase_date,
       store, payment_method, brand, url, receipt_photo_id,
       satisfaction_initial, satisfaction_30day, satisfaction_90day,
       is_impulse, research_notes_md, return_deadline, returned,
       return_reason, wishlist_item_id, notes_md, photo_id,
       created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?, ?, 0, NULL, ?, ?, ?, ?, ?)`,
    [
      id,
      input.name,
      input.category,
      input.priceCents,
      input.purchaseDate,
      input.store,
      input.paymentMethod,
      input.brand,
      input.url,
      input.receiptPhotoId,
      input.satisfactionInitial,
      input.isImpulse ? 1 : 0,
      input.researchNotesMd,
      resolvedDeadline,
      input.wishlistItemId,
      input.notesMd,
      input.photoId,
      now,
      now,
    ],
  );

  return getPurchaseById(db, id)!;
}

export function getPurchaseById(
  db: DatabaseAdapter,
  id: string,
): Purchase | null {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM sh_purchases WHERE id = ?`,
    [id],
  );
  return rows[0] ? rowToPurchase(rows[0]) : null;
}

export function updatePurchase(
  db: DatabaseAdapter,
  id: string,
  rawPatch: PurchasePatch,
): Purchase | null {
  const existing = getPurchaseById(db, id);
  if (!existing) return null;
  const patch = PurchasePatchSchema.parse(rawPatch);

  const next = {
    name: patch.name ?? existing.name,
    category: patch.category ?? existing.category,
    priceCents: patch.priceCents ?? existing.priceCents,
    purchaseDate: patch.purchaseDate ?? existing.purchaseDate,
    store: patch.store === undefined ? existing.store : patch.store,
    paymentMethod:
      patch.paymentMethod === undefined
        ? existing.paymentMethod
        : patch.paymentMethod,
    brand: patch.brand === undefined ? existing.brand : patch.brand,
    url: patch.url === undefined ? existing.url : patch.url,
    receiptPhotoId:
      patch.receiptPhotoId === undefined
        ? existing.receiptPhotoId
        : patch.receiptPhotoId,
    isImpulse: patch.isImpulse ?? existing.isImpulse,
    researchNotesMd:
      patch.researchNotesMd === undefined
        ? existing.researchNotesMd
        : patch.researchNotesMd,
    returnDeadline:
      patch.returnDeadline === undefined
        ? existing.returnDeadline
        : patch.returnDeadline,
    wishlistItemId:
      patch.wishlistItemId === undefined
        ? existing.wishlistItemId
        : patch.wishlistItemId,
    notesMd: patch.notesMd === undefined ? existing.notesMd : patch.notesMd,
    photoId: patch.photoId === undefined ? existing.photoId : patch.photoId,
  };
  const now = nowIso();

  db.execute(
    `UPDATE sh_purchases
       SET name = ?, category = ?, price_cents = ?, purchase_date = ?,
           store = ?, payment_method = ?, brand = ?, url = ?,
           receipt_photo_id = ?, is_impulse = ?, research_notes_md = ?,
           return_deadline = ?, wishlist_item_id = ?, notes_md = ?,
           photo_id = ?, updated_at = ?
     WHERE id = ?`,
    [
      next.name,
      next.category,
      next.priceCents,
      next.purchaseDate,
      next.store,
      next.paymentMethod,
      next.brand,
      next.url,
      next.receiptPhotoId,
      next.isImpulse ? 1 : 0,
      next.researchNotesMd,
      next.returnDeadline,
      next.wishlistItemId,
      next.notesMd,
      next.photoId,
      now,
      id,
    ],
  );

  return getPurchaseById(db, id);
}

export function deletePurchase(db: DatabaseAdapter, id: string): boolean {
  const existing = getPurchaseById(db, id);
  if (!existing) return false;
  db.execute(`DELETE FROM sh_purchases WHERE id = ?`, [id]);
  return true;
}

export function listPurchases(
  db: DatabaseAdapter,
  filter?: PurchaseFilter,
): Purchase[] {
  const parsed = filter ? PurchaseFilterSchema.parse(filter) : undefined;
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (parsed?.category) {
    conditions.push('category = ?');
    params.push(parsed.category);
  }
  if (parsed?.store) {
    conditions.push('store = ?');
    params.push(parsed.store);
  }
  if (parsed?.dateFrom) {
    conditions.push('purchase_date >= ?');
    params.push(parsed.dateFrom);
  }
  if (parsed?.dateTo) {
    conditions.push('purchase_date <= ?');
    params.push(parsed.dateTo);
  }
  if (parsed?.impulseOnly) {
    conditions.push('is_impulse = 1');
  }
  if (parsed?.priceMin != null) {
    conditions.push('price_cents >= ?');
    params.push(parsed.priceMin);
  }
  if (parsed?.priceMax != null) {
    conditions.push('price_cents <= ?');
    params.push(parsed.priceMax);
  }
  if (parsed?.returned !== undefined) {
    conditions.push('returned = ?');
    params.push(parsed.returned ? 1 : 0);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  return db
    .query<Record<string, unknown>>(
      `SELECT * FROM sh_purchases ${where}
       ORDER BY purchase_date DESC, created_at DESC
       LIMIT 1000`,
      params,
    )
    .map(rowToPurchase);
}

export function markReturned(
  db: DatabaseAdapter,
  id: string,
  opts: { returnReason?: string | null; returnedAt?: string },
): Purchase | null {
  const existing = getPurchaseById(db, id);
  if (!existing) return null;
  const now = opts.returnedAt ?? nowIso();
  db.execute(
    `UPDATE sh_purchases
       SET returned = 1, return_reason = ?, updated_at = ?
     WHERE id = ?`,
    [opts.returnReason ?? null, now, id],
  );
  return getPurchaseById(db, id);
}

export function updateSatisfaction(
  db: DatabaseAdapter,
  id: string,
  period: SatisfactionPeriod,
  rating: number,
): Purchase | null {
  const parsedPeriod = SatisfactionPeriodSchema.parse(period);
  const parsedRating = SatisfactionRatingSchema.parse(rating);
  const existing = getPurchaseById(db, id);
  if (!existing) return null;

  const column =
    parsedPeriod === 'initial'
      ? 'satisfaction_initial'
      : parsedPeriod === '30day'
        ? 'satisfaction_30day'
        : 'satisfaction_90day';

  const now = nowIso();
  db.execute(
    `UPDATE sh_purchases SET ${column} = ?, updated_at = ? WHERE id = ?`,
    [parsedRating, now, id],
  );
  return getPurchaseById(db, id);
}

/**
 * Purchases with an unset satisfaction rating for `period` where the window has
 * elapsed relative to `referenceDate` (defaults to now). Excludes returned
 * purchases.
 */
export function getPendingSatisfactionReviews(
  db: DatabaseAdapter,
  period: Exclude<SatisfactionPeriod, 'initial'>,
  referenceDate: string | Date = new Date(),
): Purchase[] {
  const days = period === '30day' ? 30 : 90;
  const column = period === '30day' ? 'satisfaction_30day' : 'satisfaction_90day';
  const ref = typeof referenceDate === 'string'
    ? new Date(referenceDate)
    : referenceDate;
  const refDay = Date.UTC(
    ref.getUTCFullYear(),
    ref.getUTCMonth(),
    ref.getUTCDate(),
  );
  const cutoffMs = refDay - days * 86_400_000;
  const cutoffISO = new Date(cutoffMs).toISOString().slice(0, 10);

  return db
    .query<Record<string, unknown>>(
      `SELECT * FROM sh_purchases
         WHERE ${column} IS NULL
           AND returned = 0
           AND purchase_date <= ?
         ORDER BY purchase_date ASC
         LIMIT 500`,
      [cutoffISO],
    )
    .map(rowToPurchase);
}
