/**
 * Recurring events engine for RSVP module.
 * Calculates next occurrences for weekly, biweekly, monthly, and custom frequencies.
 */

import type { RecurrenceFrequency, RecurrenceEndType } from '../types';

export interface RecurrenceConfig {
  frequency: RecurrenceFrequency;
  intervalCount: number;
  dayOfWeek: number | null;
  dayOfMonth: number | null;
  endType: RecurrenceEndType;
  endAfterCount: number | null;
  endByDate: string | null;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/**
 * Calculate the next occurrence date from a given date.
 */
export function calculateNextOccurrence(
  fromDate: string,
  config: RecurrenceConfig,
): string {
  const d = new Date(fromDate);

  switch (config.frequency) {
    case 'daily':
      d.setDate(d.getDate() + (config.intervalCount || 1));
      break;
    case 'weekly':
      d.setDate(d.getDate() + 7);
      break;
    case 'biweekly':
      d.setDate(d.getDate() + 14);
      break;
    case 'monthly': {
      const targetDay = config.dayOfMonth ?? d.getDate();
      const curMonth = d.getMonth();
      const nextMonth = curMonth + 1;
      const nextYear = nextMonth > 11 ? d.getFullYear() + 1 : d.getFullYear();
      const normalizedMonth = nextMonth % 12;
      const maxDay = daysInMonth(nextYear, normalizedMonth);
      // Set day to 1 first to avoid month overflow (e.g., Jan 31 -> setMonth(1) would skip to Mar 3)
      d.setDate(1);
      d.setFullYear(nextYear);
      d.setMonth(normalizedMonth);
      d.setDate(Math.min(targetDay, maxDay));
      break;
    }
    case 'custom':
      d.setDate(d.getDate() + 7 * (config.intervalCount || 1));
      break;
  }

  return d.toISOString();
}

/**
 * Generate a list of upcoming occurrence dates starting from a base date.
 * Returns up to `count` dates that satisfy the end condition.
 */
export function generateOccurrences(
  startDate: string,
  config: RecurrenceConfig,
  count: number,
  existingCount = 0,
): string[] {
  const dates: string[] = [];
  let current = startDate;
  let totalGenerated = existingCount;

  for (let i = 0; i < count * 2 && dates.length < count; i++) {
    const next = calculateNextOccurrence(current, config);

    if (config.endType === 'after_count' && config.endAfterCount != null) {
      if (totalGenerated >= config.endAfterCount) break;
    }

    if (config.endType === 'by_date' && config.endByDate != null) {
      if (new Date(next) > new Date(config.endByDate)) break;
    }

    dates.push(next);
    totalGenerated++;
    current = next;
  }

  return dates;
}

/**
 * Check if more occurrences should be generated.
 */
export function shouldGenerateMore(
  upcomingCount: number,
  target = 4,
): boolean {
  return upcomingCount < target;
}
