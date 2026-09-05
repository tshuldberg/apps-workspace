/**
 * Weekly spending digest generator.
 *
 * Produces a structured summary of the user's financial week:
 * total spent, top categories, biggest purchase, week-over-week
 * comparison, and alert summary. Returns a typed object that
 * the hub engagement package can use for notifications.
 *
 * All amounts in integer cents.
 */

export interface WeeklyDigest {
  /** Start of the week (Monday) as YYYY-MM-DD. */
  weekStart: string;
  /** End of the week (Sunday) as YYYY-MM-DD. */
  weekEnd: string;
  /** Total outflow for the week. Cents. */
  totalSpentCents: number;
  /** Total inflow for the week. Cents. */
  totalIncomeCents: number;
  /** Net (income - spending). Cents. Positive = surplus. */
  netCents: number;
  /** Top spending categories (envelope names + amounts), max 5. */
  topCategories: CategoryDigestEntry[];
  /** Single biggest transaction of the week. */
  biggestPurchase: BiggestPurchase | null;
  /** Week-over-week spending change. null if no prior week data. */
  weekOverWeekChange: number | null;
  /** Number of transactions this week. */
  transactionCount: number;
  /** Number of no-spend days this week (0-7). */
  noSpendDays: number;
  /** Number of budget alerts triggered this week. */
  alertsTriggered: number;
  /** Human-readable one-line summary. */
  summary: string;
}

export interface CategoryDigestEntry {
  envelopeName: string;
  totalCents: number;
  transactionCount: number;
}

export interface BiggestPurchase {
  merchant: string;
  amountCents: number;
  envelopeName: string | null;
  date: string;
}

export interface WeeklyDigestInput {
  /** Transactions for this week: {amount (cents), direction, merchant, envelopeName, date} */
  transactions: DigestTransaction[];
  /** Total outflow from the previous week. Cents. null if no data. */
  priorWeekSpentCents: number | null;
  /** Number of alerts triggered this week. */
  alertsTriggered: number;
  /** Reference Monday date for this digest. YYYY-MM-DD. */
  weekStart: string;
}

export interface DigestTransaction {
  amountCents: number;
  direction: 'inflow' | 'outflow' | 'transfer';
  merchant: string | null;
  envelopeName: string | null;
  date: string;
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Generate a weekly spending digest.
 */
export function generateWeeklyDigest(input: WeeklyDigestInput): WeeklyDigest {
  const { transactions, priorWeekSpentCents, alertsTriggered, weekStart } = input;
  const weekEnd = addDays(weekStart, 6);

  let totalSpentCents = 0;
  let totalIncomeCents = 0;
  const categoryMap = new Map<string, CategoryDigestEntry>();
  let biggestPurchase: BiggestPurchase | null = null;
  const spendDays = new Set<string>();

  for (const tx of transactions) {
    if (tx.direction === 'outflow') {
      totalSpentCents += tx.amountCents;
      spendDays.add(tx.date);

      // Track categories
      const envName = tx.envelopeName ?? 'Uncategorized';
      const existing = categoryMap.get(envName);
      if (existing) {
        existing.totalCents += tx.amountCents;
        existing.transactionCount += 1;
      } else {
        categoryMap.set(envName, {
          envelopeName: envName,
          totalCents: tx.amountCents,
          transactionCount: 1,
        });
      }

      // Track biggest purchase
      if (!biggestPurchase || tx.amountCents > biggestPurchase.amountCents) {
        biggestPurchase = {
          merchant: tx.merchant ?? 'Unknown',
          amountCents: tx.amountCents,
          envelopeName: tx.envelopeName,
          date: tx.date,
        };
      }
    } else if (tx.direction === 'inflow') {
      totalIncomeCents += tx.amountCents;
    }
  }

  const netCents = totalIncomeCents - totalSpentCents;

  // Top 5 categories by spending
  const topCategories = Array.from(categoryMap.values())
    .sort((a, b) => b.totalCents - a.totalCents)
    .slice(0, 5);

  // Week-over-week change
  const weekOverWeekChange = priorWeekSpentCents !== null && priorWeekSpentCents > 0
    ? (totalSpentCents - priorWeekSpentCents) / priorWeekSpentCents
    : null;

  // Count no-spend days (7 days in a week minus days with outflow)
  const allWeekDates: string[] = [];
  for (let i = 0; i < 7; i++) {
    allWeekDates.push(addDays(weekStart, i));
  }
  const noSpendDays = allWeekDates.filter((d) => !spendDays.has(d)).length;

  // Summary
  const dollars = Math.round(totalSpentCents / 100);
  let summary: string;
  if (weekOverWeekChange !== null) {
    const pct = Math.abs(Math.round(weekOverWeekChange * 100));
    const direction = weekOverWeekChange >= 0 ? 'up' : 'down';
    summary = `You spent $${dollars} this week (${direction} ${pct}% from last week)`;
  } else {
    summary = `You spent $${dollars} this week`;
  }

  return {
    weekStart,
    weekEnd,
    totalSpentCents,
    totalIncomeCents,
    netCents,
    topCategories,
    biggestPurchase,
    weekOverWeekChange,
    transactionCount: transactions.length,
    noSpendDays,
    alertsTriggered,
    summary,
  };
}
