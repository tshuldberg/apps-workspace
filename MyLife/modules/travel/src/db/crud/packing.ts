/**
 * Packing list + packing item CRUD for MyTravel (v6 packing).
 *
 * Lists may be trip-scoped (trip_id set) or reusable templates (template=1,
 * trip_id optional). Items are always list-scoped. IDs use `pl_` for lists
 * and `pi_` for items.
 */

import type { DatabaseAdapter } from '@mylife/db';
import {
  PackingItemInputSchema,
  PackingItemUpdateSchema,
  PackingListInputSchema,
  PackingListUpdateSchema,
  PackingTemplateKeySchema,
  type PackingItemInput,
  type PackingItemRow,
  type PackingItemUpdate,
  type PackingListInput,
  type PackingListRow,
  type PackingListUpdate,
  type PackingTemplateKey,
} from '../../models/schemas';
import { PACKING_TEMPLATES } from '../../engine/packing-templates';

// ── ID generation ───────────────────────────────────────────────────

let plIdCounter = 0;
let piIdCounter = 0;

function generateListId(): string {
  plIdCounter += 1;
  const now = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 10);
  return `pl_${now}${rand}${plIdCounter.toString(36)}`;
}

function generateItemId(): string {
  piIdCounter += 1;
  const now = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 10);
  return `pi_${now}${rand}${piIdCounter.toString(36)}`;
}

// ── Update column whitelists ────────────────────────────────────────

const LIST_UPDATE_COLUMNS = new Set(['name', 'template', 'trip_id']);
const ITEM_UPDATE_COLUMNS = new Set([
  'label',
  'quantity',
  'category',
  'packed',
  'sort_order',
]);

// ── Packing Lists ───────────────────────────────────────────────────

export function createPackingList(
  db: DatabaseAdapter,
  input: PackingListInput,
): PackingListRow {
  const parsed = PackingListInputSchema.parse(input);
  const id = generateListId();
  const now = new Date().toISOString();

  const row: PackingListRow = {
    id,
    trip_id: parsed.trip_id ?? null,
    name: parsed.name,
    template: parsed.template ? 1 : 0,
    created_at: now,
    updated_at: now,
  };

  db.execute(
    `INSERT INTO tv_packing_lists (
       id, trip_id, name, template, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?)`,
    [row.id, row.trip_id, row.name, row.template, row.created_at, row.updated_at],
  );

  return row;
}

export function getPackingList(
  db: DatabaseAdapter,
  id: string,
): PackingListRow | null {
  const rows = db.query<PackingListRow>(
    `SELECT * FROM tv_packing_lists WHERE id = ?`,
    [id],
  );
  return rows[0] ?? null;
}

export function listPackingListsByTrip(
  db: DatabaseAdapter,
  tripId: string,
): PackingListRow[] {
  return db.query<PackingListRow>(
    `SELECT * FROM tv_packing_lists WHERE trip_id = ? ORDER BY created_at ASC`,
    [tripId],
  );
}

export function listPackingTemplates(db: DatabaseAdapter): PackingListRow[] {
  return db.query<PackingListRow>(
    `SELECT * FROM tv_packing_lists WHERE template = 1 ORDER BY name ASC`,
  );
}

export function updatePackingList(
  db: DatabaseAdapter,
  id: string,
  patch: PackingListUpdate,
): void {
  const parsed = PackingListUpdateSchema.parse(patch);
  const fields: string[] = [];
  const values: unknown[] = [];

  for (const [key, value] of Object.entries(parsed)) {
    if (value === undefined) continue;
    if (!LIST_UPDATE_COLUMNS.has(key)) continue;
    if (key === 'template') {
      fields.push('template = ?');
      values.push(value ? 1 : 0);
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
    `UPDATE tv_packing_lists SET ${fields.join(', ')} WHERE id = ?`,
    values,
  );
}

export function deletePackingList(db: DatabaseAdapter, id: string): void {
  db.execute(`DELETE FROM tv_packing_lists WHERE id = ?`, [id]);
}

export interface DuplicatePackingListOptions {
  tripId?: string | null;
  name?: string;
}

/**
 * Copies a list and all of its items into a new list. When `tripId` is
 * provided (including null), it overrides the source trip_id; otherwise the
 * source's trip_id is reused. The copy is never a template.
 */
export function duplicatePackingList(
  db: DatabaseAdapter,
  id: string,
  opts: DuplicatePackingListOptions = {},
): PackingListRow {
  const source = getPackingList(db, id);
  if (!source) {
    throw new Error(`Packing list not found: ${id}`);
  }

  const newId = generateListId();
  const now = new Date().toISOString();
  const tripId =
    opts.tripId !== undefined ? opts.tripId : source.trip_id;
  const name = opts.name ?? `${source.name} (Copy)`;

  const copy: PackingListRow = {
    id: newId,
    trip_id: tripId ?? null,
    name,
    template: 0,
    created_at: now,
    updated_at: now,
  };

  db.transaction(() => {
    db.execute(
      `INSERT INTO tv_packing_lists (
         id, trip_id, name, template, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?)`,
      [copy.id, copy.trip_id, copy.name, copy.template, copy.created_at, copy.updated_at],
    );

    const sourceItems = db.query<PackingItemRow>(
      `SELECT * FROM tv_packing_items WHERE list_id = ? ORDER BY sort_order ASC`,
      [source.id],
    );
    for (const item of sourceItems) {
      db.execute(
        `INSERT INTO tv_packing_items (
           id, list_id, label, quantity, category, packed, packed_at, sort_order,
           created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          generateItemId(),
          copy.id,
          item.label,
          item.quantity,
          item.category,
          0,
          null,
          item.sort_order,
          now,
          now,
        ],
      );
    }
  });

  return copy;
}

// ── Packing Items ───────────────────────────────────────────────────

export function createPackingItem(
  db: DatabaseAdapter,
  input: PackingItemInput,
): PackingItemRow {
  const parsed = PackingItemInputSchema.parse(input);
  const id = generateItemId();
  const now = new Date().toISOString();

  let sortOrder = parsed.sort_order;
  if (sortOrder === undefined) {
    const rows = db.query<{ max_order: number | null }>(
      `SELECT MAX(sort_order) as max_order FROM tv_packing_items WHERE list_id = ?`,
      [parsed.list_id],
    );
    const current = rows[0]?.max_order ?? null;
    sortOrder = current === null ? 0 : current + 1;
  }

  const packed = parsed.packed ? 1 : 0;

  const row: PackingItemRow = {
    id,
    list_id: parsed.list_id,
    label: parsed.label,
    quantity: parsed.quantity ?? 1,
    category: parsed.category ?? null,
    packed,
    packed_at: packed === 1 ? now : null,
    sort_order: sortOrder,
    created_at: now,
    updated_at: now,
  };

  db.execute(
    `INSERT INTO tv_packing_items (
       id, list_id, label, quantity, category, packed, packed_at, sort_order,
       created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      row.id,
      row.list_id,
      row.label,
      row.quantity,
      row.category,
      row.packed,
      row.packed_at,
      row.sort_order,
      row.created_at,
      row.updated_at,
    ],
  );

  return row;
}

export interface ListPackingItemsOptions {
  listId: string;
  packed?: boolean;
}

export function listPackingItems(
  db: DatabaseAdapter,
  opts: ListPackingItemsOptions,
): PackingItemRow[] {
  const where: string[] = ['list_id = ?'];
  const params: unknown[] = [opts.listId];

  if (opts.packed !== undefined) {
    where.push('packed = ?');
    params.push(opts.packed ? 1 : 0);
  }

  return db.query<PackingItemRow>(
    `SELECT * FROM tv_packing_items WHERE ${where.join(' AND ')} ORDER BY sort_order ASC`,
    params,
  );
}

export function getPackingItem(
  db: DatabaseAdapter,
  id: string,
): PackingItemRow | null {
  const rows = db.query<PackingItemRow>(
    `SELECT * FROM tv_packing_items WHERE id = ?`,
    [id],
  );
  return rows[0] ?? null;
}

export function togglePackingItem(db: DatabaseAdapter, id: string): void {
  const current = getPackingItem(db, id);
  if (!current) return;

  const next = current.packed === 1 ? 0 : 1;
  const now = new Date().toISOString();
  const packedAt = next === 1 ? now : null;

  db.execute(
    `UPDATE tv_packing_items SET packed = ?, packed_at = ?, updated_at = ? WHERE id = ?`,
    [next, packedAt, now, id],
  );
}

export function updatePackingItem(
  db: DatabaseAdapter,
  id: string,
  patch: PackingItemUpdate,
): void {
  const parsed = PackingItemUpdateSchema.parse(patch);
  const fields: string[] = [];
  const values: unknown[] = [];

  for (const [key, value] of Object.entries(parsed)) {
    if (value === undefined) continue;
    if (!ITEM_UPDATE_COLUMNS.has(key)) continue;
    if (key === 'packed') {
      const intVal = value ? 1 : 0;
      fields.push('packed = ?');
      values.push(intVal);
      fields.push('packed_at = ?');
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
    `UPDATE tv_packing_items SET ${fields.join(', ')} WHERE id = ?`,
    values,
  );
}

export function deletePackingItem(db: DatabaseAdapter, id: string): void {
  db.execute(`DELETE FROM tv_packing_items WHERE id = ?`, [id]);
}

/**
 * Reassigns sort_order for the given items in the order provided. Items not
 * in the list are left untouched.
 */
export function reorderPackingItems(
  db: DatabaseAdapter,
  orderedIds: string[],
): void {
  const now = new Date().toISOString();
  db.transaction(() => {
    for (let i = 0; i < orderedIds.length; i += 1) {
      const id = orderedIds[i];
      db.execute(
        `UPDATE tv_packing_items SET sort_order = ?, updated_at = ? WHERE id = ?`,
        [i, now, id],
      );
    }
  });
}

/**
 * Transactionally appends a batch of items (quantity=1 each) to the end of a
 * list, preserving the order of `labels`.
 */
export function bulkAddPackingItems(
  db: DatabaseAdapter,
  listId: string,
  labels: string[],
): PackingItemRow[] {
  if (labels.length === 0) return [];

  const now = new Date().toISOString();
  const created: PackingItemRow[] = [];

  db.transaction(() => {
    const rows = db.query<{ max_order: number | null }>(
      `SELECT MAX(sort_order) as max_order FROM tv_packing_items WHERE list_id = ?`,
      [listId],
    );
    const current = rows[0]?.max_order ?? null;
    let next = current === null ? 0 : current + 1;

    for (const label of labels) {
      const trimmed = label.trim();
      if (trimmed.length === 0) continue;
      const row: PackingItemRow = {
        id: generateItemId(),
        list_id: listId,
        label: trimmed,
        quantity: 1,
        category: null,
        packed: 0,
        packed_at: null,
        sort_order: next,
        created_at: now,
        updated_at: now,
      };
      db.execute(
        `INSERT INTO tv_packing_items (
           id, list_id, label, quantity, category, packed, packed_at, sort_order,
           created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          row.id,
          row.list_id,
          row.label,
          row.quantity,
          row.category,
          row.packed,
          row.packed_at,
          row.sort_order,
          row.created_at,
          row.updated_at,
        ],
      );
      created.push(row);
      next += 1;
    }
  });

  return created;
}

// ── Template seeding ────────────────────────────────────────────────

/**
 * Creates a new trip-scoped packing list seeded with the items from the
 * named template. The new list is NOT itself a template.
 */
export function createListFromTemplate(
  db: DatabaseAdapter,
  tripId: string,
  templateKey: PackingTemplateKey,
  customName?: string,
): PackingListRow {
  const key = PackingTemplateKeySchema.parse(templateKey);
  const items = PACKING_TEMPLATES[key];
  const name =
    customName ?? `${key.charAt(0).toUpperCase()}${key.slice(1)} packing list`;

  const listId = generateListId();
  const now = new Date().toISOString();

  const row: PackingListRow = {
    id: listId,
    trip_id: tripId,
    name,
    template: 0,
    created_at: now,
    updated_at: now,
  };

  db.transaction(() => {
    db.execute(
      `INSERT INTO tv_packing_lists (
         id, trip_id, name, template, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?)`,
      [row.id, row.trip_id, row.name, row.template, row.created_at, row.updated_at],
    );

    for (let i = 0; i < items.length; i += 1) {
      const item = items[i];
      db.execute(
        `INSERT INTO tv_packing_items (
           id, list_id, label, quantity, category, packed, packed_at, sort_order,
           created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          generateItemId(),
          listId,
          item.label,
          1,
          item.category,
          0,
          null,
          i,
          now,
          now,
        ],
      );
    }
  });

  return row;
}
