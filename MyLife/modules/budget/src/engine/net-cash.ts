/**
 * Net cash flow calculator.
 *
 * Computes inflows minus outflows over a period, calculates period-by-period
 * cash flow (daily/weekly/monthly), and builds a running balance timeline.
 * Transfer transactions are excluded from calculations to avoid double-counting.
 *
 * All amounts in integer cents.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface NetCashResult {
  inflows: number;    // cents (positive sum)
  outflows: number;   // cents (positive, absolute of negative amounts)
  netCash: number;    // cents (inflows - outflows)
  transactionCount: number;
}

export type CashFlowPeriodType = 'daily' | 'weekly' | 'monthly';

export interface CashFlowPeriod {
  period: string; // YYYY-MM-DD for daily, YYYY-Www for weekly, YYYY-MM for monthly
  inflows: number;
  outflows: number;
  netCash: number;
}

export interface RunningBalanceEntry {
  date: string;  // YYYY-MM-DD
  balance: number; // cents
  change: number;  // cents (net change on this date)
}

interface Transaction {
  amount: number;    // cents (positive = inflow, negative = outflow)
  date: string;      // YYYY-MM-DD
  isTransfer?: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getWeekKey(dateStr: string): string {
  const d = new Date(dateStr);
  // ISO week calculation
  const jan4 = new Date(d.getFullYear(), 0, 4);
  const dayOfYear = Math.floor((d.getTime() - new Date(d.getFullYear(), 0, 1).getTime()) / 86400000) + 1;
  const weekNum = Math.ceil((dayOfYear + jan4.getDay() - 1) / 7);
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

function getMonthKey(dateStr: string): string {
  return dateStr.substring(0, 7); // YYYY-MM
}

// ---------------------------------------------------------------------------
// Core functions
// ---------------------------------------------------------------------------

/**
 * Calculate net cash flow (inflows - outflows) for a set of transactions.
 * Transfers are excluded.
 */
export function calculateNetCash(transactions: Transaction[]): NetCashResult {
  let inflows = 0;
  let outflows = 0;
  let count = 0;

  for (const txn of transactions) {
    if (txn.isTransfer) continue;
    count++;
    if (txn.amount > 0) {
      inflows += txn.amount;
    } else {
      outflows += Math.abs(txn.amount);
    }
  }

  return {
    inflows,
    outflows,
    netCash: inflows - outflows,
    transactionCount: count,
  };
}

/**
 * Calculate cash flow grouped by period (daily, weekly, or monthly).
 */
export function calculateCashFlowByPeriod(
  transactions: Transaction[],
  periodType: CashFlowPeriodType,
): CashFlowPeriod[] {
  const groups = new Map<string, { inflows: number; outflows: number }>();

  for (const txn of transactions) {
    if (txn.isTransfer) continue;

    let key: string;
    switch (periodType) {
      case 'daily':
        key = txn.date;
        break;
      case 'weekly':
        key = getWeekKey(txn.date);
        break;
      case 'monthly':
        key = getMonthKey(txn.date);
        break;
    }

    const entry = groups.get(key) ?? { inflows: 0, outflows: 0 };
    if (txn.amount > 0) {
      entry.inflows += txn.amount;
    } else {
      entry.outflows += Math.abs(txn.amount);
    }
    groups.set(key, entry);
  }

  const periods: CashFlowPeriod[] = [];
  for (const [period, data] of groups) {
    periods.push({
      period,
      inflows: data.inflows,
      outflows: data.outflows,
      netCash: data.inflows - data.outflows,
    });
  }

  periods.sort((a, b) => a.period.localeCompare(b.period));
  return periods;
}

/**
 * Build a running balance timeline from transactions and a starting balance.
 */
export function calculateRunningBalance(
  transactions: Transaction[],
  startingBalance: number,
): RunningBalanceEntry[] {
  // Group transactions by date
  const byDate = new Map<string, number>();
  for (const txn of transactions) {
    if (txn.isTransfer) continue;
    byDate.set(txn.date, (byDate.get(txn.date) ?? 0) + txn.amount);
  }

  // Sort dates and build running balance
  const sortedDates = [...byDate.keys()].sort();
  const entries: RunningBalanceEntry[] = [];
  let balance = startingBalance;

  for (const date of sortedDates) {
    const change = byDate.get(date)!;
    balance += change;
    entries.push({ date, balance, change });
  }

  return entries;
}
