/**
 * Recurring transaction schedule calculator.
 *
 * Given a frequency and start date, calculates when the next occurrence falls
 * and generates a series of future dates. Handles month-end edge cases
 * (e.g., the 31st in a 30-day month clamps to the 30th).
 *
 * All dates as YYYY-MM-DD strings.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Frequency = 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'annually';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function advanceMonths(date: Date, months: number, anchorDay: number): void {
  const newMonth = date.getMonth() + months;
  date.setMonth(newMonth);
  const expectedMonth = newMonth % 12;
  if (date.getMonth() !== expectedMonth) {
    date.setDate(0); // last day of intended month
  } else {
    const dim = daysInMonth(date.getFullYear(), date.getMonth());
    date.setDate(Math.min(anchorDay, dim));
  }
}

// ---------------------------------------------------------------------------
// Core functions
// ---------------------------------------------------------------------------

/**
 * Calculate the next occurrence date from a given date and frequency.
 */
export function calculateNextDate(currentDate: string, frequency: Frequency): string {
  const d = parseDate(currentDate);
  const anchorDay = d.getDate();

  switch (frequency) {
    case 'weekly':
      d.setDate(d.getDate() + 7);
      break;
    case 'biweekly':
      d.setDate(d.getDate() + 14);
      break;
    case 'monthly':
      advanceMonths(d, 1, anchorDay);
      break;
    case 'quarterly':
      advanceMonths(d, 3, anchorDay);
      break;
    case 'annually':
      advanceMonths(d, 12, anchorDay);
      break;
  }

  return formatDate(d);
}

/**
 * Generate N future occurrence dates from a start date.
 */
export function generateOccurrences(
  startDate: string,
  frequency: Frequency,
  count: number,
): string[] {
  const dates: string[] = [];
  let current = startDate;

  for (let i = 0; i < count; i++) {
    current = calculateNextDate(current, frequency);
    dates.push(current);
  }

  return dates;
}
