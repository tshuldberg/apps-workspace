import type { DatabaseAdapter } from '@mylife/db';

interface ActionItemRow {
  id: string;
  habit_id: string;
  label: string;
  sort_order: number;
  created_at: string;
}

interface ActionCompletionRow {
  id: string;
  action_item_id: string;
  completed_at: string;
  created_at: string;
}

function rowToItem(row: ActionItemRow) {
  return {
    id: row.id,
    habitId: row.habit_id,
    label: row.label,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
  };
}

function rowToCompletion(row: ActionCompletionRow) {
  return {
    id: row.id,
    actionItemId: row.action_item_id,
    completedAt: row.completed_at,
    createdAt: row.created_at,
  };
}

export function createActionItem(db: DatabaseAdapter, habitId: string, label: string, sortOrder: number = 0) {
  const id = crypto.randomUUID();
  db.execute(
    `INSERT INTO hb_action_items (id, habit_id, label, sort_order)
     VALUES (?, ?, ?, ?)`,
    [id, habitId, label, sortOrder],
  );
  return id;
}

export function getActionItemsForHabit(db: DatabaseAdapter, habitId: string) {
  const rows = db.query<ActionItemRow>(
    `SELECT * FROM hb_action_items WHERE habit_id = ? ORDER BY sort_order ASC`,
    [habitId],
  );
  return rows.map(rowToItem);
}

export function updateActionItemLabel(db: DatabaseAdapter, id: string, label: string) {
  db.execute(`UPDATE hb_action_items SET label = ? WHERE id = ?`, [label, id]);
}

export function updateActionItemOrder(db: DatabaseAdapter, id: string, sortOrder: number) {
  db.execute(`UPDATE hb_action_items SET sort_order = ? WHERE id = ?`, [sortOrder, id]);
}

export function deleteActionItem(db: DatabaseAdapter, id: string) {
  db.execute(`DELETE FROM hb_action_items WHERE id = ?`, [id]);
}

export function completeActionItem(db: DatabaseAdapter, actionItemId: string, completedAt: string) {
  const id = crypto.randomUUID();
  db.execute(
    `INSERT OR IGNORE INTO hb_action_completions (id, action_item_id, completed_at)
     VALUES (?, ?, ?)`,
    [id, actionItemId, completedAt],
  );
  return id;
}

export function uncompleteActionItem(db: DatabaseAdapter, actionItemId: string, completedAt: string) {
  db.execute(
    `DELETE FROM hb_action_completions WHERE action_item_id = ? AND completed_at = ?`,
    [actionItemId, completedAt],
  );
}

export function getCompletedActionItemIds(db: DatabaseAdapter, habitId: string, date: string): Set<string> {
  const rows = db.query<{ action_item_id: string }>(
    `SELECT ac.action_item_id FROM hb_action_completions ac
     INNER JOIN hb_action_items ai ON ai.id = ac.action_item_id
     WHERE ai.habit_id = ? AND ac.completed_at = ?`,
    [habitId, date],
  );
  return new Set(rows.map(r => r.action_item_id));
}

export function getActionCompletionsForDate(db: DatabaseAdapter, habitId: string, date: string) {
  const rows = db.query<ActionCompletionRow>(
    `SELECT ac.* FROM hb_action_completions ac
     INNER JOIN hb_action_items ai ON ai.id = ac.action_item_id
     WHERE ai.habit_id = ? AND ac.completed_at = ?`,
    [habitId, date],
  );
  return rows.map(rowToCompletion);
}
