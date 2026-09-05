import type { DatabaseAdapter } from '@mylife/db';
import {
  GiftBudgetInputSchema,
  GiftBudgetSchema,
  type GiftBudget,
  type GiftBudgetInput,
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

function rowToBudget(row: Record<string, unknown>): GiftBudget {
  return GiftBudgetSchema.parse({
    id: row.id,
    personId: row.person_id,
    occasion: row.occasion ?? null,
    amountCents: parseInt0(row.amount_cents),
    createdAt: parseInt0(row.created_at),
    updatedAt: parseInt0(row.updated_at),
  });
}

/**
 * Upsert a gift budget for (personId, occasion). occasion=null is treated
 * as the default per-person budget. The UNIQUE(person_id, occasion)
 * constraint pins one row per pair.
 */
export function setGiftBudget(
  db: DatabaseAdapter,
  input: GiftBudgetInput,
): GiftBudget {
  const parsed = GiftBudgetInputSchema.parse(input);
  const existing = getGiftBudget(db, parsed.personId, parsed.occasion);
  const now = nowMs();
  if (existing) {
    db.execute(
      `UPDATE sh_gift_budgets SET amount_cents = ?, updated_at = ? WHERE id = ?`,
      [parsed.amountCents, now, existing.id],
    );
    return getGiftBudgetById(db, existing.id)!;
  }
  const id = randomId();
  db.execute(
    `INSERT INTO sh_gift_budgets (id, person_id, occasion, amount_cents, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    [id, parsed.personId, parsed.occasion, parsed.amountCents, now, now],
  );
  return getGiftBudgetById(db, id)!;
}

export function getGiftBudgetById(
  db: DatabaseAdapter,
  id: string,
): GiftBudget | null {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM sh_gift_budgets WHERE id = ?`,
    [id],
  );
  return rows[0] ? rowToBudget(rows[0]) : null;
}

export function getGiftBudget(
  db: DatabaseAdapter,
  personId: string,
  occasion: string | null = null,
): GiftBudget | null {
  const rows = occasion
    ? db.query<Record<string, unknown>>(
        `SELECT * FROM sh_gift_budgets WHERE person_id = ? AND occasion = ?`,
        [personId, occasion],
      )
    : db.query<Record<string, unknown>>(
        `SELECT * FROM sh_gift_budgets WHERE person_id = ? AND occasion IS NULL`,
        [personId],
      );
  return rows[0] ? rowToBudget(rows[0]) : null;
}

export function listGiftBudgetsForPerson(
  db: DatabaseAdapter,
  personId: string,
): GiftBudget[] {
  return db
    .query<Record<string, unknown>>(
      `SELECT * FROM sh_gift_budgets WHERE person_id = ?
         ORDER BY (occasion IS NULL) DESC, occasion ASC`,
      [personId],
    )
    .map(rowToBudget);
}

export function deleteGiftBudget(db: DatabaseAdapter, id: string): boolean {
  const existing = getGiftBudgetById(db, id);
  if (!existing) return false;
  db.execute(`DELETE FROM sh_gift_budgets WHERE id = ?`, [id]);
  return true;
}
