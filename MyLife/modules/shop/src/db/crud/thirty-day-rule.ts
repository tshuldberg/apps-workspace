import type { DatabaseAdapter } from '@mylife/db';
import {
  ThirtyDayRuleInputSchema,
  ThirtyDayRuleItemSchema,
  type ThirtyDayRuleDecision,
  type ThirtyDayRuleInput,
  type ThirtyDayRuleItem,
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

function rowToItem(row: Record<string, unknown>): ThirtyDayRuleItem {
  return ThirtyDayRuleItemSchema.parse({
    id: row.id,
    itemName: row.item_name,
    priceCents: parseInt0(row.price_cents),
    reasonMd: row.reason_md ?? null,
    addedAt: parseInt0(row.added_at),
    decision: row.decision,
    decidedAt: parseIntOrNull(row.decided_at),
    purchaseId: (row.purchase_id as string | null) ?? null,
    createdAt: parseInt0(row.created_at),
    updatedAt: parseInt0(row.updated_at),
  });
}

/**
 * Add an item to the 30-day wait list. Defaults addedAt to now and decision to
 * 'waiting'.
 */
export function addToWaitList(
  db: DatabaseAdapter,
  rawInput: ThirtyDayRuleInput,
): ThirtyDayRuleItem {
  const input = ThirtyDayRuleInputSchema.parse(rawInput);
  const id = randomId();
  const now = nowMs();
  db.execute(
    `INSERT INTO sh_thirty_day_rule (
       id, item_name, price_cents, reason_md, added_at, decision,
       decided_at, purchase_id, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, 'waiting', NULL, NULL, ?, ?)`,
    [id, input.itemName, input.priceCents, input.reasonMd, now, now, now],
  );
  return getWaitItemById(db, id)!;
}

export function getWaitItemById(
  db: DatabaseAdapter,
  id: string,
): ThirtyDayRuleItem | null {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM sh_thirty_day_rule WHERE id = ?`,
    [id],
  );
  return rows[0] ? rowToItem(rows[0]) : null;
}

/**
 * List all waiting items sorted by added_at DESC (most recent first).
 */
export function listWaitingItems(db: DatabaseAdapter): ThirtyDayRuleItem[] {
  return db
    .query<Record<string, unknown>>(
      `SELECT * FROM sh_thirty_day_rule
         WHERE decision = 'waiting'
         ORDER BY added_at DESC`,
    )
    .map(rowToItem);
}

export interface ListWaitItemsOptions {
  decision?: ThirtyDayRuleDecision;
}

/**
 * List all wait items, optionally filtered by decision. Sorted by added_at DESC.
 */
export function listAllWaitItems(
  db: DatabaseAdapter,
  opts: ListWaitItemsOptions = {},
): ThirtyDayRuleItem[] {
  const where = opts.decision ? 'WHERE decision = ?' : '';
  const params = opts.decision ? [opts.decision] : [];
  return db
    .query<Record<string, unknown>>(
      `SELECT * FROM sh_thirty_day_rule ${where}
         ORDER BY added_at DESC`,
      params,
    )
    .map(rowToItem);
}

/**
 * Mark a wait item as bought, optionally linking the resulting purchase.
 */
export function markBought(
  db: DatabaseAdapter,
  id: string,
  purchaseId?: string,
): ThirtyDayRuleItem | null {
  const existing = getWaitItemById(db, id);
  if (!existing) return null;
  const now = nowMs();
  db.execute(
    `UPDATE sh_thirty_day_rule
       SET decision = 'bought', decided_at = ?, purchase_id = ?, updated_at = ?
       WHERE id = ?`,
    [now, purchaseId ?? null, now, id],
  );
  return getWaitItemById(db, id);
}

/**
 * Mark a wait item as skipped (you decided not to buy).
 */
export function markSkipped(
  db: DatabaseAdapter,
  id: string,
): ThirtyDayRuleItem | null {
  const existing = getWaitItemById(db, id);
  if (!existing) return null;
  const now = nowMs();
  db.execute(
    `UPDATE sh_thirty_day_rule
       SET decision = 'skipped', decided_at = ?, updated_at = ?
       WHERE id = ?`,
    [now, now, id],
  );
  return getWaitItemById(db, id);
}

export function deleteWaitItem(db: DatabaseAdapter, id: string): boolean {
  const existing = getWaitItemById(db, id);
  if (!existing) return false;
  db.execute(`DELETE FROM sh_thirty_day_rule WHERE id = ?`, [id]);
  return true;
}
