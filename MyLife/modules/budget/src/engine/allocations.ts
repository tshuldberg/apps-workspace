/**
 * Budget allocation operations.
 *
 * Unlike most engine modules, this one interacts with the database to persist
 * allocation records. Uses the hub's DatabaseAdapter interface and bg_ table
 * prefix convention.
 *
 * All amounts in integer cents.
 */

import type { DatabaseAdapter } from '@mylife/db';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AllocationRow {
  id: string;
  envelope_id: string;
  month: string;
  allocated: number;
}

// ---------------------------------------------------------------------------
// Core functions
// ---------------------------------------------------------------------------

/**
 * Allocate (or update) an amount to an envelope for a given month.
 * Uses INSERT OR REPLACE to upsert.
 */
export function allocateToEnvelope(
  db: DatabaseAdapter,
  envelopeId: string,
  month: string,
  amount: number,
): void {
  db.execute(
    `INSERT INTO bg_budget_allocations (id, envelope_id, month, allocated)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(envelope_id, month) DO UPDATE SET allocated = excluded.allocated`,
    [`${envelopeId}:${month}`, envelopeId, month, amount],
  );
}

/**
 * Move an allocation amount from one envelope to another within the same month.
 */
export function moveAllocation(
  db: DatabaseAdapter,
  fromEnvelopeId: string,
  toEnvelopeId: string,
  month: string,
  amount: number,
): void {
  db.transaction(() => {
    const fromRows = db.query<AllocationRow>(
      `SELECT * FROM bg_budget_allocations WHERE envelope_id = ? AND month = ?`,
      [fromEnvelopeId, month],
    );
    const toRows = db.query<AllocationRow>(
      `SELECT * FROM bg_budget_allocations WHERE envelope_id = ? AND month = ?`,
      [toEnvelopeId, month],
    );

    const fromAmount = fromRows[0]?.allocated ?? 0;
    const toAmount = toRows[0]?.allocated ?? 0;

    allocateToEnvelope(db, fromEnvelopeId, month, fromAmount - amount);
    allocateToEnvelope(db, toEnvelopeId, month, toAmount + amount);
  });
}

/**
 * Get all allocations for a given month.
 */
export function getAllocationsForMonth(
  db: DatabaseAdapter,
  month: string,
): { envelopeId: string; amount: number }[] {
  const rows = db.query<AllocationRow>(
    `SELECT * FROM bg_budget_allocations WHERE month = ?`,
    [month],
  );

  return rows.map((r) => ({
    envelopeId: r.envelope_id,
    amount: r.allocated,
  }));
}

/**
 * Build a lookup map of envelope_id -> allocated amount for a month.
 */
export function getAllocationMap(
  db: DatabaseAdapter,
  month: string,
): Map<string, number> {
  const allocations = getAllocationsForMonth(db, month);
  const map = new Map<string, number>();
  for (const a of allocations) {
    map.set(a.envelopeId, a.amount);
  }
  return map;
}
