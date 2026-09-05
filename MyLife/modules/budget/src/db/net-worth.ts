/**
 * Net worth snapshot CRUD operations.
 *
 * Monthly snapshots of assets vs liabilities for trend tracking.
 * Account balances stored as JSON for detailed breakdown.
 * All amounts in integer cents.
 */

import type { DatabaseAdapter } from '@mylife/db';
import type { NetWorthSnapshot } from '../types';

const NET_WORTH_SNAPSHOT_COLUMNS = new Set(['assets', 'liabilities', 'net_worth', 'account_balances']);

export interface NetWorthSnapshotInsert {
  month: string;
  assets: number;
  liabilities: number;
  net_worth: number;
  account_balances: string | null;
}

export interface NetWorthSnapshotUpdate {
  assets?: number;
  liabilities?: number;
  net_worth?: number;
  account_balances?: string | null;
}

export function createNetWorthSnapshot(
  db: DatabaseAdapter,
  id: string,
  input: NetWorthSnapshotInsert,
): NetWorthSnapshot {
  const now = new Date().toISOString();
  const snapshot: NetWorthSnapshot = {
    id,
    month: input.month,
    assets: input.assets,
    liabilities: input.liabilities,
    net_worth: input.net_worth,
    account_balances: input.account_balances,
    created_at: now,
  };

  db.execute(
    `INSERT INTO bg_net_worth_snapshots (id, month, assets, liabilities, net_worth, account_balances, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [snapshot.id, snapshot.month, snapshot.assets, snapshot.liabilities, snapshot.net_worth, snapshot.account_balances, snapshot.created_at],
  );

  return snapshot;
}

export function getNetWorthSnapshotById(
  db: DatabaseAdapter,
  id: string,
): NetWorthSnapshot | null {
  const rows = db.query<NetWorthSnapshot>(
    `SELECT * FROM bg_net_worth_snapshots WHERE id = ?`,
    [id],
  );
  return rows[0] ?? null;
}

export function getNetWorthSnapshotByMonth(
  db: DatabaseAdapter,
  month: string,
): NetWorthSnapshot | null {
  const rows = db.query<NetWorthSnapshot>(
    `SELECT * FROM bg_net_worth_snapshots WHERE month = ?`,
    [month],
  );
  return rows[0] ?? null;
}

export function getNetWorthSnapshots(
  db: DatabaseAdapter,
): NetWorthSnapshot[] {
  return db.query<NetWorthSnapshot>(
    `SELECT * FROM bg_net_worth_snapshots ORDER BY month DESC`,
  );
}

export function updateNetWorthSnapshot(
  db: DatabaseAdapter,
  id: string,
  updates: NetWorthSnapshotUpdate,
): void {
  const fields: string[] = [];
  const values: unknown[] = [];

  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined && NET_WORTH_SNAPSHOT_COLUMNS.has(key)) {
      fields.push(`${key} = ?`);
      values.push(value);
    }
  }

  if (fields.length === 0) return;
  values.push(id);

  db.execute(
    `UPDATE bg_net_worth_snapshots SET ${fields.join(', ')} WHERE id = ?`,
    values,
  );
}

export function deleteNetWorthSnapshot(
  db: DatabaseAdapter,
  id: string,
): void {
  db.execute(`DELETE FROM bg_net_worth_snapshots WHERE id = ?`, [id]);
}
