/**
 * Upcoming/scheduled transactions engine.
 *
 * Projects future transactions from active recurring templates over a
 * configurable window (default 30 days). Powers the dashboard's "Upcoming"
 * strip and the Transactions tab's scheduled view.
 *
 * All amounts in integer cents.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Frequency = 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'annually';

export interface RecurringTemplate {
  id: string;
  accountId: string;
  envelopeId: string | null;
  payee: string;
  amount: number;         // cents
  frequency: Frequency;
  nextDate: string;       // YYYY-MM-DD
  endDate: string | null; // YYYY-MM-DD or null for indefinite
  isActive: boolean;
}

export interface UpcomingTransaction {
  templateId: string;
  accountId: string;
  envelopeId: string | null;
  payee: string;
  amount: number;    // cents
  date: string;      // YYYY-MM-DD
  frequency: Frequency;
}

export interface GroupedUpcoming {
  date: string;
  transactions: UpcomingTransaction[];
  total: number; // cents
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseDate(isoDate: string): Date {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function advanceByFrequency(date: Date, frequency: Frequency, anchorDay: number): Date {
  const result = new Date(date);

  switch (frequency) {
    case 'weekly':
      result.setDate(result.getDate() + 7);
      break;
    case 'biweekly':
      result.setDate(result.getDate() + 14);
      break;
    case 'monthly':
      advanceMonths(result, 1, anchorDay);
      break;
    case 'quarterly':
      advanceMonths(result, 3, anchorDay);
      break;
    case 'annually':
      advanceMonths(result, 12, anchorDay);
      break;
  }

  return result;
}

function advanceMonths(date: Date, months: number, anchorDay: number): void {
  const newMonth = date.getMonth() + months;
  date.setMonth(newMonth);
  const expectedMonth = newMonth % 12;
  if (date.getMonth() !== expectedMonth) {
    date.setDate(0); // last day of intended month
  } else {
    const daysInMonth = getDaysInMonth(date.getFullYear(), date.getMonth());
    date.setDate(Math.min(anchorDay, daysInMonth));
  }
}

// ---------------------------------------------------------------------------
// Core functions
// ---------------------------------------------------------------------------

/**
 * From active recurring templates, project all future transactions within
 * the next N days.
 */
export function getUpcomingTransactions(
  templates: RecurringTemplate[],
  daysAhead = 30,
  today?: string,
): UpcomingTransaction[] {
  const todayDate = today
    ? parseDate(today)
    : new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());
  const cutoff = new Date(todayDate);
  cutoff.setDate(cutoff.getDate() + daysAhead);

  const upcoming: UpcomingTransaction[] = [];

  for (const tmpl of templates) {
    if (!tmpl.isActive) continue;

    let current = parseDate(tmpl.nextDate);
    const anchorDay = current.getDate();
    const endDate = tmpl.endDate ? parseDate(tmpl.endDate) : null;

    while (current <= cutoff) {
      if (endDate && current > endDate) break;

      if (current >= todayDate) {
        upcoming.push({
          templateId: tmpl.id,
          accountId: tmpl.accountId,
          envelopeId: tmpl.envelopeId,
          payee: tmpl.payee,
          amount: tmpl.amount,
          date: formatDate(current),
          frequency: tmpl.frequency,
        });
      }

      current = advanceByFrequency(current, tmpl.frequency, anchorDay);
    }
  }

  upcoming.sort((a, b) => a.date.localeCompare(b.date));
  return upcoming;
}

/**
 * Group projected upcoming transactions by date for timeline display.
 */
export function groupByDate(upcoming: UpcomingTransaction[]): GroupedUpcoming[] {
  const map = new Map<string, UpcomingTransaction[]>();

  for (const txn of upcoming) {
    const list = map.get(txn.date) ?? [];
    list.push(txn);
    map.set(txn.date, list);
  }

  const groups: GroupedUpcoming[] = [];
  for (const [date, transactions] of map) {
    let total = 0;
    for (const t of transactions) {
      total += t.amount;
    }
    groups.push({ date, transactions, total });
  }

  groups.sort((a, b) => a.date.localeCompare(b.date));
  return groups;
}

/**
 * Sum of all upcoming transaction amounts.
 */
export function getUpcomingTotal(upcoming: UpcomingTransaction[]): number {
  let total = 0;
  for (const txn of upcoming) {
    total += txn.amount;
  }
  return total;
}
