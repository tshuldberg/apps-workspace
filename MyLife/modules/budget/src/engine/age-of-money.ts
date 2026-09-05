/**
 * Age of Money (AoM) calculation engine.
 *
 * Implements the YNAB-style FIFO method: build a queue of inflows ordered by
 * date, then for the most recent N outflows, calculate how old the money was
 * that funded each outflow by consuming from the inflow queue in FIFO order.
 *
 * All amounts in integer cents. Pure functions, no side effects.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AoMTransaction {
  amount: number;       // cents (always positive)
  direction: 'inflow' | 'outflow' | 'transfer';
  occurredOn: string;   // YYYY-MM-DD
}

export interface FifoEntry {
  date: string;          // YYYY-MM-DD
  remainingAmount: number; // cents
}

export interface AoMResult {
  ageDays: number;        // average age in days
  sampleSize: number;     // number of outflows sampled
  isEstimate: boolean;    // true if fewer than requested sample outflows
}

export interface AoMSnapshotData {
  date: string;           // YYYY-MM-DD
  ageDays: number;
  sampleSize: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function daysBetween(earlier: string, later: string): number {
  const a = new Date(earlier + 'T00:00:00Z');
  const b = new Date(later + 'T00:00:00Z');
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 86400000));
}

// ---------------------------------------------------------------------------
// Core functions
// ---------------------------------------------------------------------------

/**
 * Build a FIFO queue of inflows ordered by date ascending.
 * Skips transfers and zero/negative amounts.
 */
export function buildFifoQueue(transactions: AoMTransaction[]): FifoEntry[] {
  return transactions
    .filter((t) => t.direction === 'inflow' && t.amount > 0)
    .sort((a, b) => a.occurredOn.localeCompare(b.occurredOn))
    .map((t) => ({ date: t.occurredOn, remainingAmount: t.amount }));
}

/**
 * Calculate Age of Money using the FIFO method.
 *
 * @param transactions All transactions (inflows, outflows, transfers)
 * @param referenceDate The date to measure age against (typically today, YYYY-MM-DD)
 * @param sampleSize Number of recent outflows to sample (default 10)
 * @returns AoMResult or null if not computable (no inflows or no outflows)
 */
export function calculateAgeOfMoney(
  transactions: AoMTransaction[],
  referenceDate: string,
  sampleSize = 10,
): AoMResult | null {
  // Build inflow queue (FIFO)
  const queue = buildFifoQueue(transactions);

  // Get recent outflows (exclude transfers), sorted by date descending
  const outflows = transactions
    .filter((t) => t.direction === 'outflow' && t.amount > 0)
    .sort((a, b) => b.occurredOn.localeCompare(a.occurredOn))
    .slice(0, sampleSize);

  if (outflows.length === 0) return null;

  // No inflows but outflows exist = deficit spending, AoM is 0
  if (queue.length === 0) {
    return { ageDays: 0, sampleSize: outflows.length, isEstimate: outflows.length < sampleSize };
  }

  // Process outflows from most recent to oldest, consuming from the FIFO queue
  // We need a fresh copy of the queue for consumption
  const fifo = queue.map((e) => ({ ...e }));
  let fifoIdx = 0;
  let totalWeightedAge = 0;
  let totalAmountConsumed = 0;

  for (const outflow of outflows) {
    let remaining = outflow.amount;

    while (remaining > 0 && fifoIdx < fifo.length) {
      const entry = fifo[fifoIdx];

      if (entry.remainingAmount <= 0) {
        fifoIdx++;
        continue;
      }

      const consume = Math.min(remaining, entry.remainingAmount);
      const age = daysBetween(entry.date, referenceDate);
      totalWeightedAge += age * consume;
      totalAmountConsumed += consume;

      entry.remainingAmount -= consume;
      remaining -= consume;

      if (entry.remainingAmount <= 0) {
        fifoIdx++;
      }
    }

    // If FIFO queue exhausted (deficit spending), remaining has age 0
    if (remaining > 0) {
      totalAmountConsumed += remaining;
      // age 0 contributes nothing to totalWeightedAge
    }
  }

  if (totalAmountConsumed === 0) return null;

  const ageDays = Math.round(totalWeightedAge / totalAmountConsumed);

  return {
    ageDays,
    sampleSize: outflows.length,
    isEstimate: outflows.length < sampleSize,
  };
}

/**
 * Determine the health status color for an AoM value.
 */
export function getAoMStatus(ageDays: number): 'urgent' | 'improving' | 'healthy' {
  if (ageDays < 14) return 'urgent';
  if (ageDays < 30) return 'improving';
  return 'healthy';
}

/**
 * Calculate trend (change in days) between two AoM values.
 */
export function calculateAoMTrend(
  current: number,
  previous: number | null,
): { change: number; direction: 'up' | 'down' | 'flat' } {
  if (previous === null) return { change: 0, direction: 'flat' };
  const change = current - previous;
  const direction = change > 0 ? 'up' : change < 0 ? 'down' : 'flat';
  return { change, direction };
}
