/**
 * Category group CRUD operations.
 *
 * Category groups organize envelopes into collapsible sections
 * (e.g., "Fixed Expenses", "Savings", "Lifestyle"). Each envelope
 * can optionally belong to one group via bg_envelopes.group_id.
 */

import type { DatabaseAdapter } from '@mylife/db';
import type {
  CategoryGroup,
  CategoryGroupInsert,
  CategoryGroupUpdate,
} from '../types';

const CATEGORY_GROUP_COLUMNS = new Set(['name', 'sort_order', 'is_hidden']);

// ---------------------------------------------------------------------------
// Category Groups
// ---------------------------------------------------------------------------

export function createCategoryGroup(
  db: DatabaseAdapter,
  id: string,
  input: CategoryGroupInsert,
): CategoryGroup {
  const now = new Date().toISOString();
  const group: CategoryGroup = {
    id,
    name: input.name,
    sort_order: input.sort_order ?? 0,
    is_hidden: input.is_hidden ?? 0,
    created_at: now,
    updated_at: now,
  };

  db.execute(
    `INSERT INTO bg_category_groups (id, name, sort_order, is_hidden, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [group.id, group.name, group.sort_order, group.is_hidden, group.created_at, group.updated_at],
  );

  return group;
}

export function getCategoryGroupById(
  db: DatabaseAdapter,
  id: string,
): CategoryGroup | null {
  const rows = db.query<CategoryGroup>(
    `SELECT * FROM bg_category_groups WHERE id = ?`,
    [id],
  );
  return rows[0] ?? null;
}

export function getCategoryGroups(
  db: DatabaseAdapter,
  includeHidden = false,
): CategoryGroup[] {
  if (includeHidden) {
    return db.query<CategoryGroup>(
      `SELECT * FROM bg_category_groups ORDER BY sort_order ASC, name ASC`,
    );
  }
  return db.query<CategoryGroup>(
    `SELECT * FROM bg_category_groups WHERE is_hidden = 0 ORDER BY sort_order ASC, name ASC`,
  );
}

export function updateCategoryGroup(
  db: DatabaseAdapter,
  id: string,
  updates: CategoryGroupUpdate,
): void {
  const fields: string[] = [];
  const values: unknown[] = [];

  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined && CATEGORY_GROUP_COLUMNS.has(key)) {
      fields.push(`${key} = ?`);
      values.push(value);
    }
  }

  if (fields.length === 0) return;

  fields.push('updated_at = ?');
  values.push(new Date().toISOString());
  values.push(id);

  db.execute(
    `UPDATE bg_category_groups SET ${fields.join(', ')} WHERE id = ?`,
    values,
  );
}

export function deleteCategoryGroup(db: DatabaseAdapter, id: string): void {
  db.execute(`DELETE FROM bg_category_groups WHERE id = ?`, [id]);
}

// ---------------------------------------------------------------------------
// Envelope-Group linking
// ---------------------------------------------------------------------------

export function getEnvelopesByGroup(
  db: DatabaseAdapter,
  groupId: string,
): Array<{ id: string; name: string }> {
  return db.query<{ id: string; name: string }>(
    `SELECT id, name FROM bg_envelopes WHERE group_id = ? ORDER BY sort_order ASC, name ASC`,
    [groupId],
  );
}

export function setEnvelopeGroup(
  db: DatabaseAdapter,
  envelopeId: string,
  groupId: string | null,
): void {
  db.execute(
    `UPDATE bg_envelopes SET group_id = ?, updated_at = ? WHERE id = ?`,
    [groupId, new Date().toISOString(), envelopeId],
  );
}
