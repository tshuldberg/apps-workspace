import type { DatabaseAdapter } from '@mylife/db';
import {
  ComparisonInputSchema,
  ComparisonSchema,
  ComparisonUpdateSchema,
  type Comparison,
  type ComparisonInput,
  type ComparisonItem,
  type ComparisonUpdate,
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

function parseItems(raw: unknown): ComparisonItem[] {
  if (typeof raw !== 'string') return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as ComparisonItem[];
  } catch {
    return [];
  }
}

function rowToComparison(row: Record<string, unknown>): Comparison {
  return ComparisonSchema.parse({
    id: row.id,
    category: row.category,
    title: row.title,
    items: parseItems(row.items_json),
    winner: (row.winner as string | null) ?? null,
    reasoningMd: (row.reasoning_md as string | null) ?? null,
    decidedAt: parseIntOrNull(row.decided_at),
    purchaseId: (row.purchase_id as string | null) ?? null,
    createdAt: parseInt0(row.created_at),
    updatedAt: parseInt0(row.updated_at),
  });
}

/**
 * Create a comparison. items_json is serialised at the boundary.
 */
export function createComparison(
  db: DatabaseAdapter,
  rawInput: ComparisonInput,
): Comparison {
  const input = ComparisonInputSchema.parse(rawInput);
  const id = randomId();
  const now = nowMs();
  db.execute(
    `INSERT INTO sh_comparisons (
       id, category, title, items_json, winner, reasoning_md,
       decided_at, purchase_id, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.category,
      input.title,
      JSON.stringify(input.items),
      input.winner,
      input.reasoningMd,
      input.decidedAt,
      input.purchaseId,
      now,
      now,
    ],
  );
  return getComparisonById(db, id)!;
}

export function getComparisonById(
  db: DatabaseAdapter,
  id: string,
): Comparison | null {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM sh_comparisons WHERE id = ?`,
    [id],
  );
  return rows[0] ? rowToComparison(rows[0]) : null;
}

/**
 * Patch any subset of fields. Items are re-serialised when provided.
 */
export function updateComparison(
  db: DatabaseAdapter,
  id: string,
  rawPatch: ComparisonUpdate,
): Comparison | null {
  const existing = getComparisonById(db, id);
  if (!existing) return null;
  const patch = ComparisonUpdateSchema.parse(rawPatch);

  const next = {
    category: patch.category ?? existing.category,
    title: patch.title ?? existing.title,
    items: patch.items ?? existing.items,
    winner: patch.winner === undefined ? existing.winner : patch.winner,
    reasoningMd:
      patch.reasoningMd === undefined ? existing.reasoningMd : patch.reasoningMd,
    decidedAt: patch.decidedAt === undefined ? existing.decidedAt : patch.decidedAt,
    purchaseId:
      patch.purchaseId === undefined ? existing.purchaseId : patch.purchaseId,
  };

  const now = nowMs();
  db.execute(
    `UPDATE sh_comparisons
       SET category = ?, title = ?, items_json = ?, winner = ?,
           reasoning_md = ?, decided_at = ?, purchase_id = ?, updated_at = ?
     WHERE id = ?`,
    [
      next.category,
      next.title,
      JSON.stringify(next.items),
      next.winner,
      next.reasoningMd,
      next.decidedAt,
      next.purchaseId,
      now,
      id,
    ],
  );
  return getComparisonById(db, id);
}

export function deleteComparison(db: DatabaseAdapter, id: string): boolean {
  const existing = getComparisonById(db, id);
  if (!existing) return false;
  db.execute(`DELETE FROM sh_comparisons WHERE id = ?`, [id]);
  return true;
}

export interface ListComparisonsOptions {
  category?: string;
  limit?: number;
}

/**
 * List comparisons sorted by created_at DESC, optionally filtered by category.
 */
export function listComparisons(
  db: DatabaseAdapter,
  opts: ListComparisonsOptions = {},
): Comparison[] {
  const where = opts.category ? 'WHERE category = ?' : '';
  const params: unknown[] = opts.category ? [opts.category] : [];
  const limit = Math.min(Math.max(opts.limit ?? 1000, 1), 1000);
  return db
    .query<Record<string, unknown>>(
      `SELECT * FROM sh_comparisons ${where}
         ORDER BY created_at DESC, id DESC
         LIMIT ${limit}`,
      params,
    )
    .map(rowToComparison);
}

export function listComparisonsByCategory(
  db: DatabaseAdapter,
  category: string,
): Comparison[] {
  return listComparisons(db, { category });
}

/**
 * Most recently created comparisons, capped at limit (default 10).
 */
export function listRecentComparisons(
  db: DatabaseAdapter,
  limit = 10,
): Comparison[] {
  return listComparisons(db, { limit });
}

/**
 * Link a comparison to the purchase it informed and stamp decided_at to now.
 */
export function linkComparisonToPurchase(
  db: DatabaseAdapter,
  id: string,
  purchaseId: string,
): Comparison | null {
  const existing = getComparisonById(db, id);
  if (!existing) return null;
  const now = nowMs();
  db.execute(
    `UPDATE sh_comparisons
       SET purchase_id = ?, decided_at = COALESCE(decided_at, ?), updated_at = ?
     WHERE id = ?`,
    [purchaseId, now, now, id],
  );
  return getComparisonById(db, id);
}

/**
 * Case-insensitive LIKE search on category.
 */
export function searchComparisonsByCategory(
  db: DatabaseAdapter,
  queryFragment: string,
): Comparison[] {
  const fragment = (queryFragment ?? '').trim();
  if (!fragment) return [];
  return db
    .query<Record<string, unknown>>(
      `SELECT * FROM sh_comparisons WHERE LOWER(category) LIKE LOWER(?)
         ORDER BY created_at DESC
         LIMIT 1000`,
      [`%${fragment}%`],
    )
    .map(rowToComparison);
}
