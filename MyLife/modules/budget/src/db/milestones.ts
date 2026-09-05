/**
 * CRUD operations for Net Worth Milestones.
 * Table: bg_net_worth_milestones
 */

import type { DatabaseAdapter } from '@mylife/db';
import type { NetWorthMilestone, NetWorthMilestoneInsert } from '../types';

function generateId(): string {
  return `nwm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Create a net worth milestone.
 */
export function createMilestone(
  db: DatabaseAdapter,
  data: NetWorthMilestoneInsert,
): NetWorthMilestone | null {
  const id = generateId();
  db.execute(
    `INSERT INTO bg_net_worth_milestones (id, milestone_type, value, achieved_at, dismissed)
     VALUES (?, ?, ?, ?, ?)`,
    [id, data.milestone_type, data.value, data.achieved_at, data.dismissed ?? 0],
  );
  return getMilestoneById(db, id);
}

/**
 * Get a milestone by ID.
 */
export function getMilestoneById(
  db: DatabaseAdapter,
  id: string,
): NetWorthMilestone | null {
  const rows = db.query<NetWorthMilestone>(
    `SELECT * FROM bg_net_worth_milestones WHERE id = ?`,
    [id],
  );
  return rows[0] ?? null;
}

/**
 * Get all milestones, ordered by achieved_at descending.
 */
export function getMilestones(db: DatabaseAdapter): NetWorthMilestone[] {
  return db.query<NetWorthMilestone>(
    `SELECT * FROM bg_net_worth_milestones ORDER BY achieved_at DESC`,
  );
}

/**
 * Get un-dismissed milestones.
 */
export function getUndismissedMilestones(db: DatabaseAdapter): NetWorthMilestone[] {
  return db.query<NetWorthMilestone>(
    `SELECT * FROM bg_net_worth_milestones WHERE dismissed = 0 ORDER BY achieved_at DESC`,
  );
}

/**
 * Dismiss a milestone.
 */
export function dismissMilestone(db: DatabaseAdapter, id: string): void {
  db.execute(`UPDATE bg_net_worth_milestones SET dismissed = 1 WHERE id = ?`, [id]);
}

/**
 * Check if a milestone of a given type and value already exists.
 */
export function milestoneExists(
  db: DatabaseAdapter,
  milestoneType: string,
  value: number,
): boolean {
  const rows = db.query<{ cnt: number }>(
    `SELECT COUNT(*) as cnt FROM bg_net_worth_milestones WHERE milestone_type = ? AND value = ?`,
    [milestoneType, value],
  );
  return (rows[0]?.cnt ?? 0) > 0;
}

/**
 * Delete a milestone by ID.
 */
export function deleteMilestone(db: DatabaseAdapter, id: string): void {
  db.execute(`DELETE FROM bg_net_worth_milestones WHERE id = ?`, [id]);
}
