import type { Affirmation } from './types';

/**
 * Select the daily affirmation from the active pool.
 * Algorithm: least-recently-shown first, favorites get 2x representation.
 */
export function selectDailyAffirmation(
  pool: Affirmation[],
  today: string,
): Affirmation | null {
  // Filter out dismissed
  const active = pool.filter((a) => !a.isDismissed);
  if (active.length === 0) return null;

  // Sort by lastShownDate ASC, nulls first
  const sorted = [...active].sort((a, b) => {
    if (!a.lastShownDate && !b.lastShownDate) return 0;
    if (!a.lastShownDate) return -1;
    if (!b.lastShownDate) return 1;
    return a.lastShownDate.localeCompare(b.lastShownDate);
  });

  // Build weighted list: favorites appear twice
  const weighted: Affirmation[] = [];
  for (const aff of sorted) {
    weighted.push(aff);
    if (aff.isFavorite) weighted.push(aff);
  }

  // If already shown today, return that one (stability)
  const shownToday = active.find((a) => a.lastShownDate === today);
  if (shownToday) return shownToday;

  return weighted[0];
}

/**
 * Calculate affirmation streak from a list of affirmed dates (DESC order).
 * Uses same 1-day grace period as journal streak.
 */
export function calculateAffirmationStreak(
  affirmedDates: string[],
  referenceDate: string,
): { currentStreak: number; longestStreak: number } {
  if (affirmedDates.length === 0) {
    return { currentStreak: 0, longestStreak: 0 };
  }

  const sorted = [...affirmedDates].sort();
  let longestStreak = 0;
  let running = 0;
  let previous: string | null = null;

  for (const date of sorted) {
    if (!previous || previousDay(date) === previous) {
      running += 1;
    } else {
      longestStreak = Math.max(longestStreak, running);
      running = 1;
    }
    previous = date;
  }
  longestStreak = Math.max(longestStreak, running);

  // Current streak check with grace period
  const graceSet = new Set([referenceDate, previousDay(referenceDate)]);
  const mostRecent = [...affirmedDates].sort().pop()!;
  if (!graceSet.has(mostRecent)) {
    return { currentStreak: 0, longestStreak };
  }

  let currentStreak = 1;
  const desc = [...affirmedDates].sort().reverse();
  let expected = previousDay(desc[0]);
  for (let i = 1; i < desc.length; i++) {
    if (desc[i] !== expected) break;
    currentStreak += 1;
    expected = previousDay(expected);
  }

  return { currentStreak, longestStreak };
}

function previousDay(dateStr: string): string {
  const date = new Date(`${dateStr}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

/**
 * Validate affirmation text: non-empty after trim, max 200 chars.
 */
export function validateAffirmationText(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return 'Affirmation text cannot be empty';
  if (trimmed.length > 200) return 'Affirmation text cannot exceed 200 characters';
  return null;
}
