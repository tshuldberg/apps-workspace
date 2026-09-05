import type { DatabaseAdapter } from '@mylife/db';
import type { HealthKitLink, ComparisonOperator } from '../types';

// ── Row mapper ──────────────────────────────────────────────────────────

function rowToLink(row: Record<string, unknown>): HealthKitLink {
  return {
    id: row.id as string,
    habitId: row.habit_id as string,
    dataSource: row.data_source as string,
    metric: row.metric as string,
    threshold: row.threshold as number,
    comparison: row.comparison as ComparisonOperator,
    isActive: !!(row.is_active as number),
    lastSyncedAt: (row.last_synced_at as string) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

// ── CRUD ────────────────────────────────────────────────────────────────

export interface CreateHealthKitLinkInput {
  habitId: string;
  dataSource: string;
  metric: string;
  threshold: number;
  comparison?: ComparisonOperator;
}

export function createHealthKitLink(
  db: DatabaseAdapter,
  id: string,
  input: CreateHealthKitLinkInput,
): void {
  const now = new Date().toISOString();
  db.execute(
    `INSERT INTO hb_healthkit_links (id, habit_id, data_source, metric, threshold, comparison, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, input.habitId, input.dataSource, input.metric, input.threshold, input.comparison ?? 'gte', now, now],
  );
}

export function getHealthKitLink(db: DatabaseAdapter, habitId: string): HealthKitLink | null {
  const rows = db.query<Record<string, unknown>>(
    'SELECT * FROM hb_healthkit_links WHERE habit_id = ? AND is_active = 1',
    [habitId],
  );
  return rows.length > 0 ? rowToLink(rows[0]) : null;
}

export function getAllActiveHealthKitLinks(db: DatabaseAdapter): HealthKitLink[] {
  return db.query<Record<string, unknown>>(
    'SELECT * FROM hb_healthkit_links WHERE is_active = 1',
  ).map(rowToLink);
}

export function updateHealthKitLinkSyncTime(db: DatabaseAdapter, id: string): void {
  db.execute(
    `UPDATE hb_healthkit_links SET last_synced_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`,
    [id],
  );
}

export function deactivateHealthKitLink(db: DatabaseAdapter, id: string): void {
  db.execute(
    `UPDATE hb_healthkit_links SET is_active = 0, updated_at = datetime('now') WHERE id = ?`,
    [id],
  );
}

export function deleteHealthKitLink(db: DatabaseAdapter, id: string): void {
  db.execute('DELETE FROM hb_healthkit_links WHERE id = ?', [id]);
}
