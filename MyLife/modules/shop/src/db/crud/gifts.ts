import type { DatabaseAdapter } from '@mylife/db';
import {
  GiftInputSchema,
  GiftSchema,
  GiftUpdateSchema,
  type Gift,
  type GiftInput,
  type GiftOccasion,
  type GiftUpdate,
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

function parseBool(raw: unknown): boolean {
  return raw === 1 || raw === '1' || raw === true;
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

function rowToGift(row: Record<string, unknown>): Gift {
  return GiftSchema.parse({
    id: row.id,
    personId: row.person_id,
    personName: row.person_name,
    itemDescription: row.item_description,
    occasion: row.occasion,
    occasionLabel: row.occasion_label ?? null,
    purchaseId: row.purchase_id ?? null,
    amountCents: parseInt0(row.amount_cents),
    giftDate: parseInt0(row.gift_date),
    reactionNotes: row.reaction_notes ?? null,
    photoId: row.photo_id ?? null,
    isGroupGift: parseBool(row.is_group_gift),
    groupTotalCents: parseIntOrNull(row.group_total_cents),
    myShareCents: parseIntOrNull(row.my_share_cents),
    createdAt: parseInt0(row.created_at),
    updatedAt: parseInt0(row.updated_at),
  });
}

export function createGift(db: DatabaseAdapter, rawInput: GiftInput): Gift {
  const input = GiftInputSchema.parse(rawInput);
  const id = randomId();
  const now = nowMs();
  db.execute(
    `INSERT INTO sh_gifts_given (
       id, person_id, person_name, item_description, occasion, occasion_label,
       purchase_id, amount_cents, gift_date, reaction_notes, photo_id,
       is_group_gift, group_total_cents, my_share_cents,
       created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.personId,
      input.personName,
      input.itemDescription,
      input.occasion,
      input.occasionLabel,
      input.purchaseId,
      input.amountCents,
      input.giftDate,
      input.reactionNotes,
      input.photoId,
      input.isGroupGift ? 1 : 0,
      input.groupTotalCents,
      input.myShareCents,
      now,
      now,
    ],
  );
  return getGiftById(db, id)!;
}

export function getGiftById(db: DatabaseAdapter, id: string): Gift | null {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM sh_gifts_given WHERE id = ?`,
    [id],
  );
  return rows[0] ? rowToGift(rows[0]) : null;
}

export function updateGift(
  db: DatabaseAdapter,
  id: string,
  rawPatch: GiftUpdate,
): Gift | null {
  const existing = getGiftById(db, id);
  if (!existing) return null;
  const patch = GiftUpdateSchema.parse(rawPatch);

  const next = {
    personId: patch.personId ?? existing.personId,
    personName: patch.personName ?? existing.personName,
    itemDescription: patch.itemDescription ?? existing.itemDescription,
    occasion: patch.occasion ?? existing.occasion,
    occasionLabel:
      patch.occasionLabel === undefined ? existing.occasionLabel : patch.occasionLabel,
    purchaseId:
      patch.purchaseId === undefined ? existing.purchaseId : patch.purchaseId,
    amountCents: patch.amountCents ?? existing.amountCents,
    giftDate: patch.giftDate ?? existing.giftDate,
    reactionNotes:
      patch.reactionNotes === undefined ? existing.reactionNotes : patch.reactionNotes,
    photoId: patch.photoId === undefined ? existing.photoId : patch.photoId,
    isGroupGift: patch.isGroupGift ?? existing.isGroupGift,
    groupTotalCents:
      patch.groupTotalCents === undefined
        ? existing.groupTotalCents
        : patch.groupTotalCents,
    myShareCents:
      patch.myShareCents === undefined ? existing.myShareCents : patch.myShareCents,
  };
  const now = nowMs();
  db.execute(
    `UPDATE sh_gifts_given
       SET person_id = ?, person_name = ?, item_description = ?,
           occasion = ?, occasion_label = ?, purchase_id = ?,
           amount_cents = ?, gift_date = ?, reaction_notes = ?,
           photo_id = ?, is_group_gift = ?, group_total_cents = ?,
           my_share_cents = ?, updated_at = ?
     WHERE id = ?`,
    [
      next.personId,
      next.personName,
      next.itemDescription,
      next.occasion,
      next.occasionLabel,
      next.purchaseId,
      next.amountCents,
      next.giftDate,
      next.reactionNotes,
      next.photoId,
      next.isGroupGift ? 1 : 0,
      next.groupTotalCents,
      next.myShareCents,
      now,
      id,
    ],
  );
  return getGiftById(db, id);
}

export function deleteGift(db: DatabaseAdapter, id: string): boolean {
  const existing = getGiftById(db, id);
  if (!existing) return false;
  db.execute(`DELETE FROM sh_gifts_given WHERE id = ?`, [id]);
  return true;
}

export interface ListGiftsOptions {
  personId?: string;
  occasion?: GiftOccasion;
  limit?: number;
}

export function listGifts(
  db: DatabaseAdapter,
  opts: ListGiftsOptions = {},
): Gift[] {
  const conditions: string[] = [];
  const params: unknown[] = [];
  if (opts.personId) {
    conditions.push('person_id = ?');
    params.push(opts.personId);
  }
  if (opts.occasion) {
    conditions.push('occasion = ?');
    params.push(opts.occasion);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = opts.limit && opts.limit > 0 ? Math.floor(opts.limit) : 1000;
  return db
    .query<Record<string, unknown>>(
      `SELECT * FROM sh_gifts_given ${where}
         ORDER BY gift_date DESC
         LIMIT ${limit}`,
      params,
    )
    .map(rowToGift);
}

export function listGiftsByPerson(db: DatabaseAdapter, personId: string): Gift[] {
  return listGifts(db, { personId });
}

export function listGiftsByOccasion(
  db: DatabaseAdapter,
  occasion: GiftOccasion,
): Gift[] {
  return listGifts(db, { occasion });
}

export function getGiftHistory(db: DatabaseAdapter, personId: string): Gift[] {
  return listGifts(db, { personId });
}

export function getTotalSpentOnPerson(
  db: DatabaseAdapter,
  personId: string,
): number {
  const gifts = listGifts(db, { personId });
  let total = 0;
  for (const g of gifts) {
    if (g.isGroupGift && typeof g.myShareCents === 'number') {
      total += g.myShareCents;
    } else {
      total += g.amountCents;
    }
  }
  return total;
}

export interface UpcomingOccasion {
  personId: string;
  personName: string;
  occasion: string | null;
  occasionDate: number;
  daysUntil: number;
}

export function getUpcomingOccasions(
  db: DatabaseAdapter,
  now: number,
  daysAhead: number,
): UpcomingOccasion[] {
  if (!Number.isFinite(daysAhead) || daysAhead < 0) return [];
  const cutoff = now + Math.floor(daysAhead) * 86_400_000;
  const rows = db.query<Record<string, unknown>>(
    `SELECT id, name, next_occasion, next_occasion_date
       FROM sh_gift_people
       WHERE next_occasion_date IS NOT NULL
         AND next_occasion_date >= ?
         AND next_occasion_date <= ?
       ORDER BY next_occasion_date ASC
       LIMIT 200`,
    [now, cutoff],
  );
  return rows.map((row) => {
    const occasionDate = parseInt0(row.next_occasion_date);
    return {
      personId: String(row.id),
      personName: String(row.name),
      occasion: (row.next_occasion as string | null) ?? null,
      occasionDate,
      daysUntil: Math.max(0, Math.ceil((occasionDate - now) / 86_400_000)),
    };
  });
}
