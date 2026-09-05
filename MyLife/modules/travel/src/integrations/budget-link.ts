/**
 * MyTravel <-> MyBudget read-only integration.
 *
 * Sums outflow transactions recorded inside a trip's date window and groups
 * them by envelope name (used as the "category" surface). Read-only: no
 * schema changes, no writes.
 *
 * Degrades gracefully if the `bg_transactions` / `bg_envelopes` tables do
 * not exist in the current database (budget module not installed).
 */

import type { DatabaseAdapter } from '@mylife/db';

export interface TripSpendingTotal {
  totalCents: number;
  byCategory: Record<string, number>;
}

export interface BudgetComparison {
  deltaCents: number;
  pctUsed?: number;
}

interface TripWindowRow {
  start_date: string | null;
  end_date: string | null;
}

interface TxnRow {
  amount: number | null;
  direction: string | null;
  envelope_name: string | null;
}

/**
 * Sum budget spending that falls inside a trip's window.
 *
 * Only `direction = 'outflow'` transactions are counted. If the budget
 * envelope table is available, spend is grouped by envelope name; if only
 * `bg_transactions` is available, `byCategory` is returned empty.
 */
export function getTripSpendingTotal(
  db: DatabaseAdapter,
  tripId: string,
): TripSpendingTotal {
  const empty: TripSpendingTotal = { totalCents: 0, byCategory: {} };

  let tripRows: TripWindowRow[];
  try {
    tripRows = db.query<TripWindowRow>(
      `SELECT start_date, end_date FROM tv_trips WHERE id = ?`,
      [tripId],
    );
  } catch {
    return empty;
  }
  if (tripRows.length === 0) return empty;
  const { start_date, end_date } = tripRows[0]!;
  if (!start_date || !end_date) return empty;

  // Prefer a JOIN against bg_envelopes for category grouping. If envelopes
  // are missing but transactions exist, fall back to an envelope-less query.
  let rows: TxnRow[];
  try {
    rows = db.query<TxnRow>(
      `SELECT t.amount AS amount,
              t.direction AS direction,
              e.name AS envelope_name
       FROM bg_transactions t
       LEFT JOIN bg_envelopes e ON e.id = t.envelope_id
       WHERE date(t.occurred_on) >= date(?)
         AND date(t.occurred_on) <= date(?)`,
      [start_date, end_date],
    );
  } catch {
    try {
      rows = db.query<TxnRow>(
        `SELECT amount AS amount,
                direction AS direction,
                NULL AS envelope_name
         FROM bg_transactions
         WHERE date(occurred_on) >= date(?)
           AND date(occurred_on) <= date(?)`,
        [start_date, end_date],
      );
    } catch {
      return empty;
    }
  }

  let totalCents = 0;
  const byCategory: Record<string, number> = {};
  for (const row of rows) {
    if (row.direction !== 'outflow') continue;
    const amount = typeof row.amount === 'number' ? row.amount : 0;
    totalCents += amount;
    if (row.envelope_name) {
      byCategory[row.envelope_name] =
        (byCategory[row.envelope_name] ?? 0) + amount;
    }
  }

  return { totalCents, byCategory };
}

/**
 * Pure budget-vs-actual comparison.
 *
 * `deltaCents` is `actualCents - estimatedBudgetCents` (positive means over
 * budget). `pctUsed` is only defined when `estimated_budget_cents` is a
 * positive number.
 */
export function estimateBudgetVsActual(
  estimated_budget_cents: number | null | undefined,
  actualCents: number,
): BudgetComparison {
  const estimated =
    typeof estimated_budget_cents === 'number' ? estimated_budget_cents : 0;
  const deltaCents = actualCents - estimated;
  if (typeof estimated_budget_cents === 'number' && estimated_budget_cents > 0) {
    return { deltaCents, pctUsed: actualCents / estimated_budget_cents };
  }
  return { deltaCents };
}
