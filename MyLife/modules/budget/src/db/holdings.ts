/**
 * CRUD operations for Investment Holdings and Snapshots.
 * Tables: bg_holdings, bg_holding_snapshots
 *
 * All currency amounts in integer cents.
 * Shares stored as REAL for fractional share support.
 */

import type { DatabaseAdapter } from '@mylife/db';
import type {
  Holding,
  HoldingInsert,
  HoldingUpdate,
  HoldingSnapshot,
  HoldingSnapshotInsert,
} from '../types';

const HOLDING_COLUMNS = new Set([
  'account_id', 'symbol', 'name', 'asset_class', 'shares', 'cost_basis',
  'current_price', 'current_value', 'currency', 'last_price_update', 'notes', 'is_active',
]);

// ---------------------------------------------------------------------------
// Holdings
// ---------------------------------------------------------------------------

export function createHolding(
  db: DatabaseAdapter,
  id: string,
  input: HoldingInsert,
): Holding {
  const now = new Date().toISOString();
  const holding: Holding = {
    id,
    account_id: input.account_id,
    symbol: input.symbol,
    name: input.name,
    asset_class: input.asset_class ?? 'stock',
    shares: input.shares,
    cost_basis: input.cost_basis,
    current_price: input.current_price ?? null,
    current_value: input.current_value ?? null,
    currency: input.currency ?? 'USD',
    last_price_update: input.last_price_update ?? null,
    notes: input.notes ?? null,
    is_active: input.is_active ?? 1,
    created_at: now,
    updated_at: now,
  };

  db.execute(
    `INSERT INTO bg_holdings
      (id, account_id, symbol, name, asset_class, shares, cost_basis,
       current_price, current_value, currency, last_price_update, notes,
       is_active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      holding.id, holding.account_id, holding.symbol, holding.name,
      holding.asset_class, holding.shares, holding.cost_basis,
      holding.current_price, holding.current_value, holding.currency,
      holding.last_price_update, holding.notes, holding.is_active,
      holding.created_at, holding.updated_at,
    ],
  );

  return holding;
}

export function getHoldingById(
  db: DatabaseAdapter,
  id: string,
): Holding | null {
  const rows = db.query<Holding>(
    `SELECT * FROM bg_holdings WHERE id = ?`,
    [id],
  );
  return rows[0] ?? null;
}

export function getHoldingsByAccount(
  db: DatabaseAdapter,
  accountId: string,
): Holding[] {
  return db.query<Holding>(
    `SELECT * FROM bg_holdings WHERE account_id = ? ORDER BY symbol ASC`,
    [accountId],
  );
}

export function getActiveHoldings(db: DatabaseAdapter): Holding[] {
  return db.query<Holding>(
    `SELECT * FROM bg_holdings WHERE is_active = 1 ORDER BY symbol ASC`,
  );
}

export function updateHolding(
  db: DatabaseAdapter,
  id: string,
  updates: HoldingUpdate,
): Holding | null {
  const fields: string[] = [];
  const values: unknown[] = [];

  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined && HOLDING_COLUMNS.has(key)) {
      fields.push(`${key} = ?`);
      values.push(value);
    }
  }

  if (fields.length === 0) return getHoldingById(db, id);

  fields.push('updated_at = ?');
  values.push(new Date().toISOString());
  values.push(id);

  db.execute(
    `UPDATE bg_holdings SET ${fields.join(', ')} WHERE id = ?`,
    values,
  );

  return getHoldingById(db, id);
}

export function deleteHolding(db: DatabaseAdapter, id: string): void {
  db.execute(`DELETE FROM bg_holdings WHERE id = ?`, [id]);
}

// ---------------------------------------------------------------------------
// Holding Snapshots
// ---------------------------------------------------------------------------

export function createHoldingSnapshot(
  db: DatabaseAdapter,
  id: string,
  input: HoldingSnapshotInsert,
): HoldingSnapshot {
  const now = new Date().toISOString();
  const snapshot: HoldingSnapshot = {
    id,
    holding_id: input.holding_id,
    date: input.date,
    shares: input.shares,
    price_per_share: input.price_per_share,
    total_value: input.total_value,
    created_at: now,
  };

  db.execute(
    `INSERT INTO bg_holding_snapshots
      (id, holding_id, date, shares, price_per_share, total_value, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      snapshot.id, snapshot.holding_id, snapshot.date,
      snapshot.shares, snapshot.price_per_share, snapshot.total_value,
      snapshot.created_at,
    ],
  );

  return snapshot;
}

export function getHoldingSnapshots(
  db: DatabaseAdapter,
  holdingId: string,
  startDate?: string,
  endDate?: string,
): HoldingSnapshot[] {
  if (startDate && endDate) {
    return db.query<HoldingSnapshot>(
      `SELECT * FROM bg_holding_snapshots
       WHERE holding_id = ? AND date >= ? AND date <= ?
       ORDER BY date ASC`,
      [holdingId, startDate, endDate],
    );
  }

  return db.query<HoldingSnapshot>(
    `SELECT * FROM bg_holding_snapshots
     WHERE holding_id = ?
     ORDER BY date DESC`,
    [holdingId],
  );
}
