import type { DatabaseAdapter } from '@mylife/db';
import type { Recall } from '../types';

// ---------------------------------------------------------------------------
// Row mapper (snake_case SQL -> camelCase TS)
// ---------------------------------------------------------------------------

function rowToRecall(row: Record<string, unknown>): Recall {
  return {
    id: row.id as string,
    vehicleId: row.vehicle_id as string,
    nhtsaCampaignNumber: row.nhtsa_campaign_number as string,
    component: (row.component as string) ?? null,
    summary: (row.summary as string) ?? null,
    consequence: (row.consequence as string) ?? null,
    remedy: (row.remedy as string) ?? null,
    isAcknowledged: !!(row.is_acknowledged as number),
    fetchedAt: row.fetched_at as string,
    createdAt: row.created_at as string,
  };
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

/**
 * Create a new recall record for a vehicle.
 * Defaults to is_acknowledged=0 (unacknowledged).
 */
export function createRecall(
  db: DatabaseAdapter,
  id: string,
  input: {
    vehicleId: string;
    nhtsaCampaignNumber: string;
    component?: string;
    summary?: string;
    consequence?: string;
    remedy?: string;
    fetchedAt: string;
  },
): void {
  const now = new Date().toISOString();
  db.execute(
    `INSERT INTO cr_recalls
     (id, vehicle_id, nhtsa_campaign_number, component, summary, consequence, remedy, is_acknowledged, fetched_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
    [
      id,
      input.vehicleId,
      input.nhtsaCampaignNumber,
      input.component ?? null,
      input.summary ?? null,
      input.consequence ?? null,
      input.remedy ?? null,
      input.fetchedAt,
      now,
    ],
  );
}

/**
 * Get all recalls for a vehicle, ordered by most recently fetched first.
 */
export function getRecallsByVehicle(db: DatabaseAdapter, vehicleId: string): Recall[] {
  return db.query<Record<string, unknown>>(
    'SELECT * FROM cr_recalls WHERE vehicle_id = ? ORDER BY fetched_at DESC',
    [vehicleId],
  ).map(rowToRecall);
}

/**
 * Get only unacknowledged recalls for a vehicle, ordered by most recently fetched first.
 */
export function getUnacknowledgedRecalls(db: DatabaseAdapter, vehicleId: string): Recall[] {
  return db.query<Record<string, unknown>>(
    'SELECT * FROM cr_recalls WHERE vehicle_id = ? AND is_acknowledged = 0 ORDER BY fetched_at DESC',
    [vehicleId],
  ).map(rowToRecall);
}

/**
 * Mark a recall as acknowledged.
 */
export function acknowledgeRecall(db: DatabaseAdapter, id: string): void {
  db.execute(
    'UPDATE cr_recalls SET is_acknowledged = 1 WHERE id = ?',
    [id],
  );
}

/**
 * Delete a recall record.
 */
export function deleteRecall(db: DatabaseAdapter, id: string): void {
  db.execute('DELETE FROM cr_recalls WHERE id = ?', [id]);
}

/**
 * Check if a recall with the given campaign number already exists for a vehicle.
 * Useful to avoid duplicate imports from the NHTSA API.
 */
export function recallExists(db: DatabaseAdapter, vehicleId: string, campaignNumber: string): boolean {
  const rows = db.query<{ c: number }>(
    'SELECT COUNT(*) as c FROM cr_recalls WHERE vehicle_id = ? AND nhtsa_campaign_number = ?',
    [vehicleId, campaignNumber],
  );
  return rows[0].c > 0;
}
