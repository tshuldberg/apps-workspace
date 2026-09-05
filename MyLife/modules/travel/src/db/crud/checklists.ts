/**
 * Trip checklist item CRUD for MyTravel (v5 extended logistics).
 *
 * Checklist items are always trip-scoped. IDs use `cl_` prefix.
 */

import type { DatabaseAdapter } from '@mylife/db';
import {
  ChecklistItemInputSchema,
  ChecklistItemUpdateSchema,
  type ChecklistItemInput,
  type ChecklistItemRow,
  type ChecklistItemUpdate,
} from '../../models/schemas';

// ── ID generation ───────────────────────────────────────────────────

let clIdCounter = 0;
function generateChecklistId(): string {
  clIdCounter += 1;
  const now = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 10);
  return `cl_${now}${rand}${clIdCounter.toString(36)}`;
}

// ── Update column whitelist ─────────────────────────────────────────

const UPDATE_COLUMNS = new Set([
  'label',
  'category',
  'done',
  'sort_order',
]);

// ── Create ──────────────────────────────────────────────────────────

export function createChecklistItem(
  db: DatabaseAdapter,
  input: ChecklistItemInput,
): ChecklistItemRow {
  const parsed = ChecklistItemInputSchema.parse(input);
  const id = generateChecklistId();
  const now = new Date().toISOString();

  // If no sort_order provided, append to end of list for this trip.
  let sortOrder = parsed.sort_order;
  if (sortOrder === undefined) {
    const rows = db.query<{ max_order: number | null }>(
      `SELECT MAX(sort_order) as max_order FROM tv_checklist_items WHERE trip_id = ?`,
      [parsed.trip_id],
    );
    const current = rows[0]?.max_order ?? null;
    sortOrder = current === null ? 0 : current + 1;
  }

  const done = parsed.done ? 1 : 0;

  const row: ChecklistItemRow = {
    id,
    trip_id: parsed.trip_id,
    label: parsed.label,
    category: parsed.category ?? null,
    done,
    done_at: done === 1 ? now : null,
    sort_order: sortOrder,
    created_at: now,
    updated_at: now,
  };

  db.execute(
    `INSERT INTO tv_checklist_items (
       id, trip_id, label, category, done, done_at, sort_order,
       created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      row.id,
      row.trip_id,
      row.label,
      row.category,
      row.done,
      row.done_at,
      row.sort_order,
      row.created_at,
      row.updated_at,
    ],
  );

  return row;
}

// ── Read ────────────────────────────────────────────────────────────

export function getChecklistItem(
  db: DatabaseAdapter,
  id: string,
): ChecklistItemRow | null {
  const rows = db.query<ChecklistItemRow>(
    `SELECT * FROM tv_checklist_items WHERE id = ?`,
    [id],
  );
  return rows[0] ?? null;
}

// ── List ────────────────────────────────────────────────────────────

export interface ListChecklistItemsOptions {
  tripId: string;
  done?: boolean;
}

export function listChecklistItems(
  db: DatabaseAdapter,
  opts: ListChecklistItemsOptions,
): ChecklistItemRow[] {
  const where: string[] = ['trip_id = ?'];
  const params: unknown[] = [opts.tripId];

  if (opts.done !== undefined) {
    where.push('done = ?');
    params.push(opts.done ? 1 : 0);
  }

  return db.query<ChecklistItemRow>(
    `SELECT * FROM tv_checklist_items WHERE ${where.join(' AND ')} ORDER BY sort_order ASC`,
    params,
  );
}

// ── Toggle done ─────────────────────────────────────────────────────

export function toggleDone(db: DatabaseAdapter, id: string): void {
  const current = getChecklistItem(db, id);
  if (!current) return;

  const nextDone = current.done === 1 ? 0 : 1;
  const now = new Date().toISOString();
  const doneAt = nextDone === 1 ? now : null;

  db.execute(
    `UPDATE tv_checklist_items SET done = ?, done_at = ?, updated_at = ? WHERE id = ?`,
    [nextDone, doneAt, now, id],
  );
}

// ── Update ──────────────────────────────────────────────────────────

export function updateChecklistItem(
  db: DatabaseAdapter,
  id: string,
  patch: ChecklistItemUpdate,
): void {
  const parsed = ChecklistItemUpdateSchema.parse(patch);
  const fields: string[] = [];
  const values: unknown[] = [];

  for (const [key, value] of Object.entries(parsed)) {
    if (value === undefined) continue;
    if (!UPDATE_COLUMNS.has(key)) continue;
    if (key === 'done') {
      const intVal = value ? 1 : 0;
      fields.push('done = ?');
      values.push(intVal);
      fields.push('done_at = ?');
      values.push(intVal === 1 ? new Date().toISOString() : null);
      continue;
    }
    fields.push(`${key} = ?`);
    values.push(value);
  }

  if (fields.length === 0) return;

  fields.push('updated_at = ?');
  values.push(new Date().toISOString());
  values.push(id);

  db.execute(
    `UPDATE tv_checklist_items SET ${fields.join(', ')} WHERE id = ?`,
    values,
  );
}

// ── Delete ──────────────────────────────────────────────────────────

export function deleteChecklistItem(db: DatabaseAdapter, id: string): void {
  db.execute(`DELETE FROM tv_checklist_items WHERE id = ?`, [id]);
}

// ── Reorder ─────────────────────────────────────────────────────────

/**
 * Reassigns sort_order for the given items in the order provided. Each id is
 * assigned its index in the array as its new sort_order. Items not in the
 * list are left untouched.
 */
export function reorderChecklistItems(
  db: DatabaseAdapter,
  orderedIds: string[],
): void {
  const now = new Date().toISOString();
  for (let i = 0; i < orderedIds.length; i += 1) {
    const id = orderedIds[i];
    db.execute(
      `UPDATE tv_checklist_items SET sort_order = ?, updated_at = ? WHERE id = ?`,
      [i, now, id],
    );
  }
}
