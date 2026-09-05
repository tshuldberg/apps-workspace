/**
 * Financial reporting engine.
 *
 * Generates spending breakdowns by category, monthly trends, budget-vs-spent
 * comparisons, and top payees. Handles transaction splits for accurate
 * multi-category reporting.
 *
 * In the hub, "categories" map to "envelopes".
 *
 * All amounts in integer cents.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DateRange {
  start: string; // YYYY-MM-DD
  end: string;   // YYYY-MM-DD
}

export interface CategorySpending {
  categoryId: string;
  categoryName: string;
  amount: number;   // cents (positive = total spent)
  percentage: number; // 0-100
  transactionCount: number;
}

export interface MonthlySpendingPoint {
  month: string;   // YYYY-MM
  amount: number;  // cents (positive = total spent)
}

export interface BudgetVsSpentRow {
  categoryId: string;
  categoryName: string;
  budgeted: number;  // cents
  spent: number;     // cents (positive)
  remaining: number; // cents (budgeted - spent)
  percentUsed: number; // 0-100+
}

export interface TopPayee {
  payee: string;
  totalAmount: number; // cents (positive)
  transactionCount: number;
  percentage: number;  // 0-100
}

interface Transaction {
  id: string;
  categoryId: string | null;
  amount: number;    // cents (negative = spending)
  payee: string;
  date: string;      // YYYY-MM-DD
  isTransfer?: boolean;
}

interface TransactionSplit {
  transactionId: string;
  categoryId: string;
  amount: number; // cents
}

interface CategoryInfo {
  id: string;
  name: string;
}

interface AllocationInfo {
  categoryId: string;
  amount: number; // cents
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isInRange(date: string, range: DateRange): boolean {
  return date >= range.start && date <= range.end;
}

function getMonthKey(date: string): string {
  return date.substring(0, 7);
}

// ---------------------------------------------------------------------------
// Core functions
// ---------------------------------------------------------------------------

/**
 * Break down spending by category for a date range.
 * Handles split transactions by distributing amounts across categories.
 */
export function getSpendingByCategory(
  transactions: Transaction[],
  splits: TransactionSplit[],
  categories: CategoryInfo[],
  range: DateRange,
): CategorySpending[] {
  const categoryMap = new Map<string, CategoryInfo>();
  for (const c of categories) {
    categoryMap.set(c.id, c);
  }

  // Build split lookup: transactionId -> splits
  const splitMap = new Map<string, TransactionSplit[]>();
  for (const s of splits) {
    const list = splitMap.get(s.transactionId) ?? [];
    list.push(s);
    splitMap.set(s.transactionId, list);
  }

  // Accumulate spending by category
  const spending = new Map<string, { amount: number; count: number }>();

  for (const txn of transactions) {
    if (txn.isTransfer) continue;
    if (txn.amount >= 0) continue; // only count spending (negative amounts)
    if (!isInRange(txn.date, range)) continue;

    const txnSplits = splitMap.get(txn.id);

    if (txnSplits && txnSplits.length > 0) {
      // Distribute across split categories
      for (const split of txnSplits) {
        const entry = spending.get(split.categoryId) ?? { amount: 0, count: 0 };
        entry.amount += Math.abs(split.amount);
        entry.count++;
        spending.set(split.categoryId, entry);
      }
    } else if (txn.categoryId) {
      // Single-category transaction
      const entry = spending.get(txn.categoryId) ?? { amount: 0, count: 0 };
      entry.amount += Math.abs(txn.amount);
      entry.count++;
      spending.set(txn.categoryId, entry);
    }
  }

  // Calculate total for percentages
  let total = 0;
  for (const [, data] of spending) {
    total += data.amount;
  }

  // Build result
  const result: CategorySpending[] = [];
  for (const [categoryId, data] of spending) {
    const category = categoryMap.get(categoryId);
    result.push({
      categoryId,
      categoryName: category?.name ?? 'Uncategorized',
      amount: data.amount,
      percentage: total > 0 ? Math.round((data.amount / total) * 100) : 0,
      transactionCount: data.count,
    });
  }

  result.sort((a, b) => b.amount - a.amount);
  return result;
}

/**
 * Calculate monthly spending trend over a date range.
 */
export function getMonthlySpendingTrend(
  transactions: Transaction[],
  range: DateRange,
): MonthlySpendingPoint[] {
  const months = new Map<string, number>();

  for (const txn of transactions) {
    if (txn.isTransfer) continue;
    if (txn.amount >= 0) continue;
    if (!isInRange(txn.date, range)) continue;

    const month = getMonthKey(txn.date);
    months.set(month, (months.get(month) ?? 0) + Math.abs(txn.amount));
  }

  const points: MonthlySpendingPoint[] = [];
  for (const [month, amount] of months) {
    points.push({ month, amount });
  }

  points.sort((a, b) => a.month.localeCompare(b.month));
  return points;
}

/**
 * Compare budgeted (allocated) amounts vs actual spending per category.
 */
export function getBudgetedVsSpent(
  allocations: AllocationInfo[],
  transactions: Transaction[],
  splits: TransactionSplit[],
  categories: CategoryInfo[],
  range: DateRange,
): BudgetVsSpentRow[] {
  const spendingData = getSpendingByCategory(transactions, splits, categories, range);
  const spendingMap = new Map<string, CategorySpending>();
  for (const s of spendingData) {
    spendingMap.set(s.categoryId, s);
  }

  const categoryMap = new Map<string, CategoryInfo>();
  for (const c of categories) {
    categoryMap.set(c.id, c);
  }

  const rows: BudgetVsSpentRow[] = [];

  for (const alloc of allocations) {
    const spent = spendingMap.get(alloc.categoryId)?.amount ?? 0;
    const category = categoryMap.get(alloc.categoryId);

    rows.push({
      categoryId: alloc.categoryId,
      categoryName: category?.name ?? 'Unknown',
      budgeted: alloc.amount,
      spent,
      remaining: alloc.amount - spent,
      percentUsed: alloc.amount > 0 ? Math.round((spent / alloc.amount) * 100) : 0,
    });
  }

  rows.sort((a, b) => b.percentUsed - a.percentUsed);
  return rows;
}

/**
 * Get top N payees by total spending.
 */
export function getTopPayees(
  transactions: Transaction[],
  range: DateRange,
  limit = 10,
): TopPayee[] {
  const payeeMap = new Map<string, { total: number; count: number }>();

  for (const txn of transactions) {
    if (txn.isTransfer) continue;
    if (txn.amount >= 0) continue;
    if (!isInRange(txn.date, range)) continue;
    if (!txn.payee) continue;

    const key = txn.payee.toLowerCase().trim();
    const entry = payeeMap.get(key) ?? { total: 0, count: 0 };
    entry.total += Math.abs(txn.amount);
    entry.count++;
    payeeMap.set(key, entry);
  }

  let grandTotal = 0;
  for (const [, data] of payeeMap) {
    grandTotal += data.total;
  }

  const payees: TopPayee[] = [];
  for (const [payee, data] of payeeMap) {
    payees.push({
      payee,
      totalAmount: data.total,
      transactionCount: data.count,
      percentage: grandTotal > 0 ? Math.round((data.total / grandTotal) * 100) : 0,
    });
  }

  payees.sort((a, b) => b.totalAmount - a.totalAmount);
  return payees.slice(0, limit);
}
